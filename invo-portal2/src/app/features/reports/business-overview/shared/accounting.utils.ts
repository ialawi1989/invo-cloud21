/**
 * Pure accounting helpers shared by the Business Overview reports.
 * Typed port of InvoCloudFront2's `ReportCalculationUtils` (same semantics).
 *
 * Backend row shape: `summary` is an array of single-key objects, one per
 * comparison column — `[{ "2025": 120 }, { "2024": 90 }]`, or with sub-columns
 * `[{ "2025": { "Net Debit": 5, "Net Credit": 0 } }]`.
 */

export type SummaryItem = Record<string, number | Record<string, number>>;

export interface ReportRecord {
  account?: string;
  code?: string;
  accountId?: string;
  parentId?: string;
  type?: string;
  parentType?: string;
  level?: number;
  summary?: SummaryItem[];
  [k: string]: any;
}

export type ColumnTotals = Record<string, number>;

export interface TypeGroup { type: string; childs: ReportRecord[]; }
export interface ParentGroup { parentType: string; childs: TypeGroup[]; total: ColumnTotals; }

/** A level-1 account plus its level-2 children (the 2-level tree). */
export interface AccountGroupRow {
  anchor: ReportRecord;
  children: ReportRecord[];
  hasChildren: boolean;
  /** Per column: anchor's own value + children (the collapsed total). */
  header: ColumnTotals;
}

const num = (v: unknown): number => (typeof v === 'number' && !isNaN(v) ? v : 0);

export function summaryValue(summary: SummaryItem[] | null | undefined, column: string): number {
  if (!Array.isArray(summary)) return 0;
  const item = summary.find(s => Object.prototype.hasOwnProperty.call(s, column));
  return item ? num(item[column]) : 0;
}

export function summarySubValue(
  summary: SummaryItem[] | null | undefined, column: string, sub: string,
): number {
  if (!Array.isArray(summary)) return 0;
  const item = summary.find(s => Object.prototype.hasOwnProperty.call(s, column));
  const v = item?.[column];
  return v && typeof v === 'object' ? num(v[sub]) : 0;
}

/** Sum a values object across the given columns. */
export function sumColumns(values: ColumnTotals | null | undefined, columns: string[]): number {
  if (!values) return 0;
  return columns.reduce((t, c) => t + num(values[c]), 0);
}

/** Row total across all columns (the trailing "Total" cell). */
export function rowTotal(summary: SummaryItem[] | null | undefined, columns: string[]): number {
  return columns.reduce((t, c) => t + summaryValue(summary, c), 0);
}

/** Make every record carry a summary entry for every column (0 / zeroed sub-columns). */
export function fillMissingColumns(records: ReportRecord[], columns: string[], subColumns: string[] = []): void {
  for (const r of records) {
    if (!Array.isArray(r.summary)) r.summary = [];
    for (const c of columns) {
      if (r.summary.some(s => Object.prototype.hasOwnProperty.call(s, c))) continue;
      r.summary.push({
        [c]: subColumns.length ? Object.fromEntries(subColumns.map(s => [s, 0])) : 0,
      });
    }
  }
}

/** Sum of every record's summary, per column. */
export function totalsOf(records: ReportRecord[], columns: string[]): ColumnTotals {
  const t: ColumnTotals = Object.fromEntries(columns.map(c => [c, 0]));
  for (const r of records) for (const c of columns) t[c] += summaryValue(r.summary, c);
  return t;
}

export function totalsOfParentType(records: ReportRecord[], parentType: string | string[], columns: string[]): ColumnTotals {
  const types = Array.isArray(parentType) ? parentType : [parentType];
  return totalsOf(records.filter(r => r.parentType != null && types.includes(r.parentType)), columns);
}

/** Totals with sub-columns: `{ column: { sub: n } }`. */
export function totalsWithSub(
  records: ReportRecord[], columns: string[], subColumns: string[],
): Record<string, Record<string, number>> {
  const t: Record<string, Record<string, number>> = {};
  for (const c of columns) {
    t[c] = {};
    for (const s of subColumns) t[c][s] = records.reduce((a, r) => a + summarySubValue(r.summary, c, s), 0);
  }
  return t;
}

/** parentType → type → accounts, ordered by `sectionOrder` (unknown sections last, stable). */
export function groupByParentType(records: ReportRecord[], columns: string[], sectionOrder: string[]): ParentGroup[] {
  const parents = new Map<string, ReportRecord[]>();
  for (const r of records ?? []) {
    const k = r?.parentType ?? 'Unknown';
    (parents.get(k) ?? parents.set(k, []).get(k)!).push(r);
  }
  const groups: ParentGroup[] = [...parents].map(([parentType, rows]) => {
    const types = new Map<string, ReportRecord[]>();
    for (const r of rows) {
      const k = r.type ?? 'Unknown';
      (types.get(k) ?? types.set(k, []).get(k)!).push(r);
    }
    return {
      parentType,
      childs: [...types].map(([type, childs]) => ({ type, childs })),
      total: totalsOf(rows, columns),
    };
  });
  const rank = (k: string) => { const i = sectionOrder.indexOf(k); return i < 0 ? sectionOrder.length : i; };
  return groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => rank(a.g.parentType) - rank(b.g.parentType) || a.i - b.i)
    .map(x => x.g);
}

/**
 * Fold a flat account list into parent → child groups. A level-1 row anchors a
 * group; level-2 rows join the group whose anchor `accountId` equals their
 * `parentId`. Id-less standalone rows (Retained Earning, Net Profit) never merge.
 */
export function groupByAnchor(childs: ReportRecord[], columns: string[]): AccountGroupRow[] {
  if (!childs?.length) return [];
  const has = (v: unknown) => v !== undefined && v !== null && v !== '';
  const keyOf = (r: ReportRecord, i: number): string => {
    const level = Number(r.level);
    if (level === 1 && has(r.accountId)) return String(r.accountId);
    if (level === 2 && has(r.parentId)) return String(r.parentId);
    if (has(r.parentId)) return String(r.parentId);
    if (has(r.accountId)) return String(r.accountId);
    return '__standalone_' + i;
  };
  const groups = new Map<string, ReportRecord[]>();
  childs.forEach((r, i) => {
    const k = keyOf(r, i);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  });
  return [...groups].map(([key, members]) => {
    const anchor =
      members.find(m => Number(m.level) === 1) ?? members.find(m => m.accountId === key) ?? members[0];
    const children = members.filter(m => m !== anchor);
    const header: ColumnTotals = {};
    for (const c of columns) {
      header[c] = summaryValue(anchor.summary, c) + children.reduce((a, m) => a + summaryValue(m.summary, c), 0);
    }
    return { anchor, children, hasChildren: children.length > 0, header };
  });
}

/** Stable key for an anchor group (collapse state, trackBy). */
export function groupKey(g: AccountGroupRow, index = 0): string {
  return String(g.anchor.accountId || g.anchor.account || index);
}

/** A row may drill into Account Journals only when it has a real accountId. */
export const canDrillDown = (r: { accountId?: string } | null | undefined): boolean => !!r?.accountId;


// ─── Profit & Loss derived lines ─────────────────────────────────────────────

export interface ProfitLines {
  income: ColumnTotals;
  cogs: ColumnTotals;
  gross: ColumnTotals;
  expenses: ColumnTotals;
  operating: ColumnTotals;
  net: ColumnTotals;
}

/** Values above this are treated as a corrupt/overflowed API total (legacy guard). */
export const OVERFLOW_LIMIT = 1e15;

/**
 * The profit lines. Gross and Operating profit are the backend's own
 * 'Gross Profit' / 'Operating Profit' rows whenever the response has them — the
 * same rows the table shows, so a summary tile can never disagree with the
 * table. Only when a row is absent are they derived: Gross = Income − |COGS|,
 * Operating = Gross − |Operating Expense|.
 *
 * Net profit is the API's 'Equity' total when it carries real data, otherwise
 * Operating (legacy computeNetProfit, which also falls back when the API
 * value looks overflowed).
 */
export function computeProfitLines(records: ReportRecord[], columns: string[]): ProfitLines {
  const income = totalsOfParentType(records, 'Operating Income', columns);
  const cogs = totalsOfParentType(records, 'Costs Of Goods Sold', columns);
  const expenses = totalsOfParentType(records, 'Operating Expense', columns);
  const equity = totalsOfParentType(records, 'Equity', columns);
  const apiLine = (type: string): ColumnTotals | null =>
    records.some(r => r.parentType === type) ? totalsOfParentType(records, type, columns) : null;

  const derivedGross: ColumnTotals = {};
  const derivedOperating: ColumnTotals = {};
  for (const c of columns) {
    derivedGross[c] = (income[c] || 0) - Math.abs(cogs[c] || 0);
    derivedOperating[c] = derivedGross[c] - Math.abs(expenses[c] || 0);
  }
  const gross = apiLine('Gross Profit') ?? derivedGross;
  const operating = apiLine('Operating Profit') ?? derivedOperating;

  const hasEquity = columns.some(c => equity[c] !== 0);
  const overflow = columns.some(c => Math.abs(equity[c] || 0) > OVERFLOW_LIMIT);
  const net = hasEquity && !overflow ? equity : operating;
  return { income, cogs, gross, expenses, operating, net };
}

/**
 * Short label for a "jump to period" chip: "Mar/2026" → "Mar 26". Years ("2025")
 * and branch names are kept, trimmed to 12 characters with an ellipsis.
 */
export function periodChipLabel(p: string): string {
  const m = /^([A-Za-z]{3,9})\/(\d{4})$/.exec(p);
  if (m) return `${m[1].slice(0, 3)} ${m[2].slice(2)}`;
  return p.length > 12 ? p.slice(0, 11) + '…' : p;
}

/**
 * Column header text: "Mar/2026" → "Mar 2026" (years, branch names and the fixed
 * columns are returned unchanged).
 */
export function periodHeaderLabel(p: string): string {
  return /^[A-Za-z]{3,9}\/\d{4}$/.test(p) ? p.replace('/', ' ') : p;
}
