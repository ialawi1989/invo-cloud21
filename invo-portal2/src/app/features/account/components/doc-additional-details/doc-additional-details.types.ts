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

/** An extra journal below the document's own (write-off, applied credit, refund …): a heading with an optional link + delete, and its rows. */
export interface DocExtraJournal {
  heading: string;
  link?: { label: string; url: any[] };
  suffix?: string;
  rows: DocJournalRow[];
  /** Shows a Delete button on the heading (applied credits). */
  onDelete?: () => void;
}

export interface DocJournalResult { rows: DocJournalRow[]; extras: DocExtraJournal[] }

/** One line's audit trail: when it was added, by whom, and what. */
export interface DocLineRow {
  date: string | Date | null;
  employeeName: string;
  qty: number;
  itemName: string;
}

export type DocAdditionalDetailsTabKey = 'journal' | 'payments' | 'logs' | 'productMovement' | 'voided' | 'lines' | 'billOfEntry';

/** The bill of entry created from a bill (one row). */
export interface DocBillOfEntryRow {
  id: string;
  number: string | null;
  date: string | Date | null;
  total: number;
}

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
  loadJournal?: () => Promise<DocJournalRow[] | DocJournalResult>;
  /** Synchronous — the payments are already loaded on the parent document. */
  payments?: () => DocPaymentRow[];
  onPaymentClick?: (row: DocPaymentRow) => void;
  onPaymentAttachment?: (row: DocPaymentRow, attachment?: any) => void;
  /** Row "…" menu — both optional and independently gated so a caller can offer just one, or
   *  neither (the menu itself is hidden when no rule allows any action for that row). Callers pass
   *  the SAME privilege rule their own list/view pages already use — this component never decides
   *  permissions itself. */
  onPaymentEdit?: (row: DocPaymentRow) => void;
  onPaymentDelete?: (row: DocPaymentRow) => void;
  canEditPayment?: (row: DocPaymentRow) => boolean;
  canDeletePayment?: (row: DocPaymentRow) => boolean;
  /** Synchronous — the lines are already on the parent document (who added each line, and when). */
  lines?: () => DocLineRow[];
  /** Synchronous - the bill's linked bill of entry, or null when it has none (the tab is then not shown). */
  billOfEntry?: () => DocBillOfEntryRow | null;
  logsSourceTable?: string;
  logsSourceId?: string;
  /** Product Movement and Voided read from the same call — cached after the first load. */
  loadMovement?: () => Promise<{ productMovement: DocMovementRow[] | null; wastage: DocWastageRow[] | null }>;
}
