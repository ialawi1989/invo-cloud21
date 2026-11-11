import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportsService } from '../../services/reports.service';
import { ACCOUNT_JOURNALS, BoReportConfig } from '../config/business-overview.config';
import { BoFilter, BoSort, toApiFilter } from '../shared/bo-filter';
import { ReportRecord } from '../shared/accounting.utils';

/** Statement-style payload (P&L, Balance Sheet, Trial Balance, General Ledger). */
export interface StatementData {
  columns: string[];
  subColumns: string[];
  records: ReportRecord[];
}

export interface JournalEntriesData {
  records: JournalEntryRow[];
  total: { totalDebit: number; totalCredit: number };
  count: number;
  pageCount: number;
}

export interface JournalEntryRow {
  AccountType: string;
  reference: string;
  referenceId: string;
  referenceNumber: string;
  Debit: number;
  Credit: number;
}

export interface AccountJournalLine {
  createdAt: string;
  type: string;
  code: string;
  debit: number | null;
  credit: number | null;
  referenceId?: string;
  userName?: string;
}

export interface AccountJournalData {
  journals: AccountJournalLine[];
  count: number;
  pageCount: number;
  openingBalance?: number;
  total: { debit: number; credit: number };
}

export interface PageOpts { page: number; limit: number; sort?: BoSort | null; }

/**
 * Data + export layer for the Business Overview reports. Routes verified
 * against InvoCloudBack (see `business-overview.config.ts`).
 */
@Injectable({ providedIn: 'root' })
export class BusinessOverviewService {
  private api = inject(ApiService);
  private reports = inject(ReportsService);

  private async post<T>(route: string, filter: Record<string, any>): Promise<T> {
    const res = await this.api.request<any>(this.api.post(`accounts/reports/${route}`, { filter }));
    return (res?.data ?? res ?? {}) as T;
  }

  private sortPart(sort?: BoSort | null): Record<string, any> {
    return sort ? { sortBy: [sort] } : {};
  }

  /** P&L / Balance Sheet / Trial Balance / General Ledger. */
  async statement(cfg: BoReportConfig, f: BoFilter): Promise<StatementData> {
    const raw = await this.post<any>(cfg.dataRoute, toApiFilter(f, cfg.asOf));
    const columns: string[] = raw.columns ?? [];
    const subColumns: string[] = raw.subColumns ?? [];
    const records: ReportRecord[] = Array.isArray(raw.records) ? raw.records : [];
    return { columns, subColumns, records };
  }

  async journalEntries(cfg: BoReportConfig, f: BoFilter, p: PageOpts): Promise<JournalEntriesData> {
    const raw = await this.post<any>(cfg.dataRoute, {
      ...toApiFilter(f, cfg.asOf), page: p.page, limit: p.limit, ...this.sortPart(p.sort),
    });
    return {
      records: raw.records ?? [],
      total: raw.total ?? { totalDebit: 0, totalCredit: 0 },
      count: raw.count ?? 0,
      pageCount: raw.pageCount ?? 1,
    };
  }

  /**
   * Drill-down: journal lines of one account. The sub-report inherits the
   * parent's date/branch filter (and as-of mode) and adds `accountId`.
   */
  async accountJournal(accountId: string, f: BoFilter, asOf: boolean, p: PageOpts): Promise<AccountJournalData> {
    const raw = await this.post<any>(ACCOUNT_JOURNALS.dataRoute, {
      ...toApiFilter(f, asOf), accountId, page: p.page, limit: p.limit, ...this.sortPart(p.sort),
    });
    return {
      journals: raw.journals ?? [],
      count: raw.count ?? 0,
      pageCount: raw.pageCount ?? 1,
      openingBalance: raw.openingBalance,
      total: raw.total ?? { debit: 0, credit: 0 },
    };
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  exportReport(cfg: BoReportConfig, type: 'pdf' | 'xlsx', f: BoFilter, sort?: BoSort | null): Promise<void> {
    return this.reports.exportPath(
      cfg.exportPath, type, { ...toApiFilter(f, cfg.asOf), ...this.sortPart(sort) }, cfg.slug,
    );
  }

  /**
   * Print the report: opens the backend's PDF (the same document Export → PDF downloads) in the
   * print dialog. Call straight from the click handler (popup blocker).
   */
  printReport(cfg: BoReportConfig, f: BoFilter, sort?: BoSort | null): Promise<void> {
    return this.reports.printPath(cfg.exportPath, { ...toApiFilter(f, cfg.asOf), ...this.sortPart(sort) });
  }

  printAccountJournal(accountId: string, f: BoFilter, asOf: boolean, sort?: BoSort | null): Promise<void> {
    return this.reports.printPath(
      ACCOUNT_JOURNALS.exportPath, { ...toApiFilter(f, asOf), accountId, ...this.sortPart(sort) },
    );
  }

  exportAccountJournal(
    accountId: string, f: BoFilter, asOf: boolean, type: 'pdf' | 'xlsx', sort?: BoSort | null,
  ): Promise<void> {
    return this.reports.exportPath(
      ACCOUNT_JOURNALS.exportPath, type,
      { ...toApiFilter(f, asOf), accountId, ...this.sortPart(sort) }, 'account-journals',
    );
  }
}
