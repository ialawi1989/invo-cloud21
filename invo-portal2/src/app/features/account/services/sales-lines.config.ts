import { DocLinesConfig } from '../components/doc-lines-table/doc-lines.types';
import { InvoiceLine } from '../models/invoice.model';
import { Invoice } from '../models/invoice.model';
import { SalesLookupsService } from './sales-lookups.service';

export interface SalesLinesOptions {
  canAdjustPrice: () => boolean;
  /** Which lines the user may remove. */
  canRemove: NonNullable<DocLinesConfig['canRemove']>;
  /** Document kind sent to `product/searchByBarcodes` (`invoice`, `estimate`, …). */
  barcodeType: string;
  /** Package / menu selection / menu item products are picked through the sub-items popup (invoices, estimates). */
  subItems?: boolean;
  /** Show a warning under the price while the line sells below the product's cost (invoices). */
  warnBelowCost?: boolean;
}

/** True when the line's net unit price (after its discount, before tax) is under the product's cost. Unknown cost (0) never warns. */
export function sellsBelowCost(line: InvoiceLine): boolean {
  const cost = Number(line.selectedItem?.unitCost) || 0;
  const qty = Number(line.qty) || 0;
  if (cost <= 0 || qty <= 0 || !line.selectedItem?.id || line.isVoided || line.isReturned) return false;
  const gross = (Number(line.price) || 0) * qty;
  const amt = Number(line.discountAmount) || 0;
  const net = (gross - (line.discountPercentage ? gross * amt / 100 : amt)) / qty;
  return net < cost - 1e-9;
}

/**
 * Lines-table flavour shared by the sales documents (invoice, estimate, credit note …): sales
 * columns (qty, price, discount, tax, amount), branch-scoped item search with the customer's
 * pricing, barcode scan, bulk add + import, per-line accounts. Only the remove rule and the
 * barcode kind differ per document.
 */
export function salesLinesConfig(doc: () => Invoice, lookups: SalesLookupsService, opts: SalesLinesOptions): DocLinesConfig {
  const scope = () => doc().branchId;
  return {
    columns: [
      { key: 'item', type: 'item', label: 'DOC_LINES.ITEM_DETAILS' },
      { key: 'qty', type: 'qty', label: 'DOC_LINES.COL_QTY', width: '150px', min: 0 },
      {
        key: 'price', type: 'money', label: 'DOC_LINES.COL_PRICE', width: '130px', field: 'price', required: true, min: 0,
        disabled: (line: InvoiceLine) => !opts.canAdjustPrice() || line.isVoided || line.isReturned,
        hint: opts.warnBelowCost ? (line: InvoiceLine) => (sellsBelowCost(line) ? 'DOC_LINES.BELOW_COST' : null) : undefined,
      },
      { key: 'discount', type: 'discount', label: 'DOC_LINES.COL_DISCOUNT', width: '170px', required: true },
      { key: 'tax', type: 'tax', label: 'DOC_LINES.COL_TAX', width: '170px' },
      { key: 'amount', type: 'amount', label: 'DOC_LINES.COL_AMOUNT', width: '120px' },
    ],
    accounts: true,
    bulkItems: true,
    bulkExcludeTypes: opts.subItems ? ['serialized', 'batch', 'package', 'menuSelection', 'menuItem'] : ['serialized', 'batch'],
    subItems: opts.subItems ? { branchId: scope } : undefined,
    serialsLookup: id => lookups.getProductSerials(id, scope()),
    batchesLookup: id => lookups.getProductBatches(id, scope()),
    itemsDisabled: () => !scope(),
    itemSearch: (term, filter) =>
      lookups.getBranchProducts({ page: filter?.page ?? 1, limit: 20, searchTerm: term, branchId: scope(), customerId: doc().customerId, tags: filter?.tags }),
    itemFilterTags: p => lookups.getProductTags(p),
    searchByBarcodes: barcodes => lookups.searchByBarcodes(barcodes, opts.barcodeType),
    barcodeLookup: term => lookups.getBranchProductByBarcode(term, scope()),
    canRemove: opts.canRemove,
  };
}
