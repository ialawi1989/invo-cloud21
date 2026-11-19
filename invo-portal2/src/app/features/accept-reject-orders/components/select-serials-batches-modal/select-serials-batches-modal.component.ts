import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import { LinePick, OnlineOrderLine, OnlineOrderRow } from '../../models/accept-reject-orders.model';

export interface SelectSerialsBatchesData {
  order: OnlineOrderRow;
}

/**
 * Legacy `SelectSerialsBatchesComponent`: before an order with serialized / batch products can be accepted the user
 * picks one serial (serialized) or one batch (batch) per line. Closes with the `lines` payload of `updateInvoiceStatus`.
 */
@Component({
  selector: 'app-select-serials-batches-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, SearchDropdownComponent, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="'ACCEPT_REJECT_ORDERS.SELECT_TITLE' | translate" [subtitle]="'ACCEPT_REJECT_ORDERS.SELECT_HINT' | translate" />

    <div class="body">
      <table class="tbl">
        <thead>
          <tr>
            <th>{{ 'ACCEPT_REJECT_ORDERS.PRODUCT' | translate }}</th>
            <th>{{ 'ACCEPT_REJECT_ORDERS.TYPE' | translate }}</th>
            <th class="sel">{{ 'ACCEPT_REJECT_ORDERS.SELECTION' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (line of lines(); track line.lineId) {
            <tr>
              <td>{{ line.name }}</td>
              <td>{{ (line.productType === 'serialized' ? 'ACCEPT_REJECT_ORDERS.SERIALIZED' : 'ACCEPT_REJECT_ORDERS.BATCH') | translate }}</td>
              <td class="sel">
                @if (line.productType === 'serialized') {
                  <app-search-dropdown [items]="line.serials" [clearable]="false"
                    [placeholder]="'ACCEPT_REJECT_ORDERS.SELECT_SERIAL' | translate"
                    [ngModel]="line.serial" (ngModelChange)="pick(line, 'serial', $event)" />
                } @else {
                  <app-search-dropdown [items]="line.batches" [clearable]="false"
                    [placeholder]="'ACCEPT_REJECT_ORDERS.SELECT_BATCH' | translate"
                    [ngModel]="line.batch" (ngModelChange)="pick(line, 'batch', $event)" />
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <app-modal-footer>
      <button type="button" class="btn-cancel" (click)="ref.dismiss()">{{ 'ACCEPT_REJECT_ORDERS.CANCEL' | translate }}</button>
      <button type="button" class="btn-confirm" [disabled]="!ready()" (click)="done()">{{ 'ACCEPT_REJECT_ORDERS.ACCEPT' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .body { padding: 8px 24px 20px; min-width: 520px; }
    .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
    .tbl th { text-align: start; font-weight: 600; color: var(--ui-text-4); padding: 8px 6px; border-bottom: 1px solid var(--ui-line); }
    .tbl td { padding: 8px 6px; border-bottom: 1px solid var(--ui-surface-2); vertical-align: middle; }
    .sel { width: 45%; }
    .btn-cancel { padding: 9px 20px; background: var(--ui-surface-2); border: 1px solid var(--ui-line); border-radius: 8px; font-size: 13px; cursor: pointer; }
    .btn-confirm { padding: 9px 24px; background: var(--ui-b-32acc1); color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-confirm:disabled { opacity: .5; cursor: not-allowed; }
    @media (max-width: 640px) { .body { min-width: 0; } }
  `],
})
export class SelectSerialsBatchesModalComponent {
  private data = inject<SelectSerialsBatchesData>(MODAL_DATA);
  ref = inject<ModalRef<LinePick[]>>(MODAL_REF);

  /** Working copy: the row's own lines are never mutated by a dismissed dialog. */
  readonly lines = signal<OnlineOrderLine[]>(this.data.order.lines.map(l => ({ ...l })));

  /** Legacy `disableAccept`: every serialized line needs a serial and every batch line a batch. */
  readonly ready = computed(() => this.lines().every(l => (l.productType === 'serialized' ? !!l.serial : l.productType === 'batch' ? !!l.batch : true)));

  pick(line: OnlineOrderLine, field: 'serial' | 'batch', value: unknown): void {
    this.lines.update(ls => ls.map(l => (l.lineId === line.lineId ? { ...l, [field]: typeof value === 'string' ? value : '' } : l)));
  }

  done(): void {
    if (!this.ready()) return;
    // Legacy payload: `{ lineId, serial }` for serialized lines, `{ lineId, batch }` for every other.
    this.ref.close(this.lines().map((l): LinePick => (l.productType === 'serialized' ? { lineId: l.lineId, serial: l.serial } : { lineId: l.lineId, batch: l.batch })));
  }
}
