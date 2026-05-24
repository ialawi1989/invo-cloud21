import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  computed,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { OverlayModule, ConnectedPosition } from '@angular/cdk/overlay';

import {
  clamp,
  hexToRgb,
  hslToRgb,
  hsvToRgb,
  normaliseHex,
  rgbToHex,
  rgbToHsv,
} from '../color-picker/color-conversions';
import {
  DEFAULT_GRADIENT,
  GradientStop,
  GradientValue,
  gradientToCss,
  parseGradient,
} from '../gradient-picker/gradient-picker.types';

type PanelMode = 'color' | 'gradient';

/**
 * ColorsPanel — unified floating editor for a section/element's background
 * that can be either a solid colour or a multi-stop linear gradient.
 *
 *   • Two tabs at the top (Color / Gradient).
 *   • Color tab — HSV saturation/value picker + hue strip + eyedropper +
 *     HEX input + add-to-saved chip and saved-colours grid.
 *   • Gradient tab — circular angle dial, Linear type selector + reverse
 *     button, gradient preview with endpoint chips, per-stop editor (mini
 *     opacity slider + % input + colour swatch that opens the secondary
 *     `<app-color-picker>` for HEX/RGB/HSB), and a Save Gradient list.
 *   • Footer: Reset to Default (clears to a known starting point).
 *
 * The component emits a *single* string via `ngModel`:
 *   - mode === 'color'    → `#RRGGBB`
 *   - mode === 'gradient' → `linear-gradient(...)` CSS string
 *
 * Callers can listen to `(modeChange)` to know which kind is active and
 * persist their own `bannerBgKind`-style discriminator.
 *
 * Saved colours / gradients are intentionally in-memory only for now —
 * wire-up to storage can come later without changing the public API.
 */
@Component({
  selector: 'app-colors-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './colors-panel.component.html',
  styleUrl: './colors-panel.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ColorsPanelComponent),
      multi: true,
    },
  ],
})
export class ColorsPanelComponent implements ControlValueAccessor {
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    // Hydrate saved lists from localStorage. Stored as JSON arrays; any
    // parse failure falls back to an empty list rather than throwing
    // (the rest of the panel must work even if storage is unavailable
    // or corrupted).
    try {
      const c = localStorage.getItem(ColorsPanelComponent.LS_COLORS);
      if (c) {
        const arr = JSON.parse(c);
        if (Array.isArray(arr)) this.savedColors.set(arr.filter((x: unknown): x is string => typeof x === 'string'));
      }
      const g = localStorage.getItem(ColorsPanelComponent.LS_GRADIENTS);
      if (g) {
        const arr = JSON.parse(g);
        if (Array.isArray(arr)) this.savedGradients.set(arr.filter((x: unknown): x is string => typeof x === 'string'));
      }
    } catch { /* localStorage unavailable or quota — silent fallback */ }
  }

  /** Push a saved-list signal to localStorage. Catches QuotaExceeded
   *  and the SecurityError thrown in privacy-mode sessions. */
  private persistSaved(key: string, value: string[]): void {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
  }

  // ─── Inputs ────────────────────────────────────────────────────────────
  initialMode = input<PanelMode>('color');
  /** Hide the Gradient tab + lock the panel to solid-colour editing.
   *  Use when the consumer's data model is a single hex (column fill,
   *  border colour, etc.) and gradients aren't applicable. */
  colorOnly = input<boolean>(false);
  disabledInput = input<boolean>(false, { alias: 'disabled' });

  // ─── Outputs ───────────────────────────────────────────────────────────
  @Output() modeChange = new EventEmitter<PanelMode>();
  @Output() closed = new EventEmitter<void>();

  // ─── State ─────────────────────────────────────────────────────────────
  mode = signal<PanelMode>('color');
  /** The picked colour as `#RRGGBB`, or empty string for "no colour".
   *  Empty is a real, emittable state — callers that want a default
   *  should provide one rather than relying on a hidden fallback. */
  color = signal<string>('');
  gradient = signal<GradientValue>(structuredClone(DEFAULT_GRADIENT));
  selectedStopIndex = signal<number>(0);

  /** Cached HSV — keeps the spectrum thumb on the picked point instead of
   *  re-deriving from hex on every change (loses precision for grays). */
  private hsv = signal<{ h: number; s: number; v: number }>({ h: 0, s: 0, v: 0 });

  savedColors = signal<string[]>([]);
  savedGradients = signal<string[]>([]);

  cvaDisabled = signal<boolean>(false);
  isDisabled = computed(() => this.disabledInput() || this.cvaDisabled());

  /** localStorage keys for the in-app saved-colour / saved-gradient
   *  lists. Stored as JSON arrays. */
  private static readonly LS_COLORS = 'colorsPanel.savedColors';
  private static readonly LS_GRADIENTS = 'colorsPanel.savedGradients';

  // ─── Spectrum / hue refs (drag tracking) ───────────────────────────────
  spectrumEl = viewChild<ElementRef<HTMLElement>>('spectrumEl');
  hueEl = viewChild<ElementRef<HTMLElement>>('hueEl');
  angleEl = viewChild<ElementRef<HTMLElement>>('angleEl');
  headerEl = viewChild<ElementRef<HTMLElement>>('headerEl');
  stopsBarEl = viewChild<ElementRef<HTMLElement>>('stopsBarEl');

  /** Spectrum / hue / angle / panel / stop drag pointer id. -1 when idle. */
  private dragPointer = -1;
  /** Active drag kind — public so the template can reflect a "dragging"
   *  class on the panel root for grabbing-cursor feedback. */
  dragKind = signal<'spectrum' | 'hue' | 'angle' | 'panel' | 'stop' | null>(null);
  /** Which stop index is being dragged on the bar. -1 when no stop drag. */
  private stopDragIndex = -1;

  /** Active input format on the Color tab. Mirrors the segmented tabs
   *  in the reference picker — switching changes which inputs render
   *  below but the underlying colour is always stored as hex. */
  formatMode = signal<'hex' | 'rgb' | 'hsb'>('hex');

  /** Floating dropdown for the gradient-type selector. */
  linearMenuOpen = signal<boolean>(false);
  /** Active gradient family. Radial uses `radial-gradient(circle, …)` and
   *  ignores the angle dial (which is dimmed but kept in place so the
   *  layout doesn't reflow between types). */
  gradientType = signal<'linear' | 'radial'>('linear');
  readonly gradientTypeOptions: readonly { value: 'linear' | 'radial'; label: string }[] = [
    { value: 'linear', label: 'Linear' },
    { value: 'radial', label: 'Radial' },
  ];
  readonly linearMenuPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top',    overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  /** Cumulative panel translate offset — driven by the header drag. The
   *  template binds this to a CSS transform so the floating card moves
   *  with the cursor while keeping the CDK overlay anchored. */
  panelOffset = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Pointer-down anchor for the active panel drag. */
  private panelDragAnchor: { x: number; y: number; startX: number; startY: number } | null = null;

  /** True when the secondary HEX/RGB/HSB picker is open for a stop. */
  stopPickerOpenIndex = signal<number>(-1);

  // ─── Eyedropper support detection ──────────────────────────────────────
  readonly hasEyedropper = typeof (globalThis as { EyeDropper?: unknown }).EyeDropper === 'function';

  // ─── Derived display values ────────────────────────────────────────────
  spectrumStyle = computed(() => {
    const hue = this.hsv().h;
    const hueColor = rgbToHex(hslToRgb({ h: hue, s: 100, l: 50 }));
    return {
      hueColor,
      thumbX: this.hsv().s,
      thumbY: 100 - this.hsv().v,
      huePos: (hue / 360) * 100,
    };
  });

  gradientCss = computed(() => {
    const linear = gradientToCss(this.gradient());
    if (this.gradientType() === 'linear') return linear;
    // Reshape `linear-gradient(<dir>, …)` into `radial-gradient(circle, …)`.
    // We keep the stops list verbatim so radial picks up the same colour
    // ramp; direction has no meaning for a centred radial.
    const stopsList = linear.replace(/^linear-gradient\(\s*[^,]+,\s*/i, '').replace(/\)\s*$/, '');
    return `radial-gradient(circle, ${stopsList})`;
  });

  /** Endpoint stops (first + last after sorting) for the dual chips. */
  endpointStops = computed<{ start: GradientStop; end: GradientStop }>(() => {
    const sorted = [...this.gradient().stops].sort((a, b) => a.position - b.position);
    return {
      start: sorted[0] ?? { color: '#000000', position: 0 },
      end:   sorted[sorted.length - 1] ?? { color: '#000000', position: 100 },
    };
  });

  /** RGB triple derived from the working hex — keeps the inputs in lock-
   *  step with the spectrum without storing a parallel format-specific
   *  state. */
  rgbValues = computed<{ r: number; g: number; b: number }>(() => hexToRgb(this.color()));

  /** HSB == HSV; the picker labels it HSB to match the reference. */
  hsbValues = computed<{ h: number; s: number; b: number }>(() => {
    const v = this.hsv();
    return { h: Math.round(v.h), s: Math.round(v.s), b: Math.round(v.v) };
  });

  /** Effective rotation (deg) for the angle dial — maps the compass
   *  directions to their CSS equivalents so the indicator dot tracks the
   *  same axis the gradient flows along. */
  angleDeg = computed<number>(() => {
    const g = this.gradient();
    if (g.direction === 'angle') return g.angle ?? 90;
    switch (g.direction) {
      case 'to right':  return 90;
      case 'to left':   return 270;
      case 'to bottom': return 180;
      case 'to top':    return 0;
      default:          return 90;
    }
  });

  // ─── CVA plumbing ──────────────────────────────────────────────────────
  private _onChange: (v: string) => void = () => {};
  private _onTouched: () => void = () => {};

  writeValue(v: string | null | undefined): void {
    const raw = (v ?? '').trim();
    if (raw.startsWith('linear-gradient') || raw.startsWith('radial-gradient')) {
      // Radial parsing: re-shape into a linear-gradient form so the
      // existing parser can extract stops, then flip the type back.
      const isRadial = raw.startsWith('radial-gradient');
      const linearForm = isRadial
        ? raw.replace(/^radial-gradient\(\s*[^,]+,\s*/i, 'linear-gradient(to right, ')
        : raw;
      const parsed = parseGradient(linearForm);
      if (parsed) {
        this.gradient.set(parsed);
        this.gradientType.set(isRadial ? 'radial' : 'linear');
        this.mode.set('gradient');
      }
    } else if (/^#?[0-9a-f]{3,6}$/i.test(raw)) {
      const hex = normaliseHex(raw);
      this.color.set(hex);
      this.hsv.set(rgbToHsv(hexToRgb(hex)));
    } else {
      // Empty / unrecognised — sit in the explicit "no colour" state.
      this.color.set('');
      this.hsv.set({ h: 0, s: 0, v: 0 });
    }
    // Honour caller-requested starting tab on the first writeValue.
    if (!this._modeInitialised) {
      this.mode.set(this.initialMode());
      this._modeInitialised = true;
    }
    this.cdr.markForCheck();
  }
  private _modeInitialised = false;
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void { this._onTouched = fn; }
  setDisabledState(d: boolean): void { this.cvaDisabled.set(d); this.cdr.markForCheck(); }

  /** Push the current model out via CVA — call after any state change
   *  that should be observable to a parent `[(ngModel)]`. */
  private emit(): void {
    const v = this.mode() === 'color' ? this.color() : this.gradientCss();
    this._onChange(v);
  }

  // ─── Tab switching ─────────────────────────────────────────────────────
  setMode(m: PanelMode): void {
    if (this.mode() === m) return;
    // Colour-only consumers can't ever sit on the Gradient tab — guard
    // against a stale gradient initialMode bleeding through writeValue.
    if (this.colorOnly() && m !== 'color') return;
    this.mode.set(m);
    this.modeChange.emit(m);
    this.emit();
  }

  close(): void { this.closed.emit(); }

  // ─── Color tab actions ─────────────────────────────────────────────────
  /** Commit a hex into the model + sync HSV cache. An empty / invalid
   *  hex collapses to the "no colour" state. */
  private commitColor(hex: string): void {
    if (!hex) {
      this.clearColor();
      return;
    }
    const h = normaliseHex(hex);
    this.color.set(h);
    this.hsv.set(rgbToHsv(hexToRgb(h)));
    this.emit();
  }

  onHexInput(raw: string): void {
    let v = raw.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#[0-9a-f]{6}$/i.test(v)) this.commitColor(v);
  }

  /** RGB channel input → commit a new hex. Out-of-range values clamp
   *  to the 0..255 box, so a stray paste of "999" turns into 255 rather
   *  than rejecting the edit outright. */
  onRgbChannel(channel: 'r' | 'g' | 'b', raw: number | string): void {
    const n = clamp(parseInt(String(raw), 10) || 0, 0, 255);
    const cur = this.rgbValues();
    const next = { ...cur, [channel]: n };
    this.commitColor(rgbToHex(next));
  }

  /** HSB channel input → mirror of RGB above, but H is mod 360 and the
   *  S/B channels are 0..100. */
  onHsbChannel(channel: 'h' | 's' | 'b', raw: number | string): void {
    const n = parseInt(String(raw), 10) || 0;
    const cur = this.hsv();
    let next = { ...cur };
    if (channel === 'h') next.h = ((n % 360) + 360) % 360;
    else if (channel === 's') next.s = clamp(n, 0, 100);
    else next.v = clamp(n, 0, 100);
    this.hsv.set(next);
    this.commitColor(rgbToHex(hsvToRgb(next)));
  }

  setFormatMode(m: 'hex' | 'rgb' | 'hsb'): void { this.formatMode.set(m); }

  /** Switch gradient family and close the popup. `emit()` so the parent
   *  receives the new CSS string immediately. */
  pickGradientType(t: 'linear' | 'radial'): void {
    this.gradientType.set(t);
    this.linearMenuOpen.set(false);
    this.emit();
  }

  /** Begin dragging a stop along the gradient bar. */
  startStopDrag(i: number, ev: PointerEvent): void {
    if (this.isDisabled()) return;
    ev.stopPropagation();
    const el = this.stopsBarEl()?.nativeElement;
    if (!el) return;
    el.setPointerCapture(ev.pointerId);
    this.dragPointer = ev.pointerId;
    this.dragKind.set('stop');
    this.stopDragIndex = i;
    this.selectedStopIndex.set(i);
    this.applyStopDrag(ev);
  }
  private applyStopDrag(ev: PointerEvent): void {
    const el = this.stopsBarEl()?.nativeElement;
    if (!el || this.stopDragIndex < 0) return;
    const r = el.getBoundingClientRect();
    const pct = clamp(((ev.clientX - r.left) / r.width) * 100, 0, 100);
    this.setStopPosition(this.stopDragIndex, pct);
  }

  /** Click the gradient bar (not on a thumb) to add a new stop at that
   *  position, with a colour interpolated from the neighbours so it
   *  visually blends in rather than appearing as a hard step. */
  onStopsBarClick(ev: PointerEvent): void {
    if ((ev.target as HTMLElement).closest('.cp__stops-bar-thumb')) return;
    const el = this.stopsBarEl()?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = clamp(((ev.clientX - r.left) / r.width) * 100, 0, 100);
    this.gradient.update((g) => {
      const sorted = [...g.stops].sort((a, b) => a.position - b.position);
      const before = [...sorted].reverse().find((s) => s.position <= pct) ?? sorted[0];
      return { ...g, stops: [...g.stops, { color: before.color, position: Math.round(pct) }] };
    });
    this.emit();
  }

  pickSavedColor(hex: string): void { this.commitColor(hex); }

  addCurrentToSaved(): void {
    const c = this.color();
    if (!c) return;
    if (this.savedColors().includes(c)) return;
    const next = [...this.savedColors(), c];
    this.savedColors.set(next);
    this.persistSaved(ColorsPanelComponent.LS_COLORS, next);
  }

  /** Clear the current colour back to the "no colour" state — the
   *  input's placeholder shows, the preview swatch becomes the
   *  red-slash placeholder, and the emit hands an empty string back to
   *  the parent (so it can decide what "no colour" should mean for its
   *  own data — usually `transparent` or removing the property). */
  clearColor(): void {
    this.color.set('');
    this.hsv.set({ h: 0, s: 0, v: 0 });
    this.emit();
  }

  removeSavedColor(hex: string): void {
    const next = this.savedColors().filter((c) => c !== hex);
    this.savedColors.set(next);
    this.persistSaved(ColorsPanelComponent.LS_COLORS, next);
  }

  removeSavedGradient(css: string): void {
    const next = this.savedGradients().filter((g) => g !== css);
    this.savedGradients.set(next);
    this.persistSaved(ColorsPanelComponent.LS_GRADIENTS, next);
  }

  /** Commit the hex input on blur — normalises 3-char shorthand like
   *  `#FF0` to `#FFFF00` so the user doesn't have to type a full 6
   *  digits to apply their edit. Falls back to the last committed colour
   *  if the input is unrecognisable. */
  onHexBlur(raw: string): void {
    const v = raw.trim();
    const m3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
    if (m3) {
      const [, r, g, b] = m3;
      this.commitColor('#' + r + r + g + g + b + b);
      return;
    }
    const m6 = /^#?([0-9a-f]{6})$/i.exec(v);
    if (m6) {
      this.commitColor('#' + m6[1]);
      return;
    }
    // Force the input to reset to the current colour — markForCheck
    // re-renders the ngModel with the canonical hex.
    this.cdr.markForCheck();
  }

  async useEyedropper(): Promise<void> {
    type EyeDropperResult = { sRGBHex: string };
    type EyeDropperApi = { new (): { open(): Promise<EyeDropperResult> } };
    const Ctor = (globalThis as { EyeDropper?: EyeDropperApi }).EyeDropper;
    if (!Ctor) return;
    try {
      const res = await new Ctor().open();
      this.commitColor(res.sRGBHex);
      this.cdr.markForCheck();
    } catch {
      /* user cancelled */
    }
  }

  resetToDefault(): void {
    if (this.mode() === 'color') {
      this.commitColor('#000000');
    } else {
      this.gradient.set(structuredClone(DEFAULT_GRADIENT));
      this.gradientType.set('linear');
      this.selectedStopIndex.set(0);
      this.emit();
    }
  }

  /** Esc closes the panel. Bound on the host so it fires regardless of
   *  which inner control currently holds focus. Don't act when no
   *  modifier-free key produced the event (e.g. user is in IME). */
  @HostListener('document:keydown.escape')
  onEscape(): void { if (!this.isDisabled()) this.close(); }

  // ─── Spectrum / hue drag ───────────────────────────────────────────────
  startSpectrumDrag(ev: PointerEvent): void {
    if (this.isDisabled()) return;
    const el = this.spectrumEl()?.nativeElement;
    if (!el) return;
    el.setPointerCapture(ev.pointerId);
    this.dragPointer = ev.pointerId;
    this.dragKind.set('spectrum');
    this.applySpectrum(ev);
  }
  startHueDrag(ev: PointerEvent): void {
    if (this.isDisabled()) return;
    const el = this.hueEl()?.nativeElement;
    if (!el) return;
    el.setPointerCapture(ev.pointerId);
    this.dragPointer = ev.pointerId;
    this.dragKind.set('hue');
    this.applyHue(ev);
  }
  startAngleDrag(ev: PointerEvent): void {
    if (this.isDisabled()) return;
    const el = this.angleEl()?.nativeElement;
    if (!el) return;
    el.setPointerCapture(ev.pointerId);
    this.dragPointer = ev.pointerId;
    this.dragKind.set('angle');
    this.applyAngle(ev);
  }

  /** Begin dragging the whole panel from a pointer-down on the header.
   *  We avoid CDK's DragDrop here because the panel lives inside a
   *  cdkConnectedOverlay — translating the inner card with a transform
   *  is simpler than juggling overlay positions and gives the same UX. */
  startPanelDrag(ev: PointerEvent): void {
    if (this.isDisabled()) return;
    // Don't initiate when the user clicked an interactive child (close button).
    const tgt = ev.target as HTMLElement;
    if (tgt.closest('.cp__close')) return;
    const el = this.headerEl()?.nativeElement;
    if (!el) return;
    el.setPointerCapture(ev.pointerId);
    this.dragPointer = ev.pointerId;
    this.dragKind.set('panel');
    const { x, y } = this.panelOffset();
    this.panelDragAnchor = { x: ev.clientX, y: ev.clientY, startX: x, startY: y };
    ev.preventDefault();
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(ev: PointerEvent): void {
    if (this.dragPointer !== ev.pointerId) return;
    const k = this.dragKind();
    if (k === 'spectrum') this.applySpectrum(ev);
    else if (k === 'hue') this.applyHue(ev);
    else if (k === 'angle') this.applyAngle(ev);
    else if (k === 'stop') this.applyStopDrag(ev);
    else if (k === 'panel' && this.panelDragAnchor) {
      const a = this.panelDragAnchor;
      this.panelOffset.set({ x: a.startX + (ev.clientX - a.x), y: a.startY + (ev.clientY - a.y) });
    }
  }
  @HostListener('pointerup', ['$event'])
  @HostListener('pointercancel', ['$event'])
  onPointerUp(ev: PointerEvent): void {
    if (this.dragPointer !== ev.pointerId) return;
    this.dragPointer = -1;
    this.dragKind.set(null);
    this.panelDragAnchor = null;
    this.stopDragIndex = -1;
  }

  private applySpectrum(ev: PointerEvent): void {
    const el = this.spectrumEl()?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = clamp(((ev.clientX - r.left) / r.width) * 100, 0, 100);
    const y = clamp(((ev.clientY - r.top) / r.height) * 100, 0, 100);
    const next = { h: this.hsv().h, s: x, v: 100 - y };
    this.hsv.set(next);
    this.commitColor(rgbToHex(hsvToRgb(next)));
  }
  private applyHue(ev: PointerEvent): void {
    const el = this.hueEl()?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = clamp(((ev.clientX - r.left) / r.width) * 100, 0, 100);
    const next = { h: (pct / 100) * 360, s: this.hsv().s, v: this.hsv().v };
    this.hsv.set(next);
    this.commitColor(rgbToHex(hsvToRgb(next)));
  }
  private applyAngle(ev: PointerEvent): void {
    const el = this.angleEl()?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // 0deg = up; CSS gradient angle convention.
    const rad = Math.atan2(ev.clientX - cx, cy - ev.clientY);
    let deg = (rad * 180) / Math.PI;
    if (deg < 0) deg += 360;
    deg = Math.round(deg);
    this.gradient.update((g) => ({ ...g, direction: 'angle', angle: deg }));
    this.emit();
  }

  // ─── Gradient tab actions ──────────────────────────────────────────────
  reverseStops(): void {
    this.gradient.update((g) => {
      const stops = [...g.stops]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ ...s, position: 100 - s.position }))
        .sort((a, b) => a.position - b.position);
      return { ...g, stops };
    });
    this.emit();
  }

  selectStop(i: number): void { this.selectedStopIndex.set(i); }

  setStopColor(i: number, hex: string): void {
    const h = normaliseHex(hex);
    this.gradient.update((g) => {
      const stops = g.stops.map((s, idx) => (idx === i ? { ...s, color: h } : s));
      return { ...g, stops };
    });
    this.emit();
  }

  setStopPosition(i: number, pos: number): void {
    const p = clamp(Math.round(pos), 0, 100);
    this.gradient.update((g) => {
      const stops = g.stops.map((s, idx) => (idx === i ? { ...s, position: p } : s));
      return { ...g, stops };
    });
    this.emit();
  }

  addStop(): void {
    this.gradient.update((g) => {
      const sorted = [...g.stops].sort((a, b) => a.position - b.position);
      const last = sorted[sorted.length - 1];
      const newPos = clamp((last?.position ?? 0) + 10, 0, 100);
      const newColor = last?.color ?? '#000000';
      return { ...g, stops: [...g.stops, { color: newColor, position: newPos }] };
    });
    this.emit();
  }

  removeStop(i: number): void {
    if (this.gradient().stops.length <= 2) return;
    this.gradient.update((g) => ({ ...g, stops: g.stops.filter((_, idx) => idx !== i) }));
    this.selectedStopIndex.update((cur) => Math.min(cur, this.gradient().stops.length - 1));
    this.emit();
  }

  saveGradient(): void {
    const css = this.gradientCss();
    if (!css) return;
    if (this.savedGradients().includes(css)) return;
    const next = [...this.savedGradients(), css];
    this.savedGradients.set(next);
    this.persistSaved(ColorsPanelComponent.LS_GRADIENTS, next);
  }

  applySavedGradient(css: string): void {
    const parsed = parseGradient(css);
    if (!parsed) return;
    this.gradient.set(parsed);
    this.selectedStopIndex.set(0);
    this.emit();
  }

  /** Opacity slider per stop maps to position-fraction colour translucency
   *  via `rgba()` — kept simple: 0..100 → alpha-suffix on the hex. We
   *  store the alpha in the colour string itself so the CSS stays
   *  self-contained. */
  setStopAlpha(i: number, pct: number): void {
    const p = clamp(Math.round(pct), 0, 100);
    this.gradient.update((g) => {
      const stops = g.stops.map((s, idx) => {
        if (idx !== i) return s;
        const baseHex = s.color.length >= 7 ? s.color.slice(0, 7) : s.color;
        const a = Math.round((p / 100) * 255).toString(16).padStart(2, '0').toUpperCase();
        return { ...s, color: p === 100 ? baseHex : baseHex + a };
      });
      return { ...g, stops };
    });
    this.emit();
  }

  stopAlphaPct(i: number): number {
    const s = this.gradient().stops[i];
    if (!s) return 100;
    if (s.color.length === 9) {
      const a = parseInt(s.color.slice(7, 9), 16);
      return Math.round((a / 255) * 100);
    }
    return 100;
  }

  /** Base 6-char hex (alpha stripped) for the swatch + secondary picker. */
  stopBaseHex(i: number): string {
    const s = this.gradient().stops[i];
    if (!s) return '#000000';
    return s.color.length >= 7 ? s.color.slice(0, 7) : s.color;
  }

  /** Used by template @for to track stops across reorder. */
  trackByIndex(i: number): number { return i; }
}
