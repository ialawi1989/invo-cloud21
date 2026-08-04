import { Injectable, computed, signal } from '@angular/core';

type AnyInput = HTMLInputElement | HTMLTextAreaElement;

/**
 * Owns the Expression dialog state.
 *
 * Flow:
 *   - Each expression input renders a small fx button that calls
 *     `openFor(inputEl, label)`. The dialog reads the input's current
 *     value, lets the user edit + browse fields/filters/operators, and
 *     either commits back via `commit(value)` or discards via `close()`.
 *
 * The service intentionally exposes the raw target element rather than
 * proxying every operation — the dialog needs `selectionStart` and the
 * commit needs to dispatch `input` so ngModel propagates the change.
 */
export interface OpenOptions {
  /** Data-source path of the surrounding table/payments block. When set,
   *  the dialog's Fields list resolves against the first element of that
   *  array and prefixes paths with `row.`, matching the binding context
   *  cell expressions are evaluated in. */
  rowSource?: string;
}

@Injectable({ providedIn: 'root' })
export class BindingPickerService {
  private readonly _target = signal<AnyInput | null>(null);
  private readonly _label = signal<string>('Value');
  private readonly _rowSource = signal<string | null>(null);
  /** Fallback row-source applied when `openFor` is called without an
   *  explicit one. The property panel sets this when the selected block
   *  lives inside a `repeater` (using the parent's `dataSource`), so every
   *  per-block expression input automatically gets `row.x` field suggestions
   *  without each call site having to plumb the parent context through. */
  private readonly _defaultRowSource = signal<string | null>(null);

  readonly target = this._target.asReadonly();
  readonly label = this._label.asReadonly();
  readonly rowSource = this._rowSource.asReadonly();
  readonly open = computed(() => this._target() !== null);

  /** Set the implicit row-source used when `openFor` doesn't get an explicit
   *  one. Pass `null` to clear (e.g. selection cleared, or the selected
   *  block isn't a child of a repeater). */
  setDefaultRowSource(path: string | null | undefined): void {
    this._defaultRowSource.set(path && path.trim() ? path : null);
  }

  openFor(el: AnyInput, label = 'Value', opts: OpenOptions = {}): void {
    this._label.set(label);
    const explicit = opts.rowSource && opts.rowSource.trim() ? opts.rowSource : null;
    this._rowSource.set(explicit ?? this._defaultRowSource());
    this._target.set(el);
  }

  close(): void {
    this._target.set(null);
  }

  /** Replace the target input's value with the dialog's expression and
   *  dispatch `input` so ngModel picks it up. Closes the dialog. */
  commit(value: string): void {
    const el = this._target();
    if (!el) return;
    el.value = value;
    el.setSelectionRange(value.length, value.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    this.close();
  }
}
