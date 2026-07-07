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

import { withTranslations } from '@core/i18n/with-translations';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import { MatrixItemService } from '../../services/matrix-item.service';
import { Dimension, DimensionListRow } from '../../services/matrix-item.types';

export interface PickDimensionModalData {
  selectedIds: string[];
}

/**
 * Pick-dimension modal
 * ────────────────────
 * Multi-select over the saved dimension catalog (search + infinite scroll).
 * Rows already on the matrix (`selectedIds`) are shown disabled so the user
 * sees what's taken. On confirm, every newly-checked dimension is loaded in
 * full and the array is returned for the caller to merge; `null` on cancel.
 */
@Component({
  selector: 'app-pick-dimension-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pick-dimension-modal.component.html',
  styleUrl: './pick-dimension-modal.component.scss',
})
export class PickDimensionModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private service = inject(MatrixItemService);
  private modalRef = inject<ModalRef<Dimension[] | null>>(MODAL_REF);
  private data = inject<PickDimensionModalData>(MODAL_DATA) ?? { selectedIds: [] };

  /** Ids already on the matrix — rendered disabled, never returned. */
  private readonly takenIds = new Set(this.data.selectedIds ?? []);

  search = signal<string>('');
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  private page = signal<number>(1);
  hasMore = signal<boolean>(false);
  rows = signal<DimensionListRow[]>([]);

  /** Newly-checked ids (never contains taken ids). */
  private picked = signal<Set<string>>(new Set());

  readonly pickedCount = computed<number>(() => this.picked().size);

  /** Rows the user is allowed to toggle (not already on the matrix). */
  private selectableRows = computed(() =>
    this.rows().filter((r) => !this.takenIds.has(r.id)),
  );

  readonly allSelected = computed<boolean>(() => {
    const selectable = this.selectableRows();
    return selectable.length > 0 && selectable.every((r) => this.picked().has(r.id));
  });

  private readonly limit = 20;
  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private scrollObserver?: IntersectionObserver;
  private debounce?: ReturnType<typeof setTimeout>;

  isTaken(id: string): boolean {
    return this.takenIds.has(id);
  }
  isPicked(id: string): boolean {
    return this.picked().has(id);
  }

  constructor() {
    withTranslations('products/matrix-item');
  }

  ngOnInit(): void {
    void this.loadPage(1);
  }

  ngAfterViewInit(): void {
    const sentinel = this.scrollSentinel();
    if (!sentinel) return;
    this.scrollObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && this.hasMore() && !this.loading()) {
        void this.loadPage(this.page() + 1);
      }
    });
    this.scrollObserver.observe(sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
    clearTimeout(this.debounce);
  }

  // ── Selection ─────────────────────────────────────────────────────
  toggle(row: DimensionListRow): void {
    if (this.isTaken(row.id)) return;
    const next = new Set(this.picked());
    if (next.has(row.id)) next.delete(row.id);
    else next.add(row.id);
    this.picked.set(next);
  }

  toggleSelectAll(): void {
    const next = new Set(this.picked());
    if (this.allSelected()) {
      for (const r of this.selectableRows()) next.delete(r.id);
    } else {
      for (const r of this.selectableRows()) next.add(r.id);
    }
    this.picked.set(next);
  }

  onSearchInput(v: string): void {
    this.search.set(v);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.loadPage(1), 300);
  }

  // ── Loading ───────────────────────────────────────────────────────
  private async loadPage(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.service.getDimensionList({
        page,
        limit: this.limit,
        searchTerm: this.search().trim(),
      });
      this.page.set(page);
      this.rows.set(page === 1 ? res.list : [...this.rows(), ...res.list]);
      this.hasMore.set(page * this.limit < res.count);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Close ─────────────────────────────────────────────────────────
  async confirm(): Promise<void> {
    const ids = [...this.picked()];
    if (ids.length === 0) {
      this.modalRef.close([]);
      return;
    }
    this.saving.set(true);
    try {
      const loaded = await Promise.all(ids.map((id) => this.service.getDimension(id)));
      const out = loaded.filter((d): d is Dimension => !!d);
      out.forEach((d) => (d.isNew = false));
      this.modalRef.close(out);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.modalRef.close(null);
  }
}
