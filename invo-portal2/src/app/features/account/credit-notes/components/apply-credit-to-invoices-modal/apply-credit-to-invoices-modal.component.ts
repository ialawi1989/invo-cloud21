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

import { CustomersService } from '../../../customers/services/customers.service';

export interface ApplyCreditToInvoicesData {
  creditNoteId: string;
  creditNoteNumber: string;
  customerId: string;
  /** What is still unused on the credit note. */
  remaining: number;
}

/** One open invoice of the customer; `id` is the CREDIT NOTE id — the shape `accounts/applyCredit` expects. */
interface AppliedRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceBalance: number;
  reference: string;
  amount: number;
}

/**
 * Apply one credit note to the customer's open invoices (legacy `ApplyCreditInvoiceComponent`). Closes with
 * `true` once `accounts/applyCredit` succeeded so the caller reloads the credit note.
 */
@Component({
  selector: 'app-apply-credit-to-invoices-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="('CREDIT_NOTES.APPLY.TITLE' | translate) + ' (' + data.creditNoteNumber + ')'"/>
    <div class="ac__body">
      <div class="ac__balance"><b>{{ 'CREDIT_NOTES.APPLY.CREDIT_NOTE_BALANCE' | translate }}:</b> {{ data.remaining | mycurrency }}</div>

      <table class="ac__table">
        <thead>
          <tr>
            <th>{{ 'CREDIT_NOTES.APPLY.INVOICE_NUMBER' | translate }}</th>
            <th>{{ 'CREDIT_NOTES.APPLY.INVOICE_BALANCE' | translate }}</th>
            <th>{{ 'CREDIT_NOTES.APPLY.AMOUNT_TO_CREDIT' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.invoiceId) {
            <tr>
              <td>{{ r.invoiceNumber }}</td>
              <td>{{ r.invoiceBalance | mycurrency }}</td>
              <td><input class="ac__input" type="number" min="0" [max]="r.invoiceBalance" [ngModel]="r.amount" (ngModelChange)="onAmount(r, $event)"/></td>
            </tr>
          } @empty {
            <tr><td colspan="3" class="ac__empty">{{ 'CREDIT_NOTES.APPLY.NO_INVOICES' | translate }}</td></tr>
          }
        </tbody>
      </table>

      <div class="ac__totals">
        <div><span>{{ 'CREDIT_NOTES.APPLY.AMOUNT_TO_CREDIT' | translate }}</span><b>{{ total() | mycurrency }}</b></div>
        <div><span>{{ 'CREDIT_NOTES.APPLY.BALANCE_DUE' | translate }}</span><b>{{ balanceDue() | mycurrency }}</b></div>
      </div>
    </div>
    <app-modal-footer>
      <button type="button" class="ac__btn" (click)="ref.close(false)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="ac__btn ac__btn--primary" [disabled]="saving() || total() <= 0" (click)="apply()">{{ 'CREDIT_NOTES.APPLY.APPLY' | translate }}</button>
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
export class ApplyCreditToInvoicesModalComponent implements OnInit {
  data = inject<ApplyCreditToInvoicesData>(MODAL_DATA);
  ref = inject<ModalRef<boolean>>(MODAL_REF);
  private customers = inject(CustomersService);
  private toast = inject(ToastService);

  rows = signal<AppliedRow[]>([]);
  saving = signal(false);

  total = computed(() => this.rows().reduce((s, r) => s + (Number(r.amount) || 0), 0));
  balanceDue = computed(() => MathUtils.sub(this.data.remaining, this.total()));

  async ngOnInit(): Promise<void> {
    const list: any[] = (await this.customers.getCustomerApplyCreditInvoices(this.data.customerId)) ?? [];
    this.rows.set(list.map(r => ({
      id: this.data.creditNoteId,
      invoiceId: r.id,
      invoiceNumber: r.invoiceNumber,
      invoiceBalance: r.invoiceBalance,
      reference: r.reference,
      amount: 0,
    })));
  }

  /** Legacy caps: never above what the credit note has left after the other rows, nor above the invoice's balance. */
  onAmount(row: AppliedRow, raw: any): void {
    let amount = Number(raw) || 0;
    const others = this.rows().filter(r => r !== row).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    if (others + amount > this.data.remaining) amount = Math.max(0, MathUtils.sub(this.data.remaining, others));
    if (amount > row.invoiceBalance) amount = row.invoiceBalance;
    row.amount = amount;
    this.rows.update(l => [...l]);
  }

  async apply(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const res: any = await this.customers.applyCredit(this.rows());
      if (res?.success) this.ref.close(true);
      else this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.saving.set(false);
    }
  }
}
