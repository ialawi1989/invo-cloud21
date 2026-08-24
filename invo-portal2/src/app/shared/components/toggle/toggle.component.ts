import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  forwardRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Visual size of the toggle. `md` is the default; `sm` is for
 *  dense option lists, `lg` for hero/setting-page toggles. */
export type ToggleSize = 'sm' | 'md' | 'lg';

/**
 * Shareable toggle switch — iOS-style track + thumb with a tick
 * glyph when checked. Uses the brand cyan palette so all toggles
 * across the app look identical regardless of feature.
 *
 * Two ways to use it:
 *
 *   1. Standalone — bind `[checked]` + `(checkedChange)` for the
 *      raw switch (e.g. inside a row of icons).
 *      ```html
 *      <app-toggle [checked]="row.enabled" (checkedChange)="setEnabled($event)"/>
 *      ```
 *
 *   2. With a label / hint — pass `[label]` and optional `[hint]` to
 *      render the toggle alongside its own descriptive text in a
 *      single tappable row:
 *      ```html
 *      <app-toggle [(checked)]="opts.discountable" label="Discountable in POS"/>
 *      ```
 *
 * The `(checkedChange)` event is intentionally named to avoid
 * Angular's `[(value)] / (valueChange)` two-way sugar collision
 * with the standard DOM `change` event.
 */
@Component({
  selector: 'app-toggle',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      // Re-entrant Component reference — `forwardRef` is required so
      // the DI graph resolves the class after the decorator's
      // `providers` are read.
      useExisting: forwardRef(() => ToggleComponent),
      multi: true,
    },
  ],
  template: `
    <button
      type="button"
      class="t-row"
      [class.t-row--with-text]="!!label || !!hint"
      [class.t-row--disabled]="disabled"
      role="switch"
      [attr.aria-checked]="checked"
      [attr.aria-label]="ariaLabel || label || null"
      [attr.aria-disabled]="disabled ? true : null"
      [disabled]="disabled"
      (click)="onToggle($event)">
      <span class="t-switch" [class]="'t-switch--' + size">
        <span class="t-thumb">
          @if (checked) {
            <svg class="t-tick" width="10" height="10" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="3.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          }
        </span>
      </span>

      @if (label || hint) {
        <span class="t-text">
          @if (label) { <span class="t-label">{{ label }}</span> }
          @if (hint)  { <span class="t-hint">{{ hint }}</span> }
        </span>
      }
    </button>
  `,
  styleUrl: './toggle.component.scss',
})
export class ToggleComponent implements ControlValueAccessor {
  /** Current on/off state. */
  @Input({ transform: (v: boolean | string | null | undefined) => v === true || v === 'true' })
  checked = false;

  /** Disabled toggles render dimmed and don't fire `checkedChange`. */
  @Input({ transform: (v: boolean | string | null | undefined) => v === true || v === 'true' })
  disabled = false;

  /** Visual size variant. */
  @Input() size: ToggleSize = 'md';

  /** Optional inline label. Renders to the right of the switch. */
  @Input() label = '';

  /** Optional second-line description. Renders under `label`. */
  @Input() hint = '';

  /** Accessibility override — defaults to `label` when blank. */
  @Input() ariaLabel = '';

  /** Banana-binding companion to `[checked]`. */
  @Output() checkedChange = new EventEmitter<boolean>();

  // ─── ControlValueAccessor plumbing ────────────────────────────────
  // Lets the toggle bind to reactive forms via `formControlName` /
  // `formControl` / `[ngModel]` exactly like a native checkbox.
  private cdr = inject(ChangeDetectorRef);

  private onChangeFn:  (v: boolean) => void = () => {};
  private onTouchedFn: () => void = () => {};

  /**
   * `markForCheck` is not optional here, and its absence is invisible.
   *
   * This component is OnPush, so a value written by the FORM rather than by
   * a click in this view repaints nothing: the model says off and the switch
   * keeps showing on. A click marks only the view it happened in, so the
   * symptom appears exactly when one toggle changes another - which is how
   * it surfaced, as a second `Primary contact` that would not switch off.
   */
  writeValue(v: boolean): void {
    this.checked = !!v;
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (v: boolean) => void): void { this.onChangeFn = fn; }
  registerOnTouched(fn: () => void): void { this.onTouchedFn = fn; }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    // Same reason as writeValue: disabling through the form is not a click.
    this.cdr.markForCheck();
  }

  onToggle(ev: Event): void {
    ev.stopPropagation();
    if (this.disabled) return;
    const next = !this.checked;
    this.checked = next;
    this.checkedChange.emit(next);
    this.onChangeFn(next);
    this.onTouchedFn();
  }

  /** Keyboard parity with the native checkbox / switch role —
   *  space and enter both flip the toggle when it has focus. */
  @HostListener('keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (this.disabled) return;
    if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      const next = !this.checked;
      this.checked = next;
      this.checkedChange.emit(next);
      this.onChangeFn(next);
      this.onTouchedFn();
    }
  }
}
