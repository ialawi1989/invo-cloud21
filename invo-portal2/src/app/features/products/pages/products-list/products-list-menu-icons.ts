/**
 * Leading icons for the Products header menus ("Add New" and the "⋯ More actions" kebab).
 *
 * Icon system: the project has no icon library. Menu icons are inline SVG path strings
 * (24x24 viewBox, 2px round stroke, `currentColor`) fed to `<app-dropdown-menu-btn>`, the same
 * outline style as the blog / account menus. The paths below follow that style.
 *
 * Keys are the stable action ids from products-list.component.ts (never the translated label).
 * Flip a value in `showMenuIcons` to false to remove one menu's icons with no other change.
 */

/** Per-menu switch. */
export const showMenuIcons = { addNew: true, moreActions: true };

export interface MenuIconDef {
  /** SVG path `d` (24x24, stroke). Multiple sub-paths are joined in one string. */
  path: string;
  /** Mirror in RTL (directional glyphs such as arrows). Barcode, printer, etc. stay as-is. */
  flipRtl?: boolean;
}

// ── Shapes (outline, 24x24) ────────────────────────────────────────────────
const BOX = 'M21 8l-9-5-9 5v8l9 5 9-5z M3.3 7.5L12 12.5l8.7-5 M12 22V12.5';
const LAYERS = 'M12 2L2 7l10 5 10-5z M2 17l10 5 10-5 M2 12l10 5 10-5';
const PUZZLE = 'M19.4 11H18V7a1 1 0 0 0-1-1h-4V4.6a2.6 2.6 0 0 0-5.2 0V6H4a1 1 0 0 0-1 1v3.8h1.4a2.6 2.6 0 0 1 0 5.2H3V20a1 1 0 0 0 1 1h3.8v-1.4a2.6 2.6 0 0 1 5.2 0V21H17a1 1 0 0 0 1-1v-4h1.4a2.6 2.6 0 0 0 0-5z';
const WRENCH = 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z';
const PACKAGE = 'M16.5 9.4L7.5 4.2 M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z M3.3 7L12 12l8.7-5 M12 22V12';
const UTENSILS = 'M5 3v7a2 2 0 0 0 2 2v9 M9 3v7a2 2 0 0 1-2 2 M7 3v7 M17 21V3c-2.5 1.5-4 4.5-4 8h4';
const CHECKLIST = 'M3 6l1.5 1.5L7 5 M3 12l1.5 1.5L7 11 M3 18l1.5 1.5L7 17 M11 6h10 M11 12h10 M11 18h10';
const SCISSORS = 'M9.5 6a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z M9.5 18a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z M8.6 8.4L21 19 M8.6 15.6L21 5';
const GIFT = 'M20 12v9H4v-9 M2 7h20v5H2z M12 21V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z';
const PRINTER = 'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z';
/** User outline with a coin badge (employee service pricing). */
const USER_COIN = 'M13 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M23 15.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0z M18.5 13.5v4 M17.2 14.4c.3-.5 1-.7 1.6-.5.7.2.9 1 .3 1.4-.4.3-1.2.3-1.7.7';
const EXCHANGE = 'M17 3l4 4-4 4 M3 7h18 M7 21l-4-4 4-4 M21 17H3';
const HISTORY = 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5 M12 7v5l3 2';
const TAG = 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z M7 7h.01';
const EYE = 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z';
const IMAGE = 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M10.5 8.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z M21 15l-5-5L5 21';
const LANGUAGE = 'M5 8l6 6 M4 14l6-6 2-3 M2 5h12 M7 2h1 M22 22l-5-10-5 10 M14 18h6';
/** Barcode framed in a label outline, distinct from the plain barcode glyph. */
const LABEL_BARCODE = 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M7 9v6 M10 9v6 M13 9v6 M16 9v6 M18.5 9v6';
const TAGS = 'M9 5H2v7l6.3 6.3a1 1 0 0 0 1.4 0l5.6-5.6a1 1 0 0 0 0-1.4z M6 9.01V9 M15 5l6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19';
/** Plain barcode (Serialized). Distinct from LABEL_BARCODE. */
const BARCODE = 'M3 5v14 M7 5v14 M11 5v14 M14 5v14 M18 5v14 M21 5v14';

/**
 * "Add New" menu, keyed by action id. Also the product-type icon map: the table's Type chips can
 * reuse this later through `PRODUCT_TYPE_ICONS` (keyed by product type).
 */
export const ADD_NEW_ICONS: Record<string, MenuIconDef> = {
  'add-inventory':     { path: BOX },
  'add-serialized':    { path: BARCODE },
  'add-batch':         { path: LAYERS },
  'add-kit':           { path: PUZZLE },
  'add-service':       { path: WRENCH },
  'add-package':       { path: PACKAGE },
  'add-menuItem':      { path: UTENSILS },
  'add-menuSelection': { path: CHECKLIST },
  'add-tailoring':     { path: SCISSORS },
  'add-voucher':       { path: GIFT },
};

/** Product type -> icon, for reuse by the Type chips (not wired to the table in this change). */
export const PRODUCT_TYPE_ICONS: Record<string, MenuIconDef> = {
  inventory:     ADD_NEW_ICONS['add-inventory'],
  serialized:    ADD_NEW_ICONS['add-serialized'],
  batch:         ADD_NEW_ICONS['add-batch'],
  kit:           ADD_NEW_ICONS['add-kit'],
  service:       ADD_NEW_ICONS['add-service'],
  package:       ADD_NEW_ICONS['add-package'],
  menuItem:      ADD_NEW_ICONS['add-menuItem'],
  menuSelection: ADD_NEW_ICONS['add-menuSelection'],
  tailoring:     ADD_NEW_ICONS['add-tailoring'],
  voucher:       ADD_NEW_ICONS['add-voucher'],
  // matrix: no icon yet (not part of the Add New menu).
};

/** "More actions" kebab, keyed by action id. */
export const MORE_ACTIONS_ICONS: Record<string, MenuIconDef> = {
  'bulk-print':            { path: PRINTER },
  'employee-services':     { path: USER_COIN },
  'import-export':         { path: EXCHANGE, flipRtl: true },
  'logs':                  { path: HISTORY },
  'price-change':          { path: TAG },
  'products-availability': { path: EYE },
  'bulk-image':            { path: IMAGE },
  'translation':           { path: LANGUAGE },
  'label-print-barcodes':  { path: LABEL_BARCODE },
  'bulk-tags':             { path: TAGS },
};
