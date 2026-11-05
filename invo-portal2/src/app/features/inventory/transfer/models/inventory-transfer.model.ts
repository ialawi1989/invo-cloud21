export type TransferType = 'Transfer In' | 'Transfer Out';
export type TransferStatus = 'Open' | 'Confirmed';

/** A batch / serial line nested under its parent product line (the backend nests them by `parentId`). */
export interface TransferSubLine {
  id: string;
  qty: number;
  unitCost: number;
  batch: string;
  serial: string;
  expireDate: string | null;
  prodDate: string | null;
  onHand: number;
  isSelected: boolean;
  /** A saved unit the user removed in the transfer-in editor (kept so the backend deletes it). */
  isDeleted?: boolean;
  /** Batch past its expiry date - a transfer out of expired stock ticks it by default. */
  expired?: boolean;
}

export interface TransferLine {
  /** `''` for a line that was never saved. */
  id: string;
  productId: string;
  productName: string;
  UOM: string;
  barcode: string;
  categoryName: string;
  /** `inventory` / `batch` / `serialized` / `kit` ... */
  type: string;
  qty: number;
  unitCost: number;
  onHand: number;
  batches: TransferSubLine[];
  serials: TransferSubLine[];
  /** A saved line the user removed from the form (the backend deletes it on save). */
  isDeleted?: boolean;
}

/** One row of the list (`product/getInventoryTransferList`). */
export interface TransferRow {
  id: string;
  transferNumber: string;
  reference: string;
  status: TransferStatus | string;
  type: TransferType | string;
  reason: string;
  note: string;
  createdDate: string;
  confirmDatetime: string | null;
  employeeId: string;
  branchName: string;
  destinationBranchName: string;
}

export interface InventoryTransfer {
  id: string;
  transferNumber: string;
  reference: string;
  status: TransferStatus | string;
  type: TransferType | string;
  reason: string;
  note: string;
  createdDate: string;
  confirmDatetime: string | null;
  employeeId: string;
  employeeName: string;
  confirmedEmployee: string;
  confirmedEmployeeName: string;
  branchId: string;
  branchName: string;
  destinationBranch: string | null;
  destinationBranchName: string;
  inventoryBalancingAccountId: string | null;
  inventoryRequestId: string;
  lines: TransferLine[];
}

export interface TransferListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: 'asc' | 'desc' };
  filter?: { status?: string[]; fromDate?: string | null; toDate?: string | null; branches?: string[] };
}

export interface TransferListResult { list: TransferRow[]; count: number; pageCount: number; }

export interface TransferJournalBranch {
  branchName: string;
  journals: { accountType: string; debit: number; credit: number }[];
}

/** The sum of a line's cost: serial / batch lines cost what their picked units cost, others qty x unit cost. */
export function lineTotal(l: TransferLine): number {
  if (l.type === 'serialized') return l.serials.reduce((s, x) => s + (Number(x.unitCost) || 0), 0);
  if (l.type === 'batch') return l.batches.reduce((s, x) => s + (Number(x.unitCost) || 0) * (Number(x.qty) || 0), 0);
  return (Number(l.qty) || 0) * (Number(l.unitCost) || 0);
}

/** Average unit cost shown on a line (serial / batch lines derive it from their units). */
export function lineUnitCost(l: TransferLine): number {
  if ((l.type === 'serialized' || l.type === 'batch') && Number(l.qty)) return lineTotal(l) / Number(l.qty);
  return Number(l.unitCost) || 0;
}

/** What the backend takes as a line's quantity: picked units for serial / batch products, the typed qty otherwise. */
export function pickedQty(l: TransferLine): number {
  if (l.type === 'serialized') return l.serials.filter(s => s.isSelected && !s.isDeleted).length;
  if (l.type === 'batch') return l.batches.filter(b => b.isSelected && !b.isDeleted).reduce((s, b) => s + (Number(b.qty) || 0), 0);
  return Number(l.qty) || 0;
}

/** Product row offered by the picker (`product/getPhysicalCountProducts`). */
export interface TransferProduct {
  id: string;
  name: string;
  barcode: string;
  UOM: string;
  type: string;
  unitCost: number;
  onHand: number;
  categoryName: string;
}

export const OUT_REASONS = ['Standard', 'Return To Supplier', 'To Another Branch', 'Wastage', 'Expired', 'Damaged', 'Operational Usage'] as const;
export const IN_REASONS = ['Standard', 'Other'] as const;
