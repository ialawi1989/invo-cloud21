import { describe, expect, it } from 'vitest';
import { Product } from './product';

describe('Product alias barcodes', () => {
  it('ParseJson maps server barcodes into the editor shape', () => {
    const p = new Product();
    p.ParseJson({ barcodes: [{ barcode: 'A1' }, { barcode: 'B2' }] });
    expect(p.barcodesArr).toEqual([{ value: 'A1' }, { value: 'B2' }]);
  });

  it('getBarcodes flattens editor rows to the backend payload shape', () => {
    const p = new Product();
    p.barcodesArr = [{ value: 'A1' }, { value: 'C3' }];
    expect(p.getBarcodes).toEqual([{ barcode: 'A1' }, { barcode: 'C3' }]);
  });

  it('ParseJson keeps departmentId returned by the backend', () => {
    const p = new Product();
    p.ParseJson({ departmentId: 'dep-1', categoryId: 'cat-1' });
    expect(p.departmentId).toBe('dep-1');
  });
});
