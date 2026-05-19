import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { TranslateModule } from '@ngx-translate/core';

import { BindingDef, BindingGroup } from '../../services/bindings.catalog';

/**
 * BindableInputComponent
 * ──────────────────────
 * A native textarea + a "{ }" trigger that opens a categorised
 * picker — drop-in replacement for the chip-list token UX. Mirrors
 * the receipt-builder `BindableInputComponent` so the feel is
 * consistent across the two editors, but parameterised by a runtime
 * `groups` input so the label builder can swap product / kitchen /
 * custom-field bundles without recompiling.
 *
 * Behavior:
 *   - Click a binding row → token is inserted at the caret (or
 *     appended with a leading space when the field has no live
 *     selection state).
 *   - Search box filters case-insensitively across every group's
 *     `value` and `label`; empty groups are dropped from the popover.
 *
 * The component never owns the value — it forwards every change up
 * via the two-way `[(value)]` model so the parent's existing
 * patch / undo / dirty-flag pipeline keeps working unchanged.
 */
@Component({
  selector: 'app-bindable-input',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bindable-input.component.html',
  styleUrl: './bindable-input.component.scss',
})
export class BindableInputComponent {
  /** Two-way bound text value (free text + bindings). */
  value = model<string>('');

  /** Input vs textarea rendering. */
  multiline = input<boolean>(true);

  /** Forwarded to the native control. */
  placeholder = input<string>('');
  rows        = input<number>(2);

  /** Binding groups shown in the popover. Wired from the parent so
   *  the picker reacts to template-type changes (label vs kitchen)
   *  and to custom-field hydration. */
  groups = input<ReadonlyArray<BindingGroup>>([]);

  /** Refs into the native control so we can read selection range
   *  and restore the caret after an insert. Two refs because Angular
   *  needs the right element type at compile time. */
  inputRef    = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');

  // ─── Picker state ────────────────────────────────────────────────
  isOpen = signal<boolean>(false);
  query  = signal<string>('');

  /** Filtered groups — empty groups are dropped so the popover never
   *  renders a header with no rows under it. */
  filteredGroups = computed<BindingGroup[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.groups();
    if (!q) return [...all];
    return all
      .map((g) => ({
        ...g,
        bindings: g.bindings.filter((b) =>
          b.value.toLowerCase().includes(q) ||
          b.label.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.bindings.length > 0);
  });

  hasMatches = computed<boolean>(() => this.filteredGroups().some((g) => g.bindings.length > 0));

  /** Total binding count for the header badge — always reflects the
   *  full catalog, not the filter, so users see how many they're
   *  searching across. */
  totalCount = computed<number>(() =>
    this.groups().reduce((acc, g) => acc + g.bindings.length, 0));

  // ─── Open / close ────────────────────────────────────────────────
  togglePicker(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) this.query.set('');
  }
  closePicker(): void { this.isOpen.set(false); }
  onSearchInput(q: string): void { this.query.set(q); }

  // ─── Insert ──────────────────────────────────────────────────────
  /** Insert `binding` at the current caret position; if the field
   *  has no live selection (e.g. user clicked "{ }" before clicking
   *  the field) we append with a space pad. After inserting, focus
   *  + caret is restored just past the inserted token. */
  insertBinding(binding: string): void {
    const el = (this.multiline() ? this.textareaRef() : this.inputRef())?.nativeElement;
    const current = this.value() ?? '';
    let next: string;
    let caret: number;

    if (el && document.activeElement === el) {
      const start = el.selectionStart ?? current.length;
      const end   = el.selectionEnd ?? start;
      next  = current.slice(0, start) + binding + current.slice(end);
      caret = start + binding.length;
    } else {
      const pad = current && !/\s$/.test(current) ? ' ' : '';
      next  = current + pad + binding;
      caret = next.length;
    }

    this.value.set(next);
    this.closePicker();

    if (el) {
      queueMicrotask(() => {
        el.focus();
        try { el.setSelectionRange(caret, caret); } catch { /* number inputs reject */ }
      });
    }
  }

  // ─── Tracking ────────────────────────────────────────────────────
  trackGroup   = (_: number, g: BindingGroup) => g.labelKey;
  trackBinding = (_: number, b: BindingDef)   => b.value;
}
