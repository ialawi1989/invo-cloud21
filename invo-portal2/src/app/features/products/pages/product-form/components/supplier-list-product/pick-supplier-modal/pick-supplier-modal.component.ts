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
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import { SupplierService, SupplierMini } from '../../../../../../suppliers';

export interface PickSupplierModalData {
  /** Supplier ids already attached to the product — hidden from the picker. */
  excludedIds?: string[];
}

/**
 * pick-supplier-modal
 * ───────────────────
 * Multi-select supplier picker. Opens over the product form via ModalService;
 * closes with `SupplierMini[]` (selected rows) or `undefined` on dismiss.
 * Server-side paginated search; infinite scroll via IntersectionObserver.
 */
@Component({
  selector: 'app-pf-pick-supplier-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent],
  templateUrl: './pick-supplier-modal.component.html',
  styleUrl: './pick-supplier-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickSupplierModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private supplierSvc = inject(SupplierService);
  private modalRef    = inject<ModalRef<SupplierMini[]>>(MODAL_REF);
  data                = inject<PickSupplierModalData>(MODAL_DATA) ?? {};

  search    = signal('');
  loading   = signal(false);
  page      = signal(1);
  hasMore   = signal(false);
  rows      = signal<SupplierMini[]>([]);
  selected  = signal<Set<string>>(new Set());
  private searchDebounce?: ReturnType<typeof setTimeout>;

  /** Sentinel at the bottom of the list; observed to trigger next-page load. */
  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private scrollObserver?: IntersectionObserver;

  excluded = computed<Set<string>>(() => new Set(this.data.excludedIds ?? []));

  visibleRows = computed<SupplierMini[]>(() =>
    this.rows().filter((r) => !this.excluded().has(r.id)),
  );

  selectedCount = computed(() => this.selected().size);

  ngOnInit(): void {
    this.loadPage(1);
  }

  ngAfterViewInit(): void {
    const el = this.scrollSentinel()?.nativeElement;
    if (!el) return;
    // IntersectionObserver is cheap and avoids the scroll-event throttling dance.
    // When the sentinel enters the scroll viewport and another page is available,
    // kick off the next load.
    this.scrollObserver = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) this.loadMore();
    }, { root: el.closest('.psm-list') as Element | null, rootMargin: '120px' });
    this.scrollObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
    clearTimeout(this.searchDebounce);
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.loadPage(1), 300);
  }

  async loadPage(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.supplierSvc.getMiniListPage({
        page,
        limit: 20,
        search: this.search().trim() || undefined,
      });
      if (page === 1) this.rows.set(res.items);
      else this.rows.update((prev) => [...prev, ...res.items]);
      this.hasMore.set(res.hasMore);
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
