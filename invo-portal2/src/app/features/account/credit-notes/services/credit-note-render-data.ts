import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { CreditNote } from '../../models/credit-note.model';
import { fmtDate, invoiceToRenderData } from '../../invoices/services/invoice-render-data';

/**
 * Token data of a credit note for the shared document paper: the invoice mapping with the document
 * block re-pointed at the credit note header (`{{invoice.number}}` = credit note number, `reference` =
 * the credited invoice) and without payment figures.
 */
export function creditNoteToRenderData(c: CreditNote): DocumentRenderData {
  const data = invoiceToRenderData(c);
  return {
    ...data,
    invoice: {
      ...(data['invoice'] as Record<string, unknown>),
      number: c.creditNoteNumber,
      date: fmtDate(c.creditNoteDate),
      dueDate: '',
      reference: c.invoiceNumber || c.refrenceNumber,
      status: '',
    },
    invoicePayments: [],
  };
}
