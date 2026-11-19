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
  taxId: l.taxId ?? '',
  discount: l.discountTotal ?? l.discountedAmount,
  total: l.total,
  barcode: l.selectedItem?.barcode || (l as any).barcode || '',
  image: l.mediaUrl ?? '',
  translation: l.selectedItem?.translation ?? null,
  customFields: l.selectedItem?.customFields ?? {},
  note: l.selectedItem?.name && l.note ? l.note : '',
  options: (l.options ?? []).map(o => ({ name: o.optionName || o.note, price: o.price })),
  discountedByCoupon: !!l.discountedByCoupon,
  voidedItems: (l.voidedItems ?? []).map(mapLine),
  // shown under the item as the legacy paper does: when the line was added, batch / serial, and a package's picked items
  createdAt: l.lineCreatedAt ? new Date(l.lineCreatedAt).toISOString() : '',
  batch: l.batch ?? '',
  serial: l.serial ?? '',
  subItems: (l.subItems ?? []).map((s: any) => ({
    name: s.selectedItem?.name || s.note || '',
    translation: s.selectedItem?.translation ?? null,
    options: (s.options ?? []).map((o: any) => ({ name: o.optionName || o.note || '' })),
  })),
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
      createdDate: fmtDate(inv.createdAt),
      salesRep: inv.salesEmployeeName || inv.salesRepresentative,
      // legacy `getTableInfoParts`: "Service: x | Section: y | Table: z", each part only when it has a value
      service: [inv.serviceName && `Service: ${inv.serviceName}`, inv.tableGroupName && `Section: ${inv.tableGroupName}`, inv.tableName && `Table: ${inv.tableName}`].filter(Boolean).join(' | '),
      orderNo: inv.serviceNo,
      isInclusiveTax: inv.isInclusiveTax,
      status: inv.status,
      customerNote: inv.note,
      customerSignature: inv.customerSignature || '',
      applyDiscountBeforeTax: inv.applyDiscountBeforeTax,
      chargeType: inv.chargeType,
      // promotions: legacy document-builder config carried these into the paper
      couponId: inv.couponId || '',
      couponType: inv.couponType || '',
      promoCoupon: inv.promoCoupon || '',
      pointsDiscount: inv.pointsDiscount || 0,
    },
    invoicePayments: payments.map(p => ({
      paymentMethodName: p.paymentMethodName,
      amount: p.amount,
      status: p.status ?? 'SUCCESS',
      referenceNumber: p.referenceNumber ?? '',
    })),
    totals: {
      // An inclusive-tax invoice prints its items total and discount with the tax in them (the labels then say "(inc)").
      subTotal: inv.subTotal,
      subtotal: inv.isInclusiveTax ? (inv.itemTotalWithTax ?? inv.itemTotalWithoutTax) : (inv.itemSubTotal || inv.itemTotalWithoutTax),
      discount: inv.isInclusiveTax ? (inv.discountTotalWithTax ?? inv.discountTotal) : inv.discountTotal,
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
    customFieldValues: { entity: inv.customFields ?? {}, branch: inv.branchCustomFields ?? {}, customer: inv.customerCustomFields ?? {} },
  };
}
