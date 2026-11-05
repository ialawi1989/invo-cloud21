import { RequiredRule } from '../../services/document-validation';

/** Bill of entry header rules (legacy form): number, date, the payment method, and the bill + branch it comes from. */
export const BILL_OF_ENTRY_RULES: RequiredRule[] = [
  { field: 'billingOfEnrtyNumber', labelKey: 'BILL_OF_ENTRY.REQUIRED.NUMBER' },
  { field: 'billingOfEntryDate', labelKey: 'BILL_OF_ENTRY.REQUIRED.DATE' },
  { field: 'paymentMethodId', labelKey: 'BILL_OF_ENTRY.REQUIRED.PAYMENT_METHOD' },
  { field: 'billingId', labelKey: 'BILL_OF_ENTRY.REQUIRED.BILL' },
  { field: 'branchId', labelKey: 'BILL_OF_ENTRY.REQUIRED.BRANCH' },
];
