/**
 * Matrix-item domain types
 * ─────────────────────────
 * Port of the legacy `core/models/matrixItem.ts` class graph to plain
 * interfaces + factory functions. A "matrix item" is a parent product with
 * up to 3 dimensions (e.g. Size / Color / Material); the cartesian product of
 * their attributes becomes the concrete child `MatrixProduct` rows.
 *
 * The wire format matches the legacy backend verbatim — the service layer
 * (`matrix-item.service.ts`) normalises stringly-typed numbers and missing
 * arrays; the rest of the front-end trusts these shapes.
 */

/** Per-language value pair — mirrors the shared `TranslationLang`. */
export interface TranslationLang {
  en: string;
  ar: string;
}

/** Only `.name` is used by the matrix UI, but the backend round-trips the
 *  whole `Translation` object, so keep it loosely typed for the extra fields. */
export interface Translation {
  name: TranslationLang;
  [field: string]: TranslationLang;
}

export function emptyTranslation(): Translation {
  return { name: { en: '', ar: '' } };
}

export interface MatrixItemImage {
  defaultUrl: string | null;
  thumbnailUrl: string | null;
}

/** A single image attached to a generated variant product. Assigned in the
 *  matrix form and persisted via the `bulkProductMedia` route (keyed by the
 *  variant's `productId`). */
export interface VariantImage {
  id: string;
  defaultUrl: string;
  thumbnailUrl: string;
}

export type DimensionDisplayType = 'buttons' | 'radio' | 'dropdown';

export interface DimensionAttribute {
  id: string;
  name: string;
  /** Short code used to build variant barcodes/SKUs (e.g. `RED`, `SML`). */
  code: string;
  /** Hex color for color dimensions; `#000000` default. */
  value: string;
  isActive: boolean;
  isNew: boolean;
  onHand: number;
  translation: Translation;
}

export interface Dimension {
  /** Stable client id (uuid) — lets modals target the right dimension and
   *  survives regeneration. Nulled on save for brand-new dimensions in create
   *  mode so the backend mints its own. */
  id: string;
  /** Lowercased slug derived from `name` when empty — selects the preset set. */
  type: string;
  name: string;
  displayType: DimensionDisplayType;
  attributes: DimensionAttribute[];
  /** Candidate values pulled from a saved dimension in the catalog (not yet
   *  added as `attributes`). */
  presetAttributes: DimensionAttribute[];
  isRequired: boolean;
  translation: Translation;
  isNew: boolean;
}

/** Per-branch stock/price row hanging off a generated `MatrixProduct`. */
export interface BranchProduct {
  /** Existing `BranchProducts` row id — round-tripped from `getMatrix` so the
   *  backend updates the right row in edit mode. Absent for brand-new rows
   *  (create mode, or a branch the matrix was never assigned to), where the
   *  backend mints one. Never emit `''`/`null`. */
  id?: string;
  /** Round-tripped from the backend; the matrix form doesn't toggle it. */
  available?: boolean;
  branchId: string;
  onHand: number;
  price: number;
  openingBalance: number;
  openingBalanceCost: number;
}

/** A concrete generated variant (one cell of the cartesian product). */
export interface MatrixProduct {
  id: string | null;
  productId?: string | null;
  name: string;
  barcode: string;
  sku: string;
  attribute1: string;
  attribute2: string;
  attribute3: string;
  /** Cost carried on the product itself (mirrors `unitCost` on regenerate). */
  openingBalanceCost?: number;
  branchProduct: BranchProduct[];
  /** Images attached to this variant. Loaded from the backend, edited via the
   *  media picker, and saved through `bulkProductMedia` after the matrix save.
   *  Only meaningful for saved variants (those with a real `id`). */
  mediaIds?: VariantImage[];
}

export interface MatrixItem {
  id: string | null;
  name: string;
  translation: Translation;
  barcode: string;
  defaultPrice: number;
  dimensions: Dimension[];
  defaultImage: string;
  base64Image: string;
  products: MatrixProduct[];
  companyId: string;
  unitCost: number;
  mediaId: string | null;
  mediaUrl: MatrixItemImage;
}

// ─── List wire shapes ─────────────────────────────────────────────────────

export interface MatrixSortBy {
  sortValue: string;
  sortDirection: 'asc' | 'desc';
}

export interface MatrixListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: MatrixSortBy;
}

/** Lightweight row for the matrix list table. */
export interface MatrixListRow {
  id: string;
  name: string;
  barcode: string;
  sku: string | null;
  defaultPrice: number;
  /** Parent thumbnail/cover image (either URL may be empty/null). */
  image: MatrixItemImage;
  /** Number of generated variant products. */
  variantsCount: number;
  /** Dimension names defining this matrix, e.g. ['Color','Size']. */
  dimensions: string[];
  /** Total stock across all variants + branches. */
  totalOnHand: number;
  /** Min/max variant price — shown as a range when they differ. */
  priceRange: { min: number; max: number };
}

export interface MatrixListResponse {
  list: MatrixListRow[];
  count: number;
  pageCount: number;
}

export interface DimensionListRow {
  id: string;
  name: string;
  displayType: DimensionDisplayType;
  attributesCount: number;
}

export interface DimensionListResponse {
  list: DimensionListRow[];
  count: number;
  pageCount: number;
}

// ─── Factories ────────────────────────────────────────────────────────────

export function emptyAttribute(): DimensionAttribute {
  return {
    id: '',
    name: '',
    code: '',
    value: '#000000',
    isActive: true,
    isNew: true,
    onHand: 0,
    translation: emptyTranslation(),
  };
}

/** Cheap uuid-v4 without pulling the `uuid` dependency into this feature. */
export function newDimensionId(): string {
  // RFC4122-ish v4; crypto when available, Math.random fallback.
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function emptyDimension(): Dimension {
  return {
    id: newDimensionId(),
    type: '',
    name: '',
    displayType: 'buttons',
    attributes: [],
    presetAttributes: [],
    isRequired: true,
    translation: emptyTranslation(),
    isNew: true,
  };
}

export function emptyMatrixImage(): MatrixItemImage {
  return { defaultUrl: '', thumbnailUrl: '' };
}

export function emptyMatrixItem(): MatrixItem {
  return {
    id: null,
    name: '',
    translation: emptyTranslation(),
    barcode: '',
    defaultPrice: 0,
    dimensions: [],
    defaultImage: '',
    base64Image: '',
    products: [],
    companyId: '',
    unitCost: 0,
    mediaId: null,
    mediaUrl: emptyMatrixImage(),
  };
}

// ─── Presets ──────────────────────────────────────────────────────────────

export interface AttributePreset {
  name: string;
  code: string;
  value: string;
}

export const COLOR_PRESETS: AttributePreset[] = [
  { name: 'Red',    code: 'RED',  value: '#EF4444' },
  { name: 'Blue',   code: 'BLU',  value: '#3B82F6' },
  { name: 'Green',  code: 'GRN',  value: '#10B981' },
  { name: 'Yellow', code: 'YLW',  value: '#F59E0B' },
  { name: 'Purple', code: 'PRP',  value: '#8B5CF6' },
  { name: 'Orange', code: 'ORN',  value: '#F97316' },
  { name: 'Pink',   code: 'PNK',  value: '#EC4899' },
  { name: 'Teal',   code: 'TEAL', value: '#14B8A6' },
  { name: 'Indigo', code: 'IND',  value: '#6366F1' },
  { name: 'Gray',   code: 'GRY',  value: '#6B7280' },
  { name: 'Black',  code: 'BLK',  value: '#1F2937' },
  { name: 'White',  code: 'WHT',  value: '#FFFFFF' },
  { name: 'Brown',  code: 'BRN',  value: '#92400E' },
  { name: 'Navy',   code: 'NVY',  value: '#1E3A8A' },
  { name: 'Maroon', code: 'MRN',  value: '#991B1B' },
];

export const SIZE_PRESETS: AttributePreset[] = [
  { name: 'Extra Small', code: 'XSM',   value: 'XS' },
  { name: 'Small',       code: 'SML',   value: 'S' },
  { name: 'Medium',      code: 'MED',   value: 'M' },
  { name: 'Large',       code: 'LAR',   value: 'L' },
  { name: 'Extra Large', code: 'XLAR',  value: 'XL' },
  { name: '2X Large',    code: '2XL',   value: '2XL' },
  { name: '3X Large',    code: '3XL',   value: '3XL' },
  { name: '4X Large',    code: '4XL',   value: '4XL' },
  { name: '5X Large',    code: '5XL',   value: '5XL' },
  { name: 'One Size',    code: 'OSIZE', value: 'OS' },
];

export const MATERIAL_PRESETS: AttributePreset[] = [
  { name: 'Cotton',    code: 'CTN',  value: 'Cotton' },
  { name: 'Polyester', code: 'PLS',  value: 'Polyester' },
  { name: 'Wool',      code: 'WOOL', value: 'Wool' },
  { name: 'Silk',      code: 'SLK',  value: 'Silk' },
  { name: 'Denim',     code: 'DNM',  value: 'Denim' },
  { name: 'Leather',   code: 'LTH',  value: 'Leather' },
  { name: 'Linen',     code: 'LIN',  value: 'Linen' },
  { name: 'Blend',     code: 'BLD',  value: 'Blend' },
];

/** Names offered as inline "predefined" dimension suggestions. */
export const PREDEFINED_DIMENSIONS: { label: string; type: string }[] = [
  { label: 'Colors',   type: 'color' },
  { label: 'Sizes',    type: 'size' },
  { label: 'Material', type: 'material' },
];

/** Resolve the candidate preset attributes for a dimension by its `type`
 *  (or name). Returns `[]` for unknown/custom dimensions. */
export function getPresetsForDimension(typeOrName: string): AttributePreset[] {
  const t = (typeOrName || '').toLowerCase();
  if (t.includes('color')) return COLOR_PRESETS;
  if (t.includes('size')) return SIZE_PRESETS;
  if (t.includes('material')) return MATERIAL_PRESETS;
  return [];
}

/** Look up a color hex for an attribute code (color dimensions only). */
export function colorForCode(code: string): string {
  const c = (code || '').toLowerCase();
  return COLOR_PRESETS.find((p) => p.code.toLowerCase() === c)?.value ?? '';
}
