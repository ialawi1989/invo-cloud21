import { DocLinesConfig } from '../../components/doc-lines-table/doc-lines.types';
import { Invoice } from '../../models/invoice.model';
import { SalesLookupsService } from '../../services/sales-lookups.service';

/**
 * Invoice flavour of the shared lines table: sales columns (qty, rate, discount, tax, amount),
 * branch-scoped item search with the customer's pricing, barcode scan, bulk add, per-line accounts.
 */
export function invoiceLinesConfig(
  invoice: () => Invoice,
  lookups: SalesLookupsService,
  opts: { canAdjustPrice: () => boolean; canVoid: () => boolean },
): DocLinesConfig {
  const scope = () => invoice().branchId;
  return {
    columns: [
      { key: 'item', type: 'item', label: 'DOC_LINES.ITEM_DETAILS' },
      { key: 'qty', type: 'qty', label: 'INVOICES.FORM.QTY', width: '150px', min: 0 },
      {
        key: 'price', type: 'money', label: 'INVOICES.FORM.PRICE', width: '130px', field: 'price', required: true, min: 0,
        disabled: line => !opts.canAdjustPrice() || line.isVoided || line.isReturned,
      },
      { key: 'discount', type: 'discount', label: 'INVOICES.FORM.DISCOUNT', width: '170px' },
      { key: 'tax', type: 'tax', label: 'INVOICES.FORM.TAX', width: '170px' },
      { key: 'amount', type: 'amount', label: 'INVOICES.FORM.AMOUNT', width: '120px' },
    ],
    accounts: true,
    bulkItems: true,
    excludeTypes: ['serialized', 'batch'],
    itemsDisabled: () => !scope(),
    itemSearch: async term =>
      lookups.getBranchProducts({ page: 1, limit: 20, searchTerm: term, branchId: scope(), customerId: invoice().customerId }),
    barcodeLookup: term => lookups.getBranchProductByBarcode(term, scope()),
    canRemove: (line, ctx) => {
      if (!opts.canVoid() || line.isVoided) return false;
      if (ctx.status === 'Open') return true;
      const active = invoice().lines.filter((l: any) => !l.isDeleted);
      const draftMain = invoice().lines.filter((l: any) => !l.isDeleted && !l.isVoided && (l.parentId == null || l.parentId === ''));
      const singleDraft = ctx.status === 'Draft' && draftMain.length <= 1;
      return active.length > 1 && !singleDraft && !line.isReturned && !(line.voidedItems?.length);
    },
  };
}
