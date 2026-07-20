/* ═══ Backend-aligned interfaces ═══ */

/** Data source field from GET /getDataSource */
export interface DataSourceField {
  id: string;
  label: string;
  // `type` is whatever the backend declares for this column. Common values
  // observed: 'text' | 'number' | 'date' | 'boolean'. We type it loosely so
  // unfamiliar values don't fail TS checks while still letting the UI key
  // off the well-known ones.
  type: string;
  /**
   * Sub-classification for numeric columns. Drives the table cell renderer:
   *  - 'currency' → MycurrencyPipe (symbol + companyDecimals + thousand sep)
   *  - 'decimal'  → MynumberPipe (companyDecimals + thousand sep)
   *  - 'integer'  → raw integer with thousand sep, no decimals
   * Undefined falls back to the existing default (companyDecimals).
   */
  numberFormat?: string;
}

/**
 * A relationship pointer from a table's `refs[]` in GET /getDataSource.
 *
 * Observed runtime shape:
 *   { name: <relatedTable>, source: <fkColumn>, target: <pkColumn> }
 * `name` is the related TABLE; `source` is the FK COLUMN on the table that OWNS
 * this refs[] entry; `target` is the PK COLUMN on `name` (usually "id"). So a
 * ref on InvoiceView of
 *   { name: "CustomerView", source: "customerId", target: "id" }
 * means InvoiceView.customerId = CustomerView.id. The entry carries BOTH join
 * columns directly — no external column lookup is needed.
 */
export interface DataSourceRef {
  name: string;          // related table the FK points at
  source: string;        // FK column on the table that owns this refs[] entry
  target: string;        // PK column on the related table (usually "id")
  id?: number | string;  // ref id (dedupe / list key)
}

/** Data source table from GET /getDataSource */
export interface DataSourceTable {
  id: string;
  label: string;
  data: DataSourceField[];
  refs?: DataSourceRef[];  // relationship pointers (table names, not columns)
  formulas?: ReportFormula[]; // predefined calculated fields (filter-only)
}

/** Flattened field for UI usage */
export interface FlatField extends DataSourceField {
  table: string;
  fullId: string; // "Table.fieldId" — or "Table.@formulaKey" for formula fields
  /** True when this field is a predefined formula (calculated field) rather
   *  than a real column. Formula fields can only be used in filters; their
   *  SQL expression lives on the backend and is never sent to/from the client. */
  isFormula?: boolean;
}

/**
 * A predefined formula (calculated field) exposed by a data source. The SQL
 * expression is intentionally NOT part of this shape — it is administrator-
 * controlled backend metadata, resolved server-side by `key`. The client only
 * ever sees `key`, `name` and `type`, and only ever sends back the `key`
 * (flagged via `FilterRule.isFormula`). See docs/custom-reports-backend-api.md.
 */
export interface ReportFormula {
  key: string;            // internal key, e.g. "daysToExpire"
  name: string;           // display name, e.g. "Days to Expiry"
  type: string;           // 'number' | 'text' | 'date'
  numberFormat?: string;  // optional display hint for numeric formulas
}

/** Column format options */
export interface ColumnFormat {
  type: 'none' | 'number' | 'currency' | 'percent' | 'date' | 'custom';
  decimals?: number;         // decimal places (default 0)
  currency?: string;         // currency code e.g. "USD", "SAR", "EUR"
  dateFormat?: string;       // e.g. "dd/MM/yyyy", "MMM dd, yyyy"
  prefix?: string;           // custom prefix e.g. "$"
  suffix?: string;           // custom suffix e.g. " kg"
  thousandSep?: boolean;     // thousand separator (default true)
}

/** Add thousand separators to a number string (same logic as MynumberPipe) */
function addThousandSep(num: string): string {
  const [intPart, fracPart] = num.split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart ? `${formatted}.${fracPart}` : formatted;
}

/** Parse any value to number (handles comma-formatted strings) */
function toNum(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseFloat(v.replace(/[, ]/g, '')); return isNaN(n) ? 0 : n; }
  return 0;
}

/**
 * Format a value using ColumnFormat.
 * Uses the same logic as MynumberPipe and MycurrencyPipe:
 * - Reads CompanyService.companySettings for afterDecimal and currencySymbol
 * - Falls back to fmt overrides if provided
 *
 * @param val - raw value
 * @param fmt - column format config
 * @param companySettings - optional, pass CompanyService.companySettings
 */
export function formatValue(val: any, fmt: ColumnFormat | undefined, companySettings?: any): string {
  if (!fmt || fmt.type === 'none') return String(val ?? '');

  // Company defaults (same as MynumberPipe/MycurrencyPipe)
  const companyDecimals: number = companySettings?.settings?.afterDecimal ?? 3;
  const companySymbol: string = companySettings?.settings?.currencySymbol ?? '';

  if (fmt.type === 'number') {
    const num = toNum(val);
    const decimals = fmt.decimals ?? companyDecimals;
    const formatted = addThousandSep(num.toFixed(decimals));
    return (fmt.prefix || '') + formatted + (fmt.suffix || '');
  }

  if (fmt.type === 'currency') {
    const num = toNum(val);
    const decimals = fmt.decimals ?? companyDecimals;
    const symbol = fmt.currency || companySymbol || 'USD';
    return symbol + ' ' + addThousandSep(num.toFixed(decimals));
  }

  if (fmt.type === 'percent') {
    const num = toNum(val);
    const decimals = fmt.decimals ?? 1;
    return addThousandSep(num.toFixed(decimals)) + '%';
  }

  if (fmt.type === 'date') {
    if (!val) return '';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      const pattern = fmt.dateFormat || 'yyyy-MM-dd';
      const pad = (n: number) => String(n).padStart(2, '0');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return pattern
        .replace('yyyy', String(d.getFullYear()))
        .replace('MM', pad(d.getMonth() + 1))
        .replace('MMM', months[d.getMonth()])
        .replace('dd', pad(d.getDate()))
        .replace('HH', pad(d.getHours()))
        .replace('mm', pad(d.getMinutes()))
        .replace('ss', pad(d.getSeconds()));
    } catch { return String(val); }
  }

  if (fmt.type === 'custom') {
    return (fmt.prefix || '') + String(val ?? '') + (fmt.suffix || '');
  }

  return String(val ?? '');
}

/** Column in builder state */
export interface ReportColumn {
  col: string;       // "Table.field"
  agg: string;       // "sum" | "count" | "avg" | "max" | "min" | ""
  datePart: string;  // "day" | "month" | "year" | "yearmonth" | "yearmonthday" | ""
  key: string;       // unique key for tracking
  hidden?: boolean;  // column visibility toggle
  alias?: string;    // custom display name for column header
  format?: ColumnFormat; // display formatter
}

/**
 * Join definition matching backend {sid, tid, sf, tf, type}. The backend
 * renders each join as:
 *     <type> JOIN "<tid>" ON "<sid>"."<sf>" = "<tid>"."<tf>"
 * so `tid` is the table being joined IN and `sid` a table already present;
 * `sf`/`tf` are bare column names (no table prefix). Both default to "id"
 * backend-side, but "id" = "id" virtually never matches — always send the
 * real FK/PK columns (see `buildReportJoin` in shared/relations/join-map.ts).
 */
export interface ReportJoin {
  sid: string;   // already-present table (also the SQL alias on the ON's left)
  tid: string;   // table being joined in
  sf: string;    // column on the sid table
  tf: string;    // column on the tid table
  type?: string; // join type: LEFT, RIGHT, INNER, FULL
}

export const JOIN_TYPES = [
  { value: 'LEFT', label: 'Left Join' },
  { value: 'RIGHT', label: 'Right Join' },
  { value: 'INNER', label: 'Inner Join' },
  { value: 'FULL', label: 'Full Join' },
];

/** Filter rule matching backend query format */
export interface FilterRule {
  field: string;
  type: string;
  condition: {
    type: string; // equal, notEqual, contains, beginsWith, endsWith, greater, less, greaterOrEqual, lessOrEqual, between
    filter: string | { start: string; end: string }; // FIX: between uses object {start, end}
  };
  includes: any[];
  /**
   * True when `field` references a predefined formula (calculated field)
   * instead of a real `Table.column`. The backend resolves the formula's SQL
   * expression by key (the segment after the `@` in `field`, e.g.
   * "SalesView.@daysToExpire" → key "daysToExpire") and substitutes it in
   * place of the column reference. The value is still parameterized.
   */
  isFormula?: boolean;
}

/** Sort rule matching backend */
export interface SortRule {
  id: string;   // "Table.col"
  mod: 'ASC' | 'DESC';
}

/** Saved module from GET /modules/getModules */
export interface SavedModule {
  id: string;
  name: string;
  text: string; // JSON.stringify({ data, columns, group, joins })
}

/** Parsed module text */
export interface ModuleConfig {
  data: string;
  columns: string[];
  group: string[];
  joins: ReportJoin[];
}

/** Saved query from GET /queries/getQueries */
export interface SavedQuery {
  id: string;
  name: string;
  text: string; // JSON.stringify({ glue, rules })
}

/** Parsed query text */
export interface QueryConfig {
  glue: string; // " AND " | " OR "
  rules: FilterRule[];
}

/** POST /getCustomizedReport request body */
export interface CustomReportRequest {
  query?: any;
  tableName: string;
  columns: string[];
  joins: ReportJoin[];
  sort: SortRule[];
  group: string[];
  buckets?: any[];
  /**
   * Display grouping field for the Group by shelf (distinct from `group[]`,
   * which is the aggregate SQL GROUP BY). When present the backend returns
   * detail rows bucketed into groups with per-group subtotals. Single
   * fully-qualified column; never a formula. Omitted when no group-by is set.
   */
  groupBy?: string;
  /**
   * Page size. `null` means "no limit" — the service sends an empty
   * `limit` field so the backend returns every row. Omitting the property
   * keeps the existing default (30) behaviour.
   */
  limit?: number | null;
  offset?: number;
}

/** Snapshot for undo/redo (legacy) */
export interface BuilderSnapshot {
  columns: ReportColumn[];
  joins: ReportJoin[];
  filterRules: FilterRule[];
  groupBy: string[];
  sortBy: SortRule[];
  chartType: string;
  primaryTable: string;
}

/* ═══ Tableau-like V2 interfaces ═══ */

export type ShelfType = 'rows' | 'columns' | 'filters';
export type MarkChannel = 'color' | 'size' | 'shape' | 'label';
export type BuilderMode = 'edit' | 'view';

/** Mark encoding — a field dropped onto a mark channel */
export interface MarkEncoding {
  channel: MarkChannel;
  field: ReportColumn;
}

/** Calculated field operation types */
export type CalcOperator = '+' | '-' | '*' | '/' | '%' | 'concat';

/** A single operand in a calculated field expression */
export interface CalcOperand {
  type: 'field' | 'constant';
  value: string;           // field key (e.g. "InvoiceView.amount") or literal value
  operator?: CalcOperator; // operator BEFORE this operand (ignored for first operand)
}

/** Aggregate function for summary mode */
export type CalcAggFunc = 'sum' | 'avg' | 'min' | 'max' | 'count';

/** Calculated field definition */
export interface CalculatedField {
  id: string;
  name: string;
  mode: 'math' | 'concat' | 'summary';
  operands: CalcOperand[];
  separator?: string;       // for concat
  aggFunc?: CalcAggFunc;    // for summary mode
  resultType: 'text' | 'number';
}

/**
 * Coerce numeric measure columns from string to number (mutates rows in place).
 *
 * The /getCustomizedReport backend handler stringifies every number through a
 * JSON.stringify replacer to preserve precision (see
 * docs/custom-reports-backend-api.md endpoint #2). That means `sum.X.Y`,
 * `count.X.Y`, `avg.X.Y`, `min.X.Y`, `max.X.Y` arrive as strings like
 * `"125.50"`. Without coercion, client-side sort/compare/aggregation
 * silently misbehaves (lex order, string concat, etc.).
 *
 * Only keys with a known aggregate prefix are coerced — plain columns like
 * `SalesView.documentNumber = "INV-001"` and date parts like
 * `yearmonth.X.Y = "2026-05"` stay as strings.
 */
const MEASURE_PREFIX_RE = /^(sum|count|avg|max|min)\./;
export function coerceNumericMeasures(rows: any[]): any[] {
  if (!Array.isArray(rows)) return rows;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) {
      if (MEASURE_PREFIX_RE.test(key) && typeof row[key] === 'string') {
        const n = parseFloat(row[key]);
        if (!isNaN(n)) row[key] = n;
      }
    }
  }
  return rows;
}

/**
 * Full numeric coercion using the sheet's shelf metadata + field schema.
 *
 * The backend's `getCustomizedReport` response stringifies every number (see
 * docs/custom-reports-backend-api.md) to preserve precision.
 * `coerceNumericMeasures` only handles aggregation prefixes (`sum.*`,
 * `count.*`, …). This wider pass also coerces plain numeric columns by
 * consulting:
 *   - the column's aggregation/date-part prefix (always coerce aggregated keys);
 *   - the column's `numberFormat` hint when set (currency / decimal / integer);
 *   - the column's declared field type from `getDataSource`.
 *
 * Identifier-style fields (barcode, sku, phone, …) and boolean fields stay
 * as strings — they happen to parse as numbers but must not be coerced.
 *
 * `fieldsByFullId` maps `Table.fieldId` → backend field meta. Pass the
 * already-flattened `allFields` from report-builder.
 */
import { classifyColumnKey } from '../marks/field-classifier';

export function coerceNumericRows(
  rows: any[],
  sheet: SheetConfig | null | undefined,
  fieldsByFullId: { [fullId: string]: { type?: string; numberFormat?: string; id?: string } } = {},
): any[] {
  if (!Array.isArray(rows) || rows.length === 0 || !sheet) return rows;

  const dataKeys = Object.keys(rows[0] || {});
  if (dataKeys.length === 0) return rows;

  // Build a `fields[]` shape the classifier accepts — id is the tail of the
  // fullId so plain-column lookups in the classifier resolve correctly.
  const fields: { id?: string; type?: string; numberFormat?: string }[] = [];
  for (const fullId of Object.keys(fieldsByFullId)) {
    const tail = fullId.split('.').pop();
    fields.push({ id: tail, ...fieldsByFullId[fullId] });
  }

  // Per-key decision: coerce or skip. Cached so we don't reclassify per row.
  const coerceKey: { [key: string]: boolean } = {};
  for (const key of dataKeys) {
    const cls = classifyColumnKey(key, fields);
    coerceKey[key] = cls.role === 'measure'
      && (cls.subtype === 'number' || cls.subtype === 'integer');
  }

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const key of dataKeys) {
      if (!coerceKey[key]) continue;
      const v = row[key];
      if (typeof v === 'string' && v !== '') {
        const n = parseFloat(v);
        if (!isNaN(n)) row[key] = n;
      }
    }
  }
  return rows;
}

/** Apply calculated fields to data rows (mutates rows in place) */
export function applyCalculatedFields(rows: any[], fields: CalculatedField[]): void {
  if (!fields.length || !rows.length) return;

  const toNum = (v: any): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') { const n = parseFloat(v.replace(/[, ]/g, '')); return isNaN(n) ? 0 : n; }
    return 0;
  };

  // Helper: evaluate a math expression for a single row
  const evalExpr = (row: any, operands: CalcOperand[]): number => {
    let result = toNum(operands[0].type === 'field' ? row[operands[0].value] : operands[0].value);
    for (let i = 1; i < operands.length; i++) {
      const op = operands[i].operator || '+';
      const num = toNum(operands[i].type === 'field' ? row[operands[i].value] : operands[i].value);
      switch (op) {
        case '+': result += num; break;
        case '-': result -= num; break;
        case '*': result *= num; break;
        case '/': result = num !== 0 ? result / num : 0; break;
        case '%': result = num !== 0 ? (result / num) * 100 : 0; break;
      }
    }
    return result;
  };

  // Pre-compute summary fields: evaluate expression per row, then aggregate
  for (const cf of fields) {
    if (cf.mode !== 'summary') continue;
    if (!cf.operands.length || !cf.operands[0].value) continue;
    const func = cf.aggFunc || 'sum';
    const perRow = rows.map(r => evalExpr(r, cf.operands));
    let result = 0;
    switch (func) {
      case 'sum': result = perRow.reduce((s, n) => s + n, 0); break;
      case 'avg': result = perRow.length > 0 ? perRow.reduce((s, n) => s + n, 0) / perRow.length : 0; break;
      case 'min': result = perRow.length > 0 ? Math.min(...perRow) : 0; break;
      case 'max': result = perRow.length > 0 ? Math.max(...perRow) : 0; break;
      case 'count': result = perRow.length; break;
    }
    const rounded = Math.round(result * 100) / 100;
    for (const row of rows) {
      row[cf.id] = rounded;
    }
  }

  // Apply row-level fields (math & concat)
  for (const row of rows) {
    for (const cf of fields) {
      if (cf.mode === 'summary') continue; // already done above

      if (cf.mode === 'concat') {
        const rawVals = cf.operands.map(op =>
          op.type === 'field' ? row[op.value] : op.value
        );
        row[cf.id] = rawVals.map(v => v ?? '').join(cf.separator ?? ' ');
      } else {
        row[cf.id] = Math.round(evalExpr(row, cf.operands) * 100) / 100;
      }
    }
  }
}

/** A single sheet with its own configuration */
export interface SheetConfig {
  id: string;
  name: string;
  primaryTable: string;
  joins: ReportJoin[];
  rowsShelf: ReportColumn[];      // Y-axis fields
  columnsShelf: ReportColumn[];   // X-axis fields
  marks: MarkEncoding[];
  filterRules: FilterRule[];
  filterGlue: string;
  sortBy: SortRule[];
  chartType: string;
  showLabels: boolean;
  pageSize: number;
  currentPage: number;
  calculatedFields: CalculatedField[];
  /**
   * Display grouping field ("Table.field") for the Group by shelf. When set
   * (Table chart only) the backend returns a grouped response — detail rows
   * organised into groups with per-group subtotals — rather than collapsing
   * rows like the aggregate `group[]`. Single field; never a formula.
   */
  groupBy?: string;
}

/** Dashboard sheet placement in the grid */
export interface DashboardSheet {
  sheetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Dashboard combining multiple sheets */
export interface DashboardConfig {
  id: string;
  name: string;
  sheets: DashboardSheet[];
  globalFilters: FilterRule[];
  globalFilterGlue: string;
}

/** V2 report config (saved in module.text) */
export interface ReportConfig {
  version: 2;
  type: 'sheet' | 'dashboard';
  activeSheetId: string;
  sheets: SheetConfig[];
  dashboard?: DashboardConfig;
}

/** V2 snapshot for undo/redo */
export interface BuilderSnapshotV2 {
  sheets: SheetConfig[];
  activeSheetId: string;
  dashboard?: DashboardConfig;
  mode: BuilderMode;
}

/** Create a default empty sheet */
export function createDefaultSheet(primaryTable: string, name = 'Sheet 1'): SheetConfig {
  return {
    id: 'sheet-' + Date.now(),
    name,
    primaryTable,
    joins: [],
    rowsShelf: [],
    columnsShelf: [],
    marks: [],
    filterRules: [],
    filterGlue: ' AND ',
    sortBy: [],
    chartType: 'table',
    showLabels: true,
    pageSize: 25,
    currentPage: 1,
    calculatedFields: [],
  };
}

/** Convert shelves + marks to backend API params */
export function shelvesToApiParams(sheet: SheetConfig): { columns: string[]; groupBy: string[] } {
  const allCols = [...sheet.columnsShelf, ...sheet.rowsShelf, ...sheet.marks.map(m => m.field)];
  // Deduplicate by col key
  const seen = new Set<string>();
  const dedupedCols: ReportColumn[] = [];
  for (const c of allCols) {
    const id = (c.agg || c.datePart || '') + '.' + c.col;
    if (!seen.has(id)) {
      seen.add(id);
      dedupedCols.push(c);
    }
  }

  // A formula column carries an `@` marker on its leaf segment (Table.@key) —
  // the only signal the backend uses to resolve it. COUNT never applies to a
  // formula (the backend's count is always COUNT(*)), so a `count` agg on a
  // formula is normalised to a plain projection.
  const isFormulaCol = (col: string) => (col.split('.').pop() || '').startsWith('@');
  const effectiveAgg = (c: ReportColumn) =>
    (isFormulaCol(c.col) && c.agg === 'count') ? '' : (c.agg || '');
  const keyOf = (c: ReportColumn) => {
    if (c.datePart) return c.datePart + '.' + c.col;
    const agg = effectiveAgg(c);
    return agg ? agg + '.' + c.col : c.col;
  };

  const columns = dedupedCols.map(keyOf);

  // Postgres requires every non-aggregated projection — plain columns, date
  // parts AND un-aggregated formula columns — in GROUP BY once any aggregate
  // is present.
  const hasMeasure = dedupedCols.some(c => !!effectiveAgg(c));
  const groupBy = hasMeasure
    ? dedupedCols.filter(c => !effectiveAgg(c)).map(keyOf)
    : [];

  return { columns, groupBy };
}

/**
 * Flatten a sheet's joined tables into FlatField[] (real columns + predefined
 * formula fields), matching the builder's rebuildDerived(). Shared so any
 * consumer (builder, dashboard widget) derives identical field metadata.
 */
export function flattenSheetFields(dataSources: DataSourceTable[], sheet: SheetConfig): FlatField[] {
  const joinedTableIds = [sheet.primaryTable, ...sheet.joins.map(j => j.tid)];
  return joinedTableIds.flatMap(tid => {
    const t = dataSources.find(x => x.id === tid);
    if (!t) return [];
    const cols: FlatField[] = t.data.map(f => ({ ...f, table: t.id, fullId: t.id + '.' + f.id }));
    const formulas: FlatField[] = (t.formulas || []).map(fm => ({
      id: '@' + fm.key,
      label: fm.name,
      type: fm.type,
      numberFormat: fm.numberFormat,
      table: t.id,
      fullId: t.id + '.@' + fm.key,
      isFormula: true,
    }));
    return [...cols, ...formulas];
  });
}

/** Derived column metadata consumed by chart-preview. */
export interface ColumnMeta {
  columnLabels: { [key: string]: string };
  columnFormats: { [key: string]: ColumnFormat };
  columnTypes: { [key: string]: string };
  columnNumberFormats: { [key: string]: string };
  orderedColumns: string[];
}

/**
 * Compute the column metadata (labels, formats, types, number formats, order)
 * that chart-preview needs to render currency, grouping headers and column
 * order exactly as the builder does. Pure function of (sheet, allFields).
 */
export function buildColumnMeta(sheet: SheetConfig, allFields: FlatField[]): ColumnMeta {
  const allCols: ReportColumn[] = [...sheet.columnsShelf, ...sheet.rowsShelf, ...sheet.marks.map(m => m.field)];

  const formulaLabel = (fullId: string): string => {
    const f = allFields.find(x => x.fullId === fullId && x.isFormula);
    if (f) return f.label;
    const leaf = fullId.split('.').pop() || fullId;
    return leaf.startsWith('@') ? leaf.slice(1) : leaf;
  };

  // Labels (aliases / formula names)
  const labels: { [key: string]: string } = {};
  for (const c of allCols) {
    const isFormula = (c.col.split('.').pop() || '').startsWith('@');
    const agg = (isFormula && c.agg === 'count') ? '' : c.agg;
    let backendKey = c.col;
    if (c.datePart) backendKey = c.datePart + '.' + c.col;
    else if (agg) backendKey = agg + '.' + c.col;
    if (c.alias) {
      labels[backendKey] = c.alias;
    } else if (isFormula) {
      const fname = formulaLabel(c.col);
      labels[backendKey] = agg ? agg.toUpperCase() + '(' + fname + ')'
        : c.datePart ? c.datePart + '(' + fname + ')'
        : fname;
    }
  }
  if (sheet.calculatedFields) {
    for (const cf of sheet.calculatedFields) labels[cf.id] = cf.name;
  }

  // Explicit per-column formats
  const formats: { [key: string]: ColumnFormat } = {};
  for (const c of allCols) {
    if (c.format && c.format.type !== 'none') {
      let backendKey = c.col;
      if (c.datePart) backendKey = c.datePart + '.' + c.col;
      else if (c.agg) backendKey = c.agg + '.' + c.col;
      formats[backendKey] = c.format;
    }
  }

  // Types + number formats (inherited from the underlying field)
  const types: { [key: string]: string } = {};
  const numberFormats: { [key: string]: string } = {};
  for (const c of allCols) {
    const field = allFields.find(f => f.fullId === c.col);
    const declaredType = field?.type || 'text';
    const declaredNumberFormat = (field as any)?.numberFormat;
    if (c.agg) {
      const key = c.agg + '.' + c.col;
      types[key] = 'number';
      if (c.agg === 'count') numberFormats[key] = 'integer';
      else if (declaredNumberFormat) numberFormats[key] = declaredNumberFormat;
    } else if (c.datePart) {
      types[c.datePart + '.' + c.col] = 'text';
    } else {
      types[c.col] = declaredType;
      if (declaredType === 'number' && declaredNumberFormat) numberFormats[c.col] = declaredNumberFormat;
    }
  }
  if (sheet.calculatedFields) {
    for (const cf of sheet.calculatedFields) types[cf.id] = 'number';
  }

  // Ordered keys: columns, rows, marks, then calculated
  const orderedColumns = allCols.map(c => {
    if (c.datePart) return c.datePart + '.' + c.col;
    if (c.agg) return c.agg + '.' + c.col;
    return c.col;
  });
  if (sheet.calculatedFields) {
    for (const cf of sheet.calculatedFields) orderedColumns.push(cf.id);
  }

  return { columnLabels: labels, columnFormats: formats, columnTypes: types, columnNumberFormats: numberFormats, orderedColumns };
}

/** Parse a legacy column id ("sum.Table.col" / "month.Table.col" / "Table.col"). */
export function parseLegacyColumnId(colId: string, index: number): ReportColumn {
  const parts = colId.split('.');
  if (parts.length >= 3 && ['sum', 'count', 'avg', 'max', 'min'].includes(parts[0])) {
    return { col: parts.slice(1).join('.'), agg: parts[0], datePart: '', key: 'legacy-' + index };
  }
  if (parts.length >= 3 && ['day', 'month', 'year', 'yearmonth', 'yearmonthday'].includes(parts[0])) {
    return { col: parts.slice(1).join('.'), agg: '', datePart: parts[0], key: 'legacy-' + index };
  }
  return { col: colId, agg: '', datePart: '', key: 'legacy-' + index };
}

/**
 * Convert a legacy (v1) module config `{ data, columns, group, joins, sort }`
 * into a v2 SheetConfig, so legacy reports render through the same pipeline.
 * Shared by the builder and the dashboard widget.
 */
export function legacySheetFromConfig(cfg: any, fallbackTable = ''): SheetConfig {
  const sheet = createDefaultSheet(cfg.data || fallbackTable);

  if (cfg.columns) {
    const rawCols: string[] = cfg.columns.map((c: any) => typeof c === 'string' ? c : c.id);
    const parsed = rawCols.map((id, i) => parseLegacyColumnId(id, i));
    sheet.columnsShelf = parsed.filter(c => !c.agg);
    sheet.rowsShelf = parsed.filter(c => !!c.agg);
  }

  if (cfg.group?.by && cfg.group.columns) {
    cfg.group.columns.forEach((gc: any, i: number) => {
      if (!sheet.rowsShelf.find(c => c.agg === gc.op && c.col === gc.id)) {
        sheet.rowsShelf.push({ col: gc.id, agg: gc.op, datePart: '', key: 'legacy-grp-' + i });
      }
    });
  }

  if (cfg.joins) sheet.joins = cfg.joins;
  if (cfg.sort) sheet.sortBy = cfg.sort;
  if (cfg.type || cfg.meta?.chart) sheet.chartType = cfg.type || cfg.meta?.chart || 'table';

  return sheet;
}

/** Chart type definitions */
export interface ChartTypeDef {
  id: string;
  label: string;
  paths: string[];
  /** Short hover-tooltip text. */
  tooltip?: string;
  /** Long contextual description shown in the Show Me popover (and on hover). */
  note?: string;
  /**
   * Marks a "common" / most-used chart type. Curation flag retained for
   * potential future use (e.g. ordering or a quick-pick row); the Show Me
   * popover currently lists every type regardless of this flag.
   */
  isCommon?: boolean;
}

// Single source of truth — the Show Me chart-type picker iterates this exact
// array. To add / remove / rename a chart type, edit only this list.
export const CHART_TYPES: ChartTypeDef[] = [
  {
    id: 'table',
    label: 'Table',
    paths: ['M3 5h18v14H3zM3 9h18M3 13h18M3 17h18M9 5v14M15 5v14'],
    tooltip: 'Raw rows — every record shown as-is.',
    note: 'Shows raw rows — every record exactly as it\'s stored, no grouping or aggregation. Best for inspecting source data.',
    isCommon: true,
  },
  {
    id: 'vertical-bar',
    label: 'Bar',
    paths: ['M4 20h4V10H4zM10 20h4V4h-4zM16 20h4v-8h-4z'],
    tooltip: 'Compare measures across a dimension.',
    note: 'Compares one or more measures across a single dimension. Put the category on the <strong>columns</strong> shelf and an aggregated measure (sum, count, avg…) on the <strong>rows</strong> shelf.',
    isCommon: true,
  },
  {
    id: 'horizontal-bar',
    label: 'H-Bar',
    paths: ['M4 4v4h10V4zM4 10v4h16V10zM4 16v4h8V16z'],
    tooltip: 'Bars laid out horizontally — better for long category names.',
    note: 'Horizontal bars — same data as <strong>Bar</strong>, but easier to read when category labels are long.',
  },
  {
    id: 'line',
    label: 'Line',
    paths: ['M3 19L8 14L12 17L21 7'],
    tooltip: 'Trends over an ordered dimension.',
    note: 'Shows how a measure trends across an ordered dimension — usually a date. Put the time field on the <strong>columns</strong> shelf and the measure on the <strong>rows</strong> shelf. Add a field to <strong>Marks → Color</strong> for multiple lines.',
    isCommon: true,
  },
  {
    id: 'area',
    label: 'Area',
    paths: ['M3 19L8 14L12 17L21 7V19H3Z'],
    tooltip: 'Line chart with the area below filled in.',
    note: 'Same shape as <strong>Line</strong>, with the area under the curve filled in to emphasise volume over time.',
  },
  {
    id: 'donut',
    label: 'Donut',
    paths: ['M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 15a5 5 0 1 1 5-5 5 5 0 0 1-5 5z'],
    tooltip: 'Share of a total with a hollow center.',
    note: 'A pie with a hole — same use as <strong>Pie</strong>. The center can show the grand total.',
  },
  {
    id: 'pie',
    label: 'Pie',
    paths: ['M12 2a10 10 0 1 0 10 10h-10z', 'M12 2v10h10A10 10 0 0 0 12 2z'],
    tooltip: 'Share of a total across a dimension.',
    note: 'Shows each category\'s share of a total. Best with a small number of categories (5–7). For many categories, a <strong>Bar</strong> chart is easier to read.',
    isCommon: true,
  },
  {
    id: 'kpi',
    label: 'KPI',
    paths: ['M3 3h18v18H3zM9 13h6M12 10v6'],
    tooltip: 'A single aggregated number.',
    note: 'A single aggregated number — sum / count / avg / max / min of one measure. No dimension needed. Use it on the dashboard for headline metrics.',
    isCommon: true,
  },
];

export const CHART_COLORS = ['#00bcd4', '#26a69a', '#42a5f5', '#ffa726', '#ef5350', '#ab47bc', '#8d6e63', '#78909c'];

/** Nav items for sidebar */
export interface NavItem {
  id: string;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General', icon: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44' },
  { id: 'datasource', label: 'Data\nSource', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15h6' },
  { id: 'chart', label: 'Chart\nType', icon: 'M3 3v18h18M18 17V9M13 17V5M8 17v-3' },
  { id: 'settings', label: 'Settings', icon: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4' },
];

export const FILTER_OPERATORS = [
  { value: 'equal', label: 'Equal' },
  { value: 'notEqual', label: 'Not Equal' },
  { value: 'contains', label: 'Contains' },
  // 'beginsWith' is the backend's operator key for "starts with" (LIKE 'val%').
  { value: 'beginsWith', label: 'Starts With' },
  { value: 'endsWith', label: 'Ends With' },
  { value: 'greater', label: 'Greater' },
  { value: 'less', label: 'Less' },
  { value: 'greaterOrEqual', label: '≥' },
  { value: 'lessOrEqual', label: '≤' },
  { value: 'between', label: 'Between' },
  { value: 'isEmpty', label: 'Is Empty' },
  { value: 'isNotEmpty', label: 'Is Not Empty' },
];

/**
 * Operators that apply to each column type. Used by the filter dropdowns
 * in view-mode and shelves-panel so users don't see meaningless options
 * (e.g. "Contains" on a number column, "Greater" on text).
 *
 * The lists are kept conservative — equal / notEqual / isEmpty / isNotEmpty
 * apply to everything; the rest are type-specific.
 */
const OPERATORS_BY_TYPE: { [type: string]: string[] } = {
  text:    ['equal', 'notEqual', 'contains', 'beginsWith', 'endsWith', 'isEmpty', 'isNotEmpty'],
  number:  ['equal', 'notEqual', 'greater', 'less', 'greaterOrEqual', 'lessOrEqual', 'between', 'isEmpty', 'isNotEmpty'],
  date:    ['equal', 'notEqual', 'greater', 'less', 'greaterOrEqual', 'lessOrEqual', 'between', 'isEmpty', 'isNotEmpty'],
  boolean: ['equal', 'notEqual'],
};

/**
 * Return the FILTER_OPERATORS subset valid for the given column type.
 * Falls back to the full list when the type is unrecognised so unknown
 * backend types stay usable instead of silently empty.
 */
export function operatorsForType(type: string | undefined): typeof FILTER_OPERATORS {
  const key = (type || '').toLowerCase();
  const allowed = OPERATORS_BY_TYPE[key];
  if (!allowed) return FILTER_OPERATORS;
  const set = new Set(allowed);
  return FILTER_OPERATORS.filter(op => set.has(op.value));
}

/** Operators that need no value (the `filter` field is ignored). */
const NO_VALUE_OPERATORS = new Set(['isEmpty', 'isNotEmpty']);

/**
 * Validate a single filter rule before it is sent to the backend. Enforces:
 *   - a field is selected;
 *   - the operator is valid for the field's type (numeric/date operators are
 *     rejected on text fields and vice-versa — see OPERATORS_BY_TYPE);
 *   - a value is present for operators that need one (`between` needs both
 *     ends; isEmpty/isNotEmpty need none).
 * Formula rules validate exactly like column rules — only the backend
 * resolution differs.
 */
export function isValidFilterRule(r: FilterRule): boolean {
  if (!r || !r.field) return false;
  const op = r.condition?.type;
  if (!op) return false;
  // Operator must be allowed for the declared field type. operatorsForType
  // falls back to the full list for unknown types, so this stays permissive
  // for backend types we don't model explicitly.
  if (!operatorsForType(r.type).some(o => o.value === op)) return false;
  if (NO_VALUE_OPERATORS.has(op)) return true;
  if (op === 'between') {
    const f = r.condition.filter as any;
    return !!(f && f.start && f.end);
  }
  const f = r.condition.filter;
  return f !== '' && f !== null && f !== undefined;
}

/**
 * Filter a rule list down to the rules that are safe to send. Single source of
 * truth used by every query-build site (preview, dashboard, export) so filter
 * validation can never drift between them.
 */
export function buildValidFilterRules(rules: FilterRule[] | null | undefined): FilterRule[] {
  return (rules || []).filter(isValidFilterRule);
}
