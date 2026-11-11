import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;
export type AgingEntity = 'customer' | 'supplier';

export interface AgingInvoice {
  id: string; customerId: string | null; InvoiceNumber: string; CustomerName: string; Date: string; dueDate: string | null;
  Status: string; Age: N; Amount: N; BalanceDue: N;
}
/** One age bucket of the detail report: its label and the invoices that fall in it. */
export interface AgingBucket { label: string; agingGroups: AgingInvoice[]; }
export interface AgingDetailData { buckets: AgingBucket[]; count: number; pageCount: number; }

/** One customer of the summary report: what they owe in each bucket. */
export interface AgingCustomer { customerId: string | null; customerName: string; agingGroups: { label: string; total: N }[]; }
export interface AgingSummaryData { customers: AgingCustomer[]; ranges: string[]; }

/**
 * Customer Aging — `POST accounts/reports/customerAgingReports` (invoices grouped by how overdue they are; paged by the backend) and
 * `customerSummaryAgingReports` (per customer, one column per bucket). The buckets come from `range` (how many), `rangeOf` (size) and
 * `rangeUnit` (days | weeks | months).
 */
@Injectable({ providedIn: 'root' })
export class CustomerAgingService {
  private api = inject(ApiService);

  private async post(route: string, filter: ReportApiFilter): Promise<any> {
    const res = await this.api.request<any>(this.api.post(`accounts/reports/${route}`, { filter }));
    return res?.data ?? res ?? {};
  }

  async detail(f: ReportApiFilter, page: number, limit: number, entity: AgingEntity = 'customer'): Promise<AgingDetailData> {
    const raw = await this.post(entity === 'supplier' ? 'getSupplierAgingReport' : 'customerAgingReports', { ...f, page, limit });
    // a supplier's rows are read as a customer's: bill number -> InvoiceNumber, supplier -> customer
    const norm = (r: any): AgingInvoice => entity === 'supplier' ? { ...r, InvoiceNumber: r.billingNumber, CustomerName: r.SupplierName, customerId: r.supplierId } : r;
    const buckets: AgingBucket[] = (Array.isArray(raw.records) ? raw.records : []).map((b: any) => ({
      label: b.label, agingGroups: (Array.isArray(b.agingGroups) ? b.agingGroups : []).map(norm),
    }));
    return { buckets, count: Number(raw.count ?? 0) || 0, pageCount: Number(raw.pageCount ?? 1) || 1 };
  }

  async summary(f: ReportApiFilter, entity: AgingEntity = 'customer'): Promise<AgingSummaryData> {
    const raw = await this.post(entity === 'supplier' ? 'supplierAgingReportSummary' : 'customerSummaryAgingReports', f);
    const customers: AgingCustomer[] = (Array.isArray(raw.records) ? raw.records : []).map((r: any) => entity === 'supplier' ? { ...r, customerId: r.supplierId, customerName: r.supplierName } : r);
    const ranges: string[] = Array.isArray(raw.ranges) && raw.ranges.length ? raw.ranges : (customers[0]?.agingGroups ?? []).map(g => g.label);
    return { customers, ranges };
  }
}
