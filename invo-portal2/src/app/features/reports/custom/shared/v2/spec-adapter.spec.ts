import { describe, expect, it } from 'vitest';
import { FilterRule, SheetConfig, applyCalculatedFields, createDefaultSheet } from '../models/custom-report.model';
import { indexCatalog, nodeFields, sheetNodeIds } from './catalog-fields';
import { CatalogEntity, ReportSpecV2 } from './report-v2.model';
import {
  SpecBuildError,
  coerceByRunColumns,
  legacyPayloadOf,
  sheetToSpec,
  specToSheet,
  toDay,
  upgradeLegacySheet,
} from './spec-adapter';

/** Vitest has no toThrowMatching: capture what was thrown instead. */
function thrown(fn: () => unknown): any {
  try { fn(); } catch (e) { return e; }
  return undefined;
}

const CATALOG: CatalogEntity[] = [
  {
    key: 'invoiceLines',
    label: 'Invoice lines',
    category: 'sales',
    fields: [
      { key: 'qty', label: 'Qty', type: 'number', filterable: true, show: true },
      { key: '@net', label: 'Net', type: 'number', filterable: true, show: true },
      { key: 'id', label: 'Id', type: 'id', filterable: true, show: false },
    ],
    relations: [
      { name: 'invoice', entity: 'invoices', cardinality: 'one' },
      { name: 'product', entity: 'products', cardinality: 'one' },
    ],
  },
  {
    key: 'invoices',
    label: 'Invoices',
    category: 'sales',
    defaultDate: 'invoiceDate',
    fields: [
      { key: 'invoiceDate', label: 'Date', type: 'date', filterable: true, show: true },
      { key: 'status', label: 'Status', type: 'text', filterable: true, show: true },
    ],
    relations: [{ name: 'invoiceLines', entity: 'invoiceLines', cardinality: 'many' }],
  },
  {
    key: 'products',
    label: 'Products',
    category: 'catalog',
    fields: [{ key: 'name', label: 'Name', type: 'text', filterable: true, show: true }],
    relations: [],
  },
  {
    key: 'journalEntries',
    label: 'Journal entries',
    category: 'accounting',
    requiresDateRange: true,
    defaultDate: 'date',
    fields: [
      { key: 'date', label: 'Date', type: 'date', filterable: true, show: true },
      { key: 'amount', label: 'Amount', type: 'number', filterable: true, show: true },
    ],
    relations: [],
  },
];
const index = indexCatalog(CATALOG);

function sheet(partial: Partial<SheetConfig> = {}): SheetConfig {
  return { ...createDefaultSheet('invoiceLines'), ...partial };
}

const rule = (field: string, type: string, op: string, filter: any, includes: any[] = []): FilterRule =>
  ({ field, type, condition: { type: op, filter }, includes });

describe('catalog-fields', () => {
  it('builds field ids from the node path', () => {
    const f = nodeFields(index, 'invoiceLines.product');
    expect(f.map(x => x.fullId)).toEqual(['invoiceLines.product.name']);
    expect(f[0].table).toBe('invoiceLines.product');
  });

  it('marks @ fields as formulas and maps id → text', () => {
    const f = nodeFields(index, 'invoiceLines');
    expect(f.find(x => x.id === '@net')!.isFormula).toBe(true);
    expect(f.find(x => x.id === 'id')!.type).toBe('text');
  });

  it('lists every node a sheet uses with its ancestors', () => {
    const s = sheet({ columnsShelf: [{ col: 'invoiceLines.invoice.status', agg: '', datePart: '', key: 'a' }] });
    expect(sheetNodeIds(s).sort()).toEqual(['invoiceLines', 'invoiceLines.invoice']);
  });
});

describe('sheetToSpec', () => {
  it('keys every column by the builder key and groups dimensions', () => {
    const spec = sheetToSpec(sheet({
      columnsShelf: [
        { col: 'invoiceLines.product.name', agg: '', datePart: '', key: 'a' },
        { col: 'invoiceLines.invoice.invoiceDate', agg: '', datePart: 'month', key: 'b' },
      ],
      rowsShelf: [{ col: 'invoiceLines.qty', agg: 'sum', datePart: '', key: 'c' }],
    }), { index });
    expect(spec.columns).toEqual([
      { field: 'product.name', as: 'invoiceLines.product.name' },
      { field: 'invoice.invoiceDate', as: 'month.invoiceLines.invoice.invoiceDate', datePart: 'month' },
      { field: 'qty', as: 'sum.invoiceLines.qty', agg: 'sum' },
    ]);
    expect(spec.groupBy).toEqual(['product.name', { field: 'invoice.invoiceDate', datePart: 'month' }]);
  });

  it('counts rows like the legacy engine unless distinct is asked for', () => {
    const spec = sheetToSpec(sheet({
      rowsShelf: [
        { col: 'invoiceLines.qty', agg: 'count', datePart: '', key: 'a' },
        { col: 'invoiceLines.product.name', agg: 'count', datePart: '', key: 'b', distinct: true },
      ],
    }), { index });
    expect(spec.columns[0]).toEqual({ agg: 'count', as: 'count.invoiceLines.qty' });
    expect(spec.columns[1]).toEqual({ field: 'product.name', agg: 'countDistinct', as: 'count.invoiceLines.product.name' });
  });

  it('turns includes into an OR group and between into a day range', () => {
    const spec = sheetToSpec(sheet({
      columnsShelf: [{ col: 'invoiceLines.qty', agg: '', datePart: '', key: 'a' }],
      filterRules: [
        rule('invoiceLines.invoice.status', 'text', 'equal', 'Paid', ['Closed']),
        rule('invoiceLines.invoice.invoiceDate', 'date', 'between', { start: '2026-09-01', end: '2026-09-30' }),
        rule('invoiceLines.qty', 'number', 'greater', '5'),
      ],
    }), { index });
    expect(spec.filters).toEqual({
      glue: 'and',
      rules: [
        { glue: 'or', rules: [
          { field: 'invoice.status', op: 'equal', value: 'Closed' },
          { field: 'invoice.status', op: 'equal', value: 'Paid' },
        ] },
        { field: 'invoice.invoiceDate', op: 'between', value: ['2026-09-01', '2026-09-30'] },
        { field: 'qty', op: 'greater', value: 5 },
      ],
    });
  });

  it('moves the date filter into dateRange for entities that require one', () => {
    const s = createDefaultSheet('journalEntries');
    s.columnsShelf = [{ col: 'journalEntries.amount', agg: '', datePart: '', key: 'a' }];
    s.filterRules = [rule('journalEntries.date', 'date', 'between', { start: '2026-01-01', end: '2026-01-31' })];
    const spec = sheetToSpec(s, { index });
    expect(spec.dateRange).toEqual({ field: 'date', from: '2026-01-01', to: '2026-01-31' });
    expect(spec.filters).toBeUndefined();
  });

  it('refuses a date-range entity without a date range', () => {
    const s = createDefaultSheet('journalEntries');
    s.columnsShelf = [{ col: 'journalEntries.amount', agg: '', datePart: '', key: 'a' }];
    const e = thrown(() => sheetToSpec(s, { index }));
    expect(e instanceof SpecBuildError && e.messageKey.endsWith('NEEDS_DATE_RANGE')).toBe(true);
  });

  it('refuses display group-by on an aggregated report', () => {
    const s = sheet({
      rowsShelf: [{ col: 'invoiceLines.qty', agg: 'sum', datePart: '', key: 'a' }],
      groupBy: 'invoiceLines.product.name',
    });
    const e = thrown(() => sheetToSpec(s, { index }));
    expect(e instanceof SpecBuildError && e.messageKey.endsWith('GROUP_BY_DETAIL_ONLY')).toBe(true);
  });

  it('maps sorts to their column and drops sorts on other entities', () => {
    const spec = sheetToSpec(sheet({
      columnsShelf: [{ col: 'invoiceLines.product.name', agg: '', datePart: '', key: 'a' }],
      rowsShelf: [{ col: 'invoiceLines.qty', agg: 'sum', datePart: '', key: 'b' }],
      sortBy: [{ id: 'sum.invoiceLines.qty', mod: 'DESC' }, { id: 'sum.InvoiceView.total', mod: 'ASC' }],
    }), { index });
    expect(spec.sort).toEqual([{ field: 'qty', agg: 'sum', dir: 'desc' }]);
  });

  it('omits limit when every row is asked for', () => {
    const spec = sheetToSpec(sheet({ columnsShelf: [{ col: 'invoiceLines.qty', agg: '', datePart: '', key: 'a' }] }), { index, limit: null });
    expect('limit' in spec).toBe(false);
  });
});

describe('specToSheet', () => {
  const aiSpec: ReportSpecV2 = {
    version: 2,
    entity: 'invoiceLines',
    columns: [
      { field: 'product.name', as: 'Product' },
      { field: 'qty', agg: 'sum' },
      { field: 'invoice.status', agg: 'countDistinct', as: 'Statuses' },
    ],
    groupBy: ['product.name'],
    filters: { glue: 'and', rules: [{ field: 'invoice.status', op: 'in', value: ['Paid', 'Closed'] }] },
    dateRange: { from: '2026-09-01', to: '2026-09-30', field: 'invoice.invoiceDate' },
    sort: [{ field: 'qty', agg: 'sum', dir: 'desc' }],
    limit: 100,
  };

  it('places dimensions and measures and keeps readable names as aliases', () => {
    const { sheet: s } = specToSheet(aiSpec, { index });
    expect(s.columnsShelf.map(c => [c.col, c.alias])).toEqual([['invoiceLines.product.name', 'Product']]);
    expect(s.rowsShelf.map(c => [c.col, c.agg, c.alias])).toEqual([
      ['invoiceLines.qty', 'sum', undefined],
      ['invoiceLines.invoice.status', 'count', 'Statuses'],
    ]);
    expect(s.rowsShelf[1].distinct).toBe(true);
  });

  it('round-trips back to an equivalent spec', () => {
    const { sheet: s } = specToSheet(aiSpec, { index });
    const back = sheetToSpec(s, { index });
    expect(back.columns.map(c => [c.field, c.agg])).toEqual([
      ['product.name', undefined],
      ['qty', 'sum'],
      ['invoice.status', 'countDistinct'],
    ]);
    expect(back.groupBy).toEqual(['product.name']);
    expect(back.sort).toEqual([{ field: 'qty', agg: 'sum', dir: 'desc' }]);
    expect(back.filters!.rules).toContainEqual({ field: 'invoice.invoiceDate', op: 'between', value: ['2026-09-01', '2026-09-30'] });
    expect(back.filters!.rules).toContainEqual({ glue: 'or', rules: [
      { field: 'invoice.status', op: 'equal', value: 'Closed' },
      { field: 'invoice.status', op: 'equal', value: 'Paid' },
    ] });
  });

  it('maps the page size up to the nearest picker option', () => {
    expect(specToSheet(aiSpec, { index }).sheet.pageSize).toBe(100);
    expect(specToSheet({ ...aiSpec, limit: 30 }, { index }).sheet.pageSize).toBe(50);
  });

  it('counts filter groups it cannot represent', () => {
    const { droppedFilters } = specToSheet({
      ...aiSpec,
      filters: { glue: 'and', rules: [{ glue: 'or', rules: [
        { field: 'qty', op: 'greater', value: 1 },
        { field: 'invoice.status', op: 'equal', value: 'Paid' },
      ] }] },
    }, { index });
    expect(droppedFilters).toBe(1);
  });
});

describe('calculated fields', () => {
  const aiSpec: ReportSpecV2 = {
    version: 2,
    entity: 'invoiceLines',
    columns: [
      { field: 'product.name', as: 'Product' },
      { field: '@net', agg: 'sum', as: 'Net sales' },
      { field: 'qty', agg: 'sum' },
    ],
    groupBy: ['product.name'],
    calculatedFields: [
      { name: 'Per unit', mode: 'math', operands: [
        { type: 'field', value: 'Net sales' }, { type: 'field', value: 'sum(qty)', operator: '/' },
      ] },
      { name: 'Per unit x2', mode: 'math', operands: [
        { type: 'field', value: 'Per unit' }, { type: 'constant', value: 2, operator: '*' },
      ] },
      { name: 'Broken', mode: 'math', operands: [{ type: 'field', value: 'Nope' }] },
    ],
  };

  it('maps AI calculated fields onto builder row keys', () => {
    const { sheet: s, hasCalculated, droppedCalculated } = specToSheet(aiSpec, { index });
    expect(hasCalculated).toBe(true);
    expect(droppedCalculated).toBe(1);
    const [perUnit, doubled] = s.calculatedFields;
    expect(perUnit.name).toBe('Per unit');
    expect(perUnit.operands.map(o => o.value)).toEqual(['sum.invoiceLines.@net', 'sum.invoiceLines.qty']);
    expect(doubled.operands[0].value).toBe(perUnit.id);
    expect(doubled.operands[1]).toEqual({ type: 'constant', value: '2', operator: '*' });
    expect(perUnit.resultType).toBe('number');
  });

  it('computes them on rows keyed like a /v2/run result', () => {
    const { sheet: s } = specToSheet(aiSpec, { index });
    const rows: Record<string, any>[] = [{ 'invoiceLines.product.name': 'Latte', 'sum.invoiceLines.@net': 100, 'sum.invoiceLines.qty': 20 }];
    applyCalculatedFields(rows, s.calculatedFields);
    expect(rows[0][s.calculatedFields[0].id]).toBe(5);
    expect(rows[0][s.calculatedFields[1].id]).toBe(10);
  });

  it('sends them back by name for the AI and saved reports', () => {
    const { sheet: s } = specToSheet(aiSpec, { index });
    const back = sheetToSpec(s, { index, withCalculated: true });
    expect(back.calculatedFields!.map(f => f.name)).toEqual(['Per unit', 'Per unit x2']);
    expect(back.calculatedFields![0].operands.map(o => o.value)).toEqual(['sum.invoiceLines.@net', 'sum.invoiceLines.qty']);
    expect(back.calculatedFields![1].operands[0].value).toBe('Per unit');
    // Their inputs are the spec's own column keys.
    const keys = back.columns.map(c => c.as);
    expect(keys).toContain('sum.invoiceLines.qty');
    // Not sent on a plain run.
    expect(sheetToSpec(s, { index }).calculatedFields).toBeUndefined();
  });

  it('leaves out fields on inputs that are not columns, and de-duplicates names', () => {
    const s = sheet({
      rowsShelf: [{ col: 'invoiceLines.qty', agg: 'sum', datePart: '', key: 'a' }],
      calculatedFields: [
        { id: 'c1', name: 'X', mode: 'math', resultType: 'number', operands: [{ type: 'field', value: 'sum.invoiceLines.qty' }] },
        { id: 'c2', name: 'X', mode: 'math', resultType: 'number', operands: [{ type: 'field', value: 'invoiceLines.product.name' }] },
        { id: 'c3', name: 'X', mode: 'math', resultType: 'number', operands: [{ type: 'field', value: 'c1' }] },
      ],
    });
    const spec = sheetToSpec(s, { index, withCalculated: true });
    expect(spec.calculatedFields!.map(f => f.name)).toEqual(['X', 'X (2)']);
    expect(spec.calculatedFields![1].operands[0].value).toBe('X');
  });
});

describe('legacy upgrade', () => {
  it('keeps presentation and remaps keys by position', () => {
    const old = createDefaultSheet('InvoiceLinesView');
    old.chartType = 'pie';
    old.columnsShelf = [{ col: 'Products.name', agg: '', datePart: '', key: 'a', alias: 'Item' }];
    old.rowsShelf = [{ col: 'InvoiceLinesView.qty', agg: 'sum', datePart: '', key: 'b', format: { type: 'number', decimals: 0 } }];
    old.joins = [{ sid: 'InvoiceLinesView', tid: 'Products', sf: 'productId', tf: 'id', type: 'LEFT' }];
    old.sortBy = [{ id: 'sum.InvoiceLinesView.qty', mod: 'DESC' }];
    old.calculatedFields = [{ id: 'c1', name: 'Double', mode: 'math', resultType: 'number',
      operands: [{ type: 'field', value: 'sum.InvoiceLinesView.qty' }, { type: 'constant', value: '2', operator: '*' }] }];

    const payload = legacyPayloadOf(old);
    expect(payload.columns).toEqual(['Products.name', 'sum.InvoiceLinesView.qty']);
    expect(payload.joins.length).toBe(1);

    const spec: ReportSpecV2 = {
      version: 2,
      entity: 'invoiceLines',
      columns: [
        { field: 'product.name', as: 'Products.name' },
        { field: 'qty', agg: 'sum', as: 'sum.InvoiceLinesView.qty' },
      ],
      groupBy: ['product.name'],
      sort: [{ field: 'qty', agg: 'sum', dir: 'desc' }],
    };
    const { sheet: s } = upgradeLegacySheet(old, spec, index);
    expect(s.primaryTable).toBe('invoiceLines');
    expect(s.joins).toEqual([]);
    expect(s.chartType).toBe('pie');
    expect(s.columnsShelf[0]).toEqual(expect.objectContaining({ col: 'invoiceLines.product.name', alias: 'Item' }));
    expect(s.rowsShelf[0].format).toEqual({ type: 'number', decimals: 0 });
    expect(s.sortBy).toEqual([{ id: 'sum.invoiceLines.qty', mod: 'DESC' }]);
    expect(s.calculatedFields[0].operands[0].value).toBe('sum.invoiceLines.qty');
  });
});

describe('values', () => {
  it('reads ISO timestamps as the local day the user picked', () => {
    const local = new Date(2026, 9, 7); // local midnight, 7 Oct 2026
    expect(toDay(local.toISOString())).toBe('2026-10-07');
    expect(toDay('2026-10-07')).toBe('2026-10-07');
  });

  it('parses numeric columns declared by the run result', () => {
    const rows: Record<string, any>[] = [{ a: '1.50', b: '0042', c: 'x' }];
    coerceByRunColumns(rows, [
      { key: 'a', label: 'a', type: 'number' },
      { key: 'b', label: 'b', type: 'text' },
    ]);
    expect(rows[0]).toEqual({ a: 1.5, b: '0042', c: 'x' });
  });
});
