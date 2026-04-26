import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  TemplateRef,
  computed,
  contentChild,
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
import { OverlayModule } from '@angular/cdk/overlay';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import {
  DropdownLoadFn,
  DropdownLoadResult,
} from './search-dropdown.types';

/**
 * SearchDropdownComponent
 * ───────────────────────
 * A reusable, generic dropdown with built-in search, optional infinite scroll,
 * a custom-template item slot, and a footer slot for action links.
 *
 * Two data modes (mutually exclusive):
 *   1. Static  → pass `[items]="myArray"`. Search is client-side.
 *   2. Async   → pass `[loadFn]="(params) => Promise<{items, hasMore}>"`.
 *                Search is debounced and forwarded to the loader.
 *                More pages are auto-loaded as the user scrolls.
 *
 * Selection:
 *   - Two-way bind with `[(value)]`.
 *   - `[multiple]="true"` switches to a multi-select with checkboxes.
 *   - `[compareWith]` controls equality (default reference equality).
 *
 * Slots:
 *   - `<ng-template #item let-item>...</ng-template>` overrides item rendering.
 *   - `<ng-template #footer>...</ng-template>` renders a sticky footer area
 *     (e.g. "Manage X" link).
 *
 * Keyboard:
 *   ↓ / ↑   move highlight
 *   Enter   select highlighted
 *   Esc     close
 */
@Component({
  selector: 'app-search-dropdown',
  standalone: true,
  imports: [CommonModule, OverlayModule],
  templateUrl: './search-dropdown.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      useExisting: forwardRef(() => SearchDropdownComponent),
      multi: true,
    },
  ],
})
export class SearchDropdownComponent<T = any> implements OnDestroy, ControlValueAccessor {
  private cdr = inject(ChangeDetectorRef);
  // ── Inputs ─────────────────────────────────────────────────────────────────
  /** Static items list. Ignored if `loadFn` is provided. */
  items = input<T[]>([]);

  /** Async page loader. Takes precedence over `items`. */
  loadFn = input<DropdownLoadFn<T> | null>(null);

  /** Render an item to a string label. Required for non-string item types. */
  displayWith = input<(item: T) => string>((item) => String(item));

  /** Equality function for selection. Defaults to reference equality. */
  compareWith = input<(a: T, b: T) => boolean>((a, b) => a === b);

  /**
   * Transform an item into the value written to the parent form / ngModel.
   * Defaults to identity — the full item object is written, preserving the
   * historical behaviour. Set e.g. `[toValue]="(i) => i.value"` when the
   * consuming form should persist a plain primitive (UUID, string, etc.)
   * instead of the `{label, value}` option object. This does NOT change
   * the internal signal value used for display / `isSelected`; consumers
   * that already provide a `compareWith` like `(a?.value ?? a) === …`
   * continue to work with either shape.
   */
  toValue = input<(item: T) => any>((item) => item);

  /** Two-way bound selected value. `T` for single, `T[]` for multiple. */
  value = model<T | T[] | null>(null);

  /** Toggle multi-select with checkboxes. */
  multiple = input<boolean>(false);

  /** Trigger placeholder when nothing is selected. */
  placeholder = input<string>('Select…');

  /** Search input placeholder. */
  searchPlaceholder = input<string>('Search');

  /** Show the search box. Set false for tiny lists. */
  searchable = input<boolean>(true);

  /** Disable the trigger entirely. Also set automatically by `setDisabledState` (forms). */
  disabled = input<boolean>(false);

  /** Effective disabled state — true if either the input or the form is disabled. */
  isDisabled = computed(() => this.disabled() || this._cvaDisabled());

  /**
   * Show the clear (×) button when a value is selected.
   * Set to `false` for selectors where there must always be a value
   * (e.g. page-size, sort-by) — clearing wouldn't make sense.
   */
  clearable = input<boolean>(true);

  /** Page size for `loadFn`. */
  pageSize = input<number>(20);

  /** Empty-state text. */
  noResultsText = input<string>('No results found');

  /** Max height of the dropdown panel before it scrolls. */
  panelMaxHeight = input<string>('320px');

  /** Override panel width. Defaults to trigger width. */
  panelWidth = input<string | null>(null);

  /** Extra classes to add to the trigger button. */
  triggerClass = input<string>('');

  /** Extra classes to add to the floating panel. */
  panelClass = input<string>('');

  /**
   * Where the floating panel is mounted in the DOM.
   *
   *  • `'body'` (default) — the panel is rendered into CDK's global
   *    `cdk-overlay-container`, which is a direct child of `<body>`. This
   *    escapes any parent's `overflow: hidden`, `transform`, or `z-index`
   *    stacking context, so the panel always appears on top. Use this in
   *    99% of cases — including inside modals, cards, and tables.
   *
   *  • `'inline'` — the panel is rendered as a sibling of the trigger inside
   *    the component's own DOM. Cheaper (no overlay), but inherits any
   *    parent overflow/transform constraints. Only use this if you know the
   *    surrounding layout has no clipping ancestors and you need the panel
   *    to participate in the local DOM (e.g. for tests or print styles).
   */
  attachToBody = input<boolean>(true);

  /** Preferred panel position: 'bottom' (default) or 'top'. */
  preferPosition = input<'bottom' | 'top'>('bottom');

  overlayPositions = computed(() => {
    const bottom = { originX: 'start' as const, originY: 'bottom' as const, overlayX: 'start' as const, overlayY: 'top' as const, offsetY: 4 };
    const top = { originX: 'start' as const, originY: 'top' as const, overlayX: 'start' as const, overlayY: 'bottom' as const, offsetY: -4 };
    return this.preferPosition() === 'top' ? [top, bottom] : [bottom, top];
  });

  /** External loading flag — useful when the parent owns the data. */
  loading = input<boolean>(false);

  // ── Outputs ────────────────────────────────────────────────────────────────
  /** Fires whenever the user types into the search box. */
  searchChange = output<string>();
  /** Fires when the panel opens. */
  opened = output<void>();
  /** Fires when the panel closes. */
  closed = output<void>();

  // ── Projected templates ────────────────────────────────────────────────────
  itemTpl   = contentChild<TemplateRef<{ $implicit: T; selected: boolean }>>('item');
  footerTpl = contentChild<TemplateRef<unknown>>('footer');
  headerTpl = contentChild<TemplateRef<unknown>>('header');

  // ── View children ──────────────────────────────────────────────────────────
  triggerEl   = viewChild<ElementRef<HTMLElement>>('trigger');
  searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  panelEl     = viewChild<ElementRef<HTMLElement>>('panel');

  // ── Internal state ─────────────────────────────────────────────────────────
  isOpen          = signal(false);
  searchQuery     = signal('');
  highlightIndex  = signal(-1);
  loadedItems     = signal<T[]>([]);
  hasMore         = signal(false);
  page            = signal(1);
  loadingInternal = signal(false);
  /** Trigger width captured at the moment the panel opens. */
  triggerWidth    = signal<number>(0);

  // Effective items: filtered (client) or fetched (async)
  effectiveItems = computed<T[]>(() => {
    if (this.loadFn()) {
      return this.loadedItems();
    }
    const all = this.items();
    if (!this.searchable()) return all;
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return all;
    const display = this.displayWith();
    return all.filter((item) => display(item).toLowerCase().includes(q));
  });

  isLoading = computed(() => this.loading() || this.loadingInternal());

  /** Trigger label — single, single-name+badge for multi, or placeholder. */
  displayLabel = computed<string>(() => {
    const v = this.value();
    const display = this.displayWith();
    if (v == null) return '';
    if (Array.isArray(v)) {
      if (v.length === 0) return '';
      if (v.length === 1) return display(v[0]);
      return `${display(v[0])} +${v.length - 1}`;
    }
    return display(v);
  });

  hasValue = computed(() => {
    const v = this.value();
    return Array.isArray(v) ? v.length > 0 : v != null;
  });

  // ── Search debounce ────────────────────────────────────────────────────────
  private searchInput$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor() {
    this.searchInput$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((query) => {
        this.searchQuery.set(query);
        this.searchChange.emit(query);
        this.highlightIndex.set(query ? 0 : -1);
        if (this.loadFn()) {
          this.page.set(1);
          this.loadedItems.set([]);
          this.fetchPage();
        }
      });

    // Auto-focus the search input when the panel opens.
    effect(() => {
      if (this.isOpen() && this.searchable()) {
        queueMicrotask(() => this.searchInput()?.nativeElement.focus());
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchInput$.complete();
  }

  // ── Open / close ───────────────────────────────────────────────────────────
  toggle(): void {
    if (this.isDisabled()) return;
    this.isOpen() ? this.close() : this.open();
  }

  open(): void {
    if (this.isDisabled() || this.isOpen()) return;
    // Capture the trigger's current width so the panel can match it.
    const w = this.triggerEl()?.nativeElement.offsetWidth ?? 0;
    if (w > 0) this.triggerWidth.set(w);
    this.isOpen.set(true);
    this.highlightIndex.set(-1);
    if (this.loadFn() && this.loadedItems().length === 0) {
      this.fetchPage();
    }
    this.opened.emit();
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    // Reset the search state only if the user actually typed something —
    // otherwise pushing '' through the debounced search stream would trigger
    // a redundant `fetchPage()` after every close (e.g. after selection).
    // Keeping the existing `loadedItems` cached means the next open reuses
    // the previously-fetched page instead of hitting the network again.
    if (this.searchQuery() !== '') {
      this.searchQuery.set('');
      this.searchInput$.next('');
    }
    this._onTouched();
    this.closed.emit();
  }

  // ── ControlValueAccessor ───────────────────────────────────────────────────
  // Lets the component plug into [(ngModel)], [formControl], formControlName.
  // The signal-based [(value)] keeps working alongside this.
  /** @internal */ _onChange: (value: T | T[] | null) => void = () => {};
  /** @internal */ _onTouched: () => void = () => {};
  /** @internal */ private _cvaDisabled = signal(false);

  writeValue(value: T | T[] | null): void {
    // Update the internal signal without re-emitting onChange (would loop).
    this.value.set(value);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: T | T[] | null) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._cvaDisabled.set(isDisabled);
    this.cdr.markForCheck();
  }

  // ── Selection ──────────────────────────────────────────────────────────────
  isSelected(item: T): boolean {
    const v = this.value();
    if (v == null) return false;
    const eq = this.compareWith();
    if (Array.isArray(v)) return v.some((x) => eq(x, item));
    return eq(v, item);
  }

  selectItem(item: T): void {
    const eq = this.compareWith();
    const toVal = this.toValue();
    if (this.multiple()) {
      const current = (this.value() as T[]) ?? [];
      const exists = current.some((x) => eq(x, item));
      const next = exists ? current.filter((x) => !eq(x, item)) : [...current, item];
      this.value.set(next);
      this._onChange(next.map((x) => toVal(x)));
      // Multi-select stays open.
    } else {
      this.value.set(item);
      this._onChange(toVal(item));
      this.close();
      this.triggerEl()?.nativeElement.focus();
    }
  }

  clear(event?: Event): void {
    event?.stopPropagation();
    const next = this.multiple() ? ([] as T[]) : null;
    this.value.set(next);
    this._onChange(next);
  }

  // ── Search input ───────────────────────────────────────────────────────────
  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput$.next(value);
  }

  // ── Async loading ──────────────────────────────────────────────────────────
  private async fetchPage(): Promise<void> {
    const fn = this.loadFn();
    if (!fn || this.loadingInternal()) return;
    this.loadingInternal.set(true);
    try {
      const result: DropdownLoadResult<T> = await fn({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.searchQuery(),
      });
      this.loadedItems.update((prev) =>
        this.page() === 1 ? result.items : [...prev, ...result.items],
      );
      this.hasMore.set(result.hasMore);
    } catch (err) {
      console.error('SearchDropdown loadFn failed', err);
    } finally {
      this.loadingInternal.set(false);
    }
  }

  /** Called by the panel scroll listener. Loads the next page near the bottom. */
  onPanelScroll(event: Event): void {
    if (!this.loadFn() || !this.hasMore() || this.loadingInternal()) return;
    const el = event.target as HTMLElement;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    if (nearBottom) {
      this.page.update((p) => p + 1);
      this.fetchPage();
    }
  }

  // ── Keyboard navigation ────────────────────────────────────────────────────
  @HostListener('keydown', ['$event'])
  onHostKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      if ((event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')
          && document.activeElement === this.triggerEl()?.nativeElement) {
        event.preventDefault();
        this.open();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveHighlight(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveHighlight(-1);
        break;
      case 'Enter':
        event.preventDefault();
        this.selectHighlighted();
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        this.triggerEl()?.nativeElement.focus();
        break;
    }
  }

  private moveHighlight(delta: number): void {
    const items = this.effectiveItems();
    if (items.length === 0) return;
    const current = this.highlightIndex();
    const next = (current + delta + items.length) % items.length;
    this.highlightIndex.set(next);
    this.scrollHighlightIntoView(next);
  }

  private selectHighlighted(): void {
    const items = this.effectiveItems();
    const idx = this.highlightIndex();
    if (idx >= 0 && idx < items.length) {
      this.selectItem(items[idx]);
    }
  }

  private scrollHighlightIntoView(idx: number): void {
    queueMicrotask(() => {
      const panel = this.panelEl()?.nativeElement;
      if (!panel) return;
      const item = panel.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
      item?.scrollIntoView({ block: 'nearest' });
    });
  }

  // Used by template for `track` expressions.
  trackByIdx = (idx: number) => idx;
}
