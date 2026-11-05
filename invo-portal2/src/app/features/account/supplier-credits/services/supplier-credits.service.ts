import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '@core/http/api.service';

import { Bill } from '../../models/bill.model';
import { SupplierCredit, SupplierCreditLine } from '../../models/supplier-credit.model';

const nullIfBlank = <T>(v: T): T | null => ((v as unknown) === '' ? null : v);

/**
 * Supplier credits API - the endpoints of the legacy `SupplierCreditService` (same paths, verbs, payloads).
 * Reads unwrap the envelope to `data`; the save returns the raw `{success,msg,data}` body and, like legacy,
 * resolves the server's error body on HTTP failure so callers can show `msg`.
 */
@Injectable({ providedIn: 'root' })
export class SupplierCreditsService {
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
  async getCreditList(param: any): Promise<any> {
    const d = await this.data<any>(this.api.post('accounts/getSupplierCreditList/', param));
    if (!d) return { list: [], count: 0, pageCount: 0 };
    return { list: d.list, count: d.count, pageCount: d.pageCount, startIndex: d.startIndex, lastIndex: d.lastIndex };
  }

  async getSupplierCredit(id: string): Promise<SupplierCredit> {
    const c = new SupplierCredit();
    c.ParseJson(await this.data(this.api.get('accounts/getSupplierCredit/' + id)));
    return c;
  }

  async getSupplierCreditNumber(branchId = ''): Promise<string> {
    const d = await this.data<any>(this.api.get('accounts/getSupplierCreditNumber/' + (branchId ?? '')));
    return typeof d === 'string' ? d : (d?.supplierCreditNumber ?? '');
  }

  /** The bill being credited, with what each line still allows (`maxQty`) - pass the credit's own id when editing. */
  async getBillForCredit(billingId: string, supplierCreditId: string | null): Promise<Bill> {
    const bill = new Bill();
    bill.ParseJson(await this.data(this.api.post('accounts/getBillForSupplierCredit', { billingId, supplierCreditId })));
    return bill;
  }

  /** Same, as the raw record (lines carry their `maxQty`, discounts and serial / batch lists). */
  getBillForCreditRaw = (billingId: string, supplierCreditId: string | null) =>
    this.data(this.api.post('accounts/getBillForSupplierCredit', { billingId, supplierCreditId }));

  /** Open bills of a supplier at a branch - the "which bill?" picker. */
  getBillsForSupplier = (supplierId: string, branchId: string) =>
    this.data<any[]>(this.api.get(`accounts/getBillForSupplierCredit/${supplierId}/${branchId}`));

  private linePayload(l: SupplierCreditLine, credit: SupplierCredit, index: number): any {
    return {
      id: nullIfBlank(l.id),
      supplierCreditId: nullIfBlank(l.supplierCreditId),
      billingLineId: nullIfBlank(l.billingLineId),
      productId: l.note ? null : nullIfBlank(l.productId),
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
      total: l.total,
      isInclusiveTax: credit.isInclusiveTax,
      discountTotal: l.discountTotal,
      discountAmount: l.discountAmount,
      discountPercentage: l.discountPercentage,
      discountIncludesTax: l.discountIncludesTax,
      billDiscount: l.billDiscount,
      billingQty: l.billingQty,
      sourceBillTotalBeforeTax: l.sourceBillTotalBeforeTax,
      sourceBillTotalAfterTax: l.sourceBillTotalAfterTax,
      serial: l.serial,
      batch: l.batch,
      return: l.return,
      prodDate: l.prodDate,
      expireDate: l.expireDate,
      parentId: nullIfBlank(l.parentId),
      UOM: l.UOM,
      SIC: l.SIC,
      isDeleted: l.isDeleted,
      isNew: false,
      index,
      batches: l.batches.map((b, i) => this.linePayload(b, credit, i)),
      serials: l.serials.map((s, i) => this.linePayload(s, credit, i)),
    };
  }

  toPayload(c: SupplierCredit): any {
    const lines = (c.lines as SupplierCreditLine[])
      .filter(l => !l.isDeleted || !!l.id)
      .map((l, i) => this.linePayload(l, c, i));
    return {
      id: nullIfBlank(c.id),
      supplierCreditNumber: c.supplierCreditNumber,
      supplierCreditDate: c.supplierCreditDate,
      reference: c.reference,
      billingId: c.billingId,
      supplierId: nullIfBlank(c.supplierId),
      branchId: nullIfBlank(c.branchId),
      isInclusiveTax: c.isInclusiveTax,
      applyDiscountBeforeTax: c.applyDiscountBeforeTax,
      discountIncludesTax: c.discountIncludesTax,
      discountTotal: c.discountTotal,
      supplierCreditDiscount: c.creditDiscount,
      total: c.total,
      shipping: c.deliveryCharge,
      allowBillOfEntry: c.allowBillOfEntry,
      smallestCurrency: c.smallestCurrency,
      roundingType: c.roundingType,
      roundingTotal: c.roundingTotal,
      attachment: c.attachment,
      customFields: c.customFields,
      lines,
    };
  }

  saveSupplierCredit(c: SupplierCredit): Promise<any> {
    return this.envelope(this.api.post('accounts/saveSupplierCredit', this.toPayload(c)));
  }

  deleteSupplierCredit = (id: string) => this.api.request(this.api.delete('accounts/deleteSupplierCredit/' + id));
  deleteSupplierAppliedCredit = (id: string) => this.api.request(this.api.delete('accounts/deleteSupplierAppliedCredit/' + id));
  getSupplierCreditJournal = (id: string) => this.data(this.api.get('accounts/getSupplierCreditJournal/' + id));
  sendSupplierCreditEmail = (param: any = null) => this.api.request(this.api.post('accounts/sendSupplierCreditEmail', param));
  viewSupplierCreditPdf = (id: string) => this.data(this.api.get('accounts/viewSupplierCreditPdf/' + id, this.lang ? { lang: this.lang } : undefined));

  /** Refund of a credit's unused balance. */
  saveSupplierRefund = (refund: any) => this.envelope(this.api.post('accounts/saveSupplierRefund', refund));
  /** Serials / batches of a product on a bill that can still be returned. */
  getProductBillingLines = (param: any) => this.data(this.api.post('accounts/getProductBillingLines', param));
}
