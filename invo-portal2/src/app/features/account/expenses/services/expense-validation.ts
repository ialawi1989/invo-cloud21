import { RequiredRule } from '../../services/document-validation';

/** Expense header rules (legacy `EXPENSE_SCHEMA`): number, date, branch and the payment method it was paid with. */
export const EXPENSE_RULES: RequiredRule[] = [
  { field: 'expenseNumber', labelKey: 'EXPENSES.REQUIRED.NUMBER' },
  { field: 'expenseDate', labelKey: 'EXPENSES.REQUIRED.DATE' },
  { field: 'branchId', labelKey: 'EXPENSES.REQUIRED.BRANCH' },
  { field: 'paymentMethodId', labelKey: 'EXPENSES.REQUIRED.PAYMENT_METHOD' },
];
