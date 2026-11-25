import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** One employee with the privilege role they are on (`POST accounts/reports/employeeRole`). */
export interface EmployeeRoleRow {
  employeeId: string; employeeName: string; privilegeId: string; privilegeName: string;
  employeeEmail?: string | null; isSuperAdmin?: boolean | null;
}

/**
 * One granted permission (`POST accounts/reports/employeePrivileges`). `employeeName` is only present when the request names a
 * permission (`securityKey` + `actionKey`) — the backend then joins the employees that hold it.
 */
export interface PrivilegeRow {
  roleName: string | null;
  employeeName?: string | null;
  privilegeName: string | null;
  securityName: string | null;
  actionKey: string | null;
  securityKey?: string | null;
  securityType?: string | null;
  privilegeId?: string | null;
  employeeId?: string | null;
  employeeEmail?: string | null;
}

/** A role's permissions with the number of permissions that can be granted in total. */
export interface RolePermissions { rows: PrivilegeRow[]; total: number; }

/** Big enough for every employee / every permission of a role in one request (the backend pages with `limit`/`offset`, unordered). */
const ALL = 5000;

/**
 * Employee Privileges Report.
 *  - `employeeRole`        → every employee and the privilege role they are on.
 *  - `employeePrivileges`  → with `privilegeId`: the permissions a role grants; with `securityKey` + `actionKey`: who holds one permission.
 * The backend always reads `filter`, so it is sent even when empty.
 */
@Injectable({ providedIn: 'root' })
export class EmployeePrivilegesService {
  private api = inject(ApiService);
  private roleCache = new Map<string, RolePermissions>();

  private async post(route: string, body: unknown): Promise<any> {
    const res = await this.api.request<any>(this.api.post(`accounts/reports/${route}`, body));
    return res?.data ?? res ?? {};
  }

  async employees(): Promise<EmployeeRoleRow[]> {
    const raw = await this.post('employeeRole', { filter: {}, page: 1, limit: ALL });
    return Array.isArray(raw.records) ? raw.records : [];
  }

  /** The permissions a role grants (cached — employees on the same role share the answer). */
  async rolePermissions(privilegeId: string, force = false): Promise<RolePermissions> {
    if (!force) { const hit = this.roleCache.get(privilegeId); if (hit) return hit; }
    const raw = await this.post('employeePrivileges', { filter: { privilegeId }, page: 1, limit: ALL });
    const res: RolePermissions = { rows: Array.isArray(raw.records) ? raw.records : [], total: Number(raw.totalPermissions ?? 0) || 0 };
    this.roleCache.set(privilegeId, res);
    return res;
  }

  /** The employees that hold one permission, with the role they hold it through. */
  async holders(securityKey: string, actionKey: string): Promise<PrivilegeRow[]> {
    const raw = await this.post('employeePrivileges', { filter: { securityKey, actionKey }, page: 1, limit: ALL });
    return Array.isArray(raw.records) ? raw.records : [];
  }

  clearCache(): void { this.roleCache.clear(); }
}

/**
 * What the shared Export button sends for this report, from the URL the component keeps in sync with its selection
 * (`view`, `role` / `rn` = the chosen role's id / name, `sec` + `act` = the chosen permission).
 */
export function employeePrivilegesExport(q: Record<string, any>): { path: string; filter: Record<string, any> } {
  if (q['view'] === 'perm' && q['sec'] && q['act']) return { path: 'employeePrivileges', filter: { securityKey: q['sec'], actionKey: q['act'] } };
  if (q['view'] !== 'perm' && q['role']) return { path: 'employeePrivileges', filter: { privilegeId: q['role'], roleName: q['rn'] || undefined } };
  return { path: 'employeeRole', filter: {} };
}
