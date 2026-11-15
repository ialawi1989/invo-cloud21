import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Invoice } from '../../account/models/invoice.model';
import { EInvoiceData, EInvoicePayResponse, EInvoicePaymentMethod } from '../models/e-invoice.model';

/**
 * Public e-invoice API - the `eInvoice/*` routes of InvoCloudBack (`routes/v1/app/eInvoice.ts` ->
 * `EInvoiceController`), same paths, verbs and payloads as the legacy `InvoicesService` / `PaymentsMethodService`.
 *
 * These pages are opened by customers who are not signed in, so the calls go through a client built on
 * `HttpBackend` (no interceptors): the app's auth interceptor would otherwise answer the 401 of a bad signature
 * token with a token refresh and a "session expired" dialog.
 */
@Injectable({ providedIn: 'root' })
export class EInvoiceService {
  private http = new HttpClient(inject(HttpBackend));
  private base = environment.backendUrl;

  private get<T = any>(path: string, headers?: HttpHeaders): Promise<T> {
    return firstValueFrom(this.http.get<T>(this.base + path, { headers }));
  }
  private post<T = any>(path: string, body: unknown, headers?: HttpHeaders): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.base + path, body, { headers }));
  }

  /** `GET eInvoice/getInvoice/:companyId/:invoiceId` -> `{ data: { invoice, company } }`. Rejects on HTTP errors. */
  async getInvoice(companyId: string, invoiceId: string): Promise<EInvoiceData | null> {
    const res = await this.get<any>(`eInvoice/getInvoice/${companyId}/${invoiceId}`);
    return this.toData(res);
  }

  /** `GET eInvoice/getInvoiceTemplate/:companyId` -> `data` = `{ invoiceBuilder }` (the company's legacy invoice template). Null on any failure, like legacy. */
  async getInvoiceTemplate(companyId: string): Promise<any | null> {
    try {
      const res = await this.get<any>(`eInvoice/getInvoiceTemplate/${companyId}`);
      return res?.data ?? null;
    } catch {
      return null;
    }
  }

  /** `GET eInvoice/getPaymentMethods/:companyId`. */
  async getPaymentMethods(companyId: string): Promise<EInvoicePaymentMethod[]> {
    const res = await this.get<any>(`eInvoice/getPaymentMethods/${companyId}`);
    return Array.isArray(res?.data) ? res.data : [];
  }

  /** `POST eInvoice/payInvoice` `{ companyId, invoiceId, paymentName, applePayTokendata? }`. */
  payInvoice(data: { companyId: string; invoiceId: string; paymentName: string; applePayTokendata?: unknown }): Promise<EInvoicePayResponse> {
    return this.post('eInvoice/payInvoice', data);
  }

  /** `POST eInvoice/payments/checkBenefitPayStatus` `{ referenceId, companyId }`. */
  checkBenefitPayStatus(data: { referenceId: string; companyId: string }): Promise<EInvoicePayResponse> {
    return this.post('eInvoice/payments/checkBenefitPayStatus', data);
  }

  /** `POST eInvoice/validateApplePay` `{ companyId, validationURL }`. */
  validateApplePay(data: { companyId: string; validationURL: string }): Promise<EInvoicePayResponse> {
    return this.post('eInvoice/validateApplePay', data);
  }

  /** `GET eInvoice/getInvoiceForSignature` with the link's access token in the `token` header. Null when the token is rejected. */
  async getInvoiceForSignature(token: string): Promise<EInvoiceData | null> {
    try {
      const res = await this.get<any>('eInvoice/getInvoiceForSignature', new HttpHeaders({ token }));
      return this.toData(res);
    } catch {
      return null;
    }
  }

  /** `POST eInvoice/saveInvoiceSignature` `{ base64Image }` + `token` header. The backend expects the `base64,<data>` part of the data URL. */
  saveInvoiceSignature(token: string, signature: string): Promise<{ success: boolean; msg?: string; data?: any }> {
    return this.post('eInvoice/saveInvoiceSignature', { base64Image: signature }, new HttpHeaders({ token }));
  }

  private toData(res: any): EInvoiceData | null {
    if (!res?.data?.invoice) return null;
    const invoice = new Invoice();
    invoice.ParseJson(res.data.invoice);
    return { invoice, company: res.data.company ?? { id: '', name: '' } };
  }
}
