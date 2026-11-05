import '../../../account-i18n';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { MathUtils } from '@core/math/math-helpers';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { SuppliersService } from '../../../suppliers/services/suppliers.service';

export interface ApplyCreditToBillsData {
  creditId: string;
  creditNumber: string;
  supplierId: string;
  /** What is still unused on the supplier credit. */
  refundDue: number;
}

/** One open bill of the supplier; `id` is the CREDIT id - the shape `accounts/applySupplierCredit` expects. */
interface BillRow {
  billingId: string;
  id: string;
  code: string;
  credit: number;
  reference: string;
  amount: number;
}

/**
 * Apply one supplier credit to the supplier's open bills (legacy `ApplyCreditSupplierComponent`). Closes with
 * `true` once `accounts/applySupplierCredit` succeeded so the caller reloads the credit.
 */
@Component({
  selector: 'app-apply-credit-to-bills-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="('SUPPLIER_CREDITS.APPLY.TITLE' | translate) + ' (' + data.creditNumber + ')'"/>
    <div class="ac__body">
      <div class="ac__balance"><b>{{ 'SUPPLIER_CREDITS.APPLY.CREDIT_BALANCE' | translate }}:</b> {{ data.refundDue | mycurrency }}</div>
      <table class="ac__table">
        <thead>
          <tr>
            <th>{{ 'SUPPLIER_CREDITS.APPLY.BILL_NUMBER' | translate }}</th>
            <th>{{ 'SUPPLIER_CREDITS.APPLY.BILL_BALANCE' | translate }}</th>
            <th>{{ 'SUPPLIER_CREDITS.APPLY.AMOUNT_TO_CREDIT' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.billingId) {
            <tr>
              <td>{{ r.code }}</td>
              <td>{{ r.credit | mycurrency }}</td>
              <td><input class="ac__input" type="number" min="0" [max]="r.credit" [ngModel]="r.amount" (ngModelChange)="onAmount(r, $event)"/></td>
            </tr>
          } @empty {
            <tr><td colspan="3" class="ac__empty">{{ 'SUPPLIER_CREDITS.APPLY.NO_BILLS' | translate }}</td></tr>
          }
        </tbody>
      </table>
      <div class="ac__totals">
        <div><span>{{ 'SUPPLIER_CREDITS.APPLY.AMOUNT_TO_CREDIT' | translate }}</span><b>{{ total() | mycurrency }}</b></div>
        <div><span>{{ 'SUPPLIER_CREDITS.APPLY.BALANCE_DUE' | translate }}</span><b>{{ balanceDue() | mycurrency }}</b></div>
      </div>
    </div>
    <app-modal-footer>
      <button type="button" class="ac__btn" (click)="ref.close(false)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="ac__btn ac__btn--primary" [disabled]="saving() || total() <= 0" (click)="apply()">{{ 'SUPPLIER_CREDITS.APPLY.APPLY' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .ac__body { padding: 16px 20px; min-width: 560px; max-width: 100%; display: flex; flex-direction: column; gap: 14px; }
    .ac__balance { text-align: end; }
    .ac__table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .ac__table th { text-align: start; background: #f8fafc; color: #64748b; font-size: 12px; text-transform: uppercase; padding: 10px 12px; }
    .ac__table td { padding: 8px 12px; border-top: 1px solid #f1f5f9; }
    .ac__empty { text-align: center; color: #94a3b8; padding: 20px; }
    .ac__input { width: 100%; border: 1px solid #d0d5dd; border-radius: 8px; padding: 8px 10px; font: inherit; }
    .ac__totals { align-self: flex-end; min-width: 260px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .ac__totals div { display: flex; justify-content: space-between; gap: 16px; }
    .ac__btn { padding: 9px 18px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .ac__btn:disabled { opacity: .5; cursor: not-allowed; }
    .ac__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
  `],
})
export class ApplyCreditToBillsModalComponent implements OnInit {
  data = inject<ApplyCreditToBillsData>(MODAL_DATA);
  ref = inject<ModalRef<boolean>>(MODAL_REF);
  private suppliers = inject(SuppliersService);
  private toast = inject(ToastService);

  rows = signal<BillRow[]>([]);
  saving = signal(false);

  total = computed(() => this.rows().reduce((s, r) => s + (Number(r.amount) || 0), 0));
  balanceDue = computed(() => MathUtils.sub(this.data.refundDue, this.total()));

  async ngOnInit(): Promise<void> {
    const list: any[] = (await this.suppliers.getApplyCreditSupplierBills(this.data.supplierId)) ?? [];
    this.rows.set(list.map(b => ({
      billingId: b.id, id: this.data.creditId, code: b.code, credit: Number(b.credit) || 0, reference: b.reference, amount: 0,
    })));
  }

  /** Never below zero, never above the bill's own balance. */
  onAmount(row: BillRow, raw: any): void {
    let amount = Number(raw) || 0;
    if (amount < 0) amount = 0;
    if (amount > row.credit) amount = row.credit;
    row.amount = amount;
    this.rows.update(l => [...l]);
  }

  async apply(): Promise<void> {
    if (this.saving()) return;
    if (this.total() > this.data.refundDue) {
      this.toast.error('COMMON.OPS', 'SUPPLIER_CREDITS.APPLY.EXCEEDS');
      return;
    }
    this.saving.set(true);
    try {
      const res: any = await this.suppliers.applySupplierCredit(this.rows());
      if (res?.success) this.ref.close(true);
      else this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.saving.set(false);
    }
  }
}
