import type { RawReportResponse, ReportColumn, ReportMeta, ReportNormalizeContext, ReportResult } from './report.model';

/**
 * Employee commission & tips reports. Opt-in per company (`earningsFeature`): hidden from the catalog and refused by
 * the viewer until Settings → Commission & Tips switches the feature on.
 *
 * Legacy had one hand-written component per report; here they ride the generic shell. The backend answers with
 * `{ records }` (+ paging for the two detail reports, + the undistributed `pool` balances for the tips summary) and
 * no column list, so each report names its columns here. The two detail reports are paged on the server (50 by
 * default); the shell has no pager, so they ask for a large page instead of silently showing only the first 50.
 */

const L = 'REPORTS.EARNINGS_COLS.';
const col = (key: string, labelKey: string, type: ReportColumn['type'] = 'text'): ReportColumn => ({
  key, label: L + labelKey, type, align: type === 'currency' || type === 'number' || type === 'percent' ? 'end' : 'start',
});
/** Amounts here are plain numbers with the company's decimals, not necessarily money; `currency` formats both alike. */
const money = (key: string, labelKey: string) => col(key, labelKey, 'currency');

import { journalLink } from '../../settings/chart-of-accounts/utils/journal-links';

/** The period (and branches) a link carries to the report it opens. */
const period = (ctx: { fromDate?: string; toDate?: string; branches?: string[] }): Record<string, string | null> => ({
  preset: 'custom', fromDate: ctx.fromDate ?? null, toDate: ctx.toDate ?? null, branches: ctx.branches?.length ? ctx.branches.join(',') : null,
});
/** The employee's own report (their lines, or their totals), for the same period. */
const toEmployeeReport = (slug: string): ReportColumn['link'] => (row, ctx) =>
  row['employeeId'] ? { path: ['/reports/view', slug], query: { ...period(ctx), employee: String(row['employeeId']) } } : null;
const toInvoice: ReportColumn['link'] = row => row['invoiceId'] ? { path: [journalLink('Invoice', row['invoiceId'])] } : null;
const toProductMovement: ReportColumn['link'] = (row, ctx) =>
  row['productId'] ? { path: ['/reports/view', 'product-movement'], query: { ...period(ctx), products: String(row['productId']) } } : null;
/** A date as the legacy tables show it: dd/MM/yyyy (read from the text, so no timezone shifts the day). */
const dmy = (v: unknown): string => {
  if (v == null || v === '') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
/** A quantity with up to three decimals (no trailing zeros), as the legacy `number:'1.0-3'`. */
const qty = (v: unknown): string => String(Number(Number(v ?? 0).toFixed(3)));
const text = (key: string, labelKey: string, end = false, i18n?: string): ReportColumn => ({ ...col(key, labelKey), align: end ? 'end' : 'start', ...(i18n ? { i18n } : {}) });
/** The closing-balance column of the summary reports: legacy heads it "Balance at {end date}" (dd/MM/yyyy). */
const balanceAt = (key: string, ctx?: ReportNormalizeContext): ReportColumn =>
  ({ ...money(key, 'BALANCE_AT'), labelParams: { date: dmy(ctx?.filter.toDate) } });
const linked = (c: ReportColumn, link: ReportColumn['link']): ReportColumn => ({ ...c, link });

const rowsOf = (raw: RawReportResponse): Record<string, any>[] =>
  Array.isArray(raw.records) ? raw.records : [];

const commissionDetail = (raw: RawReportResponse): ReportResult => {
  const rows = rowsOf(raw).map(r => ({
    ...r, invoiceDate: dmy(r['invoiceDate']), eligibleDate: dmy(r['eligibleDate']), soldQty: qty(r['soldQty']), returnedQty: qty(r['returnedQty']),
    commissionRate: qty(r['commissionRate']) + (r['commissionType'] === 'percentage' ? '%' : ''),
  }));
  return {
    table: {
      columns: [
        linked(col('employeeName', 'EMPLOYEE_NAME'), toEmployeeReport('employee-commission-summary')), linked(col('invoiceNumber', 'INVOICE_NUMBER'), toInvoice), text('invoiceDate', 'INVOICE_DATE'),
        linked(col('productName', 'PRODUCT'), toProductMovement), text('soldQty', 'SOLD_QTY', true), text('returnedQty', 'RETURNED_QTY', true),
        money('netSale', 'NET_SALE'), text('commissionType', 'COMMISSION_TYPE', false, 'REPORTS.COMMISSION_TYPES.'), text('commissionRate', 'COMMISSION_RATE', true),
        money('grossCommission', 'GROSS_COMMISSION'), money('returnedCommission', 'RETURNED_COMMISSION'),
        money('netCommission', 'NET_COMMISSION'), money('earnedAmount', 'EARNED'), money('paidAmount', 'PAID'),
        money('outstandingAmount', 'OUTSTANDING'), text('eligibleDate', 'ELIGIBLE_DATE'), text('status', 'STATUS', false, 'REPORTS.EARNINGS_STATUS.'),
        col('paymentReferences', 'PAYMENT_REFERENCES'),
      ],
      rows,
    },
    chartRows: rows,
  };
};

const commissionSummary = (raw: RawReportResponse, ctx?: ReportNormalizeContext): ReportResult => {
  const rows = rowsOf(raw);
  return {
    table: {
      columns: [
        linked(col('employeeName', 'EMPLOYEE_NAME'), toEmployeeReport('employee-commission-detail')), money('salesAmount', 'SALES_AMOUNT'), money('pending', 'PENDING'),
        money('earned', 'EARNED'), money('reversals', 'REVERSALS'), money('paid', 'PAID'), balanceAt('outstanding', ctx),
      ],
      rows,
    },
    chartRows: rows,
  };
};

const tipsDetail = (raw: RawReportResponse): ReportResult => {
  const rows = rowsOf(raw).map((r): Record<string, unknown> => ({ ...r, tipDate: dmy(r['tipDate']), distributionDate: dmy(r['distributionDate']) }));
  // Card fees are 0 unless the company deducts them, so those columns only appear when some tip had one.
  const hasCardFees = rows.some(r => Number(r['feeAmount'] ?? 0) !== 0);
  return {
    table: {
      columns: [
        text('tipDate', 'TIP_DATE'), col('branchName', 'BRANCH_NAME'), linked(col('invoiceNumber', 'INVOICE_NUMBER'), toInvoice), text('kind', 'KIND', false, 'REPORTS.TIP_KINDS.'),
        linked(col('employeeName', 'EMPLOYEE_NAME'), toEmployeeReport('tips-summary')),
        ...(hasCardFees ? [money('grossAmount', 'TIP_GROSS'), money('feeAmount', 'CARD_FEE')] : []),
        money('amount', hasCardFees ? 'NET_TIP' : 'AMOUNT'), money('paidAmount', 'PAID'), money('outstandingAmount', 'OUTSTANDING'),
        text('status', 'STATUS', false, 'REPORTS.EARNINGS_STATUS.'), text('distributionDate', 'DISTRIBUTION_DATE'),
      ],
      rows,
    },
    chartRows: rows,
  };
};

const tipsSummary = (raw: RawReportResponse, ctx?: ReportNormalizeContext): ReportResult => {
  const people = rowsOf(raw);
  const hasCardFees = people.some(r => Number(r['cardFees'] ?? 0) !== 0);
  // Undistributed pool tips per branch (as of the end date) belong to no one: listed after the employees.
  const pool = (Array.isArray(raw['pool']) ? raw['pool'] : []).map((p: any) => ({
    employeeName: `${ctx?.t('REPORTS.TIP_KINDS.pool') ?? 'Pool'} · ${p.branchName ?? ''}`.trim(), outstanding: p.undistributed,
  }));
  const rows = [...people, ...pool];
  return {
    table: {
      columns: [
        linked(col('employeeName', 'EMPLOYEE_NAME'), toEmployeeReport('tips-detail')), money('directTips', 'DIRECT_TIPS'), money('poolShares', 'POOL_SHARES'),
        ...(hasCardFees ? [money('cardFees', 'CARD_FEES')] : []),
        money('paid', 'PAID'), balanceAt('outstanding', ctx),
      ],
      rows,
    },
    chartRows: people,
  };
};

const BIG_PAGE = { page: 1, limit: 5000 };

export const EMPLOYEE_EARNINGS_REPORTS: ReportMeta[] = [
  {
    slug: 'employee-commission-detail', route: 'employeeCommissionDetail', titleKey: 'REPORTS.ITEMS.EMPLOYEE_COMMISSION_DETAIL',
    descriptionKey: 'REPORTS.DESC.EMPLOYEE_COMMISSION_DETAIL', icon: 'user-check',
    permission: 'employeePayoutSecurity.actions.view.access', earningsFeature: 'commission',
    filters: {
      date: true, branches: true, singleEmployee: true, sources: ['Pending', 'Earned', 'PartiallyPaid', 'Paid', 'Overpaid', 'Cancelled'], sourcesKey: 'status',
      sourcesLabel: 'REPORTS.FILTER.COMMISSION_STATUS', sourcesOptionPrefix: 'REPORTS.EARNINGS_STATUS.',
    }, requestFilter: BIG_PAGE, normalize: commissionDetail,
  },
  {
    slug: 'employee-commission-summary', route: 'employeeCommissionSummary', titleKey: 'REPORTS.ITEMS.EMPLOYEE_COMMISSION_SUMMARY',
    descriptionKey: 'REPORTS.DESC.EMPLOYEE_COMMISSION_SUMMARY', icon: 'user-check',
    permission: 'employeePayoutSecurity.actions.view.access', earningsFeature: 'commission',
    filters: { date: true, branches: true, singleEmployee: true }, normalize: commissionSummary,
  },
  {
    slug: 'tips-detail', route: 'tipsDetail', titleKey: 'REPORTS.ITEMS.TIPS_DETAIL',
    descriptionKey: 'REPORTS.DESC.TIPS_DETAIL', icon: 'user-check',
    permission: 'tipsSecurity.actions.view.access', earningsFeature: 'tips',
    filters: {
      date: true, branches: true, singleEmployee: true, sources: ['direct', 'pool', 'share'], sourcesKey: 'kind',
      sourcesLabel: 'REPORTS.FILTER.TIP_KIND', sourcesOptionPrefix: 'REPORTS.TIP_KINDS.',
    }, requestFilter: BIG_PAGE, normalize: tipsDetail,
  },
  {
    slug: 'tips-summary', route: 'tipsSummary', titleKey: 'REPORTS.ITEMS.TIPS_SUMMARY',
    descriptionKey: 'REPORTS.DESC.TIPS_SUMMARY', icon: 'user-check',
    permission: 'tipsSecurity.actions.view.access', earningsFeature: 'tips',
    filters: { date: true, branches: true, singleEmployee: true }, normalize: tipsSummary,
  },
];
