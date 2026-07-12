import { TranslationRow, TranslationStatus } from './translation-api';

/**
 * CSV import/export for the Translation Manager.
 *
 * Export writes source + existing target so a translator can work
 * offline; import reads the `ID` + `Target` columns back and replaces the
 * matching rows' target text. A minimal RFC-4180 parser handles quoted
 * fields, embedded commas, quotes and newlines.
 */

const HEADERS = ['ID', 'Record', 'Field', 'Source', 'Target', 'Status'] as const;

export interface ParsedImport {
  /** Successfully parsed `id → target` replacements. */
  values: { id: string; target: string }[];
  /** Non-fatal issues (unknown ids, blank ids) surfaced in the modal. */
  warnings: string[];
  /** Fatal problems (missing columns, no data) — block the import. */
  errors: string[];
  /** Total data rows seen (excluding header). */
  totalRows: number;
}

function escapeField(value: string): string {
  const v = value ?? '';
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** Serialize rows to a CSV string (with header). */
export function rowsToCsv(rows: TranslationRow[]): string {
  const lines = [HEADERS.join(',')];
  for (const r of rows) {
    lines.push([
      escapeField(r.id),
      escapeField(r.recordLabel),
      escapeField(r.field),
      escapeField(r.source),
      escapeField(r.target),
      escapeField(r.status),
    ].join(','));
  }
  // Prepend a BOM so Excel opens UTF-8 (Arabic) correctly.
  return '﻿' + lines.join('\r\n');
}

/** Trigger a client-side download of `content` as `filename`. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Parse a full CSV document into a 2-D array of fields. */
function parseCsvGrid(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  // Strip a leading BOM if present.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\r') {
      // handled by the \n branch; ignore lone CR
    } else if (ch === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  // Flush trailing field/row (file may not end with a newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Parse an import file against the currently loaded rows. Only `ID` and
 * `Target` are consumed; ids not present in `knownIds` are reported as
 * warnings and skipped so a stale/foreign file can't corrupt the grid.
 */
export function parseImportCsv(text: string, knownIds: Set<string>): ParsedImport {
  const grid = parseCsvGrid(text).filter(r => r.some(c => c.trim() !== ''));
  const warnings: string[] = [];
  const errors: string[] = [];

  if (grid.length === 0) {
    return { values: [], warnings, errors: ['TRANSLATIONS.IMPORT.ERR_EMPTY'], totalRows: 0 };
  }

  const header = grid[0].map(h => h.trim().toLowerCase());
  const idCol = header.indexOf('id');
  const targetCol = header.indexOf('target');
  if (idCol === -1 || targetCol === -1) {
    return { values: [], warnings, errors: ['TRANSLATIONS.IMPORT.ERR_COLUMNS'], totalRows: 0 };
  }

  const values: { id: string; target: string }[] = [];
  const seen = new Set<string>();
  const dataRows = grid.slice(1);

  for (const cells of dataRows) {
    const id = (cells[idCol] ?? '').trim();
    if (!id) { warnings.push('TRANSLATIONS.IMPORT.WARN_BLANK_ID'); continue; }
    if (!knownIds.has(id)) { warnings.push(id); continue; }
    if (seen.has(id)) continue;
    seen.add(id);
    values.push({ id, target: cells[targetCol] ?? '' });
  }

  if (values.length === 0 && errors.length === 0) {
    errors.push('TRANSLATIONS.IMPORT.ERR_NO_MATCH');
  }

  return { values, warnings, errors, totalRows: dataRows.length };
}

export function statusLabelKey(status: TranslationStatus): string {
  switch (status) {
    case 'translated':    return 'TRANSLATIONS.STATUS.TRANSLATED';
    case 'needs-update':  return 'TRANSLATIONS.STATUS.NEEDS_UPDATE';
    default:              return 'TRANSLATIONS.STATUS.NOT_TRANSLATED';
  }
}
