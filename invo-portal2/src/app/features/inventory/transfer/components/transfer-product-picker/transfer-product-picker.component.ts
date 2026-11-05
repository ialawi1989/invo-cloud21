import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import '../../transfer-i18n';
import { TransferProduct } from '../../models/inventory-transfer.model';
import { InventoryTransferService } from '../../services/inventory-transfer.service';

/** What the picker hands back: every ticked id, plus the product rows it loaded (an id of an already-added line may have no row). */
export interface TransferProductPickerResult { ids: string[]; products: TransferProduct[]; }

export interface TransferProductPickerData {
  branchId: string;
  /** Product ids already on the transfer - ticked on open. */
  selectedIds: string[];
  /** A transfer out can't take a product the branch has none of. */
  isTransferOut: boolean;
}

const PAGE_SIZE = 30;

/**
 * Product picker of the transfer form (legacy `pick-product-inventory-transfer-modal`): the branch's inventory, kit,
 * batch and serialized products with their on-hand, searchable and paged, ticked in bulk. Closes with the ticked
 * products; the form keeps the lines it already has and adds / drops the difference.
 */
@Component({
  selector: 'app-transfer-product-picker',
  standalone: true,
  imports: [TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'INVENTORY_TRANSFER.PICK_PRODUCTS' | translate"/>
    <div class="tpp">
      <input class="tpp__search" type="text" [value]="term()" (input)="onSearch($any($event.target).value)"
        [placeholder]="'INVENTORY_TRANSFER.SEARCH_PRODUCTS' | translate" autocomplete="off"/>
      <ul class="tpp__list" (scroll)="onScroll($event)">
        @for (p of rows(); track p.id) {
          <li class="tpp__item" [class.tpp__item--off]="isDisabled(p)" (click)="toggle(p)">
            <input type="checkbox" [checked]="picked().has(p.id)" [disabled]="isDisabled(p)" (click)="$event.stopPropagation()" (change)="toggle(p)"/>
            <div class="tpp__name">
              <strong>{{ p.name }}</strong>
              <small>{{ p.barcode }}@if (p.UOM) { · {{ p.UOM }} }</small>
            </div>
            <span class="tpp__hand" [class.tpp__hand--none]="p.onHand <= 0">{{ p.onHand }}</span>
          </li>
        } @empty {
          @if (!loading()) { <li class="tpp__empty">{{ 'INVENTORY_TRANSFER.NO_PRODUCTS' | translate }}</li> }
        }
        @if (loading()) { <li class="tpp__empty">…</li> }
      </ul>
    </div>
    <app-modal-footer>
      <button type="button" class="tpp__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="tpp__btn tpp__btn--primary" (click)="apply()">
        {{ 'INVENTORY_TRANSFER.ADD_SELECTED' | translate }} ({{ picked().size }})
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .tpp { padding: 16px 20px; min-width: min(560px, 92vw); display: flex; flex-direction: column; gap: 10px; }
    .tpp__search { height: 38px; padding: 0 12px; border: 1px solid #d0d5dd; border-radius: 8px; font: inherit; font-size: 14px; outline: none; }
    .tpp__search:focus { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.12); }
    .tpp__list { list-style: none; margin: 0; padding: 0; max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
    .tpp__item { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .tpp__item:hover:not(.tpp__item--off) { background: #f1f5f9; }
    .tpp__item--off { opacity: .45; cursor: not-allowed; }
    .tpp__name { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .tpp__name small { color: #64748b; }
    .tpp__hand { font-weight: 600; color: #0f172a; min-width: 48px; text-align: end; }
    .tpp__hand--none { color: #dc2626; }
    .tpp__empty { padding: 18px; text-align: center; color: #94a3b8; }
    .tpp__btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .tpp__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
  `],
})
export class TransferProductPickerComponent implements OnInit, OnDestroy {
  readonly data = inject<TransferProductPickerData>(MODAL_DATA);
  readonly ref = inject<ModalRef<TransferProductPickerResult | null>>(MODAL_REF);
  private service = inject(InventoryTransferService);

  readonly term = signal('');
  readonly rows = signal<TransferProduct[]>([]);
  readonly loading = signal(false);
  readonly picked = signal<Set<string>>(new Set(this.data.selectedIds));
  /** Every product seen so far, so a ticked product survives a new search. */
  private seen = new Map<string, TransferProduct>();
  private page = 1;
  private total = 0;
  private timer: any;
  private run = 0;

  readonly hasMore = computed(() => this.rows().length < this.total);

  ngOnInit(): void { void this.load(true); }
  ngOnDestroy(): void { clearTimeout(this.timer); }

  isDisabled = (p: TransferProduct) => this.data.isTransferOut && p.onHand <= 0 && !this.data.selectedIds.includes(p.id);

  onSearch(v: string): void {
    this.term.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.load(true), 400);
  }

  onScroll(e: Event): void {
    const el = e.target as HTMLElement;
    if (!this.loading() && this.hasMore() && el.scrollTop + el.clientHeight >= el.scrollHeight - 40) void this.load(false);
  }

  private async load(reset: boolean): Promise<void> {
    const run = ++this.run;
    if (reset) { this.page = 1; this.rows.set([]); } else this.page++;
    this.loading.set(true);
    try {
      const res = await this.service.getBranchProducts({ branchId: this.data.branchId, page: this.page, limit: PAGE_SIZE, searchTerm: this.term() });
      if (run !== this.run) return;
      res.list.forEach(p => this.seen.set(p.id, p));
      this.total = res.count;
      this.rows.update(r => [...r, ...res.list]);
    } finally {
      if (run === this.run) this.loading.set(false);
    }
  }

  toggle(p: TransferProduct): void {
    if (this.isDisabled(p)) return;
    this.picked.update(s => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; });
  }

  apply(): void {
    const ids = [...this.picked()];
    this.ref.close({ ids, products: ids.map(id => this.seen.get(id)).filter((p): p is TransferProduct => !!p) });
  }
}
