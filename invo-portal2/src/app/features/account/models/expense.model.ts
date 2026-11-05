import { MathUtils } from '@core/math/math-helpers';
import { Invoice, InvoiceLine } from './invoice.model';

/**
 * One line of an expense (legacy `ExpenseLine`): an account the money went to, an amount, a tax and a note -
 * no product. It reuses the shared line shape, where the amount is `price` (`amount` is the same number
 * under the name the backend knows).
 */
export class ExpenseLine extends InvoiceLine {
  expenseId = '';

  override get amount(): number { return this.price; }
  override set amount(v: number) { this.price = v; }

  override calculateAmount(): number {
    let total = Number(this.price) || 0;
    this.subTotal = total;
    if (this.taxId != null && this.taxId !== '') {
      this.calculateTax(total);
      if (!this.isInclusiveTax) total = MathUtils.add(total, this.taxTotal);
    } else {
      this.taxTotal = 0;
    }
    this.total = total;
    return total;
  }
}

/**
 * Expense (legacy `Expense`): money paid out of a payment method to expense accounts, optionally to a supplier
 * and billable to a customer. Total = sum of the lines (tax added unless inclusive) plus the rounding. A
 * reconciled expense (matched in a bank reconciliation) can no longer be changed or deleted.
 */
export class Expense extends Invoice {
  expenseNumber = '';
  expenseDate: Date | string = new Date();
  referenceNumber = '';
  supplierId: string | null = null;
  supplierName: string | null = '';
  supplierEmail = '';
  override paymentMethodId = '';
  paymentMethodName = '';
  paidThroughAccountId = '';
  accountName = '';
  reconciled = false;
  description = '';

  constructor() {
    super();
    this.lines = [new ExpenseLine()];
  }

  override ParseJson(json: any): void {
    const { lines, ...rest } = json ?? {};
    super.ParseJson(rest);
    if (lines) this.lines = (lines as any[]).map(l => { const line = new ExpenseLine(); line.ParseJson(l); return line; });
  }

  get liveLines(): ExpenseLine[] { return (this.lines as ExpenseLine[]).filter(l => !(l as any).isDeleted); }

  override itemTotal(): number { this.calculateTotal(); return this.total; }

  override calculateTotal(): void {
    let total = 0;
    let tax = 0;
    this.liveLines.forEach(l => {
      l.isInclusiveTax = this.isInclusiveTax;
      total = MathUtils.add(total, l.calculateAmount());
      tax = MathUtils.add(tax, l.taxTotal);
    });
    this.invoiceTaxTotal = tax;
    this.itemTotalWithoutTax = MathUtils.sub(total, tax);
    this.total = total;
    this.calculateRounding(MathUtils.afterDecimal);
    this.total = MathUtils.add(this.total, this.roundingTotal);
    this.subTotal = this.total;
  }
}
