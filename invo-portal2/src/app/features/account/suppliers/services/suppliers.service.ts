import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ApiService } from '@core/http/api.service';

import { Supplier } from '../models/supplier.model';
import { CustomersService } from '../../customers/services/customers.service';

/**
 * Suppliers API — the endpoints of the legacy `SuppliersService` (`accounts/*`), same paths, verbs and
 * payloads (all verified against the backend's `accounts` router). Reads unwrap the response envelope to
 * `data`; calls whose caller inspects `success` / `msg` (save, items, credit, import) return the raw envelope.
 */
@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private customers = inject(CustomersService);

  private async post(url: string, body: any): Promise<any> {
    return (await this.api.request(this.api.post(url, body ?? {})))?.data;
  }
  private async get(url: string): Promise<any> {
    return (await this.api.request(this.api.get(url)))?.data;
  }

  // ── lists ──────────────────────────────────────────────────────────
  getSuppliersList = (params: any) => this.post('accounts/getSupplierList', params);
  getSuppliersMiniList = (params: any = null) => this.post('accounts/getSupplierMiniList', params);
  getMiniSuppliersByIds = (supplierIds: any) => this.post('accounts/getMiniSuppliersByIds', { supplierIds });

  // ── single supplier ────────────────────────────────────────────────
  async getSupplier(id: string): Promise<Supplier> {
    const s = new Supplier();
    s.ParseJson(await this.get('accounts/getSupplier/' + id));
    return s;
  }

  saveSupplier(info: any): Promise<any> {
    return this.api.request(this.api.post('accounts/saveSupplier', info));
  }

  // ── supplier items (products the supplier sells) ───────────────────
  getSupplierProducts = () => this.get('accounts/getSupplierProducts');
  getSupplierItems = (params: any = null) => this.post('accounts/getSupplierItems', params);
  getSupplierItemCost = (productId: string, supplierId: string) => this.get(`accounts/getSupplierItemCost/${productId}/${supplierId}`);
  getPurchaseProducts = (supplierId: string) => this.get('accounts/getPurchaseProducts/' + supplierId);
  getPurchaseProductsByData = (params: any) => this.post('accounts/getPurchaseProducts/', params);
  addSupplierItems(param: any): Promise<any> { return this.api.request(this.api.post('accounts/addSupplierItems', param)); }
  deleteSupplierItem(param: any): Promise<any> { return this.api.request(this.api.post('accounts/deleteSupplierItem', param)); }

  /** Purchasable products to pick for a supplier (`product/getProductsListForSupplier`): `{ list, count, pageCount }`; products the supplier already sells come back `disabled`. */
  getProductsListForSupplier = (params: any) => this.post('product/getProductsListForSupplier', params);
  /** Barcode → purchasable product (`accounts/getPurchaseProductByBarcode`): raw envelope, `data` is the product (or empty). */
  getPurchaseProductByBarcode(param: any): Promise<any> { return this.api.request(this.api.post('accounts/getPurchaseProductByBarcode/', param)); }
  /** Departments / categories offered as filters of the product picker. */
  getDepartments = (params: any) => this.post('product/getDepartmentList', params);
  getCategories = (params: any) => this.post('product/getCategoryList', params);

  // ── overview / transactions / credit ───────────────────────────────
  getSupplierOverView = (params: any = null) => this.post('accounts/getSupplierOverView', params);
  getSupplierBillingsTransactions = (params: any = null) => this.post('accounts/getSupplierBillingsTransactions', params);
  getSupplierPaymentsTransactions = (params: any = null) => this.post('accounts/getSupplierPaymentsTransactions', params);
  getSupplierCreditsTransactions = (params: any = null) => this.post('accounts/getSupplierCreditsTransactions', params);
  getSupplierPurchaseTransactions = (params: any = null) => this.post('accounts/getSupplierPurchaseTransactions', params);
  getAvailableCredit = (supplierId: any) => this.get('accounts/getAvailableCredit/' + supplierId);
  getApplyCreditSupplierBills = (supplierId: any) => this.get('accounts/getApplyCreditSupplierBills/' + supplierId);
  getAvailableCreditsList = (supplierId: any) => this.get('accounts/getAvailableCreditsList/' + supplierId);
  applySupplierCredit(info: any): Promise<any> { return this.api.request(this.api.post('accounts/applySupplierCredit', info)); }
  getLastPaymentMadeToSupplier = (supplierId: string) => this.get('accounts/lastPaymentMadeToSupplier/' + supplierId);
  getAginigReportBySupplier = (params: any = null) => this.post('accounts/reports/aginigReportBySupplier/', params);
  getSupplierStatementData = (param: any = null) => this.post('accounts/supplierStatement', param);

  // ── import / export ────────────────────────────────────────────────
  /** Raw envelope: `success: true` means no import is running, otherwise `msg` says what is in progress. */
  getBulkImportProgress(): Promise<any> { return this.api.request(this.api.get('accounts/getSupplierBulkImportProgress')); }
  importSupplier(suppliers: any): Promise<any> { return this.api.request(this.api.post('accounts/importSupplier', suppliers)); }
  /** Downloads `suppliers.<type>` (legacy behaviour: blob → temporary link click). */
  async exportSuppliers(type: string): Promise<void> {
    const blob = await firstValueFrom(this.http.get(`${environment.backendUrl}accounts/exprotSuppliers/${type}`, { responseType: 'blob' }));
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'suppliers.' + type;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Custom fields offered as list columns (same customization endpoint as customers, entity `supplier`). */
  getCustomFields = () => this.customers.getCustomFields('supplier');

  /** Shared `company/validateName` uniqueness probe (`success: true` = value is free). */
  async validateName(params: { tableName: string; id?: any; name: string }): Promise<{ success: boolean }> {
    const res = await this.api.request<any>(this.api.post('company/validateName', params));
    return { success: !!res?.success };
  }
}
