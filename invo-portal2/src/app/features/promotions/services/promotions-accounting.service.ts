import { Injectable, inject } from '@angular/core';
import { PageInfo, PromotionsApiService } from './promotions-api.service';

export interface InvoiceInfo {
  id: string;
  createdAt: Date;
  invoiceNumber: string;
  phone: string;
  total: number;
  isPointPayment: boolean;
  isGavePoints: boolean;
  status: string;
}

/** Invoice lookups the promotions screens use (legacy `getInvoices` / `getInvoicesByCustomer`). */
@Injectable({ providedIn: 'root' })
export class PromotionsAccountingService {
  private api = inject(PromotionsApiService);

  getInvoices(invoiceNumber: string, pageInfo?: PageInfo): Promise<InvoiceInfo> {
    return this.api.get<InvoiceInfo>(`promotions/accounting/invoice?invoiceNumber=${invoiceNumber}`, { pageInfo });
  }

  getInvoicesByCustomer(
    phoneNumber: string,
    invoiceNumber?: string | null,
    pageInfo?: PageInfo,
  ): Promise<InvoiceInfo[]> {
    let url = `promotions/accounting/invoice?A`;
    if (phoneNumber && phoneNumber.trim() !== '') url += `&phoneNumber=${encodeURIComponent(phoneNumber)}`;
    if (invoiceNumber && invoiceNumber.trim() !== '') url += `&invoiceNumber=${encodeURIComponent(invoiceNumber)}`;
    return this.api.get<InvoiceInfo[]>(url, { pageInfo });
  }
}
