import { DocExtraJournal } from '../components/doc-additional-details/doc-additional-details.types';
import { DocJournalRow } from '../components/doc-journal-tab/doc-journal-tab.component';
import { formatJournalDate } from './journal-date';

type Translate = (key: string, params?: Record<string, any>) => string;

/**
 * The "extra journals" of an invoice / credit note / supplier credit (`getInvoiceJournal` / `getCreditNoteJournal` →
 * `extraJournals[]`): write-off, applied credits and refunds, each with its own heading — the same
 * wording and links as legacy's `extraJournalsHeadLine`. Entries without a known heading are skipped.
 * `onDeleteApplied` is given the applied-credit id (invoices and bills: it lets the user take a credit back).
 */
export function buildExtraJournals(
  kind: 'invoice' | 'creditNote' | 'supplierCredit' | 'bill' | 'billPayment' | 'payment',
  extras: any[] | null | undefined,
  t: Translate,
  onDeleteApplied?: (appliedCreditId: string) => void,
): DocExtraJournal[] {
  const out: DocExtraJournal[] = [];
  for (const e of extras ?? []) {
    const rows: DocJournalRow[] = (e.journals ?? []).map((j: any) => ({ accountType: j?.accountType || j?.name, debit: j?.debit, credit: j?.credit }));
    const date = formatJournalDate(e.createdAt);

    if (kind === 'payment') {
      // One block per invoice the payment settled (`invoiceNumber`), dated to the minute like legacy.
      out.push({ heading: t('DOC_VIEW.JOURNAL_PAYMENT_MADE', { date: formatJournalDate(e.createdAt, true), bill: e.invoiceNumber }), rows });
      continue;
    }

    if (kind === 'billPayment') {
      // One block per bill the payment settled (`billingNumber`).
      out.push({ heading: t('DOC_VIEW.JOURNAL_PAYMENT_MADE', { date, bill: e.billingNumber }), rows });
      continue;
    }

    if (kind === 'invoice') {
      if (e.reference === 'writeOff') {
        out.push({ heading: t('DOC_VIEW.JOURNAL_WRITE_OFF_ON', { date }), rows });
      } else if (e.reference === 'Applied Credits' && e.referenceId) {
        out.push({
          heading: t('DOC_VIEW.JOURNAL_APPLIED_FROM') + ' ',
          link: { label: e.creditNoteNumber, url: ['/account/credit-notes/view', e.referenceId] },
          suffix: ' ' + t('DOC_VIEW.JOURNAL_ON', { date }),
          rows,
          onDelete: e.appliedCreditId && onDeleteApplied ? () => onDeleteApplied(e.appliedCreditId) : undefined,
        });
      }
    } else if (kind === 'bill') {
      // A bill shows the supplier credits applied to it (`supplierCreditNumber` / `referenceId`) and its refunds.
      if (e.reference === 'Applied Credits' && e.referenceId) {
        out.push({
          heading: t('DOC_VIEW.JOURNAL_APPLIED_FROM') + ' ',
          link: { label: e.supplierCreditNumber, url: ['/account/supplier-credit/view', e.referenceId] },
          suffix: ' ' + t('DOC_VIEW.JOURNAL_ON', { date }),
          rows,
          onDelete: e.appliedCreditId && onDeleteApplied ? () => onDeleteApplied(e.appliedCreditId) : undefined,
        });
      }
    } else if (e.reference === 'Applied Credits') {
      // A supplier credit is applied to a BILL — the backend (`supplierCredit.repo.ts` journals) returns it as
      // `billingNumber`; `invoiceNumber` doesn't exist there (legacy printed "for undefined").
      const target = kind === 'supplierCredit' ? e.billingNumber : e.invoiceNumber;
      out.push({ heading: t('DOC_VIEW.JOURNAL_APPLIED_FOR', { date, invoice: target }), rows });
    } else if (e.reference === 'Refund') {
      out.push({ heading: t('DOC_VIEW.JOURNAL_REFUNDED_ON', { date }), rows });
    }
  }
  return out;
}
