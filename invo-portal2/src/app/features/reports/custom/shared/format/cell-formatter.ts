/**
 * Cell-value formatter — single source of truth for "what string does a
 * column value render as".
 *
 * Mirrors the cell branching that chart-preview uses for its table render:
 *   1. Explicit per-column ColumnFormat override → formatValue() in the
 *      model (number / currency / percent / date / custom).
 *   2. Backend-declared `boolean` type → "Yes" / "No".
 *   3. Backend-declared `date` type → `yyyy-MM-dd [HH:mm]`.
 *   4. Numeric columns (aggregated, declared number, or in the numColumns
 *      set) → branch on `numberFormat`:
 *        - 'currency' → MycurrencyPipe-style (symbol + companyDecimals + thousand sep).
 *        - 'integer'  → integer + thousand sep, no decimals.
 *        - default    → MynumberPipe-style (companyDecimals + thousand sep).
 *   5. Anything else → raw string.
 *
 * Consumers:
 *   - The XLSX / CSV / PDF exporters in report-builder, so the exported
 *     file shows the same `10.000` / `BHD 12.345` / `Yes` / `2026-06-04`
 *     strings the user sees on screen.
 *   - chart-preview can be migrated to use this too (currently has its
 *     own private equivalents); kept separate for now to minimise risk.
 */

import { ColumnFormat, formatValue } from '../models/custom-report.model';
import {
  INTEGER_FIELD_PATTERN,
  fieldNameOf,
} from '../marks/field-patterns';

export interface CellFormatContext {
  /** Per-column format overrides (from the shelf popover). */
  columnFormats: { [key: string]: ColumnFormat };
  /** Backend-declared type per column key ('text' / 'number' / 'date' / 'boolean'). */
  columnTypes: { [key: string]: string };
  /** Backend-declared numberFormat ('currency' / 'decimal' / 'integer'). */
  columnNumberFormats: { [key: string]: string };
  /**
   * Optional override — when chart-preview already computed which keys
   * are numeric (via its `numColumns` set), pass it here so the formatter
   * decisions match the on-screen render exactly.
   */
  numColumns?: Set<string>;
  /** CompanyService.companySettings — for currencySymbol + afterDecimal. */
  companySettings?: any;
}

/** Format a single cell value the same way chart-preview's table render does. */
export function formatCellValue(value: any, key: string, ctx: CellFormatContext): string {
  if (value === null || value === undefined) return '';

  const colFmt = ctx.columnFormats?.[key];
  const declared = ctx.columnTypes?.[key];
  const nf = ctx.columnNumberFormats?.[key];
  const cs = ctx.companySettings;

  if (colFmt && colFmt.type !== 'none') {
    return formatValue(value, colFmt, cs);
  }
  if (declared === 'boolean') return fmtBoolean(value);
  if (declared === 'date')    return fmtDate(value);

  if (isNumericColumn(key, declared, ctx.numColumns)) {
    const num = toNum(value);
    if (nf === 'currency') return fmtCurrency(num, cs);
    if (nf === 'integer')  return fmtInteger(num);
    return fmtNumber(num, cs, key);
  }

  return String(value);
}

// ────────────────────────────────────────────────────────────────────────
// Helpers (internal)
// ────────────────────────────────────────────────────────────────────────

function isNumericColumn(
  key: string,
  declared: string | undefined,
  numColumns?: Set<string>,
): boolean {
  if (numColumns?.has(key)) return true;
  if (!key) return false;
  const prefix = key.split('.')[0];
  if (['sum', 'count', 'avg', 'max', 'min'].includes(prefix)) return true;
  return declared === 'number';
}

function isIntegerColumn(key: string): boolean {
  if (!key) return false;
  const parts = key.split('.');
  const agg = parts.length >= 3 && ['sum', 'count', 'avg', 'max', 'min'].includes(parts[0])
    ? parts[0]
    : '';
  if (agg === 'count') return true;
  return INTEGER_FIELD_PATTERN.test(fieldNameOf(key));
}

function toNum(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[, ]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function fmtBoolean(v: any): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number')  return v ? 'Yes' : 'No';
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return 'Yes';
    if (s === 'false' || s === '0' || s === 'no') return 'No';
  }
  return String(v);
}

function fmtDate(v: any): string {
  if (v === null || v === undefined || v === '') return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const h = d.getHours(), m = d.getMinutes();
  return h === 0 && m === 0 ? date : `${date} ${pad(h)}:${pad(m)}`;
}

function fmtCurrency(num: number, cs: any): string {
  if (isNaN(num)) return '0';
  const decimals: number = cs?.settings?.afterDecimal ?? 3;
  const symbol: string = cs?.settings?.currencySymbol ?? '';
  const fixed = num.toFixed(decimals);
  const [intPart, fracPart] = fixed.split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = fracPart ? `${formatted}.${fracPart}` : formatted;
  return symbol ? `${symbol} ${body}` : body;
}

function fmtInteger(num: number): string {
  if (isNaN(num)) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtNumber(num: number, cs: any, key?: string): string {
  if (isNaN(num)) return '0';
  const decimals: number = key && isIntegerColumn(key)
    ? 0
    : (cs?.settings?.afterDecimal ?? 3);
  const fixed = num.toFixed(decimals);
  const [intPart, fracPart] = fixed.split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart ? `${formatted}.${fracPart}` : formatted;
}
