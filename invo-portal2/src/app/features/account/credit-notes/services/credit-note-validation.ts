import { RequiredRule } from '../../services/document-validation';

/** Credit note header rules (legacy `CREDIT_NOTE_SCHEMA`): number, the invoice being credited, and the customer / branch that lead to it. */
export const CREDIT_NOTE_RULES: RequiredRule[] = [
  { field: 'creditNoteNumber', labelKey: 'CREDIT_NOTES.REQUIRED.CREDIT_NOTE_NUMBER' },
  { field: 'invoiceId', labelKey: 'CREDIT_NOTES.REQUIRED.INVOICE' },
  { field: 'customerId', labelKey: 'CREDIT_NOTES.REQUIRED.CUSTOMER', modes: ['create'] },
  { field: 'branchId', labelKey: 'CREDIT_NOTES.REQUIRED.BRANCH', modes: ['create'] },
];
