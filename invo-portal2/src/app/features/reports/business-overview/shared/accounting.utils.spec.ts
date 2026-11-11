import { describe, expect, it } from 'vitest';
import {
  fillMissingColumns, groupByAnchor, groupByParentType, rowTotal, summarySubValue, summaryValue,
  sumColumns, totalsOf, totalsOfParentType, totalsWithSub, ReportRecord,
} from './accounting.utils';

const rec = (over: Partial<ReportRecord>, ...vals: Array<[string, number]>): ReportRecord => ({
  summary: vals.map(([c, v]) => ({ [c]: v })), ...over,
});

describe('summary readers', () => {
  const s = [{ '2025': 10 }, { '2024': { 'Net Debit': 4, 'Net Credit': 1 } }];
  it('reads plain and sub values, 0 when absent', () => {
    expect(summaryValue(s as any, '2025')).toBe(10);
    expect(summaryValue(s as any, '2023')).toBe(0);
    expect(summaryValue(s as any, '2024')).toBe(0); // object, not a number
    expect(summarySubValue(s as any, '2024', 'Net Debit')).toBe(4);
    expect(summarySubValue(s as any, '2025', 'Net Debit')).toBe(0);
    expect(summaryValue(null, 'x')).toBe(0);
  });
  it('rowTotal / sumColumns ignore NaN and missing', () => {
    expect(rowTotal([{ a: 1 }, { b: 2 }], ['a', 'b', 'c'])).toBe(3);
    expect(sumColumns({ a: 1, b: NaN as any }, ['a', 'b'])).toBe(1);
  });
});

describe('fillMissingColumns', () => {
  it('adds zeroed entries, zeroed sub-columns when present, keeps existing', () => {
    const r: ReportRecord[] = [{ summary: [{ A: 5 }] }, {}];
    fillMissingColumns(r, ['A', 'B']);
    expect(summaryValue(r[0].summary, 'B')).toBe(0);
    expect(summaryValue(r[0].summary, 'A')).toBe(5);
    expect(r[1].summary).toHaveLength(2);

    const t: ReportRecord[] = [{}];
    fillMissingColumns(t, ['A'], ['Net Debit', 'Net Credit']);
    expect(t[0].summary![0]['A']).toEqual({ 'Net Debit': 0, 'Net Credit': 0 });
  });
});

describe('totals', () => {
  const rows = [
    rec({ parentType: 'Income' }, ['A', 10], ['B', 1]),
    rec({ parentType: 'Income' }, ['A', 5]),
    rec({ parentType: 'Expense' }, ['A', 3], ['B', 2]),
  ];
  it('totalsOf / by parent type', () => {
    expect(totalsOf(rows, ['A', 'B'])).toEqual({ A: 18, B: 3 });
    expect(totalsOfParentType(rows, 'Income', ['A', 'B'])).toEqual({ A: 15, B: 1 });
    expect(totalsOfParentType(rows, ['Income', 'Expense'], ['A'])).toEqual({ A: 18 });
  });
  it('totalsWithSub', () => {
    const r: ReportRecord[] = [
      { summary: [{ Y: { D: 1, C: 2 } }] }, { summary: [{ Y: { D: 3, C: 0 } }] },
    ];
    expect(totalsWithSub(r, ['Y'], ['D', 'C'])).toEqual({ Y: { D: 4, C: 2 } });
  });
});

describe('groupByParentType', () => {
  it('orders by sectionOrder, unknown last (stable), groups by type, totals per section', () => {
    const rows = [
      rec({ parentType: 'Zeta', type: 'z' }, ['A', 1]),
      rec({ parentType: 'Expense', type: 'Operating Expense' }, ['A', 4]),
      rec({ parentType: 'Income', type: 'Operating Income' }, ['A', 9]),
      rec({ parentType: 'Income', type: 'Other Income' }, ['A', 1]),
      rec({ parentType: 'Alpha', type: 'a' }, ['A', 2]),
    ];
    const g = groupByParentType(rows, ['A'], ['Income', 'Expense']);
    expect(g.map(x => x.parentType)).toEqual(['Income', 'Expense', 'Zeta', 'Alpha']);
    expect(g[0].childs.map(c => c.type)).toEqual(['Operating Income', 'Other Income']);
    expect(g[0].total).toEqual({ A: 10 });
  });
  it('handles empty input', () => {
    expect(groupByParentType([], ['A'], [])).toEqual([]);
  });
});

describe('groupByAnchor (2-level account tree)', () => {
  const cols = ['A'];
  it('folds level-2 rows under their level-1 anchor; header = own + children', () => {
    const rows = [
      rec({ accountId: 'p', level: 1, account: 'Parent' }, ['A', 10]),
      rec({ accountId: 'c1', parentId: 'p', level: 2 }, ['A', 3]),
      rec({ accountId: 'c2', parentId: 'p', level: 2 }, ['A', 2]),
      rec({ accountId: 'x', level: 1 }, ['A', 7]),
    ];
    const g = groupByAnchor(rows, cols);
    expect(g).toHaveLength(2);
    expect(g[0].anchor.accountId).toBe('p');
    expect(g[0].hasChildren).toBe(true);
    expect(g[0].children.map(c => c.accountId)).toEqual(['c1', 'c2']);
    expect(g[0].header).toEqual({ A: 15 });
    expect(g[1].hasChildren).toBe(false);
  });
  it('keeps id-less rows (Retained Earning / Net Profit) as separate lines', () => {
    const g = groupByAnchor([rec({ account: 'Retained Earning' }, ['A', 1]), rec({ account: 'Net Profit' }, ['A', 2])], cols);
    expect(g).toHaveLength(2);
    expect(g.every(x => !x.hasChildren)).toBe(true);
  });
  it('picks the level-1 row as anchor even when a child comes first', () => {
    const g = groupByAnchor([
      rec({ accountId: 'c', parentId: 'p', level: 2 }, ['A', 1]),
      rec({ accountId: 'p', level: 1 }, ['A', 5]),
    ], cols);
    expect(g[0].anchor.accountId).toBe('p');
    expect(g[0].header).toEqual({ A: 6 });
  });
  it('empty → []', () => expect(groupByAnchor([], cols)).toEqual([]));
});

import { computeProfitLines } from './accounting.utils';

describe('computeProfitLines', () => {
  const rows = (equity: number): ReportRecord[] => [
    rec({ parentType: 'Operating Income' }, ['A', 1000]),
    rec({ parentType: 'Costs Of Goods Sold' }, ['A', -300]), // sign differs by backend → abs
    rec({ parentType: 'Operating Expense' }, ['A', 200]),
    rec({ parentType: 'Equity' }, ['A', equity]),
  ];
  it('gross = income − |cogs|; operating = gross − |opex|', () => {
    const p = computeProfitLines(rows(0), ['A']);
    expect(p.gross).toEqual({ A: 700 });
    expect(p.operating).toEqual({ A: 500 });
  });
  it('net falls back to operating when equity is empty', () => {
    expect(computeProfitLines(rows(0), ['A']).net).toEqual({ A: 500 });
  });
  it('net uses the API equity total when it has data', () => {
    expect(computeProfitLines(rows(480), ['A']).net).toEqual({ A: 480 });
  });
  it('net ignores an overflowed equity total', () => {
    expect(computeProfitLines(rows(5e15), ['A']).net).toEqual({ A: 500 });
  });
});

describe('computeProfitLines — backend lines win over derivation', () => {
  it('uses the API Gross/Operating Profit rows when present (matches the table)', () => {
    const rows: ReportRecord[] = [
      rec({ parentType: 'Operating Income' }, ['A', 64.435]),
      rec({ parentType: 'Costs Of Goods Sold' }, ['A', 22409]), // positive COGS: abs() would turn this into a cost
      rec({ parentType: 'Gross Profit' }, ['A', 22473.435]),    // backend: income + cogs
      rec({ parentType: 'Operating Profit' }, ['A', 22188.435]),
    ];
    const p = computeProfitLines(rows, ['A']);
    expect(p.gross).toEqual({ A: 22473.435 });
    expect(p.operating).toEqual({ A: 22188.435 });
    expect(p.net).toEqual({ A: 22188.435 }); // no Equity rows → operating
  });
});

import { periodChipLabel } from './accounting.utils';

describe('periodChipLabel', () => {
  it('month periods keep the year: Mar/2026 → Mar 26', () => {
    expect(periodChipLabel('Mar/2026')).toBe('Mar 26');
    expect(periodChipLabel('September/2025')).toBe('Sep 25');
  });
  it('years and short names pass through', () => {
    expect(periodChipLabel('2025')).toBe('2025');
    expect(periodChipLabel('Main')).toBe('Main');
  });
  it('long branch names are trimmed with an ellipsis', () => {
    expect(periodChipLabel('Downtown Flagship Store')).toBe('Downtown Fl…');
  });
});

import { periodHeaderLabel } from './accounting.utils';

describe('periodHeaderLabel', () => {
  it('turns month/year into a readable header and leaves everything else alone', () => {
    expect(periodHeaderLabel('Mar/2026')).toBe('Mar 2026');
    expect(periodHeaderLabel('2025')).toBe('2025');
    expect(periodHeaderLabel('Main/Branch')).toBe('Main/Branch');
    expect(periodHeaderLabel('Total')).toBe('Total');
  });
});
