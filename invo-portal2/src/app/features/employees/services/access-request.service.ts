import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/http/api.service';

export type AccessRequestStatus = 'pending' | 'approved' | 'dismissed' | 'revoked';

export interface AccessRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  permissionPath: string;
  module: string;
  page: string;
  attemptedUrl: string;
  status: AccessRequestStatus;
  resolvedAt: string | null;
  /** Approved grants only; null = no end date. */
  grantedUntil: string | null;
  /** Approved and not yet expired. */
  isActive: boolean;
  /** Set when an admin archived (hid) this finished request. */
  archivedAt: string | null;
  createdAt: string;
}

/** Admin side of the 403 page's "Request access" (`employee/requestAccess`). */
@Injectable({ providedIn: 'root' })
export class AccessRequestService {
  private api = inject(ApiService);

  async list(params: { page: number; limit: number; searchTerm?: string; status?: string; view?: 'active' | 'archived' }) {
    const res = await this.api.request<any>(this.api.post('employee/getAccessRequests', params));
    const d = res?.data ?? {};
    return {
      list: (Array.isArray(d.list) ? d.list : []) as AccessRequest[],
      count: Number(d.count) || 0,
      counts: { active: Number(d.counts?.active) || 0, archived: Number(d.counts?.archived) || 0 },
    };
  }

  async resolve(
    id: string,
    action: 'approve' | 'dismiss' | 'revoke',
    grantedUntil?: string | null,
  ): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.post('employee/resolveAccessRequest', { id, action, grantedUntil: grantedUntil ?? null }),
    );
    return res?.success !== false;
  }

  /**
   * Archive (or restore) finished requests. The server only archives dismissed,
   * revoked and expired ones and reports how many it skipped.
   */
  async archive(ids: string[], restore = false): Promise<{ changed: number; skipped: number } | null> {
    const res = await this.api.request<any>(this.api.post('employee/archiveAccessRequests', { ids, restore }));
    if (res?.success === false) return null;
    return { changed: Number(res?.data?.changed) || 0, skipped: Number(res?.data?.skipped) || 0 };
  }
}
