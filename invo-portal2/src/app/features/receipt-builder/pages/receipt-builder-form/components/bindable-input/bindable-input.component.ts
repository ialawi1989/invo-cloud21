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

import {
  ALL_BINDINGS,
  BINDING_GROUPS,
  BindingDef,
  BindingGroup,
} from '../../../../services/bindings.catalog';

/**
 * BindableInputComponent
 * ──────────────────────
 * Drop-in replacement for `<input>` / `<textarea>` in the element
 * editor for fields that may mix free text with `!invoice.*` /
 * `!preferences.*` bindings. Pairs the native control with a tiny
 * "{ }" trigger that opens a categorised picker:
 *
 *   - Click a binding → it's inserted at the current cursor position
 *     (or appended if the field has no focus / selection state).
 *   - Search box filters across every group's `value` and `label`.
 *
 * The component never owns the value — it forwards every change up to
 * the parent via two-way `[(value)]`, so the parent's existing
 * `patchSelectedElement` / undo-redo path keeps working unchanged.
 *
 * Why a custom widget vs. trigger-on-`!`:
 *   The bindings have non-trivial spellings (`refrenceNumber`,
 *   `itemSubTotalAfterDiscount.currency()`, etc.). A categorised picker
 *   is faster than a fuzzy autocomplete *and* works on touch screens
 *   where caret-position triggers don't fire reliably.
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

  /** Switch between `<input>` and `<textarea>` rendering. */
  multiline = input<boolean>(false);

  /** Standard input attrs forwarded to the native control. */
  placeholder = input<string>('');
  rows        = input<number>(2);

  /** Optional class added to the inner native control so the host
   *  page can keep its existing input styling (e.g. `.input`). */
  inputClass = input<string>('input');

  /** Refs into the native control so we can read selection range and
   *  restore the caret after an insert. Kept as separate view-children
   *  because Angular needs the right element type at compile time. */
  inputRef    = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');

  // ── Picker overlay state ─────────────────────────────────────────────
  isOpen = signal(false);
  query  = signal('');

  /** Filtered groups — empty groups are dropped so the popover doesn't
   *  show a header with no rows under it. */
  filteredGroups = computed<BindingGroup[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return BINDING_GROUPS;
    return BINDING_GROUPS
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

  totalCount = ALL_BINDINGS.length;

  // ── Open / close ─────────────────────────────────────────────────────
  togglePicker(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) this.query.set('');
  }

  closePicker(): void {
    this.isOpen.set(false);
  }

  onSearchInput(q: string): void {
    this.query.set(q);
  }

  // ── Insert ───────────────────────────────────────────────────────────
  /** Insert `binding` at the current caret position; if the field has
   *  no live selection (e.g. user clicked "{ }" before clicking the
   *  field) we append, padded by spaces so adjacent free text stays
   *  legible. After inserting, restore focus + caret to *after* the
   *  inserted token so the user can keep typing. */
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
      // Append; pad with a space if there's existing content and it
      // doesn't already end in whitespace.
      const pad = current && !/\s$/.test(current) ? ' ' : '';
      next  = current + pad + binding;
      caret = next.length;
    }

    this.value.set(next);
    this.closePicker();

    // Restore focus + caret on the next tick so the new value is
    // committed first.
    if (el) {
      queueMicrotask(() => {
        el.focus();
        try { el.setSelectionRange(caret, caret); } catch { /* number inputs reject this */ }
      });
    }
  }

  // ── Tracking ─────────────────────────────────────────────────────────
  trackGroup   = (_: number, g: BindingGroup) => g.labelKey;
  trackBinding = (_: number, b: BindingDef)   => b.value;
}
