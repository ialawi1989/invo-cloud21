import { RequiredRule } from '../../services/document-validation';

/** Purchase order header rules (backend schema + the legacy form): number, supplier, branch and both dates. */
export const PURCHASE_ORDER_RULES: RequiredRule[] = [
  { field: 'purchaseNumber', labelKey: 'PURCHASE_ORDERS.REQUIRED.PURCHASE_NUMBER' },
  { field: 'supplierId', labelKey: 'PURCHASE_ORDERS.REQUIRED.SUPPLIER' },
  { field: 'branchId', labelKey: 'PURCHASE_ORDERS.REQUIRED.BRANCH' },
  { field: 'purchaseDate', labelKey: 'PURCHASE_ORDERS.REQUIRED.ISSUE_DATE' },
  { field: 'dueDate', labelKey: 'PURCHASE_ORDERS.REQUIRED.EXPIRY_DATE' },
];
