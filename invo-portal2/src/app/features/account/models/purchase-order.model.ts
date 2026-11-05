import { MathUtils } from '@core/math/math-helpers';
import { Invoice, InvoiceLine } from './invoice.model';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * One line of a purchase document (purchase order, bill, supplier credit …): a product (or a free
 * note), the quantity, the `unitCost` and a tax. It reuses the shared line table / editor, which work
 * on `price` - `unitCost` is the same number under the name the backend knows. There is no discount
 * on a purchase order line.
 */
export class PurchaseOrderLine extends InvoiceLine {
  purchaseOrderId = '';
  barcode = '';
  /** Supplier item code. */
  SIC = '';
  isDeleted = false;
  /** Where the proposed cost came from (display only): `supplierCost` | `productCost`. */
  typeOfCost = '';
  /** Quantity not yet converted into a bill. */
  remainingQty = 0;

  get unitCost(): number { return this.price; }
  set unitCost(v: number) { this.price = v; }

  override calculateAmount(): number {
    let total = MathUtils.multiply(this.price, this.qty);
    this.subTotal = total;
    this.discountedAmount = 0;
    this.discountTotal = 0;

    if (this.taxId != '' && this.taxId != null) {
      this.calculateTax(total);
      if (!this.isInclusiveTax) total = MathUtils.add2(total, this.taxTotal);
    } else {
      this.taxTotal = 0;
    }
    this.total = total;
    this.taxableAmount = MathUtils.sub2(this.total, this.taxTotal);
    return total;
  }

  /** The tax of a supplier abroad (bill of entry) - purchase documents carry none. */
  clearTax(): void {
    this.taxId = null;
    this.taxPercentage = 0;
    this.taxType = '';
    this.taxes = [];
    this.taxTotal = 0;
  }
}

/**
 * Purchase order = the document shape of an invoice (lines, taxes, rounding, attachments, custom
 * fields) with the purchase header (`purchaseNumber`, `purchaseDate`, expiry = `dueDate`, supplier) and
 * the backend's maths: the total is the sum of the lines plus the rounding - no discount, charge or
 * delivery. The status (`Not Converted` / `Partially Converted` / `Fully Converted`) is set by the server
 * as bills are made from it.
 */
export class PurchaseOrder extends Invoice {
  purchaseNumber = '';
  reference = '';
  supplierId = '';
  supplierName = '';
  supplierEmail = '';
  supplierVatNumber = '';
  /** Not part of the purchase order record: the view fills them from the supplier for the document paper. */
  supplierPhone = '';
  supplierAddress = '';
  purchaseDate: Date | string = new Date();
  /** The supplier is abroad: purchase documents carry no tax (the bill of entry takes it). */
  internationalSupplier = false;
  /** At least one bill was made from it. */
  isBill = false;
  billingId = '';
  billingNumber = '';
  purchaseTaxTotal = 0;

  constructor() {
    super();
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    this.dueDate = ymd(d);
    const first = new PurchaseOrderLine();
    first.isNew = true;
    this.lines = [first];
  }

  get isExpired(): boolean { return new Date(this.dueDate).getTime() <= Date.now(); }

  override ParseJson(json: any): void {
    const { lines, ...rest } = json ?? {};
    super.ParseJson(rest);
    if (lines) {
      this.lines = (lines as any[]).map(l => {
        const line = new PurchaseOrderLine();
        line.ParseJson(l);
        return line;
      });
    }
  }

  /** Lines flagged `isDeleted` (removed in the form, deleted by the backend on save) take no part in the totals. */
  override itemTotal(): number {
    let total = 0;
    let subTotal = 0;
    let taxTotal = 0;
    this.lines.forEach(line => {
      if ((line as any).isDeleted) return;
      line.isInclusiveTax = this.isInclusiveTax;
      line.calculateAmount();
      total += line.total;
      taxTotal += line.taxTotal;
      subTotal += line.subTotal;
    });
    this.invoiceTaxTotal = taxTotal;
    this.purchaseTaxTotal = taxTotal;
    this.itemSubTotal = subTotal;
    return total;
  }

  override calculateTotal(): void {
    this.subTotal = this.itemTotal();
    this.total = this.subTotal;
    this.itemTotalWithoutTax = MathUtils.sub2(this.total, this.invoiceTaxTotal);
    this.calculateRounding(MathUtils.afterDecimal);
    this.total = MathUtils.add(this.total, this.roundingTotal);
  }
}
