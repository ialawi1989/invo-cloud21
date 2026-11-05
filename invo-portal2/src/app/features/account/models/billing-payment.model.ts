import { MathUtils } from '@core/math/math-helpers';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** One bill a payment settles: what the bill totals, what was already paid, and this payment's share (`amount`). */
export class BillingPaymentLine {
  id: string | null = null;
  billingId = '';
  billingPaymentId = '';
  billingDate: Date | string = new Date();
  branchId = '';
  branchName = '';
  amount = 0;
  billingNumber = '';
  total = 0;
  paidAmount = 0;
  createdAt: Date | string = new Date();
  isNew = false;
  openingBalanceId: string | null = null;
  /** Set by the branch filter of the form: lines of other branches are hidden (and skipped when amounts are spread). */
  showInFilter: boolean | null = null;

  setShowInFilter(branchFilter: string): void { this.showInFilter = branchFilter === 'all' || this.branchId === branchFilter; }
  get calculateAmountDue(): number { return MathUtils.sub(this.total, this.paidAmount); }

  ParseJson(json: any): void {
    for (const key in json) if (key in this) (this as any)[key] = json[key];
  }
}

/**
 * Bill payment (legacy `BillingPayment`): money paid to a supplier through a payment method, spread over
 * the supplier's open bills. Whatever is paid beyond the bills stays with the supplier as `unusedAmount`
 * (a prepaid credit); the payment is held in the method's currency (`tenderAmount`) and converted with `rate`.
 */
export class BillingPayment {
  id: string | null = null;
  branchId = '';
  branchName = '';
  attachment: any[] = [];
  total = 0;
  supplierId = '';
  supplierName = '';
  supplierEmail = '';
  accountId: string | null = null;
  mediaId = '';
  mediaUrl = '';
  createdAt: Date | string = new Date();
  employeeId = '';
  employeeName = '';
  lines: BillingPaymentLine[] = [];
  paymentName = '';
  /** Total settled on bills; > 0 on a saved payment. */
  paidAmount = 0;
  prevPaidAmount = 0;
  isReflected = false;
  unusedAmount = 0;
  paymentDate: Date | string = new Date();
  code: any = null;
  rate = 1;
  tenderAmount: number = 0;
  openingBalanceId = '';
  referenceNumber = '';
  reconciled = false;
  accountBalance = 0;
  paymentMethodId = '';
  paymentMethodName = '';
  paymentMethodType = '';
  accountName = '';

  constructor() {
    this.lines.push(new BillingPaymentLine());
  }

  calculateTotal(): number {
    this.total = this.lines.reduce((s, l) => (l.amount != null ? MathUtils.add(s, l.amount) : s), 0);
    return this.total;
  }

  get equivalentAmount(): number { return MathUtils.multiply(this.tenderAmount, this.rate); }
  get calculateAmountInExcess(): number { return MathUtils.sub(this.equivalentAmount, this.calculateTotal()); }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key === 'lines') {
        this.lines = (json[key] ?? []).map((l: any) => { const line = new BillingPaymentLine(); line.ParseJson(l); return line; });
      } else if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }

  static today(): string { return ymd(new Date()); }
}
