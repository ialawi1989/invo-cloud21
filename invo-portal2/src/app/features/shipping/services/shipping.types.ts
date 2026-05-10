// ────────────────────────────────────────────────────────────────────
// Shipping Settings — per-company shipping zones with weight/total
// based rate ranges. Wire format mirrors the legacy server's
// `company/getShippingSetting` payload.
// ────────────────────────────────────────────────────────────────────

/** A single rate range — `from` and `to` are kept as strings the
 *  user types so empty inputs round-trip cleanly; coerce to number
 *  at compare/save time. */
export interface Rate {
  /** Stable client-side id used for tracking + drag/drop. The
   *  server doesn't preserve these — we rebuild them on load. */
  id:    number;
  /** Group label this rate belongs to (e.g. "Standard", "Express").
   *  All rates in a zone with the same `name + type` form one
   *  visual rate-group with gap/overlap detection. */
  name:  string;
  type:  'weight' | 'total';
  from:  string;
  to:    string;
  price: string;
  note:  string;
}

export interface Zone {
  /** Client-side id (timestamp-derived). */
  id:        number;
  name:      string;
  /** Human-readable country names. The wire format uses ISO codes;
   *  we resolve names ↔ codes via the bundled `Countries.json`. */
  countries: string[];
  rates:     Rate[];
}

/** UI-only — derived from `rates` by grouping on `name + type`.
 *  Drives the per-group rendering with gap/overlap chips and
 *  inline-edit controls. */
export interface RateGroup {
  name:      string;
  type:      'weight' | 'total';
  note:      string;
  ranges:    Rate[];
  gaps:      Gap[];
  overlaps:  Overlap[];
  /** True while the user is editing the group's name/type/note. */
  isEditing: boolean;
  /** Snapshot of the original values so cancelling reverts. */
  editingData: { name: string; type: 'weight' | 'total'; note: string };
}

export interface Gap {
  from:       number;
  to:         number;
  afterRange: number;
}

export interface Overlap {
  range1: Rate;
  range2: Rate;
}

/** Wire format the server expects. Country names go out as ISO
 *  codes under the legacy capitalised `Countries` field. */
export interface ShippingSettingWire {
  name:      string;
  Countries: string[];
  rates:     Array<{
    type:  'weight' | 'total';
    from:  string;
    to:    string;
    price: string;
    note:  string;
    name:  string;
  }>;
}

/** A single entry from `public/Countries.json`. */
export interface CountryEntry {
  name:      string;
  code:      string;
  dial_code: string;
}

export function emptyRate(name: string = '', type: 'weight' | 'total' = 'weight', note: string = ''): Rate {
  return {
    id:    Date.now() + Math.floor(Math.random() * 1000),
    name,
    type,
    from:  '',
    to:    '',
    price: '',
    note,
  };
}

export function emptyZone(): Zone {
  return {
    id:        Date.now() + Math.floor(Math.random() * 1000),
    name:      '',
    countries: [],
    rates:     [],
  };
}
