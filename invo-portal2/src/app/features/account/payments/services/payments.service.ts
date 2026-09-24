import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { InvoicePayment } from '../../models/invoice-payment.model';

/** Invoice payments API — every endpoint of the legacy `PaymentsService` (same paths / verbs / payloads). */
@Injectable({ providedIn: 'root' })
export class PaymentsService {
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
  async getInvoicePaymentsList(param: any): Promise<any> {
    const d = await this.data<any>(this.api.post('accounts/getInvoicePaymentsList', param));
    return { list: d?.list ?? [], count: d?.count, pageCount: d?.pageCount, startIndex: d?.startIndex, lastIndex: d?.lastIndex };
  }

  /** Full payment record parsed into the model (lines, address, …). */
  async getInvoicePayment(id: string): Promise<InvoicePayment> {
    const payment = new InvoicePayment();
    payment.ParseJson(await this.data(this.api.get('accounts/getInvoicePayment/' + id)));
    return payment;
  }

  saveInvoicePayment(payment: any): Promise<any> {
    return this.envelope(this.api.post('accounts/saveInvoicePayment', payment));
  }

  DeleteInvPay = (id: any) => this.api.request(this.api.delete('accounts/deleteInvoicePayment/' + id));

  sendInvoicePaymentEmail = (param: any = null) => this.api.request(this.api.post('accounts/sendInvoicePaymentEmail/', param));

  viewInvoicePaymentPdf = (id: any) => this.data(this.api.get('accounts/viewInvoicePaymentPdf/' + id));

  /** Open invoices of a customer (payment form: pick what to settle). */
  customerInvoices = (customerId: any) => this.data<any[]>(this.api.get('accounts/customerInvoices/' + customerId));

  getCustomerBranchReceivable = (customerId: any, branchId: any = '') =>
    this.api.request(this.api.get(`accounts/getCustomerBranchReceivable/${branchId}/${customerId}`));
}
