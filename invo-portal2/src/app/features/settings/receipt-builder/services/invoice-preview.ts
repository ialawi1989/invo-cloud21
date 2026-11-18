import type { DemoInvoice, DemoInvoiceLine, DemoInvoicePayment, DemoInvoiceTax } from './binding-resolver';

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const date = (v: unknown): Date | undefined => { if (!v) return undefined; const d = new Date(v as string); return isNaN(d.getTime()) ? undefined : d; };

/**
 * Maps a real invoice (the parsed `Invoice` model) to the preview data the canvas renders, so "Choose an invoice" shows a real
 * receipt exactly like the legacy builder's invoice picker. Only reads fields; never mutates the invoice.
 */
export function invoiceToDemo(inv: any): DemoInvoice {
  const lines: DemoInvoiceLine[] = (inv?.lines ?? []).map((l: any): DemoInvoiceLine => ({
    qty: num(l.qty),
    taxPercentage: num(l.taxPercentage),
    taxTotal: num(l.taxTotal),
    price: num(l.price),
    discountAmount: num(l.discountAmount),
    discountTotal: num(l.discountTotal),
    subTotal: num(l.subTotal),
    subTotalWithoutTax: num(l.subTotalWithoutTax ?? (num(l.total) - num(l.taxTotal))),
    total: num(l.total),
    serialNo: l.serial || l.serialNo || '',
    product: {
      name: l.selectedItem?.name || l.productName || '',
      secondaryName: l.selectedItem?.translation?.name?.ar || l.productSecondaryName || '',
      kitchenName: l.selectedItem?.kitchenName || '',
      barcode: l.selectedItem?.barcode || '',
    },
    UOM: l.UOM || '',
  }));

  const taxes: DemoInvoiceTax[] = (inv?.taxesDetails ?? []).map((t: any): DemoInvoiceTax => ({
    name: t.name ?? t.taxName ?? '',
    rate: num(t.rate ?? t.percentage ?? t.taxPercentage),
    amount: num(t.total ?? t.amount ?? t.taxTotal),
    total: num(t.total ?? t.amount ?? t.taxTotal),
  }));

  const payments: DemoInvoicePayment[] = (inv?.payments ?? []).map((p: any): DemoInvoicePayment => ({
    paymentMethod: { name: p.paymentMethod?.name ?? p.paymentMethodName ?? '' },
    method: p.paymentMethod?.name ?? p.paymentMethodName ?? '',
    tenderAmount: num(p.tenderAmount ?? p.amount),
    tenderEquivalent: num(p.tenderEquivalent ?? p.amount),
    amount: num(p.amount ?? p.tenderEquivalent),
  }));

  return {
    id: String(inv?.id ?? ''),
    invoiceNumber: inv?.invoiceNumber ?? '',
    refrenceNumber: inv?.refrenceNumber ?? '',
    createdAt: date(inv?.createdAt) ?? new Date(),
    printTime: new Date(),
    scheduleTime: date(inv?.scheduleTime),
    employeeName: inv?.employeeName ?? '',
    customerName: inv?.customerName ?? '',
    customerContact: inv?.customerContact ?? '',
    customerAddress: typeof inv?.customerAddress === 'string' ? inv.customerAddress : (inv?.customerAddress?.toString?.() ?? ''),
    note: inv?.note ?? '',
    serviceName: inv?.serviceName ?? '',
    tableName: inv?.tableName ?? '',
    table: inv?.tableName ? { name: inv.tableName } : undefined,
    isPaid: num(inv?.balance) <= 0 && num(inv?.total) > 0 ? 1 : 0,
    itemSubTotal: num(inv?.itemSubTotal),
    itemDiscountTotal: num(inv?.itemDiscountTotal),
    itemSubTotalAfterDiscount: num(inv?.itemSubTotalAfterDiscount),
    discountAmount: num(inv?.discountAmount),
    discountTotal: num(inv?.discountTotal),
    chargeTotal: num(inv?.chargeTotal),
    deliveryCharge: num(inv?.deliveryCharge),
    roundingTotal: num(inv?.roundingTotal),
    total: num(inv?.total),
    balance: num(inv?.balance),
    change: num(inv?.change ?? inv?.returnedAmount),
    zatcaCode: inv?.zatcaCode ?? '',
    lines, taxes, payments,
  } as DemoInvoice;
}
