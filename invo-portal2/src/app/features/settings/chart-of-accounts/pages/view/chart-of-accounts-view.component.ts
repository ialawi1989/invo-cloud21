import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { LayoutService } from '@core/layout/services/layout.service';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import type { DateRange } from '@shared/components/datepicker/date-picker.types';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { DocViewShellComponent } from '../../../../account/components/doc-view-shell/doc-view-shell.component';
import type { DocRailItem } from '../../../../account/services/document-view-base';
import { SalesLookupsService } from '../../../../account/services/sales-lookups.service';
import { ReportsService } from '../../../../reports/services/reports.service';

import { AccountService } from '../../services/account.service';
import { Account, AccountJournalsResult } from '../../services/account.types';
import { accountNature, accountTypeKey } from '../../utils/account-types';
import { journalLink } from '../../utils/journal-links';

type Tab = 'overview' | 'journals';

const ymd = (d: Date | null | undefined): string | null => {
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Account view (`/account/chart-of-accounts/view/:id`). Same Zoho-style shell as the customer view (record rail,
 * title bar, tab strip). Sections come from legacy `AccountViewComponent`: opening / closing balance + debit /
 * credit KPIs, the account / journals / description cards, and the paged journal lines with an XLSX export.
 */
@Component({
  selector: 'app-chart-of-accounts-view',
  standalone: true,
  imports: [
    CommonModule, RouterLink, TranslateModule, MycurrencyPipe, PaginationComponent, DatePickerComponent,
    SearchDropdownComponent, DropdownMenuBtnComponent, DocViewShellComponent,
  ],
  templateUrl: './chart-of-accounts-view.component.html',
  styleUrl: './chart-of-accounts-view.component.scss',
  // The shell must be the effective flex child of the no-padding main area (same as the other views).
  host: { style: 'display: contents' },
})
export class ChartOfAccountsViewComponent implements OnInit, OnDestroy {
  private service = inject(AccountService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private translate = inject(TranslateService);
  private layout = inject(LayoutService);
  private lookups = inject(SalesLookupsService);
  private reports = inject(ReportsService);
  private privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check('accountSecurity.actions.add.access');
  readonly canExport = this.privileges.check('accountSecurity.actions.importExport.access');

  accountId = '';
  account = signal<Account | null>(null);
  tab = signal<Tab>('overview');
  readonly tabs: { value: Tab; label: string }[] = [
    { value: 'overview', label: 'CHART_OF_ACCOUNTS.VIEW.OVERVIEW' },
    { value: 'journals', label: 'CHART_OF_ACCOUNTS.VIEW.JOURNALS' },
  ];

  // ── record rail ──
  readonly railPageSize = 15;
  railItems = signal<DocRailItem[]>([]);
  railLoading = signal(false);
  railPage = signal(1);
  railPageCount = signal(1);
  railTerm = signal('');
  private railSeq = 0;
  private railTimer: ReturnType<typeof setTimeout> | null = null;

  // ── journals ──
  journals = signal<AccountJournalsResult | null>(null);
  journalsLoading = signal(false);
  page = signal(1);
  limit = signal(15);
  range = signal<DateRange>(this.defaultRange());
  branches = signal<any[]>([]);
  branchId = signal<string | null>(null);
  branchItems = computed(() => [{ id: null, name: this.translate.instant('CHART_OF_ACCOUNTS.VIEW.ALL_BRANCHES') }, ...this.branches()]);
  branchOf = () => this.branchItems().find(b => b.id === this.branchId()) ?? this.branchItems()[0];
  branchLabel = (b: any) => b?.name ?? '';
  byId = (a: any, b: any) => a?.id === b?.id;

  nature = computed(() => accountNature(this.account()?.parentType));
  /** Legacy rule: Dr accounts = opening + (debit − credit); Cr accounts = opening − (credit − debit). */
  closingBalance = computed(() => {
    const j = this.journals();
    if (!j) return 0;
    return this.nature() === 'Dr'
      ? j.openingBalance + (j.total.debit - j.total.credit)
      : j.openingBalance - (j.total.credit - j.total.debit);
  });

  readonly exportMenu = (): DropdownMenuBtnItem[] => [
    { label: this.translate.instant('CHART_OF_ACCOUNTS.VIEW.EXPORT_XLSX'), click: () => void this.exportXlsx(), disabled: false, danger: false },
  ];

  typeLabel = (v: string | null | undefined): string => {
    if (!v) return '—';
    const key = accountTypeKey(v);
    const label = this.translate.instant(key);
    return label && label !== key ? label : v;
  };

  /** Name in the UI language, falling back to the stored (English) name. */
  displayName = (a: Account | null | undefined): string => {
    if (!a) return '';
    return a.translation?.name?.[this.translate.currentLang || 'en'] || this.typeLabel(a.name);
  };
  displayDescription = (a: Account | null | undefined): string =>
    a?.translation?.description?.[this.translate.currentLang || 'en'] || a?.description || '';

  link = journalLink;

  async ngOnInit(): Promise<void> {
    this.layout.setNoPadding(true);
    void this.lookups.getBranches().then(b => this.branches.set(b ?? []));
    // `account/components/doc-lines-table` carries the shared DOC_VIEW strings the rail/shell use.
    await Promise.all([this.lang.loadFeature('settings/chart-of-accounts'), this.lang.loadFeature('account/components/doc-lines-table')]);
    void this.loadRail(1);
    this.route.paramMap.subscribe(() => void this.load());
  }

  ngOnDestroy(): void {
    this.layout.setNoPadding(false);
    if (this.railTimer) clearTimeout(this.railTimer);
  }

  private defaultRange(): DateRange {
    const n = new Date();
    return { start: new Date(n.getFullYear(), n.getMonth(), 1), end: new Date(n.getFullYear(), n.getMonth() + 1, 0) };
  }

  private async load(): Promise<void> {
    this.accountId = this.route.snapshot.paramMap.get('id') ?? '';
    const a = await this.service.getById(this.accountId);
    if (!a?.id) {
      void this.router.navigate(['/account/chart-of-accounts']);
      return;
    }
    this.account.set(a);
    this.journals.set(null);
    this.page.set(1);
    const fragment = this.route.snapshot.fragment as Tab | null;
    this.selectTab(fragment && this.tabs.some(t => t.value === fragment) ? fragment : this.tab(), false);
    // The overview KPIs come from the journals response, so it always loads.
    void this.loadJournals();
  }

  // ── rail ──
  async loadRail(page: number): Promise<void> {
    const seq = ++this.railSeq;
    this.railLoading.set(true);
    try {
      const data = await this.service.getList({ page, limit: this.railPageSize, searchTerm: this.railTerm(), sortBy: { sortValue: 'name', sortDirection: 'asc' } });
      if (seq !== this.railSeq) return;
      this.railItems.set(data.list.map((r): DocRailItem => ({
        id: r.id,
        primary: this.displayName(r),
        amountLabel: r.code ?? '',
        sub: this.typeLabel(r.type),
        data: r,
      })));
      this.railPage.set(page);
      this.railPageCount.set(Math.max(1, data.pageCount || 1));
    } finally {
      if (seq === this.railSeq) this.railLoading.set(false);
    }
  }
  onRailSearch(term: string): void {
    if (this.railTimer) clearTimeout(this.railTimer);
    this.railTimer = setTimeout(() => { this.railTerm.set(term); void this.loadRail(1); }, 300);
  }
  railPrev(): void { if (this.railPage() > 1) void this.loadRail(this.railPage() - 1); }
  railNext(): void { if (this.railPage() < this.railPageCount()) void this.loadRail(this.railPage() + 1); }
  railGoTo(item: DocRailItem): void {
    void this.router.navigate(['/account/chart-of-accounts/view', item.id], { fragment: this.tab() });
  }
  goToList(): void { void this.router.navigate(['/account/chart-of-accounts']); }
  add(): void { void this.router.navigate(['/account/chart-of-accounts', 'new']); }
  edit(): void { void this.router.navigate(['/account/chart-of-accounts', this.accountId]); }

  // ── tabs ──
  selectTab(t: Tab, updateUrl = true): void {
    this.tab.set(t);
    if (updateUrl) void this.router.navigate([], { fragment: t, queryParamsHandling: 'preserve', replaceUrl: true });
  }

  // ── journals ──
  private filter(): Record<string, unknown> {
    const r = this.range();
    return {
      limit: this.limit(),
      page: this.page(),
      fromDate: ymd(r?.start),
      toDate: ymd(r?.end),
      branches: this.branchId() ? [this.branchId()] : [],
      accountId: this.accountId,
    };
  }

  async loadJournals(): Promise<void> {
    const id = this.accountId;
    this.journalsLoading.set(true);
    try {
      const res = await this.service.getAccountJournals(this.filter());
      if (id !== this.accountId) return;
      // Legacy shows the largest debits first.
      res.list.sort((a, b) => (b.debit ?? 0) - (a.debit ?? 0));
      this.journals.set(res);
    } finally {
      this.journalsLoading.set(false);
    }
  }
  onRange(r: Date | DateRange | null): void {
    if (!r || !('start' in r)) return;
    this.range.set(r);
    this.page.set(1);
    void this.loadJournals();
  }
  onBranch(b: any): void { this.branchId.set(b?.id ?? null); this.page.set(1); void this.loadJournals(); }
  setPage(p: number): void { this.page.set(p); void this.loadJournals(); }
  setLimit(l: number): void { this.limit.set(l); this.page.set(1); void this.loadJournals(); }

  async exportXlsx(): Promise<void> {
    await this.reports.exportPath('accountJournals', 'xlsx', this.filter(), 'account-journals');
  }
}
