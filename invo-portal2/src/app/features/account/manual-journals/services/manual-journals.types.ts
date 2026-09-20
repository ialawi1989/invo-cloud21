// ────────────────────────────────────────────────────────────────────
// Manual Journals domain types.
//
// Wire shapes verified directly against InvoCloudBack (feature/new-project):
//   - src/repo/app/accounts/Journal.repo.ts
//   - src/models/account/Journal.ts, JournalsLine.ts
//   - src/validationSchema/account/Journal.Schema.ts
// NOT inferred from the legacy Angular app (per project convention), though
// the legacy app happens to post/read the same shapes.
//
// Notable backend quirks preserved here (see manual-journals.service.ts for
// where they're handled):
//   - The DB stores a single signed `amount` per line (positive = debit,
//     negative = credit); the read endpoint splits it into debit/credit for
//     us, but delete/edit still key lines by `id` (`null`/`''` both mean
//     "new line").
//   - `getJournals` list rows carry `branchName`/`employeeName` (joined),
//     NOT `branchId`/`employeeId`.
//   - `saveJournalComments` REPLACES the whole comments array server-side
//     (no per-comment endpoint) and its response omits `employeeName`.
//   - `saveOpenJournal` always sets status literally to `'Open'` — it is not
//     a generic status-toggle endpoint.
// ────────────────────────────────────────────────────────────────────

export interface JournalAttachment {
  id: string;
  size: number;
  mediaUrl: string;
  mediaType: string;
  mediaName: string;
}

export interface JournalComment {
  employeeId: string;
  /** Populated by `getManualJournal` (joined); the `saveJournalComments`
   *  response does NOT include this — the view falls back to the current
   *  employee's own name for anything just posted in this session. */
  employeeName?: string;
  comment: string;
  date: string | Date;
}

export interface JournalLine {
  /** `null`/`''` both mean "insert as new line" on save. */
  id: string | null;
  code: string;
  description: string;
  debit: number;
  credit: number;
  accountId: string;
  accountName: string;
  createdAt?: string | Date;
  /** Per-line reconciled flag (joined from Reconciliations). */
  reconciled?: boolean;
  /** UI-only: marks a persisted line the user removed. Preserved (not
   *  spliced) in edit mode so the id can still be sent with `isVoided: true`
   *  and hard-deleted server-side — mirrors the legacy soft-void-until-save
   *  behaviour so a removed line can still be visually distinguished before
   *  the actual save round-trip. */
  isVoided?: boolean;
}

export type JournalStatus = '' | 'Draft' | 'Open';

export interface Journal {
  id: string;
  notes: string;
  reference: string;
  status: JournalStatus;
  attachment: JournalAttachment[];
  /** ISO 'yyyy-MM-dd'. */
  journalDate: string;
  comments: JournalComment[];
  branchId: string;
  branchName: string;
  /** True once any line is tied to a saved bank reconciliation — locks
   *  Edit/Clone/Delete everywhere (list + view), matching legacy. */
  reconciled: boolean;
  lines: JournalLine[];
}

export function emptyJournalLine(): JournalLine {
  return {
    id: null,
    code: '',
    description: '',
    debit: 0,
    credit: 0,
    accountId: '',
    accountName: '',
    isVoided: false,
  };
}

export function emptyJournal(): Journal {
  return {
    id: '',
    notes: '',
    reference: '',
    status: '',
    attachment: [],
    journalDate: toDateInput(new Date()),
    comments: [],
    branchId: '',
    branchName: '',
    reconciled: false,
    lines: [],
  };
}

/** Sum of non-voided debit/credit lines. Mirrors `Journal.calculateTotal()`
 *  in the legacy model (which itself uses precision-safe addition) — we
 *  round to 3 decimals to avoid float drift, matching the company's
 *  `afterDecimal` precision the backend enforces server-side. */
export function calculateJournalTotals(lines: JournalLine[]): { debitsTotal: number; creditsTotal: number } {
  let debitsTotal = 0;
  let creditsTotal = 0;
  for (const line of lines) {
    if (line.isVoided) continue;
    debitsTotal += Number(line.debit) || 0;
    creditsTotal += Number(line.credit) || 0;
  }
  const round = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
  return { debitsTotal: round(debitsTotal), creditsTotal: round(creditsTotal) };
}

export function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d).slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ─── List — POST accounts/getJournals ──────────────────────────────────────
export interface JournalListRow {
  id: string;
  notes: string;
  reference: string;
  journalDate: string;
  status: JournalStatus;
  createdAt: string;
  /** Joined — no `branchId` on the list row. */
  branchName: string;
  /** Signed sum of the journal's positive lines (single number, not a
   *  {debit,credit} pair) — backend computes this as SUM of debit lines. */
  amount: number;
  /** Joined — no `employeeId` on the list row. */
  employeeName: string;
  reconciled: boolean;
}

export interface JournalListParams {
  page: number;
  limit: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: 'asc' | 'desc' };
  /** Branch uuids to scope the list to. Omit to use the employee's full
   *  allowed-branches set (server default). */
  branches?: string[];
}

export interface JournalListResponse {
  list: JournalListRow[];
  count: number;
  pageCount: number;
}

// ─── Save — POST accounts/saveManualJournal ────────────────────────────────
export interface SaveJournalLinePayload {
  id: string | null;
  code: string;
  description: string;
  accountId: string;
  debit: number;
  credit: number;
  isVoided?: boolean;
}

export interface SaveJournalPayload {
  /** `''`/`null` → insert; otherwise → update. */
  id: string | null;
  branchId: string;
  reference: string;
  notes: string;
  /** Sent as `journalDate` — matches the column the backend actually
   *  persists on both insert and update (its `createdAt` schema field name
   *  is a legacy misnomer that the repo ignores on read/insert). */
  journalDate: string;
  status: JournalStatus;
  attachment: JournalAttachment[];
  lines: SaveJournalLinePayload[];
}

export interface SaveJournalResult {
  success: boolean;
  id?: string;
  msg?: string;
}
