import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { BillingPayment } from '../../models/billing-payment.model';

/** Bill payments API - every endpoint of the legacy `BillsService` that concerns payments (same paths / verbs / payloads). */
@Injectable({ providedIn: 'root' })
export class BillsPaymentService {
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
  async getBillingPaymentList(param: any): Promise<any> {
    const d = await this.data<any>(this.api.post('accounts/getBillingPaymentList', param));
    return { list: d?.list ?? [], count: d?.count, pageCount: d?.pageCount, startIndex: d?.startIndex, lastIndex: d?.lastIndex };
  }

  async getBillingPayment(id: string): Promise<BillingPayment> {
    const p = new BillingPayment();
    p.ParseJson(await this.data(this.api.get('accounts/getBillingPayment/' + id)));
    return p;
  }

  /** Lines with no amount are dropped; the excess over the bills is sent as `unusedAmount`. */
  saveBillingPayment(p: BillingPayment): Promise<any> {
    return this.envelope(this.api.post('accounts/saveBillingPayment', p));
  }

  deleteBillPayment = (id: string) => this.api.request(this.api.delete('accounts/deleteBillPayment/' + id));
  getBillingPaymentJournal = (id: string) => this.data(this.api.get('accounts/getBillingPaymentJournal/' + id));
  sendBillPaymentEmail = (param: any = null) => this.api.request(this.api.post('accounts/sendBillPaymentEmail', param));
  viewBillPaymentPdf = (id: string) => this.data(this.api.get('accounts/viewBillPaymentPdf/' + id));

  /** Open bills of a supplier (all branches, or one branch) - what a payment can settle. */
  getSupplierBills = (supplierId: string, branchId = '') =>
    this.data<any[]>(this.api.get('accounts/getSupplierBills/' + supplierId + (branchId ? '/' + branchId : '')));

  /** What is still owed to the supplier at a branch. */
  getSupplierPayableByBranch = (supplierId: string, branchId = '') =>
    this.api.request(this.api.get(`accounts/getSupplierPayableByBranch/${branchId}/${supplierId}`));
}
