import * as XLSX from 'xlsx';
import {
  ProductSheetColumn,
  ProductSheetRegistry,
  SheetRowData,
} from '../models/product-sheet/product-sheet.types';

export interface ParsedProductSheet {
  /** Rows keyed by the header text exactly as the file has it (trimmed). */
  rows: SheetRowData[];
  /** Header cells in file order, blanks dropped. */
  headers: string[];
}

export function isSheetFile(fileName: string): boolean {
  return /\.(csv|xlsx|xls)$/i.test(fileName);
}

/**
 * Parse a CSV / Excel file into rows keyed by header text. Every cell is read
 * as text (`raw`): SheetJS would otherwise turn a barcode like 0012345678905
 * into a number and drop its leading zeros. The server parses numbers, yes/no
 * and lists itself. (1:1 with legacy `parseProductSheet`.)
 */
export async function parseProductSheet(file: File): Promise<ParsedProductSheet> {
  const isCsv = /\.csv$/i.test(file.name);
  const workbook = isCsv
    // The export starts with a BOM so Excel reads Arabic; strip it so it
    // doesn't glue itself onto the first header.
    ? XLSX.read((await file.text()).replace(/^\uFEFF/, ''), { type: 'string', raw: true })
    : XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { rows: [], headers: [] };

  const headers = (XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })[0] ?? [])
    .map(cell => String(cell ?? '').trim())
    .filter(cell => cell !== '');

  const rows = XLSX.utils.sheet_to_json<SheetRowData>(sheet, { defval: '', raw: false })
    .map(normaliseRow)
    .filter(row => !isBlank(row));

  return { rows, headers };
}

/** The registry column a file header stands for (null when unknown). Only a
 *  hint for the UI; the server does the real matching. */
export function matchColumn(
  header: string,
  columns: ProductSheetColumn[],
  mapping: Record<string, string> = {},
): ProductSheetColumn | null {
  if (header in mapping) return columns.find(c => c.key === mapping[header]) ?? null;
  const wanted = normaliseHeader(header);
  return columns.find(c =>
    [c.header, c.key, ...(c.aliases ?? [])].some(n => normaliseHeader(n) === wanted),
  ) ?? null;
}

/** Registry columns grouped for pickers, in registry group/column order. */
export function groupColumns(registry: ProductSheetRegistry): { group: string; columns: ProductSheetColumn[] }[] {
  const groups = [...registry.groups];
  registry.columns.filter(c => !groups.includes(c.group)).forEach(c => groups.push(c.group));
  return groups
    .map(group => ({ group, columns: registry.columns.filter(c => c.group === group) }))
    .filter(e => e.columns.length);
}

function normaliseHeader(header: string): string {
  return String(header ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function normaliseRow(row: SheetRowData): SheetRowData {
  const result: SheetRowData = {};
  Object.keys(row).forEach(key => {
    if (key.startsWith('__EMPTY')) return; // blank header cells
    const value = row[key];
    result[key.trim()] = typeof value === 'string' ? value.trim() : value;
  });
  return result;
}

function isBlank(row: SheetRowData): boolean {
  return Object.values(row).every(v => v == null || String(v).trim() === '');
}
