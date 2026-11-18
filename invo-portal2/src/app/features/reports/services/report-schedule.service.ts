import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ScheduledListItem, ScheduledReport } from '../models/report-schedule';

/** Filters of `getAllScheduledReports`, sent under `filter`; only the ones that are set. */
export interface ScheduledListFilter {
  isActive?: boolean;
  frequency?: string;
  /** Inclusive `YYYY-MM-DD` bounds (the company's calendar days). */
  nextRunFrom?: string;
  nextRunTo?: string;
  previousRunFrom?: string;
  previousRunTo?: string;
}

export interface ScheduledListQuery { page: number; limit: number; searchTerm?: string; filter?: ScheduledListFilter; }

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

  /** The report types that have at least one saved schedule (`getScheduledReportTypes`, as the legacy catalog). */
  async scheduledTypes(): Promise<Set<string>> {
    const res = await this.api.request<any>(this.api.get('accounts/scheduledReports/getScheduledReportTypes'));
    const data = res?.data ?? [];
    return new Set((Array.isArray(data) ? data : []).map((r: any) => r?.reportType).filter(Boolean));
  }

  /**
   * One page of every schedule of the company (`getAllScheduledReports`). The backend fetches `limit + 1` rows and answers
   * `{ scheduledReport, hasNext }`, so there is no total: keep asking while `hasNext` is true.
   */
  async listAll(q: ScheduledListQuery): Promise<{ list: ScheduledListItem[]; hasNext: boolean }> {
    const res = await this.api.request<any>(this.api.post('accounts/scheduledReports/getAllScheduledReports', q));
    const data = res?.success === false ? null : res?.data;
    if (!data) throw new Error('Could not load the scheduled reports.');
    const raw: any[] = Array.isArray(data.scheduledReport) ? data.scheduledReport : Array.isArray(data.list) ? data.list : [];
    return {
      list: raw.map((r): ScheduledListItem => ({
        reportType: r.reportType ?? '',
        frequency: r.frequency ?? 'daily',
        attachmentType: r.attachmentType ?? 'pdf',
        isActive: r.isActive !== undefined ? !!r.isActive : true,
        nextRun: r.nextRun ?? null,
        previousRun: r.previousRun ?? null,
        allRecipients: Array.isArray(r.allRecipients) ? r.allRecipients.filter((e: unknown) => !!e) : [],
      })),
      hasNext: data.hasNext === true || data.hasNext === 'true',
    };
  }

  /**
   * The list rows carry no `id`, but Edit / Delete need it: find the row among the schedules of its type (those have the id) by what the
   * row does expose - frequency, format and the two run times.
   */
  async resolveFull(row: ScheduledListItem): Promise<ScheduledReport | null> {
    const same = (a: string | null, b: string | null) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
    const ofType = await this.listByType(row.reportType);
    return ofType.find(s => s.frequency === row.frequency && s.attachmentType === row.attachmentType
      && same(s.nextRun, row.nextRun) && same(s.previousRun, row.previousRun)) ?? null;
  }

  private branchList: { value: string; label: string }[] | null = null;
  /** The company's branches, for the schedule dialog's branch filter (loaded once). */
  async branches(): Promise<{ value: string; label: string }[]> {
    if (this.branchList) return this.branchList;
    try {
      const res = await this.api.request<any>(this.api.post('branch/getBranches/', { page: 1, limit: 500, searchTerm: '', sortBy: {} }));
      this.branchList = ((res?.data?.list ?? []) as any[]).map(b => ({ value: b.id, label: b.name }));
    } catch { this.branchList = []; }
    return this.branchList;
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
