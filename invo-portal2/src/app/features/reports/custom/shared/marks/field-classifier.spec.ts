import { describe, expect, it } from 'vitest';
import { classifyColumnKey, classifyField } from './field-classifier';

describe('classifyField', () => {
  it('treats identifier-style names as dimension/identifier even when type=number', () => {
    const r = classifyField({ id: 'barcode', type: 'number' });
    expect(r.role).toBe('dimension');
    expect(r.subtype).toBe('identifier');
  });

  it('treats backend boolean type as dimension/boolean', () => {
    const r = classifyField({ id: 'isWaste', type: 'boolean' });
    expect(r.role).toBe('dimension');
    expect(r.subtype).toBe('boolean');
  });

  it('treats `isX` name as boolean even when type=number', () => {
    const r = classifyField({ id: 'isPaid', type: 'number' });
    expect(r.role).toBe('dimension');
    expect(r.subtype).toBe('boolean');
  });

  it('promotes numberFormat=currency to measure/number', () => {
    const r = classifyField({ id: 'roundingTotal', type: 'number', numberFormat: 'currency' });
    expect(r.role).toBe('measure');
    expect(r.subtype).toBe('number');
  });

  it('promotes numberFormat=integer to measure/integer', () => {
    const r = classifyField({ id: 'value', type: 'number', numberFormat: 'integer' });
    expect(r.role).toBe('measure');
    expect(r.subtype).toBe('integer');
  });

  it('integer name (guests, qty…) becomes measure/integer', () => {
    expect(classifyField({ id: 'guests', type: 'number' }).subtype).toBe('integer');
    expect(classifyField({ id: 'qty', type: 'number' }).subtype).toBe('integer');
  });

  it('date type becomes dimension/date', () => {
    const r = classifyField({ id: 'createdAt', type: 'date' });
    expect(r.role).toBe('dimension');
    expect(r.subtype).toBe('date');
  });

  it('plain number type without overrides becomes measure/number', () => {
    const r = classifyField({ id: 'total', type: 'number' });
    expect(r.role).toBe('measure');
    expect(r.subtype).toBe('number');
  });

  it('falls back to dimension/text for unknown types', () => {
    const r = classifyField({ id: 'note', type: 'text' });
    expect(r.role).toBe('dimension');
    expect(r.subtype).toBe('text');
  });

  it('reports cardinality from sample values', () => {
    const r = classifyField({ id: 'region', type: 'text' }, ['N', 'N', 'S', 'E', '', null]);
    expect(r.cardinality).toBe(3);
  });

  it('sniffs numeric sample when type is missing', () => {
    const r = classifyField({ id: 'mystery', type: '' as any }, ['1', '2', '3.5', '4']);
    expect(r.role).toBe('measure');
    expect(r.subtype).toBe('number');
  });

  it('sniffs date sample when type is missing', () => {
    const r = classifyField({ id: 'mystery', type: '' as any }, [
      '2026-01-01', '2026-02-01', '2026-03-01',
    ]);
    expect(r.role).toBe('dimension');
    expect(r.subtype).toBe('date');
  });
});

describe('classifyColumnKey', () => {
  const fields = [
    { id: 'total', type: 'number', numberFormat: 'currency' },
    { id: 'guests', type: 'number' },
    { id: 'id', type: 'text' },
    { id: 'createdAt', type: 'date' },
    { id: 'isPaid', type: 'boolean' },
    { id: 'barcode', type: 'number' },
  ];

  it('SUM(*) always produces a measure', () => {
    const r = classifyColumnKey('sum.SalesView.total', fields);
    expect(r.role).toBe('measure');
    expect(r.subtype).toBe('number');
  });

  it('COUNT(*) is integer', () => {
    const r = classifyColumnKey('count.SalesView.id', fields);
    expect(r.subtype).toBe('integer');
  });

  it('SUM(guests) is integer (name-based)', () => {
    const r = classifyColumnKey('sum.SalesView.guests', fields);
    expect(r.subtype).toBe('integer');
  });

  it('date-part prefix produces dimension/text', () => {
    const r = classifyColumnKey('yearmonth.SalesView.createdAt', fields);
    expect(r.role).toBe('dimension');
    expect(r.subtype).toBe('text');
  });

  it('plain column resolves the underlying field', () => {
    expect(classifyColumnKey('SalesView.barcode', fields).subtype).toBe('identifier');
    expect(classifyColumnKey('SalesView.isPaid', fields).subtype).toBe('boolean');
    expect(classifyColumnKey('SalesView.createdAt', fields).subtype).toBe('date');
    expect(classifyColumnKey('SalesView.total', fields).role).toBe('measure');
  });

  it('unknown plain column falls back to text', () => {
    const r = classifyColumnKey('Unknown.x', fields);
    expect(r.role).toBe('dimension');
    expect(r.subtype).toBe('text');
  });
});
