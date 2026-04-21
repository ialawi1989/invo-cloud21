import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import { ProductsService } from '../../../../services/products.service';

export interface PickedProduct {
  id:        string;
  name:      string;
  barcode?:  string;
  sku?:      string;
  UOM?:      string;
  unitCost?: number;
  price?:    number;
  type?:     string;
}

export interface PickProductModalData {
  /** Optional product-type filter — e.g. ['inventory', 'serialized'] for raw
   *  ingredients in a recipe picker, or leave empty to show everything. */
  types?: string[];
  /** Ids already in the caller's list — hidden from results. */
  excludedIds?: string[];
  /** Allow multi-select? Default true. Kit/package pickers use multi;
   *  single-select pickers (e.g. parent-item) pass false. */
  multiple?: boolean;
  /** Modal title override. */
  title?: string;
}

/**
 * pick-product-modal
 * ──────────────────
 * Generic paginated product picker. Shared by kit-builder / recipe-builder /
 * package-builder / menu-selection to avoid duplicating three near-identical
 * modals. Configure via `MODAL_DATA` (types filter, excludedIds, multiple).
 *
 * Returns the selected rows as `PickedProduct[]` on close, `undefined` on
 * dismiss. Single-select variant still returns an array (0 or 1 item) for a
 * uniform caller shape.
 */
@Component({
  selector: 'app-pf-pick-product-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent],
  templateUrl: './pick-product-modal.component.html',
  styleUrl: './pick-product-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickProductModalComponent implements OnInit {
  private products = inject(ProductsService);
  private modalRef = inject<ModalRef<PickedProduct[]>>(MODAL_REF);
  data             = inject<PickProductModalData>(MODAL_DATA) ?? {};

  search   = signal<string>('');
  loading  = signal<boolean>(false);
  page     = signal<number>(1);
  hasMore  = signal<boolean>(false);
  rows     = signal<PickedProduct[]>([]);
  selected = signal<Set<string>>(new Set());
  private debounce?: ReturnType<typeof setTimeout>;

  multiple = computed(() => this.data.multiple !== false);
  excluded = computed<Set<string>>(() => new Set(this.data.excludedIds ?? []));
  visible  = computed<PickedProduct[]>(() =>
    this.rows().filter((r) => !this.excluded().has(r.id)),
  );
  selectedCount = computed(() => this.selected().size);

  ngOnInit(): void {
    this.loadPage(1);
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.loadPage(1), 300);
  }

  async loadPage(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.products.getProductList({
        page,
        limit: 20,
        searchTerm: this.search().trim(),
        sortBy: { sortValue: 'name', sortDirection: 'asc' },
        filter: { types: this.data.types ?? [] },
      });
      const rows: PickedProduct[] = (res.list ?? []).map((r: any) => ({
        id:       r.id ?? r._id,
        name:     r.name ?? '',
        barcode:  r.barcode,
        sku:      r.sku,
        UOM:      r.UOM,
        unitCost: r.unitCost ?? 0,
        price:    r.defaultPrice ?? 0,
        type:     r.type,
      }));
      if (page === 1) this.rows.set(rows);
      else this.rows.update((prev) => [...prev, ...rows]);
      this.hasMore.set(page < (res.pageCount ?? 1));
      this.page.set(page);
    } finally {
      this.loading.set(false);
    }
  }

  loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.loadPage(this.page() + 1);
  }

  toggle(id: string): void {
    this.selected.update((prev) => {
      const next = new Set(prev);
      if (this.multiple()) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        // Single-select → replace any existing pick
        next.clear();
        next.add(id);
      }
      return next;
    });
    if (!this.multiple()) this.confirm();
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  confirm(): void {
    const picked = this.rows().filter((r) => this.selected().has(r.id));
    this.modalRef.close(picked);
  }

  cancel(): void {
    this.modalRef.dismiss();
  }
}
