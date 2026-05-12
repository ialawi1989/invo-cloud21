// ────────────────────────────────────────────────────────────────────
// Payment method — named per-company payment option (Cash currency,
// Card, or an online provider like Tap / Thawani / BenefitPay).
//
// Mirrors the legacy `PaymnetMethod` class (typo intentional in the
// wire format) closely enough that the existing
// `accounts/{getPaymentMethodList, savePaymentMethod, ...}`
// endpoints round-trip unchanged. This MVP front-end covers:
//   • Cash + Card manual entries (the "regular" form).
//   • Online providers as cards with enable/disable only — the
//     per-provider credential forms are deferred to follow-ups.
// ────────────────────────────────────────────────────────────────────

/** Top-level payment kind. `'Cash'` = currency wallets, `'Card'` =
 *  card-on-file / generic card; online providers also report as
 *  `'Card'` on the wire — the UI distinguishes them via the
 *  separate "Online providers" tab. */
export type PaymentKind = 'Cash' | 'Card';

/** Light-weight thumbnail wrapper — server returns
 *  `{ defaultUrl, thumbnailUrl }` or `null`. */
export interface PaymentMethodImage {
  defaultUrl?:    string;
  thumbnailUrl?:  string;
}

export interface PaymentMethodOptions {
  /** Open the cash drawer at the POS after a sale on this method. */
  OpenDrawer: boolean;
  /** Require the cashier to type a reference code when picking. */
  ReqCode:    boolean;
}

export interface PaymentMethod {
  /** Empty string for new (unsaved) methods. */
  id:               string;
  name:             string;
  type:             PaymentKind;
  /** Exchange rate against the company's base currency. `1` for
   *  the base currency itself; ≥ 0 otherwise. */
  rate:             number;
  /** ISO country code the method's currency belongs to (used by
   *  the picker; not surfaced in the lean form). */
  country?:         string;
  /** Countries the method is available in — for online providers
   *  the backend uses this to filter what's offered per company. */
  countries?:       string[];
  /** Currency symbol shown next to amounts. */
  symbol:           string;
  /** Bank/card processing fee as a percentage (0–100). Only
   *  meaningful for `type === 'Card'`. */
  bankCharge:       number;
  /** Decimal precision for amounts displayed in this method. */
  afterDecimal:     number;
  /** GL account id this method posts to. */
  accountId:        string | null;
  accountName:      string | null;
  /** Sort order — drives the drag-reorder save payload. */
  index:            number;
  /** Master enable/disable flag — toggled inline on the list. */
  isEnabled:        boolean;
  /** Available at the POS (drives the cashier's method picker). */
  pos:              boolean;
  /** Whether the method appears in the Accounts module. */
  showInAccount:    boolean;
  options:          PaymentMethodOptions;
  /** Server-resolved thumbnail (the form uploads via a media id). */
  mediaUrl:         PaymentMethodImage | null;
  mediaId:          string | null;
  /** Localised name copies — written by the translation modal,
   *  round-tripped verbatim. The primary `name` field always
   *  mirrors `translation.name.en` so legacy queries still match. */
  translation?:     { name?: { en?: string; ar?: string } };
  /** Per-branch GL-account override. Map of `branchId → accountId`;
   *  unset / missing branches fall back to the main `accountId`. The
   *  legacy wire shape is an object literal (not an array), so we
   *  round-trip it as-is. */
  branchesAccounts?: Record<string, string>;
  /** Provider-specific credentials (Tap/Thawani/…); opaque in this
   *  MVP — round-tripped verbatim so existing records don't lose
   *  their config when the user saves an unrelated field. */
  settings?:        Record<string, unknown>;
  /** Whether this is the company's hardcoded "Default Cash" — the
   *  legacy page blocks edits on it. */
  isDefaultCash?:   boolean;
  /** Read-only — populated by the backend with the live account
   *  balance for the list rows. */
  accountBalance?:  string;
  /** Last update — used by the list for sort fallback. */
  updatedDate?:     string;
}

export interface PaymentMethodListParams {
  page?:       number;
  limit?:      number;
  searchTerm?: string;
  sortBy?:     { sortValue?: string; sortDirection?: 'asc' | 'desc' };
  /** Server-side filter: `'Cash'` | `'Card'`. Omit for everything. */
  type?:       PaymentKind;
}

export interface PaymentMethodListResponse {
  list:      PaymentMethod[];
  count:     number;
  pageCount: number;
}

/** Lightweight GL account row used by the form's account picker. */
export interface PaymentAccount {
  id:    string;
  name:  string;
  /** Optional account number / code for disambiguation. */
  code?: string;
}

export function emptyPaymentMethod(): PaymentMethod {
  return {
    id:            '',
    name:          '',
    type:          'Cash',
    rate:          1,
    symbol:        '',
    bankCharge:    0,
    afterDecimal:  3,
    accountId:     null,
    accountName:   null,
    index:         0,
    isEnabled:     true,
    pos:           true,
    showInAccount: true,
    options:       { OpenDrawer: false, ReqCode: false },
    mediaUrl:      null,
    mediaId:       null,
    settings:      {},
  };
}
