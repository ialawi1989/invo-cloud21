import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { EntityThumbComponent } from '@shared/components/entity-thumb/entity-thumb.component';

/** A product row in the picker / the assigned list. `index` drives saved order. */
export interface AssignableProduct {
  id: string;
  name: string;
  barcode?: string;
  thumbnailUrl?: string | null;
  index: number;
}

export type AssignableProductLoader = (params: {
  page: number;
  limit: number;
  searchTerm: string;
}) => Promise<{ list: AssignableProduct[]; pageCount: number }>;

export interface PickAssignedProductsData {
  /** Fetches one page of the *unassigned* pool. */
  load: AssignableProductLoader;
  /** Already on the form — filtered out of the pool to avoid duplicates. */
  assignedIds: string[];
  /** Modal title (i18n key). */
  title: string;
  /** Shown when the pool comes back empty (i18n key). */
  emptyKey: string;
}

export interface PickAssignedProductsResult {
  added: AssignableProduct[];
}

const PAGE_SIZE = 20;

/**
 * Product picker for "assign products to X" forms (Brands, Categories).
 *
 * The caller supplies the loader because each owner has its own pool endpoint —
 * and crucially those endpoints return only *unassigned* products. A product
 * belongs to at most one brand and one category, so listing everything (as the
 * generic product picker does) would let the user silently reassign a product
 * that already belongs elsewhere.
 */
@Component({
  selector: 'app-pick-assigned-products-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    EntityThumbComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pick-assigned-products-modal.component.html',
  styleUrl: './pick-assigned-products-modal.component.scss',
})
export class PickAssignedProductsModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private modalRef = inject<ModalRef<PickAssignedProductsResult>>(MODAL_REF);
  data = inject<PickAssignedProductsData>(MODAL_DATA);

  rows = signal<AssignableProduct[]>([]);
  loading = signal(false);
  search = signal('');
  private page = signal(1);
  private hasMore = signal(false);

  private selected = signal<Map<string, AssignableProduct>>(new Map());
  readonly selectedCount = computed(() => this.selected().size);

  private readonly assigned = new Set(this.data.assignedIds ?? []);

  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private observer?: IntersectionObserver;
  private debounce?: ReturnType<typeof setTimeout>;

  ngOnInit(): void { void this.load(1); }

  ngAfterViewInit(): void {
    const sentinel = this.scrollSentinel();
    if (!sentinel) return;
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && this.hasMore() && !this.loading()) {
        void this.load(this.page() + 1);
      }
    });
    this.observer.observe(sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    clearTimeout(this.debounce);
  }

  onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.load(1), 300);
  }

  isPicked(id: string): boolean { return this.selected().has(id); }

  toggle(row: AssignableProduct): void {
    this.selected.update((m) => {
      const next = new Map(m);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });
  }

  apply(): void { this.modalRef.close({ added: [...this.selected().values()] }); }
  cancel(): void { this.modalRef.close(undefined); }

  private async load(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.data.load({ page, limit: PAGE_SIZE, searchTerm: this.search().trim() });
      const fresh = res.list.filter((p) => !this.assigned.has(p.id));
      this.rows.set(page === 1 ? fresh : [...this.rows(), ...fresh]);
      this.page.set(page);
      this.hasMore.set(page < res.pageCount);
    } finally {
      this.loading.set(false);
    }
  }
}
