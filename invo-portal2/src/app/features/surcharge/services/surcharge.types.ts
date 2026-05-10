// ────────────────────────────────────────────────────────────────────
// Surcharge — named per-company surcharge applied to invoices /
// receipts. Either a flat amount or a percentage; can optionally
// be paired with a tax id.
//
// Mirrors the legacy `Surcharge` class in InvoCloudFront2 — the
// server's wire format is identical, so this front-end only adds
// canonical TS types around it.
// ────────────────────────────────────────────────────────────────────

export interface Surcharge {
  /** Empty string for new (unsaved) surcharges. */
  id:         string;
  name:       string;
  /** Numeric value — fixed amount or percentage depending on
   *  `percentage`. Server stores both flavours in the same
   *  `amount` column. */
  amount:     number;
  /** When `true`, `amount` is interpreted as a percentage. */
  percentage: boolean;
  companyId?: string;
  /** Optional linked tax id. Empty string and `null` both mean
   *  "no tax linked". */
  taxId:      string | null;
}

export interface SurchargeListParams {
  page?:       number;
  limit?:      number;
  searchTerm?: string;
  sortBy?:     { sortValue?: string; sortDirection?: 'asc' | 'desc' };
}

export interface SurchargeListResponse {
  list:      Surcharge[];
  count:     number;
  pageCount: number;
}

/** Empty surcharge for new-form seeding. */
export function emptySurcharge(): Surcharge {
  return {
    id:         '',
    name:       '',
    amount:     0,
    percentage: false,
    taxId:      null,
  };
}
