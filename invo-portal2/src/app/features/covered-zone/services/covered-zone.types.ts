// ────────────────────────────────────────────────────────────────────
// Covered Zone — per-company radius-based delivery zones.
//
// Each branch can pin a `(lat, lng)` location. The company defines
// concentric "zones" by radius (km), each with its own delivery
// economics. A separate `pickupMaxDistance` controls how far
// pickup orders are accepted.
//
// Wire format mirrors the legacy server response — types here just
// give us TypeScript safety around it.
// ────────────────────────────────────────────────────────────────────

export interface BranchLocation {
  lat: number;
  lng: number;
}

export interface BranchSlim {
  id:        string;
  name:      string;
  /** `null` when the branch hasn't pinned a location yet. The
   *  legacy server ships `{ lat: 0, lng: 0 }` for "unset"; we
   *  normalise that to `null` so the UI can render an explicit
   *  "Set location" call to action. */
  location:  BranchLocation | null;
}

export interface Zone {
  /** Distance in km from each branch's pinned location. Must be
   *  > 0 and unique across the list. */
  radius:           number;
  deliveryCharge:   number;
  minimumCharge:    number;
  /** Free delivery threshold; `null` means "no free-delivery
   *  applies for this zone". */
  freeDeliveryOver: number | null;
  note:             string;
}

export interface CoveredZonePayload {
  branches:     BranchSlim[];
  coveredZones: Zone[];
}

export function emptyZone(): Zone {
  return {
    radius:           0,
    deliveryCharge:   0,
    minimumCharge:    0,
    freeDeliveryOver: null,
    note:             '',
  };
}
