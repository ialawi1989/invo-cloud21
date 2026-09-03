import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';

import {
  BankAccountOverviewRow,
  OpeningBalanceRow,
  PagedResult,
  ReconciliationDateSuggestion,
  ReconciliationHeader,
  ReconciliationListParams,
  ReconciliationListRow,
  ReconciliationTransaction,
  SaveReconciliationPayload,
  TransactionListParams,
} from './banking-overview.types';

/** pg numerics arrive as strings; `null` means "no amount on this branch". */
function num(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

/**
 * Banking Overview / Reconciliation API.
 *
 * Endpoint paths + verbs verified against
 * `InvoCloudBack/src/routes/v1/app/accounts.ts`:
 *
 *   POST   accounts/bankOverView
 *   POST   accounts/getReconcilationsRecords
 *   POST   accounts/getReconcilationRecordsById
 *   POST   accounts/getReconcilationList
 *   GET    accounts/getReconcilation/:id
 *   POST   accounts/saveReconciliation
 *   POST   accounts/getReconcilationDate
 *   POST   accounts/getAccountOpeningBalance
 *   DELETE accounts/deleteReconcilation/:id
 *   PUT    accounts/undoReconcilation/:id
 *   GET    accounts/getAccountName/:accountId
 *
 * (The misspelled `Reconcilation` segments are the real server paths.)
 */
@Injectable({ providedIn: 'root' })
export class BankingOverviewService {
  private api = inject(ApiService);

  // ─── Accounts overview ────────────────────────────────────────────────────

  /**
   * Bank / cash account balances.
   *
   * The repo hardcodes `to = now` and ignores `from` entirely, so no date
   * range is sent — the numbers are always "as of today". Only `branchId`
   * actually reaches the SQL.
   */
  async getBankingOverview(branchId: string | null = null): Promise<BankAccountOverviewRow[]> {
    const res = await this.api.request<any>(
      this.api.post('accounts/bankOverView', { branchId: branchId || null }),
    );
    const rows: any[] = Array.isArray(res?.data?.accounts) ? res.data.accounts : [];
    return rows.map((r) => ({
      id:      str(r?.id),
      name:    str(r?.name),
      type:    str(r?.type),
      balance: num(r?.balance),
    }));
  }

  /** Account display name — used for headers + breadcrumbs on the
   *  per-account screens (the reconciliation read strips `accountName`). */
  async getAccountName(accountId: string): Promise<string> {
    if (!accountId) return '';
    const res = await this.api.request<any>(
      this.api.get(`accounts/getAccountName/${accountId}`),
    );
    return str(res?.data?.name);
  }

  // ─── Transactions ledger ──────────────────────────────────────────────────

  /** Paginated account ledger (`getRecords`). */
  async getTransactions(p: TransactionListParams): Promise<PagedResult<ReconciliationTransaction>> {
    const filter: Record<string, unknown> = {
      accountId:     p.accountId,
      branchId:      p.branchId || null,
      fromDate:      p.fromDate || null,
      toDate:        p.toDate || null,
      sortDirection: p.sortDirection ?? 'DESC',
    };
    // `reconcile` is a tri-state server side: null = all, true = reconciled,
    // false = open. Omit the key entirely for "all" so the SQL's
    // `$6::boolean is null` branch fires.
    if (p.reconcile !== undefined) filter['reconcile'] = p.reconcile;

    const res = await this.api.request<any>(
      this.api.post('accounts/getReconcilationsRecords', {
        page:       p.page,
        limit:      p.limit,
        searchTerm: p.searchTerm ?? '',
        filter,
      }),
    );
    return this.toPaged(res?.data);
  }

  /** Rows belonging to one saved reconciliation period. Pass
   *  `reconcileOnly` for a closed period so only ticked rows come back. */
  async getReconciliationRecords(
    reconciliationId: string,
    reconcileOnly = false,
  ): Promise<ReconciliationTransaction[]> {
    const filter: Record<string, unknown> = { reconcilationId: reconciliationId };
    if (reconcileOnly) filter['reconcile'] = true;

    const res = await this.api.request<any>(
      this.api.post('accounts/getReconcilationRecordsById', { filter }),
    );
    return this.toPaged(res?.data).list;
  }

  // ─── Reconciliation periods ───────────────────────────────────────────────

  async getReconciliationList(p: ReconciliationListParams): Promise<PagedResult<ReconciliationListRow>> {
    const body: Record<string, unknown> = {
      page:       p.page,
      limit:      p.limit,
      searchTerm: p.searchTerm ?? '',
      // TOP-LEVEL, not under `filter` — that's where the repo reads it.
      branches:   p.branches?.length ? p.branches : null,
      filter: {
        accountId: p.accountId,
        status:    p.status || null,
      },
    };
    const res = await this.api.request<any>(
      this.api.post('accounts/getReconcilationList', body),
    );
    const data = res?.data ?? {};
    const rows: any[] = Array.isArray(data?.list) ? data.list : [];
    return {
      list: rows.map((r) => ({
        id:             str(r?.id),
        from:           r?.from ?? null,
        to:             r?.to ?? null,
        closingBalance: num(r?.closingBalance),
        total:          num(r?.total),
        status:         (str(r?.status) || '') as ReconciliationListRow['status'],
        reconciledAt:   r?.reconciledAt ?? null,
        accountName:    r?.accountName ?? null,
        branchName:     r?.branchName ?? null,
        employeeName:   r?.employeeName ?? null,
      })),
      count:     Number(data?.count ?? rows.length) || 0,
      pageCount: Number(data?.pageCount ?? 1) || 1,
    };
  }

  async getReconciliation(id: string): Promise<ReconciliationHeader | null> {
    const res = await this.api.request<any>(
      this.api.get(`accounts/getReconcilation/${id}`),
    );
    const raw = res?.data;
    if (!raw || typeof raw !== 'object') return null;
    return {
      id:             str(raw.id),
      from:           str(raw.from),
      to:             str(raw.to),
      closingBalance: num(raw.closingBalance),
      employeeId:     str(raw.employeeId),
      branchId:       raw.branchId ?? null,
      companyId:      str(raw.companyId),
      accountId:      str(raw.accountId),
      afterDecimal:   Number(raw.afterDecimal ?? 3) || 3,
      status:         (str(raw.status) || '') as ReconciliationHeader['status'],
      createdAt:      raw.createdAt ?? null,
      reconciledAt:   raw.reconciledAt ?? null,
      total:          num(raw.total),
      openingBalance: num(raw.openingBalance),
      attachment:     Array.isArray(raw.attachment) ? raw.attachment : [],
    };
  }

  /** Suggested period start. Server returns `{ data: { data: <date|null> } }`;
   *  `null` means "no history" → fall back to the start of this month, the
   *  same fallback the legacy service applied. */
  async getReconciliationDate(accountId: string): Promise<ReconciliationDateSuggestion> {
    const res = await this.api.request<any>(
      this.api.post('accounts/getReconcilationDate/', { accountId }),
    );
    const raw = res?.data?.data ?? null;
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (raw == null) {
      const now = new Date();
      return {
        date:    iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        minDate: '1970-01-01',
      };
    }
    const d = new Date(raw);
    const date = Number.isNaN(d.getTime()) ? String(raw).slice(0, 10) : iso(d);
    const min  = Number.isNaN(d.getTime())
      ? date
      : iso(new Date(d.getFullYear(), d.getMonth(), 1));
    return { date, minDate: min };
  }

  /** Opening balance as of `date`. A single row, or a zeroed stand-in when
   *  the account has no prior reconciliation and no journal history. */
  async getOpeningBalance(accountId: string, date: string): Promise<OpeningBalanceRow> {
    const res = await this.api.request<any>(
      this.api.post('accounts/getAccountOpeningBalance/', { accountId, date }),
    );
    const raw = res?.data;
    return {
      Debit:              num(raw?.Debit),
      Credit:             num(raw?.Credit),
      transactionDetails: str(raw?.transactionDetails) || 'Opening Balance',
      date:               raw?.date ?? date,
    };
  }

  /** Insert (empty `id`) or update. Returns `false` on a `success:false`
   *  envelope so callers can toast without unwrapping. */
  async save(payload: SaveReconciliationPayload): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.post('accounts/saveReconciliation', payload),
    );
    return !!res?.success;
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.delete(`accounts/deleteReconcilation/${id}`),
    );
    return !!res?.success;
  }

  /** Re-opens a closed period (server flips status back to `in-progress`).
   *  Only the latest period for the account is allowed. */
  async undo(id: string): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.put(`accounts/undoReconcilation/${id}`, {}),
    );
    return !!res?.success;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private toPaged(data: any): PagedResult<ReconciliationTransaction> {
    const rows: any[] = Array.isArray(data?.list) ? data.list : [];
    return {
      list: rows.map((r) => this.normalizeTransaction(r)),
      count:     Number(data?.count ?? rows.length) || 0,
      pageCount: Number(data?.pageCount ?? 1) || 1,
    };
  }

  private normalizeTransaction = (r: any): ReconciliationTransaction => ({
    id:                 str(r?.id),
    referenceId:        r?.referenceId ? String(r.referenceId) : null,
    reference:          str(r?.reference),
    referenceNumber:    r?.referenceNumber ? String(r.referenceNumber) : null,
    transactionDetails: str(r?.transactionDetails),
    date:               r?.date ?? null,
    Debit:              num(r?.Debit),
    Credit:             num(r?.Credit),
    reconcile:          !!r?.reconcile,
    user: r?.user && typeof r.user === 'object'
      ? { userName: r.user.userName ?? null, usertType: r.user.usertType ?? null }
      : null,
    isChanged: false,
  });
}
