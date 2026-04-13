import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { SearchDropdownComponent } from '../dropdown';
import { buildPageList, PageListEntry } from './pagination-utils';

/**
 * PaginationComponent
 * ───────────────────
 * A modern, adaptive pagination control. The UI it shows depends on which
 * inputs you give it:
 *
 * 1. **Full mode** (recommended): pass `[count]` (or `[pageCount]`).
 *    Shows: prev / next, page numbers (1 … 4 5 6 … 20), info text
 *    ("Showing 1–15 of 565"), and per-page selector.
 *
 * 2. **Compact mode**: pass `[hasNext]` (with optional `[hasPrev]`) but no
 *    `count` / `pageCount`. Shows: prev / next, current page label, per-page
 *    selector. No total because the backend doesn't know it.
 *
 * 3. **Cursor mode**: same as compact — pass `[hasNext]` / `[hasPrev]`.
 *    Hide the page-size selector with `[showPageSize]="false"` and you have
 *    a minimal prev/next pair suitable for cursor-paginated APIs.
 *
 * The component is fully presentational: it emits `pageChange` and
 * `pageSizeChange` events. The parent owns the data and re-fetches on its
 * own. There is no two-way binding because pagination state usually lives in
 * the parent's signal/store alongside other filter state.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, SearchDropdownComponent],
  templateUrl: './pagination.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  // ── Inputs ─────────────────────────────────────────────────────────────────

  /** 1-based current page. Required. */
  page = input.required<number>();

  /** Number of items per page. */
  pageSize = input<number>(15);

  /** Total item count from the backend. Pass when known. */
  count = input<number | null>(null);

  /** Total pages from the backend. Use only if `count` isn't available. */
  pageCount = input<number | null>(null);

  /**
   * Explicit "next page exists" flag. Use this for backends that return a
   * `hasMore` boolean instead of a count, or for cursor-based pagination.
   * If `count`/`pageCount` is also provided, this is preferred.
   */
  hasNext = input<boolean | null>(null);

  /**
   * Explicit "previous page exists" flag. Defaults to `page > 1` when not set.
   */
  hasPrev = input<boolean | null>(null);

  /** Options for the per-page selector. */
  pageSizeOptions = input<number[]>([15, 30, 50, 100]);

  /** Show the per-page selector. */
  showPageSize = input<boolean>(true);

  /** Show the "Showing X–Y of N" info text. */
  showInfo = input<boolean>(true);

  /** Show the optional "Go to page" jump input. */
  showJumpToPage = input<boolean>(false);

  /** Show « / » buttons for first / last page. */
  showFirstLast = input<boolean>(false);

  /** How many page numbers to render on either side of `current`. */
  siblingCount = input<number>(1);

  /** How many page numbers to pin at the very start and very end. */
  boundaryCount = input<number>(1);

  /** Disable all interaction (e.g. while a request is in flight). */
  disabled = input<boolean>(false);

  /** Override the info text format. Tokens: `{start}`, `{end}`, `{total}`. */
  infoFormat = input<string>('Showing {start}–{end} of {total}');

  /** Override the compact label. Tokens: `{page}`. */
  compactFormat = input<string>('Page {page}');

  // ── Outputs ────────────────────────────────────────────────────────────────
  pageChange     = output<number>();
  pageSizeChange = output<number>();

  // ── Internal: jump-to-page input value ─────────────────────────────────────
  jumpInput = signal<string>('');

  // ── Helpers for the SearchDropdown-based page-size selector ────────────────
  pageSizeLabel   = (n: number) => String(n);
  pageSizeCompare = (a: number, b: number) => a === b;

  // ── Derived state ──────────────────────────────────────────────────────────

  /** Total pages — derived from `pageCount`, then `count`, then `null` if unknown. */
  totalPages = computed<number | null>(() => {
    const pc = this.pageCount();
    if (pc != null && pc > 0) return pc;
    const c = this.count();
    if (c != null && c > 0) return Math.max(1, Math.ceil(c / this.pageSize()));
    return null;
  });

  /** True when the backend told us a total — enables "full mode" UI. */
  hasTotal = computed<boolean>(() => this.totalPages() != null);

  /** Page list with gaps (only available in full mode). */
  pages = computed<PageListEntry[]>(() => {
    const total = this.totalPages();
    if (total == null) return [];
    return buildPageList(this.page(), total, this.siblingCount(), this.boundaryCount());
  });

  canPrev = computed<boolean>(() => {
    if (this.disabled()) return false;
    const explicit = this.hasPrev();
    if (explicit != null) return explicit;
    return this.page() > 1;
  });

  canNext = computed<boolean>(() => {
    if (this.disabled()) return false;
    const explicit = this.hasNext();
    if (explicit != null) return explicit;
    const total = this.totalPages();
    if (total == null) return true; // unknown — assume yes
    return this.page() < total;
  });

  /** First displayed item index (1-based). */
  startItem = computed<number>(() => {
    if (this.count() === 0) return 0;
    return (this.page() - 1) * this.pageSize() + 1;
  });

  /** Last displayed item index (1-based, capped to count if known). */
  endItem = computed<number>(() => {
    const c = this.count();
    const naive = this.page() * this.pageSize();
    if (c == null) return naive;
    return Math.min(naive, c);
  });

  /** Resolved info text. */
  infoText = computed<string>(() => {
    if (!this.hasTotal()) {
      return this.compactFormat().replace('{page}', String(this.page()));
    }
    return this.infoFormat()
      .replace('{start}', String(this.startItem()))
      .replace('{end}',   String(this.endItem()))
      .replace('{total}', String(this.count() ?? '?'));
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  goToPage(p: number): void {
    if (this.disabled()) return;
    const total = this.totalPages();
    if (total != null) {
      if (p < 1 || p > total) return;
    } else {
      if (p < 1) return;
    }
    if (p === this.page()) return;
    this.pageChange.emit(p);
  }

  prev(): void { if (this.canPrev()) this.goToPage(this.page() - 1); }
  next(): void { if (this.canNext()) this.goToPage(this.page() + 1); }

  first(): void {
    if (this.disabled()) return;
    if (this.page() === 1) return;
    this.pageChange.emit(1);
  }

  last(): void {
    if (this.disabled()) return;
    const total = this.totalPages();
    if (total == null || this.page() === total) return;
    this.pageChange.emit(total);
  }

  onPageSizeChange(value: number | null): void {
    if (value != null && value > 0 && value !== this.pageSize()) {
      this.pageSizeChange.emit(value);
    }
  }

  onJumpInput(event: Event): void {
    this.jumpInput.set((event.target as HTMLInputElement).value);
  }

  onJumpKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const n = parseInt(this.jumpInput(), 10);
      if (!isNaN(n)) {
        this.goToPage(n);
        this.jumpInput.set('');
      }
    }
  }
}
