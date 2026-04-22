import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * QtyInputComponent
 * ─────────────────
 * Reusable numeric stepper for quantity / counter-style fields —
 * `[ − ]  0  [ + ]` with a directly editable number in the middle.
 *
 * Binding:
 *   • `formControlName` / `[formControl]` / `[(ngModel)]` via `ControlValueAccessor`.
 *
 * Inputs:
 *   • `[min]`, `[max]`   — clamp range. `min` defaults to 0 (quantity-style),
 *                         `max` to `Infinity`. Override `min` for signed fields.
 *   • `[step]`           — increment step for the − / + buttons (default 1).
 *   • `[size]`           — `'sm' | 'md'` (default `'md'`).
 *   • `[disabled]`       — disables both buttons and the input.
 *   • `[allowDecimal]`   — if true, the input accepts decimals (default false).
 *   • `[decimalPlaces]`  — when set, the displayed value is padded to this many
 *                         decimal places (e.g. `2` → `3` → `'3.00'`). Purely
 *                         cosmetic — the emitted model value stays numeric.
 *
 * Outputs:
 *   • `(valueChange)`    — emits the committed numeric value. Mirrors the
 *                         old `<count-plus-minus>` `(modelChanged)` output so
 *                         templates that don't use a FormControl can still
 *                         react (`(valueChange)="onQtyChanged($event)"`).
 *
 * Example:
 *   <app-qty-input formControlName="minimumOrder" [min]="0"/>
 */
@Component({
  selector: 'app-qty-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="qi"
      [class.qi--sm]="size() === 'sm'"
      [class.qi--disabled]="disabled()"
    >
      <button
        type="button"
        class="qi__btn qi__btn--minus"
        aria-label="Decrease"
        [disabled]="disabled() || atMin()"
        (click)="step_(-1)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <input
        #field
        type="text"
        inputmode="decimal"
        class="qi__field"
        [value]="display()"
        [disabled]="disabled()"
        (input)="onInput($any($event.target).value)"
        (blur)="onBlur()"
        (keydown.arrowup)="$event.preventDefault(); step_(+1)"
        (keydown.arrowdown)="$event.preventDefault(); step_(-1)"
      />

      <button
        type="button"
        class="qi__btn qi__btn--plus"
        aria-label="Increase"
        [disabled]="disabled() || atMax()"
        (click)="step_(+1)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      // Never collapse below this — buttons (34+34) + a readable number (~40).
      min-width: 108px;
    }

    .qi {
      display: flex;
      width: 100%;
      height: 36px;
      align-items: stretch;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
      overflow: hidden;
      transition: border-color 150ms ease, box-shadow 150ms ease;
      box-sizing: border-box;

      &:focus-within {
        border-color: #32acc1;
        box-shadow: 0 0 0 3px rgba(50, 172, 193, 0.12);
      }

      &--disabled {
        background: #f8fafc;
        color: #94a3b8;
      }
    }

    .qi__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      min-width: 34px;   // hold against flex shrink in tight cells
      background: transparent;
      border: 0;
      color: #475569;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
      flex-shrink: 0;

      &:hover:not(:disabled) {
        background: #f1f5f9;
        color: #0f172a;
      }

      &:disabled {
        color: #cbd5e1;
        cursor: not-allowed;
      }

      &--minus { border-inline-end: 1px solid #e2e8f0; }
      &--plus  { border-inline-start: 1px solid #e2e8f0; }
    }

    .qi__field {
      flex: 1 1 auto;
      min-width: 0;       // let the text clip inside a tight cell, not overflow the row
      width: 100%;
      padding: 0 6px;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      font-size: 14px;
      color: #0f172a;
      text-align: center;
      font-variant-numeric: tabular-nums;

      // Hide the native number spinners for browsers that render them even
      // on type="text" (rare, but keeps behaviour consistent).
      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      &:disabled {
        color: #64748b;
        cursor: not-allowed;
      }
    }

    // Compact variant — useful inside tight table cells.
    .qi--sm {
      height: 30px;
      .qi__btn  { width: 28px; min-width: 28px; }
      .qi__field { font-size: 13px; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => QtyInputComponent),
      multi: true,
    },
  ],
})
export class QtyInputComponent implements ControlValueAccessor {
  // ── Inputs ────────────────────────────────────────────────────────────────
  readonly min           = input<number>(0);
  readonly max           = input<number>(Number.POSITIVE_INFINITY);
  readonly step          = input<number>(1);
  readonly size          = input<'sm' | 'md'>('md');
  readonly allowDecimal  = input<boolean>(false);
  /** Pad the displayed value to this many decimal places (e.g. 2 → "3.00"). */
  readonly decimalPlaces = input<number | null>(null);

  // Set via the FormControl (writeValue / setDisabledState). Exposed as a
  // signal so the template reflects disabled state without extra plumbing.
  readonly disabled = signal<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────
  /** Emits the numeric value on every committed change (step, type, blur). */
  readonly valueChange = output<number>();

  // ── Internal state ────────────────────────────────────────────────────────
  /** Current numeric value. null when the user cleared the field mid-edit. */
  private value = signal<number | null>(0);

  /** What the <input> shows. Mirrors `value` except during typing. */
  display = signal<string>('0');

  readonly fieldRef = viewChild<ElementRef<HTMLInputElement>>('field');

  // ── Derived edge-state (drives button disabled / aria) ────────────────────
  atMin = () => (this.value() ?? 0) <= this.min();
  atMax = () => (this.value() ?? 0) >= this.max();

  // ── ControlValueAccessor plumbing ─────────────────────────────────────────
  private onChange:  (v: number) => void = () => {};
  private onTouched: () => void          = () => {};

  writeValue(v: number | null): void {
    const clamped = this.clamp(Number(v ?? 0));
    this.value.set(clamped);
    this.display.set(this.format(clamped));
  }
  registerOnChange(fn: (v: number) => void): void  { this.onChange  = fn; }
  registerOnTouched(fn: () => void): void          { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void      { this.disabled.set(isDisabled); }

  // ── Interaction ───────────────────────────────────────────────────────────
  /** `direction` is +1 / −1 — callers multiply by `step()` internally. */
  step_(direction: 1 | -1): void {
    if (this.disabled()) return;
    const current = this.value() ?? 0;
    const next = this.clamp(current + direction * this.step());
    this.value.set(next);
    this.display.set(this.format(next));
    this.onChange(next);
    this.valueChange.emit(next);
  }

  onInput(raw: string): void {
    // Allow the user to clear the field briefly (prevents re-snapping to 0
    // every keystroke). `onBlur` normalises and commits.
    this.display.set(raw);

    const parsed = this.parse(raw);
    if (parsed === null) {
      this.value.set(null);
      return;
    }
    const clamped = this.clamp(parsed);
    this.value.set(clamped);
    this.onChange(clamped);
    this.valueChange.emit(clamped);
  }

  onBlur(): void {
    const current = this.value();
    // Empty / invalid input snaps back to the clamped min so the model is
    // always a finite number for consumers.
    if (current === null || Number.isNaN(current)) {
      const fallback = this.clamp(0);
      this.value.set(fallback);
      this.display.set(this.format(fallback));
      this.onChange(fallback);
      this.valueChange.emit(fallback);
    } else {
      // Normalise the display (e.g. strip trailing "." on decimal input,
      // pad to `decimalPlaces` for cosmetic consistency).
      this.display.set(this.format(current));
    }
    this.onTouched();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private clamp(n: number): number {
    if (!Number.isFinite(n)) return this.min();
    return Math.min(Math.max(n, this.min()), this.max());
  }

  private parse(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-') return null;
    const n = this.allowDecimal() ? parseFloat(trimmed) : parseInt(trimmed, 10);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Renders the numeric value for display. When `decimalPlaces` is set we
   * pad with `toFixed(n)` so e.g. `3` shows as `"3.00"`; otherwise we just
   * stringify — the emitted model value is always the raw number regardless.
   */
  private format(n: number): string {
    const dp = this.decimalPlaces();
    return dp != null && dp >= 0 ? n.toFixed(dp) : String(n);
  }
}
