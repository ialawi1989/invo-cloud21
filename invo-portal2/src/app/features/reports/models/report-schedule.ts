import { carryTargetFor } from '../business-overview/shared/carry-filter';

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ScheduleAttachment = 'pdf' | 'xlsx';

/** A scheduled report as the backend stores it (`accounts/scheduledReports/…`). */
export interface ScheduledReport {
  id: string;
  reportType: string;
  frequency: ScheduleFrequency;
  startDate: string;
  scheduleTime: string;
  previousRun: string | null;
  nextRun: string | null;
  /** Employee ids that receive the report by e-mail. */
  recipients: string[];
  additionalRecipients: string[];
  attachmentType: ScheduleAttachment;
  isActive: boolean;
  /** What the report runs with: branches, comparison, "as of". */
  filter: Record<string, any>;
}

/**
 * The scheduler (InvoCloudBack `scheduledReport.repo.ts` → `getfile`) knows a report by its own slug. The portal's slug is the
 * same except for these — verified against the `switch` in that file.
 */
const SCHEDULER_SLUG: Record<string, string> = {
  'sales-by-category': 'sales-by-category-report',
  'sales-by-product': 'sales-by-product-report',
  'sales-by-aggregator': 'sales-by-aggregator-report',
  'sales-by-employee': 'sales-by-employee-report',
  'trial-balance': 'trial-balance-basis-accrual',
  'product-movement': 'product-movment',
  'wastage-summary': 'wastage-summary-report',
  'detailed-wastage': 'detailed-wastage-report',
  'expired-products': 'expired-products-report',
  'reorder-alert': 'reorder-alert-report',
  'general-inventory': 'general-inventory-report',
  'inventory-transfer': 'inventory-transfer-report',
  'voided-sales': 'voided-sales-report',
  'customer-aging': 'customer-aging-report',
  'delivery-charge': 'delivery-charge-report',
  'surcharge': 'surcharge-report',
  'payouts': 'payout-report',
  'daily-payment': 'daily-payment-report',
  'unsold-products': 'unsold-products-report',
  'monthly-bld-breakdown': 'monthly-bld-breakdown-report',
  'vat-transaction-details': 'vat-transaction-details-report',
  'product-wise-vat': 'product-wise-vat-report',
  'sales-by-tables': 'sales-by-tables',
  'supplier-aging': 'supplier-aging-report',
  'supplier-aging-summary': 'supplier-aging-summary-report',
  'supplier-balances': 'supplier-balances-report',
  'payment-made': 'payment-made-report',
  'supplier-credits': 'supplier-credits-report',
  'supplier-refunds': 'supplier-refunds-report',
  'supplier-change-price': 'supplier-change-price-report',
  'open-pending-po': 'open-pending-po-report',
  'customer-aging-summary': 'customer-aging-summary-report',
  'sales-by-customers-summary': 'sales-by-customers-summary',
  'credit-notes': 'credit-notes-report',
  'refunds': 'refunds-report',
  'customer-wise-item-sales': 'customerwiseitemsalesreport',
  'customer-wise-discount': 'customerwisediscountreport',
  'payment-received': 'payment-received-report',
  'customer-order-history': 'customer-order-history',
  'cashier-report': 'cashierreportbycashierid',
  'attendance': 'attendence-report',
  'vat-audit': 'vat-audit-report',
  'payment-method': 'payment-method-report',
  'general-ledger': 'general-ledger-report',
};

/** Every report type the scheduler can run (the cases of that `switch`). */
const SCHEDULABLE = new Set([
  'profit-and-loss', 'balance-sheet', 'trial-balance-basis-accrual', 'general-ledger-report', 'journal-entries', 'sales-summary',
  'sales-by-department', 'sales-by-category-report', 'sales-by-product-report', 'sales-by-products-category',
  'sales-by-menu-products-vs-options', 'sales-by-service', 'sales-by-menu-product-vs-service', 'sales-by-menu',
  'sales-by-menu-sections', 'sales-by-terminal', 'sales-by-delivery-area', 'sales-by-aggregator-report', 'sales-by-invoice',
  'daily-closing-report', 'sales-by-brands', 'department-sales-and-payments-overview', 'surcharge-report',
  'unsold-products-report', 'delivery-charge-report', 'delivery-charge-by-city-report', 'daily-sales', 'hourly-sales',
  'weekday-sales', 'monthly-sales', 'weekly-sales', 'quarterly-sales', 'yearly-sales', 'general-inventory-report',
  'inventory-transfer-report', 'sales-vs-inventory-usage', 'product-sales-vs-inventory-usage', 'product-movment',
  'wastage-summary-report', 'detailed-wastage-report', 'reorder-alert-report', 'expired-products-report', 'reorder-report',
  'customer-order-history', 'sales-by-customers-summary', 'customer-aging-report', 'customer-aging-summary-report',
  'payment-received-report', 'credit-notes-report', 'refunds-report', 'customerwiseitemsalesreport',
  'customerwisediscountreport', 'customer-balance-summary', 'sales-by-employee-report', 'sales-by-employee-vs-products',
  'cashierreportbycashierid', 'cashier-summary-report', 'short-over-report', 'driver-report', 'driver-details-report',
  'attendence-report', 'cashierlist', 'supplier-aging-report', 'supplier-aging-summary-report', 'supplier-balances-report',
  'payment-made-report', 'supplier-credits-report', 'supplier-refunds-report', 'supplier-change-price-report',
  'vat-audit-report', 'product-wise-vat-report', 'vat-report', 'vat-transaction-details-report', 'purchase-by-supplier',
  'purchase-by-category', 'open-pending-po-report', 'purchase-by-item', 'sales-by-tables', 'sales-by-table-groups',
  'table-usage-report', 'table-usage-summary-report', 'customer-table-by-employee', 'payment-method-report',
  'product-prepared-time-summary', 'prepared-time-summary', 'discount-report', 'sales-by-discount-report',
  'monthly-bld-breakdown-report', 'void-transactions', 'daily-payment-report', 'payout-report', 'accountjournal',
  'account-journals', 'sales-by-hours-by-product', 'voided-sales-report',
]);

/** Legacy `canBeScheduled: false` — one business day of one branch, not a recurring report (Daily Closing). */
const NOT_SCHEDULABLE = new Set(['daily-closing-report']);

/** The scheduler's type of a portal report, or `null` when it can't be scheduled. */
export function scheduleTypeFor(slug: string): string | null {
  const type = SCHEDULER_SLUG[slug] ?? slug;
  return SCHEDULABLE.has(type) && !NOT_SCHEDULABLE.has(type) ? type : null;
}

/** What the schedule form offers for a report (it only keeps what the report itself can use). */
export interface ScheduleCaps {
  branches: boolean;
  comparison: boolean;
  /** An "as of" report the user can also run as a range. */
  asOfOptional: boolean;
}

export function scheduleCapsFor(slug: string): ScheduleCaps {
  const t = carryTargetFor(slug);
  return {
    branches: !!t?.branches,
    comparison: !!(t?.comparison || t?.comparePeriods),
    asOfOptional: !!(t?.asOf && t?.asOfOptional),
  };
}
