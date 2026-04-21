/**
 * Maps a transaction "type" label (as produced by backend activity / movement
 * / sales endpoints) to its router link inside the portal.
 *
 * Case-insensitive: the input is lowercased before matching so callers can
 * pass values straight from the API regardless of casing.
 *
 * Returns `null` for unknown types so the caller can render the label as
 * plain text (no link) instead of a broken route.
 *
 * Route paths include `/view/` where the legacy portal expected it.
 */
export function getTransactionRoute(type: string, id: string): string | null {
  if (!type || !id) return null;
  const key = type.trim().toLowerCase();

  switch (key) {
    // ── Invoices ──────────────────────────────────────────────
    case 'invoice':
    case 'invoices':
      return `/account/invoices/view/${id}`;

    // ── Purchase Orders ──────────────────────────────────────
    case 'purchase order':
    case 'purchase-order':
    case 'purchaseorder':
    case 'po':
      return `/account/purchase-order/view/${id}`;

    // ── Credit Notes ─────────────────────────────────────────
    case 'credit note':
    case 'credit notes':
    case 'creditnote':
    case 'creditnotes':
    case 'credit_note':
      return `/account/credit-notes/view/${id}`;

    // ── Invoice Payments ─────────────────────────────────────
    case 'invoice payment':
    case 'invoice payments':
    case 'invoicepayment':
    case 'invoicepayments':
    case 'payments':
      return `/account/payments/view/${id}`;

    // ── Billing (Bills) ──────────────────────────────────────
    case 'billing':
    case 'billings':
    case 'bill':
      return `/account/bills/view/${id}`;

    // ── Bill Payments ────────────────────────────────────────
    case 'billing payment':
    case 'billing payments':
    case 'billingpayment':
    case 'billingpayments':
    case 'bills-payment':
      return `/account/bills-payment/view/${id}`;

    // ── Bill Of Entry ────────────────────────────────────────
    case 'bill of entry':
    case 'billofentry':
      return `/account/bill-of-entry/view/${id}`;

    // ── Expenses ─────────────────────────────────────────────
    case 'expense':
    case 'expenses':
      return `/account/expense/view/${id}`;

    // ── Journals ─────────────────────────────────────────────
    case 'journal':
    case 'journals':
      return `/account/journal/view/${id}`;

    // ── Estimates ────────────────────────────────────────────
    case 'estimate':
    case 'estimates':
      return `/account/estimate/view/${id}`;

    // ── Supplier Credit ──────────────────────────────────────
    case 'supplier credit':
    case 'supplier credits':
    case 'suppliercredit':
    case 'suppliercredits':
      return `/account/supplier-credit/view/${id}`;

    // ── Inventory Transfer ───────────────────────────────────
    case 'inventory transfer':
    case 'inventory transfers':
    case 'inventorytransfer':
    case 'inventorytransfers':
    case 'transfer':
      return `/inventory/transfer/${id}`;

    // ── Physical Count ───────────────────────────────────────
    case 'physical count':
    case 'physicalcount':
      return `/inventory/physical-counts/${id}`;

    // ── Manual Adjustment ────────────────────────────────────
    case 'manual adjusment':       // legacy typo kept intentionally
    case 'manual adjusments':
    case 'manual adjustment':
    case 'manual adjustments':
      return `/manual-adjustment/view/${id}`;

    // ── VAT Payment ──────────────────────────────────────────
    case 'vat payment':
    case 'vat payments':
      return `/vat-payment/view/${id}`;

    default:
      return null;
  }
}

/**
 * All known type strings (lowercased). Use this to check whether a given
 * transaction type should render as a clickable link.
 */
export const LINKED_TYPES: readonly string[] = [
  'invoice', 'invoices',
  'purchase order', 'purchase-order', 'purchaseorder', 'po',
  'credit note', 'credit notes', 'creditnote', 'creditnotes', 'credit_note',
  'invoice payment', 'invoice payments', 'invoicepayment', 'invoicepayments', 'payments',
  'billing', 'billings', 'bill',
  'billing payment', 'billing payments', 'billingpayment', 'billingpayments', 'bills-payment',
  'bill of entry', 'billofentry',
  'expense', 'expenses',
  'journal', 'journals',
  'estimate', 'estimates',
  'supplier credit', 'supplier credits', 'suppliercredit', 'suppliercredits',
  'inventory transfer', 'inventory transfers', 'inventorytransfer', 'inventorytransfers', 'transfer',
  'physical count', 'physicalcount',
  'manual adjusment', 'manual adjusments', 'manual adjustment', 'manual adjustments',
  'vat payment', 'vat payments',
];
