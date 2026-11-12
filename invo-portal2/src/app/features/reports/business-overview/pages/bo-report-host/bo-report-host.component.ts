import { Component, DestroyRef, ElementRef, OnDestroy, OnInit, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ReportBackTrail } from '../../../utils/report-back-trail';
import { ApiService } from '@core/http/api.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { LanguageService } from '@core/i18n/language.service';
import { LayoutService } from '@core/layout/services/layout.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  ReportsBrowseData, ReportsBrowseModalComponent,
} from '../../../components/reports-browse-modal/reports-browse-modal.component';
import {
  ExportFormat, ReportExportButtonComponent,
} from '../../../components/report-export-button/report-export-button.component';
import { ReportCrumb, ReportPageShellComponent } from '../../../components/report-page-shell/report-page-shell.component';
import { findReport } from '../../../models/report-catalog';
import { reportIcon } from '../../../models/report-icons';
import { ReportsFavoritesService } from '../../../services/reports-favorites.service';
import { ACCOUNT_JOURNALS, findBoReport } from '../../config/business-overview.config';
import { BusinessOverviewService } from '../../services/business-overview.service';
import { BoFilter, filterFromQuery, filterToQuery } from '../../shared/bo-filter';
import { carryFilterQuery, carryTargetFor } from '../../shared/carry-filter';
import { AccountJournalsComponent } from '../../components/account-journals/account-journals.component';
import { BalanceSheetComponent } from '../../components/balance-sheet/balance-sheet.component';
import { BoFilterBarComponent, BranchOption } from '../../components/bo-filter-bar/bo-filter-bar.component';
import { GeneralLedgerComponent } from '../../components/general-ledger/general-ledger.component';
import { JournalEntriesComponent } from '../../components/journal-entries/journal-entries.component';
import { ProfitAndLossComponent } from '../../components/profit-and-loss/profit-and-loss.component';
import { TrialBalanceComponent } from '../../components/trial-balance/trial-balance.component';
import { ReportsRecentService } from '../../../services/reports-recent.service';
import { ReportScheduleButtonComponent } from '../../../components/report-schedule-button/report-schedule-button.component';

/**
 * Host for the Business Overview reports (`/reports/view/:slug` for the five
 * statements, `/reports/view/:slug/account-journals` for the drill-down).
 * Owns what the legacy `ViewReportComponent` + `<app-filter-bar>` + export
 * button did for these reports: header, favourite, refresh, export / print,
 * the filter bar and the URL-synced filter state.
 */
@Component({
  selector: 'app-bo-report-host',
  standalone: true,
  imports: [ReportScheduleButtonComponent, 
    TranslateModule, ReportPageShellComponent, ReportExportButtonComponent, BoFilterBarComponent, ProfitAndLossComponent, BalanceSheetComponent,
    TrialBalanceComponent, GeneralLedgerComponent, JournalEntriesComponent, AccountJournalsComponent,
  ],
  templateUrl: './bo-report-host.component.html',
  styleUrl: './bo-report-host.component.scss',
})
export class BoReportHostComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private svc = inject(BusinessOverviewService);
  private favs = inject(ReportsFavoritesService);
  private priv = inject(PrivilegeService);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  /** The page this report was opened from (the Balance Sheet's "Current Year Net Profit" opens P&L). */
  private trail = new ReportBackTrail(this.router, inject(DestroyRef));
  private layout = inject(LayoutService);

  /** `:slug` route param (component input binding). */
  slug = input<string>('');

  private qp = toSignal(this.route.queryParams, { initialValue: this.route.snapshot.queryParams });
  private url = toSignal(this.route.url, { initialValue: this.route.snapshot.url });

  cfg = computed(() => findBoReport(this.slug()));
  meta = computed(() => findReport(this.slug())?.meta);
  isSub = computed(() => this.url().at(-1)?.path === 'account-journals');
  /** What the report does by default; a report with `asOfOptional` can be switched to a range (`range=1`). */
  asOfDefault = computed(() => !!this.cfg()?.asOf);
  /** The mode in effect right now (as-of date or range). */
  asOf = computed(() => this.filter().asOf);

  allowed = computed(() => {
    const c = this.cfg();
    if (!c) return false;
    if (this.priv.isSuperAdmin) return true;
    return this.priv.check(this.isSub() ? ACCOUNT_JOURNALS.permission : c.permission)
      || this.priv.check(c.permission);
  });

  // Equal filters are the SAME filter: page / limit / sort live in the URL too, and writing them must not look like a
  // filter change (that would reset the page and reload every report).
  filter = computed<BoFilter>(
    () => filterFromQuery(this.qp(), this.asOfDefault(), undefined, !!this.cfg()?.asOfOptional),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  accountId = computed<string>(() => String(this.qp()['accountId'] ?? ''));
  accountName = computed<string>(() => String(this.qp()['account'] ?? ''));

  branches = signal<BranchOption[]>([]);

  private shell = viewChild(ReportPageShellComponent);
  private contentArea = computed(() => this.shell()?.contentArea());
  private filterBarEl = viewChild('filterBar', { read: ElementRef });
  /** True once the filter bar has scrolled out of view — only then the title strip repeats the applied filters. */
  filterBarHidden = signal(false);
  private io?: IntersectionObserver;

  /**
   * What the report is currently filtered by — shown in the title strip so it stays visible
   * while the page scrolls (the filter bar itself scrolls away).
   */
  summary = computed<{ kind: 'period' | 'branches' | 'compare'; text: string }[]>(() => {
    const f = this.filter();
    if (this.isSub()) return [];
    const fmt = (iso: string) => new Date(iso + 'T00:00:00')
      .toLocaleDateString(this.lang.current(), { month: 'short', day: '2-digit', year: 'numeric' });
    const out: { kind: 'period' | 'branches' | 'compare'; text: string }[] = [
      { kind: 'period', text: this.asOf() ? fmt(f.to) : `${fmt(f.from)} → ${fmt(f.to)}` },
    ];
    if (f.branches.length) {
      const ids = new Set(f.branches);
      const names = this.branches().filter(b => ids.has(b.value)).map(b => b.label);
      out.push({ kind: 'branches', text: names.length ? names.join(', ') : `${f.branches.length}` });
    }
    if (f.compareType !== 'none') {
      out.push({
        kind: 'compare',
        text: f.compareType === 'branch'
          ? this.lang.instant('REPORTS.BO.COMPARE.BRANCH')
          : `${f.compareQty} ${this.lang.instant(f.comparePeriod === 'Year' ? 'REPORTS.BO.COMPARE.YEARS' : 'REPORTS.BO.COMPARE.MONTHS')}`,
      });
    }
    return out;
  });
  refreshTick = signal(0);

  readonly ACCOUNT_JOURNALS = ACCOUNT_JOURNALS;
  icon = (n?: string) => reportIcon(n);

  /** Breadcrumb above the title: Reports › Business Overview › (the statement, for the account drill-down) › this page. */
  crumbs = computed<ReportCrumb[]>(() => {
    const c = this.cfg();
    if (!c) return [];
    const t = (k: string) => this.lang.instant(k);
    const out: ReportCrumb[] = [{ label: t('REPORTS.CATALOG.TITLE'), url: '/reports' }, { label: t('REPORTS.GROUPS.BUSINESS_OVERVIEW'), url: '/reports' }];
    if (this.isSub()) {
      const [path, query] = this.router.url.split('?');
      out.push({ label: t(c.titleKey), url: path.replace(/\/account-journals$/, '') + (query ? '?' + query : '') });
      out.push({ label: t(this.ACCOUNT_JOURNALS.titleKey) });
    } else {
      out.push({ label: t(c.titleKey) });
    }
    return out;
  });

  isFavorite = computed(() => this.favs.slugs().includes(this.slug()));

  /** Which format is being exported right now (drives the spinner), or null. */
  exportingFormat = signal<ExportFormat | null>(null);

  /** Prints the backend's PDF of this report (not the web page), so it matches the exported PDF. */
  async print(): Promise<void> {
    const c = this.cfg();
    if (!c || this.exportingFormat()) return;
    this.exportingFormat.set('pdf'); // spinner on the button while the PDF is generated
    try {
      // Called synchronously from the click, so the service can open the print window before awaiting.
      if (this.isSub()) await this.svc.printAccountJournal(this.accountId(), this.filter(), this.asOf());
      else await this.svc.printReport(c, this.filter());
    } catch (e: any) {
      this.toast.error('REPORTS.EXPORT.ERROR', e?.message ?? '');
    } finally {
      this.exportingFormat.set(null);
    }
  }

  constructor() {
    effect(() => {
      const root = this.contentArea()?.nativeElement;
      const bar = this.filterBarEl()?.nativeElement as HTMLElement | undefined;
      this.io?.disconnect();
      this.filterBarHidden.set(false);
      if (!root || !bar || typeof IntersectionObserver === 'undefined') return;
      this.io = new IntersectionObserver(
        ([e]) => this.filterBarHidden.set(!e.isIntersecting),
        { root, threshold: 0 },
      );
      this.io.observe(bar);
    });
  }

  private recent = inject(ReportsRecentService);

  async ngOnInit(): Promise<void> {
    if (!this.isSub()) this.recent.push(this.slug());
    // Edge-to-edge page (like the document view pages): the layout drops its padding
    // and this page scrolls its own content area.
    this.layout.setNoPadding(true);
    await this.lang.loadFeature('reports');
    void this.loadBranches();
  }

  ngOnDestroy(): void { this.layout.setNoPadding(false); this.io?.disconnect(); }

  private async loadBranches(): Promise<void> {
    try {
      const res = await this.api.request<any>(
        this.api.post('branch/getBranches/', { page: 1, limit: 500, searchTerm: '', sortBy: {} }),
      );
      const list: any[] = res?.data?.list ?? [];
      this.branches.set(list.map(b => ({ value: b.id, label: b.name })));
    } catch {
      this.branches.set([]); // the filter simply hides; reports still run for all branches
    }
  }

  onFilter(f: BoFilter): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      // A changed filter starts from page 1; the page size and the sort stay.
      queryParams: { ...filterToQuery(f, this.asOfDefault()), page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  spinning = signal(false);

  refresh(): void {
    this.refreshTick.update(n => n + 1);
    this.spinning.set(true);
    setTimeout(() => this.spinning.set(false), 750);
  }

  /** Legacy "Browse Reports": pick any report the user may open. */
  async openBrowse(): Promise<void> {
    const ref = this.modal.open<ReportsBrowseModalComponent, ReportsBrowseData, string>(ReportsBrowseModalComponent, {
      size: 'md', data: { currentSlug: this.slug() },
    });
    const slug = await ref.afterClosed();
    if (!slug) return;
    if (slug !== this.slug() || this.isSub()) {
      this.trail.reset();
      // Like the legacy app: the filters (dates / as-of, branches, comparison) come along to the report we open.
      void this.router.navigate(['/reports/view', slug], { queryParams: this.carryQuery(slug) });
    }
  }

  /** The current filter, expressed for the report we are about to open (what it cannot use is dropped). */
  private carryQuery(slug: string): Record<string, string | null> {
    const target = carryTargetFor(slug);
    return target ? carryFilterQuery(this.filter(), target) : {};
  }
    toggleFavorite(): void { this.favs.toggle(this.slug()); }

  back(): void {
    if (this.isSub()) {
      void this.router.navigate(['/reports/view', this.slug()], {
        queryParams: filterToQuery(this.filter(), this.asOfDefault()),
      });
    } else {
      // Profit & Loss opened from the Balance Sheet goes back to the sheet with its filters
      const from = this.slug() === 'profit-and-loss' ? this.trail.source(this.router.url) : null;
      if (from?.startsWith('/reports/view/balance-sheet')) void this.router.navigateByUrl(from);
      else void this.router.navigate(['/reports']);
    }
  }

  goCatalog(): void { void this.router.navigate(['/reports']); }

  async export(type: ExportFormat): Promise<void> {
    const c = this.cfg();
    // These reports export PDF and Excel only (the backend has no CSV route for them).
    if (!c || this.exportingFormat() || type === 'csv') return;
    this.exportingFormat.set(type);
    try {
      if (this.isSub()) {
        await this.svc.exportAccountJournal(this.accountId(), this.filter(), this.asOf(), type);
      } else {
        await this.svc.exportReport(c, type, this.filter());
      }
    } catch (e: any) {
      this.toast.error('REPORTS.EXPORT.ERROR', e?.message ?? '');
    } finally {
      this.exportingFormat.set(null);
    }
  }
}
