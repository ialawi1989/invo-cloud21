import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { REPORT_CATALOG, ALL_REPORTS } from '../../models/report-catalog';
import { ReportGroup, ReportMeta } from '../../models/report.model';
import { reportIcon } from '../../models/report-icons';
import { ReportsFavoritesService } from '../../services/reports-favorites.service';

/** Meta-tabs shown before the business categories. */
type MetaTab = 'all' | 'favorites' | 'new';

@Component({
  selector: 'app-reports-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './reports-catalog.component.html',
  styleUrl: './reports-catalog.component.scss',
})
export class ReportsCatalogComponent implements OnInit {
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private favs = inject(ReportsFavoritesService);

  readonly groups = REPORT_CATALOG;

  search = signal('');
  activeTab = signal<MetaTab | string>('all'); // string = a group key

  /** Reports the user is allowed to see (permission-gated). */
  private visibleReports = computed(() =>
    ALL_REPORTS.filter(r => !r.permission || this.privileges.check(r.permission)),
  );

  /** Groups filtered to allowed reports (drops empty groups). */
  visibleGroups = computed<ReportGroup[]>(() =>
    this.groups
      .map(g => ({ ...g, reports: g.reports.filter(r => this.visibleReports().includes(r)) }))
      .filter(g => g.reports.length > 0),
  );

  favoriteSlugs = computed(() => this.favs.slugs());

  /** The reports to render given the active tab + search term. */
  filteredGroups = computed<ReportGroup[]>(() => {
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

  totalCount = computed(() => this.visibleReports().length);

  ngOnInit(): void {
    this.favs.seedDefaults(ALL_REPORTS.filter(r => r.starredByDefault).map(r => r.slug));
  }

  icon = (name?: string) => reportIcon(name);

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
    this.router.navigate(['/reports/view', r.slug]);
  }

  setTab(tab: MetaTab | string): void {
    this.activeTab.set(tab);
  }
}
