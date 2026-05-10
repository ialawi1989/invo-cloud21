import { TranslateService } from '@ngx-translate/core';

import { ImportWizardConfig } from '@shared/components/import-wizard/import-wizard.types';

import { PriceLabelService } from '../../services/price-label.service';

/**
 * Builds the `<app-import-wizard>` config for a Price Label.
 *
 * Shared between the list-row import action and the in-form Import
 * header button so both surfaces feed the same validator, columns,
 * and template — change the schema in one place and both flows stay
 * in lockstep.
 *
 * Pre-flight runs the bulk-progress gate again at submit time, so a
 * job started concurrently between the open-side check and submit
 * gets caught.
 */
export function buildPriceLabelImportConfig(
  args: {
    id:        string;
    name:      string;
    service:   PriceLabelService;
    translate: TranslateService;
  },
): ImportWizardConfig {
  const { id, name, service, translate } = args;
  return {
    title: translate.instant('PRICE_LABEL.IMPORT.TITLE'),
    hint:  'PRICE_LABEL.IMPORT.HINT',
    scope: { label: 'PRICE_LABEL.IMPORT.SCOPE', value: name },
    columns: [
      { key: 'price',   label: 'PRICE_LABEL.IMPORT.PRICE' },
      { key: 'barcode', label: 'PRICE_LABEL.IMPORT.BARCODE' },
    ],
    templateRows: [['price', 'barcode'], [10, '5644571312054']],
    templateName: 'price-label-template',
    validate: (cells) => {
      const errs: string[] = [];
      if (!Number.isFinite(Number(cells['price']))) {
        errs.push(translate.instant('PRICE_LABEL.IMPORT.ERR_INVALID_PRICE'));
      }
      if (!cells['barcode']) {
        errs.push(translate.instant('PRICE_LABEL.IMPORT.ERR_MISSING_BARCODE'));
      }
      return { errors: errs };
    },
    duplicateKey: (cells) => cells['barcode'] ?? '',
    notes: {
      sections: [
        {
          title: 'COMMON.IMPORT_WIZARD.REQUIRED_FIELDS',
          items: [
            'PRICE_LABEL.IMPORT.REQ_FIELD_PRICE',
            'PRICE_LABEL.IMPORT.REQ_FIELD_BARCODE',
            'PRICE_LABEL.IMPORT.REQ_FIELD_HEADER',
          ],
        },
        {
          title: 'COMMON.IMPORT_WIZARD.IMPORT_MODES',
          items: [
            'PRICE_LABEL.IMPORT.MODE_HINT_ADD_UPDATE',
            'PRICE_LABEL.IMPORT.MODE_HINT_OVERRIDE',
            'PRICE_LABEL.IMPORT.MODE_HINT_ADD_ONLY',
          ],
        },
      ],
      tip: 'PRICE_LABEL.IMPORT.TIP',
    },
    modes: [
      {
        value:       'add_update',
        label:       'PRICE_LABEL.IMPORT.MODE_ADD_UPDATE',
        description: 'PRICE_LABEL.IMPORT.MODE_ADD_UPDATE_DESC',
      },
      {
        value:       'override',
        label:       'PRICE_LABEL.IMPORT.MODE_OVERRIDE',
        description: 'PRICE_LABEL.IMPORT.MODE_OVERRIDE_DESC',
        warn:        true,
      },
      {
        value:       'add_only',
        label:       'PRICE_LABEL.IMPORT.MODE_ADD_ONLY',
        description: 'PRICE_LABEL.IMPORT.MODE_ADD_ONLY_DESC',
      },
    ],
    defaultMode: 'add_update',
    preflight: async () => {
      const p = await service.getBulkImportProgress(id);
      return p && !p.success ? (p.msg || null) : null;
    },
    submit: async (rows, opts) => {
      let products = rows.map(r => ({
        price:   Number(r['price']),
        barcode: r['barcode'],
      }));

      // `add_only` is enforced client-side: pre-fetch the label and
      // drop any barcodes that already have an override. This lets
      // the mode work today without waiting on a backend change —
      // the legacy `importPriceLabel` always merges by barcode.
      let preFiltered = 0;
      if (opts.mode === 'add_only') {
        const existing = await service.getById(id);
        const taken = new Set<string>(
          (existing?.productsPrices ?? [])
            .map((p: any) => String(p?.barcode ?? ''))
            .filter(Boolean),
        );
        const before = products.length;
        products = products.filter(p => !taken.has(p.barcode));
        preFiltered = before - products.length;

        // Nothing left to send — surface as a successful no-op so
        // the user gets the Complete screen instead of a stale
        // "import failed" message.
        if (products.length === 0) {
          return {
            ok: true,
            result: {
              total:      before,
              successful: 0,
              failed:     0,
              skipped:    preFiltered,
            },
          };
        }
      }

      const res = await service.importPriceLabel({
        id, name, products, mode: opts.mode,
      });
      if (!res?.success) return { ok: false, msg: res?.msg };

      // Surface client-side-filtered counts in `add_only` so the
      // Complete step's "skipped" tile reflects what actually
      // happened.
      return preFiltered > 0
        ? {
            ok: true,
            result: {
              total:      products.length + preFiltered,
              successful: products.length,
              failed:     0,
              skipped:    preFiltered,
            },
          }
        : { ok: true };
    },
  };
}

/**
 * Builds the `<app-import-wizard>` config for the **options** side
 * of a Price Label.
 *
 * Keyed by the option's display **name** rather than its id —
 * users see names in the UI (e.g. "Small / Medium / Large"); the
 * id is opaque. The server resolves name → optionId at submit
 * time.
 *
 * Note: option names within an option group are expected to be
 * unique. If two options across different groups share a name,
 * the server picks one (first match) — surface that as a backend
 * concern, not a wizard concern.
 *
 * Modes, notes, and `add_only` client-side enforcement work the
 * same way as the products config; the only differences are the
 * columns, the service endpoints (`importPriceLabelOptions` +
 * `getBulkOptionsImportProgress`), and the existing-key set
 * (label's `optionsPrices`, compared by `name`).
 */
export function buildPriceLabelOptionImportConfig(
  args: {
    id:        string;
    name:      string;
    service:   PriceLabelService;
    translate: TranslateService;
  },
): ImportWizardConfig {
  const { id, name, service, translate } = args;

  // Lower-case helper used for case-insensitive name matching in
  // the `add_only` pre-filter. Keeping it here so dedup and
  // pre-filter agree on what counts as "the same name".
  const norm = (s: string) => s.trim().toLowerCase();

  return {
    title: translate.instant('PRICE_LABEL.IMPORT.TITLE_OPTIONS'),
    hint:  'PRICE_LABEL.IMPORT.HINT_OPTIONS',
    scope: { label: 'PRICE_LABEL.IMPORT.SCOPE', value: name },
    columns: [
      { key: 'price', label: 'PRICE_LABEL.IMPORT.PRICE' },
      { key: 'name',  label: 'PRICE_LABEL.IMPORT.OPTION_NAME' },
    ],
    templateRows: [['price', 'name'], [10, 'Small']],
    templateName: 'price-label-options-template',
    validate: (cells) => {
      const errs: string[] = [];
      if (!Number.isFinite(Number(cells['price']))) {
        errs.push(translate.instant('PRICE_LABEL.IMPORT.ERR_INVALID_PRICE'));
      }
      if (!cells['name']) {
        errs.push(translate.instant('PRICE_LABEL.IMPORT.ERR_MISSING_OPTION_NAME'));
      }
      return { errors: errs };
    },
    duplicateKey: (cells) => norm(cells['name'] ?? ''),
    notes: {
      sections: [
        {
          title: 'COMMON.IMPORT_WIZARD.REQUIRED_FIELDS',
          items: [
            'PRICE_LABEL.IMPORT.REQ_FIELD_PRICE',
            'PRICE_LABEL.IMPORT.REQ_FIELD_OPTION_NAME',
            'PRICE_LABEL.IMPORT.REQ_FIELD_HEADER_OPTIONS',
          ],
        },
        {
          title: 'COMMON.IMPORT_WIZARD.IMPORT_MODES',
          items: [
            'PRICE_LABEL.IMPORT.MODE_HINT_ADD_UPDATE',
            'PRICE_LABEL.IMPORT.MODE_HINT_OVERRIDE',
            'PRICE_LABEL.IMPORT.MODE_HINT_ADD_ONLY',
          ],
        },
      ],
      tip: 'PRICE_LABEL.IMPORT.TIP',
    },
    modes: [
      {
        value:       'add_update',
        label:       'PRICE_LABEL.IMPORT.MODE_ADD_UPDATE',
        description: 'PRICE_LABEL.IMPORT.MODE_ADD_UPDATE_DESC',
      },
      {
        value:       'override',
        label:       'PRICE_LABEL.IMPORT.MODE_OVERRIDE',
        description: 'PRICE_LABEL.IMPORT.MODE_OVERRIDE_DESC',
        warn:        true,
      },
      {
        value:       'add_only',
        label:       'PRICE_LABEL.IMPORT.MODE_ADD_ONLY',
        description: 'PRICE_LABEL.IMPORT.MODE_ADD_ONLY_DESC',
      },
    ],
    defaultMode: 'add_update',
    preflight: async () => {
      const p = await service.getBulkOptionsImportProgress(id);
      return p && !p.success ? (p.msg || null) : null;
    },
    submit: async (rows, opts) => {
      let options = rows.map(r => ({
        price: Number(r['price']),
        name:  r['name'],
      }));

      let preFiltered = 0;
      if (opts.mode === 'add_only') {
        // Pre-fetch the label and drop incoming rows whose name
        // already maps to an existing override. Server-side we
        // can't easily do this without first resolving names →
        // ids, so the front-end's view of "already taken" is the
        // load-bearing check here.
        const existing = await service.getById(id);
        const taken = new Set<string>(
          (existing?.optionsPrices ?? [])
            .map((o: any) => norm(String(o?.name ?? '')))
            .filter(Boolean),
        );
        const before = options.length;
        options = options.filter(o => !taken.has(norm(o.name)));
        preFiltered = before - options.length;

        if (options.length === 0) {
          return {
            ok: true,
            result: {
              total:      before,
              successful: 0,
              failed:     0,
              skipped:    preFiltered,
            },
          };
        }
      }

      const res = await service.importPriceLabelOptions({
        id, name, options, mode: opts.mode,
      });
      if (!res?.success) return { ok: false, msg: res?.msg };

      return preFiltered > 0
        ? {
            ok: true,
            result: {
              total:      options.length + preFiltered,
              successful: options.length,
              failed:     0,
              skipped:    preFiltered,
            },
          }
        : { ok: true };
    },
  };
}
