import { DestroyRef } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { COMPARISON_REPORTS } from '../comparison/comparison-reports';
import { FLAT_REPORTS } from '../flat/flat-reports';
import { SUB_REPORTS } from '../models/report-catalog';

const path = (url: string) => url.split('?')[0].split('#')[0];
const isReportPage = (url: string) => path(url).startsWith('/reports/view/');

/**
 * Remembers which page a report was opened from. A drill-through (name -> sub-report, count -> transactions, VAT row ->
 * VAT details ...) is an ordinary in-app navigation, so the previous URL is the source report with ALL its filters
 * (period, branches, opening hours, comparison ...) in its query string; "Back" returns there instead of the catalog.
 * Filter changes on the same report rewrite the URL in place (same path) and are not counted as a previous page.
 */
export class ReportBackTrail {
  private prev: string | null;
  private cur: string | null = null;

  constructor(private router: Router, destroyRef: DestroyRef) {
    // Created while the navigation that opened this report is still running, so the last successful one is the page before.
    this.prev = router.lastSuccessfulNavigation()?.finalUrl?.toString() ?? null;
    const sub = router.events.subscribe(e => {
      if (!(e instanceof NavigationEnd)) return;
      const url = e.urlAfterRedirects;
      if (this.cur !== null && path(this.cur) !== path(url)) this.prev = this.cur;
      this.cur = url;
    });
    destroyRef.onDestroy(() => sub.unsubscribe());
  }

  /** Forget the page before (the report was opened from the Browse dialog rather than a drill-through link). */
  reset(): void { this.prev = null; }

  /** The report page (with its query string) this one was opened from, or null. */
  source(currentUrl: string): string | null {
    return this.prev && isReportPage(this.prev) && path(this.prev) !== path(currentUrl) ? this.prev : null;
  }
}

/** Reports other reports open through a link: "Back" on these returns to the report the link was on. */
const DRILL_TARGETS = new Set<string>([
  ...SUB_REPORTS.map(r => r.slug),
  ...Object.values(FLAT_REPORTS).flatMap(c => c.columns.flatMap(col => (col.drill ? [col.drill.slug] : []))),
  ...Object.values(COMPARISON_REPORTS).flatMap(c => [c.drill?.slug, c.countDrill?.slug].filter((x): x is string => !!x)),
  // linked from custom report bodies (voided sales from Sales by Product, an employee's sales from Employee Detail,
  // a customer's / supplier's invoices from the aging summary, a product's stock card, P&L from the Balance Sheet)
  'voided-sales', 'sales-by-employee', 'customer-aging', 'supplier-aging', 'product-movement', 'profit-and-loss',
  // an employee's lines / totals opened from the commission and tips reports
  'employee-commission-detail', 'employee-commission-summary', 'tips-detail', 'tips-summary',
]);
export const isDrillTarget = (slug: string): boolean => DRILL_TARGETS.has(slug);
