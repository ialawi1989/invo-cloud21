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
 * Supplier statement of account (legacy `statement-paper` of the supplier dashboard): account summary + the
 * transaction table with running balance. Summary/total math is unchanged —
 * opening-balance rows feed the opening balance, every other row feeds the
 * invoiced / received sums.
 */
@Component({
  selector: 'app-supplier-statement',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cs-summary">
      <div class="cs-summary__head">
        <h4>{{ 'SUPPLIERS.STATEMENT.STATEMENT_OF_ACCOUNTS' | translate }}</h4>
        @if (filterType() === 'outstanding') {
          <span class="cs-tag">{{ 'SUPPLIERS.STATEMENT.OUTSTANDING_BILLS' | translate }}</span>
        }
        <div class="cs-meta">{{ 'SUPPLIERS.STATEMENT.PERIOD' | translate }}: {{ from() }} → {{ to() }}</div>
        <div class="cs-meta">{{ 'SUPPLIERS.STATEMENT.TO' | translate }}: {{ supplierName() }}</div>
      </div>
      <div class="cs-summary__box">
        <div class="cs-row"><span>{{ 'SUPPLIERS.STATEMENT.OPENING_BALANCE' | translate }}</span><span>{{ summary().openingBalance | mycurrency }}</span></div>
        <div class="cs-row"><span>{{ 'SUPPLIERS.STATEMENT.BILLED_AMOUNT' | translate }}</span><span>{{ summary().billedAmount | mycurrency }}</span></div>
        <div class="cs-row"><span>{{ 'SUPPLIERS.STATEMENT.AMOUNT_PAID' | translate }}</span><span class="cs-pos">{{ summary().amountPaid | mycurrency }}</span></div>
        <div class="cs-row cs-row--total"><span>{{ 'SUPPLIERS.STATEMENT.BALANCE_DUE' | translate }}</span><span class="cs-neg">{{ summary().balanceDue | mycurrency }}</span></div>
      </div>
    </div>

    <div class="cs-table-wrap">
      <table class="cs-table">
        <thead>
          <tr>
            <th>{{ 'SUPPLIERS.STATEMENT.DATE' | translate }}</th>
            <th>{{ 'SUPPLIERS.STATEMENT.TRANSACTIONS' | translate }}</th>
            <th>{{ 'SUPPLIERS.STATEMENT.DETAILS' | translate }}</th>
            <th class="end">{{ 'SUPPLIERS.STATEMENT.AMOUNT' | translate }}</th>
            <th class="end">{{ 'SUPPLIERS.STATEMENT.PAYMENTS' | translate }}</th>
            <th class="end">{{ 'SUPPLIERS.STATEMENT.BALANCE' | translate }}</th>
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
                @for (inv of billsOf(row); track $index) {
                  <a [routerLink]="['/account/bills/view', inv.id]" [queryParams]="{ pageNum: 1 }">{{ inv.number }}</a>@if (!$last) {<span>, </span>}
                }
              </td>
              <td class="end" [class.cs-neg]="num(row.amount) < 0" [class.cs-pos]="num(row.amount) >= 0">{{ row.amount | mycurrency }}</td>
              <td class="end" [class.cs-neg]="num(row.payment) < 0" [class.cs-pos]="num(row.payment) >= 0">{{ -num(row.payment) | mycurrency }}</td>
              <td class="end" [class.cs-neg]="num(row.Balance) < 0" [class.cs-pos]="num(row.Balance) >= 0">{{ row.Balance | mycurrency }}</td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="cs-empty">{{ 'SUPPLIERS.STATEMENT.NO_TRANSACTIONS' | translate }}</td></tr>
          }
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3"><b>{{ 'SUPPLIERS.STATEMENT.TOTAL' | translate }}</b></td>
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
export class SupplierStatementComponent {
  rows = input<any[]>([]);
  supplierName = input<string>('');
  from = input<string>('');
  to = input<string>('');
  filterType = input<string>('all');

  protected readonly num = num;

  isOpening = (r: any) => String(r?.accountName ?? '').toLowerCase() === 'opening balance';

  summary = computed(() => {
    let openingBalance = 0, billedAmount = 0, amountPaid = 0;
    for (const r of this.rows()) {
      // Each opening row carries the running balance, so the last one is the opening balance (summing double-counts).
      if (this.isOpening(r)) openingBalance = num(r.Balance);
      else { billedAmount += num(r.amount); amountPaid += num(r.payment); }
    }
    return { openingBalance, billedAmount, amountPaid, balanceDue: openingBalance + billedAmount + amountPaid };
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

  billsOf(r: any): { id: string; number: string }[] {
    const d = r?.details;
    if (!d) return [];
    const one = (x: any) => ({ id: x.billingId || x.BillingId, number: x.billingNumber || x.BillingNumber });
    const list = Array.isArray(d.billings) && d.billings.length ? d.billings.map(one) : [one(d)];
    return list.filter((x: any) => x.number);
  }
}
