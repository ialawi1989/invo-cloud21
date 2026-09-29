import { RequiredRule } from '../../services/document-validation';

/** Estimate header rules (backend schema): number, branch and — in the UI — the customer. */
export const ESTIMATE_RULES: RequiredRule[] = [
  { field: 'estimateNumber', labelKey: 'ESTIMATES.REQUIRED.ESTIMATE_NUMBER', modes: ['create'] },
  { field: 'branchId', labelKey: 'ESTIMATES.REQUIRED.BRANCH' },
  { field: 'customerId', labelKey: 'ESTIMATES.REQUIRED.CUSTOMER', modes: ['create', 'edit'] },
];
