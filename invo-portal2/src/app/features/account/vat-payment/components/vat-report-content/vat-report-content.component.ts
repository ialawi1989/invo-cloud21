import '../../../account-i18n';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { MathUtils } from '@core/math/math-helpers';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { VatPaymentService } from '../../services/vat-payment.service';

/** One numbered box of the GCC VAT return. */
export interface VatReportRecord {
  boxNo: string;
  description: string;
  taxId?: string;
  amount: number;
  adjustment: number;
  vatAmount: number;
}
interface VatReportSection { records: VatReportRecord[]; totalAmount: number; totalAdjustment: number; totalVatAmount: number }

/** What the form needs from the report. */
export interface VatReportTotals { netVat: number; output: number; input: number }

const EXEMPT = 'Exempt Tax';
const ZERO = 'Zero Tax';
const num = (v: any) => MathUtils.roundDecimal(+v || 0);
const row = (boxNo: string, description: string, amount = 0, adjustment = 0, vatAmount = 0, taxId?: string): VatReportRecord =>
  ({ boxNo, description, amount, adjustment, vatAmount, ...(taxId ? { taxId } : {}) });
/** Box order: 1(a), 1(b), 2, 3, 4 ... 11(a), 12, 13 (numeric first, then the letter). */
const boxKey = (b: string): [number, string] => { const m = /^(\d+)(?:\((\w)\))?$/.exec(b); return [m ? +m[1] : 0, m?.[2] ?? '']; };
const byBox = (a: VatReportRecord, b: VatReportRecord) => {
  const [an, al] = boxKey(a.boxNo); const [bn, bl] = boxKey(b.boxNo);
  return an - bn || al.localeCompare(bl);
};
const letter = (i: number) => String.fromCharCode(97 + i);

function totalled(records: VatReportRecord[]): VatReportSection {
  records.sort(byBox);
  return {
    records,
    totalAmount: records.reduce((s, r) => MathUtils.add(s, r.amount), 0),
    totalAdjustment: records.reduce((s, r) => MathUtils.add(s, r.adjustment), 0),
    totalVatAmount: records.reduce((s, r) => MathUtils.add(s, r.vatAmount), 0),
  };
}

/**
 * The VAT return (legacy `VatReportContentComponent`): the sales and purchase VAT reports of the period laid
 * out as the numbered boxes of the GCC return, with their totals. Emits the net VAT owed whenever it reloads.
 */
@Component({
  selector: 'app-vat-report-content',
  standalone: true,
  imports: [TranslateModule, MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './vat-report-content.component.scss',
  templateUrl: './vat-report-content.component.html',
})
export class VatReportContentComponent {
  private vat = inject(VatPaymentService);

  /** yyyy-MM-dd */
  fromDate = input.required<string>();
  toDate = input.required<string>();
  changed = output<VatReportTotals>();

  loading = signal(false);
  sales = signal<VatReportSection>(totalled([]));
  purchases = signal<VatReportSection>(totalled([]));

  private seq = 0;

  constructor() {
    effect(() => { void this.load(this.fromDate(), this.toDate()); });
  }

  private async load(from: string, to: string): Promise<void> {
    const seq = ++this.seq;
    this.loading.set(true);
    try {
      const [salesRows, purchaseRows] = await Promise.all([
        this.vat.getVatReport('getSalesVatReport', from, to),
        this.vat.getVatReport('getPurchaseVatReport', from, to),
      ]);
      if (seq !== this.seq) return; // a newer period was picked meanwhile
      const sales = this.buildSales(salesRows);
      const purchases = this.buildPurchases(purchaseRows);
      this.sales.set(sales);
      this.purchases.set(purchases);
      this.changed.emit({
        netVat: MathUtils.sub(sales.totalVatAmount, purchases.totalVatAmount),
        output: sales.totalVatAmount,
        input: purchases.totalVatAmount,
      });
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }

  private buildSales(rows: any[]): VatReportSection {
    const exempt = rows.find(r => r.taxName === EXEMPT);
    const zero = rows.find(r => r.taxName === ZERO);
    const taxed = rows.filter(r => r !== exempt && r !== zero);
    const records = taxed.map((r, i) => row(`1(${letter(i)})`, r.taxName, num(r.Total), num(r.Adjusments), num(r.vatTotal), r.taxId));
    if (exempt) records.push(row('6', exempt.taxName, num(exempt.Total), num(exempt.Adjusments), 0, exempt.taxId));
    if (zero) records.push(row('4', zero.taxName, num(zero.Total), num(zero.Adjusments), 0, zero.taxId));
    records.push(row('5', 'Exports'), row('2', 'Sales to registered taxpayers in other GCC State'), row('3', 'Sales subject to domestic reverse charge mechanism'));
    return totalled(records);
  }

  private buildPurchases(rows: any[]): VatReportSection {
    const exempt = rows.find(r => r.taxName === EXEMPT);
    const zero = rows.find(r => r.taxName === ZERO);
    const taxed = rows.filter(r => r !== exempt && r !== zero);
    const records = taxed.map((r, i) => row(`8(${letter(i)})`, r.taxName, num(r.Total), num(r.Adjusments), num(r.vatTotal), r.taxId));
    records.push(row('9', 'Imports subject to Vat paid at customs'), row('10', 'Imports subject to Vat deferral at customs'));
    taxed.forEach((r, i) => records.push(row(`11(${letter(i)})`, 'Imports subject to Vat accounted for through reverse charge mechanism at ' + r.taxName)));
    records.push(
      row('12', 'Purchase subject to domestic reverse charge mechanism'),
      row('13', 'Purchase subject from non-registered suppliers, zero-rated/exempt purchase',
        num(MathUtils.add(exempt?.Total ?? 0, zero?.Total ?? 0)), num(MathUtils.add(exempt?.Adjusments ?? 0, zero?.Adjusments ?? 0))),
    );
    return totalled(records);
  }
}
