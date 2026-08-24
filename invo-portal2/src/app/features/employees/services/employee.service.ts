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

  /**
   * Distinct department / position values in use, for the free-text
   * autocomplete on those two fields.
   *
   * This must be its own `SELECT DISTINCT` endpoint, not a sweep over
   * `getEmployeeList`. That list is paginated *and* selects a fixed column
   * list (`id, name, email, admin, user, superAdmin, media.url`) — it neither
   * returns the `employment` group nor covers every employee, so mining it
   * would produce a suggestion list that is silently both wrong and partial.
   *
   * `employee/getEmploymentLookups` doesn't exist on the backend yet; until it
   * does this answers with empty lists, and the fields work as plain free text.
   */
  async getEmploymentLookups(): Promise<{ departments: string[]; positions: string[] }> {
    try {
      const res = await this.api.request<any>(this.api.get('employee/getEmploymentLookups'));
      const data = res?.data ?? {};
      const clean = (list: any): string[] =>
        Array.isArray(list)
          ? [...new Set(list.map((v: any) => String(v ?? '').trim()).filter(Boolean))]
              .sort((a, b) => a.localeCompare(b))
          : [];
      return { departments: clean(data.departments), positions: clean(data.positions) };
    } catch {
      return { departments: [], positions: [] };
    }
  }

  /**
   * One page of employees for a picker — server-side search and paging, so a
   * "reports to" dropdown never truncates at whatever limit the caller guessed.
   */
  async searchEmployees(params: { page: number; limit: number; searchTerm: string }): Promise<{
    items: { id: string; name: string }[];
    hasMore: boolean;
  }> {
    try {
      const res = await this.api.request<any>(this.api.post('employee/getEmployeeList', {
        page: params.page,
        limit: params.limit,
        searchTerm: params.searchTerm,
        sortBy: {},
      }));
      const rows: any[] = res?.data?.list ?? [];
      const pageCount = Number(res?.data?.pageCount ?? 1);
      return {
        items: rows
          .map((r) => ({ id: r.id ?? r._id ?? '', name: r.name ?? '' }))
          .filter((r) => !!r.id),
        hasMore: params.page < pageCount,
      };
    } catch {
      return { items: [], hasMore: false };
    }
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

  /**
   * Cancel leave, one entry or many.
   *
   * CANCELS rather than deletes: the row records that leave was asked for and
   * withdrawn, and a delete throws away the only answer to "why was this
   * person marked off". Cancelled consumes no balance and is filtered out of
   * every rota and booking read, so every screen looks the same as a delete.
   *
   * One entry covers every DAY of a multi-day leave, because the days are one
   * row - which is what makes clearing a week a single action.
   */
  async cancelEmployeeOffDays(offDayIds: string[], reason?: string): Promise<any> {
    const res = await this.api.request<any>(
      this.api.post('employee/cancelEmployeeOffDays', { offDayIds, reason }),
    );
    return res;
  }

  /**
   * Approve or reject, through the SAME endpoint the HR leave screen uses.
   *
   * Not a board-specific decision path: two of them would mean two audit
   * trails and two places for the approval rules to drift apart.
   */
  async decideLeaveRequest(requestId: string, decision: 'Approved' | 'Rejected', comment?: string): Promise<any> {
    const res = await this.api.request<any>(
      this.api.post('employee/decideLeaveRequest', { requestId, decision, comment }),
    );
    return res;
  }

  /*
   * `deleteEmployeeOffDay` is retired. The server endpoint erased a row
   * matched on id alone, with no company scope, from the table that holds
   * every leave request. Use `cancelEmployeeOffDays`.
   */

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
      // Absent means "has access" — every record predating the flag.
      hasSystemAccess:          e.hasSystemAccess ?? true,
      // The API decides HR-data ownership, per UNION arm. Absent means owner.
      isHrDataOwner:            e.isHrDataOwner ?? true,
      // Groups are passed through only when the record actually has them.
      // Defaulting to `{}` here would make every save write back an empty
      // object onto a record that never had one.
      ...(e.profile    ? { profile:    e.profile }    : {}),
      ...(e.employment ? { employment: e.employment } : {}),
    };
  }
}
