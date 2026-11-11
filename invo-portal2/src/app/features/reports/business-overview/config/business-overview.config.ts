/**
 * Business Overview reports — configuration.
 *
 * Mirrors InvoCloudFront2's `business-overview.config.ts`. Endpoint names were
 * verified against InvoCloudBack (`routes/v1/app/reports/reports.ts`,
 * `exportPdf.ts`, `exportXlsx.ts`). Note the data route and the export route
 * differ for some reports (e.g. data `profitAndLossReport`, export
 * `profitAndLoss`), exactly as the backend registers them.
 */

export type BoReportSlug =
  | 'profit-and-loss'
  | 'balance-sheet'
  | 'trial-balance'
  | 'general-ledger'
  | 'journal-entries';

export interface BoReportConfig {
  slug: BoReportSlug;
  titleKey: string;
  /** `POST accounts/reports/{dataRoute}` */
  dataRoute: string;
  /** `POST accounts/reports/export[Pdf]/{exportPath}` */
  exportPath: string;
  /** Point-in-time ("As of") report instead of a from–to range. */
  asOf: boolean;
  /** The user may switch between an "as of" date and a from–to range (legacy "As of" checkbox); `asOf` is the default. */
  asOfOptional?: boolean;
  /** Offers the period/branch comparison control. */
  comparison: boolean;
  /** Rows link to the Account Journals sub-report. */
  drillDown: boolean;
  /** Backend pages the result (journal entries); the others return everything. */
  paged: boolean;
  permission: string;
}

export const BO_REPORTS: BoReportConfig[] = [
  {
    slug: 'profit-and-loss', titleKey: 'REPORTS.ITEMS.PROFIT_AND_LOSS',
    dataRoute: 'profitAndLossReport', exportPath: 'profitAndLoss',
    asOf: false, comparison: true, drillDown: true, paged: false,
    permission: 'reportsSecurity.actions.ProfitandLoss.access',
  },
  {
    slug: 'balance-sheet', titleKey: 'REPORTS.ITEMS.BALANCE_SHEET',
    dataRoute: 'balanceSheetReport', exportPath: 'balanceSheet',
    asOf: true, asOfOptional: true, comparison: true, drillDown: true, paged: false,
    permission: 'reportsSecurity.actions.BalanceSheet.access',
  },
  {
    slug: 'trial-balance', titleKey: 'REPORTS.ITEMS.TRIAL_BALANCE',
    dataRoute: 'trialBalanceReport', exportPath: 'trialBalanceReport',
    asOf: true, asOfOptional: true, comparison: true, drillDown: true, paged: false,
    permission: 'reportsSecurity.actions.TrialBalanceBasisAccrual.access',
  },
  {
    slug: 'general-ledger', titleKey: 'REPORTS.ITEMS.GENERAL_LEDGER',
    dataRoute: 'generalLedgerReport', exportPath: 'generalLedgerReport',
    asOf: false, asOfOptional: true, comparison: true, drillDown: true, paged: false,
    permission: 'reportsSecurity.actions.GeneralLedgerReport.access',
  },
  {
    slug: 'journal-entries', titleKey: 'REPORTS.ITEMS.JOURNAL_ENTRIES',
    dataRoute: 'journalEntriesReports', exportPath: 'journalEntries',
    asOf: false, comparison: false, drillDown: false, paged: true,
    permission: 'reportsSecurity.actions.JournalEntries.access',
  },
];

/** Account Journals — the drill-down sub-report shared by P&L, BS, TB and GL. */
export const ACCOUNT_JOURNALS = {
  titleKey: 'REPORTS.ITEMS.ACCOUNT_JOURNALS',
  /** Data route is the singular `accountJournal`; export is the plural. */
  dataRoute: 'accountJournal',
  exportPath: 'accountJournals',
  permission: 'reportsSecurity.actions.AccountJournals.access',
};

export function findBoReport(slug: string): BoReportConfig | undefined {
  return BO_REPORTS.find(r => r.slug === slug);
}
