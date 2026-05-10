// ────────────────────────────────────────────────────────────────────
// Price Label feature types.
//
// A "price label" is a named list of per-product prices that can
// override the product's `defaultPrice` at runtime. Used for things
// like wholesale price lists, branch-specific overrides, customer-
// segment pricing.
//
// Server shape mirrors the legacy `PriceLabel` class — we keep the
// same field names so existing rows persisted by InvoCloudFront2
// load identically.
// ────────────────────────────────────────────────────────────────────

/** Per-product price line under a price label. `productId` is the
 *  bridge to the product catalog; `price` is the numeric override.
 *  `productName` / `barcode` are mirrored on save so the list page
 *  doesn't need a per-row product fetch to render. */
export interface PriceLabelProductLine {
  productId:    string;
  productName?: string;
  barcode?:     string;
  /** Product type (`'inventory'` / `'serialized'` / `'menuItem'` …)
   *  — surfaced as a chip on the row so the user can tell different
   *  product flavours apart at a glance. */
  type?:        string;
  /** Catalog price the product carries before this label's
   *  override. Shown next to the override input as an "original
   *  price" chip. */
  defaultPrice?: number;
  price:        number;
}

/** Per-option price line — overrides the price of a product
 *  modifier / menu option. `optionId` is the bridge to the option
 *  catalog; `name` is mirrored on save so the form's row chrome
 *  reads cleanly without a second lookup. */
export interface PriceLabelOptionLine {
  optionId:    string;
  name?:       string;
  price:       number;
  /** Default option price — surfaced in the row meta line so the
   *  user sees the original price next to the override input. */
  defaultPrice?: number;
}

export interface PriceLabel {
  id:             string;
  name:           string;
  companyId:      string;
  productsPrices: PriceLabelProductLine[];
  optionsPrices:  PriceLabelOptionLine[];
  /** ISO timestamp from the server. Optional so newly-created
   *  labels (still client-side) don't need a value. */
  updatedDate?:   string;
}

/** Row shape returned by the list endpoint. The legacy backend
 *  responded with just `{ id, name }`; the upgraded endpoint
 *  ships `productsPrices`, `optionsPrices`, and `updatedDate`
 *  inline so the list page can render a real product count and
 *  the editor can open without a second `getById` round-trip.
 *  All extra fields are optional so the page degrades cleanly on
 *  older backends. */
export interface PriceLabelSummary {
  id:              string;
  name:            string;
  companyId?:      string;
  /** Server-side count of product lines on this label — surfaced
   *  on the list endpoint so the count column doesn't need the
   *  full array. */
  productsCount?:  number;
  /** Server-side count of option lines. */
  optionsCount?:   number;
  /** Inline arrays are kept on the type for the case where a
   *  future backend revision ships them — the page tolerates both
   *  shapes. */
  productsPrices?: PriceLabelProductLine[];
  optionsPrices?:  PriceLabelOptionLine[];
}

export interface PriceLabelListResponse {
  list:      PriceLabelSummary[];
  count:     number;
  pageCount: number;
}

export interface PriceLabelListParams {
  page?:       number;
  limit?:      number;
  searchTerm?: string;
  sortBy?:     { sortValue: string; sortDirection: 'asc' | 'desc' } | object;
}

/** Empty constructor for new labels — keeps the form's initial
 *  signal simple. */
export function emptyPriceLabel(): PriceLabel {
  return {
    id:             '',
    name:           '',
    companyId:      '',
    productsPrices: [],
    optionsPrices:  [],
  };
}
