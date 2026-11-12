import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { CompanyService } from '@core/auth/company.service';
import { customReportsEditPrivilegeFullKey, customReportsViewPrivilegeFullKey } from '../../custom/custom-reports.privileges';
import { isEmployeeEarningsEnabled } from '@core/auth/employee-earnings';
import { REPORT_CATALOG, ALL_REPORTS } from '../../models/report-catalog';
import { ReportGroup, ReportMeta } from '../../models/report.model';
import { reportIcon } from '../../models/report-icons';
import { ReportsFavoritesService } from '../../services/reports-favorites.service';
import { ReportsRecentService } from '../../services/reports-recent.service';
import { groupAccent } from '../../models/report-accents';
import { scheduleCapsFor, scheduleTypeFor } from '../../models/report-schedule';
import { ApiService } from '@core/http/api.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  ReportScheduleModalComponent, ReportScheduleModalData, ReportScheduleModalResult,
} from '../../components/report-schedule-modal/report-schedule-modal.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';

/** Meta-tabs shown before the business categories. */
type MetaTab = 'all' | 'favorites' | 'new';

@Component({
  selector: 'app-reports-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, SegmentedToggleComponent],
  templateUrl: './reports-catalog.component.html',
  styleUrl: './reports-catalog.component.scss',
})
export class ReportsCatalogComponent implements OnInit {
  private router = inject(Router);
  private api = inject(ApiService);
  private modal = inject(ModalService);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private company = inject(CompanyService);
  private favs = inject(ReportsFavoritesService);
  private sanitizer = inject(DomSanitizer);
  private recent = inject(ReportsRecentService);

  readonly groups = REPORT_CATALOG;

  /** The saved custom reports list; Edit implies View. */
  get canViewCustom(): boolean {
    return (this.privileges.check(customReportsViewPrivilegeFullKey) || this.privileges.check(customReportsEditPrivilegeFullKey));
  }

  search = signal('');
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

    // Search matches the localized report title.
    return groups
      .map(g => ({
        ...g,
        reports: g.reports.filter(r => this.lang.instant(r.titleKey).toLowerCase().includes(term)),
      }))
      .filter(g => g.reports.length > 0);
  });

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

  private branchList: { value: string; label: string }[] | null = null;
  private async branches(): Promise<{ value: string; label: string }[]> {
    if (this.branchList) return this.branchList;
    try {
      const res = await this.api.request<any>(this.api.post('branch/getBranches/', { page: 1, limit: 500, searchTerm: '', sortBy: {} }));
      this.branchList = ((res?.data?.list ?? []) as any[]).map(b => ({ value: b.id, label: b.name }));
    } catch { this.branchList = []; }
    return this.branchList;
  }

  /** Quick "Schedule report" straight from the catalog — opens the same dialog as the report's own schedule button, for a new schedule. */
  async schedule(r: ReportMeta, event: Event): Promise<void> {
    event.stopPropagation();
    const type = scheduleTypeFor(r.slug);
    if (!type) return;
    const branches = await this.branches();
    const ref = this.modal.open<ReportScheduleModalComponent, ReportScheduleModalData, ReportScheduleModalResult>(
      ReportScheduleModalComponent, {
        size: 'md', closeOnBackdrop: false,
        data: { type, titleKey: r.titleKey, caps: scheduleCapsFor(r.slug), branches, schedule: null },
      });
    await ref.afterClosed();
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
}
