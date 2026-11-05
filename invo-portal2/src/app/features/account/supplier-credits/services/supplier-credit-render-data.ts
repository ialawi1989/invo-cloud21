import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { SupplierCredit, SupplierCreditLine } from '../../models/supplier-credit.model';
import { fmtDate } from '../../invoices/services/invoice-render-data';

const mapLine = (l: SupplierCreditLine): Record<string, unknown> => ({
  desc: l.selectedItem?.name || l.note || '',
  qty: l.qty,
  uom: l.UOM,
  price: l.unitCost,
  taxRate: l.taxPercentage,
  tax: l.taxTotal,
  discount: l.appliedDiscount,
  total: l.total,
  barcode: l.barcode || l.selectedItem?.barcode || '',
  note: l.selectedItem?.name && l.note ? l.note : '',
  options: [],
  voidedItems: [],
});

/**
 * Token data of a supplier credit for the shared document paper: the supplier block and the document block
 * (`{{invoice.number}}` = credit number, `{{invoice.date}}` = credit date) with the bill it credits.
 */
export function supplierCreditToRenderData(c: SupplierCredit): DocumentRenderData {
  return {
    branch: { name: c.branchName, address: c.branchAddress, phone: c.branchPhone },
    supplier: { name: c.supplierName, vat: c.supplierVatNumber, address: c.supplierAddress, phone: c.supplierPhone, email: c.supplierEmail },
    invoice: {
      number: c.supplierCreditNumber,
      date: fmtDate(c.supplierCreditDate),
      dueDate: '',
      reference: c.reference,
      isInclusiveTax: c.isInclusiveTax,
      status: '',
      customerNote: c.note,
      bill: c.billingNumber,
    },
    invoicePayments: [],
    totals: {
      subtotal: c.itemTotalWithoutTax,
      discount: c.creditDiscount,
      vat: c.invoiceTaxTotal,
      delivery: c.deliveryCharge,
      rounding: c.roundingTotal,
      grandTotal: c.total,
      lineCount: c.lines.length,
    },
    lines: (c.lines as SupplierCreditLine[]).filter(l => !l.isDeleted).map(mapLine),
    notes: c.note,
    additional: {},
    customFieldValues: { entity: c.customFields ?? {}, branch: c.branchCustomFields ?? {} },
  };
}
