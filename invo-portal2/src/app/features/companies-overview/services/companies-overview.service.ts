import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiService } from '@core/http/api.service';

export interface BranchSalesRow {
  branchId: string; branchName: string;
  sales: number; discountTotal: number; taxTotal: number; total: number; totalReturn: number; netSales: number;
  numberOfInvoices: number;
}
export interface CompanySalesRow extends Omit<BranchSalesRow, 'branchId' | 'branchName'> {
  companyId: string; companyName: string; branches: BranchSalesRow[];
}
export interface CompaniesSales {
  companies: CompanySalesRow[];
  totals: Omit<BranchSalesRow, 'branchId' | 'branchName'>;
}
export interface CompaniesPayments {
  /** Payment-method columns, in the order the backend returned them. */
  methods: string[];
  rows: { companyId: string; companyName: string; payments: Record<string, number> }[];
  totals: Record<string, number>;
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const MEASURES = ['sales', 'discountTotal', 'taxTotal', 'total', 'totalReturn', 'netSales', 'numberOfInvoices'] as const;
const zero = () => ({ sales: 0, discountTotal: 0, taxTotal: 0, total: 0, totalReturn: 0, netSales: 0, numberOfInvoices: 0 });

/**
 * Companies Overview API — the company-group endpoints (InvoCloudBack `routes/v1/company_group/dashboard.ts`, mounted at
 * `/groups/dashboard`): `companiesSales` (one row per branch of every company; the body is `{ interval, applyOpeningHour }`)
 * and `companiesPaymentsOverview` (one row per company, `{ filter: { fromDate, toDate } }`). Both only answer a company that
 * belongs to a group, and the backend scopes them to the caller's branches.
 */
@Injectable({ providedIn: 'root' })
export class CompaniesOverviewService {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  async sales(from: string, to: string): Promise<CompaniesSales> {
    const res = await this.api.request<any>(this.api.post('groups/dashboard/companiesSales', {
      interval: { from, to }, applyOpeningHour: false,
    }));
    if (res?.success === false) throw new Error(typeof res?.msg === 'string' ? res.msg : 'Request failed');
    const rows: any[] = Array.isArray(res?.data) ? res.data : [];

    const byCompany = new Map<string, CompanySalesRow>();
    for (const r of rows) {
      let c = byCompany.get(r.companyId);
      if (!c) {
        c = { companyId: r.companyId, companyName: r.companyName ?? '', branches: [], ...zero() };
        byCompany.set(r.companyId, c);
      }
      const b: BranchSalesRow = { branchId: r.branchId, branchName: r.branchName ?? '', ...zero() };
      for (const k of MEASURES) { b[k] = num(r[k]); c[k] += b[k]; }
      c.branches.push(b);
    }
    const companies = [...byCompany.values()];
    const totals = zero();
    for (const c of companies) for (const k of MEASURES) totals[k] += c[k];
    return { companies, totals };
  }

  async payments(from: string, to: string): Promise<CompaniesPayments> {
    const res = await this.api.request<any>(this.api.post('groups/dashboard/companiesPaymentsOverview', {
      filter: { fromDate: from, toDate: to },
    }));
    if (res?.success === false) throw new Error(typeof res?.msg === 'string' ? res.msg : 'Request failed');
    const methods: string[] = res?.data?.subColumns ?? [];
    const rows = ((res?.data?.records ?? []) as any[]).map(r => ({
      companyId: r.companyId, companyName: r.companyName ?? '',
      payments: Object.fromEntries(methods.map(m => [m, num(r.payments?.[m])])) as Record<string, number>,
    }));
    const totals: Record<string, number> = {};
    for (const m of methods) totals[m] = rows.reduce((t, r) => t + r.payments[m], 0);
    return { methods, rows, totals };
  }

  /** Server-side export of the shown tab (`pdf` / `xlsx`), saved through the browser. */
  async export(kind: 'sales' | 'payments', type: 'pdf' | 'xlsx', from: string, to: string): Promise<void> {
    const body = kind === 'sales'
      ? { interval: { from, to }, applyOpeningHour: false, filter: { export: true, fileType: type } }
      : { filter: { fromDate: from, toDate: to, export: true, fileType: type } };
    const route = kind === 'sales' ? 'companiesSales' : 'companiesPaymentsOverview';
    const response = await firstValueFrom(this.http.post(`${environment.backendUrl}groups/dashboard/${route}`, body, {
      responseType: 'blob', observe: 'response',
    }));
    if (!response.body) return;
    const m = /filename=\s*"?([^";]+)"?/i.exec(response.headers.get('content-disposition') ?? '');
    const url = URL.createObjectURL(response.body);
    const a = document.createElement('a');
    a.href = url; a.download = m?.[1] ?? `companies-${kind}.${type}`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
