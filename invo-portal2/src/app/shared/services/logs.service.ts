import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** One activity-log entry. `meta` is free-form per action type. */
export interface LogEntry {
  createdAt: string;
  action: string;
  comment: string;
  employeeName: string;
  branchName?: string;
  sourceTable?: string;
  sourceId?: string;
  sourceNumber?: string;
  meta?: Record<string, any>;
}

export interface LogsParams {
  page?: number;
  limit?: number;
  /** Entity keys to scope the log to, e.g. ['MenuRecipe']. */
  sourceTable?: string[];
  /** Narrow to one or more records of that entity. */
  sourceId?: string | string[];
  searchTerm?: string;
  branchId?: string[];
  employeeId?: string[];
  /** `YYYY-MM-DD`. */
  dateFrom?: string;
  dateTo?: string;
}

export interface LogsResult {
  list: LogEntry[];
  hasNext: boolean;
  count: number;
}

/**
 * Activity log — wraps `accounts/getLogReport`.
 *
 * The wire format is snake_case (`source_table`, `created_at`); this service is
 * the only place that knows that, so callers work in camelCase.
 */
@Injectable({ providedIn: 'root' })
export class LogsService {
  private api = inject(ApiService);

  async getLogs(params: LogsParams = {}): Promise<LogsResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      source_table: params.sourceTable ?? [],
      // Backend binds this as a Postgres `uuid[]` param (`= any($n::uuid[])`)
      // — a bare string fails the cast, so always send an array.
      source_id: params.sourceId
        ? (Array.isArray(params.sourceId) ? params.sourceId : [params.sourceId])
        : [],
      searchTerm: params.searchTerm ?? '',
      branch_id: params.branchId ?? [],
      employee_id: params.employeeId ?? [],
      date_from: params.dateFrom ?? '',
      date_to: params.dateTo ?? '',
    };

    const res = await this.api.request<any>(this.api.post('accounts/getLogReport', body));
    // The endpoint has two historical shapes: the standard `data` envelope and
    // a bare top-level `{ list, hasNext }`.
    const data = res?.data ?? res ?? {};
    const raw: any[] = Array.isArray(data?.list) ? data.list : [];
    return {
      list: raw.map((r) => this.mapEntry(r)),
      hasNext: !!data?.hasNext,
      count: Number(data?.count ?? raw.length) || 0,
    };
  }

  private mapEntry(r: any): LogEntry {
    return {
      createdAt: String(r?.created_at ?? r?.createdAt ?? ''),
      action: String(r?.action ?? ''),
      comment: String(r?.comment ?? ''),
      employeeName: String(r?.employeeName ?? ''),
      branchName: r?.branchName ?? '',
      sourceTable: r?.source_table ?? r?.sourceTable ?? '',
      sourceId: r?.source_id ?? r?.sourceId ?? '',
      sourceNumber: r?.sourceNumber ?? '',
      meta: (r?.meta && typeof r.meta === 'object') ? r.meta : undefined,
    };
  }
}
