import {
  CalcOperand,
  CalcOperator,
  CalculatedField,
  FilterRule,
  ReportColumn,
  SheetConfig,
  SortRule,
  buildValidFilterRules,
  createDefaultSheet,
  shelvesToApiParams,
} from '../models/custom-report.model';
import {
  CatalogIndex,
  builderFieldType,
  entityOfNode,
  fieldIdOf,
  fieldIdOfKey,
  nodeOfField,
  pathOfField,
  rootOf,
  sheetNodeIds,
} from './catalog-fields';
import {
  ReportSpecV2,
  RunColumn,
  SpecAgg,
  SpecCalculatedField,
  SpecColumn,
  SpecDatePart,
  SpecFilterGroup,
  SpecRule,
  SpecSort,
} from './report-v2.model';

/**
 * Builder sheet ⇄ v2 spec.
 *
 * Every spec column is sent with `as` = the key the builder already uses for
 * that column ("Table.col", "sum.Table.col", "month.Table.col"), so /v2/run
 * returns rows keyed exactly as the chart, table, formats, sort and calculated
 * fields expect — none of them need to know the engine changed.
 */

/** Refused locally before any request; `messageKey` is a CUSTOM_REPORTS.* string. */
export class SpecBuildError extends Error {
  constructor(public messageKey: string, public params?: { [k: string]: any }) {
    super(messageKey);
    this.name = 'SpecBuildError';
  }
}

const AGGS = new Set(['sum', 'count', 'avg', 'max', 'min']);
const DATE_PARTS = new Set(['day', 'week', 'month', 'year', 'yearmonth', 'yearmonthday', 'hour']);
const PAGE_SIZES = [10, 25, 50, 100, 200];

const isFormulaCol = (col: string) => (col.split('.').pop() || '').startsWith('@');

/** COUNT never applies to a formula (legacy normalised it to a projection). */
export function effectiveAgg(c: ReportColumn): string {
  return isFormulaCol(c.col) && c.agg === 'count' ? '' : c.agg || '';
}

/** The builder's row key for a column — identical to shelvesToApiParams. */
export function columnKey(c: ReportColumn): string {
  if (c.datePart) return c.datePart + '.' + c.col;
  const agg = effectiveAgg(c);
  return agg ? agg + '.' + c.col : c.col;
}

/** Shelf + mark columns, deduplicated in shelvesToApiParams order. */
export function sheetColumns(sheet: SheetConfig): ReportColumn[] {
  const all = [...sheet.columnsShelf, ...sheet.rowsShelf, ...sheet.marks.map(m => m.field)];
  const seen = new Set<string>();
  const out: ReportColumn[] = [];
  for (const c of all) {
    const id = (c.agg || c.datePart || '') + '.' + c.col;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(c);
  }
  return out;
}

// ─── Dates ─────────────────────────────────────────────────

const PLAIN_DAY = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A date filter value as a plain company day. The builder's date pickers emit
 * either `YYYY-MM-DD` or local midnight serialised as UTC ISO — the reason the
 * legacy engine added a day. Reading the ISO back in local time gives the day
 * the user picked, without that shift.
 */
export function toDay(v: any): any {
  if (v == null || v === '') return v;
  const s = String(v);
  if (PLAIN_DAY.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return v;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─── Filters: builder → spec ───────────────────────────────

function ruleToSpec(r: FilterRule): SpecRule | SpecFilterGroup | null {
  const field = pathOfField(r.field);
  const op = r.condition?.type;
  if (!field || !op) return null;
  if (op === 'isEmpty' || op === 'isNotEmpty') return { field, op };

  const numeric = r.type === 'number' || r.type === 'integer';
  const isDate = r.type === 'date';
  const one = (v: any) => (numeric ? Number(v) : isDate ? toDay(v) : v);

  // Legacy semantics: every `includes` value and the single filter value are
  // alternatives OR'd together under the same operator.
  const alternatives: SpecRule[] = [];
  const f: any = r.condition.filter;
  if (op === 'between') {
    if (f && f.start != null && f.start !== '' && f.end != null && f.end !== '') {
      alternatives.push({ field, op, value: [one(f.start), one(f.end)] });
    }
  } else {
    for (const v of r.includes || []) alternatives.push({ field, op, value: one(v) });
    if (f !== ':' && f !== '' && f != null) alternatives.push({ field, op, value: one(f) });
  }
  if (alternatives.length === 0) return null;
  if (alternatives.length === 1) return alternatives[0];
  return { glue: 'or', rules: alternatives };
}

function glueOf(raw: string | undefined): 'and' | 'or' {
  return /or/i.test(raw || '') ? 'or' : 'and';
}

// ─── Required date range ───────────────────────────────────

/** The last 30 days up to and including today, as plain company days. */
function last30DaysRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 29);
  const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: day(start), end: day(end) };
}

/**
 * The sheet's filter rules plus a "between" date filter (last 30 days) for
 * the first entity in the report that requires a date range and has none, or
 * null when nothing needs adding. The filter goes on the entity's `defaultDate`
 * (else its first date field) so it can later be turned into `spec.dateRange`.
 */
export function withRequiredDateRange(sheet: SheetConfig, index: CatalogIndex | null | undefined): FilterRule[] | null {
  if (!index) return null;
  const dated = sheetNodeIds(sheet)
    .map(node => ({ node, entity: entityOfNode(index, node) }))
    .filter(x => x.entity?.requiresDateRange);
  if (!dated.length) return null;

  const valid = buildValidFilterRules(sheet.filterRules || []);
  const isRange = (r: FilterRule) => r.type === 'date' && r.condition?.type === 'between';
  const covered = dated.some(d => valid.some(r =>
    isRange(r) && (nodeOfField(r.field) === d.node || d.node === sheet.primaryTable)));
  if (covered) return null;

  const target = dated[0];
  const key = target.entity!.defaultDate || target.entity!.fields.find(f => f.type === 'date')?.key;
  if (!key) return null;
  return [
    ...(sheet.filterRules || []),
    {
      field: `${target.node}.${key}`,
      type: 'date',
      condition: { type: 'between', filter: last30DaysRange() },
      includes: [],
    },
  ];
}

// ─── Sheet → spec ──────────────────────────────────────────

export interface SheetToSpecOptions {
  /** Page size; `null` = every row (max 100,000). Defaults to the sheet's page size. */
  limit?: number | null;
  page?: number;
  /** Replaces the sheet's own sort (e.g. a header click). */
  sort?: SortRule[];
  /** ANDed into the sheet's own filters (dashboard global filters). */
  extraFilters?: FilterRule[];
  /** Catalog index — needed for date-range entities and labels. */
  index?: CatalogIndex | null;
  /**
   * Include the sheet's calculated fields (`spec.calculatedFields`) — for
   * saved reports and the AI, which can't otherwise see them. /v2/run
   * ignores them; the builder computes them itself.
   */
  withCalculated?: boolean;
}

export function sheetToSpec(sheet: SheetConfig, opts: SheetToSpecOptions = {}): ReportSpecV2 {
  const root = sheet.primaryTable;
  const cols = sheetColumns(sheet);
  if (cols.length === 0) throw new SpecBuildError('CUSTOM_REPORTS.NOTICES.PICK_A_COLUMN');

  const byKey = new Map<string, SpecColumn>();
  const columns: SpecColumn[] = cols.map(c => {
    const as = columnKey(c);
    const agg = effectiveAgg(c);
    let col: SpecColumn;
    if (agg === 'count') {
      // Legacy COUNT counted rows whatever column was picked; keep that unless
      // the column asks for distinct values.
      col = c.distinct ? { field: pathOfField(c.col), agg: 'countDistinct', as } : { agg: 'count', as };
    } else {
      col = { field: pathOfField(c.col), as };
      if (agg) col.agg = agg as SpecAgg;
      if (c.datePart) col.datePart = c.datePart as SpecDatePart;
    }
    byKey.set(as, col);
    return col;
  });

  const spec: ReportSpecV2 = { version: 2, entity: root, columns };

  // Every non-aggregated column must be grouped once any aggregate is present.
  const hasMeasure = cols.some(c => !!effectiveAgg(c));
  if (hasMeasure) {
    spec.groupBy = cols
      .filter(c => !effectiveAgg(c))
      .map(c => (c.datePart ? { field: pathOfField(c.col), datePart: c.datePart as SpecDatePart } : pathOfField(c.col)));
  }

  // Sort — grouped reports may only sort by selected columns.
  const sort: SpecSort[] = [];
  for (const s of opts.sort ?? sheet.sortBy ?? []) {
    // A sort saved before the report moved to v2 can still name an old view.
    if (rootOf(fieldIdOfKey(s.id)) !== root) continue;
    const dir = s.mod === 'DESC' ? 'desc' : 'asc';
    const hit = byKey.get(s.id);
    if (hit) {
      sort.push({ ...(hit.field ? { field: hit.field } : {}), ...(hit.agg ? { agg: hit.agg } : {}), ...(hit.datePart ? { datePart: hit.datePart } : {}), dir });
      continue;
    }
    if (hasMeasure) continue;
    const prefix = (s.id || '').split('.')[0];
    const field = pathOfField(fieldIdOfKey(s.id));
    if (!field) continue;
    sort.push({
      field,
      ...(AGGS.has(prefix) && s.id !== field ? { agg: prefix as SpecAgg } : {}),
      ...(DATE_PARTS.has(prefix) && s.id !== field ? { datePart: prefix as SpecDatePart } : {}),
      dir,
    });
  }
  if (sort.length) spec.sort = sort;

  // Filters (+ date range for entities that require one).
  let rules = buildValidFilterRules([...(sheet.filterRules || []), ...(opts.extraFilters || [])]);
  // Any entity the report touches can demand a date range — not just the root
  // (e.g. `accounts` reading `journalEntries.amount`). dateRange is a spec-level
  // property next to entity/columns/filters, never a filter rule.
  const index = opts.index;
  const dated = index
    ? sheetNodeIds(sheet)
        .map(node => ({ node, entity: entityOfNode(index, node) }))
        .filter(x => x.entity?.requiresDateRange)
    : [];
  if (dated.length) {
    const isRange = (r: FilterRule) => r.type === 'date' && r.condition?.type === 'between';
    let range: FilterRule | undefined;
    for (const d of dated) {
      // Prefer the filter on that entity's own date; the root also accepts any
      // between-date filter (the original single-entity behaviour).
      range = rules.find(r => isRange(r) && nodeOfField(r.field) === d.node)
        || (d.node === root ? rules.find(isRange) : undefined);
      if (range) break;
    }
    if (!range) throw new SpecBuildError('CUSTOM_REPORTS.NOTICES.NEEDS_DATE_RANGE', { entity: dated[0].entity!.label });
    const f: any = range.condition.filter;
    spec.dateRange = { field: pathOfField(range.field), from: toDay(f.start), to: toDay(f.end) };
    rules = rules.filter(r => r !== range);
  }
  const specRules = rules.map(ruleToSpec).filter((r): r is SpecRule | SpecFilterGroup => !!r);
  if (specRules.length) spec.filters = { glue: glueOf(sheet.filterGlue), rules: specRules };

  if (sheet.groupBy) {
    if (hasMeasure) throw new SpecBuildError('CUSTOM_REPORTS.NOTICES.GROUP_BY_DETAIL_ONLY');
    spec.displayGroupBy = pathOfField(sheet.groupBy);
  }

  const limit = opts.limit === undefined ? sheet.pageSize : opts.limit;
  if (limit != null) spec.limit = limit;
  spec.page = opts.page ?? sheet.currentPage ?? 1;

  if (opts.withCalculated) {
    const calculated = calculatedToSpec(sheet.calculatedFields || [], [...byKey.keys()]);
    if (calculated.length) spec.calculatedFields = calculated;
  }
  return spec;
}

/**
 * Builder calculated fields → spec form. Field operands already name column
 * keys (each spec column's `as` is the builder key); references to other
 * calculated fields switch from id to name. Fields using anything that isn't
 * a column of the report are left out — the backend would refuse them.
 */
function calculatedToSpec(fields: CalculatedField[], columnKeys: string[]): SpecCalculatedField[] {
  const columns = new Set(columnKeys);
  const used = new Set(columnKeys);
  const nameOfId = new Map<string, string>();
  const out: SpecCalculatedField[] = [];
  for (const cf of fields) {
    const usable = cf.operands.length > 0
      && cf.operands.every(op => op.type !== 'field' || columns.has(op.value) || nameOfId.has(op.value));
    if (!usable) continue;
    // Names must be unique and not clash with a column key.
    const base = (cf.name || '').trim().slice(0, 55) || 'Calculated';
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base} (${n})`;
    used.add(name);
    nameOfId.set(cf.id, name);
    out.push({
      name,
      mode: cf.mode,
      operands: cf.operands.map(op => ({
        type: op.type,
        value: op.type === 'field' ? nameOfId.get(op.value) ?? op.value : op.value,
        ...(op.operator ? { operator: op.operator } : {}),
      })),
      ...(cf.mode === 'summary' ? { aggFunc: cf.aggFunc || 'sum' } : {}),
      ...(cf.mode === 'concat' ? { separator: cf.separator ?? ' ' } : {}),
    });
  }
  return out;
}

/** Spec calculated fields → builder ones, with operands on builder row keys. */
function calculatedFromSpec(
  fields: SpecCalculatedField[],
  builderKeyOf: Map<string, string>,
  stamp: number,
): { fields: CalculatedField[]; dropped: number } {
  const idOfName = new Map<string, string>();
  const out: CalculatedField[] = [];
  let dropped = 0;
  fields.forEach((f, i) => {
    const operands: CalcOperand[] = [];
    for (const op of f.operands || []) {
      if (op.type === 'field') {
        const key = builderKeyOf.get(String(op.value)) ?? idOfName.get(String(op.value));
        if (!key) { operands.length = 0; break; }
        operands.push({ type: 'field', value: key, ...(op.operator ? { operator: op.operator as CalcOperator } : {}) });
      } else {
        operands.push({ type: 'constant', value: String(op.value), ...(op.operator ? { operator: op.operator as CalcOperator } : {}) });
      }
    }
    if (!f.name || !operands.length) { dropped++; return; }
    const id = `calc-${stamp}-${i}`;
    idOfName.set(f.name, id);
    out.push({
      id,
      name: f.name,
      mode: f.mode || 'math',
      operands,
      ...(f.mode === 'summary' ? { aggFunc: f.aggFunc || 'sum' } : {}),
      ...(f.mode === 'concat' ? { separator: f.separator ?? ' ' } : {}),
      resultType: f.mode === 'concat' ? 'text' : 'number',
    });
  });
  return { fields: out, dropped };
}

// ─── Spec → sheet ──────────────────────────────────────────

/** The key the backend gives a column when `as` is omitted. */
function backendDefaultKey(c: SpecColumn): string {
  if (c.agg) return `${c.agg}(${c.field ?? '*'})`;
  if (c.datePart) return `${c.datePart}(${c.field})`;
  return c.field || '';
}

/** Keys the legacy engine / fromLegacy use — never meaningful as a header. */
const LEGACY_KEY = /^((sum|count|avg|max|min|day|week|month|year|yearmonth|yearmonthday|hour)\.)?[A-Za-z0-9_]+\.[@A-Za-z0-9_.]*$/;

/** A field id for count(*) — the root's first id-like field, else its first field. */
function countFieldId(index: CatalogIndex | null | undefined, root: string): string {
  const entity = index ? entityOfNode(index, root) : null;
  const f = entity?.fields.find(x => x.type === 'id') || entity?.fields[0];
  return `${root}.${f?.key || 'id'}`;
}

function fieldTypeOf(index: CatalogIndex | null | undefined, fullId: string): string {
  const entity = index ? entityOfNode(index, nodeOfField(fullId)) : null;
  const key = fullId.split('.').pop();
  const f = entity?.fields.find(x => x.key === key);
  return f ? builderFieldType(f.type) : 'text';
}

function specRuleToBuilder(
  rule: SpecRule,
  root: string,
  index: CatalogIndex | null | undefined,
): FilterRule | null {
  const field = fieldIdOf(root, rule.field);
  const type = fieldTypeOf(index, field);
  const base = { field, type, includes: [] as any[], ...(rule.field.split('.').pop()!.startsWith('@') ? { isFormula: true } : {}) };
  switch (rule.op) {
    case 'isEmpty':
    case 'isNotEmpty':
      return { ...base, condition: { type: rule.op, filter: '' } };
    case 'between': {
      const [start, end] = Array.isArray(rule.value) ? rule.value : [];
      return { ...base, condition: { type: 'between', filter: { start: String(start ?? ''), end: String(end ?? '') } } };
    }
    case 'in': {
      const values = Array.isArray(rule.value) ? rule.value : [rule.value];
      if (!values.length) return null;
      return { ...base, condition: { type: 'equal', filter: String(values[0]) }, includes: values.slice(1).map(String) };
    }
    default:
      return { ...base, condition: { type: rule.op, filter: rule.value == null ? '' : String(rule.value) } };
  }
}

export interface SpecToSheetResult {
  sheet: SheetConfig;
  /** Filter rules the builder can't represent (mixed nested groups, notIn under OR). */
  droppedFilters: number;
  /** True when the spec carried `calculatedFields` (even an empty list). */
  hasCalculated?: boolean;
  /** Calculated fields whose inputs aren't columns of the report. */
  droppedCalculated?: number;
}

export interface SpecToSheetOptions {
  index?: CatalogIndex | null;
  name?: string;
  /** Don't turn `as` into column aliases (fromLegacy puts legacy keys there). */
  ignoreAs?: boolean;
}

export function specToSheet(spec: ReportSpecV2, opts: SpecToSheetOptions = {}): SpecToSheetResult {
  const root = spec.entity;
  const sheet = createDefaultSheet(root, opts.name || 'Sheet 1');
  const stamp = Date.now();

  const keyOfSpecCol = new Map<SpecColumn, string>();
  (spec.columns || []).forEach((c, i) => {
    const col = c.field ? fieldIdOf(root, c.field) : countFieldId(opts.index, root);
    const rc: ReportColumn = {
      col,
      agg: c.agg === 'countDistinct' ? 'count' : c.agg || '',
      datePart: c.datePart || '',
      key: `${stamp}-${i}-${col}`,
      ...(c.agg === 'countDistinct' ? { distinct: true } : {}),
    };
    if (!opts.ignoreAs && c.as && c.as !== backendDefaultKey(c) && !LEGACY_KEY.test(c.as)) rc.alias = c.as;
    keyOfSpecCol.set(c, columnKey(rc));
    (rc.agg ? sheet.rowsShelf : sheet.columnsShelf).push(rc);
  });

  // Grouped fields the spec didn't also select still have to be columns.
  for (const g of spec.groupBy || []) {
    const field = typeof g === 'string' ? g : g.field;
    const datePart = typeof g === 'string' ? '' : g.datePart || '';
    const col = fieldIdOf(root, field);
    if (!sheet.columnsShelf.some(c => c.col === col && c.datePart === datePart)) {
      sheet.columnsShelf.push({ col, agg: '', datePart, key: `${stamp}-g-${col}` });
    }
  }

  // Sort → builder keys.
  sheet.sortBy = (spec.sort || []).map(s => {
    const hit = (spec.columns || []).find(c => c.field === s.field && (c.agg || '') === (s.agg || '') && (c.datePart || '') === (s.datePart || ''));
    let id = hit ? keyOfSpecCol.get(hit)! : '';
    if (!id) {
      const fid = s.field ? fieldIdOf(root, s.field) : countFieldId(opts.index, root);
      const agg = s.agg === 'countDistinct' ? 'count' : s.agg;
      id = s.datePart ? `${s.datePart}.${fid}` : agg ? `${agg}.${fid}` : fid;
    }
    return { id, mod: s.dir === 'desc' ? 'DESC' : 'ASC' } as SortRule;
  });

  // Filters — the builder holds one flat list under a single glue.
  let dropped = 0;
  const filters: FilterRule[] = [];
  const top = spec.filters;
  if (top?.rules?.length) {
    sheet.filterGlue = top.glue === 'or' ? ' OR ' : ' AND ';
    for (const r of top.rules) {
      if ('rules' in r) {
        // An OR group of one field + operator is how the builder writes
        // "any of these values" (includes); anything else can't be shown.
        const leaves = r.rules as SpecRule[];
        const sameShape = r.glue === 'or' && leaves.length > 0 && leaves.every(l => !('rules' in l) && l.field === leaves[0].field && l.op === leaves[0].op && l.op !== 'between');
        if (!sameShape) { dropped++; continue; }
        const first = specRuleToBuilder(leaves[0], root, opts.index);
        if (!first) { dropped++; continue; }
        first.includes = leaves.slice(1).map(l => String(l.value));
        filters.push(first);
        continue;
      }
      if (r.op === 'notIn') {
        // NOT IN = every value excluded — only expressible under AND.
        const values = Array.isArray(r.value) ? r.value : [r.value];
        if (top.glue === 'or' && values.length > 1) { dropped++; continue; }
        for (const v of values) {
          const fr = specRuleToBuilder({ field: r.field, op: 'notEqual', value: v }, root, opts.index);
          if (fr) filters.push(fr);
        }
        continue;
      }
      const fr = specRuleToBuilder(r, root, opts.index);
      if (fr) filters.push(fr); else dropped++;
    }
  }
  if (spec.dateRange?.from && spec.dateRange?.to) {
    const entity = opts.index ? entityOfNode(opts.index, root) : null;
    const path = spec.dateRange.field || entity?.defaultDate || '';
    if (path) {
      filters.unshift({
        field: fieldIdOf(root, path),
        type: 'date',
        condition: { type: 'between', filter: { start: spec.dateRange.from, end: spec.dateRange.to } },
        includes: [],
      });
    }
  }
  sheet.filterRules = filters;

  if (spec.displayGroupBy) sheet.groupBy = fieldIdOf(root, spec.displayGroupBy);
  if (spec.limit) sheet.pageSize = PAGE_SIZES.find(s => s >= spec.limit!) || 200;

  // Calculated fields name spec column keys (`as`, or the default key).
  const hasCalculated = Array.isArray(spec.calculatedFields);
  let droppedCalculated = 0;
  if (hasCalculated) {
    const builderKeyOf = new Map<string, string>();
    keyOfSpecCol.forEach((key, c) => builderKeyOf.set(c.as ?? backendDefaultKey(c), key));
    const mapped = calculatedFromSpec(spec.calculatedFields!, builderKeyOf, stamp);
    sheet.calculatedFields = mapped.fields;
    droppedCalculated = mapped.dropped;
  }
  return { sheet, droppedFilters: dropped, hasCalculated, droppedCalculated };
}

// ─── Legacy reports → v2 ───────────────────────────────────

/** A legacy sheet still names database views ("InvoiceView") instead of catalog entities. */
export function isLegacySheet(sheet: SheetConfig, index: CatalogIndex): boolean {
  return !!sheet.primaryTable && !index.has(sheet.primaryTable);
}

/** The body today's builder sent to /getCustomizedReport — what /v2/fromLegacy reads. */
export function legacyPayloadOf(sheet: SheetConfig): any {
  const { columns, groupBy } = shelvesToApiParams(sheet);
  const rules = buildValidFilterRules(sheet.filterRules);
  return {
    data: sheet.primaryTable,
    tablename: sheet.primaryTable,
    columns,
    joins: sheet.joins || [],
    query: rules.length ? { glue: sheet.filterGlue, rules } : '',
    sort: sheet.sortBy || [],
    group: groupBy,
    buckets: [],
    groupBy: sheet.groupBy || '',
    limit: sheet.pageSize,
    page: 1,
  };
}

/**
 * Rebuild a legacy sheet on the spec /v2/fromLegacy returned for it, keeping
 * everything presentational (chart type, marks, aliases, formats, hidden
 * columns, calculated fields, page size). fromLegacy emits one spec column per
 * legacy column in the same order, so columns are matched by position.
 */
export function upgradeLegacySheet(old: SheetConfig, spec: ReportSpecV2, index: CatalogIndex | null): SpecToSheetResult {
  const { sheet: fresh, droppedFilters } = specToSheet(spec, { index, name: old.name, ignoreAs: true });
  const root = spec.entity;
  const oldCols = sheetColumns(old);

  // old dedupe id → upgraded column
  const upgraded = new Map<string, ReportColumn>();
  const keyMap = new Map<string, string>(); // old row key → new row key
  oldCols.forEach((oc, i) => {
    const sc = spec.columns[i];
    const col = sc?.field ? fieldIdOf(root, sc.field) : countFieldId(index, root);
    const nc: ReportColumn = { ...oc, col };
    upgraded.set((oc.agg || oc.datePart || '') + '.' + oc.col, nc);
    keyMap.set(columnKey(oc), columnKey(nc));
  });
  const up = (c: ReportColumn) => upgraded.get((c.agg || c.datePart || '') + '.' + c.col) || c;

  const sheet: SheetConfig = {
    ...old,
    primaryTable: root,
    joins: [],
    columnsShelf: old.columnsShelf.map(up),
    rowsShelf: old.rowsShelf.map(up),
    marks: old.marks.map(m => ({ ...m, field: up(m.field) })),
    filterRules: fresh.filterRules,
    filterGlue: fresh.filterGlue,
    sortBy: (old.sortBy || []).map(s => ({ ...s, id: keyMap.get(s.id) || s.id })),
    groupBy: fresh.groupBy,
    calculatedFields: (old.calculatedFields || []).map(cf => ({
      ...cf,
      operands: cf.operands.map(op => (op.type === 'field' && keyMap.has(op.value) ? { ...op, value: keyMap.get(op.value)! } : op)),
    })),
  };
  return { sheet, droppedFilters };
}

/**
 * Calculated fields whose field operands are all row keys of `sheet` (its
 * columns, or calculated fields kept before them). Used when a sheet is
 * rebuilt from a spec so the user's calculations survive where they still can.
 */
export function keepResolvableCalculatedFields(fields: CalculatedField[], sheet: SheetConfig): CalculatedField[] {
  const keys = new Set(sheetColumns(sheet).map(columnKey));
  const kept: CalculatedField[] = [];
  for (const cf of fields) {
    const ok = cf.operands.every(op => op.type !== 'field' || !op.value || keys.has(op.value));
    if (!ok) continue;
    kept.push(cf);
    keys.add(cf.id); // later fields may build on this one
  }
  return kept;
}

// ─── Results ───────────────────────────────────────────────

/**
 * numeric, bigint, COUNT and SUM values arrive as strings to keep precision;
 * parse the columns the backend declares as numbers. Mutates rows in place.
 */
export function coerceByRunColumns(rows: any[], columns: RunColumn[] | undefined): any[] {
  if (!Array.isArray(rows) || !rows.length || !columns?.length) return rows;
  const numeric = columns.filter(c => c.type === 'number').map(c => c.key);
  if (!numeric.length) return rows;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const k of numeric) {
      const v = row[k];
      if (typeof v === 'string' && v !== '') {
        const n = parseFloat(v);
        if (!isNaN(n)) row[k] = n;
      }
    }
  }
  return rows;
}
