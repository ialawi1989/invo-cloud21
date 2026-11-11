import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;

/** One cashier shift of the list. */
export interface CashierShift {
  id: string; employeeName: string; branchName: string; cashierIn: string | null; cashierOut: string | null; startAmount: N; endAmount: N;
}
export interface CashierShiftPage { records: CashierShift[]; count: number; pageCount: number; }

export interface TenderRow { paymentMethodName: string; total: N; refund?: N; equivalant?: N; }
export interface ShortOverRow { paymentMethodName: string; expected: N; countAmount: N; shortOver: N; }
/** One shift's report. */
export interface CashierShiftReport {
  employeeName: string; branchName: string; cashierIn: string | null; cashierOut: string | null;
  totalOrders: N; openingBalance: N; totalPayments: N; totalRefunds: N; totalPayout: N; closingBalance: N;
  paymentByTender: TenderRow[]; shortOver: ShortOverRow[];
}

/**
 * Cashier Report — `POST accounts/reports/cashierList` (the cashier shifts of a period, paged) and `cashierReportByCashierId`
 * (one shift: totals, payment by tender, short/over). The list takes its filter at the top level of the body, the report inside `filter`.
 */
@Injectable({ providedIn: 'root' })
export class CashierShiftsService {
  private api = inject(ApiService);

  private async post(route: string, body: unknown): Promise<any> {
    const res = await this.api.request<any>(this.api.post(`accounts/reports/${route}`, body));
    return res?.data ?? res ?? {};
  }

  async shifts(f: ReportApiFilter, page: number, limit: number): Promise<CashierShiftPage> {
    const raw = await this.post('cashierList', { fromDate: f.fromDate, toDate: f.toDate, branches: f.branches ?? [], page, limit, searchTerm: '', sortBy: {} });
    return { records: Array.isArray(raw.records) ? raw.records : [], count: Number(raw.count ?? 0) || 0, pageCount: Number(raw.pageCount ?? 1) || 1 };
  }

  async report(cashierId: string): Promise<CashierShiftReport> {
    const raw = await this.post('cashierReportByCashierId', { filter: { cashierId } });
    return {
      ...raw,
      paymentByTender: Array.isArray(raw.paymentByTender) ? raw.paymentByTender : [],
      shortOver: Array.isArray(raw.shortOver) ? raw.shortOver : [],
    };
  }
}
