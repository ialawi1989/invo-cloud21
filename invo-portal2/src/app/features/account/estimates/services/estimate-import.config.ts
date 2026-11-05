import { MappedImportConfig, MappedImportField, MappedImportIssue, MappedImportPreview, MappedRow } from '@shared/components/mapped-import-wizard/mapped-import.types';

import { EstimatesService } from './estimates.service';

const F = 'ESTIMATES.IMPORT.FIELDS.';
const G = 'ESTIMATES.IMPORT.GROUPS.';

/**
 * Fields of the estimate import. One file row = one estimate line; rows sharing an estimate number form one
 * estimate (the backend groups them — `EstimateImportService`). `key`s are the backend's row keys.
 */
const FIELDS: MappedImportField[] = [
  { key: 'estimateNumber', label: F + 'ESTIMATE_NUMBER', group: G + 'ESTIMATE', aliases: ['Estimate Number', 'Estimate #', 'Estimate No'] },
  { key: 'estimateDate', label: F + 'ESTIMATE_DATE', group: G + 'ESTIMATE', required: true, type: 'date', aliases: ['Estimate Date', 'Date'] },
  { key: 'estimateExpDate', label: F + 'EXPIRY_DATE', group: G + 'ESTIMATE', type: 'date', aliases: ['Expiry Date', 'Expiration Date'] },
  { key: 'refrenceNumber', label: F + 'REFERENCE', group: G + 'ESTIMATE', aliases: ['Reference Number', 'Reference', 'PO Number'] },
  { key: 'note', label: F + 'NOTES', group: G + 'ESTIMATE', aliases: ['Notes', 'Note'] },
  { key: 'customerName', label: F + 'CUSTOMER_NAME', group: G + 'CONTACT', required: true, aliases: ['Customer Name', 'Customer'] },
  { key: 'itemName', label: F + 'ITEM_NAME', group: G + 'ITEM', aliases: ['Item Name', 'Product', 'Product Name'] },
  { key: 'barcode', label: F + 'BARCODE', group: G + 'ITEM', aliases: ['Barcode', 'Bar Code', 'UPC'] },
  { key: 'sku', label: F + 'SKU', group: G + 'ITEM', aliases: ['SKU'] },
  { key: 'qty', label: F + 'QUANTITY', group: G + 'ITEM', type: 'number', aliases: ['Quantity', 'Qty'] },
  { key: 'price', label: F + 'PRICE', group: G + 'ITEM', required: true, type: 'number', aliases: ['Item Price', 'Price', 'Rate'] },
  { key: 'discountPercentage', label: F + 'DISCOUNT', group: G + 'ITEM', type: 'number', aliases: ['Discount', 'Discount %', 'Discount (%)'] },
  { key: 'lineNote', label: F + 'ITEM_DESC', group: G + 'ITEM', aliases: ['Item Desc', 'Item Description', 'Description'] },
];

const isIso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isNum = (v: string) => v !== '' && Number.isFinite(Number(v.replace(/,/g, '')));

/** Groups rows into estimates the way the server does and flags the ones the file alone proves invalid. */
function previewEstimates(rows: MappedRow[], autoNumber: boolean): MappedImportPreview {
  const groups = new Map<string, { row: number; ref: string; problem: string | null }>();
  const failed: MappedImportIssue[] = [];
  let anonymous = 0;
  rows.forEach((r, i) => {
    const row = i + 2;
    const number = (r['estimateNumber'] ?? '').trim();
    if (!number && !autoNumber) { failed.push({ row, ref: '', reason: 'Estimate number is missing' }); return; }
    const key = number || `__auto_${anonymous++}`;
    const g = groups.get(key) ?? { row, ref: number, problem: null };
    groups.set(key, g);
    if (g.problem) return;
    const qty = (r['qty'] ?? '').trim();
    g.problem =
      !(r['customerName'] ?? '').trim() ? 'Customer name is missing'
      : !isIso(r['estimateDate'] ?? '') ? 'Estimate date is missing or invalid'
      : (r['estimateExpDate'] && !isIso(r['estimateExpDate'])) ? 'Expiry date is invalid'
      : (r['estimateExpDate'] && r['estimateExpDate'] < r['estimateDate']) ? 'Expiry date must be on or after the estimate date'
      : !((r['itemName'] ?? '').trim() || (r['barcode'] ?? '').trim() || (r['sku'] ?? '').trim()) ? `Row ${row}: item barcode or name is missing`
      : (qty && !(isNum(qty) && Number(qty) > 0)) ? `Row ${row}: quantity must be greater than zero`
      : !isNum((r['price'] ?? '').trim()) ? `Row ${row}: item price is missing or invalid`
      : null;
  });
  let ready = 0;
  groups.forEach((g) => { if (g.problem) failed.push({ row: g.row, ref: g.ref, reason: g.problem }); else ready++; });
  return { total: groups.size + failed.filter((f) => !f.ref && f.reason === 'Estimate number is missing').length, ready, skipped: [], failed };
}

/** The server names an issue's record `invoiceNumber` (it reuses the invoice importer's grouping); the wizard calls it `ref`. */
const toIssues = (list: any[] | undefined): MappedImportIssue[] =>
  (list ?? []).map((i) => ({ row: i.row, ref: i.invoiceNumber ?? '', reason: i.reason }));

export function buildEstimateImportConfig(args: { service: EstimatesService; branchId: string }): MappedImportConfig {
  const { service, branchId } = args;
  return {
    title: 'ESTIMATES.IMPORT.TITLE',
    recordsLabel: 'ESTIMATES.IMPORT.RECORDS',
    fields: FIELDS,
    recordKey: 'estimateNumber',
    templateName: 'estimates-import-template',
    templateRows: [
      ['Estimate Number', 'Estimate Date', 'Expiry Date', 'Reference Number', 'Notes', 'Customer Name', 'Barcode', 'Item Name', 'SKU', 'Quantity', 'Item Price', 'Discount (%)', 'Item Description'],
      ['EST-000101', '2025-01-15', '2025-02-14', 'PO-1', '', 'John Doe', '6291000000011', 'Coffee', 'COF-01', 2, 3.5, 0, ''],
      ['EST-000101', '2025-01-15', '2025-02-14', 'PO-1', '', 'John Doe', '6291000000028', 'Croissant', 'CRO-01', 1, 2, 10, ''],
    ],
    options: [
      { key: 'skipDuplicates', label: 'ESTIMATES.IMPORT.SKIP_DUPLICATES', description: 'ESTIMATES.IMPORT.SKIP_DUPLICATES_DESC', default: true },
      { key: 'skipDuplicateLines', label: 'ESTIMATES.IMPORT.SKIP_DUPLICATE_LINES', description: 'ESTIMATES.IMPORT.SKIP_DUPLICATE_LINES_DESC' },
      { key: 'autoNumber', label: 'ESTIMATES.IMPORT.AUTO_NUMBER', description: 'ESTIMATES.IMPORT.AUTO_NUMBER_DESC' },
    ],
    tips: ['ESTIMATES.IMPORT.TIP_ROWS', 'ESTIMATES.IMPORT.TIP_MATCH', 'ESTIMATES.IMPORT.TIP_EXPIRY'],
    // Nothing is sent before Import: the preview only checks what the file itself can answer. Customers, items
    // and already-used estimate numbers are checked by the server during the import and reported afterwards.
    preview: (rows, { options }) => previewEstimates(rows, !!options['autoNumber']),
    run: async (rows, { dryRun, options }) => {
      const res = await service.importEstimates(rows, { dryRun, autoNumber: !!options['autoNumber'], skipDuplicates: !!options['skipDuplicates'], skipDuplicateLines: !!options['skipDuplicateLines'], branchId });
      if (!res?.success) throw new Error(res?.msg || 'Import failed.');
      const d = res.data ?? {};
      return { total: d.totalInvoices ?? 0, ready: d.ready ?? 0, imported: d.imported ?? 0, skipped: toIssues(d.skipped), failed: toIssues(d.failed) };
    },
  };
}
