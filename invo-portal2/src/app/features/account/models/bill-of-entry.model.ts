import { MathUtils } from '@core/math/math-helpers';
import { Invoice, InvoiceLine } from './invoice.model';

/**
 * One line of a bill of entry (legacy `BillOfEntryLine`): a line of the imported bill with the customs
 * duty entered on it. Its assessable value is what the bill line cost net of discounts; the taxable amount
 * adds the duty and the tax is taken on that. The goods themselves stay on the bill - only duty and tax
 * are booked by the bill of entry.
 */
export class BillOfEntryLine extends InvoiceLine {
  billingId = '';
  billOfEntryId = '';
  /** The line of the bill this one was made from. */
  billingLineId: any = '';
  unitCost = 0;
  customDuty = 0;
  customDutyTaxTotal = 0;
  /** The bill line's own discount plus its share of the bill's discount. */
  billDiscount = 0;
  transactionDiscountTotal = 0;
  isDeleted = false;
  /** Serial numbers / batches of the bill line (kept as they come, they only describe the goods). */
  batches: BillOfEntryLine[] = [];
  serials: BillOfEntryLine[] = [];
  barcode = '';
  SIC = '';
  /** UI only: ticked for the bulk "apply custom duty". */
  isSelected = false;

  /** What the line was bought for, net of its discounts - the base customs duty is assessed on. */
  get assessableValue(): number { return MathUtils.sub(this.subTotal, this.transactionDiscountTotal); }

  override calculateAmount(): number {
    this.unitCost = MathUtils.roundNumber(this.unitCost);
    let sub: number;
    if (this.serials.length > 0) {
      const live = this.serials.filter(s => !s.isDeleted);
      this.qty = this.serials.length;
      sub = live.reduce((s, x) => MathUtils.add(s, MathUtils.roundNumber(x.unitCost)), 0);
      this.unitCost = MathUtils.division(sub, this.serials.length);
    } else if (this.batches.length > 0) {
      const live = this.batches.filter(b => !b.isDeleted);
      this.qty = live.reduce((s, b) => s + b.qty, 0);
      sub = live.reduce((s, b) => s + MathUtils.multiply(MathUtils.roundNumber(b.unitCost), b.qty), 0);
      this.unitCost = MathUtils.division(sub, this.qty);
    } else {
      sub = MathUtils.multiply(this.qty, this.unitCost);
    }
    this.subTotal = sub;
    this.transactionDiscountTotal = MathUtils.add(this.billDiscount, this.discountTotal);
    this.total = MathUtils.add(MathUtils.sub(this.subTotal, this.transactionDiscountTotal), this.customDuty);

    if (this.taxId != null && this.taxId !== '') this.calculateTax(this.total, false);
    else this.taxTotal = 0;
    return this.total;
  }

  override ParseJson(json: any): void {
    const { batches, serials, ...rest } = json ?? {};
    super.ParseJson(rest);
    if (batches) this.batches = (batches as any[]).map(b => { const l = new BillOfEntryLine(); l.ParseJson(b); return l; });
    if (serials) this.serials = (serials as any[]).map(b => { const l = new BillOfEntryLine(); l.ParseJson(b); return l; });
  }
}

/**
 * Bill of entry (legacy `BillOfEntry`): customs paperwork for a bill from a supplier abroad. It is made from
 * a bill, copies its lines and books only what is paid at the border - the customs duty entered on the lines
 * plus the tax on (value + duty) - through a payment method. Total = duty + tax (+ rounding).
 */
export class BillOfEntry extends Invoice {
  billingOfEnrtyNumber = '';
  billingOfEntryDate: Date | string = new Date();
  reference = '';
  billingId = '';
  /** Number of the bill it was made from, and that bill's status when this was started. */
  billingNumber = '';
  currentBillingStatus = '';
  supplierId = '';
  supplierName = '';
  supplierEmail = '';
  supplierVatNumber = '';
  supplierCountry = '';
  override paymentMethodId = '';
  paymentMethodName = '';
  paymentMethodType = '';
  paymentMethodAccountId = '';
  customDutyTotal = 0;
  taxTotal = 0;

  constructor() {
    super();
    this.isInclusiveTax = false;
    this.lines = [new BillOfEntryLine()];
  }

  override ParseJson(json: any): void {
    const { lines, ...rest } = json ?? {};
    super.ParseJson(rest);
    if (lines) this.lines = (lines as any[]).map(l => { const line = new BillOfEntryLine(); line.ParseJson(l); return line; });
    if (!Array.isArray(this.attachment)) this.attachment = [];
  }

  private get liveLines(): BillOfEntryLine[] {
    return (this.lines as BillOfEntryLine[]).filter(l => !l.isDeleted && (l.parentId == null || l.parentId === ''));
  }

  override itemTotal(): number { this.calculateTotal(); return this.total; }

  override calculateTotal(): void {
    this.customDutyTotal = 0;
    this.taxTotal = 0;
    this.isInclusiveTax = false;
    this.liveLines.forEach(l => {
      l.isInclusiveTax = false;
      l.calculateAmount();
      this.customDutyTotal = MathUtils.add(this.customDutyTotal, l.customDuty);
      this.taxTotal = MathUtils.add(this.taxTotal, l.taxTotal);
    });
    this.invoiceTaxTotal = this.taxTotal;
    this.itemTotalWithoutTax = this.customDutyTotal;
    this.total = MathUtils.add(this.customDutyTotal, this.taxTotal);
    this.calculateRounding(MathUtils.afterDecimal);
    this.total = MathUtils.add(this.total, this.roundingTotal);
    this.subTotal = this.total;
  }
}
