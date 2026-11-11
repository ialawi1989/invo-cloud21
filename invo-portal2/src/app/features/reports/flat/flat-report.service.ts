import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../models/report.model';

export type FlatRecord = Record<string, any>;
export interface FlatData {
  /** The rows (for a grouped report: the groups). */
  records: FlatRecord[];
  count: number;
  pageCount: number;
  total: Record<string, number | string> | null;
  /** The answer's `summary` object (the Daily Attendance Sheet's figures). */
  summary: Record<string, number> | null;
}

/** Data of the flat-table reports — `POST accounts/reports/{route}`; answers `{ records, count, pageCount, total }` (or a bare array). */
@Injectable({ providedIn: 'root' })
export class FlatReportService {
  private api = inject(ApiService);

  async load(route: string, f: ReportApiFilter, paging: { page: number; limit: number } | null): Promise<FlatData> {
    const filter: ReportApiFilter = paging ? { ...f, page: paging.page, limit: paging.limit } : { ...f };
    const res = await this.api.request<any>(this.api.post(`accounts/reports/${route.replace(/^\//, '')}`, { filter }));
    const raw = res?.data ?? res ?? {};
    const records = Array.isArray(raw) ? raw : Array.isArray(raw.records) ? raw.records : Array.isArray(raw.list) ? raw.list : [];
    return {
      records,
      count: Number(raw.count ?? records.length) || 0,
      pageCount: Number(raw.pageCount ?? 1) || 1,
      total: raw.total && typeof raw.total === 'object' ? raw.total : null,
      summary: raw.summary && typeof raw.summary === 'object' ? raw.summary : null,
    };
  }
}
