import { MathUtils } from '@core/math/math-helpers';
import { Invoice } from './invoice.model';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Estimate = the sales-document shape of an invoice (same lines, taxes, charges) with the estimate
 * header (`estimateNumber`, `estimateDate`, `estimateExpDate`) and the backend's estimate maths:
 * the document discount comes off the taxed line total, the surcharge is a share of what is left,
 * then delivery and rounding. There is no status — an estimate is only "converted" once an
 * invoice is linked (`invoiceId`).
 */
export class Estimate extends Invoice {
  estimateNumber = '';
  estimateDate: Date | string = new Date();
  estimateExpDate: Date | string = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return ymd(d); })();
  invoiceId = '';
  isInvoice = false;

  constructor() {
    super();
    this.applyDiscountBeforeTax = false;
  }

  /** Lines flagged `isDeleted` (removed in the form, deleted by the backend on save) take no part in the totals. */
  override itemTotal(): number {
    let price = 0;
    let subTotal = 0;
    let taxTotal = 0;
    this.lines.forEach(line => {
      if ((line as any).isDeleted) return;
      line.isInclusiveTax = this.isInclusiveTax;
      line.invoiceDiscount = 0;
      line.calculateAmount();
      price += line.total;
      subTotal += MathUtils.sub(line.subTotal, line.discountTotal);
      taxTotal += line.taxTotal;
    });
    this.invoiceTaxTotal = taxTotal;
    this.itemSubTotal = subTotal;
    return price;
  }

  override calculateTotal(): void {
    this.subTotal = this.itemTotal();
    this.total = this.subTotal;
    this.itemTotalWithoutTax = MathUtils.sub2(this.total, this.invoiceTaxTotal);

    this.discountTotal = 0;
    if (this.discountAmount > 0 && this.discountType !== 'itemDiscount') {
      this.discountTotal = this.discountPercentage
        ? MathUtils.multiply(this.subTotal, MathUtils.division(this.discountAmount, 100))
        : this.discountAmount;
    }
    this.total = MathUtils.sub(this.total, this.discountTotal);

    this.chargeTotal = this.chargeAmount;
    if (this.chargeAmount > 0) {
      if (this.chargePercentage) this.chargeTotal = MathUtils.multiply(this.total, MathUtils.division(this.chargeAmount, 100));
      this.total = MathUtils.add(this.total, this.chargeTotal);
    }

    this.total = MathUtils.add(this.total, this.deliveryCharge);
    this.calculateRounding(MathUtils.afterDecimal);
    this.total = MathUtils.add(this.total, this.roundingTotal);
  }
}
