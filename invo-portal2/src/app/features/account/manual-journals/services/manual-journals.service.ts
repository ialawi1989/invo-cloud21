import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';

import {
  Journal,
  JournalAttachment,
  JournalComment,
  JournalLine,
  JournalListParams,
  JournalListResponse,
  JournalListRow,
  SaveJournalPayload,
  emptyJournal,
  toDateInput,
} from './manual-journals.types';

/**
 * Wraps the legacy `accounts/*` Manual Journal endpoints (verified against
 * InvoCloudBack `feature/new-project` — see manual-journals.types.ts header
 * for the source files):
 *
 *   POST   accounts/getJournals              → paginated list
 *   GET    accounts/getManualJournal/:id     → single read (with lines/comments/attachments)
 *   POST   accounts/saveManualJournal        → create/update (branchId + lines, min 2)
 *   DELETE accounts/deleteJournal/:id        → hard delete
 *   PUT    accounts/saveOpenJournal/:id      → always sets status to 'Open' (no body)
 *   POST   accounts/saveJournalComments      → REPLACES the whole comments array
 *
 * Chart-of-accounts (line-item account picker) is NOT duplicated here —
 * reuse `AccountService` from the chart-of-accounts feature, which already
 * wraps `accounts/getAccounts`.
 */
@Injectable({ providedIn: 'root' })
export class ManualJournalsService {
  private api = inject(ApiService);

  // ─── List ─────────────────────────────────────────────────────────────
  async getList(params: JournalListParams): Promise<JournalListResponse> {
    const body: Record<string, unknown> = {
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm ?? '',
      sortBy: params.sortBy ?? {},
    };
    if (params.branches?.length) {
      body['filter'] = { branches: params.branches };
    }

    const res = await this.api.request<any>(this.api.post('accounts/getJournals', body));
    const data = res?.data ?? {};
    const list: JournalListRow[] = (Array.isArray(data.list) ? data.list : []).map(this.normalizeListRow);
    return {
      list,
      count: Number(data.count ?? list.length) || 0,
      pageCount: Number(data.pageCount ?? 1) || 1,
    };
  }

  // ─── Single read ──────────────────────────────────────────────────────
  async getById(id: string): Promise<Journal | null> {
    const res = await this.api.request<any>(this.api.get(`accounts/getManualJournal/${id}`));
    const raw = res?.data ?? res;
    if (!raw || typeof raw !== 'object' || !raw.id) return null;
    return this.normalize(raw);
  }

  /** Clone: load the source, blank id/reference/each line's code, reset the
   *  date to today. Mirrors legacy `cloneManualJournal()` exactly — does
   *  NOT blank line accountId/debit/credit, only reference/date/line.code. */
  async clone(id: string): Promise<Journal | null> {
    const src = await this.getById(id);
    if (!src) return null;
    return {
      ...src,
      id: '',
      journalDate: toDateInput(new Date()),
      reference: '',
      status: '',
      lines: src.lines.map((line) => ({ ...line, code: '' })),
    };
  }

  // ─── Save ─────────────────────────────────────────────────────────────
  /** Throws `ApiErrorException` on `!success` (via `ApiService.call`) so the
   *  form can surface validation/business errors through the centralized
   *  error modal (`ErrorService.handleError`), matching the sibling
   *  Recurring Journal form's convention. */
  async save(payload: SaveJournalPayload): Promise<{ id: string }> {
    const data = await this.api.call<any>(this.api.post('accounts/saveManualJournal', payload));
    return { id: data?.id != null ? String(data.id) : '' };
  }

  // ─── Delete ───────────────────────────────────────────────────────────
  async delete(id: string): Promise<boolean> {
    const res = await this.api.request<any>(this.api.delete(`accounts/deleteJournal/${id}`));
    return !!res?.success;
  }

  // ─── Open (Draft → Open) ──────────────────────────────────────────────
  /** Server always sets status literally to 'Open' — no body is sent, none
   *  is read. Only meaningful from a 'Draft' journal (UI-gated). */
  async openJournal(id: string): Promise<boolean> {
    const res = await this.api.request<any>(this.api.put(`accounts/saveOpenJournal/${id}`, {}));
    return !!res?.success;
  }

  // ─── Comments ─────────────────────────────────────────────────────────
  /** Sends the FULL comments array (existing + new) — the backend replaces
   *  wholesale, there is no per-comment create/delete endpoint. Returns the
   *  server's authoritative array (employeeId/date stamped server-side for
   *  any entry missing them; NOTE: the response omits `employeeName`, the
   *  caller must fall back to the current employee's own name for it). */
  async saveComments(id: string, comments: JournalComment[]): Promise<JournalComment[]> {
    const res = await this.api.request<any>(
      this.api.post('accounts/saveJournalComments', { journalId: id, comments }),
    );
    return Array.isArray(res?.data) ? res.data : comments;
  }

  // ─── Normalization ────────────────────────────────────────────────────
  private normalizeListRow = (raw: any): JournalListRow => ({
    id: String(raw?.id ?? ''),
    notes: raw?.notes ?? '',
    reference: raw?.reference ?? '',
    journalDate: raw?.journalDate ?? '',
    status: raw?.status ?? '',
    createdAt: raw?.createdAt ?? '',
    branchName: raw?.branchName ?? '',
    amount: Number(raw?.amount) || 0,
    employeeName: raw?.employeeName ?? '',
    reconciled: !!raw?.reconciled,
  });

  private normalizeAttachment = (raw: any): JournalAttachment => ({
    id: String(raw?.id ?? ''),
    size: Number(raw?.size) || 0,
    mediaUrl: raw?.mediaUrl ?? '',
    mediaType: raw?.mediaType ?? '',
    mediaName: raw?.mediaName ?? '',
  });

  private normalizeLine = (raw: any): JournalLine => ({
    id: raw?.id != null && raw.id !== '' ? String(raw.id) : null,
    code: raw?.code ?? '',
    description: raw?.description ?? '',
    debit: Number(raw?.debit) || 0,
    credit: Number(raw?.credit) || 0,
    accountId: raw?.accountId ?? '',
    accountName: raw?.accountName ?? '',
    createdAt: raw?.createdAt,
    reconciled: !!raw?.reconciled,
    isVoided: false,
  });

  private normalize = (raw: any): Journal => {
    const base = emptyJournal();
    return {
      ...base,
      id: String(raw?.id ?? ''),
      notes: raw?.notes ?? '',
      reference: raw?.reference ?? '',
      status: (raw?.status ?? '') as Journal['status'],
      attachment: (Array.isArray(raw?.attachment) ? raw.attachment : []).map(this.normalizeAttachment),
      journalDate: raw?.journalDate ? toDateInput(raw.journalDate) : base.journalDate,
      comments: Array.isArray(raw?.comments) ? raw.comments : [],
      branchId: raw?.branchId ?? '',
      branchName: raw?.branchName ?? '',
      reconciled: !!raw?.reconciled,
      lines: (Array.isArray(raw?.lines) ? raw.lines : []).map(this.normalizeLine),
    };
  };
}
