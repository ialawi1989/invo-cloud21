// ─────────────────────────────────────────────────────────────────────────
// Per-product-type badge palette
// ─────────────────────────────────────────────────────────────────────────
// Colours are theme tokens (--ui-pt-*, defined in styles/_dark.scss for light and dark).
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
  inventory:       { bg: 'var(--ui-pt-inventory-bg)', color: 'var(--ui-pt-inventory-fg)' },
  serialized:      { bg: 'var(--ui-pt-serialized-bg)', color: 'var(--ui-pt-serialized-fg)' },
  batch:           { bg: 'var(--ui-pt-batch-bg)', color: 'var(--ui-pt-batch-fg)' },
  kit:             { bg: 'var(--ui-pt-kit-bg)', color: 'var(--ui-pt-kit-fg)' },
  service:         { bg: 'var(--ui-pt-service-bg)', color: 'var(--ui-pt-service-fg)' },
  package:         { bg: 'var(--ui-pt-package-bg)', color: 'var(--ui-pt-package-fg)' },
  menuItem:        { bg: 'var(--ui-pt-menu-item-bg)', color: 'var(--ui-pt-menu-item-fg)' },
  menuSelection:   { bg: 'var(--ui-pt-menu-selection-bg)', color: 'var(--ui-pt-menu-selection-fg)' },
  tailoring:       { bg: 'var(--ui-pt-tailoring-bg)', color: 'var(--ui-pt-tailoring-fg)' },
  voucher:         { bg: 'var(--ui-pt-package-bg)', color: 'var(--ui-pt-package-fg)' },
  matrix:          { bg: 'var(--ui-pt-matrix-bg)', color: 'var(--ui-pt-matrix-fg)' },
};

const FALLBACK = { bg: 'var(--ui-pt-matrix-bg)', color: 'var(--ui-pt-matrix-fg)' };

/** Resolve the colour pair for a product type. Unknown types fall back
 *  to a neutral slate so the chip never renders un-styled. */
export function getProductTypeBadgeStyle(type: string | undefined | null): Record<string, string> {
  const s = (type ? PALETTE[type] : null) ?? FALLBACK;
  return { background: s.bg, color: s.color };
}
