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

export interface PickedEmployee {
  id:    string;
  name:  string;
  email?: string;
  phone?: string;
}

export interface PickEmployeeModalData {
  /** Ids already in the caller's list — pre-selected on open. The user can
   *  uncheck them to remove from the parent list. */
  excludedIds?: string[];
  /** Optional title override. Defaults to PRODUCTS.FORM.PICK_EMPLOYEES. */
  title?: string;
}

export interface PickEmployeeResult {
  added: PickedEmployee[];
  removed: string[];
}

interface EmployeeRow {
  id:       string;
  name:     string;
  email?:   string;
  phone?:   string;
}

/**
 * pick-employee-modal
 * ───────────────────
 * Paginated employee picker used by the service form's `price-by-team` card.
 * Mirrors `pick-product-modal`'s shape: search, infinite-scroll, multi-select,
 * resolves with the picked rows on close (or undefined on dismiss).
 */
@Component({
  selector: 'app-pf-pick-employee-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent],
  templateUrl: './pick-employee-modal.component.html',
  styleUrl: './pick-employee-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickEmployeeModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private api      = inject(ApiService);
  private modalRef = inject<ModalRef<PickEmployeeResult>>(MODAL_REF);
  data             = inject<PickEmployeeModalData>(MODAL_DATA) ?? {};

  search   = signal<string>('');
  loading  = signal<boolean>(false);
  page     = signal<number>(1);
  hasMore  = signal<boolean>(false);
  rows     = signal<EmployeeRow[]>([]);
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
      const res = await this.api.request<any>(this.api.post('employee/getEmployeeList', {
        page,
        limit: 20,
        searchTerm: this.search().trim(),
      }));
      const list: any[] = res?.data?.list ?? res?.data ?? [];
      const total: number = res?.data?.count ?? list.length;
      const mapped: EmployeeRow[] = list.map((e: any) => {
        const composed = `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim();
        const fallback = composed || (e.email ?? '');
        return {
          id:    e.id ?? e._id ?? '',
          name:  e.name ?? fallback,
          email: e.email,
          phone: e.phone,
        };
      });
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

  toggle(row: EmployeeRow): void {
    this.selected.update((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id);
      else                  next.add(row.id);
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
      .map<PickedEmployee>((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone }));
    const removed = [...this.initialSelected].filter((id) => !current.has(id));
    this.modalRef.close({ added, removed });
  }

  cancel(): void {
    this.modalRef.dismiss();
  }
}
