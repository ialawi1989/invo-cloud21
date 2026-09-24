import { RequiredRule } from '../../services/document-validation';

/** Invoice header rules (legacy `INVOICE_SCHEMA`): create needs the number, draft needs no customer. */
export const INVOICE_RULES: RequiredRule[] = [
  { field: 'invoiceNumber', labelKey: 'INVOICES.REQUIRED.INVOICE_NUMBER', modes: ['create'] },
  { field: 'branchId', labelKey: 'INVOICES.REQUIRED.BRANCH' },
  { field: 'customerId', labelKey: 'INVOICES.REQUIRED.CUSTOMER', modes: ['create', 'edit'] },
];
