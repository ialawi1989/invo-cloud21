// ─────────────────────────────────────────────────────────────────────────
// Per-product-type badge palette
// ─────────────────────────────────────────────────────────────────────────
// Single source of truth for the `[ngStyle]` colours that decorate the
// product **type** chip wherever a product row is rendered (products list,
// product picker modals, price-label form, discount form, etc.). The chip
// markup itself uses the global `.app-product-badge` class — this helper
// only supplies the background + foreground colours that vary per type.
//
// Consumers:
//   <span class="app-product-badge" [ngStyle]="getProductTypeBadgeStyle(row.type)">
//     {{ row.type }}
//   </span>
//
// Keep this in sync with the legacy product palette (originated in the
// products-list page). Adding a new product type? Add a single entry here
// and every surface picks it up automatically.
// ─────────────────────────────────────────────────────────────────────────

// Spread hues across the colour wheel so adjacent chips in the same
// row are easy to tell apart at the chip's small font size. Earlier
// palette had serialized/menuItem/menuSelection clustering in the
// purple-indigo range and service/tailoring clustering in cyan/teal.
const PALETTE: Record<string, { bg: string; color: string }> = {
  inventory:     { bg: '#dbeafe', color: '#1d4ed8' }, // blue
  serialized:    { bg: '#fce7f3', color: '#be185d' }, // rose  (was purple)
  batch:         { bg: '#fef9c3', color: '#a16207' }, // amber
  kit:           { bg: '#dcfce7', color: '#15803d' }, // green
  service:       { bg: '#cffafe', color: '#0e7490' }, // cyan
  package:       { bg: '#ffedd5', color: '#c2410c' }, // orange
  menuItem:      { bg: '#ede9fe', color: '#6d28d9' }, // purple
  menuSelection: { bg: '#fee2e2', color: '#b91c1c' }, // red   (was indigo, too close to blue)
  tailoring:     { bg: '#ecfccb', color: '#4d7c0f' }, // lime  (was teal, too close to cyan)
  matrix:        { bg: '#f1f5f9', color: '#475569' }, // slate
};

const FALLBACK = { bg: '#f1f5f9', color: '#475569' };

/** Resolve the colour pair for a product type. Unknown types fall back
 *  to a neutral slate so the chip never renders un-styled. */
export function getProductTypeBadgeStyle(type: string | undefined | null): Record<string, string> {
  const s = (type ? PALETTE[type] : null) ?? FALLBACK;
  return { background: s.bg, color: s.color };
}
