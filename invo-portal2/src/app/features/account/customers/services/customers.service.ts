import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import { environment } from '../../../../../environments/environment';

import { Customer } from '../models/customer.model';

/**
 * Customers API — every endpoint of the legacy `CustomersService`
 * (`accounts/*` + the segment endpoints under `company/*`), same paths, verbs
 * and payloads. Reads unwrap the response envelope to `data` like the legacy
 * service did; calls whose caller inspects `success`/`msg` (save, import,
 * progress) return the raw envelope.
 */
@Injectable({ providedIn: 'root' })
export class CustomersService {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  private async post(url: string, body: any): Promise<any> {
    return (await this.api.request(this.api.post(url, body ?? {})))?.data;
  }
  private async get(url: string): Promise<any> {
    return (await this.api.request(this.api.get(url)))?.data;
  }

  // ── lists ──────────────────────────────────────────────────────────
  getCustomerList = (params: any) => this.post('accounts/getCustomerList', params);
  miniCustomerList = (params: any = null) => this.post('accounts/miniCustomerList', params);
  getCustomerMiniList = (params: any = null) => this.post('accounts/getCustomerMiniList', params);
  getParentCustomers = (params: any = null) => this.post('accounts/getParentCustomers', params);
  getMiniCustomersByIds = (customerIds: any) => this.post('accounts/getMiniCustomersByIds', { customerIds });

  // ── single customer ────────────────────────────────────────────────
  async getCustomer(id: string): Promise<Customer> {
    const customer = new Customer();
    customer.ParseJson(await this.get('accounts/getCustomer/' + id));
    return customer;
  }

  saveCustomer(custInfo: any): Promise<any> {
    return this.api.request(this.api.post('accounts/saveCustomer', custInfo));
  }

  saveCustomerNotes(id: any, notes: any): Promise<any> {
    return this.api.request(this.api.post('accounts/saveCustomerNotes', { customerId: id, notes }));
  }

  /** Addresses of a customer as a plain array (the endpoint wraps them as `{ addresses }`). */
  customerAddresses = async (id: string): Promise<any[]> => (await this.get('accounts/customerAddresses/' + id))?.addresses ?? [];
  setCustomerAddresses(customerId: string, addresses: any[]): Promise<any> {
    return this.api.request(this.api.post('accounts/setCustomerAddresses', { customerId, addresses }));
  }

  // ── overview / credit / transactions ───────────────────────────────
  getCustomerOverView = (params: any = null) => this.post('accounts/getCustomerOverView', params);
  getSubCustomerOverView = (customerId: string) => this.get('accounts/getSubCustomerOverView/' + customerId);
  getCustomerCredit = (customerId: any) => this.get('accounts/getCustomerCredit/' + customerId);
  getCustomerCreditsList = (customerId: any) => this.get('accounts/getCustomerCreditsList/' + customerId);
  getCustomerApplyCreditInvoices = (customerId: any) => this.get('accounts/getCustomerApplyCreditInvoices/' + customerId);
  applyCredit(custInfo: any): Promise<any> {
    return this.api.request(this.api.post('accounts/applyCredit', custInfo));
  }
  getCustomerInvoiceTransactions = (params: any = null) => this.post('accounts/getCustomerInvoiceTransactions', params);
  getCustomerEstimateTransactions = (params: any = null) => this.post('accounts/getCustomerEstimateTransactions', params);
  getCustomerCreditNoteTransactions = (params: any = null) => this.post('accounts/getCustomerCreditNoteTransactions', params);
  getCustomerPaymentTransactions = (params: any = null) => this.post('accounts/getCustomerPaymentTransactions', params);
  getCustomerLastPayment = (customerId: string) => this.get('accounts/customerLastPayment/' + customerId);
  getAginigReportByCustomer = (params: any = null) => this.post('accounts/reports/aginigReportByCustomer/', params);
  getCustomerStatementData = (param: any = null) => this.post('accounts/customerStatement', param);

  // ── segments ───────────────────────────────────────────────────────
  getCustomerSegmentList = (param: any = null) => this.post('company/getCustomerSegmentList', param);
  getCustomerSegmentById = (id: string) => this.get('company/getCustomerSegmentById/' + id);
  saveCustomerSegment(data: any): Promise<any> {
    return this.api.request(this.api.post('company/saveCustomerSegment', data));
  }

  /** Shared `company/validateName` uniqueness probe (`success: true` = value is free). */
  async validateName(params: { tableName: string; id?: any; name: string }): Promise<{ success: boolean }> {
    const res = await this.api.request<any>(this.api.post('company/validateName', params));
    return { success: !!res?.success };
  }

  // ── import / export ────────────────────────────────────────────────
  getBulkImportProgress(): Promise<any> {
    return this.api.request(this.api.get('accounts/getCustomerBulkImportProgress'));
  }
  importCustomers(customers: any): Promise<any> {
    return this.api.request(this.api.post('accounts/importCustomers', customers));
  }
  /** Downloads `customers.<type>` (legacy behaviour: blob → temporary link click). */
  async exportCustomers(type: string): Promise<void> {
    const blob = await firstValueFrom(
      this.http.get(`${environment.backendUrl}accounts/exportCustomers/${type}`, { responseType: 'blob' }),
    );
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customers.' + type;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Raw non-deleted custom-field definitions (id-keyed, for showing a customer's values). */
  async getCustomFieldDefinitions(): Promise<any[]> {
    try {
      const res = await this.api.request(this.api.get('company/getCustomizationByKey/customer/customFields'));
      const data: any = res?.data;
      const fields = data?.customFields || data?.value || (Array.isArray(data) ? data : []);
      return Array.isArray(fields) ? fields.filter((f: any) => f && !f.isDeleted && f.id) : [];
    } catch {
      return [];
    }
  }

  // ── custom fields (list columns) ───────────────────────────────────
  async getCustomFields(): Promise<{ key: string; label: string; type?: string }[]> {
    try {
      const res = await this.api.request(this.api.get('company/getCustomizationByKey/customer/customFields'));
      const data: any = res?.data;
      const fields: any[] = data?.customFields || data?.value || (Array.isArray(data) ? data : []);
      if (!Array.isArray(fields)) return [];
      return fields
        .filter((f: any) => !f.isDeleted)
        .map((f: any) => ({
          key: f.abbr || f.name || f.key || f.fieldName,
          label: f.label || f.name || f.fieldName || f.abbr || f.key,
          type: f.type || 'text',
        }));
    } catch {
      return [];
    }
  }
}
