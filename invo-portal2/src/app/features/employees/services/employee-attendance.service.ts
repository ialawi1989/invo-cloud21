import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import {
  AttendanceSummary,
  EmployeeListParams,
  PagedResult,
} from '../models/employee.types';

/**
 * EmployeeAttendanceService
 * ─────────────────────────
 * Wraps the legacy attendance endpoints (`employee/getAttendanceList`,
 * `employee/getAttendance/:id`, `employee/adjustEmployeeAttendance`).
 */
@Injectable({ providedIn: 'root' })
export class EmployeeAttendanceService {
  private api = inject(ApiService);

  async getList(params: EmployeeListParams & Record<string, any> = {}): Promise<PagedResult<AttendanceSummary>> {
    const body = {
      page:       params.page       ?? 1,
      limit:      params.limit      ?? 20,
      searchTerm: params.searchTerm ?? '',
      sortBy:     params.sortBy     ?? {},
      ...params,
    };
    const res = await this.api.request<any>(this.api.post('employee/getAttendanceList', body));
    const list = (res?.data?.list ?? []).map((a: any) => this.mapSummary(a));
    return {
      list,
      count:      res?.data?.count      ?? list.length,
      pageCount:  res?.data?.pageCount  ?? 1,
      startIndex: res?.data?.startIndex ?? 0,
      lastIndex:  res?.data?.lastIndex  ?? list.length,
    };
  }

  async getOne(id: string): Promise<AttendanceSummary | null> {
    const res = await this.api.request<any>(this.api.get(`employee/getAttendance/${id}`));
    const raw = res?.data ?? null;
    return raw ? this.mapSummary(raw) : null;
  }

  async adjust(info: any): Promise<any> {
    return this.api.request<any>(this.api.post('employee/adjustEmployeeAttendance', info));
  }

  private mapSummary(a: any): AttendanceSummary {
    return {
      id:                      a.id ?? a._id ?? '',
      employeeId:              a.employeeId ?? '',
      employeeName:            a.employeeName ?? a.name ?? '',
      branchId:                a.branchId ?? '',
      branchName:              a.branchName ?? '',
      clockedIn:               a.clockedIn ?? null,
      clockedOut:              a.clockedOut ?? null,
      adjClockedIn:            a.adjClockedIn ?? null,
      adjClockedOut:           a.adjClockedOut ?? null,
      adjClockedInBy:          a.adjClockedInBy ?? null,
      adjClockedOutBy:         a.adjClockedOutBy ?? null,
      adjClockedInByEmployee:  a.adjClockedInByEmployee ?? '',
      adjClockedOutByEmployee: a.adjClockedOutByEmployee ?? '',
      clockedInMediaUrl:       a.clockedInMediaUrl ?? null,
      clockedOutMediaUrl:      a.clockedOutMediaUrl ?? null,
      clockedInImage:          a.clockedInImage ?? null,
      clockedOutImage:         a.clockedOutImage ?? null,
      ...a,
    };
  }
}
