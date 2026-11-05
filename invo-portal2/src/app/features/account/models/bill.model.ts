import { MathUtils } from '@core/math/math-helpers';
import { Invoice } from './invoice.model';
import { PurchaseOrderLine } from './purchase-order.model';
import { TaxLineModel } from './tax.model';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * One line of a bill (legacy `BillingLine`). A stocked line may be split into `batches` (qty, cost,
 * production / expiry date each) or `serials` (one unit each, own cost) - its quantity and cost then
 * come from them. Besides a line discount it knows whether that discount includes the tax of an
 * inclusive-tax bill (`discountIncludesTax`).
 */
export class BillLine extends PurchaseOrderLine {
  billingId = '';
  /** Quantity left on the purchase order this line was made from (display + conversion). */
  override remainingQty = 0;
  discountIncludesTax = false;
  prodDate: Date | string = new Date();
  expireDate: Date | string = new Date();
  batches: BillLine[] = [];
  serials: BillLine[] = [];
  /** Cost of the product before a batch / serial split, kept so it can be restored. */
  productDefaultUnitCost = 0;
  lineDiscountedAmount = 0;
  lineTaxTotal = 0;
  /** Sold quantity of a saved batch (a batch already sold from can't shrink below it). */
  batchInfo: { soldTotalQty: number } | null = null;
  serialInfo: any | null = null;
  parentLineId: string | null = null;

  private liveSerials(): BillLine[] { return this.serials.filter(s => !s.isDeleted); }

  /** Net amount of the line before discount / tax. */
  get lineSubTotal(): number {
    if (this.serials.length > 0) return this.liveSerials().reduce((s, x) => s + x.unitCost, 0);
    if (this.batches.length > 0) return this.batches.reduce((s, x) => s + x.unitCost * x.qty, 0);
    return this.unitCost * this.qty;
  }

  /** Quantity / cost of a split line follow its batches / serials (legacy getters). */
  syncFromSplit(): void {
    if (this.batches.length > 0) {
      const qty = this.batches.reduce((s, b) => s + b.qty, 0);
      const cost = this.batches.reduce((s, b) => s + b.qty * b.unitCost, 0);
      this.qty = qty;
      if (qty > 0) this.unitCost = cost / qty;
    } else if (this.serials.length > 0) {
      const live = this.liveSerials();
      this.qty = live.length;
      if (live.length > 0) this.unitCost = live.reduce((s, x) => s + x.unitCost, 0) / live.length;
    }
  }

  private flatBase(gross: number, taxes: TaxLineModel[]): number {
    const pct = taxes.reduce((s, t) => MathUtils.add2(s, t.taxPercentage), 0);
    return MathUtils.division2(gross, MathUtils.division2(MathUtils.add2(100, pct), 100));
  }

  /** Legacy `BillingLine.calculateTax`: sets `taxTotal`, returns the amount before tax and the tax. */
  private billTax(amount: number, inclusive: boolean): { base: number; tax: number } {
    if (this.taxPercentage == 0) { this.taxTotal = 0; return { base: amount, tax: 0 }; }
    let base = amount;
    if (this.taxes && this.taxes.length > 0) {
      let total = 0;
      if (inclusive && (this.taxType === 'flat' || this.taxType === 'stacked')) base = this.flatBase(amount, this.taxes);
      this.taxes.forEach((t: TaxLineModel) => {
        const a = inclusive
          ? MathUtils.division2(base * t.taxPercentage, 100 + t.taxPercentage)
          : MathUtils.multiply2(base, t.taxPercentage / 100);
        total += a;
        t.taxAmount = a;
        if (this.taxType === 'stacked') base += a;
      });
      this.taxTotal = total;
    } else if (inclusive) {
      this.taxTotal = MathUtils.division2(MathUtils.multiply2(amount, this.taxPercentage), MathUtils.add2(100, this.taxPercentage));
      base = MathUtils.division2(base, 1 + MathUtils.division2(this.taxPercentage, 100));
    } else {
      this.taxTotal = MathUtils.multiply2(amount, MathUtils.division2(this.taxPercentage, 100));
    }
    return { base, tax: this.taxTotal };
  }

  /** Re-taxes the line on the amount left after the bill discount (exclusive tax) - legacy `calculateTax(newBase, false)`. */
  retaxExclusive(amount: number): void { this.billTax(amount, false); }

  private discountOf(base: number): number {
    let d = this.discountPercentage ? base * (this.discountAmount / 100) : this.discountAmount;
    d = Math.min(d, base);
    if (this.taxPercentage && this.isInclusiveTax && this.discountIncludesTax) {
      d = d - this.billTax(d, true).tax;
    }
    return Math.min(d, base);
  }

  override calculateAmount(): number {
    const subTotal = this.lineSubTotal;
    this.subTotal = subTotal;
    this.total = subTotal;

    let lineTotal = subTotal;
    let taxTotal = 0;
    let discountTotal = 0;

    if (this.taxId != null && this.taxId != '') {
      const o = this.billTax(subTotal, this.isInclusiveTax);
      taxTotal = o.tax;
      if (!this.isInclusiveTax) this.total += this.taxTotal;
      lineTotal = subTotal;
      if (this.isInclusiveTax) lineTotal = o.base;
    }

    if (this.discountAmount > 0) {
      const base = this.isInclusiveTax ? lineTotal : subTotal;
      discountTotal = this.discountOf(base);
      lineTotal = MathUtils.sub2(base, discountTotal);
      if (this.taxId) {
        const o = this.billTax(lineTotal, false);
        taxTotal = o.tax;
        lineTotal = MathUtils.add2(lineTotal, taxTotal);
      }
      this.total = lineTotal;
    } else if (this.taxId == null || this.taxId == '') {
      this.total = subTotal;
    }

    this.discountedAmount = discountTotal;
    this.discountTotal = discountTotal;
    this.lineDiscountedAmount = discountTotal;
    this.lineTaxTotal = taxTotal;
    this.taxableAmount = MathUtils.sub2(this.total, this.taxTotal);
    return this.total;
  }

  override ParseJson(json: any): void {
    const { batches, serials, ...rest } = json ?? {};
    super.ParseJson(rest);
    if (batches) this.batches = (batches as any[]).map(b => { const l = new BillLine(); l.ParseJson(b); return l; });
    if (serials) this.serials = (serials as any[]).map(b => { const l = new BillLine(); l.ParseJson(b); return l; });
  }
}

/**
 * Bill = the purchase-document shape (see `PurchaseOrder`) with the bill header (`billingNumber`,
 * `billingDate`, `dueDate`, payment term, payable account), a bill-level discount taken before or after
 * tax, and the payment figures the server keeps (`paidAmount`, `balance`, `appliedCredit`). Statuses:
 * `Draft` / `Open` / `Partially Paid` / `Paid` / `Overdue` / `Closed` (set by the server as payments arrive).
 */
export class Bill extends Invoice {
  billingNumber = '';
  reference = '';
  supplierId = '';
  supplierName = '';
  supplierEmail = '';
  supplierVatNumber = '';
  supplierPhone = '';
  supplierAddress = '';
  billingDate: Date | string = new Date();
  payableAccountId: string | null = '';
  purchaseOrderId: string | null = null;
  purchaseNumber = '';
  recurringBillId: string | null = null;
  billingTaxTotal = 0;
  billDiscount = 0;
  /** The supplier is abroad (bill of entry): no tax on the bill. */
  allowBillOfEntry = false;
  internationalSupplier = false;
  billOfEntryId: string | null = null;
  billingOfEnrtyNumber: string | null = null;
  billingOfEnrtyTotal = 0;
  billingOfEntryDate: Date | string | null = null;
  isActiveSupplier = true;
  billingPayments: any[] = [];
  refunded = 0;
  /** Display only. */
  purchaseStatus = '';

  constructor() {
    super();
    this.paymentTerm = 'net7';
    this.discountIncludesTax = false;
    this.applyDiscountBeforeTax = true;
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    this.dueDate = ymd(d);
    const first = new BillLine();
    first.isNew = true;
    this.lines = [first];
  }

  override ParseJson(json: any): void {
    const { lines, ...rest } = json ?? {};
    super.ParseJson(rest);
    if (lines) {
      this.lines = (lines as any[]).map(l => { const line = new BillLine(); line.ParseJson(l); return line; });
    }
  }

  applyDiscountIncludesTaxToLines(): void {
    (this.lines as BillLine[]).forEach(l => { l.discountIncludesTax = this.discountIncludesTax; });
    this.calculateTotal();
  }

  /** Lines flagged `isDeleted` take no part in the totals. */
  private get liveLines(): BillLine[] { return (this.lines as BillLine[]).filter(l => !l.isDeleted); }

  override itemTotal(): number {
    let total = 0;
    this.liveLines.forEach(l => {
      l.isInclusiveTax = this.isInclusiveTax;
      l.syncFromSplit();
      l.calculateAmount();
      total += l.total;
    });
    return total;
  }

  /** Legacy `Billing.calculateTotal`: lines, then the bill discount spread over them (before or after tax). */
  override calculateTotal(): void {
    let beforeTax = 0;
    let afterTax = 0;
    let finalTax = 0;
    this.liveLines.forEach(l => {
      l.isInclusiveTax = this.isInclusiveTax;
      l.syncFromSplit();
      l.calculateAmount();
      beforeTax += l.total - l.lineTaxTotal;
      afterTax += l.total;
      finalTax += l.lineTaxTotal;
    });

    const toDiscount = this.applyDiscountBeforeTax ? beforeTax : afterTax;
    this.itemTotalWithoutTax = beforeTax;
    this.itemSubTotal = beforeTax;
    this.billDiscount = 0;

    if (this.discountAmount > 0) {
      finalTax = 0;
      let discount: number;
      if (this.discountPercentage) {
        discount = (toDiscount * this.discountAmount) / 100;
      } else {
        discount = Math.min(this.discountAmount, toDiscount);
        this.discountAmount = discount;
      }
      this.billDiscount = discount;
      const ratio = toDiscount > 0 ? discount / toDiscount : 0;
      this.liveLines.forEach(l => {
        const base = this.applyDiscountBeforeTax ? l.total - l.lineTaxTotal : l.total;
        const after = base - base * ratio;
        if (this.applyDiscountBeforeTax) l.retaxExclusive(after);
        finalTax += l.taxTotal;
      });
    }

    this.discountTotal = this.billDiscount;
    this.invoiceTaxTotal = finalTax;
    this.billingTaxTotal = finalTax;
    this.total = this.itemTotalWithoutTax - this.billDiscount + finalTax;
    this.subTotal = this.total;
    this.calculateRounding(MathUtils.afterDecimal);
    this.total = MathUtils.add(this.total, this.roundingTotal);
  }

  get isOverdue(): boolean { return this.status === 'Overdue'; }
}
