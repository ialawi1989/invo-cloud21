import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { MathUtils } from '@core/math/math-helpers';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { InvoicePayment } from '../../../models/invoice-payment.model';

/** Payment receipt (legacy `reciept-paper`): who paid, how, how much, and which invoices it settled. */
@Component({
  selector: 'app-payment-receipt',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, MycurrencyPipe],
  template: `
    @let p = payment();
    <article class="pr">
      <header class="pr__head">
        @if (logo()) { <img class="pr__logo" [src]="logo()" alt=""/> }
        <div>
          <h2>{{ companyName() }}</h2>
          @if (p.branchName) { <div class="pr__muted">{{ p.branchName }}</div> }
        </div>
        <div class="pr__title">{{ 'PAYMENTS.VIEW.RECEIPT' | translate }}</div>
      </header>

      <div class="pr__grid">
        <dl class="pr__facts">
          @if (p.paymentName) { <div><dt>{{ 'PAYMENTS.LIST.PAYMENT_NUMBER' | translate }}</dt><dd>{{ p.paymentName }}</dd></div> }
          @if (p.referenceNumber) { <div><dt>{{ 'PAYMENTS.LIST.REFERENCE_NUMBER' | translate }}</dt><dd>{{ p.referenceNumber }}</dd></div> }
          <div><dt>{{ 'PAYMENTS.LIST.PAYMENT_DATE' | translate }}</dt><dd>{{ p.paymentDate | date: 'dd/MM/yyyy' }}</dd></div>
          <div><dt>{{ 'PAYMENTS.VIEW.RECEIVED_FROM' | translate }}</dt><dd>{{ p.customerName }}</dd></div>
          @if (address()) { <div><dt>{{ 'PAYMENTS.VIEW.ADDRESS' | translate }}</dt><dd>{{ address() }}</dd></div> }
          <div><dt>{{ 'PAYMENTS.LIST.PAYMENT_METHOD' | translate }}</dt><dd>{{ p.paymentMethodName }}</dd></div>
        </dl>

        <div class="pr__amount">
          <small>{{ 'PAYMENTS.VIEW.AMOUNT_RECEIVED' | translate }}</small>
          @if (p.paidAmount > p.tenderAmount) {
            <strong>{{ p.paidAmount | mycurrency }}</strong>
          } @else if (p.rate != 1) {
            <strong>{{ p.tenderAmount }}</strong>
            <small>{{ 'PAYMENTS.VIEW.EQUIVALENT_AMOUNT' | translate }} {{ equivalent() | mycurrency }}</small>
          } @else {
            <strong>{{ p.tenderAmount | mycurrency }}</strong>
          }
        </div>
      </div>

      <h3 class="pr__sub">{{ 'PAYMENTS.VIEW.PAYMENT_FOR' | translate }}</h3>
      <div class="pr__wrap">
        <table class="pr__table">
          <thead>
            <tr>
              <th>{{ 'PAYMENTS.VIEW.INVOICE_NUMBER' | translate }}</th>
              <th>{{ 'PAYMENTS.VIEW.PAID_ON' | translate }}</th>
              <th class="end">{{ 'PAYMENTS.VIEW.INVOICE_AMOUNT' | translate }}</th>
              <th class="end">{{ 'PAYMENTS.VIEW.PAYMENT_AMOUNT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (l of p.lines; track $index) {
              @if (l.id) {
                <tr>
                  <td><a [routerLink]="['/account/invoices/view', l.invoiceId]" [queryParams]="{ pageNum: 1 }">{{ l.invoiceNumber }}</a></td>
                  <td>{{ l.createdAt | date: 'dd/MM/yyyy' }}</td>
                  <td class="end">{{ l.total | mycurrency }}</td>
                  <td class="end">{{ l.amount | mycurrency }}</td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </article>
  `,
  styles: [`
    .pr { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; gap: 18px; max-width: 900px; }
    .pr__head { display: flex; align-items: center; gap: 14px; }
    .pr__head h2 { margin: 0; font-size: 18px; }
    .pr__logo { height: 48px; object-fit: contain; }
    .pr__muted { color: #64748b; font-size: 13px; }
    .pr__title { margin-inline-start: auto; font-size: 20px; font-weight: 700; color: #227d8d; text-transform: uppercase; }
    .pr__grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
    @media (min-width: 720px) { .pr__grid { grid-template-columns: 2fr 1fr; } }
    .pr__facts { margin: 0; display: flex; flex-direction: column; gap: 6px; }
    .pr__facts div { display: flex; justify-content: space-between; gap: 12px; }
    .pr__facts dt { color: #64748b; } .pr__facts dd { margin: 0; font-weight: 600; text-align: end; }
    .pr__amount { background: #2691a4; color: #fff; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center; }
    .pr__amount strong { font-size: 22px; }
    .pr__sub { margin: 0; font-size: 15px; }
    .pr__wrap { overflow-x: auto; }
    .pr__table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .pr__table th { background: #0f172a; color: #fff; text-align: start; padding: 10px 12px; }
    .pr__table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    .end { text-align: end !important; }
    a { color: #227d8d; }
  `],
})
export class PaymentReceiptComponent {
  private company = inject(CompanyService);

  payment = input.required<InvoicePayment>();

  companyName = computed(() => this.company.currentCompany()?.name ?? '');
  logo = computed(() => {
    const c: any = this.company.currentCompany();
    return c?.mediaUrl?.defaultUrl || c?.logoUrl || c?.logo || '';
  });
  address = computed(() => {
    const a: any = this.payment().customerAddress;
    return typeof a?.toString === 'function' && a.title ? String(a.toString()).trim() : '';
  });
  equivalent = computed(() => MathUtils.multiply(this.payment().tenderAmount, this.payment().rate));
}
