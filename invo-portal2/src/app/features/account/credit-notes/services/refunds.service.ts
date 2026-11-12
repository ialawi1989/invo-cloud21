import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** One line of a credit-note refund (the payment method the money goes back through). */
export interface RefundLine {
  id: string;
  creditNoteRefundId: string;
  amount: number;
  paymentMethodId: string;
  paymentMethodName: string;
  accountId: string | null;
}

export interface Refund {
  id: string;
  employeeId: string;
  branchId: string;
  total: number;
  refundDate: Date | string;
  creditNoteId: string;
  refrenceNumber: string;
  description: string;
  status: string;
  paymentMode: string;
  /** The cashier shift the refund was taken in (kept through edits, set by the POS). */
  cashierId: string | null;
  lines: RefundLine[];
}

export const newRefund = (): Refund => ({
  id: '', employeeId: '', branchId: '', total: 0, refundDate: new Date(), creditNoteId: '', refrenceNumber: '',
  description: '', status: '', paymentMode: '', cashierId: null,
  lines: [{ id: '', creditNoteRefundId: '', amount: 0, paymentMethodId: '', paymentMethodName: '', accountId: '' }],
});

/** Credit-note refunds — the endpoints of the legacy `RefundService` (`accounts/saveRefund`, `accounts/getRefund/:id`). */
@Injectable({ providedIn: 'root' })
export class RefundsService {
  private api = inject(ApiService);

  async getRefund(id: string): Promise<Refund> {
    const raw = (await this.api.request(this.api.get('accounts/getRefund/' + id)))?.data ?? {};
    const refund = newRefund();
    for (const k of Object.keys(refund) as (keyof Refund)[]) {
      if (k === 'lines') continue;
      if (k in raw) (refund as any)[k] = raw[k];
    }
    if (Array.isArray(raw.lines) && raw.lines.length) refund.lines = raw.lines.map((l: any) => ({ ...newRefund().lines[0], ...l }));
    return refund;
  }

  /** The refund's journal rows (`accounts/getJournal/:id`, the generic by-document journal). */
  async getJournal(id: string): Promise<any[]> {
    return (await this.api.request<any>(this.api.get('accounts/getJournal/' + id)))?.data ?? [];
  }

  /** Raw `{success,msg,data}` body; resolves the server's error body on HTTP failure so callers can show `msg`. */
  async saveRefund(refund: Refund): Promise<any> {
    try {
      return await this.api.request(this.api.post('accounts/saveRefund', refund));
    } catch (e: any) {
      return e?.error ?? e;
    }
  }
}
