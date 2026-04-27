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

import { ApiService } from '@core/http/api.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

export interface PickedOption {
  id:   string;
  name: string;
  qty?: number;
}

export interface PickOptionModalData {
  /** Ids already in the caller's list — pre-selected on open. */
  excludedIds?: string[];
  /** Translation key for the header title. */
  title?: string;
}

export interface PickOptionResult {
  added:   PickedOption[];
  removed: string[];
}

interface OptionRow {
  id:   string;
  name: string;
  qty:  number;
}

/**
 * pick-option-modal
 * ─────────────────
 * Paginated picker for menu options. Fed by `product/getOptionsList`. Same
 * pre-select / reconcile contract as `pick-product-modal`: callers pass
 * existing ids as `excludedIds`; the modal returns `{ added, removed }`.
 */
@Component({
  selector: 'app-pf-pick-option-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent],
  templateUrl: './pick-option-modal.component.html',
  styleUrl: './pick-option-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickOptionModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private api      = inject(ApiService);
  private modalRef = inject<ModalRef<PickOptionResult>>(MODAL_REF);
  data             = inject<PickOptionModalData>(MODAL_DATA) ?? {};

  search   = signal<string>('');
  loading  = signal<boolean>(false);
  page     = signal<number>(1);
  hasMore  = signal<boolean>(false);
  rows     = signal<OptionRow[]>([]);
  selected = signal<Set<string>>(new Set());
  private initialSelected: Set<string> = new Set();
  private debounce?: ReturnType<typeof setTimeout>;

  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private scrollObserver?: IntersectionObserver;

  selectedCount = computed(() => this.selected().size);

  ngOnInit(): void {
    const ids = this.data.excludedIds ?? [];
    this.initialSelected = new Set(ids);
    this.selected.set(new Set(ids));
    this.loadPage(1);
  }

  ngAfterViewInit(): void {
    const el = this.scrollSentinel()?.nativeElement;
    if (!el) return;
    this.scrollObserver = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) this.loadMore();
    }, { root: el.closest('.ppm-list') as Element | null, rootMargin: '120px' });
    this.scrollObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
    clearTimeout(this.debounce);
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.loadPage(1), 300);
  }

  async loadPage(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.request<any>(this.api.post('product/getOptionsList', {
        page,
        limit: 20,
        searchTerm: this.search().trim(),
      }));
      const list: any[] = res?.data?.list ?? res?.data ?? [];
      const total: number = res?.data?.count ?? list.length;
      const mapped: OptionRow[] = list.map((o: any) => ({
        id:   o.id ?? o._id ?? '',
        name: o.name ?? '',
        qty:  Number(o.qty ?? 1),
      }));
      if (page === 1) this.rows.set(mapped);
      else this.rows.update((prev) => [...prev, ...mapped]);
      this.hasMore.set(page * 20 < total);
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
      else              next.add(id);
      return next;
    });
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  confirm(): void {
    const current = this.selected();
    const added = this.rows()
      .filter((r) => current.has(r.id) && !this.initialSelected.has(r.id))
      .map<PickedOption>((r) => ({ id: r.id, name: r.name, qty: r.qty }));
    const removed = [...this.initialSelected].filter((id) => !current.has(id));
    this.modalRef.close({ added, removed });
  }

  cancel(): void {
    this.modalRef.dismiss();
  }
}
