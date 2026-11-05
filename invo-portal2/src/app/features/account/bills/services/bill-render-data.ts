import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { Bill, BillLine } from '../../models/bill.model';
import { fmtDate } from '../../invoices/services/invoice-render-data';

const mapLine = (l: BillLine): Record<string, unknown> => ({
  desc: l.selectedItem?.name || l.note || '',
  qty: l.qty,
  uom: l.UOM,
  price: l.unitCost,
  taxRate: l.taxPercentage,
  tax: l.taxTotal,
  discount: l.discountTotal,
  total: l.total,
  barcode: l.barcode || l.selectedItem?.barcode || '',
  note: l.selectedItem?.name && l.note ? l.note : '',
  sic: l.SIC,
  options: [],
  voidedItems: [],
});

/**
 * Token data of a bill for the shared document paper: the supplier block (`{{supplier.name}}` ...) and
 * the document block (`{{invoice.number}}` = bill number, `{{invoice.date}}` = bill date,
 * `{{invoice.dueDate}}` = due date) with the payment figures. The company identity is filled in by the paper.
 */
export function billToRenderData(b: Bill): DocumentRenderData {
  return {
    branch: { name: b.branchName, address: b.branchAddress, phone: b.branchPhone },
    supplier: { name: b.supplierName, vat: b.supplierVatNumber, address: b.supplierAddress, phone: b.supplierPhone, email: b.supplierEmail },
    invoice: {
      number: b.billingNumber,
      date: fmtDate(b.billingDate),
      dueDate: fmtDate(b.dueDate),
      reference: b.reference,
      isInclusiveTax: b.isInclusiveTax,
      status: b.status,
      customerNote: b.note,
      purchaseOrder: b.purchaseNumber,
    },
    invoicePayments: [],
    totals: {
      subtotal: b.itemTotalWithoutTax,
      discount: b.billDiscount,
      vat: b.invoiceTaxTotal,
      delivery: b.deliveryCharge,
      rounding: b.roundingTotal,
      grandTotal: b.total,
      paid: b.paidAmount,
      credit: b.appliedCredit,
      balance: b.balance,
      lineCount: b.lines.length,
    },
    lines: (b.lines as BillLine[]).filter(l => !l.isDeleted).map(mapLine),
    notes: b.note,
    additional: {},
    customFieldValues: { entity: b.customFields ?? {}, branch: b.branchCustomFields ?? {} },
  };
}
