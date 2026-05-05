import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import {
  buildRainbowGrid,
  clamp,
  contrastRatio,
  hexToRgb,
  hslToRgb,
  hsvToRgb,
  normaliseHex,
  rgbToCmyk,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  rgbToHwb,
  rgbToLab,
  rgbToLuv,
  rgbToXyz,
  wcagLevel,
  type WcagLevel,
} from './color-conversions';

/**
 * ColorPickerComponent
 * ────────────────────
 * Drop-in replacement for `<input type="color">`. Accepts and emits
 * a `#RRGGBB` hex string via `ControlValueAccessor`, so it works with
 * `formControlName`, `[(ngModel)]`, and `[formControl]`.
 *
 * Defaults to a compact popover (small preset grid + hex input). Three
 * opt-in flags expand it for richer use cases — every flag is
 * additive so existing call-sites keep their lean popover unchanged:
 *
 *   • `[showSpectrum]`        — HSV picker area + horizontal hue slider
 *   • `[showRainbowPresets]`  — full 11×10 rainbow swatch grid
 *   • `[showFormats]`         — HEX/RGB/HSL/CMYK/LAB/XYZ/LUV/HWB readouts
 *                               with copy-to-clipboard buttons
 *
 * The colour-conversion math lives in `color-conversions.ts` so the
 * component file stays focused on UI state + interaction.
 */
@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [CommonModule, OverlayModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './color-picker.component.html',
  styleUrl: './color-picker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ColorPickerComponent),
      multi: true,
    },
  ],
})
export class ColorPickerComponent implements ControlValueAccessor {
  private cdr = inject(ChangeDetectorRef);

  // ─── Inputs ────────────────────────────────────────────────────────────
  /** Show as `disabled`. */
  disabledInput = input<boolean>(false, { alias: 'disabled' });

  /** Apply error styling to the trigger. */
  invalid = input<boolean>(false);

  /** Trigger placeholder when nothing is selected. */
  placeholder = input<string>('Pick a color');

  /**
   * Override the preset palette. Defaults to a curated set of 16 colors
   * covering brand cyan, neutrals and a balanced rainbow — enough for
   * common entity defaults without an overwhelming wall of swatches.
   */
  presets = input<string[]>(DEFAULT_PRESETS);

  /** Render the HSV picker area + hue slider above the preset grid. */
  showSpectrum = input<boolean>(false);

  /** Replace the small preset grid with a denser 11×10 rainbow grid. */
  showRainbowPresets = input<boolean>(false);

  /** Render the multi-format readouts (HEX/RGB/HSL/CMYK/LAB/XYZ/LUV/HWB). */
  showFormats = input<boolean>(false);

  /** When set, the popover surfaces a WCAG 2.1 contrast badge that
   *  scores the picked colour against this background hex. Caller
   *  picks the comparison surface — usually the printed paper's
   *  white (`#ffffff`) for body text, or the selected element's
   *  own background for chip-on-chip checks.
   *  Picking a colour that fails AA still commits — the badge is a
   *  warning, not a block. */
  wcagAgainst = input<string>('');

  /**
   * Mutually-exclusive accordion: only ONE advanced section can be
   * open at a time. Holding a single id (rather than three booleans)
   * makes that invariant impossible to violate. `null` = all closed.
   */
  private openSection = signal<'spectrum' | 'palette' | 'formats' | null>(null);

  /**
   * Default-expand-when-alone: if only ONE advanced section is on, it
   * expands automatically — there's no value in collapsing a single
   * section. With 2+ enabled the user opts in via the header chevrons.
   */
  private aloneAutoExpand = computed(() => {
    const onCount = (this.showSpectrum() ? 1 : 0)
                  + (this.showRainbowPresets() ? 1 : 0)
                  + (this.showFormats() ? 1 : 0);
    return onCount === 1;
  });

  spectrumExpanded = computed<boolean>(() => this.openSection() === 'spectrum' || (this.aloneAutoExpand() && this.showSpectrum()));
  rainbowExpanded  = computed<boolean>(() => this.openSection() === 'palette'  || (this.aloneAutoExpand() && this.showRainbowPresets()));
  formatsExpanded  = computed<boolean>(() => this.openSection() === 'formats'  || (this.aloneAutoExpand() && this.showFormats()));

  /** Click a section header → open it (and auto-close the others), or
   *  click the already-open section → close it (no-op when alone). */
  toggleSpectrum(): void {
    if (this.aloneAutoExpand()) return;
    this.openSection.update((cur) => cur === 'spectrum' ? null : 'spectrum');
  }
  toggleRainbow():  void {
    if (this.aloneAutoExpand()) return;
    this.openSection.update((cur) => cur === 'palette'  ? null : 'palette');
  }
  toggleFormats():  void {
    if (this.aloneAutoExpand()) return;
    this.openSection.update((cur) => cur === 'formats'  ? null : 'formats');
  }

  // ─── State ─────────────────────────────────────────────────────────────
  /** Committed value (hex) — empty string when no color is set. */
  value = signal<string>('');

  /** Working value while the popover is open — committed on Done. */
  draft = signal<string>('');

  /** True while the popover is mounted. */
  isOpen = signal<boolean>(false);

  /** CVA-set disabled state. */
  cvaDisabled = signal<boolean>(false);

  isDisabled = computed(() => this.disabledInput() || this.cvaDisabled());

  /** True when the picker has a non-empty hex value. */
  hasValue = computed<boolean>(() => !!this.value());

  /** WCAG 2.1 contrast result for the current draft against the
   *  configured background (`[wcagAgainst]`). Returns `null` when
   *  no comparison surface was supplied or the draft isn't a valid
   *  hex yet — the template uses `null` as the "hide the badge"
   *  signal. */
  wcagResult = computed<{ ratio: number; level: WcagLevel } | null>(() => {
    const bg = normaliseHex(this.wcagAgainst());
    if (!/^#[0-9A-F]{6}$/.test(bg)) return null;
    const fg = normaliseHex(this.draft());
    if (!/^#[0-9A-F]{6}$/.test(fg)) return null;
    const ratio = contrastRatio(fg, bg);
    return { ratio, level: wcagLevel(ratio) };
  });

  /** Trigger element — used for focus management. */
  triggerEl = viewChild<ElementRef<HTMLElement>>('trigger');

  /** HSV spectrum + hue slider refs (only used when showSpectrum). */
  spectrumEl = viewChild<ElementRef<HTMLElement>>('spectrumEl');
  hueEl      = viewChild<ElementRef<HTMLElement>>('hueEl');

  /** Cached HSV of the current draft — kept as state so the spectrum
   *  thumb sits at the *picked* point (S/V) rather than re-derived from
   *  the hex on every render (which loses precision in achromatic /
   *  edge cases and causes the thumb to jump). */
  private hsv = signal<{ h: number; s: number; v: number }>({ h: 0, s: 0, v: 0 });

  // ─── Derived rainbow / format display values ───────────────────────────
  readonly rainbowGrid = buildRainbowGrid();

  /** Live RGB / HSL / etc. of the working draft for the format readouts. */
  formats = computed(() => {
    const hex = normaliseHex(this.draft());
    if (!/^#[0-9A-F]{6}$/.test(hex)) return null;
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb);
    const hsv = rgbToHsv(rgb);
    const cmyk = rgbToCmyk(rgb);
    const lab = rgbToLab(rgb);
    const xyz = rgbToXyz(rgb);
    const luv = rgbToLuv(rgb);
    const hwb = rgbToHwb(rgb);
    return {
      hex,
      rgb:  `${rgb.r}, ${rgb.g}, ${rgb.b}`,
      hsl:  `${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%`,
      hsv:  `${Math.round(hsv.h)}, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%`,
      cmyk: `${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`,
      lab:  `${lab.l}, ${lab.a}, ${lab.b}`,
      xyz:  `${xyz.x}, ${xyz.y}, ${xyz.z}`,
      luv:  `${luv.l}, ${luv.u}, ${luv.v}`,
      hwb:  `${hwb.h}, ${hwb.w}%, ${hwb.b}%`,
    };
  });

  /** Inline-style values driving the spectrum / hue slider. */
  spectrumStyle = computed(() => {
    const hue = this.hsv().h;
    const hueColor = rgbToHex(hslToRgb({ h: hue, s: 100, l: 50 }));
    return {
      hueColor,
      // Thumb position (px-relative-percent) for the S/V cursor.
      thumbX: this.hsv().s,
      thumbY: 100 - this.hsv().v,
      huePos: hue / 360 * 100,
    };
  });

  // ─── CVA plumbing ──────────────────────────────────────────────────────
  private _onChange: (v: string) => void = () => {};
  private _onTouched: () => void = () => {};

  writeValue(v: string | null | undefined): void {
    this.value.set(normaliseHex(v ?? ''));
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void { this._onTouched = fn; }
  setDisabledState(disabled: boolean): void {
    this.cvaDisabled.set(disabled);
    this.cdr.markForCheck();
  }

  // ─── Open / close ──────────────────────────────────────────────────────
  toggle(): void {
    if (this.isDisabled()) return;
    this.isOpen() ? this.cancel() : this.open();
  }

  open(): void {
    if (this.isDisabled() || this.isOpen()) return;
    // Snapshot the committed value into the working draft + sync HSV.
    const start = this.value() || '#32acc1';
    this.draft.set(start);
    this.hsv.set(rgbToHsv(hexToRgb(start)));
    this.isOpen.set(true);
  }

  /** Close without committing. */
  cancel(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this._onTouched();
  }

  /** Commit the working draft and close. */
  ok(): void {
    const next = normaliseHex(this.draft());
    if (next !== this.value()) {
      this.value.set(next);
      this._onChange(next);
    }
    this.isOpen.set(false);
    this._onTouched();
  }

  /** Wipe the value entirely (no color). */
  clear(): void {
    if (this.value()) {
      this.value.set('');
      this._onChange('');
    }
    this.draft.set('');
    this.isOpen.set(false);
    this._onTouched();
  }

  // ─── Picker actions ────────────────────────────────────────────────────
  pickPreset(hex: string): void {
    const h = normaliseHex(hex);
    this.draft.set(h);
    this.hsv.set(rgbToHsv(hexToRgb(h)));
  }

  /** Native color input → 7-char `#RRGGBB`. */
  onNativeInput(value: string): void {
    const h = normaliseHex(value);
    this.draft.set(h);
    this.hsv.set(rgbToHsv(hexToRgb(h)));
  }

  /** Hex text field → tolerate `RRGGBB` / `#RGB` / pasted strings. */
  onHexInput(value: string): void {
    const next = normaliseHexLoose(value);
    this.draft.set(next);
    if (/^#[0-9A-F]{6}$/.test(next)) this.hsv.set(rgbToHsv(hexToRgb(next)));
  }

  /** True when `hex` matches the current draft (case-insensitive). */
  isPicked(hex: string): boolean {
    return normaliseHex(hex).toUpperCase() === normaliseHex(this.draft()).toUpperCase();
  }

  // ─── Spectrum interaction (showSpectrum) ───────────────────────────────
  /** Pointer driver shared by spectrum + hue slider. The signature
   *  `(percentX, percentY) => void` makes both axes interchangeable. */
  private trackPointer(
    el: HTMLElement | undefined,
    ev: MouseEvent | TouchEvent,
    apply: (x: number, y: number) => void,
  ): void {
    if (!el) return;
    ev.preventDefault();
    const rect = el.getBoundingClientRect();
    const point = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
      // Both MouseEvent and Touch carry `clientX/clientY` but TS treats
      // them as disjoint — read the numeric coords through a structural
      // shape so we don't need an `as unknown as MouseEvent` cast.
      const src: { clientX: number; clientY: number } =
        (e as TouchEvent).touches?.[0] ?? (e as MouseEvent);
      return {
        x: clamp((src.clientX - rect.left) / rect.width  * 100, 0, 100),
        y: clamp((src.clientY - rect.top)  / rect.height * 100, 0, 100),
      };
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      const p = point(e);
      apply(p.x, p.y);
    };
    const stop = () => {
      window.removeEventListener('mousemove', onMove as any);
      window.removeEventListener('touchmove', onMove as any);
      window.removeEventListener('mouseup',   stop);
      window.removeEventListener('touchend',  stop);
    };
    window.addEventListener('mousemove', onMove as any);
    window.addEventListener('touchmove', onMove as any, { passive: false });
    window.addEventListener('mouseup',   stop);
    window.addEventListener('touchend',  stop);
    onMove(ev);
  }

  onSpectrumDown(ev: MouseEvent | TouchEvent): void {
    this.trackPointer(this.spectrumEl()?.nativeElement, ev, (sx, sy) => {
      const h = this.hsv().h;
      const next = { h, s: sx, v: 100 - sy };
      this.hsv.set(next);
      this.draft.set(rgbToHex(hsvToRgb(next)));
    });
  }

  onHueDown(ev: MouseEvent | TouchEvent): void {
    this.trackPointer(this.hueEl()?.nativeElement, ev, (px) => {
      const h = (px / 100) * 360;
      const next = { ...this.hsv(), h };
      this.hsv.set(next);
      this.draft.set(rgbToHex(hsvToRgb(next)));
    });
  }

  // ─── Format readouts ───────────────────────────────────────────────────
  /** Copy-to-clipboard fallback that works even outside secure contexts. */
  async copy(text: string): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch { /* fall through to legacy path */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────
  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      if ((event.key === 'Enter' || event.key === ' ') &&
          document.activeElement === this.triggerEl()?.nativeElement) {
        event.preventDefault();
        this.open();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
      this.triggerEl()?.nativeElement.focus();
    }
  }
}

// ─── Default palette ─────────────────────────────────────────────────────
// Curated 4×4 grid: brand cyan + neutrals + a balanced rainbow. Order
// is left-to-right, top-to-bottom: warm → cool → dark/light. Picked to
// be useful for category tags, branch labels, badge colors etc.
export const DEFAULT_PRESETS: string[] = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', // reds → yellows
  '#84CC16', '#22C55E', '#10B981', '#14B8A6', // greens
  '#06B6D4', '#32ACC1', '#3B82F6', '#6366F1', // cyans → blues (brand cyan in the middle)
  '#A855F7', '#EC4899', '#0F172A', '#94A3B8', // purples + neutrals
];

// ─── Free helpers ────────────────────────────────────────────────────────
/**
 * Looser version used on free-text input — lets the user type partial
 * values (`#3`, `#32a`, `32acc`, …) without snapping back. Only fully-
 * formed hex strings get normalised; everything else passes through so
 * the user can finish typing.
 */
function normaliseHexLoose(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(s)) return normaliseHex(s);
  if (/^#?[0-9a-fA-F]{3}$/.test(s)) return normaliseHex(s);
  return s.toUpperCase();
}
