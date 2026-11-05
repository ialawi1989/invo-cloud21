import { MathUtils } from '@core/math/math-helpers';
import { Invoice, InvoiceLine } from './invoice.model';
import { PurchaseOrderLine } from './purchase-order.model';

/**
 * One line of a supplier credit (legacy `SupplierCreditLine`): a line of the bill being credited
 * (`billingLineId`, credited up to `maxQty`) or, when the credit isn't tied to a bill, a product / note line.
 * It keeps what the bill gave it - its discount, the bill's own header discount and the bill's totals - so the
 * credit can take back exactly the matching share. Serialized / batch products are returned unit by unit
 * (`serials` / `batches` with `return` flags).
 */
export class SupplierCreditLine extends PurchaseOrderLine {
  supplierCreditId = '';
  billingLineId = '';
  isImported = false;
  /** Serial numbers / batches that can be returned, each flagged `return` when picked. */
  batches: SupplierCreditLine[] = [];
  serials: SupplierCreditLine[] = [];
  /** Display + conversion helpers. */
  tempMaxQty = 0;
  onHand = 0;
  return = false;
  prodDate: Date | string = new Date();
  expireDate: Date | string = new Date();

  /** The bill line's own discount (a total, for the quantity billed) and the quantity it was billed with. */
  billingQty = 0;
  billingDiscountTotal = 0;
  /** The bill's header discount, and what the bill totalled before / after tax (the base that discount was spread over). */
  billDiscount = 0;
  sourceBillTotalBeforeTax = 0;
  sourceBillTotalAfterTax = 0;
  discountIncludesTax = false;
  supplierCreditDiscount = 0;

  /** The credit's maths sets the line total; nothing is recalculated per line. */
  override calculateAmount(): number { return this.total; }

  /** The share of the bill line's discount matching the quantity credited. */
  get appliedDiscount(): number {
    return this.billingQty > 0 ? this.discountTotal * (this.qty / this.billingQty) : this.discountTotal;
  }

  get batchesReturned(): number { return this.batches.filter(b => b.return).reduce((s, b) => s + b.qty, 0); }
  get serialsReturned(): number { return this.serials.filter(s => s.return).length; }

  override ParseJson(json: any): void {
    const { batches, serials, ...rest } = json ?? {};
    super.ParseJson(rest);
    if (batches) this.batches = (batches as any[]).map(b => { const l = new SupplierCreditLine(); l.ParseJson(b); return l; });
    if (serials) this.serials = (serials as any[]).map(b => { const l = new SupplierCreditLine(); l.ParseJson(b); return l; });
  }
}

/**
 * Supplier credit = the purchase-document shape (see `Bill`) with the credit header
 * (`supplierCreditNumber`, `supplierCreditDate`, the bill it credits) and the legacy maths: every line takes
 * back its bill line's own discount (pro rata to the quantity credited) and its share of the discount that
 * bill had on its header, spread over the bill's totals (before or after tax). A credit may come from several
 * bills, so each line carries its own bill's totals.
 * The server sets `refundDue` / `refundedAmount` as it is refunded or applied to bills.
 */
export class SupplierCredit extends Invoice {
  supplierCreditNumber = '';
  supplierCreditDate: Date | string = new Date();
  reference = '';
  billingId = '';
  billingNumber = '';
  billingTotal = 0;
  supplierId = '';
  supplierName = '';
  supplierEmail = '';
  supplierPhone = '';
  supplierAddress = '';
  supplierVatNumber = '';
  allowBillOfEntry = false;
  refundDue = 0;
  refundedAmount = 0;
  /** What the credit gave back through discounts of its bills. */
  creditDiscount = 0;
  totalTax = 0;
  totalWithoutTax = 0;

  constructor() {
    super();
    this.discountIncludesTax = false;
    this.applyDiscountBeforeTax = true;
    this.lines = [new SupplierCreditLine()];
  }

  override ParseJson(json: any): void {
    const { lines, ...rest } = json ?? {};
    super.ParseJson(rest);
    if (lines) this.lines = (lines as any[]).map(l => { const line = new SupplierCreditLine(); line.ParseJson(l); return line; });
    if (typeof this.refundDue === 'string') this.refundDue = +this.refundDue;
  }

  private get liveLines(): SupplierCreditLine[] { return (this.lines as SupplierCreditLine[]).filter(l => !l.isDeleted); }

  override itemTotal(): number { this.calculateTotal(); return this.total; }

  /** Tax inside `amount` for this line's tax, without disturbing the line's own tax figures. */
  private taxInside(line: SupplierCreditLine, amount: number): number {
    const keep = line.taxTotal;
    line.calculateTax(amount);
    const t = line.taxTotal;
    line.taxTotal = keep;
    return t;
  }

  /** The line's discount share, net of the tax it contains when the bill is inclusive and its discount included tax. */
  private lineDiscount(line: SupplierCreditLine): number {
    let d = line.appliedDiscount;
    if (line.isInclusiveTax && line.discountIncludesTax) d -= this.taxInside(line, d);
    return d;
  }

  /** The line's net (before tax) after its own discount; re-taxes the line on it. */
  private lineBase(line: SupplierCreditLine): number {
    line.isInclusiveTax = this.isInclusiveTax;
    const gross = line.unitCost * line.qty;
    line.calculateTax(gross);
    const base = this.isInclusiveTax ? Math.max(0, gross - line.taxTotal) - this.lineDiscount(line) : gross - this.lineDiscount(line);
    line.calculateTax(base, false);
    return base;
  }

  override calculateTotal(): void {
    const beforeTax = this.applyDiscountBeforeTax ?? true;
    const lines = this.liveLines;

    let totalBase = 0;
    let totalTaxFirst = 0;
    let totalBillDiscount = 0;
    lines.forEach(line => {
      const base = this.lineBase(line);
      line.total = base + line.taxTotal;
      totalBase += base;
      totalTaxFirst += line.taxTotal;
      const scope = beforeTax ? line.sourceBillTotalBeforeTax : line.sourceBillTotalAfterTax;
      if (line.billDiscount > 0 && scope > 0) {
        totalBillDiscount += line.billDiscount * ((beforeTax ? base : line.total) / scope);
      }
    });

    this.totalWithoutTax = totalBase;
    this.creditDiscount = totalBillDiscount;

    let finalTax = totalTaxFirst;
    let finalTotal = lines.reduce((s, l) => s + l.total, 0);

    if (totalBillDiscount > 0 && totalBase > 0) {
      finalTax = 0;
      finalTotal = 0;
      lines.forEach(line => {
        const base = this.lineBase(line);
        const tax = line.taxTotal;
        const scope = beforeTax ? line.sourceBillTotalBeforeTax : line.sourceBillTotalAfterTax;
        let share = 0;
        if (line.billDiscount > 0 && scope > 0) share = line.billDiscount * ((beforeTax ? base : base + tax) / scope);

        if (beforeTax) {
          const newBase = Math.max(0, base - share);
          line.calculateTax(newBase, false);
          line.total = newBase + line.taxTotal;
        } else {
          line.total = Math.max(0, base + tax - share);
        }
        finalTotal += line.total;
        finalTax += line.taxTotal;
      });
    }

    this.discountTotal = this.creditDiscount;
    this.totalTax = finalTax;
    this.invoiceTaxTotal = finalTax;
    this.itemTotalWithoutTax = this.totalWithoutTax;
    this.total = beforeTax ? Math.max(0, this.totalWithoutTax - this.creditDiscount) + this.totalTax : finalTotal;
    this.subTotal = this.total;
    this.calculateRounding(MathUtils.afterDecimal);
    this.total = MathUtils.add(this.total, this.roundingTotal);
  }
}
