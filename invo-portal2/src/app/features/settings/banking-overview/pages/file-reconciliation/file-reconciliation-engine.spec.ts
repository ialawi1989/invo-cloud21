import { describe, it, expect } from 'vitest';

import { ColumnMapping, CsvRow, reconcile, shiftDateKey } from './file-reconciliation-engine';

const M: ColumnMapping = { referenceCol: 'Reference', amountCol: 'Amount', dateCol: 'Date' };
const row = (Reference: string, Amount: string, Date: string): CsvRow => ({ Reference, Amount, Date });

describe('reconcile — date window', () => {
  const statement = [row('', '100', '2024-10-23')];
  const books = [row('A', '100', '2024-10-21')];

  it('does not match a different day when the window is 0 (default)', () => {
    expect(reconcile(statement, books, M, M, 'amount-date', 0).matched.length).toBe(0);
  });

  it('matches within ±N days and reports the day difference', () => {
    const r = reconcile(statement, books, M, M, 'amount-date', 0, 2);
    expect(r.matched.length).toBe(1);
    expect(r.matched[0].dayDiff).toBe(2);
    expect(reconcile(statement, books, M, M, 'amount-date', 0, 1).matched.length).toBe(0);
  });

  it('prefers the nearest date when amounts are equal', () => {
    const r = reconcile([row('', '50', '2024-10-22')], [row('far', '50', '2024-10-20'), row('near', '50', '2024-10-23')], M, M, 'amount-date', 0, 3);
    expect(r.matched[0].file2['Reference']).toBe('near');
  });

  it('crosses month and year ends', () => {
    expect(shiftDateKey('2024-12-31', 1)).toBe('2025-01-01');
    expect(shiftDateKey('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftDateKey('not a date', 1)).toBeNull();
  });

  it('never reuses a book row for two statement lines', () => {
    const r = reconcile([row('', '10', '2024-10-21'), row('', '10', '2024-10-22')], [row('only', '10', '2024-10-21')], M, M, 'amount-date', 0, 2);
    expect(r.matched.length).toBe(1);
    expect(r.unmatchedFile1.length).toBe(1);
  });
});
