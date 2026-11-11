import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../models/report.model';

export interface ComparisonRecord {
  [field: string]: any;
  /** One `{ [column]: { [subColumn]: amount } }` entry per column. */
  summary: Array<Record<string, Record<string, number> | number>>;
}

export interface ComparisonReportData {
  records: ComparisonRecord[];
  /** Period columns (`Mon/YYYY` / `YYYY`); a single `Total` column when there is no comparison. */
  columns: string[];
  /** Sub-columns under every column (all of them without a comparison, the chosen ones with one). */
  subColumns: string[];
}

/**
 * Data of the comparison reports — `POST accounts/reports/{route}`. The response is `{ records, columns, subColumns }`
 * and every record's summary is `[{ column: { subColumn: amount } }]`.
 */
@Injectable({ providedIn: 'root' })
export class ComparisonReportService {
  private api = inject(ApiService);

  async load(route: string, f: ReportApiFilter): Promise<ComparisonReportData> {
    // Same shape the legacy filter converter sends.
    const filter: ReportApiFilter = { page: 1, ...f };
    const res = await this.api.request<any>(this.api.post(`accounts/reports/${route}`, { filter }));
    const raw = res?.data ?? res ?? {};
    const columns: string[] = raw.columns ?? [];
    const subColumns: string[] = raw.subColumns ?? [];
    const records: ComparisonRecord[] = Array.isArray(raw.records) ? raw.records : [];
    // Every record carries every column (zeros when the row had nothing in it) — the legacy did the same.
    for (const r of records) {
      if (!Array.isArray(r.summary)) r.summary = [];
      for (const c of columns) {
        if (r.summary.some(s => Object.prototype.hasOwnProperty.call(s, c))) continue;
        r.summary.push({ [c]: subColumns.length ? Object.fromEntries(subColumns.map(s => [s, 0])) : 0 });
      }
    }
    return { records, columns, subColumns };
  }
}
