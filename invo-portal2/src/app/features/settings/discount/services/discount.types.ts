// ────────────────────────────────────────────────────────────────────
// Discount — named per-company discount applied at POS / checkout.
//
// Mirrors the legacy `Discount` class in InvoCloudFront2 closely
// enough that the existing `accounts/{getDiscountList,getDiscount,
// saveDiscount}` endpoints round-trip unchanged. This MVP front-end
// covers only the *manual* discount flow — automatic schedules
// (start/expire dates, allDay, employee permissions) are deferred
// to a follow-up and intentionally kept off the form, but the
// fields below remain on the type so a future patch can re-surface
// them without a wire-format break.
// ────────────────────────────────────────────────────────────────────

export type DiscountType    = 'manual' | 'automatic';
export type DiscountApplyTo = 'product' | 'category';

export interface Discount {
  /** Empty string for new (unsaved) discounts. */
  id:                       string;
  name:                     string;
  /** Numeric value — fixed amount when `percentage=false`, or a
   *  percentage 0–100 when `true`. The server stores both flavours
   *  in the same `amount` column. */
  amount:                   number;
  /** When `true`, `amount` is interpreted as a percentage. */
  percentage:               boolean;
  /** `manual` = POS-applied; `automatic` = scheduled. MVP only
   *  exposes `manual` in the UI, but the type stays so older
   *  records round-trip cleanly. */
  type:                     DiscountType;
  /** Which entity the `items` ids refer to. MVP only exposes
   *  `product`; the field remains for forward-compatibility with
   *  category-scoped discounts. */
  applyTo:                  DiscountApplyTo;
  /** Ids the discount applies to (products or categories per
   *  `applyTo`). Empty array = applies to everything. */
  items:                    string[];
  /** Branch ids the discount is restricted to. Empty array =
   *  available at every branch. */
  branches:                 string[];
  /** Minimum product quantity required to trigger the discount.
   *  `0` = no minimum. */
  minProductQty:            number;
  /** Optional linked tax id. */
  taxId:                    string | null;
  /** When `true`, the cash discount applies per quantity rather
   *  than per line. Mutually exclusive with `percentage`. */
  quantityBasedCashDiscount: boolean;
  available:                boolean;
  availableOnline:          boolean;

  // ── Automatic-only (kept on the type, hidden in MVP UI) ─────
  startDate?:               string | null;
  expireDate?:              string | null;
  startAtTime?:             string | null;
  expireAtTime?:            string | null;
  permittedEmployees?:      string[];
}

export interface DiscountListParams {
  page?:       number;
  limit?:      number;
  searchTerm?: string;
  sortBy?:     { sortValue?: string; sortDirection?: 'asc' | 'desc' };
}

export interface DiscountListResponse {
  list:      Discount[];
  count:     number;
  pageCount: number;
}

/** Empty discount for new-form seeding. Defaults match the legacy
 *  model's constructor so unsaved records have a sensible shape on
 *  the wire if the user hits Save without touching every field. */
export function emptyDiscount(): Discount {
  return {
    id:                        '',
    name:                      '',
    amount:                    0,
    percentage:                false,
    type:                      'manual',
    applyTo:                   'product',
    items:                     [],
    branches:                  [],
    minProductQty:             0,
    taxId:                     null,
    quantityBasedCashDiscount: false,
    available:                 true,
    availableOnline:           true,
  };
}
