import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { fmtDate } from '../../account/invoices/services/invoice-render-data';
import type { InventoryRequest, InventoryRequestLine } from './inventory-request.service';

const lineTotal = (l: InventoryRequestLine): number => (Number(l.qty) || 0) * (Number(l.unitCost) || 0);

const mapLine = (l: InventoryRequestLine): Record<string, unknown> => ({
  desc: l.productName || l.name || '',
  qty: l.qty,
  uom: l.uom,
  price: l.unitCost,
  taxRate: l.taxPercentage ?? 0,
  tax: 0,
  discount: 0,
  total: lineTotal(l),
  barcode: l.barcode || '',
  note: '',
  sic: '',
  options: [],
  voidedItems: [],
});

/**
 * Token data of an inventory request for the shared document paper (the same renderer the invoice,
 * purchase order and bill views use): the branch block, the document block (`{{invoice.date}}` = request
 * date, `{{invoice.reference}}` = the employee who raised it, `{{invoice.status}}`) and the item lines.
 * A request has no supplier, tax or number of its own, so those tokens stay empty. The company identity
 * (logo, name) is filled in by the paper itself.
 */
export function inventoryRequestToRenderData(r: InventoryRequest): DocumentRenderData {
  const total = r.lines.reduce((s, l) => s + lineTotal(l), 0);
  return {
    branch: { name: r.branchName, address: '', phone: '' },
    supplier: { name: '', vat: '', address: '', phone: '', email: '' },
    invoice: {
      number: '',
      date: fmtDate(r.createdAt),
      dueDate: '',
      reference: r.employeeName,
      isInclusiveTax: false,
      status: r.status,
      customerNote: '',
    },
    invoicePayments: [],
    totals: { subtotal: total, discount: 0, vat: 0, rounding: 0, grandTotal: total, lineCount: r.lines.length },
    lines: r.lines.map(mapLine),
    notes: '',
    additional: {},
    customFieldValues: { entity: {}, branch: {} },
  } as DocumentRenderData;
}
