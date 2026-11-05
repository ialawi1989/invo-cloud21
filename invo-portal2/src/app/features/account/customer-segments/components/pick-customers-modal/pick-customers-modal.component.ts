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

import { CustomersService } from '../../../customers/services/customers.service';

export interface PickedCustomer {
  id: string;
  name: string;
  phone: string;
  saluation: string;
}

export interface PickCustomersModalData {
  /** Customers already in the segment — shown pre-ticked; unticking removes them. */
  selected: Array<Pick<PickedCustomer, 'id' | 'name'> & Partial<PickedCustomer>>;
  title?: string;
}

export interface PickCustomersModalResult {
  /** The full selection the user applied (replaces the caller's list). */
  selected: PickedCustomer[];
}

interface Row extends PickedCustomer {
  picked: boolean;
}

const PAGE_SIZE = 20;

/**
 * Minimal multi-select customer picker (name + phone) — same look and
 * behaviour as the "Pick products" modal: search, Select all, running count,
 * infinite scroll, Cancel / Apply. Selection is kept across searches and pages.
 */
@Component({
  selector: 'app-pick-customers-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pick-customers-modal.component.html',
  styleUrl: './pick-customers-modal.component.scss',
})
export class PickCustomersModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private customers = inject(CustomersService);
  private modalRef = inject<ModalRef<PickCustomersModalResult>>(MODAL_REF);
  data = inject<PickCustomersModalData>(MODAL_DATA) ?? { selected: [] };

  search = signal('');
  loading = signal(false);
  page = signal(1);
  hasMore = signal(false);
  rows = signal<Row[]>([]);

  /** Selection by id, kept across searches/pages; seeded from the caller's list. */
  private selected = signal<Map<string, PickedCustomer>>(new Map(
    this.data.selected.map(c => [c.id, { id: c.id, name: c.name, phone: c.phone ?? '', saluation: c.saluation ?? '' }]),
  ));
  selectedCount = computed(() => this.selected().size);

  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private observer?: IntersectionObserver;
  private debounce?: ReturnType<typeof setTimeout>;
  /** Drops responses of superseded searches. */
  private loadToken = 0;

  ngOnInit(): void { void this.loadPage(1); }

  ngAfterViewInit(): void {
    const el = this.scrollSentinel();
    if (!el) return;
    this.observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && this.hasMore() && !this.loading()) void this.loadPage(this.page() + 1);
    });
    this.observer.observe(el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    clearTimeout(this.debounce);
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      this.rows.set([]);
      void this.loadPage(1);
    }, 300);
  }

  private async loadPage(page: number): Promise<void> {
    const token = ++this.loadToken;
    this.loading.set(true);
    try {
      const res = await this.customers.getCustomerMiniList({
        page, limit: PAGE_SIZE, searchTerm: this.search().trim(),
      });
      if (token !== this.loadToken) return;
      const list: any[] = res?.list ?? [];
      const sel = this.selected();
      const mapped: Row[] = list.map(c => ({
        id: String(c.id), name: c.name ?? '', phone: c.phone ?? '', saluation: c.saluation ?? '',
        picked: sel.has(String(c.id)),
      }));
      this.rows.update(prev => (page === 1 ? mapped : [...prev, ...mapped]));
      this.hasMore.set(list.length >= PAGE_SIZE);
      this.page.set(page);
    } finally {
      if (token === this.loadToken) this.loading.set(false);
    }
  }

  toggle(row: Row): void {
    this.selected.update(prev => {
      const next = new Map(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, { id: row.id, name: row.name, phone: row.phone, saluation: row.saluation });
      return next;
    });
    this.rows.update(rows => rows.map(r => (r.id === row.id ? { ...r, picked: !r.picked } : r)));
  }

  toggleSelectAll(): void {
    const list = this.rows();
    const allOn = list.length > 0 && list.every(r => r.picked);
    this.selected.update(prev => {
      const next = new Map(prev);
      for (const r of list) {
        if (allOn) next.delete(r.id);
        else next.set(r.id, { id: r.id, name: r.name, phone: r.phone, saluation: r.saluation });
      }
      return next;
    });
    this.rows.update(rows => rows.map(r => ({ ...r, picked: !allOn })));
  }

  apply(): void { this.modalRef.close({ selected: [...this.selected().values()] }); }
  cancel(): void { this.modalRef.dismiss(); }
}
