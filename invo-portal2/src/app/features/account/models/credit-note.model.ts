import { MathUtils } from '@core/math/math-helpers';
import { Invoice, InvoiceLine } from './invoice.model';
import { TaxLineModel } from './tax.model';

/**
 * One line of a credit note: the line of the invoice being credited (`invoiceLineId`), credited up to
 * `maxQty`, or a free "note" line when the credit note is not tied to an invoice. A credited line keeps
 * the price / discount / tax it was invoiced with; only the quantity is credited.
 *
 * Besides the line maths it holds the credit note's share of the invoice (transaction) level discount —
 * the part of the line's share matching the quantity credited — together with the tax that share removed.
 */
export class CreditNoteLine extends InvoiceLine {
  creditNoteId: any = '';
  invoiceLineId = '';
  isDeleted = false;
  isImported = false;
  tempMaxQty = 0;

  /** the share of the invoice level discount this credit note gives back for the line */
  creditNoteDiscount = 0;

  /**
   * Same line maths as an invoice line, but WITHOUT re-applying the invoice level discount to the tax:
   * here `invoiceDiscount` is the share of the whole invoiced line, and the credit note divides it by the
   * credited quantity itself ({@link calculateInvoiceDiscountShare}).
   */
  override calculateAmount(): number {
    let optionTotal = 0;
    this.options.forEach(o => { optionTotal += this.qty * o.qty * o.price; });

    let total = this.price * this.qty + optionTotal;
    this.discountedAmount = this.discountPercentage ? (total * this.discountAmount) / 100 : this.discountAmount;
    total = MathUtils.sub(total, this.discountedAmount);

    if (this.taxId != '' && this.taxId != null) {
      this.calculateTax(total);
      if (!this.isInclusiveTax) total = MathUtils.add(total, this.taxTotal);
    }
    this.total = total;
    return total;
  }

  /** What the line would be worth credited in full (`maxQty`). */
  get amountMaxQty(): number {
    const qty = this.qty;
    this.qty = this.maxQty;
    const total = this.calculateAmount();
    this.qty = qty;
    this.calculateAmount();
    return total;
  }

  /** The net value the tax is really due on: what is left after the line discount and the invoice-discount share. */
  setTaxableAmount(): void {
    this.taxableAmount = MathUtils.sub2(MathUtils.sub2(this.total, this.taxTotal), this.creditNoteDiscount);
  }

  /**
   * The share of the invoice (transaction) level discount that belongs to this line. The invoice spreads its
   * discount over its lines (`invoiceDiscount`, with the tax that share removed in `invoiceLineTaxReduction`);
   * a credit note gives back the part matching the credited qty, and the last credit note of a line takes what
   * the previous ones left, so the shares of a line always add up to what the invoice gave it. This is the same
   * division the backend makes on save, so the form shows the total the credit note will really hold.
   */
  calculateInvoiceDiscountShare(): void {
    this.creditNoteDiscount = 0;
    this.taxReduction = 0;

    const lineDiscount = Number(this.invoiceDiscount ?? 0);
    const lineQty = Number(this.invoiceLineQty ?? 0);
    if (lineDiscount == 0 || !lineQty) { this.setTaxableAmount(); return; }

    const lineTaxReduction = Number(this.invoiceLineTaxReduction ?? 0);

    if (this.qty == lineQty) {
      this.creditNoteDiscount = lineDiscount;
      this.taxReduction = lineTaxReduction;
      this.setTaxableAmount();
      return;
    }

    const creditedQty = Number(this.creditNoteQty ?? 0);
    const creditedDiscount = Number(this.creditNoteInvoiceDiscount ?? 0);
    const creditedTaxReduction = Number(this.creditNoteTaxReduction ?? 0);

    if (MathUtils.add2(this.qty, creditedQty) == lineQty) {
      // the last credit note of the line takes exactly what the previous ones left (absorbs their rounding)
      this.creditNoteDiscount = MathUtils.sub2(lineDiscount, creditedDiscount);
      this.taxReduction = MathUtils.sub2(lineTaxReduction, creditedTaxReduction);
    } else {
      // partially credited: the share of the credited qty, floored to whole minor units of the currency
      const unit = MathUtils.tenToPowAfterDecimal();
      const flooredShare = (amount: number) =>
        MathUtils.division2(
          Math.floor(MathUtils.division2(MathUtils.multiply2(Math.round(MathUtils.multiply2(amount, unit)), this.qty), lineQty)),
          unit,
        );

      if (this.isInclusiveTax) {
        const grossShare = flooredShare(MathUtils.add2(lineDiscount, lineTaxReduction));
        this.taxReduction = this.taxRemoved(MathUtils.sub2(this.total, grossShare));
        this.creditNoteDiscount = MathUtils.sub2(grossShare, this.taxReduction);
      } else {
        this.creditNoteDiscount = flooredShare(lineDiscount);
        const net = MathUtils.sub2(this.total, this.taxTotal);
        this.taxReduction = this.taxRemoved(MathUtils.sub2(net, this.creditNoteDiscount));
      }
    }
    this.setTaxableAmount();
  }

  /** The tax this line gives up when a share of the invoice discount is taken off it. */
  private taxRemoved(remaining: number): number {
    let taxLeft = 0;
    if (remaining > 0 && this.taxId != null && this.taxId != '' && this.taxPercentage != 0) {
      if (this.taxes && this.taxes.length > 0) {
        let base = remaining;
        this.taxes.forEach((tax: TaxLineModel) => {
          const amount = this.isInclusiveTax
            ? MathUtils.division2(MathUtils.multiply2(base, tax.taxPercentage), 100 + tax.taxPercentage)
            : MathUtils.multiply2(base, tax.taxPercentage / 100);
          taxLeft = MathUtils.add2(taxLeft, amount);
          if (this.taxType == 'stacked') base = MathUtils.add2(base, amount);
        });
      } else {
        taxLeft = this.isInclusiveTax
          ? MathUtils.division2(MathUtils.multiply2(remaining, this.taxPercentage), 100 + this.taxPercentage)
          : MathUtils.multiply2(remaining, this.taxPercentage / 100);
      }
      taxLeft = MathUtils.roundDecimal(taxLeft);
    }
    const removed = MathUtils.sub2(this.taxTotal, taxLeft);
    return removed > 0 ? removed : 0;
  }
}

/** Credit note = the sales-document shape of an invoice (customer, branch, lines, charges) plus the credit-note header and maths. */
export class CreditNote extends Invoice {
  creditNoteNumber = '';
  creditNoteDate: Date | string = new Date();
  invoiceId: any = '';
  appliedAmount = 0;
  refundedAmount = 0;
  usedCredit = 0;
  remainingCredit = 0;

  creditTaxTotal = 0;
  /** true when the credited invoice spread its discount over its lines: the share is not entered by hand */
  linesHoldTheDiscount = false;

  // The charge only follows the credit note while ALL of the invoice is credited; these remember the invoice's.
  tempChargeId: string | null = null;
  tempChargesTaxDetails: any = null;
  tempChargeAmount = 0;
  totalremaining = 0;
  tempLines: CreditNoteLine[] = [];

  constructor() {
    super();
    this.discountPercentage = false;
  }

  get creditLines(): CreditNoteLine[] { return this.lines as CreditNoteLine[]; }
  private get activeLines(): CreditNoteLine[] { return this.creditLines.filter(l => !l.isDeleted); }

  override get lineTotal(): number {
    let price = 0;
    this.activeLines.forEach(l => { l.isInclusiveTax = this.isInclusiveTax; price += l.amount; });
    return price;
  }

  /** What the lines still hold if the whole invoice were credited (decides whether the charge is kept). */
  calculateTotalRemenaing(): void {
    this.totalremaining = 0;
    this.tempLines.forEach(l => { if (l.maxQty != 0) this.totalremaining += l.amountMaxQty; });
    this.chargeAmount = this.tempChargeAmount;
  }

  /**
   * Keeps the invoice's charge only while the WHOLE invoice is credited; otherwise drops it (legacy `resetCharge`,
   * run on every qty / price / line change). Credit notes not built from an invoice have nothing to compare to.
   */
  private resetCharge(): void {
    if (!this.tempLines.length) return;
    this.calculateTotalRemenaing();
    this.computeTotal();
    if (this.subTotal == this.totalremaining) {
      this.chargeId = this.tempChargeId;
      this.chargesTaxDetails = this.tempChargesTaxDetails;
      this.chargeAmount = this.tempChargeAmount;
    } else {
      this.chargeAmount = 0;
      this.chargeTotal = 0;
      this.chargeId = null;
      this.chargesTaxDetails = null;
    }
  }

  override calculateTotal(): void {
    this.resetCharge();
    this.computeTotal();
  }

  private manualDiscount(): number {
    return this.discountPercentage ? this.lineTotal * (this.discountAmount / 100) : this.discountAmount;
  }

  /** Spreads the invoice level discount over the credited lines; returns the tax of the lines and whether the invoice holds the shares. */
  private applyInvoiceDiscountShares(): { taxTotal: number; linesHoldTheDiscount: boolean } {
    this.discountTotal = 0;
    this.taxReduction = 0;
    const lines = this.activeLines;
    // Decided once for the whole invoice: a line of an invoice that holds its shares may have a share of 0.
    const linesHoldTheDiscount = lines.some(l => Number(l.invoiceDiscount ?? 0) != 0);

    let taxTotal = 0;
    lines.forEach(line => {
      line.isInclusiveTax = this.isInclusiveTax;
      line.calculateAmount();
      taxTotal = MathUtils.add2(taxTotal, line.taxTotal);
      if (!linesHoldTheDiscount) return;
      line.calculateInvoiceDiscountShare();
      this.discountTotal = MathUtils.add2(this.discountTotal, line.creditNoteDiscount);
      this.taxReduction = MathUtils.add2(this.taxReduction, line.taxReduction);
    });
    return { taxTotal, linesHoldTheDiscount };
  }

  private computeTotal(): void {
    this.subTotal = this.lineTotal;

    const shares = this.applyInvoiceDiscountShares();
    this.linesHoldTheDiscount = shares.linesHoldTheDiscount;
    this.itemTotalWithoutTax = MathUtils.sub2(this.subTotal, shares.taxTotal);

    this.total = this.subTotal;

    if (shares.linesHoldTheDiscount) {
      this.discountAmount = this.discountTotal;
      if (this.discountTotal != 0) {
        this.total = MathUtils.sub2(this.total, this.discountTotal);
        // the discount was taken before tax on the invoice, so the tax it removed was never charged and is not refunded
        this.total = MathUtils.sub2(this.total, this.taxReduction);
      }
    } else if (this.discountAmount > 0) {
      // an invoice made before the discount was spread over its lines keeps the previous behaviour
      this.discountTotal = this.manualDiscount();
      this.total -= this.discountTotal;
    }

    this.creditTaxTotal = MathUtils.sub2(shares.taxTotal, this.taxReduction);
    this.discountTotalWithTax = this.isInclusiveTax ? MathUtils.add2(this.discountTotal, this.taxReduction) : this.discountTotal;

    if (this.chargeAmount > 0) {
      this.total = MathUtils.add(this.total, this.chargeTotal);
      this.calculateChargeTax(this.chargeTotal);
      if (this.chargesTaxDetails) {
        this.creditTaxTotal = MathUtils.add2(this.creditTaxTotal, this.chargesTaxDetails.taxAmount);
        if (!this.isInclusiveTax) this.total = MathUtils.add(this.total, this.chargesTaxDetails.taxAmount);
      }
    }

    this.total = MathUtils.add(this.total, this.deliveryCharge);
    // the shared totals block reads the tax from here
    this.invoiceTaxTotal = this.creditTaxTotal;
  }

  override ParseJson(json: any): void {
    super.ParseJson(json);
    const raw = json?.lines;
    if (raw) {
      this.lines = [];
      for (const k in raw) {
        const l = new CreditNoteLine();
        l.ParseJson(raw[k]);
        this.lines.push(l);
      }
    }
    if (json && 'customerName' in json && !json.customerName) this.customerName = 'WalkIn Customer';
    this.tempChargeId = this.chargeId;
    this.tempChargesTaxDetails = this.chargesTaxDetails;
    this.tempChargeAmount = this.chargeAmount;
    this.tempLines = this.creditLines;
  }
}
