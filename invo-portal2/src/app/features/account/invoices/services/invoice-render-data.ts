import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { Invoice, InvoiceLine } from '../../models/invoice.model';
import { CustomerAddress } from '../../customers/models/customer.model';

export const fmtDate = (d: any): string => {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x.getTime())) return String(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()}`;
};

const mapLine = (l: InvoiceLine): Record<string, unknown> => ({
  desc: l.selectedItem?.name || l.note || '',
  qty: l.qty,
  uom: l.UOM,
  price: l.price,
  taxRate: l.taxPercentage,
  tax: l.taxTotal,
  discount: l.discountedAmount,
  total: l.total,
  barcode: l.selectedItem?.barcode ?? '',
  note: l.selectedItem?.name && l.note ? l.note : '',
  options: (l.options ?? []).map(o => ({ name: o.optionName || o.note, price: o.price })),
  voidedItems: (l.voidedItems ?? []).map(mapLine),
});

/**
 * Maps a loaded invoice to the token data the shared `app-document-paper` renders
 * (`{{customer.name}}`, `{{totals.grandTotal}}`, `lines`, …). Company identity is filled in
 * by the paper itself from `CompanyService`.
 */
export function invoiceToRenderData(inv: Invoice): DocumentRenderData {
  const address = new CustomerAddress();
  if (inv.customerAddress) address.ParseJson(inv.customerAddress);

  const payments: any[] = inv.invoicePayments ?? [];
  const methods = [...new Set(payments.map(p => p.paymentMethodName).filter(Boolean))].join(' · ');

  return {
    branch: { name: inv.branchName, address: inv.branchAddress, phone: inv.branchPhone },
    customer: {
      name: inv.customerName,
      vat: inv.customerVatNumber,
      address: address.toString().trim(),
      phone: inv.customerPhone || inv.customerContact,
      email: inv.customerEmail,
    },
    invoice: {
      number: inv.invoiceNumber,
      date: fmtDate(inv.invoiceDate),
      dueDate: fmtDate(inv.dueDate),
      reference: inv.refrenceNumber,
      salesRep: inv.salesEmployeeName || inv.salesRepresentative,
      service: inv.serviceName,
      orderNo: inv.serviceNo,
      isInclusiveTax: inv.isInclusiveTax,
      status: inv.status,
      customerNote: inv.note,
    },
    invoicePayments: payments.map(p => ({
      paymentMethodName: p.paymentMethodName,
      amount: p.amount,
      status: p.status ?? 'SUCCESS',
      referenceNumber: p.referenceNumber ?? '',
    })),
    totals: {
      subtotal: inv.itemTotalWithoutTax,
      discount: inv.discountTotal,
      vat: inv.invoiceTaxTotal,
      charge: inv.chargeTotal,
      delivery: inv.deliveryCharge,
      rounding: inv.roundingTotal,
      grandTotal: inv.total,
      paid: inv.paidAmount,
      paymentMethods: methods,
      credit: inv.appliedCredit,
      balance: inv.balance,
      lineCount: inv.lines.length,
    },
    lines: inv.lines.filter(l => !l.parentId).map(mapLine),
    notes: inv.note,
    additional: {},
    customFieldValues: { entity: inv.customFields ?? {}, branch: inv.branchCustomFields ?? {} },
  };
}
