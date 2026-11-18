import { describe, it, expect } from 'vitest';
import { elementFromWire, elementToWire } from './receipt-wire';
import { makeTableLines, makeTablePayments, makeTableTaxes, makeZatcaQr, defaultReceiptElements } from './receipt-builder.types';

describe('receipt wire format (matches the legacy builder and POS)', () => {
  it('writes an invoice-lines table as TableInvoiceLines / invoice.lines', () => {
    const w: any = elementToWire(makeTableLines());
    expect(w.type).toBe('TableInvoiceLines');
    expect(w.source).toBe('invoice.lines');
  });

  it('keeps taxes and payments as Table with their ! sources, using the legacy cells', () => {
    const t: any = elementToWire(makeTableTaxes());
    expect([t.type, t.source]).toEqual(['Table', '!invoice.taxes']);
    expect(t.groups[0].rows[0].cells.map((c: any) => [c.key, c.value])).toEqual([['name', '!name'], ['total', '!total.number()']]);
    const p: any = elementToWire(makeTablePayments());
    expect(p.groups[0].rows[0].cells.map((c: any) => [c.key, c.value])).toEqual([
      ['paymentMethod', '!paymentMethod.name'], ['amount', '!tenderAmount (!tenderEquivalent.currency())']]);
  });

  it('writes every field the legacy classes write and no client-only keys', () => {
    const w: any = elementToWire(makeTableLines());
    expect(w.id).toBeTruthy();
    expect(w.options).toMatchObject({ showOptions: true, showPrice: true, showKitchenName: false });
    expect(JSON.stringify(w)).not.toContain('__key');
    expect(w.groups[0].source).toBe('none');
    expect(w.groups[0].rows[0]).toMatchObject({ rowType: 'static', source: {}, rows: [], visible: { value: '', operator: '', property: '' } });
    expect(w.groups[0].rows[0].cells[0]).toMatchObject({ type: '', isSelected: false });
  });

  it('reads legacy lines tables, and tables an earlier build saved the new way', () => {
    const legacy: any = elementFromWire({ type: 'TableInvoiceLines', source: 'invoice.lines', groups: [] });
    expect([legacy.type, legacy.source]).toEqual(['Table', '!invoice.lines']);
    const earlier: any = elementFromWire({ type: 'Table', source: '!invoice.lines', groups: [] });
    expect([earlier.type, earlier.source]).toEqual(['Table', '!invoice.lines']);
  });

  it('migrates product.name.number() and un-requires product.name, like the legacy loader', () => {
    const el: any = elementFromWire({ type: 'TableInvoiceLines', source: 'invoice.lines', groups: [{ rows: [{ cells: [
      { key: 'product.name.number()', isRequired: true }, { key: 'qty', isRequired: true }] }] }] });
    const cells = el.groups[0].rows[0].cells;
    expect(cells[0]).toMatchObject({ key: 'product.name', isRequired: false });
    expect(cells[1].isRequired).toBe(true);
  });

  it('round-trips the default receipt without changing it', () => {
    const once = defaultReceiptElements().map(elementToWire);
    const twice = once.map((e) => elementToWire(elementFromWire(e)));
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it('keeps the ZATCA QR markers', () => {
    const w: any = elementToWire(makeZatcaQr());
    expect(w).toMatchObject({ type: 'QrCode', childType: 'ZatcaQrCode', printAsImage: true, value: '!invoice.zatcaCode' });
  });
});
