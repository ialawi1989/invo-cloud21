import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import {
  JournalLine,
  RecurringJournal,
  RecurringJournalListParams,
  RecurringJournalListResponse,
  RecurringJournalListRow,
  emptyJournalTransaction,
} from '../models/recurring-journal.model';

/**
 * Wraps the legacy `accounts/*RecurringJournal*` endpoints — verified
 * against `D:\Projects\InvoCloudBack` (route → controller → repo → model,
 * branch feature/new-project):
 *
 *   POST   accounts/getRecurringJournalList        → paginated list
 *   GET    accounts/getRecurringJournalById/:id    → full edit payload
 *   GET    accounts/getRecurringJournalOverview/:id → read-only view + child-journal history
 *   POST   accounts/saveRecurringJournal            → create/update (single endpoint, branches on `id`)
 *   DELETE accounts/deleteRecurringJournal/:id      → remove (blocked server-side if child journals exist)
 *
 * All 5 endpoints are wrapped in the standard `{ success, message, data }`
 * envelope. There is NO activate/deactivate/run-now endpoint — recurring
 * journals are pure CRUD templates; actual child-journal generation only
 * happens via a separate cron-style batch sweep with no per-record trigger,
 * so no such action is exposed here (matches the legacy UI exactly).
 */
@Injectable({ providedIn: 'root' })
export class RecurringJournalService {
  private api = inject(ApiService);

  // ─── List ───────────────────────────────────────────────────────
  async getList(params: RecurringJournalListParams = {}): Promise<RecurringJournalListResponse> {
    const body: Record<string, unknown> = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy: params.sortBy ?? {},
    };
    // Legacy expects `filter.branches: string[]`; omit the key entirely
    // when empty (an empty array is treated as "match nothing" server-side,
    // same caveat documented on AccountService.getList/parentType).
    if (params.branches?.length) {
      body['filter'] = { branches: params.branches };
    }

    const res = await this.api.request<any>(
      this.api.post('accounts/getRecurringJournalList', body),
    );
    const data = res?.data ?? {};
    const list: any[] = Array.isArray(data.list) ? data.list : [];
    return {
      list: list.map(this.normalizeListRow),
      count: Number(data.count ?? list.length) || 0,
      pageCount: Number(data.pageCount ?? 1) || 1,
    };
  }

  /** Full edit-form payload (includes `transactionDetails`, does NOT
   *  include `branchName`/`childJournals`/`nextJournalDate` — those only
   *  come from `getOverview`). Returns `null` if the id doesn't resolve. */
  async getById(id: string): Promise<RecurringJournal | null> {
    const res = await this.api.request<any>(
      this.api.get(`accounts/getRecurringJournalById/${id}`),
    );
    const raw = res?.data;
    if (!raw || typeof raw !== 'object' || !raw.id) return null;
    return this.normalize(raw);
  }

  /** Read-only overview for the view page: adds `branchName`,
   *  `childJournals` (generated-journal history, `null` if none) and a
   *  server-computed `nextJournalDate`. Does NOT include
   *  `transactionDetails` — never use this to prefill the edit form.
   *  The repo can return `{}` for a non-matching id (not an HTTP error). */
  async getOverview(id: string): Promise<RecurringJournal | null> {
    const res = await this.api.request<any>(
      this.api.get(`accounts/getRecurringJournalOverview/${id}`),
    );
    const raw = res?.data;
    if (!raw || typeof raw !== 'object' || !raw.id) return null;
    return this.normalize(raw);
  }

  /**
   * Create or update. Single endpoint — the backend branches on
   * `id == null || id == ''`. Server-side validation (verified):
   *   - `name` must be unique (case-insensitive, per company, excludes self on edit)
   *   - `transactionDetails.branchId` required
   *   - `transactionDetails.lines` — minItems 2, each requires accountId/debit/credit
   *   - non-voided lines: at least 2, and sum(debit) - sum(credit) === 0
   * Throws `ApiErrorException` (via `ApiService.call`) with the server's
   * structured error on any of the above.
   */
  async save(journal: RecurringJournal): Promise<{ id: string }> {
    const payload = this.toWire(journal);
    const res = await this.api.call<{ id: string }>(
      this.api.post('accounts/saveRecurringJournal', payload),
    );
    return { id: String(res?.id ?? journal.id ?? '') };
  }

  /** Throws `ApiErrorException` — in particular the backend blocks delete
   *  with "cannot delete Recurring Journal with child Journals" once at
   *  least one child journal has been generated. Surface that message to
   *  the user rather than assuming delete is always safe. */
  async delete(id: string): Promise<void> {
    await this.api.call(this.api.delete(`accounts/deleteRecurringJournal/${id}`));
  }

  // ─── Wire mapping ───────────────────────────────────────────────

  /** Build the save payload. Mirrors legacy `saveRecurringJournal`
   *  pre-processing: keep the top-level `branchId` mirrored from
   *  `transactionDetails.branchId`, and drop client-only fields
   *  (`branchName`, `childJournalsQty`, `hasJournals`, `childJournals`,
   *  `nextJournalDate`) that the backend doesn't read on save. */
  private toWire(journal: RecurringJournal): any {
    const branchId = journal.transactionDetails?.branchId || journal.branchId || '';
    const lines: JournalLine[] = (journal.transactionDetails?.lines ?? [])
      // Drop brand-new, never-saved, fully-empty lines rather than send
      // dead rows — mirrors legacy's line-cleanup pass on save.
      .filter(l => !(!(l.id) && !l.accountId && !l.debit && !l.credit));

    return {
      id: journal.id || null,
      name: journal.name,
      type: journal.type || 'sechedule',
      branchId,
      startDate: journal.startDate,
      endDate: journal.endTerm === 'by' ? journal.endDate : null,
      endTerm: journal.endTerm,
      repeatData: journal.repeatData,
      journalCreatedBefore: journal.journalCreatedBefore ?? 0,
      transactionDetails: {
        branchId,
        lines: lines.map(l => ({
          id: l.id || undefined,
          code: l.code || '',
          description: l.description || '',
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          accountId: l.accountId,
          isVoided: !!l.isVoided,
        })),
      },
    };
  }

  private normalizeListRow = (raw: any): RecurringJournalListRow => ({
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? ''),
    createdAt: raw?.createdAt ?? '',
    updatedDate: raw?.updatedDate ?? '',
    branchId: String(raw?.branchId ?? ''),
    branchName: String(raw?.branchName ?? ''),
    startDate: raw?.startDate ?? '',
    endDate: raw?.endDate ?? null,
    endTerm: (raw?.endTerm === 'by' ? 'by' : 'none'),
    repeatData: {
      periodicity: raw?.repeatData?.periodicity ?? 'Monthly',
      periodQty: Number(raw?.repeatData?.periodQty ?? 1) || 1,
      on: Number(raw?.repeatData?.on ?? 1) || 1,
    },
    // Not a stored column — live COUNT from the backend; still normalise
    // defensively in case a caller hits an endpoint that omits it.
    childJournalsQty: Number(raw?.childJournalsQty ?? 0) || 0,
    hasJournals: Number(raw?.childJournalsQty ?? 0) > 0,
  });

  private normalize = (raw: any): RecurringJournal => {
    const transactionDetails = raw?.transactionDetails
      ? {
          branchId: String(raw.transactionDetails.branchId ?? raw.branchId ?? ''),
          branchName: raw.transactionDetails.branchName,
          lines: Array.isArray(raw.transactionDetails.lines)
            ? raw.transactionDetails.lines.map((l: any) => ({
                id: l?.id ?? null,
                code: l?.code ?? '',
                description: l?.description ?? '',
                debit: Number(l?.debit ?? 0) || 0,
                credit: Number(l?.credit ?? 0) || 0,
                accountId: l?.accountId ?? null,
                accountName: l?.accountName ?? '',
                isVoided: !!l?.isVoided,
              }))
            : [],
        }
      : undefined;

    const childJournalsQty = Number(raw?.childJournalsQty ?? 0) || 0;

    return {
      id: String(raw?.id ?? ''),
      name: String(raw?.name ?? ''),
      branchId: String(raw?.branchId ?? transactionDetails?.branchId ?? ''),
      branchName: raw?.branchName ? String(raw.branchName) : undefined,
      createdAt: raw?.createdAt,
      updatedDate: raw?.updatedDate,
      type: raw?.type ?? 'sechedule',
      startDate: raw?.startDate ?? '',
      endDate: raw?.endDate ?? null,
      endTerm: raw?.endTerm === 'by' ? 'by' : 'none',
      repeatData: {
        periodicity: raw?.repeatData?.periodicity ?? 'Monthly',
        periodQty: Number(raw?.repeatData?.periodQty ?? 1) || 1,
        on: Number(raw?.repeatData?.on ?? 1) || 1,
      },
      journalCreatedBefore: Number(raw?.journalCreatedBefore ?? 0) || 0,
      transactionDetails: transactionDetails ?? emptyJournalTransaction(String(raw?.branchId ?? '')),
      nextJournalDate: raw?.nextJournalDate ?? null,
      childJournalsQty,
      hasJournals: childJournalsQty > 0,
      childJournals: Array.isArray(raw?.childJournals) ? raw.childJournals : (raw?.childJournals ?? null),
    };
  };
}
