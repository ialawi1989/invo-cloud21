// ────────────────────────────────────────────────────────────────────
// Branch serials / batches — import + export plumbing.
//
// Import reuses the shared `<app-import-wizard>` (upload → preview →
// options → import → done, CSV + XLSX, template download, per-row
// validation) rather than shipping a second wizard. This file owns the
// column schema, the per-row rules and the export writer; the section
// component owns the FormArray mutation.
// ────────────────────────────────────────────────────────────────────
import { saveAs } from 'file-saver';

import {
  ImportRow,
  ImportWizardConfig,
} from '@shared/components/import-wizard/import-wizard.types';
import { buildXlsxBlob } from '@shared/components/import-wizard/xlsx-writer';

export type BranchIoKind = 'serials' | 'batches';
export type ImportMode   = 'add' | 'upsert' | 'replace';
export type ExportFormat = 'csv' | 'xlsx';
export type ExportScope  = 'branch' | 'selected' | 'all';

/** One exportable/importable branch bucket — canonical FormArray index kept
 *  alongside the name so nothing has to be looked up by position later. */
export interface BranchIoBucket {
  index: number;
  name:  string;
  rows:  any[];
}

/** Context the section component hands to the wizard config builder. */
export interface BranchImportCtx {
  kind: BranchIoKind;
  /** Branch that rows land in when the file has no `branch` column. */
  defaultBranchName: string;
  /** Resolve a branch name from the file to a canonical FormArray index.
   *  Empty name → the default branch. `null` = unknown branch. */
  resolveBranch: (name: string) => number | null;
  /** True when the key already exists in that branch (serial / batch name). */
  existsInBranch: (branchIndex: number, key: string) => boolean;
  /** Applies the accepted rows. Returns what actually landed. */
  apply: (
    rows: ImportRow[],
    mode: ImportMode,
  ) => { added: number; updated: number; skipped: number };
}

// ─── Column schemas ───────────────────────────────────────────────────
// `key` doubles as the CSV header the parser matches on, so keep these
// stable — they're the file contract, not display text.
export const SERIAL_COLUMNS = [
  { key: 'serial',   label: 'PRODUCTS.FORM.SERIAL_NUMBER' },
  { key: 'unitCost', label: 'PRODUCTS.PRICING.UNIT_COST' },
  { key: 'status',   label: 'PRODUCTS.FORM.STATUS' },
  { key: 'branch',   label: 'PRODUCTS.FORM.BRANCH' },
];

export const BATCH_COLUMNS = [
  { key: 'id',         label: 'PRODUCTS.FORM.IO_ID' },
  { key: 'batch',      label: 'PRODUCTS.FORM.BATCH_NAME' },
  { key: 'onHand',     label: 'PRODUCTS.FORM.ON_HAND' },
  { key: 'unitCost',   label: 'PRODUCTS.PRICING.UNIT_COST' },
  { key: 'prodDate',   label: 'PRODUCTS.FORM.PROD_DATE' },
  { key: 'expireDate', label: 'PRODUCTS.FORM.EXPIRE_DATE' },
  { key: 'branch',     label: 'PRODUCTS.FORM.BRANCH' },
];

export function columnsFor(kind: BranchIoKind) {
  return kind === 'serials' ? SERIAL_COLUMNS : BATCH_COLUMNS;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Builds the wizard config for one kind. Row rules mirror the legacy
 * import: hard errors block the row, "soft" problems (missing cost, a
 * `Sold` status with no reference) are normalised on apply instead of
 * failing the file.
 */
export function buildBranchImportConfig(
  ctx: BranchImportCtx,
  t: (key: string, params?: any) => string,
): ImportWizardConfig {
  const isSerials = ctx.kind === 'serials';
  const columns = columnsFor(ctx.kind).map(c => ({ key: c.key, label: t(c.label) }));

  return {
    title: t(isSerials ? 'PRODUCTS.FORM.IO_IMPORT_SERIALS' : 'PRODUCTS.FORM.IO_IMPORT_BATCHES'),
    hint:  t('PRODUCTS.FORM.IO_IMPORT_HINT'),
    scope: { label: t('PRODUCTS.FORM.BRANCH'), value: ctx.defaultBranchName },
    columns,
    templateName: isSerials ? 'product-serials' : 'product-batches',
    templateRows: isSerials
      ? [
          columns.map(c => c.label),
          ['SN-1001', '2.400', 'Available', ctx.defaultBranchName],
        ]
      : [
          columns.map(c => c.label),
          ['', 'B-2026-01', '240', '1.900', '2026-01-04', '2027-01-04', ctx.defaultBranchName],
        ],

    // Same key the apply step dedupes on — branch-scoped, so the same
    // serial in two branches isn't reported as a duplicate.
    duplicateKey: (cells: ImportRow) =>
      `${(cells['branch'] ?? '').trim().toLowerCase()}|${String(cells[isSerials ? 'serial' : 'batch'] ?? '').trim().toLowerCase()}`,

    validate: (cells: ImportRow) => {
      const errors: string[] = [];
      const branchName = String(cells['branch'] ?? '').trim();
      const branchIndex = ctx.resolveBranch(branchName);
      if (branchIndex === null) {
        errors.push(t('PRODUCTS.FORM.IO_ERR_UNKNOWN_BRANCH', { name: branchName }));
      }

      if (isSerials) {
        const serial = String(cells['serial'] ?? '').trim();
        if (!serial) errors.push(t('PRODUCTS.FORM.IO_ERR_SERIAL_REQUIRED'));
        else if (branchIndex !== null && ctx.existsInBranch(branchIndex, serial.toLowerCase())) {
          errors.push(t('PRODUCTS.FORM.IO_ERR_SERIAL_EXISTS'));
        }
        const cost = String(cells['unitCost'] ?? '').trim();
        if (cost && !Number.isFinite(Number(cost))) {
          errors.push(t('PRODUCTS.FORM.IO_ERR_NUMBER', { field: t('PRODUCTS.PRICING.UNIT_COST') }));
        }
      } else {
        const batch = String(cells['batch'] ?? '').trim();
        if (!batch) errors.push(t('PRODUCTS.FORM.IO_ERR_BATCH_REQUIRED'));
        else if (branchIndex !== null && ctx.existsInBranch(branchIndex, batch.toLowerCase())) {
          errors.push(t('PRODUCTS.FORM.IO_ERR_BATCH_EXISTS'));
        }
        const onHand = String(cells['onHand'] ?? '').trim();
        if (!onHand) errors.push(t('PRODUCTS.FORM.IO_ERR_ONHAND_REQUIRED'));
        else if (!Number.isFinite(Number(onHand))) {
          errors.push(t('PRODUCTS.FORM.IO_ERR_NUMBER', { field: t('PRODUCTS.FORM.ON_HAND') }));
        }
        const prod = String(cells['prodDate'] ?? '').trim();
        const exp  = String(cells['expireDate'] ?? '').trim();
        for (const [v, label] of [[prod, 'PRODUCTS.FORM.PROD_DATE'], [exp, 'PRODUCTS.FORM.EXPIRE_DATE']] as const) {
          if (v && !DATE_RE.test(v)) errors.push(t('PRODUCTS.FORM.IO_ERR_DATE', { field: t(label) }));
        }
        if (prod && exp && DATE_RE.test(prod) && DATE_RE.test(exp) && exp < prod) {
          errors.push(t('PRODUCTS.FORM.EXPIRE_BEFORE_PROD'));
        }
      }
      return { errors };
    },

    modes: [
      { value: 'add',     label: t('PRODUCTS.FORM.IO_MODE_ADD'),     description: t('PRODUCTS.FORM.IO_MODE_ADD_HINT') },
      { value: 'upsert',  label: t('PRODUCTS.FORM.IO_MODE_UPSERT'),  description: t('PRODUCTS.FORM.IO_MODE_UPSERT_HINT') },
      { value: 'replace', label: t('PRODUCTS.FORM.IO_MODE_REPLACE'), description: t('PRODUCTS.FORM.IO_MODE_REPLACE_HINT'), warn: true },
    ],
    defaultMode: 'add',

    notes: {
      title: t('PRODUCTS.FORM.IO_GUIDELINES'),
      sections: [
        {
          title: t('PRODUCTS.FORM.IO_GUIDELINES_COLUMNS'),
          items: isSerials
            ? [t('PRODUCTS.FORM.IO_NOTE_SERIAL_REQUIRED'), t('PRODUCTS.FORM.IO_NOTE_BRANCH_COLUMN', { name: ctx.defaultBranchName })]
            : [t('PRODUCTS.FORM.IO_NOTE_BATCH_REQUIRED'), t('PRODUCTS.FORM.IO_NOTE_BRANCH_COLUMN', { name: ctx.defaultBranchName })],
        },
        {
          title: t('PRODUCTS.FORM.IO_GUIDELINES_VALUES'),
          items: isSerials
            ? [t('PRODUCTS.FORM.IO_NOTE_COST_DEFAULT'), t('PRODUCTS.FORM.IO_NOTE_STATUS')]
            : [t('PRODUCTS.FORM.IO_NOTE_COST_DEFAULT'), t('PRODUCTS.FORM.IO_NOTE_DATE_FORMAT')],
        },
      ],
      tip: t('PRODUCTS.FORM.IO_NOTE_NOT_SAVED'),
    },

    submit: async (rows, opts) => {
      const res = ctx.apply(rows, (opts.mode || 'add') as ImportMode);
      return {
        ok: true,
        result: {
          total:      rows.length,
          successful: res.added + res.updated,
          failed:     0,
          skipped:    res.skipped,
        },
      };
    },
  };
}

// ─── Export ───────────────────────────────────────────────────────────

/**
 * Writes the picked buckets out as CSV or XLSX. The `id` column rides
 * along for batches so an exported file can be edited and re-imported in
 * `upsert` mode instead of creating duplicates; serials are keyed by the
 * serial itself and have no server id.
 */
export function exportBranchData(params: {
  kind:     BranchIoKind;
  buckets:  BranchIoBucket[];
  format:   ExportFormat;
  /** Column keys to include, in schema order. */
  columns:  string[];
  fileBase: string;
  /** Header labels keyed by column key (already translated). */
  headers:  Record<string, string>;
}): number {
  const { kind, buckets, format, columns, fileBase, headers } = params;
  const isSerials = kind === 'serials';

  const matrix: (string | number)[][] = [columns.map(c => headers[c] ?? c)];
  let count = 0;

  for (const bucket of buckets) {
    for (const row of bucket.rows) {
      matrix.push(columns.map((key) => {
        if (key === 'branch') return bucket.name;
        const v = (row as any)[key];
        if (v == null) return '';
        if (key === 'prodDate' || key === 'expireDate') return toIsoDate(v);
        if (key === 'status' && isSerials) return String(v || 'Available');
        return typeof v === 'number' ? v : String(v);
      }));
      count++;
    }
  }

  if (format === 'xlsx') {
    saveAs(buildXlsxBlob(matrix), `${fileBase}.xlsx`);
  } else {
    const csv = matrix.map(r => r.map(csvCell).join(',')).join('\r\n');
    saveAs(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `${fileBase}.csv`);
  }
  return count;
}

function csvCell(v: string | number): string {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toIsoDate(v: any): string {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
