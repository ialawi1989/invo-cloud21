import { Invoice } from '../../models/invoice.model';

// Recurring Invoice domain types — ported from legacy `core/models/recurring-invoice.ts` and checked
// against the backend (`InvoCloudBack`: models/account/RecurringInvoice.ts + RecurringInvoice.repo.ts):
//   - `endTerm` is a 2-value enum server-side: 'none' | 'by' (anything else never ends).
//   - `repeatData.on` is a day-of-month (Monthly 1-31), weekday (Weekly 1=Mon..7=Sun) or month (Yearly 1-12).
//   - `type` is an opaque string the legacy app always sent as 'sechedule' (typo kept, round-tripped as is).
//   - The backend has NO status / pause / "send invoice" column: a profile is simply "due" while the
//     schedule says so and the end date has not passed. Nothing of the kind is modelled here.

export type RecurringPeriodicity = 'Weekly' | 'Monthly' | 'Yearly';
export type RecurringEndTerm = 'none' | 'by';

export class RecurringInvoiceRepeat {
  periodicity: RecurringPeriodicity = 'Monthly';
  /** "every N <periods>". */
  periodQty = 1;
  on = 1;

  ParseJson(json: any): void {
    if (!json) return;
    if (json.periodicity) this.periodicity = json.periodicity;
    const qty = Number(json.periodQty);
    if (Number.isFinite(qty) && qty > 0) this.periodQty = qty;
    const on = Number(json.on);
    if (Number.isFinite(on) && on > 0) this.on = on;
  }
}

/** The recurring-invoice header + the invoice template (`transactionDetails`) it generates from. */
export class RecurringInvoice {
  id: string | null = null;
  name = '';
  type = 'sechedule';
  branchId = '';
  branchName = '';
  customerId: string | null = null;
  customerName = '';
  createdAt: Date | string = new Date();
  updatedDate: Date | string = new Date();
  /** `yyyy-MM-dd`. */
  startDate = '';
  /** `yyyy-MM-dd`; only meaningful when `endTerm == 'by'`. */
  endDate: string | null = null;
  endTerm: RecurringEndTerm = 'none';
  repeatData = new RecurringInvoiceRepeat();
  invoiceCreatedBefore = 0;
  /** Email each generated invoice to the customer. */
  sendInvoice = false;
  /** Server-computed (overview only). */
  nextInvoiceDate: Date | string | null = null;
  /** True once the schedule generated at least one invoice — customer and branch are then frozen. */
  hasInvoices = false;
  childInvoicesQty = 0;
  childInvoices: any[] = [];
  transactionDetails = new Invoice();

  ParseJson(json: any): void {
    if (!json) return;
    for (const key of Object.keys(json)) {
      const v = json[key];
      switch (key) {
        case 'repeatData': this.repeatData.ParseJson(typeof v === 'string' ? JSON.parse(v) : v); break;
        case 'transactionDetails': {
          const inv = new Invoice();
          inv.ParseJson(typeof v === 'string' ? JSON.parse(v) : v ?? {});
          this.transactionDetails = inv;
          break;
        }
        case 'startDate': this.startDate = v ? String(v).slice(0, 10) : ''; break;
        case 'endDate': this.endDate = v ? String(v).slice(0, 10) : null; break;
        case 'childInvoices': this.childInvoices = Array.isArray(v) ? v : []; break;
        default: if (key in this) (this as any)[key] = v;
      }
    }
  }
}
