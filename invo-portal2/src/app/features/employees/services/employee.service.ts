import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import {
  EmployeeSummary,
  EmployeeDetails,
  EmployeeListParams,
  PagedResult,
  EmployeeScheduleParams,
} from '../models/employee.types';

/**
 * EmployeeService
 * ───────────────
 * Wraps the legacy `employee/*` endpoints so the employee pages don't have to
 * know the wire shape. Mirrors the lazy/normalising pattern of the other
 * feature services (see BranchSettingsService) and routes every call through
 * the shared {@link ApiService} (base URL + auth headers + promise conversion).
 */
@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private api = inject(ApiService);

  // ─── List / CRUD ───────────────────────────────────────────────────────

  async getList(params: EmployeeListParams = {}): Promise<PagedResult<EmployeeSummary>> {
    const body = {
      page:       params.page       ?? 1,
      limit:      params.limit      ?? 20,
      searchTerm: params.searchTerm ?? '',
      sortBy:     params.sortBy     ?? {},
    };
    const res = await this.api.request<any>(this.api.post('employee/getEmployeeList', body));
    const list = (res?.data?.list ?? []).map((e: any) => this.mapSummary(e));
    return {
      list,
      count:      res?.data?.count      ?? list.length,
      pageCount:  res?.data?.pageCount  ?? 1,
      startIndex: res?.data?.startIndex ?? 0,
      lastIndex:  res?.data?.lastIndex  ?? list.length,
    };
  }

  async getOne(id: string): Promise<EmployeeDetails | null> {
    const res = await this.api.request<any>(this.api.get(`employee/getEmployee/${id}`));
    const raw = res?.data ?? null;
    return raw ? this.mapDetails(raw) : null;
  }

  /** Save (create-or-update). Backend accepts the merged record. */
  async save(employee: Partial<EmployeeDetails> & { id?: string | null }): Promise<any> {
    return this.api.request<any>(this.api.post('employee/saveEmployee', employee));
  }

  // ─── Uniqueness checks ───────────────────────────────────────────────────

  /**
   * Shared `company/validateName` uniqueness probe. The backend answers
   * `{ success: true }` when the value is free (or unchanged for the record
   * identified by `id`) and `{ success: false }` when it clashes.
   * Used for the pass-code uniqueness rule (legacy `tableName: 'passCode'`).
   */
  async validateName(params: {
    tableName: string;
    id?: string | null;
    name: string;
    branchId?: string;
  }): Promise<{ success: boolean; msg?: string }> {
    const res = await this.api.request<any>(this.api.post('company/validateName', {
      tableName: params.tableName,
      id:        params.id ?? '',
      name:      params.name,
      branchId:  params.branchId ?? '',
    }));
    return { success: !!res?.success, msg: res?.msg };
  }

  // ─── Invitation ──────────────────────────────────────────────────────────

  /** Look up an existing InvoCloud user by email (invite flow). */
  async getEmployeeByEmail(email: string): Promise<any> {
    return this.api.request<any>(this.api.post('employee/getEmployeeByEmail', { email }));
  }

  async saveInvitedEmployee(data: any): Promise<any> {
    return this.api.request<any>(this.api.post('employee/saveInvitedEmployee', data));
  }

  // ─── Schedule ──────────────────────────────────────────────────────────

  async getEmployeesSchedule(params: EmployeeScheduleParams): Promise<any[]> {
    const res = await this.api.request<any>(
      this.api.post('employee/getEmployeesSchedule', {
        branchId: params.branchId,
        from:     params.from,
        to:       params.to,
      }),
    );
    return res?.data ?? [];
  }

  async saveShiftExceptions(param: {
    branchId: string; employeeId: string; employeeScheduleId: string;
    exceptions: any; date: string;
  }): Promise<any> {
    return this.api.request<any>(this.api.post('employee/saveShiftExceptions', param));
  }

  async saveAdditionalShifts(param: {
    branchId: string; employeeId: string; employeeScheduleId: string;
    additionalShifts: any; date: string;
  }): Promise<any> {
    return this.api.request<any>(this.api.post('employee/saveAdditionalShifts', param));
  }

  async saveEmployeeOffDay(param: any): Promise<any> {
    return this.api.request<any>(this.api.post('employee/saveEmployeeOffDay', param));
  }

  async getEmployeeOffDay(offDayId: string): Promise<any> {
    const res = await this.api.request<any>(this.api.get(`employee/getEmployeeOffDay/${offDayId}`));
    return res?.success ? res.data : false;
  }

  async deleteEmployeeOffDay(offDayId: string): Promise<any> {
    const res = await this.api.request<any>(this.api.get(`employee/deleteEmployeeOffDay/${offDayId}`));
    return res?.success ? res.data : false;
  }

  async saveEmployeeSchedule(data: any): Promise<any> {
    const res = await this.api.request<any>(this.api.post('employee/saveEmployeeSchedule', data));
    return res?.success ? res.data : false;
  }

  // ─── Mappers ─────────────────────────────────────────────────────────────

  private mapSummary(e: any): EmployeeSummary {
    return {
      id:            e.id ?? e._id ?? '',
      name:          e.name ?? '',
      email:         e.email ?? '',
      avatar:        e.avatar ?? '',
      admin:         !!e.admin,
      superAdmin:    !!e.superAdmin,
      user:          !!e.user,
      isDriver:      !!e.isDriver,
      isInvitedUser: !!e.isInvitedUser,
      branchId:      e.branchId ?? '',
    };
  }

  private mapDetails(e: any): EmployeeDetails {
    return {
      ...this.mapSummary(e),
      formStatus:               e.formStatus ?? 'edit',
      password:                 e.password ?? '',
      passCode:                 e.passCode ?? '',
      MSR:                      e.MSR ?? '',
      base64Image:              e.base64Image ?? '',
      companyId:                e.companyId ?? '',
      companyGroupId:           e.companyGroupId ?? null,
      createdAt:                e.createdAt ?? '',
      apply2fa:                 e.apply2fa ?? false,
      hasPermissionToChange2fa: !!e.hasPermissionToChange2fa,
      branches:                 Array.isArray(e.branches) ? e.branches : [],
      privileges:               e.privileges ?? null,
      privilegeId:              e.privilegeId ?? null,
      mediaId:                  e.mediaId ?? null,
      mediaUrl:                 e.mediaUrl ?? { defaultUrl: '' },
      resetPasswordDate:        e.resetPasswordDate ?? null,
      hireDate:                 e.hireDate ?? null,
      terminationDate:          e.terminationDate ?? null,
    };
  }
}
