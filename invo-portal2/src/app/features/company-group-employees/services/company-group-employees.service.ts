import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { GroupEmployeeListParams, GroupEmployeeListResult, GroupEmployeeRow } from '../models/company-group-employees.model';

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * Company-group employees API: `POST employee/getCompanyGroupEmployees` (InvoCloudBack `routes/v1/app/employee.ts` ->
 * `EmployeeController.getCompanyGroupEmployees` -> `companyEmployeeRepo.getCompanyGroupEmployees`). The backend only
 * answers a super admin of the current company; anyone else gets a validation error.
 */
@Injectable({ providedIn: 'root' })
export class CompanyGroupEmployeesService {
  private api = inject(ApiService);

  async getList(params: GroupEmployeeListParams = {}): Promise<GroupEmployeeListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      // Left out when unsorted: the backend reads `sortBy.sortValue` straight into its ORDER BY.
      ...(params.sortBy ? { sortBy: params.sortBy } : {}),
    };
    const res = await this.api.request<any>(this.api.post('employee/getCompanyGroupEmployees', body));
    if (res?.success === false) throw new Error(typeof res?.msg === 'string' ? res.msg : 'Request failed');
    const list: GroupEmployeeRow[] = (res?.data?.list ?? []).map((e: any): GroupEmployeeRow => ({
      id: e.id,
      name: e.name ?? '',
      companyList: (e.companyList ?? []).map((c: any) => ({
        companyId: c.companyId, companyName: c.companyName ?? '', available: !!c.available,
      })),
    }));
    return { list, count: num(res?.data?.count ?? list.length), pageCount: num(res?.data?.pageCount ?? 1) || 1 };
  }
}
