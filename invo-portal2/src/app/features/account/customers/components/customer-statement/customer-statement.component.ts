import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

/** `dbTable` value → route segment of the record's view page (legacy statement-paper links). */
const LINK_ROUTES: Record<string, string> = {
  'Invoice': 'invoices',
  'Credit Note': 'credit-notes',
  'Invoice Payment': 'payments',
  'Supplier Credits': 'supplier-credit',
  'Billing Payment': 'bills-payment',
  'Expense': 'expense',
  'Journals': 'journal',
  'Billing': 'bills',
};

const num = (v: unknown): number => {
  const n = parseFloat(v as string);
  return isNaN(n) ? 0 : n;
};

/**
 * Statement of account (legacy `statement-paper`): account summary + the
 * transaction table with running balance. Summary/total math is unchanged —
 * opening-balance rows feed the opening balance, every other row feeds the
 * invoiced / received sums.
 */
@Component({
  selector: 'app-customer-statement',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cs-summary">
      <div class="cs-summary__head">
        <h4>{{ 'CUSTOMERS.STATEMENT.STATEMENT_OF_ACCOUNTS' | translate }}</h4>
        @if (filterType() === 'outstanding') {
          <span class="cs-tag">{{ 'CUSTOMERS.STATEMENT.OUTSTANDING_INVOICE' | translate }}</span>
        }
        <div class="cs-meta">{{ 'CUSTOMERS.STATEMENT.PERIOD' | translate }}: {{ from() }} → {{ to() }}</div>
        <div class="cs-meta">{{ 'CUSTOMERS.STATEMENT.TO' | translate }}: {{ customerName() }}</div>
      </div>
      <div class="cs-summary__box">
        <div class="cs-row"><span>{{ 'CUSTOMERS.STATEMENT.OPENING_BALANCE' | translate }}</span><span>{{ summary().openingBalance | mycurrency }}</span></div>
        <div class="cs-row"><span>{{ 'CUSTOMERS.STATEMENT.INVOICED_AMOUNT' | translate }}</span><span>{{ summary().invoicedAmount | mycurrency }}</span></div>
        <div class="cs-row"><span>{{ 'CUSTOMERS.STATEMENT.AMOUNT_RECEIVED' | translate }}</span><span class="cs-pos">{{ summary().amountReceived | mycurrency }}</span></div>
        <div class="cs-row cs-row--total"><span>{{ 'CUSTOMERS.STATEMENT.BALANCE_DUE' | translate }}</span><span class="cs-neg">{{ summary().balanceDue | mycurrency }}</span></div>
      </div>
    </div>

    <div class="cs-table-wrap">
      <table class="cs-table">
        <thead>
          <tr>
            <th>{{ 'CUSTOMERS.STATEMENT.DATE' | translate }}</th>
            <th>{{ 'CUSTOMERS.STATEMENT.TRANSACTIONS' | translate }}</th>
            <th>{{ 'CUSTOMERS.STATEMENT.DETAILS' | translate }}</th>
            <th class="end">{{ 'CUSTOMERS.STATEMENT.AMOUNT' | translate }}</th>
            <th class="end">{{ 'CUSTOMERS.STATEMENT.PAYMENTS' | translate }}</th>
            <th class="end">{{ 'CUSTOMERS.STATEMENT.BALANCE' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track $index) {
            <tr [class.cs-opening]="isOpening(row)">
              <td>{{ row.date | date: 'yyyy-MM-dd' }}</td>
              <td>
                @if (linkFor(row); as link) {
                  <a [routerLink]="link" [queryParams]="{ pageNum: 1 }">{{ row.dbTable }}</a>
                } @else {
                  {{ row.accountName }}
                }
              </td>
              <td>
                @for (inv of invoicesOf(row); track $index) {
                  <a [routerLink]="['/account/invoices/view', inv.id]" [queryParams]="{ pageNum: 1 }">{{ inv.number }}</a>@if (!$last) {<span>, </span>}
                }
              </td>
              <td class="end" [class.cs-neg]="num(row.amount) < 0" [class.cs-pos]="num(row.amount) >= 0">{{ row.amount | mycurrency }}</td>
              <td class="end" [class.cs-neg]="num(row.payment) < 0" [class.cs-pos]="num(row.payment) >= 0">{{ -num(row.payment) | mycurrency }}</td>
              <td class="end" [class.cs-neg]="num(row.Balance) < 0" [class.cs-pos]="num(row.Balance) >= 0">{{ row.Balance | mycurrency }}</td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="cs-empty">{{ 'CUSTOMERS.STATEMENT.NO_TRANSACTIONS' | translate }}</td></tr>
          }
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3"><b>{{ 'CUSTOMERS.STATEMENT.TOTAL' | translate }}</b></td>
            <td class="end"><b>{{ totals().amount | mycurrency }}</b></td>
            <td class="end"><b>{{ -totals().payment | mycurrency }}</b></td>
            <td class="end"><b>{{ totals().amount + totals().payment | mycurrency }}</b></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .cs-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    @media (max-width: 720px) { .cs-summary { grid-template-columns: 1fr; } }
    .cs-summary__head, .cs-summary__box { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; background: #fff; }
    .cs-summary__box { background: #f8fafc; }
    h4 { margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #0f172a; }
    .cs-meta { font-size: 13px; color: #64748b; margin-top: 4px; }
    .cs-tag { display: inline-block; font-size: 12px; font-weight: 600; color: #b45309; background: #fef3c7; border-radius: 999px; padding: 2px 10px; }
    .cs-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #475569; }
    .cs-row--total { border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 10px; font-weight: 700; color: #0f172a; }
    .cs-pos { color: #16a34a; } .cs-neg { color: #dc2626; }
    .cs-table-wrap { border: 1px solid #e5e7eb; border-radius: 12px; overflow-x: auto; background: #fff; }
    .cs-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    th { text-align: start; background: #f8fafc; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 12px; padding: 10px 14px; }
    td { padding: 10px 14px; border-top: 1px solid #f1f5f9; color: #334155; }
    .end { text-align: end; }
    tfoot td { background: #f8fafc; }
    .cs-opening td { background: #eff6ff; }
    .cs-empty { text-align: center; color: #94a3b8; padding: 24px; }
    a { color: #2691a4; text-decoration: none; } a:hover { text-decoration: underline; }
  `],
})
export class CustomerStatementComponent {
  rows = input<any[]>([]);
  customerName = input<string>('');
  from = input<string>('');
  to = input<string>('');
  filterType = input<string>('all');

  protected readonly num = num;

  isOpening = (r: any) => String(r?.accountName ?? '').toLowerCase() === 'opening balance';

  summary = computed(() => {
    let openingBalance = 0, invoicedAmount = 0, amountReceived = 0;
    for (const r of this.rows()) {
      if (this.isOpening(r)) openingBalance += num(r.Balance);
      else { invoicedAmount += num(r.amount); amountReceived += num(r.payment); }
    }
    return { openingBalance, invoicedAmount, amountReceived, balanceDue: openingBalance + invoicedAmount + amountReceived };
  });

  totals = computed(() => {
    let amount = 0, payment = 0;
    for (const r of this.rows()) { amount += num(r.amount); payment += num(r.payment); }
    return { amount, payment };
  });

  linkFor(r: any): any[] | null {
    const seg = LINK_ROUTES[r?.dbTable];
    return seg && r.referenceId ? ['/account', seg, 'view', r.referenceId] : null;
  }

  invoicesOf(r: any): { id: string; number: string }[] {
    const d = r?.details;
    if (!d) return [];
    const one = (x: any) => ({ id: x.invoiceId || x.InvoiceId, number: x.invoiceNumber || x.InvoiceNumber });
    const list = Array.isArray(d.invoices) && d.invoices.length ? d.invoices.map(one) : [one(d)];
    return list.filter((x: any) => x.number);
  }
}
