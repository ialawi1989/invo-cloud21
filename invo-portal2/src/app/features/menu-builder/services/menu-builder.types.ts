// ── Menu builder domain types ────────────────────────────────────────────
//
// SINGLE SOURCE OF TRUTH for product placement: { x, y, cols, rows }.
// The legacy model carried *both* `index`/`doubleWidth`/`doubleHeight`
// AND `x`/`y`/`cols`/`rows`, then converted between them in
// `getStyle()`/`setStyle()`. That convolution caused subtle bugs (e.g.
// resizing reset position because setStyle ran on raw cols/rows). We
// only ever store grid coordinates and project the legacy fields back
// out at the wire boundary in `MenuBuilderService.serialise…()`.
// ─────────────────────────────────────────────────────────────────────────

export const GRID_COLS = 6;
export const GRID_ROWS = 6;
export const MAX_PAGES = 3;

/** A single placed product in a section's grid. */
export interface MenuSectionProduct {
  /** Server id, or `null` for items added in this session and not yet saved. */
  id: string | null;
  productId: string;
  productName: string;
  page: number;       // 1..MAX_PAGES
  /** Grid coordinates (top-left of the tile). */
  x: number;          // 0..GRID_COLS-1
  y: number;          // 0..GRID_ROWS-1
  cols: number;       // 1 or 2
  rows: number;       // 1 or 2
  /** Border / accent colour, falls back to the section colour scheme. */
  color: string;
  /** Direct image URL (may come from server or local upload). */
  defaultImage: string;
  /** Media library id, when the image is from there (vs an inline URL). */
  mediaId: string | null;
}

/** Gradient + border palette for a single section. */
export interface MenuSectionColor {
  colorName: string;
  borderColor: string;
  colorStart: string;
  colorEnd: string;
}

/** Optional per-language overrides for `name`. */
export interface MenuTranslation {
  ar?: string;
  en?: string;
  [lang: string]: string | undefined;
}

export interface MenuSection {
  /** Server id, or `null` for sections added in-session. */
  id: string | null;
  name: string;
  translation: MenuTranslation;
  image: string;
  pages: number;       // 1..MAX_PAGES
  color: MenuSectionColor;
  products: MenuSectionProduct[];
}

export interface Menu {
  id: string | null;
  name: string;
  branchIds: string[];
  priceLabelId: string;
  /** "HH:mm:ss" — kept as string so the time picker round-trips cleanly. */
  startAt: string;
  endAt: string;
  availableOnline: boolean;
  sections: MenuSection[];
  /** Display order in the menu list. */
  index: number;
}

export interface MenuListItem {
  id: string;
  name: string;
  branchIds: string[];
  startAt: string;
  endAt: string;
  availableOnline: boolean;
  index: number;
  /** Number of sections — surfaced in the list table. */
  sectionsCount?: number;
}

export interface MenuListPage {
  list: MenuListItem[];
  total: number;
}

/** Full colour palette — ported verbatim from legacy
 *  `MenuService.colorScheme` (see `InvoCloudFront2/.../menu.service.ts`)
 *  so existing menus pick a preset they already had a name for. The
 *  legacy palette is gradient-aware: `colorStart` and `colorEnd` may
 *  differ to render a vertical sheen on the section banner. */
export const COLOR_SCHEMES: readonly MenuSectionColor[] = [
  { colorName: 'Razzmatazz',        borderColor: 'rgba(202, 0, 80, 1)',    colorStart: 'rgba(202, 0, 80, 1)',    colorEnd: 'rgba(202, 0, 80, 1)' },
  { colorName: 'Bondi Blue',        borderColor: 'rgba(0, 173, 178, 1)',   colorStart: 'rgba(0, 173, 178, 1)',   colorEnd: 'rgba(0, 131, 135, 1)' },
  { colorName: 'Dodger Blue',       borderColor: 'rgba(0, 123, 230, 1)',   colorStart: 'rgba(1, 137, 255, 1)',   colorEnd: 'rgba(0, 123, 230, 1)' },
  { colorName: 'Violet',            borderColor: 'rgba(60, 46, 176, 1)',   colorStart: 'rgba(91, 79, 196, 1)',   colorEnd: 'rgba(60, 46, 176, 1)' },
  { colorName: 'Navy Blue',         borderColor: 'rgba(0, 111, 189, 1)',   colorStart: 'rgba(0, 125, 213, 1)',   colorEnd: 'rgba(0, 111, 189, 1)' },
  { colorName: 'Kelly Green',       borderColor: 'rgba(116, 182, 46, 1)',  colorStart: 'rgba(115, 203, 22, 1)',  colorEnd: 'rgba(99, 177, 18, 1)' },
  { colorName: 'Dark Pastel Green', borderColor: 'rgba(0, 150, 35, 1)',    colorStart: 'rgba(0, 178, 42, 1)',    colorEnd: 'rgba(0, 150, 35, 1)' },
  { colorName: 'Raw Umber',         borderColor: 'rgba(162, 71, 16, 1)',   colorStart: 'rgba(105, 44, 7, 1)',    colorEnd: 'rgba(105, 44, 7, 1)' },
  { colorName: 'Blue',              borderColor: 'rgba(10, 0, 255, 1)',    colorStart: 'rgba(28, 0, 255, 1)',    colorEnd: 'rgba(50, 0, 255, 1)' },
  { colorName: 'Orange',            borderColor: 'rgba(255, 166, 0, 1)',   colorStart: 'rgba(235, 153, 0, 1)',   colorEnd: 'rgba(235, 153, 0, 1)' },
  { colorName: 'Yellow',            borderColor: 'rgba(255, 239, 21, 1)',  colorStart: 'rgba(243, 227, 7, 1)',   colorEnd: 'rgba(221, 206, 0, 1)' },
  { colorName: 'Purple',            borderColor: 'rgba(179, 0, 178, 1)',   colorStart: 'rgba(201, 0, 200, 1)',   colorEnd: 'rgba(179, 0, 178, 1)' },
  { colorName: 'Red',               borderColor: 'rgba(231, 6, 4, 1)',     colorStart: 'rgba(255, 23, 21, 1)',   colorEnd: 'rgba(231, 6, 4, 1)' },
  { colorName: 'Olive',             borderColor: 'rgba(118, 118, 0, 1)',   colorStart: 'rgba(127, 128, 0, 1)',   colorEnd: 'rgba(118, 118, 0, 1)' },
  { colorName: 'Charcoal',          borderColor: 'rgba(45, 59, 70, 1)',    colorStart: 'rgba(54, 68, 79, 1)',    colorEnd: 'rgba(45, 59, 70, 1)' },
  { colorName: 'Bronze',            borderColor: 'rgba(179, 108, 40, 1)',  colorStart: 'rgba(206, 127, 51, 1)',  colorEnd: 'rgba(179, 108, 40, 1)' },
  { colorName: 'Tan',               borderColor: 'rgba(209, 180, 140, 1)', colorStart: 'rgba(209, 180, 140, 1)', colorEnd: 'rgba(221, 186, 137, 1)' },
  { colorName: 'Mustard',           borderColor: 'rgba(243, 207, 73, 1)',  colorStart: 'rgba(255, 220, 88, 1)',  colorEnd: 'rgba(243, 207, 73, 1)' },
  { colorName: 'Coral',             borderColor: 'rgba(247, 117, 70, 1)',  colorStart: 'rgba(255, 126, 79, 1)',  colorEnd: 'rgba(247, 117, 70, 1)' },
  { colorName: 'Burgundy',          borderColor: 'rgba(120, 0, 20, 1)',    colorStart: 'rgba(128, 0, 32, 1)',    colorEnd: 'rgba(120, 0, 20, 1)' },
  { colorName: 'Gold',              borderColor: 'rgba(231, 195, 0, 1)',   colorStart: 'rgba(255, 215, 1, 1)',   colorEnd: 'rgba(231, 195, 0, 1)' },
];

export const DEFAULT_COLOR_SCHEME: MenuSectionColor = COLOR_SCHEMES[0];
