import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { findReport } from '../../models/report-catalog';
import { reportIcon } from '../../models/report-icons';
import {
  ReportApiFilter,
  ReportFilterState,
  ReportGroup,
  ReportMeta,
  ReportResult,
} from '../../models/report.model';
import { ReportsService } from '../../services/reports.service';
import { ReportsFavoritesService } from '../../services/reports-favorites.service';
import { resolvePreset } from '../../utils/report-period.util';

import { ReportFilterBarComponent, BranchOption } from '../../components/report-filter-bar/report-filter-bar.component';
import { ReportKpiRowComponent } from '../../components/report-kpi-row/report-kpi-row.component';
import { ReportDataTableComponent } from '../../components/report-data-table/report-data-table.component';
import { ReportChartComponent } from '../../components/report-chart/report-chart.component';

/**
 * Generic report shell — the single host for every report in the catalog
 * (the modern replacement for InvoCloudFront2's per-report components +
 * `ViewReportComponent`). Reads `:slug`, resolves the `ReportMeta`, renders the
 * filter-bar / KPI row / chart / table, and keeps filter state in the URL.
 */
@Component({
  selector: 'app-report-view',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    DropdownMenuBtnComponent,
    ReportFilterBarComponent,
    ReportKpiRowComponent,
    ReportDataTableComponent,
    ReportChartComponent,
  ],
  templateUrl: './report-view.component.html',
  styleUrl: './report-view.component.scss',
})
export class ReportViewComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private lang = inject(LanguageService);
  private service = inject(ReportsService);
  private favs = inject(ReportsFavoritesService);

  /** Route param, bound via `withComponentInputBinding()`. */
  slug = input<string>('');

  meta = signal<ReportMeta | null>(null);
  group = signal<ReportGroup | null>(null);
  notFound = signal(false);

  loading = signal(false);
  error = signal<string | null>(null);
  result = signal<ReportResult | null>(null);

  filterState = signal<ReportFilterState>({ preset: 'thisMonth' });

  /** Branch options — wire to the branch endpoint when available. */
  branchOptions = signal<BranchOption[]>([]);

  icon = (name?: string) => reportIcon(name);

  isFavorite = computed(() => {
    const m = this.meta();
    return m ? this.favs.isFavorite(m.slug) : false;
  });

  exportItems = computed<DropdownMenuBtnItem[]>(() => {
    const m = this.meta();
    if (!m?.export) return [];
    const items: DropdownMenuBtnItem[] = [];
    if (m.export.pdf) items.push({ label: 'REPORTS.EXPORT.PDF', click: () => this.export('pdf') });
    if (m.export.xlsx) items.push({ label: 'REPORTS.EXPORT.XLSX', click: () => this.export('xlsx') });
    if (m.export.csv) items.push({ label: 'REPORTS.EXPORT.CSV', click: () => this.export('csv') });
    items.push({ label: 'REPORTS.EXPORT.PRINT', click: () => this.print(), separator: items.length > 0 });
    return items;
  });

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('reports');

    const found = findReport(this.slug());
    if (!found) {
      this.notFound.set(true);
      return;
    }
    this.meta.set(found.meta);
    this.group.set(found.group);

    this.filterState.set(this.readFilterFromUrl(found.meta));
    await this.load();
  }

  /** Restore filter state from the URL, defaulting sensibly per report. */
  private readFilterFromUrl(meta: ReportMeta): ReportFilterState {
    const q = this.route.snapshot.queryParams;
    const preset = (q['preset'] as ReportFilterState['preset']) ?? 'thisMonth';
    const range = resolvePreset(preset, { from: q['fromDate'], to: q['toDate'] });
    return {
      preset,
      from: q['fromDate'] ?? range.from,
      to: q['toDate'] ?? range.to,
      branches: q['branches'] ? String(q['branches']).split(',').filter(Boolean) : [],
      compare: q['compare'] === 'true',
      sortValue: q['sortValue'],
      sortDirection: q['sortDirection'] as 'asc' | 'desc' | undefined,
    };
  }

  onFilterApply(state: ReportFilterState): void {
    this.filterState.set({ ...this.filterState(), ...state });
    this.syncUrl();
    this.load();
  }

  onSortChange(sort: { key: string; direction: 'asc' | 'desc' } | null): void {
    this.filterState.update(s => ({
      ...s,
      sortValue: sort?.key,
      sortDirection: sort?.direction,
    }));
    this.syncUrl();
    // Client-side sort already applied by the table; no refetch needed unless
    // the backend paginates. Kept in the URL for shareability.
  }

  /** Push the current filter state onto the URL (shareable/bookmarkable). */
  private syncUrl(): void {
    const s = this.filterState();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        preset: s.preset,
        fromDate: s.preset === 'custom' ? s.from : null,
        toDate: s.preset === 'custom' ? s.to : null,
        branches: s.branches?.length ? s.branches.join(',') : null,
        compare: s.compare ? 'true' : null,
        sortValue: s.sortValue ?? null,
        sortDirection: s.sortDirection ?? null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Map the UI filter state → backend `ReportApiFilter`. */
  private toApiFilter(): ReportApiFilter {
    const s = this.filterState();
    const range = resolvePreset(s.preset, { from: s.from, to: s.to });
    const filter: ReportApiFilter = {
      fromDate: range.from,
      toDate: range.to,
      branches: s.branches?.length ? s.branches : undefined,
    };
    if (s.compare) filter.compareType = 'previousPeriod';
    if (s.sortValue) filter.sortBy = [{ sortValue: s.sortValue, sortDirection: s.sortDirection ?? 'asc' }];
    if (this.meta()?.filters?.asOf) filter.allowAsOf = true;
    return filter;
  }

  async load(): Promise<void> {
    const meta = this.meta();
    if (!meta) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.service.getReport(meta, this.toApiFilter());
      this.result.set(result);
    } catch (e: any) {
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.result.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  toggleFavorite(): void {
    const m = this.meta();
    if (m) this.favs.toggle(m.slug);
  }

  async export(type: 'pdf' | 'xlsx' | 'csv'): Promise<void> {
    const meta = this.meta();
    if (!meta) return;
    try {
      await this.service.export(meta, type, this.toApiFilter());
    } catch (e: any) {
      this.error.set(e?.message ?? this.lang.instant('REPORTS.EXPORT.ERROR'));
    }
  }

  print(): void {
    window.print();
  }

  back(): void {
    this.router.navigate(['/reports']);
  }
}
