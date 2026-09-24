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

export interface ApplyCreditData {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  /** Amount still owed on the invoice. */
  balance: number;
}

interface AppliedCredit {
  id: string;
  invoiceId: string;
  code: string;
  credit: number;
  reference: string;
  amount: number;
  maxAmount: number;
}

/**
 * Apply a customer's unused credit notes to an invoice (legacy `ApplyInvoiceCreditComponent`).
 * Closes with `true` once `accounts/applyCredit` succeeded so the caller reloads the invoice.
 */
@Component({
  selector: 'app-apply-credit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="('INVOICES.CREDIT.APPLY_CREDITS_FOR' | translate) + ' (' + data.invoiceNumber + ')'"/>
    <div class="ac__body">
      <div class="ac__balance"><b>{{ 'INVOICES.CREDIT.INVOICE_BALANCE' | translate }}:</b> {{ data.balance | mycurrency }}</div>

      <table class="ac__table">
        <thead>
          <tr>
            <th>{{ 'INVOICES.CREDIT.CREDIT_NOTE_NUMBER' | translate }}</th>
            <th>{{ 'INVOICES.CREDIT.CREDIT_NOTE_BALANCE' | translate }}</th>
            <th>{{ 'INVOICES.CREDIT.AMOUNT_TO_CREDIT' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (c of credits(); track c.id) {
            <tr>
              <td>{{ c.code }}</td>
              <td>{{ c.credit | mycurrency }}</td>
              <td><input class="ac__input" type="number" min="0" [max]="c.credit" [ngModel]="c.amount" (ngModelChange)="onAmount(c, $event)"/></td>
            </tr>
          } @empty {
            <tr><td colspan="3" class="ac__empty">{{ 'INVOICES.CREDIT.NO_CREDITS' | translate }}</td></tr>
          }
        </tbody>
      </table>

      <div class="ac__totals">
        <div><span>{{ 'INVOICES.CREDIT.AMOUNT_TO_CREDIT' | translate }}</span><b>{{ total() | mycurrency }}</b></div>
        <div><span>{{ 'INVOICES.CREDIT.INVOICE_BALANCE_DUE' | translate }}</span><b>{{ balanceDue() | mycurrency }}</b></div>
      </div>
    </div>
    <app-modal-footer>
      <button type="button" class="ac__btn" (click)="ref.close(false)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="ac__btn ac__btn--primary" [disabled]="saving() || total() <= 0" (click)="apply()">{{ 'INVOICES.CREDIT.APPLY_CREDITS' | translate }}</button>
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
export class ApplyCreditModalComponent implements OnInit {
  data = inject<ApplyCreditData>(MODAL_DATA);
  ref = inject<ModalRef<boolean>>(MODAL_REF);
  private customers = inject(CustomersService);
  private toast = inject(ToastService);

  credits = signal<AppliedCredit[]>([]);
  saving = signal(false);

  total = computed(() => this.credits().reduce((s, c) => s + (Number(c.amount) || 0), 0));
  balanceDue = computed(() => MathUtils.sub(this.data.balance, this.total()));

  async ngOnInit(): Promise<void> {
    const list: any[] = (await this.customers.getCustomerCreditsList(this.data.customerId)) ?? [];
    this.credits.set(list.map(c => ({
      id: c.id,
      invoiceId: this.data.invoiceId,
      code: c.code,
      credit: c.credit,
      reference: c.reference,
      amount: 0,
      maxAmount: this.data.balance,
    })));
  }

  /** Legacy caps: never above the invoice balance left by the other rows, nor above the credit itself. */
  onAmount(credit: AppliedCredit, raw: any): void {
    let amount = Number(raw) || 0;
    const others = this.credits().filter(c => c !== credit).reduce((s, c) => s + (Number(c.amount) || 0), 0);
    credit.maxAmount = Math.max(0, this.data.balance - others);
    if (others + amount > this.data.balance) amount = Math.max(0, MathUtils.sub(this.data.balance, others));
    if (amount > credit.credit) amount = credit.credit;
    credit.amount = amount;
    this.credits.update(l => [...l]);
  }

  async apply(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const res: any = await this.customers.applyCredit(this.credits());
      if (res?.success) this.ref.close(true);
      else this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.saving.set(false);
    }
  }
}
