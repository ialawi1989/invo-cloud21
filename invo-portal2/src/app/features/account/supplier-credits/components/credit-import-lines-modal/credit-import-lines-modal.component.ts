import '../../../account-i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import type { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';

import { SupplierCreditLine } from '../../../models/supplier-credit.model';

export interface CreditImportLinesData {
  /** The bill's lines as credit lines (already carrying the quantity still creditable in `maxQty`). */
  lines: SupplierCreditLine[];
  /** True for a bill line the credit already holds. */
  taken: (line: SupplierCreditLine) => boolean;
}

/**
 * "Import from bill" of an edited supplier credit (legacy `import-lines-from-bill`): the bill's lines with the quantity
 * that may still be credited; lines already on the credit, or with nothing left to credit, are shown ticked and locked.
 * Closes with the lines the user ticked.
 */
@Component({
  selector: 'app-credit-import-lines-modal',
  standalone: true,
  imports: [TranslateModule, MycurrencyPipe, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="'SUPPLIER_CREDITS.FORM.IMPORT_FROM_BILL' | translate"/>
    <div class="cil">
      <ul class="cil__list">
        @for (l of data.lines; track $index) {
          <li class="cil__row" [class.cil__row--off]="locked(l)" (click)="toggle(l)">
            <input type="checkbox" [checked]="locked(l) || picked().has(l)" [disabled]="locked(l)" (click)="$event.stopPropagation()" (change)="toggle(l)"/>
            <div class="cil__name">
              <strong>{{ nameOf(l) }}</strong>
              @if (l.note && l.selectedItem.name) { <small>{{ l.note }}</small> }
            </div>
            <span class="cil__num">{{ 'SUPPLIER_CREDITS.FORM.MAX_QTY' | translate }}: {{ l.maxQty }}</span>
            <span class="cil__num">{{ l.unitCost | mycurrency }}</span>
          </li>
        } @empty {
          <li class="cil__empty">{{ 'SUPPLIER_CREDITS.FORM.NO_BILL_LINES' | translate }}</li>
        }
      </ul>
    </div>
    <app-modal-footer>
      <button type="button" class="cil__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="cil__btn cil__btn--primary" [disabled]="!count()" (click)="ref.close(chosen())">
        {{ 'SUPPLIER_CREDITS.FORM.IMPORT' | translate }} ({{ count() }})
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .cil { padding: 16px 20px; min-width: min(640px, 92vw); }
    .cil__list { list-style: none; margin: 0; padding: 0; max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
    .cil__row { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .cil__row:hover:not(.cil__row--off) { background: #f1f5f9; }
    .cil__row--off { opacity: .5; cursor: not-allowed; }
    .cil__name { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .cil__name small { color: #64748b; }
    .cil__num { color: #475569; font-size: 13px; white-space: nowrap; }
    .cil__empty { padding: 18px; text-align: center; color: #94a3b8; }
    .cil__btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .cil__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
    .cil__btn:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class CreditImportLinesModalComponent {
  readonly data = inject<CreditImportLinesData>(MODAL_DATA);
  readonly ref = inject<ModalRef<SupplierCreditLine[] | null>>(MODAL_REF);

  readonly picked = signal<Set<SupplierCreditLine>>(new Set());
  readonly count = computed(() => this.picked().size);

  nameOf = (l: SupplierCreditLine) => l.selectedItem.name || l.note || '';
  locked = (l: SupplierCreditLine) => this.data.taken(l) || !(l.maxQty > 0);
  chosen = () => [...this.picked()];

  toggle(l: SupplierCreditLine): void {
    if (this.locked(l)) return;
    this.picked.update(s => { const n = new Set(s); n.has(l) ? n.delete(l) : n.add(l); return n; });
  }
}
