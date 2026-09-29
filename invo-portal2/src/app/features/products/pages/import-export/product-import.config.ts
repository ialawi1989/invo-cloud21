import {
  ImportRow,
  ImportWizardConfig,
} from '@shared/components/import-wizard/import-wizard.types';

import { ProductCrudService } from '../../services/product-crud.service';

/**
 * `<app-import-wizard>` config for the local product catalogue
 * (the "Import/Export" screen — NOT the Shopify catalog import, which is a
 * separate flow with its own runner: see `shopify-import-runner.service.ts`).
 *
 * Column order and the template's header row are byte-for-byte the legacy
 * `products-list-template` from InvoCloudFront2, so a sheet exported from the
 * old app imports unchanged. The wizard parses **positionally**, not by header
 * name, so reordering these `columns` silently remaps every field.
 */

/** Spreadsheet truthy spellings the legacy importer accepted. */
const TRUTHY = new Set(['yes', 'y', 'true', '1']);
const toBool = (v: string | undefined): boolean =>
  TRUTHY.has(String(v ?? '').trim().toLowerCase());

/** `Number` or 0 — mirrors the legacy `isNaN(+x) ? 0 : +x` coercion. */
const toNum = (v: string | undefined): number => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};

/**
 * `undefined` for a blank or non-numeric cell. A blank Duration means
 * "don't touch this", not "set it to 10" — legacy deliberately left the field
 * null so it wouldn't overwrite a value already on the product.
 */
const toOptionalNum = (v: string | undefined): number | undefined => {
  const s = String(v ?? '').trim();
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/** `a;b;c` → `['a','b','c']`; blank → `[]`. */
const splitList = (v: string | undefined): string[] =>
  String(v ?? '').split(';').map(s => s.trim()).filter(Boolean);

/**
 * Product types the backend accepts on `product/importProducts`.
 *
 * Deliberately wider than the legacy `checkTypeExistsInTypeList`, which
 * allowed only service/kit/inventory/batch/serialized/menuitem while its own
 * downloadable template shipped `package`, `menuItem` and `menuSelection`
 * sample rows — so three of its own examples failed its own validation. The
 * list here matches the route's `:type` vocabulary instead.
 */
const PRODUCT_TYPES = new Set([
  'inventory',
  'serialized',
  'batch',
  'kit',
  'service',
  'package',
  'menuitem',
  'menuselection',
  'tailoring',
]);

/** Duration lands on `serviceTime` for services… */
const SERVICE_TYPES = new Set(['service']);
/** …and on `preparationTime` for the menu/tailoring types. */
const PREPARATION_TYPES = new Set(['menuitem', 'menuselection', 'tailoring']);

const K = 'PRODUCTS.IMPORT_EXPORT.IMPORT';

export function buildProductImportConfig(service: ProductCrudService): ImportWizardConfig {
  return {
    // NOTE: a key, not `translate.instant(...)` — the wizard pipes the title
    // through `translate` itself.
    title: `${K}.TITLE`,
    hint: `${K}.HINT`,

    columns: [
      { key: 'type',           label: `${K}.COL_TYPE` },
      { key: 'name',           label: `${K}.COL_NAME` },
      { key: 'description',    label: `${K}.COL_DESCRIPTION` },
      { key: 'barcode',        label: `${K}.COL_BARCODE` },
      { key: 'department',     label: `${K}.COL_DEPARTMENT` },
      { key: 'category',       label: `${K}.COL_CATEGORY` },
      { key: 'defaultPrice',   label: `${K}.COL_DEFAULT_PRICE` },
      { key: 'isDiscountable', label: `${K}.COL_IS_DISCOUNTABLE` },
      { key: 'tags',           label: `${K}.COL_TAGS` },
      { key: 'uom',            label: `${K}.COL_UOM` },
      { key: 'unitCost',       label: `${K}.COL_UNIT_COST` },
      { key: 'commissionType', label: `${K}.COL_COMMISSION_TYPE` },
      { key: 'commissionValue',label: `${K}.COL_COMMISSION_VALUE` },
      { key: 'duration',       label: `${K}.COL_DURATION` },
      { key: 'nameEn',         label: `${K}.COL_NAME_EN` },
      { key: 'nameAr',         label: `${K}.COL_NAME_AR` },
      { key: 'descriptionEn',  label: `${K}.COL_DESCRIPTION_EN` },
      { key: 'descriptionAr',  label: `${K}.COL_DESCRIPTION_AR` },
      { key: 'brand',          label: `${K}.COL_BRAND` },
      { key: 'barcodes',       label: `${K}.COL_BARCODES` },
      { key: 'defaultTax',     label: `${K}.COL_DEFAULT_TAX` },
      { key: 'kitchenName',    label: `${K}.COL_KITCHEN_NAME` },
      { key: 'sku',            label: `${K}.COL_SKU` },
    ],

    // Header row + one sample row per product type, carried over from the
    // legacy `downloadTemplate`. (Legacy's sample rows were ragged — only the
    // first carried the trailing SKU cell — so every row here is padded to
    // the full 23 columns.)
    templateRows: [
      [
        'Product Type', 'Product Name', 'Description', 'Barcode', 'Department',
        'Category', 'Default Price', 'Is Discountable', 'Tags', 'UOM', 'Unit Cost',
        'Commission Type', 'Commission Value', 'Duration', 'English Name',
        'Arabic Name', 'English Description', 'Arabic Description', 'Brand',
        'Barcodes', 'Default Tax', 'Kitchen Name', 'SKU',
      ],
      ['inventory', 'Laptop', 'A powerful laptop with a long battery life.', '5644571312053', 'Department 1', 'Category 1', '10', 'yes', 'laptop;hp;keyboard', 'pcs', '10', '%', '15', '', 'Laptop', 'لابتوب', 'A powerful laptop with a long battery life.', 'لابتوب قوي مع بطارية تدوم', 'HP', '123456;7891011;12131415', 'yes', '', 'Normal'],
      ['serialized', 'Serial Item 1', 'Serial Item.', '5644571312054', 'Department 2', 'Category 2', '10', 'yes', 'serial;serial 2', 'Pcs', '20', '%', '15', '', 'Serial Item 1', 'سيريال آيتم 1', 'Serial Item', 'سيريال آيتم', '', '', 'yes', '', ''],
      ['batch', 'Batch', 'Batch 1234.', '5644571312055', 'Department 1', 'Category 2', '10', 'yes', '', 'pcs', '10', '%', '15', '', 'Batch', 'باتش', 'Batch', 'باتش', '', '', 'yes', '', ''],
      ['kit', 'New Shirt kit', 'New Shirt kit.', '5644571312056', 'Department 1', 'Category 1', '10', 'yes', 'New Shirt kit;jersey', 'kg', '10', '%', '0', '', 'kit', 'كت', 'kit', 'كت', '', '', 'yes', '', ''],
      ['service', 'Service Product', 'Service Product', '5644571312057', 'Department 1', 'Category 1', '10', 'yes', 'Service', '', '10', 'BHD', '2', '30', 'Service Product', 'منتج خدمة', 'Service Product', 'منتج خدمة', '', '', 'yes', '', ''],
      ['menuItem', 'Baby potato', 'Baby potato.', '5644571312060', 'Department 1', 'Category 1', '10', 'yes', '', '', '10', '%', '0', '', 'Baby potato', 'بطاطا', 'Baby potato', 'بطاطا', '', '', 'yes', 'Kitchen 1', ''],
      ['menuSelection', 'menu selection', '', '5644571312063', 'Department 1', 'Category 1', '10', 'yes', '', '', '10', '%', '15', '', 'menu selection', 'اختيار', 'menu selection', 'اختيار', '', '', 'yes', 'Kitchen 1', ''],
    ],
    templateName: 'products-list-template',

    validate: (cells: ImportRow) => {
      const errors: string[] = [];

      const type = (cells['type'] ?? '').trim();
      if (!type) {
        errors.push(`${K}.ERR_MISSING_TYPE`);
      } else if (!PRODUCT_TYPES.has(type.toLowerCase())) {
        errors.push(`${K}.ERR_INVALID_TYPE`);
      }

      if (!(cells['name'] ?? '').trim()) {
        errors.push(`${K}.ERR_MISSING_NAME`);
      }

      // Free-text columns that must be numeric when filled.
      for (const [key, err] of [
        ['defaultPrice', `${K}.ERR_INVALID_PRICE`],
        ['unitCost', `${K}.ERR_INVALID_UNIT_COST`],
        ['commissionValue', `${K}.ERR_INVALID_COMMISSION`],
        ['duration', `${K}.ERR_INVALID_DURATION`],
      ] as const) {
        const raw = (cells[key] ?? '').trim();
        if (raw !== '' && !Number.isFinite(Number(raw))) {
          errors.push(err);
        }
      }

      return { errors };
    },

    // Barcode is what the backend matches an existing product on.
    duplicateKey: (cells) => (cells['barcode'] ?? '').trim().toLowerCase(),

    notes: {
      title: `${K}.GUIDELINES`,
      sections: [
        {
          title: `${K}.REQ_TITLE`,
          items: [
            `${K}.REQ_TYPE`,
            `${K}.REQ_NAME`,
            `${K}.REQ_HEADER`,
            `${K}.REQ_TAGS`,
          ],
        },
        {
          title: `${K}.OPT_TITLE`,
          items: [
            `${K}.OPT_DURATION`,
            `${K}.OPT_COMMISSION`,
            `${K}.OPT_BARCODES`,
            `${K}.OPT_TRANSLATION`,
          ],
        },
      ],
      tip: `${K}.TIP`,
    },

    preflight: async () => {
      const p = await service.getBulkImportProgress();
      // Inverted contract: `success === true` means "nothing running, go ahead".
      return p && !p.success ? (p.msg || null) : null;
    },

    submit: async (rows) => {
      const payload = rows.map(r => {
        const type = (r['type'] ?? '').trim();
        const lower = type.toLowerCase();
        const duration = toOptionalNum(r['duration']);

        const product: Record<string, any> = {
          type,
          name: (r['name'] ?? '').trim(),
          description: (r['description'] ?? '').trim(),
          barcode: (r['barcode'] ?? '').trim(),
          departmentName: (r['department'] ?? '').trim() || null,
          categoryName: (r['category'] ?? '').trim(),
          defaultPrice: toNum(r['defaultPrice']),
          isDiscountable: toBool(r['isDiscountable']),
          tags: splitList(r['tags']),
          UOM: (r['uom'] ?? '').trim() || 'pcs',
          unitCost: toNum(r['unitCost']),
          commissionPercentage: (r['commissionType'] ?? '').trim() === '%',
          commissionAmount: toNum(r['commissionValue']),
          brand: (r['brand'] ?? '').trim(),
          barcodes: splitList(r['barcodes']).map(barcode => ({ barcode })),
          defaultTax: toBool(r['defaultTax']),
          kitchenName: (r['kitchenName'] ?? '').trim(),
          sku: (r['sku'] ?? '').trim(),
          translation: {
            // Legacy fell back to the product name when the English cell was
            // blank, so the translation isn't left name-less.
            name: {
              en: (r['nameEn'] ?? '').trim() || (r['name'] ?? '').trim(),
              ar: (r['nameAr'] ?? '').trim(),
            },
            description: {
              en: (r['descriptionEn'] ?? '').trim(),
              ar: (r['descriptionAr'] ?? '').trim(),
            },
          },
        };

        // Only set the duration field this row's type actually has. Other
        // types leave both null rather than forcing a default.
        if (duration !== undefined) {
          if (SERVICE_TYPES.has(lower)) {
            product['serviceTime'] = duration;
          } else if (PREPARATION_TYPES.has(lower)) {
            product['preparationTime'] = duration;
          }
        }

        return product;
      });

      const res = await service.importProducts(payload);

      if (!res?.success) {
        return { ok: false, msg: res?.msg || `${K}.ERR_IMPORT_FAILED` };
      }

      // Per-row errors come back inside a successful response — surface them
      // rather than reporting a clean import.
      const errors: { productName?: string; error?: string }[] = res?.data?.errors || [];
      if (errors.length > 0) {
        const detail = errors
          .map(e => `${e.productName ?? '—'}: ${e.error ?? ''}`)
          .join('\n');
        return { ok: false, msg: `${res.msg ? res.msg + '\n' : ''}${detail}` };
      }

      return { ok: true };
    },
  };
}
