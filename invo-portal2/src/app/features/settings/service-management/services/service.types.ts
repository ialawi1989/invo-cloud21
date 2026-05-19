// ────────────────────────────────────────────────────────────────────
// Service-management domain types. Wire shape mirrors the legacy
// `Service` / `BranchServiceModel` / `ServiceOptions` classes so
// existing records round-trip unchanged through the
// `branch/{getServicList, getService, saveService, …}` endpoints.
// ────────────────────────────────────────────────────────────────────

/** Top-level service type — drives which per-branch settings
 *  sub-component renders. Mirrors the legacy `Service.type` union. */
export type ServiceType =
  | 'DineIn'
  | 'PickUp'
  | 'Delivery'
  | 'CarHop'
  | 'Salon'
  | 'Catering'
  | 'Retail';

/** Full registry of service types — drives the label lookup for
 *  every record, including legacy ones (DineIn / Salon / Catering /
 *  Retail) whose forms still render via the `@switch` on edit. */
export const SERVICE_TYPES: ReadonlyArray<{ id: ServiceType; labelKey: string }> = [
  { id: 'DineIn',   labelKey: 'SERVICE_MANAGEMENT.TYPES.DINE_IN' },
  { id: 'PickUp',   labelKey: 'SERVICE_MANAGEMENT.TYPES.PICK_UP' },
  { id: 'Delivery', labelKey: 'SERVICE_MANAGEMENT.TYPES.DELIVERY' },
  { id: 'CarHop',   labelKey: 'SERVICE_MANAGEMENT.TYPES.CAR_HOP' },
  { id: 'Salon',    labelKey: 'SERVICE_MANAGEMENT.TYPES.SALON' },
  { id: 'Catering', labelKey: 'SERVICE_MANAGEMENT.TYPES.CATERING' },
  { id: 'Retail',   labelKey: 'SERVICE_MANAGEMENT.TYPES.RETAIL' },
];

/** Subset of `SERVICE_TYPES` that's offered in the dropdown for a
 *  brand-new service. The other four exist for display + edit-mode
 *  round-trip only — they were valid legacy types but the product
 *  has narrowed the POS set to these three. */
export const CREATABLE_SERVICE_TYPES: ReadonlyArray<{ id: ServiceType; labelKey: string }> =
  SERVICE_TYPES.filter(t => t.id === 'PickUp' || t.id === 'Delivery' || t.id === 'CarHop');

/** Server-supplied thumbnail wrapper (`{ defaultUrl, thumbnailUrl }`
 *  or empty strings — never null on the wire). */
export interface ServiceImage {
  defaultUrl:   string;
  thumbnailUrl: string;
}

/** Service-level options. `locKChangeService` typo is preserved
 *  verbatim — the legacy backend reads that exact key. */
export interface ServiceOptions {
  lockMenu:          boolean;
  locKChangeService: boolean;
}

/** Per-branch setting block. `setting` is a free-form bag where
 *  each ServiceType deposits its own keys (see below). */
export interface BranchServiceModel {
  branchId:     string;
  branchName:   string;
  priceLabelId: string;
  chargeId:     string;
  setting:      BranchSetting;
}

/** Union of every key any service-type sub-component reads/writes
 *  on `BranchServiceModel.setting`. Kept as one wide type so the
 *  form can address the keys without per-type casts. Unused keys
 *  simply stay `undefined`. */
export interface BranchSetting {
  /** Master per-branch enable — every sub-component renders this. */
  enabled:                        boolean;
  // DineIn ----------------------------------------------------
  showTableSelection?:             boolean;
  onlyOneTicketPerTable?:          boolean;
  showCustomerPhoneInReservation?: boolean;
  enforceGuestCount?:              boolean;
  // Delivery / Catering ---------------------------------------
  deliveryCharge?:                 string;
  driverSelectsOrder?:             boolean;
  // CarHop ----------------------------------------------------
  enableDriverOptions?:            boolean;
  /** Future-proof escape hatch — any unknown legacy key. */
  [k: string]: unknown;
}

export interface Service {
  /** Empty string for new (unsaved) records. */
  id:           string;
  name:         string;
  type:         ServiceType | '';
  /** Sort order — drives the drag-reorder save payload. */
  index:        number;
  /** True for the seeded system service (one per company in legacy).
   *  The list page blocks `delete` on these rows. */
  default:      boolean;
  /** Linked Menu id. Empty when no menu has been pinned. */
  menuId:       string;
  mediaId:      string | null;
  /** Always an object on the wire — empty strings inside when unset. */
  mediaUrl:     ServiceImage;
  options:      ServiceOptions;
  /** Per-branch override rows. The form merges in any branches that
   *  weren't returned so every branch surfaces a tab. */
  branches:     BranchServiceModel[];
  /** Localised copies of `name`. Round-tripped verbatim. */
  translation?: { name?: Record<string, string> };
  /** Last server-side timestamp — used by the list for fallback sort. */
  updatedDate?: string;
}

export interface ServiceListParams {
  page?:       number;
  limit?:      number;
  searchTerm?: string;
  sortBy?:     { sortValue?: string; sortDirection?: 'asc' | 'desc' };
}

export interface ServiceListResponse {
  list:      Service[];
  count:     number;
  pageCount: number;
  startIndex?: number;
  lastIndex?:  number;
}

/** Lightweight surcharge row used by the per-branch dropdown. */
export interface SurchargeOption {
  id:     string;
  name:   string;
  symbol?: string;
}

/** Lightweight price-label row used by the per-branch dropdown. */
export interface PriceLabelOption {
  id:   string;
  name: string;
}

/** Lightweight menu row used by the form's default-menu dropdown. */
export interface MenuOption {
  id:   string;
  name: string;
}

export function emptyImage(): ServiceImage {
  return { defaultUrl: '', thumbnailUrl: '' };
}

export function emptyOptions(): ServiceOptions {
  return { lockMenu: false, locKChangeService: false };
}

/** Build a per-branch row from a branch summary. Defaults match the
 *  legacy `BranchServiceModel` class. */
export function emptyBranchServiceModel(
  branchId: string,
  branchName: string,
): BranchServiceModel {
  return {
    branchId,
    branchName,
    priceLabelId: '',
    chargeId:     '',
    setting:      { enabled: true },
  };
}

export function emptyService(): Service {
  return {
    id:           '',
    name:         '',
    type:         '',
    index:        0,
    default:      false,
    menuId:       '',
    mediaId:      null,
    mediaUrl:     emptyImage(),
    options:      emptyOptions(),
    branches:     [],
    translation:  { name: {} },
  };
}
