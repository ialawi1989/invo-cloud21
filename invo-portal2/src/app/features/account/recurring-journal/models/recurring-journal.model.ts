// ────────────────────────────────────────────────────────────────────
// Recurring Journal domain types.
//
// Ported 1:1 from InvoCloudFront2 (`src/app/core/models/recurring-journal.ts`
// + `journal.ts`), then verified against the live backend
// (`D:\Projects\InvoCloudBack`, branch feature/new-project):
//   - Route:      src/routes/v1/app/accounts.ts
//   - Controller: src/controller/app/Accounts/RecurringJournal.controller.ts
//   - Repo:       src/repo/app/accounts/RecurringJournal.repo.ts
//   - Model:      src/models/account/RecurringJournal.ts
//   - Journal:    src/models/account/Journal.ts, JournalsLine.ts
//   - Validation: src/validationSchema/account/Journal.Schema.ts
//                 (journalValidationForRecurringJournal)
//
// Key verified facts baked into these types (see feature report for the
// full discrepancy list):
//   - `endTerm` is functionally a 2-value enum server-side: 'none' | 'by'.
//   - `type` defaults to the legacy literal 'sechedule' (typo preserved —
//     it's just an opaque string round-tripped to the backend, not
//     validated) — see `emptyRecurringJournal()`.
//   - A journal *line* has NO `productId`/`isNew`/`note` fields on the
//     backend (`JournalsLine` model) — those were dead/no-op fields in the
//     legacy Angular code and are intentionally NOT ported.
//   - `getRecurringJournalById` (edit) and `getRecurringJournalOverview`
//     (read-only view) return genuinely different shapes — see the two
//     `RecurringJournal*` request/response notes below.
//   - Server enforces: at least 2 non-voided lines, and
//     sum(debit) - sum(credit) === 0 (decimal-safe). Client-side
//     validation mirrors this so the user gets fast feedback, but the
//     server is still the source of truth.
// ────────────────────────────────────────────────────────────────────

export type RecurringPeriodicity = 'Weekly' | 'Monthly' | 'Yearly';

/** Server only interprets 'none' and 'by' — anything else behaves like
 *  'none' (never ends) in the due-date SQL. */
export type RecurringEndTerm = 'none' | 'by';

export interface RecurringJournalRepeat {
  periodicity: RecurringPeriodicity;
  /** "every N <periods>" — e.g. periodQty=2 + periodicity=Monthly → every 2 months. */
  periodQty: number;
  /** Meaning depends on periodicity: Monthly → day-of-month (1-31),
   *  Weekly → weekday (1=Monday..7=Sunday), Yearly → month (1=Jan..12=Dec). */
  on: number;
}

export function emptyRecurringJournalRepeat(): RecurringJournalRepeat {
  return { periodicity: 'Monthly', periodQty: 1, on: 1 };
}

/** A single debit/credit line of the recurring journal's transaction
 *  template. Field set intentionally matches the backend `JournalsLine`
 *  model — no legacy-only `productId`/`note`/`isNew` fields. */
export interface JournalLine {
  /** Empty/undefined for a line that hasn't been saved yet. */
  id?: string | null;
  code?: string;
  description?: string;
  debit: number;
  credit: number;
  accountId: string | null;
  accountName?: string;
  /** Soft-delete flag for an existing (saved) line — new/unsaved lines are
   *  spliced out of the array entirely instead (mirrors legacy
   *  `journal-form-lines` behavior: only edit-mode existing lines get
   *  voided, everything else is removed client-side). */
  isVoided?: boolean;
}

export function emptyJournalLine(): JournalLine {
  return { accountId: null, debit: 0, credit: 0, description: '', code: '', isVoided: false };
}

/** The recurring journal's transaction *template* — the shape a generated
 *  child Journal will be created from. Mirrors legacy `Journal`, trimmed to
 *  what the recurring-journal endpoints actually read/write (backend strips
 *  date fields like `journalDate`/`createdAt` from this nested object on
 *  save, per `trim_Date`, so they're intentionally omitted here). */
export interface JournalTransaction {
  branchId: string;
  branchName?: string;
  lines: JournalLine[];
  linesDebitsTotal?: number;
  linesCreditsTotal?: number;
}

export function emptyJournalTransaction(branchId = ''): JournalTransaction {
  return { branchId, lines: [], linesDebitsTotal: 0, linesCreditsTotal: 0 };
}

/** One row of a recurring journal's generated-journal history — only
 *  present on `getRecurringJournalOverview` (`childJournals`), a
 *  `json_agg` of the child `Journals` rows. */
export interface RecurringJournalChildEntry {
  id: string;
  createdAt: string;
  notes?: string | null;
  reference?: string;
  status: string;
  journalDate: string;
  recurringJournalId: string;
}

export interface RecurringJournal {
  /** Empty string for a new (unsaved) record. */
  id: string;
  name: string;
  /** Mirrored from `transactionDetails.branchId` before save (legacy
   *  behavior) — kept in sync by the service/form, not user-edited directly. */
  branchId: string;
  /** Only present on list rows / overview (joined server-side); absent on
   *  `getRecurringJournalById` (edit payload). */
  branchName?: string;
  createdAt?: string;
  updatedDate?: string;
  /** Opaque legacy literal — always 'sechedule' (sic). Round-tripped as-is;
   *  the backend never selects/validates it beyond storing the string. */
  type: string;
  startDate: string;
  endDate: string | null;
  endTerm: RecurringEndTerm;
  repeatData: RecurringJournalRepeat;
  /** Not surfaced in any legacy UI control — always 0 on new records,
   *  round-tripped on edit. */
  journalCreatedBefore: number;
  /** Only present on `getRecurringJournalById` (edit) — absent from
   *  `getRecurringJournalOverview` (view). */
  transactionDetails?: JournalTransaction;
  /** Only present on `getRecurringJournalOverview` — computed server-side
   *  (`nextOccurrence()`), not stored. */
  nextJournalDate?: string | null;
  /** Live COUNT of child Journals — present on list rows and overview. */
  childJournalsQty?: number;
  /** Client-derived (`childJournalsQty > 0`) — the backend has no such
   *  column. Used to gate delete (see `hasGeneratedJournals`). */
  hasJournals?: boolean;
  /** Only present on `getRecurringJournalOverview`. */
  childJournals?: RecurringJournalChildEntry[] | null;
}

export function emptyRecurringJournal(branchId = ''): RecurringJournal {
  return {
    id: '',
    name: '',
    branchId,
    type: 'sechedule',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: null,
    endTerm: 'none',
    repeatData: emptyRecurringJournalRepeat(),
    journalCreatedBefore: 0,
    transactionDetails: emptyJournalTransaction(branchId),
  };
}

// ─── List ───────────────────────────────────────────────────────────

export interface RecurringJournalListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue?: string; sortDirection?: 'asc' | 'desc' };
  /** Branch ids to filter by. NOTE (verified against backend): sent as
   *  `filter.branches`. The legacy frontend also sent `filter.fromDate` /
   *  `filter.toDate`, but the backend repo query never reads them — date
   *  filtering on this endpoint is a legacy-frontend-only no-op, so it is
   *  intentionally NOT implemented here (see feature report). */
  branches?: string[];
}

export interface RecurringJournalListRow {
  id: string;
  name: string;
  createdAt: string;
  updatedDate: string;
  branchId: string;
  branchName: string;
  startDate: string;
  endDate: string | null;
  endTerm: RecurringEndTerm;
  repeatData: RecurringJournalRepeat;
  childJournalsQty: number;
  hasJournals: boolean;
}

export interface RecurringJournalListResponse {
  list: RecurringJournalListRow[];
  count: number;
  pageCount: number;
}
