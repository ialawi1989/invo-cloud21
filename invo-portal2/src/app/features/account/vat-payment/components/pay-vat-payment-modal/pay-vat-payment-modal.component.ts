import '../../../account-i18n';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MathUtils } from '@core/math/math-helpers';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { VatPayment, VatPaymentLine } from '../../../models/vat-payment.model';
import { SalesLookupsService } from '../../../services/sales-lookups.service';
import { VatPaymentService } from '../../services/vat-payment.service';

export interface PayVatPaymentData {
  /** The return being paid (must be saved - it needs an id). */
  vatPayment: VatPayment;
  /** Editing an existing payment line instead of making a new one. */
  line?: VatPaymentLine;
  /** What the return still owes, not counting `line` when editing. Defaults to `vatPayment.amountDue`. */
  amountDue?: number;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Pay a VAT return (legacy `PayVatPaymentComponent`): payment method, amount (never above what is due) and
 * date (not before the period ends). Closes with `true` once `accounts/saveVatPaymentLine` succeeded.
 */
@Component({
  selector: 'app-pay-vat-payment-modal',
  standalone: true,
  imports: [FormsModule, TranslateModule, MycurrencyPipe, ModalHeaderComponent, ModalFooterComponent, SearchDropdownComponent, DatePickerComponent],
  template: `
    <app-modal-header [title]="'VAT_PAYMENT.PAY.TITLE' | translate"/>
    <div class="pv">
      <p class="pv__due">{{ 'VAT_PAYMENT.LIST.AMOUNT_DUE' | translate }}: <b>{{ amountDue | mycurrency }}</b></p>

      <div class="pv__field">
        <label>{{ 'VAT_PAYMENT.PAY.PAYMENT_METHOD' | translate }} <span class="req">*</span></label>
        <app-search-dropdown [items]="methods()" [displayWith]="methodLabel" [compareWith]="byId"
          [value]="method()" (valueChange)="method.set($any($event))" [clearable]="false"
          [placeholder]="'VAT_PAYMENT.PAY.SELECT_METHOD' | translate"/>
        @if (showErrors() && !method()) { <p class="pv__error">{{ 'VAT_PAYMENT.PAY.REQUIRED' | translate }}</p> }
      </div>

      <div class="pv__field">
        <label for="vat-pay-amount">{{ 'VAT_PAYMENT.PAY.AMOUNT' | translate }} <span class="req">*</span></label>
        <input id="vat-pay-amount" class="pv__input" type="number" min="0" inputmode="decimal" [max]="amountDue"
          [class.is-invalid]="showErrors() && !(amount() > 0)" [ngModel]="amount()" (ngModelChange)="onAmount($event)"/>
        @if (showErrors() && !(amount() > 0)) { <p class="pv__error">{{ 'VAT_PAYMENT.PAY.AMOUNT_GREATER_THAN_ZERO' | translate }}</p> }
      </div>

      <div class="pv__field">
        <label>{{ 'VAT_PAYMENT.PAY.PAYMENT_DATE' | translate }} <span class="req">*</span></label>
        <app-date-picker [value]="date()" [min]="minDate" (valueChange)="onDate($event)"/>
      </div>

      <div class="pv__field">
        <label for="vat-pay-ref">{{ 'VAT_PAYMENT.PAY.REFERENCE_NUMBER' | translate }}</label>
        <input id="vat-pay-ref" class="pv__input" type="text" [ngModel]="reference()" (ngModelChange)="reference.set($event)"/>
      </div>
    </div>
    <app-modal-footer>
      <button type="button" class="pv__btn" (click)="ref.close(false)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="pv__btn pv__btn--primary" [disabled]="saving()" (click)="pay()">
        {{ (isEdit ? 'COMMON.SAVE' : 'VAT_PAYMENT.PAY.PAY') | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .pv { padding: 16px 20px; min-width: min(460px, 90vw); display: flex; flex-direction: column; gap: 14px; }
    .pv__due { margin: 0; color: #334155; }
    .pv__field { display: flex; flex-direction: column; gap: 6px; }
    .pv__field > label { font-size: 13px; font-weight: 600; color: #334155; }
    .req { color: #dc2626; }
    .pv__input { padding: 9px 12px; border: 1px solid #d0d5dd; border-radius: 8px; font-size: 13.5px; color: #0f172a; font-family: inherit; width: 100%; }
    .pv__input:focus { outline: none; border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38, 145, 164, .12); }
    .pv__input.is-invalid { border-color: #dc2626; }
    .pv__error { margin: 0; font-size: 12px; color: #dc2626; }
    .pv__btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .pv__btn:disabled { opacity: .5; cursor: not-allowed; }
    .pv__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
  `],
})
export class PayVatPaymentModalComponent implements OnInit {
  data = inject<PayVatPaymentData>(MODAL_DATA);
  ref = inject<ModalRef<boolean>>(MODAL_REF);
  private vat = inject(VatPaymentService);
  private lookups = inject(SalesLookupsService);
  private toast = inject(ToastService);

  readonly isEdit = !!this.data.line?.id;
  readonly amountDue = this.data.amountDue ?? this.data.vatPayment.amountDue;
  /** A payment can't predate the end of the period it settles. */
  readonly minDate = new Date(this.data.vatPayment.to);

  methods = signal<any[]>([]);
  method = signal<any | null>(null);
  amount = signal<number>(0);
  date = signal<Date>(new Date());
  reference = signal<string>('');
  saving = signal(false);
  showErrors = signal(false);

  readonly valid = computed(() => !!this.method() && this.amount() > 0);

  methodLabel = (m: any) => m?.name ?? '';
  byId = (a: any, b: any) => a?.id === b?.id;

  async ngOnInit(): Promise<void> {
    const line = this.data.line;
    this.amount.set(line?.id ? line.amount : this.amountDue);
    this.reference.set(line?.referenceNumber ?? '');
    if (line?.paymentDate) this.date.set(new Date(line.paymentDate));
    const methods = await this.lookups.getMiniPaymentMethods(this.data.vatPayment.branchId || null, line?.paymentMethodId || null);
    this.methods.set(methods);
    if (line?.paymentMethodId) this.method.set(methods.find(m => m.id === line.paymentMethodId) ?? { id: line.paymentMethodId, name: line.paymentMethodName });
  }

  onAmount(v: any): void {
    let n = Number(v) || 0;
    if (n > this.amountDue) n = this.amountDue;
    this.amount.set(n);
  }
  onDate(v: any): void { if (v instanceof Date) this.date.set(v); }

  async pay(): Promise<void> {
    if (this.saving()) return;
    if (!this.valid()) { this.showErrors.set(true); return; }
    const line = new VatPaymentLine();
    if (this.data.line) line.ParseJson(this.data.line);
    line.vatPaymentId = this.data.vatPayment.id;
    line.amount = MathUtils.roundDecimal(this.amount());
    line.paymentMethodId = this.method().id;
    line.paymentMethodName = this.method().name;
    line.paymentDate = ymd(this.date());
    line.referenceNumber = this.reference();

    this.saving.set(true);
    const res: any = await this.vat.saveVatPaymentLine(line);
    if (res?.success) {
      this.toast.success('COMMON.SAVED_OK');
      this.ref.close(true);
    } else {
      this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
      this.saving.set(false);
    }
  }
}
