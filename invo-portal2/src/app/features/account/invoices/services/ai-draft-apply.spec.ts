import { describe, it, expect } from 'vitest';

import { appendDraftLines, DraftLineEditor } from './ai-draft-apply';

/** A tiny stand-in for the real editor: addLine pushes a blank line onto the document, like DocumentLineEditor. */
function setup(initial: any[]) {
  const doc = { lines: initial, total: 0, calculateTotal() { this.total++; } };
  const editor: DraftLineEditor & { chosen: any[] } = {
    chosen: [],
    accounts: [{ id: 'acc-1' }],
    addLine() { const l: any = { productId: '', note: '', accountId: '' }; doc.lines.push(l); return l; },
    chooseItem(line: any, product: any) { line.productId = product.id; line.price = product.price; this.chosen.push(product.id); },
    get lastLineIsEmpty() { const l: any = doc.lines[doc.lines.length - 1]; return !l?.productId && !l?.note; },
  };
  return { doc, editor };
}

describe('appendDraftLines', () => {
  it('replaces the blank row with the products, sets qty, defaults the account and keeps a blank row at the end', () => {
    const { doc, editor } = setup([{ productId: '', note: '' }]);
    appendDraftLines(doc, editor, [
      { product: { id: 'p1', price: 5 }, qty: 3 },
      { product: { id: 'p2', price: 2 }, qty: 1 },
    ]);
    expect(doc.lines.map((l: any) => l.productId || null)).toEqual(['p1', 'p2', null]);
    expect(doc.lines[0]).toMatchObject({ qty: 3, tempQty: 3, accountId: 'acc-1', index: 0 });
    expect(doc.lines[1]).toMatchObject({ qty: 1, index: 1 });
    expect(doc.lines[2].index).toBe(2);
    expect(doc.total).toBe(1);
  });

  it('keeps lines the user already has and appends after them', () => {
    const { doc, editor } = setup([{ productId: 'old', note: '' }, { productId: '', note: '' }]);
    appendDraftLines(doc, editor, [{ product: { id: 'p1', price: 1 }, qty: 2 }]);
    expect(doc.lines.map((l: any) => l.productId || null)).toEqual(['old', 'p1', null]);
  });

  it('chooses every product through the editor (price and tax rules live there)', () => {
    const { doc, editor } = setup([]);
    appendDraftLines(doc, editor, [{ product: { id: 'p9', price: 7 }, qty: 1 }]);
    expect(editor.chosen).toEqual(['p9']);
    expect(doc.lines[0].price).toBe(7);
  });
});
