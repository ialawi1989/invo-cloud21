import { MappedImportConfig, MappedImportField, MappedImportIssue, MappedImportPreview, MappedRow } from '@shared/components/mapped-import-wizard/mapped-import.types';

import { InvoicesService } from './invoices.service';

const F = 'INVOICES.IMPORT.FIELDS.';
const G = 'INVOICES.IMPORT.GROUPS.';

/**
 * Fields of the invoice import. One file row = one invoice line; rows sharing an invoice number form one
 * invoice (the backend groups them — `InvoiceImportService`). `key`s are the backend's row keys.
 */
const FIELDS: MappedImportField[] = [
  { key: 'invoiceNumber', label: F + 'INVOICE_NUMBER', group: G + 'INVOICE', aliases: ['Invoice Number', 'Invoice #', 'Invoice No'] },
  { key: 'invoiceDate', label: F + 'INVOICE_DATE', group: G + 'INVOICE', required: true, type: 'date', aliases: ['Invoice Date', 'Date'] },
  { key: 'dueDate', label: F + 'DUE_DATE', group: G + 'INVOICE', type: 'date', aliases: ['Due Date'] },
  { key: 'status', label: F + 'STATUS', group: G + 'INVOICE', aliases: ['Invoice Status', 'Status'] },
  { key: 'refrenceNumber', label: F + 'REFERENCE', group: G + 'INVOICE', aliases: ['Reference Number', 'Reference', 'PurchaseOrder', 'PO Number'] },
  { key: 'note', label: F + 'NOTES', group: G + 'INVOICE', aliases: ['Notes', 'Note'] },
  { key: 'customerName', label: F + 'CUSTOMER_NAME', group: G + 'CONTACT', required: true, aliases: ['Customer Name', 'Customer'] },
  { key: 'itemName', label: F + 'ITEM_NAME', group: G + 'ITEM', aliases: ['Item Name', 'Product', 'Product Name'] },
  { key: 'barcode', label: F + 'BARCODE', group: G + 'ITEM', aliases: ['Barcode', 'Bar Code', 'UPC'] },
  { key: 'sku', label: F + 'SKU', group: G + 'ITEM', aliases: ['SKU'] },
  { key: 'qty', label: F + 'QUANTITY', group: G + 'ITEM', type: 'number', aliases: ['Quantity', 'Qty'] },
  { key: 'price', label: F + 'PRICE', group: G + 'ITEM', required: true, type: 'number', aliases: ['Item Price', 'Price', 'Rate'] },
  { key: 'discountPercentage', label: F + 'DISCOUNT', group: G + 'ITEM', type: 'number', aliases: ['Discount', 'Discount %', 'Discount (%)'] },
  { key: 'lineNote', label: F + 'ITEM_DESC', group: G + 'ITEM', aliases: ['Item Desc', 'Item Description', 'Description'] },
];

const STATUS_FIX = [
  { value: 'Draft', label: 'INVOICES.STATUS.Draft' },
  { value: 'Open', label: 'INVOICES.STATUS.Open' },
];
const isIso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isNum = (v: string) => v !== '' && Number.isFinite(Number(v.replace(/,/g, '')));

/** Groups rows into invoices the way the server does and flags the ones the file alone proves invalid. */
function previewInvoices(rows: MappedRow[], autoNumber: boolean): MappedImportPreview {
  const groups = new Map<string, { row: number; ref: string; problem: string | null; fix?: MappedImportIssue['fix'] }>();
  const failed: MappedImportIssue[] = [];
  let anonymous = 0;
  rows.forEach((r, i) => {
    const row = i + 2;
    const number = (r['invoiceNumber'] ?? '').trim();
    if (!number && !autoNumber) { failed.push({ row, ref: '', reason: 'Invoice number is missing' }); return; }
    const key = number || `__auto_${anonymous++}`;
    const g = groups.get(key) ?? { row, ref: number, problem: null };
    groups.set(key, g);
    if (g.problem) return;
    const qty = (r['qty'] ?? '').trim();
    const badStatus = !!r['status'] && !['Draft', 'Open'].includes(r['status']);
    g.problem =
      !(r['customerName'] ?? '').trim() ? 'Customer name is missing'
      : !isIso(r['invoiceDate'] ?? '') ? 'Invoice date is missing or invalid'
      : (r['dueDate'] && !isIso(r['dueDate'])) ? 'Due date is invalid'
      : badStatus ? `Status '${r['status']}' is not supported (use Draft or Open)`
      : !((r['itemName'] ?? '').trim() || (r['barcode'] ?? '').trim() || (r['sku'] ?? '').trim()) ? `Row ${row}: item barcode or name is missing`
      : (qty && !(isNum(qty) && Number(qty) > 0)) ? `Row ${row}: quantity must be greater than zero`
      : !isNum((r['price'] ?? '').trim()) ? `Row ${row}: item price is missing or invalid`
      : null;
    if (g.problem && badStatus && !g.fix && number) g.fix = { field: 'status', options: STATUS_FIX };
  });
  let ready = 0;
  groups.forEach((g) => { if (g.problem) failed.push({ row: g.row, ref: g.ref, reason: g.problem, fix: g.fix }); else ready++; });
  return { total: groups.size + failed.filter((f) => !f.ref && f.reason === 'Invoice number is missing').length, ready, skipped: [], failed };
}

export function buildInvoiceImportConfig(args: { service: InvoicesService; branchId: string }): MappedImportConfig {
  const { service, branchId } = args;
  return {
    title: 'INVOICES.IMPORT.TITLE',
    recordsLabel: 'INVOICES.IMPORT.RECORDS',
    fields: FIELDS,
    recordKey: 'invoiceNumber',
    templateName: 'invoices-import-template',
    templateRows: [
      ['Invoice Number', 'Invoice Date', 'Due Date', 'Invoice Status', 'Reference Number', 'Notes', 'Customer Name', 'Barcode', 'Item Name', 'SKU', 'Quantity', 'Item Price', 'Discount (%)', 'Item Description'],
      ['INV-000101', '2025-01-15', '2025-02-14', 'Open', 'PO-1', '', 'John Doe', '6291000000011', 'Coffee', 'COF-01', 2, 3.5, 0, ''],
      ['INV-000101', '2025-01-15', '2025-02-14', 'Open', 'PO-1', '', 'John Doe', '6291000000028', 'Croissant', 'CRO-01', 1, 2, 10, ''],
    ],
    options: [
      { key: 'skipDuplicates', label: 'INVOICES.IMPORT.SKIP_DUPLICATES', description: 'INVOICES.IMPORT.SKIP_DUPLICATES_DESC', default: true },
      { key: 'skipDuplicateLines', label: 'INVOICES.IMPORT.SKIP_DUPLICATE_LINES', description: 'INVOICES.IMPORT.SKIP_DUPLICATE_LINES_DESC' },
      { key: 'autoNumber', label: 'INVOICES.IMPORT.AUTO_NUMBER', description: 'INVOICES.IMPORT.AUTO_NUMBER_DESC' },
    ],
    tips: ['INVOICES.IMPORT.TIP_ROWS', 'INVOICES.IMPORT.TIP_MATCH', 'INVOICES.IMPORT.TIP_STATUS'],
    // Nothing is sent before Import: the preview only checks what the file itself can answer. Customers, items
    // and already-used invoice numbers are checked by the server during the import and reported afterwards.
    preview: (rows, { options }) => previewInvoices(rows, !!options['autoNumber']),
    run: async (rows, { dryRun, options }) => {
      const res = await service.importInvoices(rows, { dryRun, autoNumber: !!options['autoNumber'], skipDuplicates: !!options['skipDuplicates'], skipDuplicateLines: !!options['skipDuplicateLines'], branchId });
      if (!res?.success) throw new Error(res?.msg || 'Import failed.');
      const d = res.data ?? {};
      const issues = (list: any[] | undefined): MappedImportIssue[] => (list ?? []).map((i) => ({ row: i.row, ref: i.invoiceNumber ?? '', reason: i.reason }));
      return { total: d.totalInvoices ?? 0, ready: d.ready ?? 0, imported: d.imported ?? 0, skipped: issues(d.skipped), failed: issues(d.failed) };
    },
  };
}
