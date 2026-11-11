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
  /** The bill's header discount share of this line (a total for the quantity billed), as the server sends it. */
  billDiscount = 0;
  /** Kept for the payload the server still reads; the credit maths no longer prorates over the bill totals. */
  sourceBillTotalBeforeTax = 0;
  sourceBillTotalAfterTax = 0;
  discountIncludesTax = false;
  supplierCreditDiscount = 0;
  /** Share of the line discount / bill discount that belongs to the returned qty, calculated from the billed values. */
  creditDiscountTotal = 0;
  creditBillDiscount = 0;
  /** What the other credits of the line already took; null when the server did not send it (estimated from the qty). */
  returnedDiscountTotal: number | null = null;
  returnedSupplierDiscountTotal: number | null = null;
  /** Line total after the discount of the bill. */
  netTotal = 0;

  /** The credit's maths sets the line total; nothing is recalculated per line. */
  override calculateAmount(): number { return this.total; }

  /** The share of the bill line's discount matching the quantity credited. */
  get appliedDiscount(): number { return this.creditDiscountTotal; }

  get amountBeforeTax(): number {
    return MathUtils.sub2(MathUtils.multiply2(this.unitCost, this.qty), this.creditDiscountTotal);
  }

  /** What the other credits of the bill line already returned; a saved credit does not count its own qty. */
  get returnedQtyBefore(): number {
    const own = this.id ? this.tempQty : 0;
    return Math.max(0, this.billingQty - this.maxQty - own);
  }

  /** The billed discount of the line: the credit being edited keeps its own share in discountTotal. */
  private get billedDiscountTotal(): number {
    return this.billingDiscountTotal > 0 ? this.billingDiscountTotal : (this.id ? 0 : this.discountTotal);
  }

  /** Same allocation as the server: a share of the billed value for the qty, the last return takes what is left. */
  private allocatePartialReturn(totalValue: number, alreadyReturnedTotal: number | null): number {
    const totalQty = this.billingQty;
    const alreadyReturnedQty = this.returnedQtyBefore;
    if (!totalValue || totalValue <= 0 || !totalQty || this.qty <= 0) return 0;

    const share = (qty: number) => MathUtils.roundDecimal(MathUtils.division2(MathUtils.multiply2(totalValue, qty), totalQty));
    let returned = share(this.qty);
    if (alreadyReturnedQty + this.qty >= totalQty) {
      const before = alreadyReturnedTotal ?? share(alreadyReturnedQty);
      const left = MathUtils.sub2(totalValue, before);
      if (MathUtils.add2(before, returned) != totalValue && left >= 0) returned = left;
    }
    return returned;
  }

  /** Same line calculation as the server (calculateCreditNoteLine); never changes the billed values, so it can run again on any qty. */
  calculateTotal(): void {
    const qty = Math.max(0, this.qty);
    this.subTotal = MathUtils.multiply2(this.unitCost, qty);
    this.creditDiscountTotal = this.allocatePartialReturn(this.billedDiscountTotal, this.returnedDiscountTotal);
    this.creditBillDiscount = this.allocatePartialReturn(this.billDiscount, this.returnedSupplierDiscountTotal);

    const hasTax = !!this.taxId;
    let baseAmount = this.subTotal;
    this.taxTotal = 0;
    if (hasTax) {
      this.calculateTax(this.subTotal);
      if (this.isInclusiveTax) baseAmount = baseAmount - this.taxTotal; // plain subtraction, as the server
    }

    let discount = this.creditDiscountTotal;
    if (discount > 0 && this.discountAmount > 0 && this.isInclusiveTax && this.discountIncludesTax) {
      const lineTax = this.taxTotal;
      this.calculateTax(discount);
      discount = discount - this.taxTotal; // plain subtraction, as the server
      this.taxTotal = lineTax;
    }

    this.taxableAmount = MathUtils.sub2(baseAmount, discount);
    this.taxTotal = 0;
    if (hasTax) this.calculateTax(this.taxableAmount, false);
    this.total = MathUtils.add2(this.taxableAmount, this.taxTotal);
    this.netTotal = this.total;
  }

  /** Same tax rules as the server and at full precision; the rounding is done once on the credit. `isInclusiveTax` overrides the line setting. */
  override calculateTax(subTotal: number, isInclusiveTax: boolean = this.isInclusiveTax): void {
    if (this.taxPercentage == 0) { this.taxTotal = 0; return; }

    if (this.taxes && this.taxes.length > 0 && this.taxType) {
      const isFlat = this.taxType == 'flat';
      let base = subTotal;
      if (isInclusiveTax) {
        const divisor = this.taxes.reduce(
          (acc: number, tax: any) => isFlat
            ? MathUtils.add2(acc, MathUtils.division2(tax.taxPercentage, 100))
            : MathUtils.multiply2(acc, MathUtils.add2(1, MathUtils.division2(tax.taxPercentage, 100))),
          1);
        base = MathUtils.division2(subTotal, divisor);
      }
      let taxTotal = 0;
      let running = base;
      this.taxes.forEach((tax: any) => {
        const taxAmount = MathUtils.multiply2(isFlat ? base : running, MathUtils.division2(tax.taxPercentage, 100));
        taxTotal = MathUtils.add2(taxTotal, taxAmount);
        running = MathUtils.add2(running, taxAmount);
        tax.taxAmount = taxAmount;
      });
      this.taxTotal = taxTotal;
    } else {
      this.taxTotal = isInclusiveTax
        ? MathUtils.division2(MathUtils.multiply2(subTotal, this.taxPercentage), MathUtils.add2(100, this.taxPercentage))
        : MathUtils.multiply2(subTotal, MathUtils.division2(this.taxPercentage, 100));
    }
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
  /** What the other credits of the bill already took; set by the server for a credit of one bill. */
  billReturned: { total: number; amount: number; rounding: number } | null = null;
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

  override calculateTotal(): void {
    // Same rules as the server (supplierCredit.calculateTotal). Every line is calculated from the billed values only,
    // so changing the qty down and back up gives the same result.
    const lines = this.liveLines;

    let linesTotal = 0;
    let billDiscountTotal = 0;
    let discountBeforeTax = false;
    let taxTotal = 0;
    let totalWithoutTax = 0;

    lines.forEach(line => {
      line.isInclusiveTax = this.isInclusiveTax;
      line.calculateTotal();

      // the line total does not include the discount of the bill: the credit total takes it off (after tax) or the lines do (before tax)
      let net = line.total;
      let lineTotal = line.total;
      if (line.creditBillDiscount > 0) {
        billDiscountTotal = MathUtils.add2(billDiscountTotal, line.creditBillDiscount);
        if (this.applyDiscountBeforeTax ?? true) {
          discountBeforeTax = true;
          const newBase = MathUtils.sub2(MathUtils.sub2(line.total, line.taxTotal), line.creditBillDiscount);
          line.calculateTax(newBase, false);
          line.taxableAmount = newBase;
          net = MathUtils.add2(newBase, line.taxTotal);
          lineTotal = net;
        } else {
          net = MathUtils.sub2(line.total, line.creditBillDiscount);
        }
      }
      line.netTotal = net;
      linesTotal = MathUtils.add2(linesTotal, lineTotal);
      taxTotal = MathUtils.add2(taxTotal, line.taxTotal);
      totalWithoutTax = MathUtils.add2(totalWithoutTax, MathUtils.sub2(net, line.taxTotal));
    });

    this.creditDiscount = billDiscountTotal;
    this.discountTotal = billDiscountTotal;
    this.totalTax = taxTotal;
    this.invoiceTaxTotal = taxTotal;
    this.totalWithoutTax = totalWithoutTax;
    this.itemTotalWithoutTax = totalWithoutTax;

    const afterDiscount = discountBeforeTax ? linesTotal : MathUtils.sub2(linesTotal, billDiscountTotal);
    this.total = MathUtils.add2(afterDiscount, this.deliveryCharge ?? 0);
    this.subTotal = this.total;

    this.calculateLineRounding(lines);
    this.total = MathUtils.add2(this.total, this.roundingTotal);
  }

  /** The rounding to add to the amount to reach the smallest currency, same rounding types as the server. */
  private roundingOf(amount: number): number {
    const units = MathUtils.division2(amount, this.smallestCurrency);
    let rounded = amount;
    if (this.roundingType == 'normal') rounded = MathUtils.multiply2(Math.round(units), this.smallestCurrency);
    if (this.roundingType == 'positive') rounded = MathUtils.multiply2(Math.ceil(units), this.smallestCurrency);
    if (this.roundingType == 'negative') rounded = MathUtils.multiply2(Math.trunc(units), this.smallestCurrency);
    return MathUtils.sub2(rounded, amount);
  }

  /**
   * Every line is rounded on its own; the rounding of the credit is the sum of the rounding of the lines.
   * What the shipping leaves to reach the smallest currency goes to the last line.
   * When the lines plus what the bill already got back reach the bill total, the credit settles: the lines take
   * what is left of the bill total and the difference goes to the rounding of the last line, so the credits of
   * the bill add up to the bill total.
   */
  private calculateLineRounding(lines: SupplierCreditLine[]): void {
    if (!this.smallestCurrency) {
      this.smallestCurrency = MathUtils.division2(1, Math.pow(10, MathUtils.afterDecimal));
      this.roundingType = 'normal';
    }

    let rounding = 0;
    lines.forEach(line => {
      line.roundingTotal = this.roundingOf(line.netTotal);
      rounding = MathUtils.add2(rounding, line.roundingTotal);
    });

    const lastLine = lines[lines.length - 1];
    if (this.billReturned && lastLine) {
      const linesTotal = lines.reduce((sum, line) => MathUtils.add2(sum, line.netTotal), 0);
      const returnedWithLines = MathUtils.add2(this.billReturned.amount, linesTotal);
      const reachesBillTotal = MathUtils.add2(returnedWithLines, this.roundingOf(returnedWithLines)) >= this.billReturned.total;
      if (reachesBillTotal) {
        const remaining = MathUtils.sub2(this.billReturned.total, MathUtils.add2(this.billReturned.amount, this.billReturned.rounding));
        const settledRounding = MathUtils.sub2(remaining, linesTotal);
        lastLine.roundingTotal = MathUtils.add2(lastLine.roundingTotal, MathUtils.sub2(settledRounding, rounding));
        rounding = settledRounding;
      }
    }

    const left = this.roundingOf(MathUtils.add2(this.total, rounding));
    if (left != 0 && lastLine) lastLine.roundingTotal = MathUtils.add2(lastLine.roundingTotal, left);
    this.roundingTotal = MathUtils.add2(rounding, left);
  }
}
