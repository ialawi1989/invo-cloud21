import { describe, expect, it } from 'vitest';

import { MatrixProduct } from '../services/matrix-item.types';
import {
  applyBranchToAll,
  copyBranchInto,
  deriveBranchCompletion,
} from './branch-completion';

interface Row { ob?: number; obc?: number; price?: number }

/** Minimal product factory — `existing` (default true) sets a real id so the
 *  completion helper uses the Price field; new variants use opening balance/cost. */
function prod(sku: string, rows: Record<string, Row>, existing = true): MatrixProduct {
  return {
    id: existing ? sku : '',
    name: sku,
    barcode: sku,
    sku,
    attribute1: '', attribute2: '', attribute3: '',
    branchProduct: Object.entries(rows).map(([branchId, v]) => ({
      branchId,
      onHand: 0,
      price: v.price ?? 0,
      openingBalance: v.ob ?? 0,
      openingBalanceCost: v.obc ?? 0,
    })),
  } as MatrixProduct;
}

const BRANCHES = ['b1', 'b2'];

describe('deriveBranchCompletion', () => {
  it('empty when there are no products', () => {
    expect(deriveBranchCompletion([], BRANCHES)).toEqual({ b1: 'empty', b2: 'empty' });
  });

  it('EXISTING variants count Price > 0 per branch', () => {
    const products = [
      prod('a', { b1: { price: 3 }, b2: { price: 0 } }),
      prod('b', { b1: { price: 1 }, b2: { price: 5 } }),
    ];
    const map = deriveBranchCompletion(products, BRANCHES);
    expect(map['b1']).toBe('done');    // both priced
    expect(map['b2']).toBe('partial'); // one priced, one not
  });

  it('NEW variants count opening balance AND cost > 0', () => {
    const products = [
      prod('a', { b1: { ob: 5, obc: 2 }, b2: { ob: 5, obc: 0 } }, false),
      prod('b', { b1: { ob: 1, obc: 1 }, b2: { ob: 0, obc: 0 } }, false),
    ];
    const map = deriveBranchCompletion(products, BRANCHES);
    expect(map['b1']).toBe('done');   // both filled
    expect(map['b2']).toBe('empty');  // cost 0 → not filled
  });

  it("'partial' when only some rows are filled", () => {
    const products = [
      prod('a', { b1: { price: 9 } }),
      prod('b', { b1: { price: 0 } }),
    ];
    expect(deriveBranchCompletion(products, ['b1'])['b1']).toBe('partial');
  });
});

describe('applyBranchToAll', () => {
  it('copies the source branch values onto every other branch, per variant', () => {
    const products = [
      prod('a', { b1: { ob: 5, obc: 2, price: 10 }, b2: { ob: 0, obc: 0, price: 0 } }),
    ];
    const out = applyBranchToAll(products, 'b1', BRANCHES);
    const b2 = out[0].branchProduct.find((b) => b.branchId === 'b2')!;
    expect(b2).toMatchObject({ openingBalance: 5, openingBalanceCost: 2, price: 10 });
    const b1 = out[0].branchProduct.find((b) => b.branchId === 'b1')!;
    expect(b1).toMatchObject({ openingBalance: 5, openingBalanceCost: 2, price: 10 });
  });

  it('is pure — returns a new array, leaves the input unmutated', () => {
    const products = [prod('a', { b1: { ob: 5, obc: 2 }, b2: { ob: 0, obc: 0 } })];
    const before = JSON.stringify(products);
    applyBranchToAll(products, 'b1', BRANCHES);
    expect(JSON.stringify(products)).toBe(before);
  });
});

describe('copyBranchInto', () => {
  it('copies the source values into the target branch only', () => {
    const products = [
      prod('a', {
        b1: { ob: 5, obc: 2, price: 10 },
        b2: { ob: 1, obc: 1, price: 3 },
        b3: { ob: 0, obc: 0, price: 0 },
      }),
    ];
    const out = copyBranchInto(products, 'b1', 'b2');
    const rows = out[0].branchProduct;
    expect(rows.find((b) => b.branchId === 'b2')).toMatchObject({ openingBalance: 5, openingBalanceCost: 2, price: 10 });
    expect(rows.find((b) => b.branchId === 'b3')).toMatchObject({ openingBalance: 0, openingBalanceCost: 0 });
  });

  it('is a no-op when source === target', () => {
    const products = [prod('a', { b1: { ob: 5, obc: 2 } })];
    expect(copyBranchInto(products, 'b1', 'b1')).toBe(products);
  });
});
