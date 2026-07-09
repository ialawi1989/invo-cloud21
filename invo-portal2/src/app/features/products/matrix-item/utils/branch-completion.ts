/**
 * Pure helpers for the matrix form's per-branch completion indicator and the
 * bulk apply/copy actions. Dependency-free so they're unit-testable without an
 * Angular harness.
 */

import { MatrixProduct } from '../services/matrix-item.types';

export type BranchFill = 'done' | 'partial' | 'empty';

/** Editable per-branch fields the bulk actions copy between branches. */
const COPY_FIELDS = ['openingBalance', 'openingBalanceCost', 'price'] as const;

/**
 * A variant row is "filled" based on the field the user actually edits for that
 * variant type:
 *   • EXISTING variant (has an `id`) → the per-branch **Price** is set (> 0).
 *     (On Hand is read-only stock, not something the user fills here.)
 *   • NEW variant (no id yet)        → both **opening balance and cost** are set.
 */
function rowFilled(product: MatrixProduct, bp?: MatrixProduct['branchProduct'][number]): boolean {
  if (!bp) return false;
  if (product.id) return (bp.price ?? 0) > 0;
  return bp.openingBalance > 0 && bp.openingBalanceCost > 0;
}

/**
 * Derive each branch's completion from the variant rows:
 *   • `done`    — every variant row for the branch is filled
 *   • `partial` — some are filled
 *   • `empty`   — none (or there are no variants)
 */
export function deriveBranchCompletion(
  products: MatrixProduct[],
  branchIds: string[],
): Record<string, BranchFill> {
  const out: Record<string, BranchFill> = {};
  for (const id of branchIds) {
    if (products.length === 0) {
      out[id] = 'empty';
      continue;
    }
    let filled = 0;
    for (const p of products) {
      if (rowFilled(p, p.branchProduct?.find((b) => b.branchId === id))) filled++;
    }
    out[id] = filled === 0 ? 'empty' : filled === products.length ? 'done' : 'partial';
  }
  return out;
}

/** Copy the editable fields from `src` onto `bp` (returns a new row). */
function withCopied<T extends Record<string, any>>(bp: T, src: Record<string, any>): T {
  const next = { ...bp };
  for (const f of COPY_FIELDS) next[f as keyof T] = src[f];
  return next;
}

/**
 * Copy the source branch's per-variant values onto **every** branch. Pure —
 * returns a new `products` array; unaffected rows keep their identity.
 */
export function applyBranchToAll(
  products: MatrixProduct[],
  sourceBranchId: string,
  branchIds: string[],
): MatrixProduct[] {
  const targets = new Set(branchIds);
  return products.map((p) => {
    const src = p.branchProduct.find((b) => b.branchId === sourceBranchId);
    if (!src) return p;
    return {
      ...p,
      branchProduct: p.branchProduct.map((bp) =>
        bp.branchId !== sourceBranchId && targets.has(bp.branchId) ? withCopied(bp, src) : bp,
      ),
    };
  });
}

/**
 * Copy the source branch's per-variant values into the target (active) branch
 * only. Pure. No-op when source === target.
 */
export function copyBranchInto(
  products: MatrixProduct[],
  sourceBranchId: string,
  targetBranchId: string,
): MatrixProduct[] {
  if (!sourceBranchId || !targetBranchId || sourceBranchId === targetBranchId) return products;
  return products.map((p) => {
    const src = p.branchProduct.find((b) => b.branchId === sourceBranchId);
    if (!src) return p;
    return {
      ...p,
      branchProduct: p.branchProduct.map((bp) =>
        bp.branchId === targetBranchId ? withCopied(bp, src) : bp,
      ),
    };
  });
}
