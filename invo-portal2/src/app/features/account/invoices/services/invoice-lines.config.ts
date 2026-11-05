import { DocLinesConfig } from '../../components/doc-lines-table/doc-lines.types';
import { Invoice, InvoiceLine } from '../../models/invoice.model';
import { SalesLookupsService } from '../../services/sales-lookups.service';
import { salesLinesConfig } from '../../services/sales-lines.config';

/** Invoice flavour of the shared sales lines table: removal follows the void privilege and the invoice status. */
export function invoiceLinesConfig(
  invoice: () => Invoice,
  lookups: SalesLookupsService,
  opts: { canAdjustPrice: () => boolean; canVoid: () => boolean; afterVoid?: (line: InvoiceLine) => Promise<void> },
): DocLinesConfig {
  return {
    taxType: 'editable',
    afterRemove: async (line, outcome) => { if (outcome === 'voided') await opts.afterVoid?.(line); },
    ...salesLinesConfig(invoice, lookups, {
    canAdjustPrice: opts.canAdjustPrice,
    barcodeType: 'invoice',
    canRemove: (line, ctx) => {
      if (!opts.canVoid() || line.isVoided) return false;
      if (ctx.status === 'Open') return true;
      const active = invoice().lines.filter((l: any) => !l.isDeleted);
      const draftMain = invoice().lines.filter((l: any) => !l.isDeleted && !l.isVoided && (l.parentId == null || l.parentId === ''));
      const singleDraft = ctx.status === 'Draft' && draftMain.length <= 1;
      return active.length > 1 && !singleDraft && !line.isReturned && !(line.voidedItems?.length);
    },
  }),
  };
}
