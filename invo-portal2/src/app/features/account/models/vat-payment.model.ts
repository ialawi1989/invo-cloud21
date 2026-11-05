import { MathUtils } from '@core/math/math-helpers';

/** One payment made against a VAT return (`VatPaymentLines`). */
export class VatPaymentLine {
  id: string | null = '';
  vatPaymentId = '';
  amount = 0;
  netVat = 0;
  paymentMethodId = '';
  paymentMethodName = '';
  paymentMethodAccountId = '';
  employeeId = '';
  paymentDate: any = null;
  reconciliationId = '';
  createdAt: Date | string = new Date();
  referenceNumber = '';
  branchId: string | null = '';

  ParseJson(json: any): void {
    for (const key in json) if (key in this) (this as any)[key] = json[key];
  }
}

/** VAT return for a period (legacy `VatPayment`): output VAT less input VAT is the net owed, settled by one or more payment lines. */
export class VatPayment {
  id = '';
  companyId = '';
  from: Date | string = new Date();
  to: any = null;
  accountPayableId = '';
  employeeId = '';
  employeeName = '';
  branchName = '';
  branchId = '';
  createdAt: Date | string = new Date();
  outputVat = 0;
  inputVat = 0;
  netVat = 0;
  status = 'Initiated';
  totalPaidAmount = 0;
  paymentDate: Date | null = null;
  lines: VatPaymentLine[] = [];

  get amountDue(): number { return MathUtils.sub(this.netVat, this.totalPaidAmount); }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key === 'lines') {
        this.lines = (json[key] ?? []).map((l: any) => { const line = new VatPaymentLine(); line.ParseJson(l); return line; });
      } else if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }
}
