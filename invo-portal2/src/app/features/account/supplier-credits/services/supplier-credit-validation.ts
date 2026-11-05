import { RequiredRule } from '../../services/document-validation';

/** Supplier credit header rules (legacy `SUPPLIER_CREDIT_SCHEMA`): number, supplier, branch, date and the bill ("all bills" counts). */
export const SUPPLIER_CREDIT_RULES: RequiredRule[] = [
  { field: 'supplierCreditNumber', labelKey: 'SUPPLIER_CREDITS.REQUIRED.CREDIT_NUMBER' },
  { field: 'supplierId', labelKey: 'SUPPLIER_CREDITS.REQUIRED.SUPPLIER' },
  { field: 'branchId', labelKey: 'SUPPLIER_CREDITS.REQUIRED.BRANCH' },
  { field: 'billingId', labelKey: 'SUPPLIER_CREDITS.REQUIRED.BILL' },
  { field: 'supplierCreditDate', labelKey: 'SUPPLIER_CREDITS.REQUIRED.CREDIT_DATE' },
];
