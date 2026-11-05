import '../../../account-i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';

import { BillLine } from '../../../models/bill.model';

export interface BillSplitData {
  line: BillLine;
}

/** One editable row; `source` is the saved child it came from (kept so its id survives). */
interface Row {
  source: BillLine | null;
  name: string;
  qty: number;
  unitCost: number;
  prodDate: Date;
  expireDate: Date;
  isDeleted: boolean;
  /** Saved batch: what was already sold from it (qty can't go below). */
  sold: number | null;
  /** Saved serial: only an "Available" one can be removed. */
  removable: boolean;
}

const asDate = (v: any) => (v instanceof Date ? v : new Date(v ?? Date.now()));

/**
 * Serial numbers / batches of a stocked bill line (legacy `SerialInsertComponent` / `BatchInsertComponent`
 * with `isBill`): each serial has its own cost, each batch a quantity, cost and production / expiry date.
 * The line's quantity and unit cost follow from them. Saved rows that are removed stay flagged `isDeleted`
 * (the server deletes them); a batch can't drop below what was already sold, a serial that left stock can't
 * be removed.
 */
@Component({
  selector: 'app-bill-split-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe, ModalHeaderComponent, ModalFooterComponent, DatePickerComponent],
  template: `
    <app-modal-header [title]="(serial ? 'BILLS.SPLIT.SERIALS_TITLE' : 'BILLS.SPLIT.BATCHES_TITLE') | translate"/>
    <div class="bs">
      <p class="bs__item">{{ data.line.selectedItem?.name }}</p>
      <div class="bs__add">
        <input class="bs__input" type="text" [(ngModel)]="newName" (keydown.enter)="add()"
          [placeholder]="(serial ? 'BILLS.SPLIT.SERIAL_PLACEHOLDER' : 'BILLS.SPLIT.BATCH_PLACEHOLDER') | translate"/>
        <button type="button" class="bs__btn bs__btn--primary" [disabled]="!canAdd()" (click)="add()">{{ 'BILLS.SPLIT.ADD' | translate }}</button>
      </div>
      @if (duplicate()) { <p class="bs__err">{{ 'BILLS.SPLIT.DUPLICATE' | translate }}</p> }

      <div class="bs__scroll">
        <table class="bs__table">
          <thead>
            <tr>
              <th>{{ (serial ? 'BILLS.SPLIT.SERIAL' : 'BILLS.SPLIT.BATCH') | translate }}</th>
              @if (!serial) { <th>{{ 'DOC_LINES.COL_QTY' | translate }}</th> }
              <th>{{ 'PURCHASE_ORDERS.FORM.UNIT_COST' | translate }}</th>
              @if (!serial) { <th>{{ 'BILLS.SPLIT.PROD_DATE' | translate }}</th><th>{{ 'BILLS.SPLIT.EXPIRE_DATE' | translate }}</th> }
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r) {
              <tr [class.bs__deleted]="r.isDeleted">
                <td>{{ r.name }}</td>
                @if (!serial) {
                  <td>
                    <input class="bs__input bs__num" type="number" min="0" step="any" [disabled]="r.isDeleted" [class.bs__bad]="belowSold(r)"
                      [ngModel]="r.qty" (ngModelChange)="r.qty = +$event || 0; touch()"/>
                    @if (belowSold(r)) { <small class="bs__err">{{ 'BILLS.SPLIT.BELOW_SOLD' | translate: { sold: r.sold } }}</small> }
                  </td>
                }
                <td><input class="bs__input bs__num" type="number" min="0" step="any" [disabled]="r.isDeleted" [ngModel]="r.unitCost" (ngModelChange)="r.unitCost = +$event || 0; touch()"/></td>
                @if (!serial) {
                  <td class="bs__date"><app-date-picker [value]="r.prodDate" (valueChange)="setDate(r, 'prodDate', $event)"/></td>
                  <td class="bs__date"><app-date-picker [value]="r.expireDate" (valueChange)="setDate(r, 'expireDate', $event)"/></td>
                }
                <td class="bs__end">
                  @if (!r.isDeleted) {
                    <button type="button" class="bs__x" [disabled]="!r.removable" (click)="remove(r)" aria-label="remove">✕</button>
                  } @else {
                    <button type="button" class="bs__link" (click)="r.isDeleted = false; touch()">{{ 'BILLS.SPLIT.UNDO' | translate }}</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td [attr.colspan]="serial ? 3 : 6" class="bs__empty">{{ 'BILLS.SPLIT.EMPTY' | translate }}</td></tr>
            }
          </tbody>
        </table>
      </div>

      <div class="bs__sum">
        <span>{{ 'DOC_LINES.COL_QTY' | translate }}: <b>{{ totalQty() }}</b></span>
        <span>{{ 'DOC_LINES.COL_AMOUNT' | translate }}: <b>{{ totalCost() | mycurrency }}</b></span>
      </div>
    </div>
    <app-modal-footer>
      <button type="button" class="bs__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="bs__btn bs__btn--primary" [disabled]="!valid()" (click)="done()">{{ 'BILLS.SPLIT.DONE' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .bs { padding: 16px 20px; min-width: 640px; max-width: 100%; display: flex; flex-direction: column; gap: 12px; }
    .bs__item { margin: 0; font-weight: 600; color: #0f172a; }
    .bs__add { display: flex; gap: 8px; }
    .bs__add .bs__input { flex: 1; }
    .bs__scroll { max-height: 320px; overflow: auto; border: 1px solid #e5e7eb; border-radius: 10px; }
    .bs__table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .bs__table th { text-align: start; background: #f8fafc; color: #64748b; font-size: 12px; padding: 8px 10px; position: sticky; top: 0; }
    .bs__table td { padding: 6px 10px; border-top: 1px solid #f1f5f9; vertical-align: middle; }
    .bs__deleted td { opacity: .5; text-decoration: line-through; }
    .bs__empty { text-align: center; color: #94a3b8; padding: 18px; }
    .bs__input { border: 1px solid #d0d5dd; border-radius: 8px; padding: 8px 10px; font: inherit; min-width: 0; box-sizing: border-box; }
    .bs__num { width: 110px; }
    .bs__bad { border-color: #dc2626; }
    .bs__err { color: #dc2626; font-size: 12px; margin: 0; }
    .bs__date { min-width: 150px; }
    .bs__end { text-align: end; white-space: nowrap; }
    .bs__x { width: 26px; height: 26px; border-radius: 50%; border: 1px solid #fecaca; background: #fff; color: #dc2626; cursor: pointer; }
    .bs__x:disabled { opacity: .35; cursor: not-allowed; }
    .bs__link { border: 0; background: none; color: #227d8d; cursor: pointer; }
    .bs__sum { display: flex; justify-content: flex-end; gap: 24px; color: #334155; }
    .bs__btn { padding: 9px 18px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .bs__btn:disabled { opacity: .5; cursor: not-allowed; }
    .bs__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
  `],
})
export class BillSplitModalComponent {
  data = inject<BillSplitData>(MODAL_DATA);
  ref = inject<ModalRef<{ batches: BillLine[]; serials: BillLine[] } | null>>(MODAL_REF);

  serial = this.data.line.selectedItem?.type === 'serialized';
  newName = '';
  rows = signal<Row[]>(this.initialRows());

  private initialRows(): Row[] {
    const line = this.data.line;
    const src = this.serial ? line.serials : line.batches;
    return src.map(s => ({
      source: s,
      name: this.serial ? s.serial : s.batch,
      qty: s.qty,
      unitCost: s.unitCost,
      prodDate: asDate(s.prodDate),
      expireDate: asDate(s.expireDate),
      isDeleted: s.isDeleted,
      sold: s.batchInfo?.soldTotalQty ?? null,
      removable: this.serial ? (s.serialInfo ? s.serialInfo.status === 'Available' : true) : true,
    }));
  }

  private tick = signal(0);
  touch(): void { this.tick.update(n => n + 1); }

  private live = computed(() => { this.tick(); return this.rows().filter(r => !r.isDeleted); });
  totalQty = computed(() => this.live().reduce((s, r) => s + (this.serial ? 1 : r.qty), 0));
  totalCost = computed(() => this.live().reduce((s, r) => s + (this.serial ? r.unitCost : r.unitCost * r.qty), 0));

  duplicate(): boolean { const n = this.newName.trim().toLowerCase(); return !!n && this.rows().some(r => r.name.toLowerCase() === n); }
  canAdd(): boolean { return !!this.newName.trim() && !this.duplicate(); }
  belowSold(r: Row): boolean { return !this.serial && !r.isDeleted && r.sold != null && r.qty < r.sold; }
  valid = computed(() => { this.tick(); return this.rows().every(r => !this.belowSold(r)); });

  add(): void {
    const name = this.newName.trim();
    if (!name || this.duplicate()) return;
    const expire = new Date();
    expire.setDate(expire.getDate() + 30);
    const cost = this.data.line.productDefaultUnitCost || this.data.line.unitCost || 0;
    this.rows.update(l => [...l, {
      source: null, name, qty: 1, unitCost: this.serial ? cost : 0, prodDate: new Date(), expireDate: expire, isDeleted: false, sold: null, removable: true,
    }]);
    this.newName = '';
  }

  remove(r: Row): void {
    if (!r.removable) return;
    if (!r.source?.id) this.rows.update(l => l.filter(x => x !== r));
    else { r.isDeleted = true; this.touch(); }
  }

  setDate(r: Row, key: 'prodDate' | 'expireDate', v: any): void {
    if (v instanceof Date) { r[key] = v; this.touch(); }
  }

  /** Rebuilds the line's children from the rows; saved ones keep their ids. */
  done(): void {
    const line = this.data.line;
    const build = (r: Row): BillLine => {
      const c = r.source ?? new BillLine();
      if (!r.source) { c.isNew = true; c.productId = line.productId; }
      if (this.serial) { c.serial = r.name; c.qty = 1; } else { c.batch = r.name; c.qty = r.qty; }
      c.unitCost = r.unitCost;
      c.prodDate = r.prodDate;
      c.expireDate = r.expireDate;
      c.isDeleted = r.isDeleted;
      return c;
    };
    const children = this.rows().map(build);
    this.ref.close({ batches: this.serial ? [] : children, serials: this.serial ? children : [] });
  }
}
