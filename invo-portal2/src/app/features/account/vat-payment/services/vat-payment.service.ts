import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { VatPayment, VatPaymentLine } from '../../models/vat-payment.model';

/** VAT payments API - every endpoint of the legacy `VatPaymentService` (same paths / verbs / payloads). */
@Injectable({ providedIn: 'root' })
export class VatPaymentService {
  private api = inject(ApiService);

  private async data<T = any>(req: ReturnType<ApiService['get']>): Promise<T> {
    return (await this.api.request(req))?.data as T;
  }

  /** Mutation: envelope on success, the server's error body on HTTP failure (legacy behaviour). */
  private async envelope(req: ReturnType<ApiService['get']>): Promise<any> {
    try {
      return await this.api.request(req);
    } catch (e: any) {
      return e?.error ?? e;
    }
  }

  /** Paged list `{ list, count, pageCount, startIndex, lastIndex }`. */
  async getVatPaymentList(param: any): Promise<any> {
    const d = await this.data<any>(this.api.post('accounts/getVatPaymentList', param));
    const list = (d?.list ?? []).map((j: any) => { const p = new VatPayment(); p.ParseJson(j); return p; });
    return { list, count: d?.count, pageCount: d?.pageCount, startIndex: d?.startIndex, lastIndex: d?.lastIndex };
  }

  async getVatPayment(id: string): Promise<VatPayment> {
    const p = new VatPayment();
    p.ParseJson(await this.data(this.api.get('accounts/getVatPayment/' + id)));
    return p;
  }

  /** The day after the last VAT return ended - the start of the next period (null/absent before the first one). */
  async getNewTransactionDate(): Promise<any> {
    const d = await this.data<any>(this.api.get('accounts/getNewTransactionDate'));
    return d?.date ?? new Date();
  }

  saveVatPayment = (p: VatPayment) => this.envelope(this.api.post('accounts/saveVatPayment', p));
  saveVatPaymentLine = (l: VatPaymentLine) => this.envelope(this.api.post('accounts/saveVatPaymentLine', l));
  deleteVatPayment = (id: string) => this.api.request(this.api.delete('accounts/deleteVatPayment/' + id));

  /** Payments made against the return. */
  getVatPayments = (id: string) => this.data<any[]>(this.api.get('accounts/getVatPayments/' + id));
  getVatPaymentJournal = (id: string) => this.data(this.api.get('accounts/getVatPaymentJournal/' + id));

  /** One payment line wrapped in a `VatPayment` (legacy shape) - used to edit a payment from the history. */
  async getVatPaymentLineById(id: string): Promise<VatPayment> {
    const rows = await this.data<any[]>(this.api.get('accounts/getVatPaymentLineById/' + id));
    const line = new VatPaymentLine();
    line.ParseJson(rows?.[0]);
    const p = new VatPayment();
    p.lines.push(line);
    p.netVat = line.netVat;
    p.id = line.vatPaymentId;
    return p;
  }

  /** Sales / purchase VAT report rows for the period: `[{ taxId, taxName, Total, Adjusments, vatTotal }]`. */
  getVatReport(route: 'getSalesVatReport' | 'getPurchaseVatReport', fromDate: string, toDate: string): Promise<any[]> {
    return this.data<any[]>(this.api.post('accounts/reports/' + route, { filter: { fromDate, toDate } })).then(r => r ?? []);
  }
}
