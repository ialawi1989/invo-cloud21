// ────────────────────────────────────────────────────────────────────
// Static account-type registry — mirrors the legacy
// `AccountService.accounts` list verbatim. Each entry's `id` doubles
// as the wire-format `type` field on a `PaymentMethod` /
// `Account` record (the backend keys off the exact string).
//
// `parentType` is the higher-level bucket the entry rolls up to
// — drives the type-filter dropdown on the list page (one chip per
// distinct parentType) and groups the type picker on the form.
// ────────────────────────────────────────────────────────────────────

export interface AccountType {
  /** Wire value stored on `Account.type`. Identical to `name`
   *  for every entry; kept as a separate field so future renames
   *  can land without breaking saved records. */
  id:         string;
  /** Human-readable label (also used as the default English
   *  translation). */
  name:       string;
  /** The grouping bucket — Current Assets, Equity, etc. Several
   *  account-types share a parent (e.g. Cash and Bank are both
   *  Current Assets). */
  parentType: string;
}

export const ACCOUNT_TYPES: readonly AccountType[] = [
  // ─── Assets ─────────────────────────────────────────────────────
  { id: 'Account Receivable',      name: 'Account Receivable',      parentType: 'Current Assets' },
  { id: 'Cash',                    name: 'Cash',                    parentType: 'Current Assets' },
  { id: 'Current Assets',          name: 'Current Assets',          parentType: 'Current Assets' },
  { id: 'Bank',                    name: 'Bank',                    parentType: 'Current Assets' },
  { id: 'Other Current Assets',    name: 'Other Current Assets',    parentType: 'Other Current Assets' },
  { id: 'Fixed Assets',            name: 'Fixed Assets',            parentType: 'Fixed Assets' },
  { id: 'Intangible Asset',        name: 'Intangible Asset',        parentType: 'Non Current Assets' },

  // ─── Liabilities ────────────────────────────────────────────────
  { id: 'Current Liabilities',     name: 'Current Liabilities',     parentType: 'Current Liabilities' },
  { id: 'Account Payable',         name: 'Account Payable',         parentType: 'Current Liabilities' },
  { id: 'Other Current Liabilities', name: 'Other Current Liabilities', parentType: 'Other Current Liabilities' },
  { id: 'Long Term Liabilities',   name: 'Long Term Liabilities',   parentType: 'Long Term Liabilities' },

  // ─── Equity ─────────────────────────────────────────────────────
  { id: 'Equity',                  name: 'Equity',                  parentType: 'Equity' },

  // ─── Income ─────────────────────────────────────────────────────
  { id: 'Sales',                   name: 'Sales',                   parentType: 'Operating Income' },
  { id: 'Income',                  name: 'Income',                  parentType: 'Operating Income' },
  { id: 'Other Income',            name: 'Other Income',            parentType: 'Operating Income' },

  // ─── Cost of Goods Sold ────────────────────────────────────────
  { id: 'Costs Of Goods Sold',     name: 'Costs Of Goods Sold',     parentType: 'Costs Of Goods Sold' },

  // ─── Expense ────────────────────────────────────────────────────
  { id: 'Expense',                 name: 'Expense',                 parentType: 'Operating Expense' },
  { id: 'Other Expense',           name: 'Other Expense',           parentType: 'Operating Expense' },
];

/** Distinct parent-type buckets in display order — drives the
 *  list-page filter and the form's type picker grouping. */
export const ACCOUNT_PARENT_TYPES: readonly string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of ACCOUNT_TYPES) {
    if (!seen.has(t.parentType)) {
      seen.add(t.parentType);
      out.push(t.parentType);
    }
  }
  return out;
})();

export function findAccountType(id: string): AccountType | undefined {
  return ACCOUNT_TYPES.find(t => t.id === id);
}

/** i18n key for an account-type / parent-type wire value. Exact Arabic
 *  labels live under `CHART_OF_ACCOUNTS.ACCOUNT_TYPE.*` (ported from the
 *  legacy `MENUITEMS.ACCOUNTS.LIST.*` strings). */
export function accountTypeKey(value: string | null | undefined): string {
  return value ? `CHART_OF_ACCOUNTS.ACCOUNT_TYPE.${value}` : '';
}
