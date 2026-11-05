import { inject } from '@angular/core';

import { docEditableGuard } from '../../guards/doc-editable.guard';
import { InvoiceActions } from '../services/invoice-actions';
import { InvoicesService } from '../services/invoices.service';

/** `/account/invoices/:id`: refunded, void, written-off, closed or period-locked invoices open read-only. */
export const invoiceEditableGuard = docEditableGuard(() => {
  const invoices = inject(InvoicesService);
  const actions = inject(InvoiceActions);
  return {
    load: (id) => invoices.getInvoice(id),
    block: async (invoice) => {
      await actions.refresh(invoice.branchId || null); // the period lock needs the invoice's branch
      return actions.editStateBlock(invoice);
    },
  };
}, '/account/invoices/view');
