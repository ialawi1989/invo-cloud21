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
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { EntityThumbComponent } from '@shared/components/entity-thumb/entity-thumb.component';

import { OptionService } from '../../../../services/option.service';

export interface PickedOption {
  id: string;
  name: string;
  displayName?: string;
  price: number;
  thumbnailUrl?: string | null;
}

export interface OptionPickerModalData {
  /** Ids already in the caller's list — pre-selected on open. */
  excludedIds?: string[];
  /** Modal title override. */
  title?: string;
}

export interface OptionPickerResult {
  /** Newly picked options (not in `excludedIds` at open time). */
  added: PickedOption[];
  /** Ids that were pre-selected and the user unchecked. */
  removed: string[];
}

/**
 * option-picker-modal
 * ───────────────────
 * Paginated, searchable multi-select picker for Options — the modal analogue
 * of the product picker, used by the Option Group form's "Add options" button.
 * Configure via `MODAL_DATA` (excludedIds, title). Returns `{ added, removed }`
 * on confirm, `undefined` on dismiss.
 */
@Component({
  selector: 'app-option-picker-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent, MycurrencyPipe, EntityThumbComponent],
  templateUrl: './option-picker-modal.component.html',
  styleUrl: './option-picker-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionPickerModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private optionService = inject(OptionService);
  private modalRef = inject<ModalRef<OptionPickerResult>>(MODAL_REF);
  data = inject<OptionPickerModalData>(MODAL_DATA) ?? {};

  search   = signal<string>('');
  loading  = signal<boolean>(false);
  page     = signal<number>(1);
  hasMore  = signal<boolean>(false);
  rows     = signal<PickedOption[]>([]);
  selected = signal<Set<string>>(new Set());
  /** Snapshot of `excludedIds` at open — used to compute `removed` on confirm. */
  private initialSelected: Set<string> = new Set();
  /** Full detail of every option seen (across pages) so `added` survives paging. */
  private seen = new Map<string, PickedOption>();
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
      const res = await this.optionService.getList({
        page,
        limit: 20,
        searchTerm: this.search().trim(),
        sortBy: { sortValue: 'name', sortDirection: 'asc' },
      });
      const rows: PickedOption[] = res.list.map((o) => ({
        id: o.id,
        name: o.name,
        displayName: o.displayName,
        price: o.price,
        thumbnailUrl: o.thumbnailUrl,
      }));
      for (const r of rows) this.seen.set(r.id, r);
      if (page === 1) this.rows.set(rows);
      else this.rows.update((prev) => [...prev, ...rows]);
      this.hasMore.set(page < res.pageCount);
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
    const current = this.selected();
    const added: PickedOption[] = [];
    for (const id of current) {
      if (this.initialSelected.has(id)) continue;
      const opt = this.seen.get(id);
      if (opt) added.push(opt);
    }
    const removed = [...this.initialSelected].filter((id) => !current.has(id));
    this.modalRef.close({ added, removed });
  }

  cancel(): void {
    this.modalRef.dismiss();
  }
}
