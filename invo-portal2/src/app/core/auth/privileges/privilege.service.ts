import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EmployeePrivilege, Privilege } from './models/privilege.model';

@Injectable({ providedIn: 'root' })
export class PrivilegeService {
  private http           = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl;

  private _privileges: Privilege | null = null;

  get privileges(): Privilege | null { return this._privileges; }

  // ─── Load from backend ───────────────────────────────────────────────────
  async loadPrivileges(): Promise<Privilege | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.baseUrl}employee/getPrivilegesFile`)
      );
      if (res?.data) {
        const p = new Privilege();
        p.ParseJson(res.data);
        this._privileges = p;
        return p;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Set privileges directly from the employee object after login */
  setPrivileges(privilegeJson: any): void {
    if (!privilegeJson) return;
    const p = new Privilege();
    p.ParseJson(privilegeJson);
    this._privileges = p;
  }

  clearPrivileges(): void {
    this._privileges = null;
  }

  // ─── Permission check (mirrors PermissionGuard.checkPermission) ──────────
  /**
   * Check a permission by dot-path.
   *
   * Two formats supported (same as v16):
   *   "invoiceSecurity.access"                   → top-level access
   *   "invoiceSecurity.actions.add.access"        → action access
   *   "invoiceSecurity.actions.view"              → action access (shorthand)
   */
  check(permissionPath: string | undefined): boolean {
    if (!permissionPath) return true;

    // Semantics: only an explicit `access === false` denies. Anything else
    // (null, undefined, missing section/action entry, or no privileges
    // object loaded at all) means "not restricted" and is treated as
    // allowed. Matches how the backend models permissions — a missing
    // record = inherit / allow rather than implicit deny.
    //
    // This also keeps super-admin access working: super admins typically
    // arrive with no `privileges` payload (they bypass the privilege
    // system server-side) and would otherwise be locked out of every
    // gated route.
    if (!this._privileges) return true;

    const parts = permissionPath.split('.');

    // Format: "key.access"
    if (parts[1] === 'access') {
      const section = this._privileges[parts[0]];
      return section?.access !== false;
    }

    // Format: "key.actions.actionKey" or "key.actions.actionKey.access"
    const actionKey = parts[2];
    if (!actionKey) return true;

    const section = this._privileges[parts[0]];
    return section?.actions?.[actionKey]?.access !== false;
  }

  // ─── CRUD for privilege records ──────────────────────────────────────────

  async getPrivilegeList(params?: any): Promise<{ list: EmployeePrivilege[]; count: number } | EmployeePrivilege[]> {
    const res = await firstValueFrom(
      this.http.post<any>(`${this.baseUrl}employee/getEmployeePrivilegeList`, params ?? {})
    );
    const raw: any[] = res?.data?.list ?? res?.data ?? [];
    const list = raw.map((item: any) => {
      const ep = new EmployeePrivilege();
      ep.ParseJson(item);
      return ep;
    });
    if (params && Object.keys(params).length > 0) {
      return { list, count: res.data.count };
    }
    return list;
  }

  async getPrivilege(id: string): Promise<EmployeePrivilege> {
    const res = await firstValueFrom(
      this.http.get<any>(`${this.baseUrl}employee/getEmployeePrivilege/${id}`)
    );
    const ep = new EmployeePrivilege();
    ep.ParseJson(res.data);
    return ep;
  }

  async savePrivilege(data: any): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}employee/saveEmployeePrivilege`, data)
    );
  }
}
