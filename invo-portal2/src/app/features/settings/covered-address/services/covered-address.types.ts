// ────────────────────────────────────────────────────────────────────
// Covered Address — per-company "where do we deliver?" configuration.
//
// One record per company. The user picks a `type` ("Governorate" /
// "City" / "Block" / a custom string) which determines how rows are
// auto-generated from the country's known addresses, then fills in
// per-row delivery economics (charge, minimum order, free-delivery
// threshold, branch, note).
//
// Wire format mirrors the legacy server response — types here just
// give us TypeScript safety around it.
// ────────────────────────────────────────────────────────────────────

/** Bilingual name (en / ar) attached to a country address. */
export interface TranslationLang {
  en: string;
  ar: string;
  [lang: string]: string;
}

/** Bilingual translations for a country address's two granularity
 *  levels. The server only ships City + Governorate translations
 *  even when `type === 'Block'`. */
export interface CountryAddressTranslation {
  City:        TranslationLang;
  Governorate: TranslationLang;
}

/** A single "known address" the country exposes — used to seed
 *  rows when the user picks a built-in type. */
export interface CountryAddress {
  Governorate: string;
  City:        string;
  Block:       string;
  translation: CountryAddressTranslation;
}

/** A row the user actively covers — either auto-generated from
 *  `countryAddresses` or hand-added (`newlyAdded: true`). */
export interface CoveredAddressRow {
  branchId:         string;
  /** Display name (English by default). For built-in types this
   *  is the parent's name in the country list; for custom types
   *  it's whatever the user typed. */
  address:          string;
  /** Parent address name (e.g. Governorate of a City). Empty
   *  string for top-level types and custom rows. */
  parent:           string;
  note:             string;
  deliveryCharge:   number;
  minimumOrder:     number;
  freeDeliveryOver: number | null;
  translation:      CountryAddressTranslation;

  /** UI-only: row was added by the user (not derived from the
   *  country list). Drives the "name editable" + "deletable"
   *  affordances on the row. Server doesn't send this back. */
  newlyAdded?:      boolean;
  /** UI-only: bulk-assign target. */
  isSelected?:      boolean;
  /** UI-only: hidden by current search filter. */
  showInSearch?:    boolean;
}

/** The persisted slice — what we send back to the server. */
export interface BranchDeliveryAddresses {
  /** "Governorate" | "City" | "Block" | a custom string. */
  type:             string;
  coveredAddresses: CoveredAddressRow[];
}

/** Full payload the GET endpoint returns. */
export interface CoveredAddressesPayload {
  countryAddresses: CountryAddress[];
  coveredAddresses: BranchDeliveryAddresses;
}

/** Bulk-assign panel state — every field is optional; only
 *  filled fields get applied. */
export interface BulkAssignFields {
  deliveryCharge:   number | null;
  minimumOrder:     number | null;
  freeDeliveryOver: number | null;
  branchId:         string;
  note:             string;
}

export function emptyTranslation(): CountryAddressTranslation {
  return {
    City:        { en: '', ar: '' },
    Governorate: { en: '', ar: '' },
  };
}

export function emptyRow(): CoveredAddressRow {
  return {
    branchId:         '',
    address:          '',
    parent:           '',
    note:             '',
    deliveryCharge:   0,
    minimumOrder:     0,
    freeDeliveryOver: null,
    translation:      emptyTranslation(),
    newlyAdded:       true,
    isSelected:       false,
    showInSearch:     true,
  };
}

export function emptyBulkAssign(): BulkAssignFields {
  return {
    deliveryCharge:   null,
    minimumOrder:     null,
    freeDeliveryOver: null,
    branchId:         '',
    note:             '',
  };
}
