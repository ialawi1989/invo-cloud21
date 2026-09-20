import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import { NotificationChannel } from './notification-settings.types';

export type NotificationLogStatus = 'success' | 'failure';
export type NotificationLogProvider = 'InfobipProvider' | 'MetaWhatsappProvider' | 'EmailProvider' | 'SmsProvider' | 'unknown';

/** Verified against InvoCloudBack's `NotificationLogs` table — field names match exactly. */
export interface NotificationLog {
  id?: string;
  eventType: string;
  templateId: string | null;
  templateName: string | null;
  channel: NotificationChannel;
  provider: NotificationLogProvider;
  recipient: string;
  status: NotificationLogStatus;
  messageId: string | null;
  error: string | null;
  createdAt: string;
}

export interface NotificationLogFilter {
  channel?: NotificationChannel | '';
  eventType?: string;
  status?: NotificationLogStatus | '';
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationLogsService {
  private api = inject(ApiService);

  /** Backend has no total-count field — pages by "got fewer than `limit` rows back → no next page". */
  async getLogs(filter: NotificationLogFilter = {}): Promise<NotificationLog[]> {
    const params: Record<string, any> = {};
    if (filter.channel) params['channel'] = filter.channel;
    if (filter.eventType) params['eventType'] = filter.eventType;
    if (filter.status) params['status'] = filter.status;
    if (filter.from) params['from'] = filter.from;
    if (filter.to) params['to'] = filter.to;
    params['limit'] = filter.limit ?? 50;
    params['offset'] = filter.offset ?? 0;

    const res = await this.api.request<NotificationLog[]>(
      this.api.get('notification-settings/notification-logs', params),
    );
    // The endpoint may return a bare array or `{ data: [...] }` — handle both.
    const body: any = res;
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.data)) return body.data;
    return [];
  }
}
