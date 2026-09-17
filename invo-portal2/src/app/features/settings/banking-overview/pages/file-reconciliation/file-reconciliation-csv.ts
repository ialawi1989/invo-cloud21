// ────────────────────────────────────────────────────────────────────
// Generic file reader for the File Reconciliation tool.
//
// Unlike `shared/components/import-wizard/csv-parser.ts` (which parses
// against a caller-supplied, fixed column schema) this tool has no
// schema up front — the whole point is that the user picks which
// column is the reference / amount / date column AFTER we show them
// the file's own headers. So parsing here just needs to find the
// header row and hand back `{ headers, rows }`.
//
// Accepts CSV/TSV/TXT and Excel (.xlsx / .xls / .ods). Both paths are
// reduced to a plain 2-D grid of strings first, then share the same
// header detection + row building, so any export layout behaves the
// same regardless of format.
// ────────────────────────────────────────────────────────────────────

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/** Value for the file input's `accept` attribute. */
export const RECONCILIATION_FILE_ACCEPT =
  '.csv,.tsv,.txt,.xlsx,.xlsm,.xls,.ods,text/csv,application/vnd.ms-excel,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const EXCEL_EXT = /\.(xlsx|xlsm|xls|ods)$/i;

/** Read any supported file into headers + rows. Excel files go through
 *  SheetJS (lazy-loaded so it stays out of the main bundle); everything
 *  else is treated as delimited text. */
export async function parseReconciliationFile(file: File): Promise<ParsedCsv> {
  if (EXCEL_EXT.test(file.name)) {
    return gridToParsed(await readExcelGrid(file));
  }
  return parseGenericCsv(await file.text());
}

/** Parse `text` (a full CSV file's contents) into headers + rows. */
export function parseGenericCsv(text: string): ParsedCsv {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };

  const delim = pickDelimiter(lines);
  return gridToParsed(lines.map(l => splitLine(l, delim)));
}

// ─── Excel ─────────────────────────────────────────────────────────

async function readExcelGrid(file: File): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });

  // First sheet that actually has data — some exports lead with an
  // empty or cover sheet.
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
      dateNF: 'yyyy-mm-dd hh:mm:ss',
    });
    const cells = grid.map(r => r.map(c => (c == null ? '' : String(c))));
    if (cells.some(r => r.some(c => c.trim()))) return cells;
  }
  return [];
}

// ─── Grid → headers/rows ───────────────────────────────────────────

/** Turns a raw grid into `{headers, rows}`. The header row is detected
 *  rather than assumed to be row 0, because many bank / gateway exports
 *  put a report title, date range or merchant block above the table. */
function gridToParsed(grid: string[][]): ParsedCsv {
  const rowsGrid = grid
    .map(r => r.map(c => (c ?? '').trim()))
    .filter(r => r.some(c => c.length > 0));
  if (!rowsGrid.length) return { headers: [], rows: [] };

  const headerIdx = detectHeaderRow(rowsGrid);
  const headerCells = rowsGrid[headerIdx];
  const body = rowsGrid.slice(headerIdx + 1);

  // Width = widest of header / data, minus trailing columns that have
  // neither a header nor any value.
  let width = body.reduce((w, r) => Math.max(w, r.length), headerCells.length);
  while (width > 0 && !headerCells[width - 1] && body.every(r => !r[width - 1])) width--;

  const headers = dedupeHeaders(Array.from({ length: width }, (_, c) => headerCells[c] ?? ''));

  const rows = body.map(cells => {
    const row: Record<string, string> = {};
    for (let c = 0; c < width; c++) row[headers[c]] = cells[c] ?? '';
    return row;
  });

  return { headers, rows };
}

/** Picks the first row (within the first 30) that looks like a header:
 *  at least half as wide as the widest row in that window (so a
 *  one-cell title line is skipped) and mostly non-numeric text (so a
 *  data row isn't mistaken for headers). Falls back to row 0. */
function detectHeaderRow(grid: string[][]): number {
  const window = grid.slice(0, 30);
  const filled = window.map(r => r.filter(c => c.length > 0).length);
  const maxFilled = Math.max(...filled);
  if (maxFilled <= 1) return 0;

  const minFilled = Math.max(2, Math.ceil(maxFilled * 0.5));
  for (let i = 0; i < window.length; i++) {
    if (filled[i] < minFilled) continue;
    const nonEmpty = window[i].filter(c => c.length > 0);
    const textual = nonEmpty.filter(c => !looksLikeValue(c)).length;
    if (textual / nonEmpty.length >= 0.7) return i;
  }
  return 0;
}

/** Numbers, amounts and dates are data, not header labels. */
function looksLikeValue(cell: string): boolean {
  if (/^[-+]?[\d\s.,]+%?$/.test(cell)) return true;                     // 1,200.50
  if (/^[^\d\s]{1,4}\s?[-+]?[\d,]+(\.\d+)?$/.test(cell)) return true;   // $12.00 / BHD 2.3
  if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(cell)) return true;       // dates
  return false;
}

/** Counts tabs / semicolons / commas across the first few lines and
 *  returns whichever appears most often. Defaults to comma. */
function pickDelimiter(lines: string[]): ',' | '\t' | ';' {
  const sample = lines.slice(0, 5).join('\n');
  let tabs = 0, commas = 0, semis = 0;
  for (const ch of sample) {
    if (ch === '\t') tabs++;
    else if (ch === ',') commas++;
    else if (ch === ';') semis++;
  }
  if (tabs > commas && tabs >= semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

/** Split a single line on `delim`, honouring `"…"` quoting and
 *  RFC-4180-style `""` doubled-quote escapes inside a quoted cell.
 *  Embedded newlines inside quoted cells aren't supported (real-world
 *  exports rarely need it). */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else                                 { inQuotes = !inQuotes; }
      continue;
    }
    if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h, i) => {
    const label = h || `Column ${i + 1}`;
    const count = seen.get(label) ?? 0;
    seen.set(label, count + 1);
    return count === 0 ? label : `${label}_${count + 1}`;
  });
}
