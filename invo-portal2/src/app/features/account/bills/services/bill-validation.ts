import { RequiredRule } from '../../services/document-validation';

/** Bill header rules (legacy `BILL_SCHEMA`): number, supplier, branch and both dates. */
export const BILL_RULES: RequiredRule[] = [
  { field: 'billingNumber', labelKey: 'BILLS.REQUIRED.BILL_NUMBER' },
  { field: 'supplierId', labelKey: 'BILLS.REQUIRED.SUPPLIER' },
  { field: 'branchId', labelKey: 'BILLS.REQUIRED.BRANCH' },
  { field: 'billingDate', labelKey: 'BILLS.REQUIRED.BILL_DATE' },
  { field: 'dueDate', labelKey: 'BILLS.REQUIRED.DUE_DATE' },
];
