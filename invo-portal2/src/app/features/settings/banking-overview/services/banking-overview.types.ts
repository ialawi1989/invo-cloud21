/**
 * Banking Overview — wire & UI types
 * ──────────────────────────────────
 * Backed by `accounts/*` endpoints on InvoCloudBack. Field names below were
 * verified against:
 *   - `src/repo/app/accounts/reconciliation.Repo.ts` (getRecords,
 *     getReconcilationRecordsById, getById, saveReconciliation,
 *     editReconciliation)
 *   - `src/models/account/Reconciliation.ts` (`Reconciliation` /
 *     `ReconciliationTransaction` — the `ParseJson` allow-list is the exact
 *     set of top-level fields the server reads off the save payload)
 * not inferred from the legacy Angular app (though the legacy app's request
 * shape happens to line up, since it posts the same model).
 */

// ─── Accounts overview — POST accounts/bankOverView ────────────────────────
export interface BankAccountOverviewRow {
  id:      string;
  name:    string;
  /** e.g. 'Cash' | 'Bank'. */
  type:    string;
  balance: number;
}

// ─── Reconciliation transaction row ────────────────────────────────────────
// Shared shape returned by:
//   POST accounts/getReconcilationsRecords     (ledger / transactions screen)
//   POST accounts/getReconcilationRecordsById  (reconciliation form grid)
export interface ReconciliationTransaction {
  id: string;
  /** Only populated for a subset of reference types (Invoice Payment,
   *  Billing Payment, Expense, Journal, …) — a link is only rendered when
   *  both `referenceId` and `reference` are present. */
  referenceId?: string | null;
  /** 'Invoice Payment' | 'CreditNote Refund' | 'Billing Payment' |
   *  'Supplier Refund' | 'Expense' | 'Journal' | 'PayOut' |
   *  'Vat Payments' | 'Bill of Entry' | 'Opening Balance'. */
  reference: string;
  referenceNumber?: string | null;
  transactionDetails?: string | null;
  date: string | Date | null;
  Debit:  number | null;
  Credit: number | null;
  /** True once the row is attached to a saved Reconciliation. */
  reconcile: boolean;
  reconciliationId?: string | null;
  user?: { userName: string | null; usertType: 'Customer' | 'Supplier' | null } | null;

  // ── UI-only (never sent to the server as-is) ──
  /** Marks a row the user (un)checked while editing an existing,
   *  in-progress reconciliation. */
  isChanged?: boolean;
}

// ─── Shared page/limit/search/sort shape ───────────────────────────────────
export interface PagedResult<T> {
  list: T[];
  count: number;
  pageCount: number;
}

export interface TransactionListParams {
  accountId: string;
  branchId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  /** Tri-state: omit for "all", `true` for reconciled, `false` for open. */
  reconcile?: boolean;
  sortDirection?: 'ASC' | 'DESC';
  page: number;
  limit: number;
  searchTerm?: string;
}

export interface ReconciliationListParams {
  accountId: string;
  branches?: string[] | null;
  status?: string | null;
  page: number;
  limit: number;
  searchTerm?: string;
}

// ─── Saved reconciliation-period row — POST accounts/getReconcilationList ──
export interface ReconciliationListRow {
  id: string;
  from: string | null;
  to: string | null;
  closingBalance: number;
  total: number;
  /** '' (unsaved/new) | 'in-progress' | 'reconciled'. */
  status: '' | 'in-progress' | 'reconciled';
  reconciledAt: string | null;
  accountName?: string | null;
  branchName?: string | null;
  employeeName?: string | null;
}

// ─── Reconciliation header — GET accounts/getReconcilation/:id ─────────────
export interface ReconciliationAttachment {
  id:        string;
  size:      number;
  mediaUrl:  string;
  mediaType: string;
  mediaName: string;
}

export interface ReconciliationHeader {
  id: string;
  from: string;
  to: string;
  closingBalance: number;
  employeeId: string;
  branchId: string | null;
  companyId: string;
  accountId: string;
  afterDecimal: number;
  status: '' | 'in-progress' | 'reconciled';
  createdAt: string | null;
  reconciledAt: string | null;
  total: number;
  openingBalance: number;
  attachment: ReconciliationAttachment[];
}

// ─── Opening balance — POST accounts/getAccountOpeningBalance ─────────────
export interface OpeningBalanceRow {
  Debit:  number;
  Credit: number;
  transactionDetails: string;
  date: string | Date;
}

// ─── Suggested period start — POST accounts/getReconcilationDate ──────────
export interface ReconciliationDateSuggestion {
  /** ISO 'yyyy-MM-dd'. */
  date: string;
  /** ISO 'yyyy-MM-dd' — earliest date the "from" picker should allow. */
  minDate: string;
}

// ─── Save payload — POST accounts/saveReconciliation ──────────────────────
// The server (`Reconciliation.ParseJson`) reads exactly these top-level
// fields off the body and ignores everything else; `id` empty/`'0'` means
// insert, otherwise it's routed to `editReconciliation`. `employeeId` /
// `companyId` are stamped server-side from the authenticated session, but
// the model accepts them if present — safe to omit from the client payload.
export interface SaveReconciliationPayload {
  id: string;
  accountId: string;
  from: string | Date;
  to: string | Date;
  closingBalance: number;
  branchId?: string | null;
  /** '' | 'in-progress' | 'reconciled'. */
  status: '' | 'in-progress' | 'reconciled';
  attachment?: ReconciliationAttachment[] | any[];
  afterDecimal?: number;
  transactions: ReconciliationTransaction[];
}

export function emptyReconciliationTransaction(): ReconciliationTransaction {
  return {
    id: '',
    reference: '',
    referenceNumber: '',
    transactionDetails: '',
    date: new Date(),
    Debit: 0,
    Credit: 0,
    reconcile: false,
  };
}
