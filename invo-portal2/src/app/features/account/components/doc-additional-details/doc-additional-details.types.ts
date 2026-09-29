import { DocJournalRow } from '../doc-journal-tab/doc-journal-tab.component';

/** One payment row (invoice's `invoicePayments`, already loaded — no separate fetch). */
export interface DocPaymentRow {
  id: string;
  date: string | Date;
  methodName: string;
  status: string;
  amount: number;
  referenceNumber?: string;
  attachment?: any;
  reconciled?: boolean;
}

/** One product's movement, with its recipe breakdown (if any) in `summary`. */
export interface DocMovementSummaryRow {
  productId: string;
  productName: string;
  qty: number;
  cost: number;
  totalCost: number;
}
export interface DocMovementRow {
  lineId: string;
  productId: string;
  productName: string;
  lineQty: number;
  totalCost: number;
  summary: DocMovementSummaryRow[];
}

/** One voided/wasted line. */
export interface DocWastageRow {
  productId: string;
  productName: string;
  qty: number;
  waste?: boolean;
  voidReason?: string;
  createdAt: string;
}

export type DocAdditionalDetailsTabKey = 'journal' | 'payments' | 'logs' | 'productMovement' | 'voided';

/**
 * What `<app-doc-additional-details>` needs to show its tabs for one document. Every data source
 * is optional and lazy (called once, on first activation of that tab / on scroll into view for the
 * first tab) — a document only lists the tabs it has a source for, so the same component serves
 * invoices, bills, credit notes, etc. without per-entity forks; only this config object differs.
 */
export interface DocAdditionalDetailsConfig {
  /** Tabs to show, in display order. */
  tabs: DocAdditionalDetailsTabKey[];
  journalHeading?: string;
  loadJournal?: () => Promise<DocJournalRow[]>;
  /** Synchronous — the payments are already loaded on the parent document. */
  payments?: () => DocPaymentRow[];
  onPaymentClick?: (row: DocPaymentRow) => void;
  onPaymentAttachment?: (row: DocPaymentRow) => void;
  /** Row "…" menu — both optional and independently gated so a caller can offer just one, or
   *  neither (the menu itself is hidden when no rule allows any action for that row). Callers pass
   *  the SAME privilege rule their own list/view pages already use — this component never decides
   *  permissions itself. */
  onPaymentEdit?: (row: DocPaymentRow) => void;
  onPaymentDelete?: (row: DocPaymentRow) => void;
  canEditPayment?: (row: DocPaymentRow) => boolean;
  canDeletePayment?: (row: DocPaymentRow) => boolean;
  logsSourceTable?: string;
  logsSourceId?: string;
  /** Product Movement and Voided read from the same call — cached after the first load. */
  loadMovement?: () => Promise<{ productMovement: DocMovementRow[] | null; wastage: DocWastageRow[] | null }>;
}
