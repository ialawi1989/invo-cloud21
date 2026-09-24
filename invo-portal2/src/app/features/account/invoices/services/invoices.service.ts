import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '@core/http/api.service';

import { Invoice, InvoicePaymentTemp } from '../../models/invoice.model';

/**
 * Invoices API — every endpoint of the legacy `InvoicesService` (same paths, verbs, payloads).
 * Reads unwrap the envelope to `data`; mutations return the raw `{success,msg,data}` body and,
 * like legacy, resolve the server's error body instead of rejecting on non-401 failures so
 * callers can show `msg`.
 */
@Injectable({ providedIn: 'root' })
export class InvoicesService {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  private async data<T = any>(req: ReturnType<ApiService['get']>): Promise<T> {
    return (await this.api.request(req))?.data as T;
  }

  /** Mutation: envelope on success, the error body (`{success:false,msg}`) on HTTP failure. */
  private async envelope(req: ReturnType<ApiService['get']>): Promise<any> {
    try {
      return await this.api.request(req);
    } catch (e: any) {
      return e?.error ?? e;
    }
  }

  private get lang(): string {
    return this.translate.currentLang || this.translate.defaultLang || '';
  }

  /** Paged list: `{ list, count, pageCount, startIndex, lastIndex }`; plain array when called without params. */
  async getInvoiceList(param: any = null): Promise<any> {
    const d = await this.data<any>(this.api.post('accounts/getInvoices/', param));
    if (!d) return [];
    if (param != null && Object.keys(param).length > 0) {
      return { list: d.list, count: d.count, pageCount: d.pageCount, startIndex: d.startIndex, lastIndex: d.lastIndex };
    }
    return d.list;
  }

  /** Raw invoice record (no model parsing). */
  getInvoiceRaw = (invoiceId: string) => this.data(this.api.get('accounts/getInvoice/' + invoiceId));

  async getInvoice(id: string): Promise<Invoice> {
    const invoice = new Invoice();
    invoice.ParseJson(await this.getInvoiceRaw(id));
    invoice.invoicePayments.forEach((element: any) => {
      const temp = new InvoicePaymentTemp();
      temp.paymentMethod.name = element.paymentMethodName;
      temp.tenderAmount = element.amount;
      temp.rate = element.rate;
      temp.calculateEquivalentAmount();
      invoice.payments.push(temp);
    });
    return invoice;
  }

  async getInvoiceNumber(): Promise<any> {
    return (await this.data<any>(this.api.get('accounts/getInvoiceNumber/')))?.invoiceNumber ?? [];
  }

  getInvoiceBalance = (invoiceId: any) => this.data(this.api.get('accounts/getInvoiceBalance/' + invoiceId));

  saveInvoice(invoiceInfo: any): Promise<any> {
    invoiceInfo.lines.forEach((l: any) => {
      l.isNew = false;
      if (l.productId == '') l.productId = null;
    });
    return this.envelope(this.api.post('accounts/saveInvoice', invoiceInfo));
  }

  convertToInvoice(estimateId: string, invoiceInfo: any): Promise<any> {
    invoiceInfo.lines.forEach((l: any) => (l.isNew = false));
    return this.envelope(this.api.post('accounts/convertToInvoice', { estimateId, invoice: invoiceInfo }));
  }

  openInvoice = (id: any) => this.api.request(this.api.get('accounts/saveOpenInvoice/' + id));
  WriteOffInvoice = (id: any) => this.api.request(this.api.post('accounts/witeOffInvoice', { invoiceId: id }));
  DeleteInv = (id: any) => this.api.request(this.api.delete('accounts/deleteInvoice/' + id));

  sendInvoiceEmail = (param: any = null) => this.api.request(this.api.post('accounts/sendInvoiceEmail/', param));
  sendInvoiceForSignature = (param: any = null) => this.api.request(this.api.post('accounts/sendInvoiceForSignature/', param));
  createInvoiceLink = (param: any = null) => this.api.request(this.api.post('accounts/createInvoiceLink/', param));

  viewInvoicePdf = (id: any) =>
    this.data(this.api.get('accounts/viewInvoicePdf/' + id, this.lang ? { lang: this.lang } : undefined));

  async viewMergedInvoicesPdf(invoiceIds: string[]): Promise<any> {
    try {
      const url = 'accounts/viewMergedInvoicesPdf' + (this.lang ? `?lang=${encodeURIComponent(this.lang)}` : '');
      return await this.data(this.api.post(url, { invoiceIds }));
    } catch {
      return null;
    }
  }

  // ── templates (public e-invoice / signature endpoints belong to the public signing page, not ported here) ──────────────────────────────────────────
  getInvoiceTemplate = () => this.data(this.api.get('company/getInvoiceTemplate'));
  saveInvoiceTemplate = (info: any) => this.api.request(this.api.post('company/setInvoiceTemplate', info));
}
