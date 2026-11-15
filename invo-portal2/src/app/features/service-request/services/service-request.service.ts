import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import {
  ServiceRequest, ServiceRequestListParams, ServiceRequestListResult, emptyServiceRequest,
} from '../models/service-request.model';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Service requests API - the legacy `ServiceRequestService` endpoints, same paths, verbs and payloads
 * (InvoCloudBack `routes/v1/app/accounts.ts` -> `NotificationTemplateController` -> `NotificationTemplateRepo`).
 *   GET    accounts/getNotificationTemplateList
 *   GET    accounts/getNotificationTemplateById/:id
 *   POST   accounts/saveNotificationTemplate
 *   DELETE accounts/deleteNotificationTemplate/:id
 */
@Injectable({ providedIn: 'root' })
export class ServiceRequestService {
  private api = inject(ApiService);

  private map(d: any): ServiceRequest {
    return {
      ...emptyServiceRequest(),
      id: str(d?.id), title: str(d?.title), icon: str(d?.icon), body: str(d?.body),
      extraData: d?.extraData && typeof d.extraData === 'object' ? d.extraData : {},
    };
  }

  /** The endpoint returns the whole list (no server paging); search / sort / paging are applied here, as the legacy list had none. */
  async getList(params: ServiceRequestListParams): Promise<ServiceRequestListResult> {
    const res = await this.api.request<any>(this.api.get('accounts/getNotificationTemplateList'));
    let list: ServiceRequest[] = (Array.isArray(res?.data) ? res.data : []).map((d: any) => this.map(d));

    const term = (params.searchTerm ?? '').trim().toLowerCase();
    if (term) list = list.filter(r => r.body.toLowerCase().includes(term));

    if (params.sortBy?.sortValue === 'body') {
      const dir = params.sortBy.sortDirection === 'desc' ? -1 : 1;
      list = [...list].sort((a, b) => a.body.localeCompare(b.body) * dir);
    }

    const count = list.length;
    const limit = Math.max(1, params.limit || 15);
    const pageCount = Math.max(1, Math.ceil(count / limit));
    const start = (Math.max(1, params.page || 1) - 1) * limit;
    return { list: list.slice(start, start + limit), count, pageCount };
  }

  async getById(id: string): Promise<ServiceRequest | null> {
    const res = await this.api.request<any>(this.api.get('accounts/getNotificationTemplateById/' + id));
    const d = res?.data;
    return d?.id ? this.map(d) : null;
  }

  /**
   * Creates (no id) or updates a request; returns the raw `{ success, msg, data }` envelope.
   * `id` / `title` are left out when empty: the backend schema validates `id` as a uuid and `title` with `minLength: 3`
   * (it generates the id itself and doesn't store the title).
   */
  async save(r: ServiceRequest): Promise<any> {
    const body: Record<string, unknown> = { icon: r.icon, body: r.body, extraData: r.extraData ?? {} };
    if (r.id) body['id'] = r.id;
    if (r.title) body['title'] = r.title;
    return this.api.request<any>(this.api.post('accounts/saveNotificationTemplate', body));
  }

  /** Returns the raw `{ success, msg, data }` envelope. */
  async remove(id: string): Promise<any> {
    return this.api.request<any>(this.api.delete('accounts/deleteNotificationTemplate/' + id));
  }
}
