import { TranslateService } from '@ngx-translate/core';

import { ImportWizardConfig, ImportRow } from '@shared/components/import-wizard/import-wizard.types';

import { OptionService, OptionImportRow } from '../../services/option.service';

/** Spreadsheet truthy spellings the legacy importer accepted. */
const TRUTHY = new Set(['yes', 'y', 'true', '1']);
const toBool = (v: string | undefined): boolean => TRUTHY.has(String(v ?? '').trim().toLowerCase());

/**
 * Builds the `<app-import-wizard>` config for product Options.
 *
 * Column order matches the legacy `product-options-template` so sheets
 * exported from the old app import unchanged: name, display name, kitchen
 * name, isMultiple, isVisible, price, then the en/ar name translations.
 *
 * No mode radios — `product/importOptions` only ever appended/merged by
 * name, and offering an "override" toggle the backend ignores would lie
 * to the user.
 */
export function buildOptionImportConfig(args: {
  service: OptionService;
  translate: TranslateService;
}): ImportWizardConfig {
  const { service, translate } = args;

  return {
    title: translate.instant('PRODUCTS.OPTIONS.IMPORT.TITLE'),
    hint: 'PRODUCTS.OPTIONS.IMPORT.HINT',
    columns: [
      { key: 'name', label: 'PRODUCTS.OPTIONS.IMPORT.COL_NAME' },
      { key: 'displayName', label: 'PRODUCTS.OPTIONS.IMPORT.COL_DISPLAY_NAME' },
      { key: 'kitchenName', label: 'PRODUCTS.OPTIONS.IMPORT.COL_KITCHEN_NAME' },
      { key: 'isMultiple', label: 'PRODUCTS.OPTIONS.IMPORT.COL_IS_MULTIPLE' },
      { key: 'isVisible', label: 'PRODUCTS.OPTIONS.IMPORT.COL_IS_VISIBLE' },
      { key: 'price', label: 'PRODUCTS.OPTIONS.IMPORT.COL_PRICE' },
      { key: 'nameEn', label: 'PRODUCTS.OPTIONS.IMPORT.COL_NAME_EN' },
      { key: 'nameAr', label: 'PRODUCTS.OPTIONS.IMPORT.COL_NAME_AR' },
    ],
    templateRows: [
      ['Option Name', 'Display Name', 'Kitchen Name', 'Is Multiple', 'Is Visible', 'Price', 'English Name', 'Arabic Name'],
      ['Earl Grey Blue', 'Earl Grey Blue', 'Earl Grey Blue Option', 'yes', 'yes', 10, 'Earl Grey Blue', 'إيرل جراي بلو'],
    ],
    templateName: 'product-options-template',
    validate: (cells: ImportRow) => {
      const errors: string[] = [];
      if (!cells['name']?.trim()) {
        errors.push(translate.instant('PRODUCTS.OPTIONS.IMPORT.ERR_MISSING_NAME'));
      }
      const price = cells['price'];
      if (price !== undefined && price !== '' && !Number.isFinite(Number(price))) {
        errors.push(translate.instant('PRODUCTS.OPTIONS.IMPORT.ERR_INVALID_PRICE'));
      }
      return { errors };
    },
    duplicateKey: (cells) => (cells['name'] ?? '').trim().toLowerCase(),
    notes: {
      sections: [
        {
          title: 'COMMON.IMPORT_WIZARD.REQUIRED_FIELDS',
          items: [
            'PRODUCTS.OPTIONS.IMPORT.REQ_FIELD_NAME',
            'PRODUCTS.OPTIONS.IMPORT.REQ_FIELD_FLAGS',
            'PRODUCTS.OPTIONS.IMPORT.REQ_FIELD_HEADER',
          ],
        },
      ],
      tip: 'PRODUCTS.OPTIONS.IMPORT.TIP',
    },
    preflight: async () => {
      const p = await service.getBulkImportProgress();
      // Inverted contract: success === "nothing running, go ahead".
      return p && !p.success ? (p.msg || null) : null;
    },
    submit: async (rows) => {
      const payload: OptionImportRow[] = rows.map((r) => {
        const price = Number(r['price']) || 0;
        return {
          name: (r['name'] ?? '').trim(),
          displayName: (r['displayName'] ?? '').trim(),
          kitchenName: (r['kitchenName'] ?? '').trim(),
          isMultiple: toBool(r['isMultiple']),
          isVisible: toBool(r['isVisible']),
          price,
          defaultPrice: price,
          translation: {
            name: {
              en: (r['nameEn'] ?? '').trim(),
              ar: (r['nameAr'] ?? '').trim(),
            },
          },
        };
      });

      const res = await service.importOptions(payload);
      return res.success ? { ok: true } : { ok: false, msg: res.msg };
    },
  };
}
