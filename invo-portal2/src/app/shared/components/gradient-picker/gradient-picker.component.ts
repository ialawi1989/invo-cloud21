import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  computed,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ColorPickerComponent } from '../color-picker/color-picker.component';
import {
  DEFAULT_GRADIENT,
  GradientStop,
  GradientValue,
  gradientToCss,
  parseGradient,
} from './gradient-picker.types';

/**
 * GradientPickerComponent
 * ───────────────────────
 * Multi-stop linear-gradient editor. Implements ControlValueAccessor —
 * value can be either a CSS `linear-gradient(...)` string or a
 * `GradientValue` object; we always emit the CSS string so it drops
 * straight into a `[style.background]` binding.
 *
 * UI:
 *   • Live preview bar at the top.
 *   • Below the preview a *track* with one draggable thumb per stop —
 *     drag horizontally to change the stop's position; the inline
 *     thumb colour mirrors the stop colour.
 *   • Click anywhere on the track to add a new stop at that position
 *     (interpolated colour from the surrounding stops).
 *   • The currently-selected stop opens an `<app-color-picker>` with
 *     the advanced sections enabled (HSV / rainbow / formats).
 *   • Direction segmented control + remove-stop button next to the
 *     selected stop's color picker.
 *
 * Min stops: 2. Max stops: enforced loosely (the user can keep adding;
 * we cap at 10 to avoid pathological cases).
 */
@Component({
  selector: 'app-gradient-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColorPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gradient-picker.component.html',
  styleUrl: './gradient-picker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => GradientPickerComponent),
      multi: true,
    },
  ],
})
export class GradientPickerComponent implements ControlValueAccessor {
  private cdr = inject(ChangeDetectorRef);

  // ─── Inputs ────────────────────────────────────────────────────────────
  disabledInput = input<boolean>(false, { alias: 'disabled' });
  /** Hard cap on the number of stops the user can add. */
  maxStops      = input<number>(10);

  // ─── State ─────────────────────────────────────────────────────────────
  /** The picker model — always kept sorted by stop.position ascending. */
  value = signal<GradientValue>(structuredClone(DEFAULT_GRADIENT));

  /** Index of the stop whose colour-picker is currently shown. */
  selectedIndex = signal<number>(0);

  cvaDisabled = signal<boolean>(false);

  trackEl = viewChild<ElementRef<HTMLElement>>('trackEl');

  // ─── Derived ───────────────────────────────────────────────────────────
  cssValue = computed<string>(() => gradientToCss(this.value()));

  selectedStop = computed<GradientStop | null>(() => {
    const v = this.value();
    return v.stops[this.selectedIndex()] ?? null;
  });

  isDisabled = computed(() => this.disabledInput() || this.cvaDisabled());

  /** Compass options for the segmented control. `'angle'` is rendered
   *  as a separate input so it isn't crowded into the same row. */
  readonly directions: GradientValue['direction'][] = [
    'to right', 'to left', 'to bottom', 'to top', 'angle',
  ];

  // ─── CVA ───────────────────────────────────────────────────────────────
  private _onChange: (v: string) => void = () => {};
  private _onTouched: () => void = () => {};

  writeValue(v: string | GradientValue | null | undefined): void {
    let parsed: GradientValue | null = null;
    if (!v) {
      parsed = null;
    } else if (typeof v === 'string') {
      parsed = parseGradient(v);
    } else if (typeof v === 'object' && Array.isArray((v as any).stops)) {
      parsed = v as GradientValue;
    }
    this.value.set(parsed ? this.normalise(parsed) : structuredClone(DEFAULT_GRADIENT));
    this.selectedIndex.set(0);
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void { this._onTouched = fn; }
  setDisabledState(disabled: boolean): void {
    this.cvaDisabled.set(disabled);
    this.cdr.markForCheck();
  }

  // ─── Stop edits ────────────────────────────────────────────────────────
  selectStop(i: number): void {
    if (i < 0 || i >= this.value().stops.length) return;
    this.selectedIndex.set(i);
  }

  setStopColor(hex: string): void {
    const i = this.selectedIndex();
    if (i < 0 || i >= this.value().stops.length) return;
    this.value.update((v) => {
      const stops = [...v.stops];
      stops[i] = { ...stops[i], color: hex.toUpperCase() };
      return { ...v, stops };
    });
    this.emit();
  }

  setStopPosition(i: number, position: number): void {
    if (i < 0 || i >= this.value().stops.length) return;
    const next = clamp(Math.round(position), 0, 100);
    this.value.update((v) => {
      const stops = [...v.stops];
      stops[i] = { ...stops[i], position: next };
      return this.normalise({ ...v, stops });
    });
    // Re-locate the selected index since normalise may have re-sorted
    // the array.
    const sorted = this.value().stops;
    const newIdx = sorted.findIndex((s) => s.position === next);
    if (newIdx >= 0) this.selectedIndex.set(newIdx);
    this.emit();
  }

  /** Click on the track → add a new stop at that x%, with a colour
   *  interpolated from its left/right neighbours. */
  addStopAt(percent: number): void {
    const v = this.value();
    if (v.stops.length >= this.maxStops()) return;
    const pos = clamp(Math.round(percent), 0, 100);
    // Find the surrounding stops to interpolate the new colour.
    const sorted = [...v.stops].sort((a, b) => a.position - b.position);
    const left  = [...sorted].reverse().find((s) => s.position <= pos) ?? sorted[0];
    const right = sorted.find((s) => s.position >= pos) ?? sorted[sorted.length - 1];
    const t = right.position === left.position ? 0
      : (pos - left.position) / (right.position - left.position);
    const color = interpolateHex(left.color, right.color, t);
    const stops = this.normalise({ ...v, stops: [...v.stops, { color, position: pos }] }).stops;
    this.value.set({ ...v, stops });
    // Select the just-inserted stop so the colour picker focuses it.
    const newIdx = stops.findIndex((s) => s.position === pos && s.color === color);
    this.selectedIndex.set(newIdx >= 0 ? newIdx : 0);
    this.emit();
  }

  removeStop(i: number): void {
    const v = this.value();
    if (v.stops.length <= 2) return; // gradient needs 2+ stops
    const stops = v.stops.filter((_, idx) => idx !== i);
    this.value.set({ ...v, stops });
    this.selectedIndex.set(Math.min(this.selectedIndex(), stops.length - 1));
    this.emit();
  }

  setDirection(dir: GradientValue['direction']): void {
    this.value.update((v) => ({ ...v, direction: dir }));
    this.emit();
  }

  setAngle(angle: number): void {
    this.value.update((v) => ({ ...v, direction: 'angle', angle: clamp(Math.round(angle), 0, 360) }));
    this.emit();
  }

  // ─── Track pointer drag (move stops) ───────────────────────────────────
  onThumbDown(i: number, ev: MouseEvent | TouchEvent): void {
    if (this.isDisabled()) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.selectStop(i);
    this.trackPointer(ev, (px) => this.setStopPosition(i, px));
  }

  onTrackDown(ev: MouseEvent | TouchEvent): void {
    if (this.isDisabled()) return;
    // Only "click on empty track" — bail if the event came from a thumb.
    const target = ev.target as HTMLElement;
    if (target.closest('.gp-track__thumb')) return;
    const px = this.percentFromEvent(ev);
    this.addStopAt(px);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────
  /** Always-sorted copy of the value with stops in ascending position
   *  order. Keeps the picker's drag math (and the emitted CSS) sane. */
  private normalise(v: GradientValue): GradientValue {
    const stops = [...v.stops].sort((a, b) => a.position - b.position);
    return { ...v, stops };
  }

  private percentFromEvent(ev: MouseEvent | TouchEvent): number {
    const el = this.trackEl()?.nativeElement;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const src: { clientX: number } =
      (ev as TouchEvent).touches?.[0] ?? (ev as MouseEvent);
    return clamp(((src.clientX - rect.left) / rect.width) * 100, 0, 100);
  }

  private trackPointer(ev: MouseEvent | TouchEvent, apply: (percent: number) => void): void {
    const onMove = (e: MouseEvent | TouchEvent) => apply(this.percentFromEvent(e));
    const stop = () => {
      window.removeEventListener('mousemove', onMove as any);
      window.removeEventListener('touchmove', onMove as any);
      window.removeEventListener('mouseup',   stop);
      window.removeEventListener('touchend',  stop);
      this._onTouched();
    };
    window.addEventListener('mousemove', onMove as any);
    window.addEventListener('touchmove', onMove as any, { passive: false });
    window.addEventListener('mouseup',   stop);
    window.addEventListener('touchend',  stop);
    onMove(ev);
  }

  private emit(): void {
    this._onChange(gradientToCss(this.value()));
  }

  trackStop = (_: number, _s: GradientStop) => _;
}

// ── Free helpers ─────────────────────────────────────────────────────────
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Linear-interpolate two `#RRGGBB` colours by `t ∈ [0, 1]`. */
function interpolateHex(a: string, b: string, t: number): string {
  const ra = parseInt(a.slice(1), 16) || 0;
  const rb = parseInt(b.slice(1), 16) || 0;
  const aR = (ra >> 16) & 255, aG = (ra >> 8) & 255, aB = ra & 255;
  const bR = (rb >> 16) & 255, bG = (rb >> 8) & 255, bB = rb & 255;
  const r = Math.round(aR + (bR - aR) * t);
  const g = Math.round(aG + (bG - aG) * t);
  const u = Math.round(aB + (bB - aB) * t);
  const c = (n: number) => clamp(n, 0, 255).toString(16).padStart(2, '0');
  return ('#' + c(r) + c(g) + c(u)).toUpperCase();
}
