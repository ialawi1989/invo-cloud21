/** Only document types whose view page exists in this app are linked (payouts, transfers, physical counts,
 *  manual adjustments and VAT payments are not migrated yet — they stay plain text).
 *
 *  Route of the source document behind an account-journal line, by its journal `type` (legacy `LinkedTypes`).
 *  Empty string = no document to open. */
const ROUTES: Record<string, string> = {};
const add = (prefix: string, types: string[]) => types.forEach(t => (ROUTES[t] = prefix));

add('/account/invoices/view/', ['Invoice', 'Invoices', 'invoice']);
add('/account/purchase-order/view/', ['purchase-order', 'PurchaseOrder', 'Purchase Order', 'purchase order']);
add('/account/credit-notes/view/', ['Credit Note', 'CreditNote', 'creditNote', 'credit_note', 'Credit Notes', 'CreditNotes']);
// The tip journal shares the payment's id, so it opens the payment.
add('/account/payments/view/', ['Invoice Payment', 'InvoicePayment', 'Invoice Payments', 'payments', 'InvoicePayments', 'Invoice Payment Tip']);
add('/account/supplier-credit/view/', ['Supplier Credit', 'SupplierCredit', 'Supplier Credits', 'SupplierCredits']);
add('/account/bills-payment/view/', ['Billing Payment', 'Billing Payments', 'BillingPayment', 'BillingPayments', 'bills-payment']);
add('/account/bill-of-entry/view/', ['Bill Of Entry', 'BillOfEntry', 'billOfEntry']);
add('/account/expense/view/', ['Expense', 'Expenses']);
add('/account/manual-journals/view/', ['Journal', 'Journals']);
add('/account/bills/view/', ['Billing', 'Billings']);

export function journalLink(type: string | null | undefined, id: string | null | undefined): string {
  const prefix = type ? ROUTES[type] : '';
  return prefix && id ? prefix + id : '';
}
