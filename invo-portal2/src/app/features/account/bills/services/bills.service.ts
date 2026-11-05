import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '@core/http/api.service';

import { Bill, BillLine } from '../../models/bill.model';

const nullIfBlank = <T>(v: T): T | null => ((v as unknown) === '' ? null : v);

/**
 * Bills API - the endpoints of the legacy `BillsService` (same paths, verbs, payloads). Reads unwrap the
 * envelope to `data`; saves return the raw `{success,msg,data}` body and, like legacy, resolve the
 * server's error body on HTTP failure so callers can show `msg`.
 */
@Injectable({ providedIn: 'root' })
export class BillsService {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  private async data<T = any>(req: ReturnType<ApiService['get']>): Promise<T> {
    return (await this.api.request(req))?.data as T;
  }

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

  /** Paged list: `{ list, count, pageCount, startIndex, lastIndex }`. */
  async getBillingList(param: any): Promise<any> {
    const d = await this.data<any>(this.api.post('accounts/getBillingList', param));
    if (!d) return { list: [], count: 0, pageCount: 0 };
    return { list: d.list, count: d.count, pageCount: d.pageCount, startIndex: d.startIndex, lastIndex: d.lastIndex };
  }

  getBillRaw = (id: string) => this.data(this.api.get('accounts/getBill/' + id));

  async getBill(id: string): Promise<Bill> {
    const bill = new Bill();
    bill.ParseJson(await this.getBillRaw(id));
    return bill;
  }

  async getBillingNumber(): Promise<string> {
    const d = await this.data<any>(this.api.get('accounts/getBillingNumber'));
    return typeof d === 'string' ? d : (d?.billingNumber ?? '');
  }

  /** One line (and, recursively, its batches / serials) as the backend's `BillingLine.ParseJson` reads it. */
  private linePayload(l: BillLine, billInclusive: boolean, index: number): any {
    return {
      id: l.id,
      billingId: nullIfBlank(l.billingId),
      productId: nullIfBlank(l.productId),
      note: l.note,
      barcode: l.barcode,
      qty: l.qty,
      unitCost: l.unitCost,
      accountId: nullIfBlank(l.accountId),
      taxId: nullIfBlank(l.taxId),
      taxes: l.taxes,
      taxType: l.taxType,
      taxPercentage: l.taxPercentage,
      taxTotal: l.taxTotal,
      isInclusiveTax: billInclusive,
      discountAmount: l.discountAmount,
      discountPercentage: l.discountPercentage,
      discountIncludesTax: l.discountIncludesTax,
      serial: l.serial,
      batch: l.batch,
      prodDate: l.prodDate,
      expireDate: l.expireDate,
      parentId: nullIfBlank(l.parentId),
      SIC: l.SIC,
      UOM: l.UOM,
      isDeleted: l.isDeleted,
      isNew: false,
      index,
      batches: l.batches.map((b, i) => this.linePayload(b, billInclusive, i)),
      serials: l.serials.map((s, i) => this.linePayload(s, billInclusive, i)),
    };
  }

  /** Saved lines flagged `isDeleted` are sent so the server deletes them; new deleted ones and empty rows are dropped. */
  toPayload(b: Bill): any {
    const lines = (b.lines as BillLine[])
      .filter(l => (l.isDeleted ? !!l.id : !!l.productId || !!l.note))
      .map((l, i) => this.linePayload(l, b.isInclusiveTax, i));
    return {
      id: b.id,
      billingNumber: b.billingNumber,
      reference: b.reference,
      status: b.status,
      note: b.note,
      supplierId: nullIfBlank(b.supplierId),
      branchId: nullIfBlank(b.branchId),
      purchaseOrderId: nullIfBlank(b.purchaseOrderId),
      payableAccountId: nullIfBlank(b.payableAccountId),
      billingDate: b.billingDate,
      dueDate: b.dueDate,
      paymentTerm: b.paymentTerm,
      isInclusiveTax: b.isInclusiveTax,
      discountAmount: b.discountAmount,
      discountPercentage: b.discountPercentage,
      discountIncludesTax: b.discountIncludesTax,
      applyDiscountBeforeTax: b.applyDiscountBeforeTax,
      billDiscount: b.billDiscount,
      discountTotal: b.discountTotal,
      total: b.total,
      shipping: b.deliveryCharge,
      allowBillOfEntry: b.allowBillOfEntry,
      smallestCurrency: b.smallestCurrency,
      roundingType: b.roundingType,
      roundingTotal: b.roundingTotal,
      attachment: b.attachment,
      customFields: b.customFields,
      lines,
    };
  }

  saveBilling(b: Bill): Promise<any> {
    return this.envelope(this.api.post('accounts/saveBilling', this.toPayload(b)));
  }

  /** Purchase order -> bill (`accounts/convertToBill`): the bill goes in `billing`, the order it comes from beside it. */
  convertToBill(purchaseOrderId: string, b: Bill): Promise<any> {
    const billing = this.toPayload(b);
    billing.id = null;
    billing.lines.forEach((l: any) => { if (l.note) l.productId = null; });
    return this.envelope(this.api.post('accounts/convertToBill', { purchaseOrderId, billing }));
  }

  openBill = (id: string) => this.api.request(this.api.get('accounts/saveOpenBill/' + id));
  deleteBill = (id: string) => this.api.request(this.api.delete('accounts/deleteBilling/' + id));
  getBillingJournal = (id: string) => this.data(this.api.get('accounts/getBillingJournal/' + id));
  getPaymentsByBill = (id: string) => this.data(this.api.get('accounts/getPaymentsByBill/' + id));
  /** Payable accounts for the bill's "Payable Account" picker; the endpoint answers a bare array or `{ list }`. */
  async getPayableAccounts(): Promise<any[]> {
    const d = await this.data<any>(this.api.post('accounts/getPayableAccounts', {}));
    return Array.isArray(d) ? d : (d?.list ?? []);
  }
  sendBillEmail = (param: any = null) => this.api.request(this.api.post('accounts/sendBillEmail/', param));
  viewBillPdf = (id: string) => this.data(this.api.get('accounts/viewBillPdf/' + id, this.lang ? { lang: this.lang } : undefined));
}
