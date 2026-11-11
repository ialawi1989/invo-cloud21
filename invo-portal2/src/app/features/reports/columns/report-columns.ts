/**
 * "Customize columns" — which sub-columns a report shows under each of its columns. Shared by every report that offers
 * it (the legacy `REPORT_COLUMNS` registry, same definitions). A report opts in with `filters.subColumns` in the catalog
 * and is looked up here by its slug; the chosen keys travel to the backend as `filter.subColumns` (and with the export).
 */
export interface ReportColumnDef {
  key: string;
  label: { en: string; ar: string };
  description?: { en: string; ar: string };
  /** Shown until the user changes the selection. */
  default: boolean;
}

export const REPORT_COLUMNS: Record<string, ReportColumnDef[]> = {
  'sales-by-department': [
    { key: "salesAmount", label: { en: "Sales Amount", ar: "مبلغ المبيعات" }, description: { en: "Total sales amount before discounts and taxes", ar: "إجمالي مبلغ المبيعات قبل الخصومات والضرائب" }, default: true },
    { key: "discountTotal", label: { en: "Discount Total", ar: "إجمالي الخصم" }, description: { en: "Total discounts applied", ar: "إجمالي الخصومات المطبقة" }, default: true },
    { key: "taxTotal", label: { en: "Tax Total", ar: "إجمالي الضريبة" }, description: { en: "Total taxes collected", ar: "إجمالي الضرائب المحصلة" }, default: true },
    { key: "salesAfterDiscount", label: { en: "Sales After Discount", ar: "المبيعات بعد الخصم" }, description: { en: "Sales amount after discounts but before taxes", ar: "مبلغ المبيعات بعد الخصومات وقبل الضرائب" }, default: true },
    { key: "total", label: { en: "Net Total", ar: "صافي الإجمالي" }, description: { en: "Final amount after discounts and taxes", ar: "المبلغ النهائي بعد الخصومات والضرائب" }, default: true },
  ],
  'sales-by-category-report': [
    { key: "salesAmount", label: { en: "Sales Amount", ar: "مبلغ المبيعات" }, description: { en: "Total sales amount before discounts and taxes", ar: "Total sales amount before discounts and taxes" }, default: true },
    { key: "discountTotal", label: { en: "Discount Total", ar: "إجمالي الخصم" }, description: { en: "Total discounts applied", ar: "Total discounts applied" }, default: true },
    { key: "taxTotal", label: { en: "Tax Total", ar: "إجمالي الضريبة" }, description: { en: "Total taxes collected", ar: "Total taxes collected" }, default: true },
    { key: "salesAfterDiscount", label: { en: "Sales After Discount", ar: "المبيعات بعد الخصم" }, description: { en: "Sales amount after discounts but before taxes", ar: "Sales amount after discounts but before taxes" }, default: true },
    { key: "total", label: { en: "Net Total", ar: "صافي الإجمالي" }, description: { en: "Final amount after discounts and taxes", ar: "Final amount after discounts and taxes" }, default: true },
  ],
  'sales-by-menu': [
    { key: "sales", label: { en: "Sales Amount", ar: "مبلغ المبيعات" }, description: { en: "Total sales amount before discounts and taxes", ar: "Total sales amount before discounts and taxes" }, default: true },
    { key: "discountTotal", label: { en: "Discount Total", ar: "إجمالي الخصم" }, description: { en: "Total discounts applied", ar: "Total discounts applied" }, default: true },
    { key: "taxTotal", label: { en: "Tax Total", ar: "إجمالي الضريبة" }, description: { en: "Total taxes collected", ar: "Total taxes collected" }, default: true },
    { key: "salesAfterDiscount", label: { en: "Sales After Discount", ar: "المبيعات بعد الخصم" }, description: { en: "Sales amount after discounts but before taxes", ar: "Sales amount after discounts but before taxes" }, default: true },
    { key: "total", label: { en: "Net Total", ar: "صافي الإجمالي" }, description: { en: "Final amount after discounts and taxes", ar: "Final amount after discounts and taxes" }, default: true },
  ],
  'sales-by-menu-sections': [
    { key: "sales", label: { en: "Sales Amount", ar: "مبلغ المبيعات" }, description: { en: "Total sales amount before discounts and taxes", ar: "Total sales amount before discounts and taxes" }, default: true },
    { key: "discountTotal", label: { en: "Discount Total", ar: "إجمالي الخصم" }, description: { en: "Total discounts applied", ar: "Total discounts applied" }, default: true },
    { key: "taxTotal", label: { en: "Tax Total", ar: "إجمالي الضريبة" }, description: { en: "Total taxes collected", ar: "Total taxes collected" }, default: true },
    { key: "salesAfterDiscount", label: { en: "Sales After Discount", ar: "المبيعات بعد الخصم" }, description: { en: "Sales amount after discounts but before taxes", ar: "Sales amount after discounts but before taxes" }, default: true },
    { key: "total", label: { en: "Net Total", ar: "صافي الإجمالي" }, description: { en: "Final amount after discounts and taxes", ar: "Final amount after discounts and taxes" }, default: true },
  ],
  'sales-by-aggregator-report': [
    { key: "invoiceProdQty", label: { en: "Invoice Quantity", ar: "كمية الفواتير" }, description: { en: "Number of products sold through invoices", ar: "Number of products sold through invoices" }, default: true },
    { key: "invoiceSales", label: { en: "Invoice Sales", ar: "مبيعات الفواتير" }, description: { en: "Total sales amount from invoices", ar: "Total sales amount from invoices" }, default: true },
    { key: "creditNoteProdQty", label: { en: "Credit Note Quantity", ar: "كمية إشعارات الائتمان" }, description: { en: "Number of products returned via credit notes", ar: "Number of products returned via credit notes" }, default: true },
    { key: "creditNoteSales", label: { en: "Credit Note Amount", ar: "مبلغ إشعار الائتمان" }, description: { en: "Total amount from credit notes (returns)", ar: "Total amount from credit notes (returns)" }, default: true },
    { key: "totalSales", label: { en: "Net Sales", ar: "صافي المبيعات" }, description: { en: "Final sales after returns and adjustments", ar: "Final sales after returns and adjustments" }, default: true },
  ],
  'sales-by-brands': [
    { key: "salesAmount", label: { en: "Sales Amount", ar: "مبلغ المبيعات" }, description: { en: "Total sales amount before adjustments", ar: "Total sales amount before adjustments" }, default: true },
    { key: "discountTotal", label: { en: "Discount Total", ar: "إجمالي الخصم" }, description: { en: "Total discounts applied to brand sales", ar: "Total discounts applied to brand sales" }, default: true },
    { key: "taxTotal", label: { en: "Tax Total", ar: "إجمالي الضريبة" }, description: { en: "Total taxes collected for brand sales", ar: "Total taxes collected for brand sales" }, default: true },
    { key: "salesAfterDiscount", label: { en: "Sales After Discount", ar: "المبيعات بعد الخصم" }, description: { en: "Sales amount after discounts but before taxes", ar: "Sales amount after discounts but before taxes" }, default: true },
    { key: "total", label: { en: "Net Total", ar: "صافي الإجمالي" }, description: { en: "Final amount after all adjustments", ar: "Final amount after all adjustments" }, default: true },
  ],
  'sales-by-service': [
    { key: "salesAmount", label: { en: "Sales Amount", ar: "مبلغ المبيعات" }, description: { en: "Total sales amount before discounts and taxes", ar: "Total sales amount before discounts and taxes" }, default: true },
    { key: "discountTotal", label: { en: "Discount Total", ar: "إجمالي الخصم" }, description: { en: "Total discounts applied", ar: "Total discounts applied" }, default: true },
    { key: "taxTotal", label: { en: "Tax Total", ar: "إجمالي الضريبة" }, description: { en: "Total taxes collected", ar: "Total taxes collected" }, default: true },
    { key: "salesAfterDiscount", label: { en: "Sales After Discount", ar: "المبيعات بعد الخصم" }, description: { en: "Sales amount after discounts but before taxes", ar: "Sales amount after discounts but before taxes" }, default: true },
    { key: "total", label: { en: "Net Total", ar: "صافي الإجمالي" }, description: { en: "Final amount after discounts and taxes", ar: "Final amount after discounts and taxes" }, default: true },
  ],
  'purchase-by-item': [
    { key: "Qty", label: { en: "Quantity", ar: "الكمية" }, description: { en: "Total quantity purchased", ar: "Total quantity purchased" }, default: true },
    { key: "FOC Items", label: { en: "FOC Items", ar: "عناصر مجانية" }, description: { en: "Free of charge items received", ar: "Free of charge items received" }, default: true },
    { key: "Total", label: { en: "Total Amount", ar: "المبلغ الإجمالي" }, description: { en: "Total purchase amount", ar: "Total purchase amount" }, default: true },
    { key: "Average Price", label: { en: "Average Price", ar: "متوسط السعر" }, description: { en: "Average price per unit", ar: "Average price per unit" }, default: true },
  ],
  'purchase-by-category': [
    { key: "amount", label: { en: "Purchase Amount", ar: "مبلغ الشراء" }, description: { en: "Total purchase amount before taxes", ar: "Total purchase amount before taxes" }, default: true },
    { key: "taxTotal", label: { en: "Tax Total", ar: "إجمالي الضريبة" }, description: { en: "Total taxes paid on purchases", ar: "Total taxes paid on purchases" }, default: true },
    { key: "total", label: { en: "Net Total", ar: "صافي الإجمالي" }, description: { en: "Final amount including taxes", ar: "Final amount including taxes" }, default: true },
  ],
};

/** The catalog slug may differ from the legacy one by a `-report` suffix (`sales-by-category` / `sales-by-category-report`). */
function lookup(slug: string): ReportColumnDef[] {
  return REPORT_COLUMNS[slug] ?? REPORT_COLUMNS[`${slug}-report`] ?? REPORT_COLUMNS[slug.replace(/-sub$/, '')] ?? [];
}

export const getReportColumns = (slug: string): ReportColumnDef[] => lookup(slug);
export const hasColumnConfig = (slug: string): boolean => lookup(slug).length > 0;
export const getDefaultColumnKeys = (slug: string): string[] => lookup(slug).filter(c => c.default).map(c => c.key);

/** The selection from a URL value (`a,b`) — only the report's own columns, in its order; the defaults when empty / invalid. */
export function pickReportColumns(slug: string, raw: string | null | undefined): string[] {
  const all = lookup(slug);
  const asked = new Set((raw ?? '').split(',').map(s => s.trim()).filter(Boolean));
  const picked = all.filter(c => asked.has(c.key)).map(c => c.key);
  return picked.length ? picked : getDefaultColumnKeys(slug);
}

/** True when `selected` is exactly the report's defaults (then the URL does not need to carry it). */
export function isDefaultColumns(slug: string, selected: string[] | undefined): boolean {
  const d = getDefaultColumnKeys(slug);
  return !selected || (selected.length === d.length && d.every(k => selected.includes(k)));
}

/** Display label of a column in `lang` (`ar` or English). */
export function columnLabel(slug: string, key: string, lang: string): string {
  const c = lookup(slug).find(x => x.key === key);
  return c ? (lang === 'ar' ? c.label.ar : c.label.en) : key;
}
