import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Shared search input for list/index pages.
 *
 * Submit-on-action UX: the input does NOT fire on every keystroke.
 * The user has to either press Enter or click the magnifier button
 * for the parent to issue a request. Typing only updates the local
 * draft. Backspacing through the field to an empty string also stays
 * local — only the explicit "x" button emits a clear (which the
 * parent typically maps to "reset search and reload"). This avoids
 * the noisy per-keystroke debounce that used to live in every list
 * component.
 *
 * Bind via:
 *   <app-list-search
 *     [value]="search()"
 *     [placeholder]="'…' | translate"
 *     (search)="onSearch($event)"
 *     (clear)="onClear()"/>
 *
 * Looks like a rounded pill with a magnifier icon on the start, a
 * transparent input that fills the row, and an "x" button that
 * appears once there's any draft text. Restyling lives in this file
 * so every list search changes together.
 */
@Component({
  selector: 'app-list-search',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="ls-search" [class.ls-search--full]="fullWidth">
      <button type="button"
              class="ls-search__btn"
              (click)="submit()"
              [attr.aria-label]="searchLabel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>
      <input
        #inp
        type="text"
        [value]="draft()"
        [placeholder]="placeholder"
        [attr.aria-label]="placeholder"
        (input)="onInput($any($event.target).value)"
        (keydown.enter)="submit(); $event.preventDefault()"
        (keydown.escape)="onEscape()"/>
      @if (draft()) {
        <button type="button"
                class="ls-search__clear"
                (click)="onClear(); inp.focus()"
                [attr.aria-label]="clearLabel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      }
    </label>
  `,
  styles: [`
    .ls-search {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      max-width: 360px;
      padding: 7px 10px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #94a3b8;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .ls-search--full { max-width: none; width: 100%; }
    .ls-search:focus-within {
      border-color: var(--color-brand-500, #32acc1);
      box-shadow: 0 0 0 3px rgba(50, 172, 193, 0.12);
    }
    .ls-search input {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      font: inherit;
      font-size: 13px;
      color: #0f172a;
      background: transparent;
    }
    .ls-search input::placeholder { color: #94a3b8; }
    .ls-search__btn,
    .ls-search__clear {
      background: transparent;
      border: none;
      border-radius: 4px;
      padding: 2px;
      color: #94a3b8;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .ls-search__btn:hover { color: var(--color-brand-600, #0891b2); }
    .ls-search__clear:hover { background: #f1f5f9; color: #475569; }
  `],
})
export class ListSearchComponent implements OnChanges {
  /** Committed value (the one the parent currently filters by).
   *  Used to seed the input on init and to reset the draft after
   *  the parent clears or replaces the value externally. */
  @Input() value = '';
  @Input() placeholder = '';
  /** When true, the pill stretches to the available row width. */
  @Input() fullWidth = false;
  /** When true, emits `search` on every keystroke instead of waiting
   *  for Enter / the magnifier button. Use for purely client-side
   *  filters where the result is instant; leave `false` (default)
   *  for backend-backed searches. */
  @Input() live = false;
  /** `aria-label` overrides for the icon buttons. */
  @Input() searchLabel = 'Search';
  @Input() clearLabel  = 'Clear';

  /** Fires when the user presses Enter or clicks the magnifier.
   *  Carries the current draft string. */
  @Output() search = new EventEmitter<string>();
  /** Fires when the user clicks the "x" button. The draft has
   *  already been wiped locally; the parent typically resets its
   *  committed value and reloads. */
  @Output() clear = new EventEmitter<void>();

  /** Local draft — typing updates this only. Nothing is emitted
   *  until the user submits. Re-seeded from `value` whenever the
   *  parent changes the committed value (e.g. after `clear()` or
   *  on URL-state hydration). */
  draft = signal<string>('');

  ngOnChanges(ch: SimpleChanges): void {
    if ('value' in ch) this.draft.set(this.value ?? '');
  }

  onInput(v: string): void {
    this.draft.set(v);
    if (this.live) this.search.emit(v);
  }

  submit(): void { this.search.emit(this.draft()); }

  onClear(): void {
    this.draft.set('');
    this.clear.emit();
  }

  /** Escape — revert the draft to the committed value without
   *  re-firing search. Lets the user back out of an unsubmitted
   *  edit without changing what's filtered. */
  onEscape(): void { this.draft.set(this.value ?? ''); }
}
