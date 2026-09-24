import { MathUtils } from '@core/math/math-helpers';
import { CustomerAddress } from '../customers/models/customer.model';

export class InvoicePayment {
  id: string | null = null;
  paymentName: string = '';
  mediaId: string = '';
  mediaUrl: string = '';
  branchId = '';
  branchAddress = '';
  accountId: string | null = '';
  accountName: string | null = '';
  tenderAmount = 0;
  createdAt = new Date();
  paymentDate = new Date();
  lines: InvoicePaymentLine[] = [];
  paymentMethodId = '';
  paymentMethodType = '';
  customerName: string = '';
  customerEmail: string = "";
  customerContact: string = '';
  customerId: any = '';
  customerAddress: CustomerAddress = new CustomerAddress();
  branchName: string = '';
  referenceNumber: string = '';
  paidAmount: number = 0;
  prevPaidAmount = 0;
  isReflected = false;
  employeeName = '';
  unusedAmount = 0;
  code: any = null;
  invoiceNumber: any = null;
  invoicesNumber: any = null;
  rate = 1;
  attachment: any[] = [];
  bankCharge = 0;
  bankChargePercentage = 0;
  reconciled = false;
  currencyId: string = '';
  paymentMethodName = '';
  changeAmount = 0;

  // for preview
  accountBalance = 0;

  calculateChangeAmount() {
    // Both sides in tender currency: the lines total is held in base currency,
    // so it has to come back through the rate before it can be compared with
    // (or subtracted from) the tender.
    const settledInTenderCurrency = MathUtils.division(this.calculateTotal, this.rate);
    if (this.tenderAmount > settledInTenderCurrency) {
      this.changeAmount = MathUtils.sub(this.tenderAmount, settledInTenderCurrency);
    } else {
      this.changeAmount = 0;
    }
  }

  get calculateTotal() {
    let _total = 0;
    this.lines.forEach((element) => {
      if (element.amount != null)
        _total = MathUtils.add(_total, element.amount)
    });
    // this.total = this.paidAmount;
    return _total;
  }

  get equivalentAmount() {
    return MathUtils.multiply(this.tenderAmount, this.rate);
  }

  get changeEquivalentAmount() {
    return MathUtils.multiply(this.changeAmount, this.rate);
  }

  equivalentAmounts = 0;
  equivalentAmountSinglePayment() {
    this.equivalentAmounts = MathUtils.multiply(this.lines[0].amount , this.rate);
  }

  get calculateAmountInExcess() {
    return MathUtils.sub(
      MathUtils.sub(this.equivalentAmount, this.calculateTotal),
      this.changeEquivalentAmount
    );
  }

  constructor() {
    // let temp = new InvoicePaymentLine();
    // this.lines.push(temp);
  }
  ParseJson(json: any): void {
    let _line: InvoicePaymentLine;
    let temp;
    for (const key in json) {
      if (key == 'customerName') {
        if (json[key] == '' || json[key] == null) {
          this.customerName = 'WalkIn Customer';
        } else {
          this.customerName = json[key];
        }
      } else if (key == 'lines') {
        this.lines = [];
        temp = json[key];
        for (const propName in temp) {
          _line = new InvoicePaymentLine();
          _line.ParseJson(temp[propName]);
          this.lines.push(_line);
        }
      } else if (key == 'customerAddress') {
        const _customerAddress = new CustomerAddress();
        _customerAddress.ParseJson(json[key]);
        this.customerAddress = _customerAddress;
      } else {
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
      }
      if (this.customerName == 'WalkIn Customer') {
        this.customerId = 'WalkIn Customer';
      }
    }
  }
}

export class InvoicePaymentLine {
  id: string | null = null;
  invoicePaymentId = '';
  invoiceId = '';
  branchId = '';
  branchName = '';
  amount = 0;
  isNew = false;
  createdAt = new Date();
  paymentDate = new Date();
  invoiceNumber: string = '';
  invoiceAmount: number = 0;
  total = 0;
  paidAmount = 0;
  refunded = 0;
  invoiceDate = new Date();
  openingBalanceId: string | null = null;
  get calculateAmountDue() {
    return MathUtils.add(
      MathUtils.sub(this.total, this.paidAmount),
      this.refunded
    );
  }

  // for display only
  showInFilter: boolean | null = null;

  setShowInFilter(lineFilter: string): void {
    this.showInFilter = lineFilter === 'All' || this.branchId === lineFilter;
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
