/**
 * Tab Builder — data model
 * ────────────────────────
 *
 * Two separate shapes, each served by a different editor:
 *
 *   1. **TabTemplate[]** (company-wide, lives under Customization
 *      `type='product', key='tabBuilder'`). Defines *which tabs exist*, what
 *      type each is, and the schema for content (e.g. list of spec fields,
 *      record fields, predefined FAQ questions). Stored as
 *      `{ templates: TabTemplate[] }`.
 *
 *   2. **TabData** (per-product, lives on `Product.tabBuilder`). A plain map
 *      `{ [abbr]: content }` where each entry holds *values* for the tab
 *      identified by `abbr` in the company template. The shape of each value
 *      depends on the tab's type:
 *
 *        - specs       → { [fieldAbbr]: string | number | string[] }       (single record)
 *        - records     → Array<{ [fieldAbbr]: string | number | string[] }> (many records of the same schema)
 *        - richtext    → string (HTML)
 *        - faq         → FaqEntry[]
 *        - custom      → string (raw HTML)
 *        - table       → { headers: string[]; rows: string[][] }
 *        - review      → ReviewEntry[]
 *        - video       → VideoEntry[]
 *        - downloads   → DownloadEntry[]
 *
 * The backend stores both blobs as opaque JSON; shape enforcement is the
 * frontend's responsibility.
 */

export type TabType =
  | 'specs' | 'records' | 'richtext' | 'faq' | 'custom'
  | 'table' | 'review' | 'video' | 'downloads';

// ─── Product types the template may target ──────────────────────────────────
// Mirrors `ProductFormComponent.ALLOWED_TYPES`. An empty / missing
// `productTypes[]` on a template means "applies to every product type".

export type ProductType =
  | 'inventory' | 'serialized' | 'batch' | 'kit' | 'service'
  | 'package' | 'menuItem' | 'menuSelection' | 'tailoring';

export const PRODUCT_TYPES: ProductType[] = [
  'inventory', 'serialized', 'batch', 'kit', 'service',
  'package', 'menuItem', 'menuSelection', 'tailoring',
];

/** i18n key used for a product type — matches PRODUCTS.TYPES.* in /products i18n. */
export function productTypeI18nKey(t: ProductType): string {
  switch (t) {
    case 'inventory':     return 'PRODUCTS.TYPES.INVENTORY';
    case 'serialized':    return 'PRODUCTS.TYPES.SERIALIZED';
    case 'batch':         return 'PRODUCTS.TYPES.BATCH';
    case 'kit':           return 'PRODUCTS.TYPES.KIT';
    case 'service':       return 'PRODUCTS.TYPES.SERVICE';
    case 'package':       return 'PRODUCTS.TYPES.PACKAGE';
    case 'menuItem':      return 'PRODUCTS.TYPES.MENU_ITEM';
    case 'menuSelection': return 'PRODUCTS.TYPES.MENU_SELECTION';
    case 'tailoring':     return 'PRODUCTS.TYPES.TAILORING';
  }
}

// ─── Template (settings) ─────────────────────────────────────────────────────

export type SpecFieldType = 'text' | 'number' | 'select' | 'multiselect' | 'date';

/**
 * Schema for a single field, used by both `specs` (one-off key/value) and
 * `records` (many rows sharing this schema). `filterable` flags the field as
 * a candidate for an e-commerce storefront filter (brand, material,
 * colour…); the storefront reads this when building facet filters.
 */
export interface SpecField {
  id: string;
  label: string;
  abbr: string;
  type: SpecFieldType;
  required: boolean;
  /**
   * Whether this field can be used as a filter facet on the storefront.
   * Defaults to false — callers opt in per field. Most meaningful for
   * `text` / `select` / `multiselect` / `number`; `date` is also allowed.
   */
  filterable?: boolean;
  /** Only used when type === 'select' | 'multiselect' */
  options?: string[];
}

export interface FaqTemplateItem {
  id: string;
  question: string;
  answerPlaceholder?: string;
}

/**
 * Content source for richtext templates.
 *
 *   - `manual` (default): user types content on each product.
 *   - `productDescription`: live-linked to `product.description` — no
 *     per-product content is stored; the storefront reads the description
 *     at render time.
 *   - `shared`: admin writes one content block in settings; every product
 *     shows the same thing. Stored in the template's `sharedContent` and
 *     read-only on the product side.
 */
export type RichtextSource = 'manual' | 'productDescription' | 'shared';

export interface TabTemplate {
  id: string;
  name: string;
  abbr: string;
  type: TabType;
  isActive: boolean;
  sortOrder: number;

  /**
   * Restrict this template to a subset of product types. Empty or undefined
   * means the template applies to every product type.
   */
  productTypes?: ProductType[];

  // Type-specific config (only one is set per template, matching type)
  specFields?: SpecField[];
  /** Field schema used by `records`-typed templates. Same shape as specFields. */
  recordFields?: SpecField[];
  faqFields?: FaqTemplateItem[];
  /** Shared by richtext + custom */
  placeholder?: string;
  /**
   * Source of content for a `richtext` tab. Omitted = `'manual'`.
   */
  source?: RichtextSource;
  /**
   * Company-wide content rendered on every product when `source === 'shared'`.
   * The product side shows this read-only; there is no per-product copy.
   */
  sharedContent?: string;
}

export interface TabBuilderTemplates {
  templates: TabTemplate[];
}

// ─── Data (per-product) ──────────────────────────────────────────────────────

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface ReviewEntry {
  author: string;
  rating: number;    // 1-5
  title?: string;
  comment: string;
  date?: string;     // ISO string, optional
}

export interface VideoEntry {
  url: string;
  caption?: string;
}

export interface DownloadEntry {
  name: string;
  url: string;
  /** Human-readable size string shown next to the name (e.g. "2.4 MB"). */
  size?: string;
  /** Short kind label ("pdf", "zip"…). Usually auto-derived by the consumer
   *  from the URL extension, but can be overridden here. */
  kind?: string;
}

export type SpecsData   = Record<string, string | number | string[]>;
export type RecordEntry = Record<string, string | number | string[]>;
export type TabDataMap  = Record<string, any>;

// ─── Factories / defaults ────────────────────────────────────────────────────

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function slugify(name: string): string {
  return (name ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06FF\s_-]/g, '')
    .replace(/\s+/g, '_');
}

export function newTabTemplate(name: string, type: TabType, sortOrder = 0): TabTemplate {
  const base: TabTemplate = {
    id: generateId('tpl'),
    name,
    abbr: slugify(name),
    type,
    isActive: true,
    sortOrder,
  };
  switch (type) {
    case 'specs':    return { ...base, specFields: [] };
    case 'records':  return { ...base, recordFields: [] };
    case 'faq':      return { ...base, faqFields: [] };
    case 'richtext': return { ...base, placeholder: '', source: 'manual' };
    case 'custom':   return { ...base, placeholder: '' };
    case 'table':    return { ...base };
    case 'review':   return { ...base };
    case 'video':    return { ...base };
    case 'downloads': return { ...base };
  }
}

export function newSpecField(): SpecField {
  return {
    id: generateId('fld'),
    label: '', abbr: '',
    type: 'text',
    required: false,
    filterable: false,
    options: [],
  };
}

export function newFaqTemplateItem(): FaqTemplateItem {
  return { id: generateId('faq'), question: '', answerPlaceholder: '' };
}

/** Initial value for a tab's data slot, sized to the template schema. */
export function initialTabData(tpl: TabTemplate): any {
  switch (tpl.type) {
    case 'specs':    return {};
    case 'records':  return [] as RecordEntry[];
    case 'richtext': return '';
    case 'custom':   return '';
    case 'faq':      return [] as FaqEntry[];
    case 'table':    return { headers: ['Column 1', 'Column 2'], rows: [] } as TableData;
    case 'review':   return [] as ReviewEntry[];
    case 'video':    return [] as VideoEntry[];
    case 'downloads': return [] as DownloadEntry[];
  }
}

/** Defensive normaliser for raw JSON coming back from the backend. */
export function normaliseTemplates(raw: any): TabTemplate[] {
  const arr = Array.isArray(raw?.templates) ? raw.templates
            : Array.isArray(raw)            ? raw
            : [];
  return arr
    .filter((t: any) => t && typeof t === 'object')
    .map((t: any, i: number): TabTemplate => ({
      id:        t.id ?? generateId('tpl'),
      name:      String(t.name ?? ''),
      abbr:      String(t.abbr ?? slugify(t.name ?? '')),
      type:      (t.type ?? 'specs') as TabType,
      isActive:  t.isActive !== false,
      sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : i,
      productTypes:  Array.isArray(t.productTypes)
        ? t.productTypes.filter((x: any): x is ProductType => PRODUCT_TYPES.includes(x))
        : undefined,
      specFields:    Array.isArray(t.specFields)   ? t.specFields   : undefined,
      recordFields:  Array.isArray(t.recordFields) ? t.recordFields : undefined,
      faqFields:     Array.isArray(t.faqFields)    ? t.faqFields    : undefined,
      placeholder:    typeof t.placeholder === 'string' ? t.placeholder : undefined,
      source:         (t.source === 'productDescription' || t.source === 'shared')
                        ? t.source : undefined,
      sharedContent:  typeof t.sharedContent === 'string' ? t.sharedContent : undefined,
    }))
    .sort((a: TabTemplate, b: TabTemplate) => a.sortOrder - b.sortOrder);
}

// ─── Filterable-field discovery for storefront ──────────────────────────────

/**
 * Walk a set of templates + product data and return a list of fields flagged
 * as `filterable: true`, each tagged with its current value on the product.
 * This is the shape a storefront facet-filter system can index directly.
 *
 * Only `specs` and `records` tab types contribute filterable fields.
 */
export interface FilterableValue {
  /** `tabAbbr.fieldAbbr` — stable identifier for the facet across products. */
  key: string;
  tabAbbr: string;
  fieldAbbr: string;
  label: string;
  type: SpecFieldType;
  /** `'single'` for specs (one value per product) or `'list'` for records. */
  cardinality: 'single' | 'list';
  value: any;
}

export function collectFilterableValues(
  templates: TabTemplate[],
  data: TabDataMap,
): FilterableValue[] {
  const out: FilterableValue[] = [];
  for (const tpl of templates) {
    if (!tpl.isActive) continue;

    if (tpl.type === 'specs' && Array.isArray(tpl.specFields)) {
      const record = (data?.[tpl.abbr] ?? {}) as Record<string, any>;
      for (const f of tpl.specFields) {
        if (!f.filterable) continue;
        out.push({
          key: `${tpl.abbr}.${f.abbr}`,
          tabAbbr: tpl.abbr, fieldAbbr: f.abbr,
          label: f.label, type: f.type,
          cardinality: 'single',
          value: record[f.abbr],
        });
      }
    }

    if (tpl.type === 'records' && Array.isArray(tpl.recordFields)) {
      const rows = Array.isArray(data?.[tpl.abbr]) ? (data[tpl.abbr] as any[]) : [];
      for (const f of tpl.recordFields) {
        if (!f.filterable) continue;
        out.push({
          key: `${tpl.abbr}.${f.abbr}`,
          tabAbbr: tpl.abbr, fieldAbbr: f.abbr,
          label: f.label, type: f.type,
          cardinality: 'list',
          value: rows.map(r => r?.[f.abbr]).filter(v => v !== '' && v != null),
        });
      }
    }
  }
  return out;
}
