import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { CompanyService } from '@core/auth/company.service';
import { customReportsEditPrivilegeFullKey, customReportsViewPrivilegeFullKey } from '../../custom/custom-reports.privileges';
import { isEmployeeEarningsEnabled } from '@core/auth/employee-earnings';
import { REPORT_CATALOG, ALL_REPORTS } from '../../models/report-catalog';
import { ReportGroup, ReportMeta } from '../../models/report.model';
import { reportIcon } from '../../models/report-icons';
import { REPORT_BODY_SEARCH_KEYS } from '../../models/report-body-search-keys';
import { FLAT_REPORTS } from '../../flat/flat-reports';
import { getReportColumns } from '../../columns/report-columns';
import { ReportsFavoritesService } from '../../services/reports-favorites.service';
import { ReportsRecentService } from '../../services/reports-recent.service';
import { groupAccent } from '../../models/report-accents';
import { scheduleCapsFor, scheduleTypeFor } from '../../models/report-schedule';
import { ReportScheduleService } from '../../services/report-schedule.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  ReportScheduleModalComponent, ReportScheduleModalData, ReportScheduleModalResult,
} from '../../components/report-schedule-modal/report-schedule-modal.component';
import { ScheduledReportsDrawerComponent } from '../../components/scheduled-reports-drawer/scheduled-reports-drawer.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';

import { TooltipDirective } from '@shared/directives/tooltip.directive';
/** Meta-tabs shown before the business categories. */
type MetaTab = 'all' | 'favorites' | 'new';

@Component({
  selector: 'app-reports-catalog',
  standalone: true,
  imports: [PageHeaderComponent, TooltipDirective, CommonModule, FormsModule, RouterLink, TranslateModule, SegmentedToggleComponent],
  templateUrl: './reports-catalog.component.html',
  styleUrl: './reports-catalog.component.scss',
})
export class ReportsCatalogComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private modal = inject(ModalService);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private company = inject(CompanyService);
  private favs = inject(ReportsFavoritesService);
  private scheduleSvc = inject(ReportScheduleService);
  private sanitizer = inject(DomSanitizer);
  private recent = inject(ReportsRecentService);

  readonly groups = REPORT_CATALOG;

  /** The saved custom reports list; Edit implies View. */
  get canViewCustom(): boolean {
    return (this.privileges.check(customReportsViewPrivilegeFullKey) || this.privileges.check(customReportsEditPrivilegeFullKey));
  }

  /** The applied search (kept in the URL as `?q=`); `draft` is what is typed in the box until Search / Enter. */
  search = signal('');
  draft = signal('');

  constructor() {
    // the URL is the source of truth: a shared link, a reload and Back/Forward all restore the search
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(m => {
      const q = m.get('q') ?? '';
      this.search.set(q);
      this.draft.set(q);
    });
  }

  /** Apply the typed text (empty clears it) and write it to the URL. */
  applySearch(): void {
    const q = this.draft().trim();
    this.draft.set(q);
    this.search.set(q);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: q || null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  clearSearch(): void { this.draft.set(''); this.applySearch(); }
  activeTab = signal<MetaTab | string>('all'); // string = a group key

  /** Reports the user is allowed to see (permission-gated). */
  private visibleReports = computed(() =>
    ALL_REPORTS.filter(r =>
      (!r.permission || this.privileges.check(r.permission))
      && (!r.earningsFeature || isEmployeeEarningsEnabled(this.company.settings(), r.earningsFeature)),
    ),
  );

  /** Groups filtered to allowed reports (drops empty groups). */
  visibleGroups = computed<ReportGroup[]>(() =>
    this.groups
      .map(g => ({ ...g, reports: g.reports.filter(r => this.visibleReports().includes(r)) }))
      .filter(g => g.reports.length > 0),
  );

  favoriteSlugs = computed(() => this.favs.slugs());

  /** The reports to render given the active tab + search term. */
  private baseGroups = computed<ReportGroup[]>(() => {
    const term = this.search().trim().toLowerCase();
    const tab = this.activeTab();

    let groups = this.visibleGroups();

    // Meta-tabs collapse everything into a single synthetic group.
    if (tab === 'favorites') {
      const favSet = new Set(this.favoriteSlugs());
      const reports = this.visibleReports().filter(r => favSet.has(r.slug));
      groups = reports.length
        ? [{ key: 'others', titleKey: 'REPORTS.TABS.FAVORITES', icon: 'trending-up', reports }]
        : [];
    } else if (tab === 'new') {
      const reports = this.visibleReports().filter(r => this.isNew(r));
      groups = reports.length
        ? [{ key: 'others', titleKey: 'REPORTS.TABS.NEW', icon: 'trending-up', reports }]
        : [];
    } else if (tab !== 'all') {
      groups = groups.filter(g => g.key === tab);
    }

    if (!term) return groups;

    // Deep search: every word must be found somewhere in the report (title, description, topic, filters, columns).
    const words = term.split(/\s+/).filter(Boolean);
    const index = this.searchIndex();
    return groups
      .map(g => ({
        ...g,
        reports: g.reports.filter(r => {
          const e = index.get(r.slug);
          return !!e && words.every(w => e.some(f => f.text.includes(w)));
        }),
      }))
      .filter(g => g.reports.length > 0);
  });

  /** The topic tiles: with a search, only the topics that still have a matching report, counting just those. */
  topicTiles = computed<ReportGroup[]>(() => {
    const words = this.search().trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return this.visibleGroups();
    const index = this.searchIndex();
    const active = this.activeTab();
    return this.visibleGroups()
      .map(g => ({ ...g, reports: g.reports.filter(r => { const e = index.get(r.slug); return !!e && words.every(w => e.some(f => f.text.includes(w))); }) }))
      .filter(g => g.reports.length > 0 || g.key === active); // the open topic stays, so it can be closed again
  });

  /** Per report: the searchable fields, each tagged with where it comes from. Rebuilt when the language changes. */
  private searchIndex = computed(() => {
    this.lang.current(); // re-index (and re-translate) on a language switch
    const t = (k: string): string => { const v = this.lang.instant(k); return v && v !== k ? v : ''; };
    const FILTER_LABELS: [keyof NonNullable<ReportMeta['filters']>, string][] = [
      ['products', 'REPORTS.FILTER.PRODUCTS'], ['singleProduct', 'REPORTS.FILTER.PRODUCT'], ['categories', 'REPORTS.FILTER.CATEGORIES'],
      ['departments', 'REPORTS.FILTER.DEPARTMENTS'], ['customers', 'REPORTS.FILTER.CUSTOMERS'], ['suppliers', 'REPORTS.FILTER.SUPPLIERS'],
      ['locations', 'REPORTS.FILTER.LOCATIONS'], ['discount', 'REPORTS.FILTER.DISCOUNT'], ['voidedBy', 'REPORTS.FILTER.VOIDED_BY'],
      ['voidReasons', 'REPORTS.FILTER.VOID_REASONS'], ['voidTimings', 'REPORTS.FILTER.VOID_TIMINGS'], ['singleEmployee', 'REPORTS.FILTER.EMPLOYEE'],
      ['customerType', 'REPORTS.FILTER.CUSTOMER_TYPE'], ['salesEmployee', 'REPORTS.FILTER.SALES_EMPLOYEE'], ['hasBalanceOnly', 'REPORTS.FILTER.BALANCE_ONLY'],
      ['hideDeleted', 'REPORTS.FILTER.HIDE_DELETED'], ['purchaseMode', 'REPORTS.FILTER.PURCHASE_MODE'], ['applyOpeningHour', 'REPORTS.FILTER.OPENING_HOURS'],
      ['comparePeriods', 'REPORTS.FILTER.COMPARE'], ['compare', 'REPORTS.FILTER.COMPARE'], ['productTypes', 'REPORTS.FILTER.PRODUCT_TYPES'],
    ];
    const lc = this.lang.current();
    const map = new Map<string, { kind: 'title' | 'description' | 'topic' | 'filter' | 'column' | 'section'; text: string }[]>();
    for (const g of this.groups) {
      const topic = t(g.titleKey).toLowerCase();
      for (const r of g.reports) {
        const f: { kind: 'title' | 'description' | 'topic' | 'filter' | 'column' | 'section'; text: string }[] = [];
        const add = (kind: typeof f[number]['kind'], v: string | undefined) => { if (v) f.push({ kind, text: v.toLowerCase() }); };
        add('title', t(r.titleKey));
        add('description', r.descriptionKey ? t(r.descriptionKey) : '');
        add('topic', topic);
        for (const [flag, key] of FILTER_LABELS) if (r.filters?.[flag]) add('filter', t(key));
        for (const o of r.filters?.filterBy ?? []) add('filter', t(`REPORTS.FILTER.FILTER_BY_OPTION.${o}`) || o);
        for (const o of r.filters?.sources ?? []) add('filter', o);
        for (const k of [...(r.customBody ? REPORT_BODY_SEARCH_KEYS[r.customBody] ?? [] : []), ...(r.searchKeys ?? [])]) add('section', t(k));
        for (const c of FLAT_REPORTS[r.slug]?.columns ?? []) add('column', t(c.label ?? `REPORTS.FLAT.COLUMNS.${c.key}`));
        for (const x of FLAT_REPORTS[r.slug]?.summary ?? []) add('section', t(`REPORTS.FLAT.SUMMARY.${x.key}`));
        for (const c of getReportColumns(r.slug)) {
          add('column', lc === 'ar' ? c.label.ar : c.label.en);
          add('column', lc === 'ar' ? c.description?.ar : c.description?.en);
        }
        map.set(r.slug, f);
      }
    }
    return map;
  });

  /** When a report matched through something other than its title, says where ("Filter: Products"), so the hit is not a mystery. */
  matchHint(r: ReportMeta): { kind: string; text: string } | null {
    const words = this.search().trim().toLowerCase().split(/\s+/).filter(Boolean);
    const e = this.searchIndex().get(r.slug);
    if (!words.length || !e) return null;
    if (words.every(w => e.some(f => f.kind === 'title' && f.text.includes(w)))) return null;
    for (const w of words) {
      if (e.some(f => f.kind === 'title' && f.text.includes(w))) continue;
      const hit = e.find(f => f.kind === 'section' && f.text.includes(w)) ?? e.find(f => f.kind === 'filter' && f.text.includes(w)) ?? e.find(f => f.kind === 'column' && f.text.includes(w));
      if (hit) return { kind: hit.kind, text: hit.text };
    }
    return null;
  }

  /** How the lists are ordered: the legacy order, or by name (groups and the reports inside them). */
  sort = signal<'default' | 'az' | 'za'>(this.readSort());
  readonly sortOptions: SegmentedToggleOption<'default' | 'az' | 'za'>[] = [
    { value: 'default', label: 'REPORTS.CATALOG.SORT_DEFAULT' }, { value: 'az', label: 'REPORTS.CATALOG.SORT_AZ' }, { value: 'za', label: 'REPORTS.CATALOG.SORT_ZA' },
  ];
  setSort(v: 'default' | 'az' | 'za'): void {
    this.sort.set(v);
    try { localStorage.setItem('reports.catalog.sort', v); } catch { /* storage can be unavailable */ }
  }
  private readSort(): 'default' | 'az' | 'za' {
    try { const v = localStorage.getItem('reports.catalog.sort'); return v === 'az' || v === 'za' ? v : 'default'; } catch { return 'default'; }
  }
  filteredGroups = computed<ReportGroup[]>(() => {
    const groups = this.baseGroups();
    const dir = this.sort() === 'az' ? 1 : this.sort() === 'za' ? -1 : 0;
    if (!dir) return groups;
    const by = (a: string, b: string) => dir * this.lang.instant(a).localeCompare(this.lang.instant(b));
    return groups.map(g => ({ ...g, reports: [...g.reports].sort((a, b) => by(a.titleKey, b.titleKey)) })).sort((a, b) => by(a.titleKey, b.titleKey));
  });

  totalCount = computed(() => this.visibleReports().length);

  ngOnInit(): void {
    // the saved copy of the company settings can predate the Commission / Tips switches: refresh it so those reports show
    void this.company.loadSettings(true);
    void this.loadScheduled();
    this.favs.seedDefaults(ALL_REPORTS.filter(r => r.starredByDefault).map(r => r.slug));
  }

  /** Our own static SVG — Angular's HTML sanitizer would strip it from `innerHTML`. */
  icon = (name?: string) => this.sanitizer.bypassSecurityTrustHtml(reportIcon(name));

  accent = groupAccent;

  /** The accent of the group a report really belongs to (the Favorites / New tabs mix groups). */
  private groupKeyOf = computed(() => {
    const m = new Map<string, string>();
    for (const g of this.groups) for (const r of g.reports) m.set(r.slug, g.key);
    return m;
  });
  accentOf = (r: ReportMeta): string => this.accent(this.groupKeyOf().get(r.slug) ?? 'others');

  /** What a report can do, as small chips on its card. */
  /** True when the backend scheduler can run this report (the row then offers a quick "Schedule" button). */
  canSchedule = (r: ReportMeta): boolean => !!scheduleTypeFor(r.slug);

  /** Report types that already have a saved schedule — marks their calendar button. */
  private scheduledTypes = signal<Set<string>>(new Set());
  isScheduled = (r: ReportMeta): boolean => {
    const t = scheduleTypeFor(r.slug);
    return !!t && this.scheduledTypes().has(t);
  };
  private async loadScheduled(): Promise<void> {
    try { this.scheduledTypes.set(await this.scheduleSvc.scheduledTypes()); } catch { /* the marks are optional */ }
  }

  /** Every scheduled report of the company, in a side drawer. */
  async openScheduledReports(): Promise<void> {
    const ref = this.modal.open(ScheduledReportsDrawerComponent, { drawer: true, drawerWidth: '540px', drawerResizable: true });
    await ref.afterClosed();
    void this.loadScheduled(); // an edit or a delete in the drawer changes the calendar marks
  }

  /** Quick "Schedule report" straight from the catalog — opens the same dialog as the report's own schedule button, for a new schedule. */
  async schedule(r: ReportMeta, event: Event): Promise<void> {
    event.stopPropagation();
    const type = scheduleTypeFor(r.slug);
    if (!type) return;
    const branches = await this.scheduleSvc.branches();
    const ref = this.modal.open<ReportScheduleModalComponent, ReportScheduleModalData, ReportScheduleModalResult>(
      ReportScheduleModalComponent, {
        size: 'md', closeOnBackdrop: false,
        data: { type, titleKey: r.titleKey, caps: scheduleCapsFor(r.slug), branches, schedule: null },
      });
    await ref.afterClosed();
    void this.loadScheduled();
  }

  caps(r: ReportMeta): string[] {
    const out: string[] = [];
    if (r.filters?.comparePeriods || r.filters?.compare) out.push('COMPARE');
    if (r.export && (r.export.pdf || r.export.xlsx)) out.push('EXPORT');
    return out;
  }

  favoriteReports = computed(() => {
    const set = new Set(this.favoriteSlugs());
    return this.visibleReports().filter(r => set.has(r.slug));
  });
  favoriteCount = computed(() => this.favoriteReports().length);

  /** The reports opened last, still allowed for this user. */
  recentReports = computed(() => {
    const bySlug = new Map(this.visibleReports().map(r => [r.slug, r] as const));
    return this.recent.slugs().map(s => bySlug.get(s)).filter((r): r is ReportMeta => !!r).slice(0, 6);
  });
  /** Only on the full list and not while searching. */
  showRecent = computed(() => this.activeTab() === 'all' && !this.search().trim() && this.recentReports().length > 0);

  // ── group cards: first few reports, the rest behind "Show N more" ──
  readonly PREVIEW = 4;
  private expandedKeys = signal<ReadonlySet<string>>(new Set());
  isExpanded = (key: string) => this.expandedKeys().has(key);
  expand(key: string): void { this.expandedKeys.update(s => new Set(s).add(key)); }
  collapse(key: string): void { this.expandedKeys.update(s => { const n = new Set(s); n.delete(key); return n; }); }
  /** Everything is shown when searching, on a single group's tab, or once expanded. */
  private showAll = (g: ReportGroup) => !!this.search().trim() || this.activeTab() !== 'all' || this.isExpanded(g.key);
  shown(g: ReportGroup): ReportMeta[] { return this.showAll(g) ? g.reports : g.reports.slice(0, this.PREVIEW); }
  hiddenCount(g: ReportGroup): number { return this.showAll(g) ? 0 : Math.max(0, g.reports.length - this.PREVIEW); }

  /** The one-line description under a group's title (none for the synthetic Favorites / New groups). */
  groupDesc(key: string): string | null {
    return this.activeTab() === 'favorites' || this.activeTab() === 'new' ? null : `REPORTS.GROUP_DESC.${key}`;
  }

  isNew(r: ReportMeta): boolean {
    if (!r.updated) return false;
    const updated = new Date(r.updated).getTime();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - updated <= THIRTY_DAYS;
  }

  newCount = computed(() => this.visibleReports().filter(r => this.isNew(r)).length);

  isFavorite = (slug: string) => this.favoriteSlugs().includes(slug);

  toggleFavorite(slug: string, event: Event): void {
    event.stopPropagation();
    this.favs.toggle(slug);
  }

  openReport(r: ReportMeta): void {
    this.recent.push(r.slug);
    this.router.navigate(['/reports/view', r.slug]);
  }

  setTab(tab: MetaTab | string): void {
    this.activeTab.set(tab);
  }

  /** True when a single topic (group) is selected rather than one of the All / Favorites / New views. */
  isTopic = () => !['all', 'favorites', 'new'].includes(this.activeTab());

  /** The "how to use" guide: open the first time, then remembered. */
  showGuide = signal(this.readGuide());
  toggleGuide(): void {
    const next = !this.showGuide();
    this.showGuide.set(next);
    try { localStorage.setItem('reports.catalog.guide', next ? '1' : '0'); } catch { /* storage can be unavailable */ }
  }
  private readGuide(): boolean {
    try { return localStorage.getItem('reports.catalog.guide') !== '0'; } catch { return true; }
  }
}
