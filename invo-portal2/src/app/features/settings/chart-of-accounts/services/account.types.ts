// ────────────────────────────────────────────────────────────────────
// Chart-of-Accounts domain types. Wire shape mirrors the legacy
// `Account` model so existing records round-trip without translation.
// ────────────────────────────────────────────────────────────────────

export interface Account {
  /** Empty string for new (unsaved) records. */
  id:           string;
  name:         string;
  /** One of `ACCOUNT_TYPES[*].id`. Locked once saved. */
  type:         string;
  /** Parent bucket of `type` (e.g. "Current Assets"). Derived
   *  client-side on save; we still round-trip the server value to
   *  preserve legacy records that may have hand-set it. */
  parentType?:  string;
  /** Optional GL code / ledger number. */
  code?:        string;
  description?: string;
  /** Hierarchical parent for sub-accounts. Optional — when set
   *  this account rolls up under another. */
  parentId?:    string | null;
  /** True for system-seeded defaults (Cash, Bank, Equity, …) —
   *  the form locks name + type + delete on these rows. */
  default?:     boolean;
  /** True when this account has children — drives the form's
   *  "cannot change parent" rule. */
  hasChild?:    boolean;
  /** Localised copies. Round-tripped verbatim; the primary `name`
   *  always mirrors `translation.name.en`. */
  translation?: { name?: { en?: string; ar?: string }; description?: { en?: string; ar?: string } };
}

export interface AccountListParams {
  page?:       number;
  limit?:      number;
  searchTerm?: string;
  sortBy?:     { sortValue?: string; sortDirection?: 'asc' | 'desc' };
  /** Filter to accounts whose `parentType` is in this list. */
  parentType?: string[];
  /** Keys of columns the user has visible — sent to the backend so
   *  it can project just those fields (matches the legacy product
   *  list behaviour). Empty / omitted means "send everything". */
  columns?:    string[];
}

export interface AccountListResponse {
  list:      Account[];
  count:     number;
  pageCount: number;
}

export function emptyAccount(): Account {
  return {
    id:          '',
    name:        '',
    type:        '',
    parentType:  '',
    code:        '',
    description: '',
    parentId:    null,
  };
}
