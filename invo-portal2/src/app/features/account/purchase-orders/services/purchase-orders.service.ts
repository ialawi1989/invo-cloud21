import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '@core/http/api.service';

import { PurchaseOrder, PurchaseOrderLine } from '../../models/purchase-order.model';

/**
 * Purchase orders API - the endpoints of the legacy `PurchaseOrderService` (same paths, verbs, payloads).
 * Reads unwrap the envelope to `data`; the save returns the raw `{success,msg,data}` body and, like
 * legacy, resolves the server's error body on HTTP failure so callers can show `msg`.
 */
@Injectable({ providedIn: 'root' })
export class PurchaseOrdersService {
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
  async getPurchaseList(param: any): Promise<any> {
    const d = await this.data<any>(this.api.post('accounts/getPurchaseList/', param));
    if (!d) return { list: [], count: 0, pageCount: 0 };
    return { list: d.list, count: d.count, pageCount: d.pageCount, startIndex: d.startIndex, lastIndex: d.lastIndex };
  }

  getPurchaseOrderRaw = (id: string) => this.data(this.api.get('accounts/getPurchaseOrderById/' + id));

  async getPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const po = new PurchaseOrder();
    po.ParseJson(await this.getPurchaseOrderRaw(id));
    return po;
  }

  async getPurchaseNumber(): Promise<string> {
    return (await this.data<any>(this.api.get('accounts/getPurchaseNumber/')))?.purchaseNumber ?? '';
  }

  /**
   * The body the backend's `PurchaseOrder.ParseJson` reads - the same fields legacy posted (it posted the whole
   * object; the server ignores the rest). Saved lines flagged `isDeleted` are sent so the server deletes them,
   * new deleted ones and empty rows are dropped.
   */
  toPayload(po: PurchaseOrder): any {
    const lines = (po.lines as PurchaseOrderLine[])
      .filter(l => {
        if (l.isDeleted && l.id) return true;
        if (l.isDeleted) return false;
        return !!l.productId || !!l.note;
      })
      .map((l, i) => ({
        id: l.id,
        purchaseOrderId: l.purchaseOrderId,
        productId: l.productId,
        note: l.note,
        barcode: l.barcode,
        qty: l.qty,
        unitCost: l.unitCost,
        accountId: l.accountId,
        taxId: l.taxId,
        taxes: l.taxes,
        taxType: l.taxType,
        taxTotal: l.taxTotal,
        taxPercentage: l.taxPercentage,
        isInclusiveTax: po.isInclusiveTax,
        SIC: l.SIC,
        UOM: l.UOM,
        isDeleted: l.isDeleted,
        isNew: false,
        index: i,
      }));
    return {
      id: po.id,
      purchaseNumber: po.purchaseNumber,
      reference: po.reference,
      supplierId: po.supplierId,
      branchId: po.branchId,
      purchaseDate: po.purchaseDate,
      dueDate: po.dueDate,
      isInclusiveTax: po.isInclusiveTax,
      internationalSupplier: po.internationalSupplier,
      smallestCurrency: po.smallestCurrency,
      roundingType: po.roundingType,
      roundingTotal: po.roundingTotal,
      total: po.total,
      customFields: po.customFields,
      lines,
    };
  }

  savePurchaseOrder(po: PurchaseOrder): Promise<any> {
    return this.envelope(this.api.post('accounts/savePurchaseOrder', this.toPayload(po)));
  }

  deletePurchaseOrder = (id: string) => this.api.request(this.api.delete('accounts/deletePurchaseOrder/' + id));

  /** Purchasable products of a supplier at a branch: `{ list, count, pageCount }` (the item typeahead of the form). */
  async getPurchaseProducts(params: any): Promise<any> {
    return (await this.data<any>(this.api.post('accounts/getPurchaseProducts/', params))) ?? { list: [], pageCount: 0 };
  }

  /** Barcode -> purchasable product: raw envelope, `data` is the product (or empty). */
  getPurchaseProductByBarcode = (param: any) => this.api.request(this.api.post('accounts/getPurchaseProductByBarcode/', param));

  /** Auto purchase order: products to re-order at a branch. */
  getRecommendedPurchaseProducts = (param: any) => this.api.request(this.api.post('accounts/getRecommendedPurchaseProducts', param));
  getRecommendedPurchaseProdPerSup = (param: any) => this.api.request(this.api.post('accounts/getRecommendedPurchaseProdPerSup', param));
  convertAutoPurchase = (param: any) => this.api.request(this.api.post('accounts/convertAutoPurchase/', param));

  sendPurchaseOrderEmail = (param: any = null) => this.api.request(this.api.post('accounts/sendPurchaseOrderEmail/', param));

  viewPurchaseOrderPdf = (id: string) =>
    this.data(this.api.get('accounts/viewPurchaseOrderPdf/' + id, this.lang ? { lang: this.lang } : undefined));
}
