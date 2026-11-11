import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;
export interface SalesReturn { sales: N; return: N; }
export interface TenderDetail { tenderType: string; equivalant: N; refund: N; tenderTotal: N; }
export interface CategoryDetail { departmentName: string | null; categoryName: string; totalSales: N; salesQty: N; totalReturns: N; returnQty: N; }
export interface ServiceDetail { serviceId?: string | null; serviceName: string; numberOfInvoices?: N; totalSales: N; salesQty: N; totalReturns: N; returnQty: N; }
export interface SalesDetail { salesDate: string; totalSales: N; itemDiscount: N; taxTotal: N; }
export interface PaymentBreakdown { invoicesDate: string; invoiceQty: N; paymentReceived: N; }
export interface TaxBreakdown { name: string; invoiceTax: N; creditTax: N; total: N; }

export interface DailyClosingData {
  totalGuests: N; totalOrders: N;
  sales?: SalesReturn; discount?: SalesReturn; tax?: SalesReturn; total?: SalesReturn; surcharge?: SalesReturn;
  surchargeTax?: SalesReturn; deliveryCharge?: SalesReturn; rounding?: SalesReturn;
  notRecievedPayment: N; totalRefund: N; totalVoid: N;
  tenderDetails?: TenderDetail[]; categoryDetails?: CategoryDetail[]; serviceDetails?: ServiceDetail[];
  salesDetails?: SalesDetail[]; paymentBreakdown?: PaymentBreakdown[]; taxBreakdown?: TaxBreakdown[];
}

export interface DailySaleLine { date: string; invoiceNumber: string; customerName: string; totalSales: N; itemDiscount: N; taxTotal: N; netSales: N; }

/** Daily Closing — `POST accounts/reports/getdailySalesReport` (one business day of one branch) and its sales list `dailySalesSubReport`. */
@Injectable({ providedIn: 'root' })
export class DailyClosingService {
  private api = inject(ApiService);

  private async post(route: string, filter: ReportApiFilter): Promise<any> {
    const res = await this.api.request<any>(this.api.post(`accounts/reports/${route}`, { filter }));
    return res?.data ?? res ?? {};
  }

  load(f: ReportApiFilter): Promise<DailyClosingData> { return this.post('getdailySalesReport', f); }

  async lines(f: ReportApiFilter): Promise<DailySaleLine[]> {
    const raw = await this.post('dailySalesSubReport', f);
    return Array.isArray(raw) ? raw : Array.isArray(raw.records) ? raw.records : [];
  }
}
