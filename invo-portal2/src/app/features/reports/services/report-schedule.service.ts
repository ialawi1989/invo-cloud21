import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ScheduledReport } from '../models/report-schedule';

/** The saved schedules of a report — `accounts/scheduledReports/…` (the same calls as the legacy). */
@Injectable({ providedIn: 'root' })
export class ReportScheduleService {
  private api = inject(ApiService);

  private normalize(r: any): ScheduledReport {
    return {
      id: r.id ?? r._id ?? '',
      reportType: r.reportType ?? '',
      frequency: r.frequency ?? 'daily',
      startDate: r.startDate ?? '',
      scheduleTime: r.scheduleTime ?? '00:00',
      previousRun: r.previousRun ?? null,
      nextRun: r.nextRun ?? null,
      recipients: Array.isArray(r.recipients) ? r.recipients : [],
      additionalRecipients: Array.isArray(r.additionalRecipients) ? r.additionalRecipients.filter((x: unknown) => x != null) : [],
      attachmentType: r.attachmentType ?? 'pdf',
      isActive: r.isActive !== undefined ? !!r.isActive : true,
      filter: r.filter ?? {},
    };
  }

  /** The schedules of one report type. */
  async listByType(type: string): Promise<ScheduledReport[]> {
    const res = await this.api.request<any>(this.api.get(`accounts/scheduledReports/getScheduledReportByType/${encodeURIComponent(type)}`));
    const data = res?.data ?? [];
    return Array.isArray(data) ? data.map(r => this.normalize(r)) : [];
  }

  async getById(id: string): Promise<ScheduledReport | null> {
    const res = await this.api.request<any>(this.api.get(`accounts/scheduledReports/getScheduledReportById/${id}`));
    const raw = Array.isArray(res?.data) ? res.data[0] : res?.data;
    return raw ? this.normalize(raw) : null;
  }

  /** Creates (no `id`) or updates one. Resolves with the backend's answer; rejects on failure. */
  async save(body: Partial<ScheduledReport>): Promise<any> {
    const res = await this.api.request<any>(this.api.post('accounts/scheduledReports/saveScheduledReport', body));
    if (res && res.success === false) throw new Error(typeof res.msg === 'string' ? res.msg : 'Could not save the schedule.');
    return res;
  }

  async remove(id: string): Promise<void> {
    const res = await this.api.request<any>(this.api.delete(`accounts/scheduledReports/deleteScheduledReport/${id}`));
    if (res && res.success === false) throw new Error(typeof res.msg === 'string' ? res.msg : 'Could not delete the schedule.');
  }
}
