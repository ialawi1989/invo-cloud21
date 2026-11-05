import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '@core/http/api.service';

import { BillOfEntry, BillOfEntryLine } from '../../models/bill-of-entry.model';

const nullIfBlank = <T>(v: T): T | null => ((v as unknown) === '' ? null : v);

/**
 * Bill of entry API - the endpoints of the legacy `BillOfEntryService` (same paths, verbs, payloads). Reads
 * unwrap the envelope to `data`; the save returns the raw `{success,msg,data}` body and, like legacy,
 * resolves the server's error body on HTTP failure so callers can show `msg`.
 */
@Injectable({ providedIn: 'root' })
export class BillOfEntryService {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  /** The entry's journal rows (`accounts/getJournal/:id`, the generic by-document journal). */
  getJournal = (id: string) => this.data<any[]>(this.api.get('accounts/getJournal/' + id));

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
  async getBillOfEntryList(param: any): Promise<any> {
    const d = await this.data<any>(this.api.post('accounts/getBillOfEntryList', param));
    if (!d) return { list: [], count: 0, pageCount: 0 };
    return { list: d.list, count: d.count, pageCount: d.pageCount, startIndex: d.startIndex, lastIndex: d.lastIndex };
  }

  async getBillOfEntry(id: string): Promise<BillOfEntry> {
    const b = new BillOfEntry();
    b.ParseJson(await this.data(this.api.get('accounts/getBillOfEntry/' + id)));
    return b;
  }

  async getBillingOfEntryNumber(): Promise<string> {
    const d = await this.data<any>(this.api.get('accounts/getBillingOfEntryNumber'));
    return typeof d === 'string' ? d : (d?.billingNumber ?? '');
  }

  private linePayload(l: BillOfEntryLine, index: number): any {
    return {
      id: nullIfBlank(l.id),
      billingId: nullIfBlank(l.billingId),
      billOfEntryId: nullIfBlank(l.billOfEntryId),
      billingLineId: nullIfBlank(l.billingLineId),
      productId: nullIfBlank(l.productId),
      note: l.note,
      barcode: l.barcode,
      qty: l.qty,
      unitCost: l.unitCost,
      subTotal: l.subTotal,
      total: l.total,
      discountTotal: l.discountTotal,
      billDiscount: l.billDiscount,
      customDuty: l.customDuty,
      taxId: nullIfBlank(l.taxId),
      taxes: l.taxes,
      taxType: l.taxType,
      taxPercentage: l.taxPercentage,
      taxTotal: l.taxTotal,
      isInclusiveTax: false,
      accountId: nullIfBlank(l.accountId),
      parentId: nullIfBlank(l.parentId),
      UOM: l.UOM,
      SIC: l.SIC,
      serial: l.serial,
      batch: l.batch,
      isDeleted: l.isDeleted,
      index,
      batches: l.batches.map((b, i) => this.linePayload(b, i)),
      serials: l.serials.map((s, i) => this.linePayload(s, i)),
    };
  }

  /** Saved lines flagged `isDeleted` are sent so the server deletes them; new deleted ones and empty rows are dropped. */
  toPayload(b: BillOfEntry): any {
    const lines = (b.lines as BillOfEntryLine[])
      .filter(l => (l.isDeleted ? !!l.id : !!l.productId || !!l.note))
      .map((l, i) => this.linePayload(l, i));
    return {
      id: nullIfBlank(b.id),
      billingOfEnrtyNumber: b.billingOfEnrtyNumber,
      billingOfEntryDate: b.billingOfEntryDate,
      reference: b.reference,
      status: b.status,
      note: b.note,
      billingId: nullIfBlank(b.billingId),
      supplierId: nullIfBlank(b.supplierId),
      branchId: nullIfBlank(b.branchId),
      paymentMethodId: nullIfBlank(b.paymentMethodId),
      paymentTerm: 'custome',
      isInclusiveTax: false,
      total: b.total,
      smallestCurrency: b.smallestCurrency,
      roundingType: b.roundingType,
      roundingTotal: b.roundingTotal,
      attachment: b.attachment,
      customFields: b.customFields,
      lines,
    };
  }

  saveBillOfEntry(b: BillOfEntry): Promise<any> {
    return this.envelope(this.api.post('accounts/saveBillOfEntry', this.toPayload(b)));
  }

  deleteBillOfEntry = (id: string) => this.api.request(this.api.delete('accounts/deleteBillOfEntry/' + id));
  sendBillOfEntryEmail = (param: any = null) => this.api.request(this.api.post('accounts/sendBillOfEntryEmail/', param));
  viewBillOfEntryPdf = (id: string) => this.data(this.api.get('accounts/viewBillOfEntryPdf/' + id, this.lang ? { lang: this.lang } : undefined));
}
