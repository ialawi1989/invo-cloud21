import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { Estimate } from '../../models/estimate.model';
import { fmtDate, invoiceToRenderData } from '../../invoices/services/invoice-render-data';

/**
 * Token data of an estimate for the shared document paper. It is the invoice mapping with the
 * document block re-pointed at the estimate header (`{{invoice.number}}` = estimate number,
 * `{{invoice.date}}` = estimate date, `{{invoice.dueDate}}` = expiry date — the tokens the estimate
 * template uses) and without payment / balance figures.
 */
export function estimateToRenderData(e: Estimate): DocumentRenderData {
  const data = invoiceToRenderData(e);
  return {
    ...data,
    invoice: {
      ...(data['invoice'] as Record<string, unknown>),
      number: e.estimateNumber,
      date: fmtDate(e.estimateDate),
      dueDate: fmtDate(e.estimateExpDate),
      status: '',
    },
    invoicePayments: [],
  };
}
