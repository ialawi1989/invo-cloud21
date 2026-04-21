/**
 * Tab Builder — data model
 * ────────────────────────
 *
 * Two separate shapes, each served by a different editor:
 *
 *   1. **TabTemplate[]** (company-wide, lives under Customization
 *      `type='product', key='tabBuilder'`). Defines *which tabs exist*, what
 *      type each is, and the schema for content (e.g. list of spec fields,
 *      vehicle fitment flags, predefined FAQ questions). Stored as
 *      `{ templates: TabTemplate[] }`.
 *
 *   2. **TabData** (per-product, lives on `Product.tabBuilder`). A plain map
 *      `{ [abbr]: content }` where each entry holds *values* for the tab
 *      identified by `abbr` in the company template. The shape of each value
 *      depends on the tab's type:
 *
 *        - specs       → { [fieldAbbr]: string | number | string[] }
 *        - vehicle     → { isUniversal: boolean; vehicles: VehicleFitment[] }
 *        - richtext    → string (HTML)
 *        - faq         → FaqEntry[]
 *        - custom      → string (raw HTML)
 *        - table       → { headers: string[]; rows: string[][] }
 *
 * The backend stores both blobs as opaque JSON; shape enforcement is the
 * frontend's responsibility.
 */

export type TabType = 'specs' | 'vehicle' | 'richtext' | 'faq' | 'custom' | 'table' | 'review';

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

export type SpecFieldType = 'text' | 'number' | 'select' | 'multiselect';

export interface SpecField {
  id: string;
  label: string;
  abbr: string;
  type: SpecFieldType;
  required: boolean;
  /** Only used when type === 'select' | 'multiselect' */
  options?: string[];
}

export interface VehicleConfig {
  allowUniversal: boolean;
  allowYearRange: boolean;
  requireEngine: boolean;
}

export interface FaqTemplateItem {
  id: string;
  question: string;
  answerPlaceholder?: string;
}

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
  vehicleConfig?: VehicleConfig;
  faqFields?: FaqTemplateItem[];
  /** Shared by richtext + custom */
  placeholder?: string;
}

export interface TabBuilderTemplates {
  templates: TabTemplate[];
}

// ─── Data (per-product) ──────────────────────────────────────────────────────

export interface VehicleFitment {
  id: string;
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
  yearStart: number;
  yearEnd: number;
  engineSize?: string;
}

export interface VehicleTabData {
  isUniversal: boolean;
  vehicles: VehicleFitment[];
}

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

export type SpecsData  = Record<string, string | number | string[]>;
export type TabDataMap = Record<string, any>;

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
    case 'vehicle':  return { ...base, vehicleConfig: { allowUniversal: true, allowYearRange: true, requireEngine: false } };
    case 'faq':      return { ...base, faqFields: [] };
    case 'richtext': return { ...base, placeholder: '' };
    case 'custom':   return { ...base, placeholder: '' };
    case 'table':    return { ...base };
    case 'review':   return { ...base };
  }
}

export function newSpecField(): SpecField {
  return { id: generateId('fld'), label: '', abbr: '', type: 'text', required: false, options: [] };
}

export function newFaqTemplateItem(): FaqTemplateItem {
  return { id: generateId('faq'), question: '', answerPlaceholder: '' };
}

/** Initial value for a tab's data slot, sized to the template schema. */
export function initialTabData(tpl: TabTemplate): any {
  switch (tpl.type) {
    case 'specs':    return {};
    case 'vehicle':  return { isUniversal: false, vehicles: [] } as VehicleTabData;
    case 'richtext': return '';
    case 'custom':   return '';
    case 'faq':      return [] as FaqEntry[];
    case 'table':    return { headers: ['Column 1', 'Column 2'], rows: [] } as TableData;
    case 'review':   return [] as ReviewEntry[];
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
      specFields:    Array.isArray(t.specFields) ? t.specFields : undefined,
      vehicleConfig: t.vehicleConfig ?? undefined,
      faqFields:     Array.isArray(t.faqFields) ? t.faqFields : undefined,
      placeholder:   typeof t.placeholder === 'string' ? t.placeholder : undefined,
    }))
    .sort((a: TabTemplate, b: TabTemplate) => a.sortOrder - b.sortOrder);
}
