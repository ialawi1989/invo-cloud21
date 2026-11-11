import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;

export interface DeptPaymentsRecord {
  filterName: string | null; sales_amount: N; discount: N; tax: N; invoice_total: N; credit_total: N; total: N;
  payments?: Record<string, N> | null;
}
export interface DeptPaymentsData { records: DeptPaymentsRecord[]; methods: string[]; }

/** Department Sales And Payments Overview — `POST accounts/reports/departmentSalesAndPaymentsOverview` (grouped by `filterBy`). */
@Injectable({ providedIn: 'root' })
export class DepartmentSalesPaymentsService {
  private api = inject(ApiService);

  async load(f: ReportApiFilter): Promise<DeptPaymentsData> {
    const res = await this.api.request<any>(this.api.post('accounts/reports/departmentSalesAndPaymentsOverview', { filter: f }));
    const raw = res?.data ?? res ?? {};
    return {
      records: Array.isArray(raw.records) ? raw.records : [],
      methods: Array.isArray(raw.subColumns) ? raw.subColumns : [],
    };
  }
}
