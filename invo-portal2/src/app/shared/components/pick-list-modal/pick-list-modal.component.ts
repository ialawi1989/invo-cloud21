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

import { EntityThumbComponent } from '@shared/components/entity-thumb/entity-thumb.component';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

/** One selectable row. `id` is what callers persist; `name` is what they show. */
export interface PickedListItem {
  id: string;
  name: string;
  image?: string;
}

export interface PickListPage {
  list: PickedListItem[];
  count: number;
}

export type PickListLoader = (params: {
  page: number;
  limit: number;
  searchTerm: string;
}) => Promise<PickListPage>;

export interface PickListModalData {
  /** Fetches one page. See `pick-list.loaders.ts` for ready-made ones. */
  load: PickListLoader;
  /** Already-selected ids — pre-checked on open. */
  selectedIds?: string[];
  title?: string;
  /**
   * Multi-select (default) shows checkboxes and commits on Apply. Set false
   * for a filter-style picker: choosing a row replaces the selection and
   * closes immediately.
   */
  multiple?: boolean;
  /** i18n key for the single-select "no filter" footer button. */
  clearLabel?: string;
}

export interface PickListModalResult {
  selected: PickedListItem[];
}

interface Row extends PickedListItem {
  /** Per-row tick, mirrored from the running set so it survives paging. */
  picked: boolean;
}

const PAGE_SIZE = 30;

/**
 * Generic paginated picker modal — search box, infinite scroll, single or
 * multi select. The caller supplies a `load` function, so one implementation
 * serves categories, tags, and anything else list-shaped.
 *
 * Chosen over a dropdown wherever the option set is large enough that users
 * need room to search and scan.
 */
@Component({
  selector: 'app-pick-list-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    EntityThumbComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pick-list-modal.component.html',
  styleUrl: './pick-list-modal.component.scss',
})
export class PickListModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private translate = inject(TranslateService);
  private modalRef = inject<ModalRef<PickListModalResult>>(MODAL_REF);
  private destroyRef = inject(DestroyRef);

  data = inject<PickListModalData>(MODAL_DATA);

  readonly multiple = this.data.multiple !== false;

  private i18nTick = signal(0);
  search = signal<string>('');
  loading = signal<boolean>(false);
  page = signal<number>(1);
  hasMore = signal<boolean>(false);
  rows = signal<Row[]>([]);

  /** Running selection across pages, so ticking then paging keeps the tick. */
  private selected = signal<Set<string>>(new Set(this.data.selectedIds ?? []));
  /** Every row seen so far — lets Apply return rows the user paged past. */
  private rowCache = new Map<string, Row>();

  selectedCount = computed<number>(() => this.selected().size);

  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private scrollObserver?: IntersectionObserver;
  private debounce?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    void this.loadPage(1);
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  ngAfterViewInit(): void {
    const sentinel = this.scrollSentinel();
    if (!sentinel) return;
    this.scrollObserver = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (e?.isIntersecting && this.hasMore() && !this.loading()) void this.loadMore();
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

  toggle(row: Row): void {
    if (!this.multiple) {
      this.modalRef.close({ selected: [{ id: row.id, name: row.name, image: row.image }] });
      return;
    }
    const next = new Set(this.selected());
    if (next.has(row.id)) next.delete(row.id);
    else next.add(row.id);
    this.selected.set(next);
    this.rows.update((list) =>
      list.map((r) => (r.id === row.id ? { ...r, picked: next.has(r.id) } : r)),
    );
    const cached = this.rowCache.get(row.id);
    if (cached) this.rowCache.set(row.id, { ...cached, picked: next.has(row.id) });
  }

  clearAll(): void {
    this.selected.set(new Set());
    this.rows.update((list) => list.map((r) => ({ ...r, picked: false })));
    for (const [id, r] of this.rowCache) this.rowCache.set(id, { ...r, picked: false });
  }

  apply(): void {
    const out: PickedListItem[] = [];
    for (const id of this.selected()) {
      const cached = this.rowCache.get(id);
      // Fallback id-only entry for a cache miss — the caller can resolve later.
      out.push(cached ? { id: cached.id, name: cached.name, image: cached.image } : { id, name: id });
    }
    this.modalRef.close({ selected: out });
  }

  cancel(): void { this.modalRef.close(undefined); }

  /** Single-select needs an explicit "no selection" escape hatch. */
  clearAndClose(): void { this.modalRef.close({ selected: [] }); }

  // ─── Loading ──────────────────────────────────────────────────────────────
  private async loadPage(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.data.load({ page, limit: PAGE_SIZE, searchTerm: this.search().trim() });
      const sel = this.selected();
      const next: Row[] = res.list.map((c) => {
        const row: Row = { ...c, picked: sel.has(c.id) };
        this.rowCache.set(row.id, row);
        return row;
      });
      this.page.set(page);
      this.rows.set(page === 1 ? next : [...this.rows(), ...next]);
      this.hasMore.set(page * PAGE_SIZE < (res.count || 0));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadMore(): Promise<void> {
    await this.loadPage(this.page() + 1);
  }
}
