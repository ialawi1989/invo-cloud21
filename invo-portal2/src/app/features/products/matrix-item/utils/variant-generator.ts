/**
 * Variant generation — the deterministic core of the matrix feature.
 * ─────────────────────────────────────────────────────────────────
 * Pure functions (no Angular, no side effects) so they're unit-testable and
 * reused by both the matrix form and the barcode-change confirmation modal.
 *
 * Derivation rules (must stay byte-for-byte compatible with the legacy app so
 * existing products keep matching on regeneration):
 *   • name    = `${matrixName} ${attr1}[ ${attr2}[ ${attr3}]]`  (trailing space kept)
 *   • barcode = `${matrixBarcode}${code1}${code2}${code3}`       (no separator)
 *   • sku     = `${matrixBarcode}_${[code1, code2, code3].join('_')}`
 */

import {
  BranchProduct,
  Dimension,
  MatrixProduct,
} from '../services/matrix-item.types';

export interface BranchRef {
  id: string;
  name?: string;
}

/** A single old→new barcode/SKU change, shown in the confirmation modal. */
export interface BarcodeComparisonRow {
  name: string;
  oldBarcode: string;
  newBarcode: string;
  oldSku: string;
  newSku: string;
}

function seedBranchProducts(branches: BranchRef[], unitCost: number): BranchProduct[] {
  return branches.map((b) => ({
    branchId: b.id,
    onHand: 0,
    price: 0,
    openingBalance: 0,
    openingBalanceCost: unitCost,
  }));
}

/** Deep-clone via JSON — branchProduct rows are plain data, so this is safe
 *  and matches the legacy `JSON.parse(JSON.stringify(...))` behaviour. */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/**
 * Regenerate the full product list from the current dimensions, preserving the
 * `id`/`productId` and per-branch `branchProduct` of any product that still
 * maps to the same variant (matched by sku → barcode → attribute-name tuple).
 * Supports 1–3 dimensions; 0 dimensions yields an empty list.
 */
export function generateVariants(params: {
  matrixName: string;
  matrixBarcode: string;
  unitCost: number;
  dimensions: Dimension[];
  branches: BranchRef[];
  /** Previous products to carry ids/stock over from. */
  previous: MatrixProduct[];
}): MatrixProduct[] {
  const { matrixName, matrixBarcode, unitCost, dimensions, branches } = params;
  const old = Array.isArray(params.previous) ? clone(params.previous) : [];
  const seed = seedBranchProducts(branches, unitCost);

  const dims = dimensions.slice(0, 3);
  if (dims.length === 0) return [];

  // Build the cartesian product of attribute index tuples.
  const attrLists = dims.map((d) => d.attributes ?? []);
  if (attrLists.some((l) => l.length === 0)) {
    // A dimension with no attributes can't contribute rows — mirror legacy
    // behaviour where the nested loops simply produce nothing.
    if (attrLists.every((l) => l.length === 0)) return [];
  }

  const combos: number[][] = [[]];
  for (const list of attrLists) {
    const next: number[][] = [];
    for (const combo of combos) {
      for (let i = 0; i < list.length; i++) next.push([...combo, i]);
    }
    combos.length = 0;
    combos.push(...next);
  }

  const out: MatrixProduct[] = [];
  for (const combo of combos) {
    const attrs = combo.map((idx, dimIdx) => attrLists[dimIdx][idx]);
    const names = attrs.map((a) => a.name);
    const codes = attrs.map((a) => a.code ?? '');

    const nameSuffix = names.join(' ') + ' ';
    const barcode = matrixBarcode + codes.join('');
    const sku = matrixBarcode + '_' + codes.join('_');

    const attribute1 = names[0] ?? '';
    const attribute2 = names[1] ?? '';
    const attribute3 = names[2] ?? '';

    const existing = old.find(
      (p) =>
        p &&
        (p.sku === sku ||
          p.barcode === barcode ||
          (p.attribute1 === attribute1 &&
            p.attribute2 === attribute2 &&
            p.attribute3 === attribute3)),
    );

    out.push({
      id: existing?.id || existing?.productId || '',
      name: matrixName + ' ' + nameSuffix,
      barcode,
      sku,
      attribute1,
      attribute2,
      attribute3,
      openingBalanceCost: unitCost,
      branchProduct: existing?.branchProduct ? clone(existing.branchProduct) : clone(seed),
      mediaIds: existing?.mediaIds ? clone(existing.mediaIds) : [],
    });
  }

  return out;
}

/**
 * Rewrite every product's barcode/sku after the parent barcode changes,
 * preserving the per-variant suffix. Returns NEW product objects (pure).
 */
export function regenerateBarcodesAndSkus(
  products: MatrixProduct[],
  oldBarcode: string,
  newBarcode: string,
): MatrixProduct[] {
  return (products ?? []).map((p) => {
    const barcodeSuffix = (p.barcode ?? '').substring(oldBarcode.length);
    const skuSuffix = (p.sku ?? '').substring((oldBarcode + '_').length);
    return {
      ...p,
      barcode: newBarcode + barcodeSuffix,
      sku: newBarcode + '_' + skuSuffix,
    };
  });
}

/**
 * Build the old→new diff rows shown in the barcode-change confirmation modal.
 * Same suffix-preserving logic as {@link regenerateBarcodesAndSkus}.
 */
export function buildBarcodeComparison(
  products: MatrixProduct[],
  oldBarcode: string,
  newBarcode: string,
): BarcodeComparisonRow[] {
  return (products ?? []).map((p) => {
    const barcodeSuffix = (p.barcode ?? '').substring(oldBarcode.length);
    const skuSuffix = (p.sku ?? '').substring((oldBarcode + '_').length);
    return {
      name: p.name,
      oldBarcode: p.barcode,
      newBarcode: newBarcode + barcodeSuffix,
      oldSku: p.sku,
      newSku: newBarcode + '_' + skuSuffix,
    };
  });
}

/** Every dimension has at least one attribute — gates the per-branch product
 *  tables in the form (matches the legacy validator). */
export function allDimensionsHaveAttributes(dimensions: Dimension[]): boolean {
  if (!dimensions || dimensions.length === 0) return false;
  return dimensions.every((d) => Array.isArray(d.attributes) && d.attributes.length > 0);
}
