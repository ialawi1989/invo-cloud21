import { describe, it, expect } from 'vitest';

import {
  generateVariants,
  regenerateBarcodesAndSkus,
  buildBarcodeComparison,
  allDimensionsHaveAttributes,
  normalizeName,
} from './variant-generator';
import {
  Dimension,
  MatrixProduct,
  emptyDimension,
  emptyAttribute,
} from '../services/matrix-item.types';

function dim(name: string, attrs: { name: string; code: string }[]): Dimension {
  return {
    ...emptyDimension(),
    name,
    type: name.toLowerCase(),
    attributes: attrs.map((a) => ({ ...emptyAttribute(), name: a.name, code: a.code })),
  };
}

const branches = [{ id: 'b1', name: 'Main' }, { id: 'b2', name: 'Warehouse' }];

describe('generateVariants', () => {
  it('produces the cartesian product with derived name/barcode/sku', () => {
    const dims = [
      dim('Color', [{ name: 'Red', code: 'RED' }, { name: 'Blue', code: 'BLU' }]),
      dim('Size', [{ name: 'Small', code: 'SML' }, { name: 'Large', code: 'LAR' }]),
    ];
    const out = generateVariants({
      matrixName: 'Tee',
      matrixBarcode: '100',
      unitCost: 5,
      dimensions: dims,
      branches,
      previous: [],
    });

    expect(out).toHaveLength(4);
    const first = out[0];
    expect(first.name).toBe('Tee Red Small');
    expect(first.barcode).toBe('100REDSML');
    expect(first.sku).toBe('100_RED_SML');
    expect(first.attribute1).toBe('Red');
    expect(first.attribute2).toBe('Small');
    expect(first.attribute3).toBe('');
    // one branchProduct row seeded per branch, cost carried from unitCost
    expect(first.branchProduct).toHaveLength(2);
    expect(first.branchProduct[0]).toMatchObject({ branchId: 'b1', openingBalanceCost: 5 });
  });

  it('handles a single dimension', () => {
    const out = generateVariants({
      matrixName: 'Mug',
      matrixBarcode: 'M',
      unitCost: 0,
      dimensions: [dim('Color', [{ name: 'Red', code: 'RED' }])],
      branches,
      previous: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0].barcode).toBe('MRED');
    expect(out[0].sku).toBe('M_RED');
  });

  it('handles three dimensions', () => {
    const out = generateVariants({
      matrixName: 'X',
      matrixBarcode: '9',
      unitCost: 1,
      dimensions: [
        dim('Color', [{ name: 'Red', code: 'R' }]),
        dim('Size', [{ name: 'Small', code: 'S' }]),
        dim('Material', [{ name: 'Cotton', code: 'C' }]),
      ],
      branches,
      previous: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0].barcode).toBe('9RSC');
    expect(out[0].sku).toBe('9_R_S_C');
    expect(out[0].attribute3).toBe('Cotton');
  });

  it('preserves id and branchProduct of matching previous products', () => {
    const previous: MatrixProduct[] = [
      {
        id: 'prod-1',
        name: 'Tee Red ',
        barcode: '100RED',
        sku: '100_RED',
        attribute1: 'Red',
        attribute2: '',
        attribute3: '',
        branchProduct: [
          { branchId: 'b1', onHand: 7, price: 20, openingBalance: 7, openingBalanceCost: 5 },
        ],
      },
    ];
    const out = generateVariants({
      matrixName: 'Tee',
      matrixBarcode: '100',
      unitCost: 5,
      dimensions: [dim('Color', [{ name: 'Red', code: 'RED' }, { name: 'Blue', code: 'BLU' }])],
      branches,
      previous,
    });
    const red = out.find((p) => p.attribute1 === 'Red')!;
    const blue = out.find((p) => p.attribute1 === 'Blue')!;
    expect(red.id).toBe('prod-1');
    expect(red.branchProduct[0].onHand).toBe(7);
    // brand-new combo gets a fresh id + seeded branch rows
    expect(blue.id).toBe('');
    expect(blue.branchProduct[0].onHand).toBe(0);
  });

  it('collapses stray whitespace in the matrix and attribute names so the generated name has no double/trailing spaces', () => {
    const out = generateVariants({
      matrixName: '  newMatrixTesting  ',
      matrixBarcode: '1',
      unitCost: 0,
      dimensions: [dim('Color', [{ name: ' Red  ', code: 'RED' }])],
      branches,
      previous: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('newMatrixTesting Red');
    expect(out[0].name).not.toMatch(/ {2}/);
    expect(out[0].name).not.toMatch(/^ | $/);
  });

  it('returns empty for zero dimensions', () => {
    expect(
      generateVariants({
        matrixName: 'x', matrixBarcode: 'x', unitCost: 0,
        dimensions: [], branches, previous: [],
      }),
    ).toEqual([]);
  });
});

describe('regenerateBarcodesAndSkus', () => {
  it('rewrites the parent prefix while keeping the variant suffix', () => {
    const products: MatrixProduct[] = [
      {
        id: '1', name: 'Tee Red', barcode: '100RED', sku: '100_RED',
        attribute1: 'Red', attribute2: '', attribute3: '', branchProduct: [],
      },
    ];
    const [p] = regenerateBarcodesAndSkus(products, '100', '200');
    expect(p.barcode).toBe('200RED');
    expect(p.sku).toBe('200_RED');
  });
});

describe('buildBarcodeComparison', () => {
  it('produces old/new rows', () => {
    const products: MatrixProduct[] = [
      {
        id: '1', name: 'Tee Red', barcode: '100RED', sku: '100_RED',
        attribute1: 'Red', attribute2: '', attribute3: '', branchProduct: [],
      },
    ];
    const [row] = buildBarcodeComparison(products, '100', '200');
    expect(row).toMatchObject({
      name: 'Tee Red',
      oldBarcode: '100RED', newBarcode: '200RED',
      oldSku: '100_RED', newSku: '200_RED',
    });
  });
});

describe('normalizeName', () => {
  it('collapses repeated internal whitespace and trims the ends', () => {
    expect(normalizeName('  Red   Small  ')).toBe('Red Small');
  });
  it('coerces null/undefined to an empty string', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('allDimensionsHaveAttributes', () => {
  it('is false when empty or any dimension lacks attributes', () => {
    expect(allDimensionsHaveAttributes([])).toBe(false);
    expect(allDimensionsHaveAttributes([dim('Color', [])])).toBe(false);
  });
  it('is true when every dimension has at least one attribute', () => {
    expect(allDimensionsHaveAttributes([dim('Color', [{ name: 'Red', code: 'R' }])])).toBe(true);
  });
});
