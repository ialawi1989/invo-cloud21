/** `onHand adjustment` changes the quantity on hand; `unitCost adjustment` re-values the stock (and can't be edited once saved). */
export type AdjustmentType = 'onHand adjustment' | 'unitCost adjustment';

/**
 * One product of an adjustment. `qty` is the DELTA sent to the backend (new on-hand minus the on-hand at the time),
 * `newQty` is what the user types ("new quantity on hand") and `cost` is the NEW unit cost of a unit-cost adjustment.
 */
export interface AdjustmentLine {
  /** `''` for a line that was never saved. */
  id: string;
  productId: string;
  productName: string;
  UOM: string;
  barcode: string;
  qty: number;
  newQty: number;
  currentOnHand: number;
  currentCost: number;
  cost: number;
  /** A saved line the user removed (the backend deletes it on save). */
  isDeleted?: boolean;
  /** Added in this editing session (only these can be removed from a saved adjustment, as in legacy). */
  isNew?: boolean;
}

export interface ManualAdjustment {
  id: string;
  adjustmentType: AdjustmentType;
  inventoryMovmentDate: string;
  branchId: string;
  branchName: string;
  employeeName: string;
  cost: number;
  lines: AdjustmentLine[];
}

/** One row of the list (`accounts/getManualAdjustmentMovementList`). */
export interface AdjustmentRow {
  id: string;
  branchName: string;
  employeeName: string;
  adjustmentType: AdjustmentType | null;
  inventoryMovmentDate: string;
  createdAt: string;
  cost: number;
}

export interface AdjustmentListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: string };
  filter?: { branches?: string[]; fromDate?: string | null; toDate?: string | null };
}

export interface AdjustmentListResult { list: AdjustmentRow[]; count: number; pageCount: number }

/** A product of the branch to pick (`accounts/getManualAdjustmentProducts`). */
export interface AdjustmentProduct {
  id: string;
  name: string;
  barcode: string;
  UOM: string;
  categoryName: string;
  onHand: number;
  unitCost: number;
}

export const isUnitCost = (t: AdjustmentType | string | null | undefined): boolean => t === 'unitCost adjustment';

/** What the line changes in the stock value: delta x cost for quantity adjustments, the new cost for a re-valuation. */
export function lineImpact(type: AdjustmentType, l: AdjustmentLine): number {
  return isUnitCost(type) ? l.cost : l.qty * l.cost;
}
