import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import { DiscountService } from '../../services/discount.service';

export interface PickedCategory {
  id:    string;
  name:  string;
  image?: string;
}

export interface PickCategoryModalData {
  /** Already-selected category ids — pre-checked on open. */
  selectedIds: string[];
  title?:      string;
}

export interface PickCategoryModalResult {
  selected: PickedCategory[];
}

interface CategoryRow extends PickedCategory {
  /** Per-row tick state, mirrored from the running `selected` Set
   *  so the checkbox stays bound when paging back and forth. */
  picked: boolean;
}

/**
 * Discount-specific category picker. Paginated list of categories
 * with infinite scroll (intersection-observer sentinel). Multi-
 * select via row checkboxes; "Apply" commits the snapshot.
 *
 * Smaller cousin of `PickProductPlModalComponent` — same shape,
 * fewer filters (no department, no type), no price tracking. The
 * caller sees a flat `{id, name, image?}[]`.
 */
@Component({
  selector: 'app-pick-category-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pick-category-modal.component.html',
  styleUrl: './pick-category-modal.component.scss',
})
export class PickCategoryModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private service    = inject(DiscountService);
  private translate  = inject(TranslateService);
  private modalRef   = inject<ModalRef<PickCategoryModalResult>>(MODAL_REF);
  private destroyRef = inject(DestroyRef);

  data = inject<PickCategoryModalData>(MODAL_DATA) ?? { selectedIds: [] };

  private i18nTick = signal(0);
  search   = signal<string>('');
  loading  = signal<boolean>(false);
  page     = signal<number>(1);
  hasMore  = signal<boolean>(false);
  rows     = signal<CategoryRow[]>([]);

  /** Running selection set across pages so checking + paging keeps
   *  the tick. Seeded from the caller's already-selected ids. */
  private selected = signal<Set<string>>(new Set(this.data.selectedIds ?? []));
  /** Cache of every row we've seen — so when the user paged past a
   *  ticked row and applies, we can still return it by id. */
  private rowCache = new Map<string, CategoryRow>();

  selectedCount = computed<number>(() => this.selected().size);

  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private scrollObserver?: IntersectionObserver;
  private debounce?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    void this.loadPage(1);
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  ngAfterViewInit(): void {
    const sentinel = this.scrollSentinel();
    if (!sentinel) return;
    this.scrollObserver = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (e?.isIntersecting && this.hasMore() && !this.loading()) {
        this.loadMore();
      }
    });
    this.scrollObserver.observe(sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
    clearTimeout(this.debounce);
  }

  onSearchInput(v: string): void {
    this.search.set(v);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.loadPage(1), 250);
  }

  toggle(row: CategoryRow): void {
    const next = new Set(this.selected());
    if (next.has(row.id)) next.delete(row.id);
    else next.add(row.id);
    this.selected.set(next);
    this.rows.update(list =>
      list.map(r => r.id === row.id ? { ...r, picked: next.has(r.id) } : r),
    );
    // Refresh the cache entry too so the apply snapshot reflects
    // the new picked state.
    const cached = this.rowCache.get(row.id);
    if (cached) this.rowCache.set(row.id, { ...cached, picked: next.has(row.id) });
  }

  clearAll(): void {
    this.selected.set(new Set());
    this.rows.update(list => list.map(r => ({ ...r, picked: false })));
    for (const [id, r] of this.rowCache) this.rowCache.set(id, { ...r, picked: false });
  }

  /** Apply: return every cached row whose id is in `selected`.
   *  Falls through to the visible rows for ids the cache missed
   *  (shouldn't happen, but cheap defence). */
  apply(): void {
    const ids = this.selected();
    const out: PickedCategory[] = [];
    for (const id of ids) {
      const cached = this.rowCache.get(id);
      if (cached) {
        out.push({ id: cached.id, name: cached.name, image: cached.image });
      } else {
        // Fallback — id-only entry. The caller can resolve later.
        out.push({ id, name: id });
      }
    }
    this.modalRef.close({ selected: out });
  }

  cancel(): void { this.modalRef.close(undefined); }

  // ─── Loading ────────────────────────────────────────────────────
  private async loadPage(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.service.loadCategoriesPage({
        page,
        limit:      30,
        searchTerm: this.search().trim(),
      });
      const sel = this.selected();
      const next: CategoryRow[] = res.list.map(c => {
        const row: CategoryRow = { ...c, picked: sel.has(c.id) };
        this.rowCache.set(row.id, row);
        return row;
      });
      this.page.set(page);
      this.rows.set(page === 1 ? next : [...this.rows(), ...next]);
      this.hasMore.set(page * 30 < res.count);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadMore(): Promise<void> {
    await this.loadPage(this.page() + 1);
  }
}
