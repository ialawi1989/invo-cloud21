import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { RangeSliderValue, SliderLabelFormatter } from './range-slider.types';

/**
 * RangeSliderComponent
 * ────────────────────
 * A dual-thumb (or single-thumb) slider for selecting a numeric range.
 *
 * Two modes:
 *   • `range` (default) — two thumbs, value is `RangeSliderValue { min, max }`.
 *   • `[range]="false"` — single thumb, value is `number`.
 *
 * Binding:
 *   • `[(value)]` for two-way signal binding.
 *   • `[formControl]` / `[(ngModel)]` via `ControlValueAccessor`.
 *
 * Features:
 *   • Custom `[formatLabel]` for display (e.g. "10 KB", "$50").
 *   • Labels shown above thumbs while dragging (or always via `[showLabels]`).
 *   • `[step]` snapping.
 *   • Keyboard: ← → to move the focused thumb by `step`.
 *   • Brand-colored filled track between the thumbs.
 *   • RTL-aware.
 */
@Component({
  selector: 'app-range-slider',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './range-slider.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RangeSliderComponent),
      multi: true,
    },
  ],
})
export class RangeSliderComponent implements OnDestroy, ControlValueAccessor {
  private cdr = inject(ChangeDetectorRef);

  // ── Inputs ─────────────────────────────────────────────────────────────────
  /** Two-way bound value. `RangeSliderValue` for range, `number` for single. */
  value = model<RangeSliderValue | number | null>(null);

  /** Enable dual-thumb range mode. Default `true`. */
  range = input<boolean>(true);

  /** Absolute minimum (left edge). */
  floor = input<number>(0);

  /** Absolute maximum (right edge). */
  ceiling = input<number>(100);

  /** Snap increment. */
  step = input<number>(1);

  /** Format a number into the displayed label. Default: locale string. */
  formatLabel = input<SliderLabelFormatter>((v) => v.toLocaleString());

  /** Show value labels. Default `true`. */
  showLabels = input<boolean>(true);

  /**
   * Where to render value labels relative to the track.
   *   • `'top'`    — above the track (stacked layout)
   *   • `'bottom'` — below the track (stacked layout)
   *   • `'inline'` — left/right of the track (single-row layout)
   *   • `'tooltip'` — floating tooltip above thumb, only while dragging
   */
  labelPosition = input<'top' | 'bottom' | 'inline' | 'tooltip'>('bottom');

  /** Show the floor / ceiling boundary labels. Default `true`. */
  showBounds = input<boolean>(true);

  /** Disable interaction. */
  disabled = input<boolean>(false);

  /** Unit suffix shown after the value labels (e.g. "KB", "%"). */
  unit = input<string>('');

  // ── View children ──────────────────────────────────────────────────────────
  trackEl = viewChild<ElementRef<HTMLDivElement>>('track');

  // ── Internal state ─────────────────────────────────────────────────────────
  /** Which thumb is currently being dragged. */
  activeThumb = signal<'min' | 'max' | null>(null);

  /** Internal min/max always stored separately for easier math. */
  _min = signal<number>(0);
  _max = signal<number>(100);

  // ── CVA state ──────────────────────────────────────────────────────────────
  _onChange: (v: RangeSliderValue | number | null) => void = () => {};
  _onTouched: () => void = () => {};
  private _cvaDisabled = signal(false);
  isDisabled = computed(() => this.disabled() || this._cvaDisabled());

  // ── Derived layout values (0–100 percentages for CSS) ──────────────────────
  pctMin = computed(() => this.toPercent(this._min()));
  pctMax = computed(() => this.toPercent(this._max()));

  /** Display labels. */
  minLabel = computed(() => {
    const fmt = this.formatLabel();
    const u = this.unit();
    return fmt(this._min()) + (u ? ' ' + u : '');
  });

  maxLabel = computed(() => {
    const fmt = this.formatLabel();
    const u = this.unit();
    return fmt(this._max()) + (u ? ' ' + u : '');
  });

  singleLabel = computed(() => this.minLabel());

  /** Floor / ceiling formatted labels. */
  floorLabel = computed(() => {
    const fmt = this.formatLabel();
    const u = this.unit();
    return fmt(this.floor()) + (u ? ' ' + u : '');
  });

  ceilingLabel = computed(() => {
    const fmt = this.formatLabel();
    const u = this.unit();
    return fmt(this.ceiling()) + (u ? ' ' + u : '');
  });

  // ── Sync external value → internal min/max ─────────────────────────────────
  constructor() {
    effect(() => {
      const v = this.value();
      if (v == null) {
        this._min.set(this.floor());
        this._max.set(this.ceiling());
        return;
      }
      if (typeof v === 'number') {
        this._min.set(this.clamp(v));
      } else {
        this._min.set(this.clamp(v.min));
        this._max.set(this.clamp(v.max));
      }
    });
  }

  // ── Pointer events (drag) ──────────────────────────────────────────────────
  onTrackPointerDown(event: PointerEvent): void {
    if (this.isDisabled()) return;
    event.preventDefault();

    const pct = this.eventToPercent(event);
    const val = this.percentToValue(pct);

    if (!this.range()) {
      this.activeThumb.set('min');
      this._min.set(this.snap(val));
    } else {
      // Pick the closest thumb.
      const distMin = Math.abs(val - this._min());
      const distMax = Math.abs(val - this._max());
      if (distMin <= distMax) {
        this.activeThumb.set('min');
        this._min.set(this.snap(Math.min(val, this._max())));
      } else {
        this.activeThumb.set('max');
        this._max.set(this.snap(Math.max(val, this._min())));
      }
    }

    this.emitValue();

    // Capture pointer for drag.
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onTrackPointerMove(event: PointerEvent): void {
    if (!this.activeThumb() || this.isDisabled()) return;
    event.preventDefault();

    const pct = this.eventToPercent(event);
    const val = this.snap(this.percentToValue(pct));

    if (this.activeThumb() === 'min') {
      const bound = this.range() ? this._max() : this.ceiling();
      this._min.set(Math.max(this.floor(), Math.min(val, bound)));
    } else {
      this._max.set(Math.min(this.ceiling(), Math.max(val, this._min())));
    }

    this.emitValue();
  }

  onTrackPointerUp(): void {
    if (this.activeThumb()) {
      this.activeThumb.set(null);
      this._onTouched();
    }
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────
  onThumbKeydown(event: KeyboardEvent, thumb: 'min' | 'max'): void {
    if (this.isDisabled()) return;
    const s = this.step();
    let delta = 0;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') delta = s;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') delta = -s;
    else return;

    event.preventDefault();

    // RTL: invert horizontal arrow direction.
    const isRtl = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl';
    if (isRtl && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      delta = -delta;
    }

    if (thumb === 'min') {
      const bound = this.range() ? this._max() : this.ceiling();
      this._min.set(this.clamp(this._min() + delta, this.floor(), bound));
    } else {
      this._max.set(this.clamp(this._max() + delta, this._min(), this.ceiling()));
    }
    this.emitValue();
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  ngOnDestroy(): void {}

  // ── CVA ────────────────────────────────────────────────────────────────────
  writeValue(v: RangeSliderValue | number | null): void {
    this.value.set(v);
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (v: RangeSliderValue | number | null) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void { this._onTouched = fn; }
  setDisabledState(d: boolean): void { this._cvaDisabled.set(d); this.cdr.markForCheck(); }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private toPercent(value: number): number {
    const f = this.floor();
    const c = this.ceiling();
    if (c === f) return 0;
    return ((value - f) / (c - f)) * 100;
  }

  private percentToValue(pct: number): number {
    const f = this.floor();
    const c = this.ceiling();
    return f + (pct / 100) * (c - f);
  }

  private eventToPercent(event: PointerEvent): number {
    const track = this.trackEl()?.nativeElement;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const isRtl = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl';
    let pct: number;
    if (isRtl) {
      pct = ((rect.right - event.clientX) / rect.width) * 100;
    } else {
      pct = ((event.clientX - rect.left) / rect.width) * 100;
    }
    return Math.max(0, Math.min(100, pct));
  }

  private snap(value: number): number {
    const s = this.step();
    const f = this.floor();
    return Math.round((value - f) / s) * s + f;
  }

  private clamp(value: number, min?: number, max?: number): number {
    const lo = min ?? this.floor();
    const hi = max ?? this.ceiling();
    return Math.max(lo, Math.min(hi, value));
  }

  private emitValue(): void {
    let v: RangeSliderValue | number;
    if (this.range()) {
      v = { min: this._min(), max: this._max() };
    } else {
      v = this._min();
    }
    this.value.set(v);
    this._onChange(v);
  }
}
