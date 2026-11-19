import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import '../../manual-adjustment-i18n';
import { AdjustmentProduct } from '../../models/manual-adjustment.model';
import { ManualAdjustmentService } from '../../services/manual-adjustment.service';

/** What the picker hands back: every ticked id, plus the product rows it loaded. */
export interface AdjustmentPickerResult { ids: string[]; products: AdjustmentProduct[]; }

export interface AdjustmentPickerData {
  branchId: string;
  /** Adjustment date (ISO): the backend reads the on-hand as of this date. */
  date: string;
  /** Product ids already on the adjustment - ticked on open. */
  selectedIds: string[];
}

const PAGE_SIZE = 30;

/**
 * Product picker of the manual adjustment form (legacy `adjust-pick-product-modal`): the branch's inventory products with
 * their on-hand, searchable and paged, ticked in bulk. Closes with the ticked products; the form keeps the lines it
 * already has and adds / drops the difference.
 */
@Component({
  selector: 'app-manual-adjustment-picker',
  standalone: true,
  imports: [TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'MANUAL_ADJUSTMENT.PICK_PRODUCTS' | translate"/>
    <div class="map">
      <input class="map__search" type="text" [value]="term()" (input)="onSearch($any($event.target).value)"
        [placeholder]="'MANUAL_ADJUSTMENT.SEARCH_PRODUCTS' | translate" autocomplete="off"/>
      <ul class="map__list" (scroll)="onScroll($event)">
        @for (p of rows(); track p.id) {
          <li class="map__item" (click)="toggle(p)">
            <input type="checkbox" [checked]="picked().has(p.id)" (click)="$event.stopPropagation()" (change)="toggle(p)"/>
            <div class="map__name">
              <strong>{{ p.name }}</strong>
              <small>{{ p.barcode }}@if (p.UOM) { · {{ p.UOM }} }</small>
            </div>
            <span class="map__hand">{{ p.onHand }}</span>
          </li>
        } @empty {
          @if (!loading()) { <li class="map__empty">{{ 'MANUAL_ADJUSTMENT.NO_PRODUCTS' | translate }}</li> }
        }
        @if (loading()) { <li class="map__empty">…</li> }
      </ul>
    </div>
    <app-modal-footer>
      <button type="button" class="map__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="map__btn map__btn--primary" (click)="apply()">
        {{ 'MANUAL_ADJUSTMENT.ADD_SELECTED' | translate }} ({{ picked().size }})
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .map { padding: 16px 20px; min-width: min(560px, 92vw); display: flex; flex-direction: column; gap: 10px; }
    .map__search { height: 38px; padding: 0 12px; border: 1px solid var(--ui-line-strong); border-radius: 8px; font: inherit; font-size: 14px; outline: none; }
    .map__search:focus { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.12); }
    .map__list { list-style: none; margin: 0; padding: 0; max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
    .map__item { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border: 1px solid var(--ui-line); border-radius: 8px; cursor: pointer; font-size: 14px; }
    .map__item:hover { background: var(--ui-surface-2); }
    .map__name { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .map__name small { color: var(--ui-muted); }
    .map__hand { font-weight: 600; color: var(--ui-text); min-width: 48px; text-align: end; }
    .map__empty { padding: 18px; text-align: center; color: var(--ui-faint); }
    .map__btn { padding: 9px 16px; border-radius: 8px; border: 1px solid var(--ui-line-strong); background: var(--ui-surface); color: var(--ui-text-3); font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .map__btn--primary { border-color: #2691a4; background: var(--ui-b-2691a4); color: #fff; }
  `],
})
export class ManualAdjustmentPickerComponent implements OnInit, OnDestroy {
  readonly data = inject<AdjustmentPickerData>(MODAL_DATA);
  readonly ref = inject<ModalRef<AdjustmentPickerResult | null>>(MODAL_REF);
  private service = inject(ManualAdjustmentService);

  readonly term = signal('');
  readonly rows = signal<AdjustmentProduct[]>([]);
  readonly loading = signal(false);
  readonly picked = signal<Set<string>>(new Set(this.data.selectedIds));
  /** Every product seen so far, so a ticked product survives a new search. */
  private seen = new Map<string, AdjustmentProduct>();
  private page = 1;
  private total = 0;
  private timer: any;
  private run = 0;

  readonly hasMore = computed(() => this.rows().length < this.total);

  ngOnInit(): void { void this.load(true); }
  ngOnDestroy(): void { clearTimeout(this.timer); }

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
      const res = await this.service.getBranchProducts({
        branchId: this.data.branchId, page: this.page, limit: PAGE_SIZE, searchTerm: this.term(), date: this.data.date,
      });
      if (run !== this.run) return;
      res.list.forEach(p => this.seen.set(p.id, p));
      this.total = res.count;
      this.rows.update(r => [...r, ...res.list]);
    } finally {
      if (run === this.run) this.loading.set(false);
    }
  }

  toggle(p: AdjustmentProduct): void {
    this.picked.update(s => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; });
  }

  apply(): void {
    const ids = [...this.picked()];
    this.ref.close({ ids, products: ids.map(id => this.seen.get(id)).filter((p): p is AdjustmentProduct => !!p) });
  }
}
