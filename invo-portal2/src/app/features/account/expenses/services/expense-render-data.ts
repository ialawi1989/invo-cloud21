import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { Expense, ExpenseLine } from '../../models/expense.model';
import { fmtDate } from '../../invoices/services/invoice-render-data';

/**
 * Token data of an expense for the shared document paper: the document block (`{{invoice.number}}` = expense
 * number, `{{invoice.date}}` = expense date), the supplier it was paid to, and the lines (each shows the
 * expense account it went to, with its amount and tax). The payment method appears as the payment made.
 */
export function expenseToRenderData(e: Expense): DocumentRenderData {
  const lines = (e.lines as ExpenseLine[]).filter(l => !(l as any).isDeleted);
  return {
    branch: { name: e.branchName, address: e.branchAddress, phone: e.branchPhone },
    supplier: { name: e.supplierName ?? '', vat: '', address: '', phone: '', email: e.supplierEmail },
    customer: { name: e.customerName, vat: '', address: '', phone: '', email: e.customerEmail },
    invoice: {
      number: e.expenseNumber,
      date: fmtDate(e.expenseDate),
      dueDate: '',
      reference: e.referenceNumber,
      isInclusiveTax: e.isInclusiveTax,
      status: '',
      customerNote: e.note,
    },
    invoicePayments: [{ paymentMethodName: e.paymentMethodName, amount: e.total, status: 'SUCCESS', referenceNumber: e.referenceNumber }],
    totals: {
      subtotal: e.itemTotalWithoutTax,
      discount: 0,
      vat: e.invoiceTaxTotal,
      rounding: e.roundingTotal,
      grandTotal: e.total,
      lineCount: lines.length,
    },
    lines: lines.map(l => ({
      desc: l.accountName || '',
      qty: 1,
      uom: '',
      price: l.amount,
      taxRate: l.taxPercentage,
      tax: l.taxTotal,
      discount: 0,
      total: l.total,
      barcode: '',
      note: l.note,
      options: [],
      voidedItems: [],
    })),
    notes: e.note,
    additional: {},
    customFieldValues: { entity: e.customFields ?? {}, branch: e.branchCustomFields ?? {} },
  };
}
