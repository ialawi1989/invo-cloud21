export type OnlineOrderStatus = 'Placed' | 'Accepted' | 'Rejected';

export const ONLINE_ORDER_STATUSES: OnlineOrderStatus[] = ['Placed', 'Accepted', 'Rejected'];

/**
 * A line of an online order that has serial / batch stock to pick from
 * (`InvoiceRepo.isInvoiceHasSerialBatchProducts`: only such lines come back).
 */
export interface OnlineOrderLine {
  lineId: string;
  productId: string;
  name: string;
  productType: 'serialized' | 'batch' | string;
  serials: string[];
  batches: string[];
  /** The user's pick (empty until chosen). */
  serial: string;
  batch: string;
}

/** A row of `accounts/getOnlineInvoices`. */
export interface OnlineOrderRow {
  id: string;
  branchId: string;
  branchName: string;
  invoiceNumber: string;
  customerName: string | null;
  employeeName: string | null;
  total: number;
  status: string;
  invoiceDate: string | null;
  dueDate: string | null;
  createdAt: string | null;
  onlineStatus: string;
  /** Non-empty when accepting needs a serial / batch choice first. */
  lines: OnlineOrderLine[];
}

export interface OnlineOrderListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: 'asc' | 'desc' };
  status: string;
  branches?: string[];
}

export interface OnlineOrderListResult {
  list: OnlineOrderRow[];
  count: number;
  pageCount: number;
}

/** `{ lineId, serial }` for a serialized line, `{ lineId, batch }` otherwise (legacy payload). */
export type LinePick = { lineId: string; serial: string } | { lineId: string; batch: string };
