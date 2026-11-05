import '../../../account-i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

import { SupplierCreditLine } from '../../../models/supplier-credit.model';

export interface CreditReturnData { line: SupplierCreditLine; }

/**
 * Which serial numbers / batches of a bill line go back to the supplier (legacy `SerializeReturnComponent` /
 * `BatchReturnComponent`): tick the serials to return, or tick a batch and set the quantity (never above what
 * that batch holds). The line's quantity follows from what is ticked.
 */
@Component({
  selector: 'app-credit-return-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="(serial ? 'SUPPLIER_CREDITS.RETURN.SERIALS_TITLE' : 'SUPPLIER_CREDITS.RETURN.BATCHES_TITLE') | translate"/>
    <div class="cr">
      <p class="cr__item">{{ data.line.selectedItem?.name }}</p>
      <input class="cr__input cr__search" type="text" [ngModel]="term()" (ngModelChange)="term.set($event)" [placeholder]="'COMMON.SEARCH' | translate"/>
      <div class="cr__scroll">
        <table class="cr__table">
          <thead>
            <tr>
              <th></th>
              <th>{{ (serial ? 'SUPPLIER_CREDITS.RETURN.SERIAL' : 'SUPPLIER_CREDITS.RETURN.BATCH') | translate }}</th>
              @if (!serial) { <th>{{ 'SUPPLIER_CREDITS.RETURN.AVAILABLE' | translate }}</th><th>{{ 'SUPPLIER_CREDITS.RETURN.RETURN_QTY' | translate }}</th> }
            </tr>
          </thead>
          <tbody>
            @for (r of visible(); track r) {
              <tr>
                <td><input type="checkbox" [checked]="r.return" (change)="toggle(r, $any($event.target).checked)"/></td>
                <td>{{ serial ? r.serial : r.batch }}</td>
                @if (!serial) {
                  <td>{{ r.maxQty }}</td>
                  <td><input class="cr__input cr__num" type="number" min="0" [max]="r.maxQty" [disabled]="!r.return" [ngModel]="r.qty" (ngModelChange)="setQty(r, $event)"/></td>
                }
              </tr>
            } @empty {
              <tr><td [attr.colspan]="serial ? 2 : 4" class="cr__empty">{{ 'SUPPLIER_CREDITS.RETURN.EMPTY' | translate }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      <div class="cr__sum">{{ 'DOC_LINES.COL_QTY' | translate }}: <b>{{ total() }}</b></div>
    </div>
    <app-modal-footer>
      <button type="button" class="cr__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="cr__btn cr__btn--primary" (click)="done()">{{ 'SUPPLIER_CREDITS.RETURN.DONE' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .cr { padding: 16px 20px; min-width: 520px; max-width: 100%; display: flex; flex-direction: column; gap: 12px; }
    .cr__item { margin: 0; font-weight: 600; color: #0f172a; }
    .cr__scroll { max-height: 320px; overflow: auto; border: 1px solid #e5e7eb; border-radius: 10px; }
    .cr__table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .cr__table th { text-align: start; background: #f8fafc; color: #64748b; font-size: 12px; padding: 8px 10px; position: sticky; top: 0; }
    .cr__table td { padding: 6px 10px; border-top: 1px solid #f1f5f9; }
    .cr__empty { text-align: center; color: #94a3b8; padding: 18px; }
    .cr__input { border: 1px solid #d0d5dd; border-radius: 8px; padding: 8px 10px; font: inherit; box-sizing: border-box; }
    .cr__num { width: 110px; }
    .cr__sum { align-self: flex-end; color: #334155; }
    .cr__btn { padding: 9px 18px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .cr__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
  `],
})
export class CreditReturnModalComponent {
  data = inject<CreditReturnData>(MODAL_DATA);
  ref = inject<ModalRef<{ batches: SupplierCreditLine[]; serials: SupplierCreditLine[] } | null>>(MODAL_REF);

  serial = this.data.line.selectedItem?.type === 'serialized';
  term = signal('');
  private tick = signal(0);
  private rows = signal<SupplierCreditLine[]>(this.serial ? [...this.data.line.serials] : [...this.data.line.batches]);

  constructor() {
    // A batch can't give back more than it holds.
    for (const b of this.data.line.batches) if (b.qty > b.maxQty) b.qty = b.maxQty;
  }

  visible = computed(() => {
    const t = this.term().trim().toLowerCase();
    return this.rows().filter(r => !r.isDeleted && (!t || (this.serial ? r.serial : r.batch).toLowerCase().includes(t)));
  });
  total = computed(() => { this.tick(); return this.rows().filter(r => r.return && !r.isDeleted).reduce((s, r) => s + (this.serial ? 1 : r.qty), 0); });

  toggle(r: SupplierCreditLine, on: boolean): void {
    r.return = on;
    if (!this.serial && on && !r.qty) r.qty = r.maxQty;
    this.tick.update(n => n + 1);
  }
  setQty(r: SupplierCreditLine, v: any): void {
    let n = Number(v) || 0;
    if (n > r.maxQty) n = r.maxQty;
    r.qty = n < 0 ? 0 : n;
    this.tick.update(n2 => n2 + 1);
  }

  done(): void {
    const rows = this.rows();
    if (!this.serial) rows.forEach(r => { if (!r.return) r.qty = 0; });
    this.ref.close({ batches: this.serial ? this.data.line.batches : rows, serials: this.serial ? rows : this.data.line.serials });
  }
}
