import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { PurchaseOrder, PurchaseOrderLine } from '../../models/purchase-order.model';
import { fmtDate } from '../../invoices/services/invoice-render-data';

const mapLine = (l: PurchaseOrderLine): Record<string, unknown> => ({
  desc: l.selectedItem?.name || l.note || '',
  qty: l.qty,
  uom: l.UOM,
  price: l.unitCost,
  taxRate: l.taxPercentage,
  tax: l.taxTotal,
  discount: 0,
  total: l.total,
  barcode: l.barcode || l.selectedItem?.barcode || '',
  note: l.selectedItem?.name && l.note ? l.note : '',
  sic: l.SIC,
  options: [],
  voidedItems: [],
});

/**
 * Token data of a purchase order for the shared document paper: the supplier block
 * (`{{supplier.name}}` …) and the document block (`{{invoice.number}}` = PO number, `{{invoice.date}}` =
 * issue date, `{{invoice.dueDate}}` = expiry date - the tokens the purchase-order template uses). The
 * company identity is filled in by the paper itself.
 */
export function purchaseOrderToRenderData(po: PurchaseOrder): DocumentRenderData {
  return {
    branch: { name: po.branchName, address: po.branchAddress, phone: po.branchPhone },
    supplier: {
      name: po.supplierName,
      vat: po.supplierVatNumber,
      address: po.supplierAddress,
      phone: po.supplierPhone,
      email: po.supplierEmail,
    },
    invoice: {
      number: po.purchaseNumber,
      date: fmtDate(po.purchaseDate),
      dueDate: fmtDate(po.dueDate),
      reference: po.reference,
      isInclusiveTax: po.isInclusiveTax,
      status: po.status,
      customerNote: '',
    },
    invoicePayments: [],
    totals: {
      subtotal: po.itemTotalWithoutTax,
      discount: 0,
      vat: po.invoiceTaxTotal,
      rounding: po.roundingTotal,
      grandTotal: po.total,
      lineCount: po.lines.length,
    },
    lines: (po.lines as PurchaseOrderLine[]).filter(l => !l.isDeleted).map(mapLine),
    notes: '',
    additional: {},
    customFieldValues: { entity: po.customFields ?? {}, branch: po.branchCustomFields ?? {} },
  };
}
