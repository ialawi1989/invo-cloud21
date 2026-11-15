export type CountStatus = 'Open' | 'Calculated' | 'Closed';

/** How a count was started (the legacy `type` strings, kept verbatim: the list searches on them). */
export type CountMode = 'by-product' | 'by-all-products' | 'by-inventory' | 'by-category';
export const COUNT_TYPE_BY_MODE: Record<CountMode, string> = {
  'by-product': 'By Product',
  'by-all-products': 'By All Products',
  'by-inventory': 'By Inventory',
  'by-category': 'By category',
};
export const COUNT_MODES = Object.keys(COUNT_TYPE_BY_MODE) as CountMode[];
export const isCountMode = (v: unknown): v is CountMode => COUNT_MODES.includes(v as CountMode);

/** One serial of a serialized product: counted when ticked (found on the shelf). */
export interface CountSerial {
  /** `''` for a serial that was never saved (the backend inserts it). */
  id: string;
  serial: string;
  isAvailable: boolean;
  unitCost: number;
}

/** One batch of a batch product, with the quantity counted. */
export interface CountBatch {
  id: string;
  batch: string;
  enteredQty: number;
  /** On hand in the system (the backend re-reads it on save). */
  expectedQty: number;
  unitCost: number;
  expireDate?: string | null;
}

export interface CountLine {
  /** `''` for a line that was never saved. */
  id: string;
  productId: string;
  productName: string;
  UOM: string;
  barcode: string;
  categoryName: string;
  productType: string;
  unitCost: number;
  /** Plain products (inventory, kit): what was counted / what the system holds. Serial and batch products derive both. */
  enteredQty: number;
  expectedQty: number;
  serials: CountSerial[];
  batches: CountBatch[];
  /** A saved line the user removed (the backend deletes it on save). */
  isDeleted?: boolean;
}

export interface PhysicalCount {
  id: string;
  reference: string;
  status: CountStatus;
  note: string;
  type: string;
  branchId: string;
  branchName: string;
  createdDate: string;
  calculatedDate: string | null;
  closedDate: string | null;
  createdEmployeeId: string | null;
  calculatedEmployeeId: string | null;
  closedEmployeeId: string | null;
  createdEmployeeName: string;
  calculatedEmployeeName: string;
  closedEmployeeName: string;
  lines: CountLine[];
}

/** One row of the list (`product/getphysicalCountList`). */
export interface CountRow {
  id: string;
  reference: string;
  status: CountStatus;
  note: string;
  type: string;
  branchName: string;
  createdDate: string;
  calculatedDate: string | null;
  closedDate: string | null;
}

export interface CountListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: string };
  filter?: { status?: string[]; fromDate?: string | null; toDate?: string | null };
}

export interface CountListResult { list: CountRow[]; count: number; pageCount: number }

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const r3 = (n: number): number => Math.round(n * 1000) / 1000;

export const isSerialLine = (l: CountLine): boolean => l.productType === 'serialized';
export const isBatchLine = (l: CountLine): boolean => l.productType === 'batch';

/** What was counted: ticked serials, the sum of the batch quantities, or the typed quantity. */
export function enteredOf(l: CountLine): number {
  if (isSerialLine(l)) return l.serials.filter(s => s.isAvailable).length;
  if (isBatchLine(l)) return r3(l.batches.reduce((s, b) => s + num(b.enteredQty), 0));
  return num(l.enteredQty);
}

/** What the system holds: every serial / batch on hand, or the line's own expected quantity. */
export function expectedOf(l: CountLine): number {
  if (isSerialLine(l)) return l.serials.length;
  if (isBatchLine(l)) return r3(l.batches.reduce((s, b) => s + num(b.expectedQty), 0));
  return num(l.expectedQty);
}

export const differenceOf = (l: CountLine): number => r3(enteredOf(l) - expectedOf(l));

/** Value of what was counted. */
export function enteredValue(l: CountLine): number {
  if (isSerialLine(l)) return l.serials.filter(s => s.isAvailable).reduce((s, x) => s + num(x.unitCost), 0);
  if (isBatchLine(l)) return l.batches.reduce((s, b) => s + num(b.enteredQty) * num(b.unitCost), 0);
  return num(l.enteredQty) * num(l.unitCost);
}

/** Value of what the system holds. */
export function expectedValue(l: CountLine): number {
  if (isSerialLine(l)) return l.serials.reduce((s, x) => s + num(x.unitCost), 0);
  if (isBatchLine(l)) return l.batches.reduce((s, b) => s + num(b.expectedQty) * num(b.unitCost), 0);
  return num(l.expectedQty) * num(l.unitCost);
}

export interface CountTotals { counted: number; expected: number; difference: number }

/** Counted value, system value and the difference (counted - system: negative = shortage). */
export function totalsOf(lines: CountLine[]): CountTotals {
  const live = lines.filter(l => !l.isDeleted);
  const counted = r3(live.reduce((s, l) => s + enteredValue(l), 0));
  const expected = r3(live.reduce((s, l) => s + expectedValue(l), 0));
  return { counted, expected, difference: r3(counted - expected) };
}
