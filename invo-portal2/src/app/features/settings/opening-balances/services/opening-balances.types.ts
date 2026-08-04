// ────────────────────────────────────────────────────────────────────
// Opening Balances domain types. Wire shape mirrors the legacy
// `accounts/getOpeningBalanceAccounts` / `saveAccountsOpeningBalance`
// payloads so records round-trip without translation.
// ────────────────────────────────────────────────────────────────────

/** One chart-of-accounts line in the opening-balances grid. */
export interface OpeningBalanceAccount {
  accountId:  string | null;
  name:       string;
  default:    boolean;
  /** Account sub-type, e.g. "Cash", "Bank", "Account Receivable". */
  type:       string;
  /** Parent bucket, e.g. "Current Assets", "Current Liabilities". */
  parentType: string;
  debit:      number;
  credit:     number;

  // ── UI-only flags (never sent back except the six wire fields above) ──
  /** Read-only row — value is driven by sub-records, not typed directly
   *  (default AR / AP, and every Inventory Assets account). */
  readonly?:   boolean;
  /** The "Opening Balance Adjustment" account is hidden from the grid. */
  hidden?:     boolean;
  /** AR / AP / Inventory rows expand to paginated sub-records. */
  expandable?: boolean;
  /** Which record list backs this account when expanded. */
  recordKind?: 'receivable' | 'payable' | 'inventory';
  expanded?:   boolean;
}

/** A paginated sub-record under an expandable account. Customers (AR) and
 *  suppliers (AP) only use `id/name/openingBalance`; inventory adds
 *  `stock/openingBalanceCost` and an inline-edit flag. */
export interface OpeningBalanceRecord {
  id:                  string;
  name:                string;
  openingBalance:      number;
  stock?:              number;
  openingBalanceCost?: number;
  /** Inventory rows only — inline edit toggle. */
  editing?:            boolean;
}

/** Live state for an expandable account's record panel. */
export interface RecordPanelState {
  list:      OpeningBalanceRecord[];
  page:      number;
  limit:     number;
  count:     number;
  pageCount: number;
  search:    string;
  loading:   boolean;
}

/** Response of `getOpeningBalanceAccounts/:branchId`. */
export interface OpeningBalanceLoad {
  accounts:          OpeningBalanceAccount[];
  openingBalanceDate: string | null;
}

/** Body for `saveAccountsOpeningBalance`. */
export interface SaveOpeningBalancePayload {
  branchId:           string;
  openingBalanceDate: string | null;
  accounts:           Array<Pick<OpeningBalanceAccount,
    'accountId' | 'name' | 'default' | 'type' | 'parentType' | 'debit' | 'credit'>>;
}
