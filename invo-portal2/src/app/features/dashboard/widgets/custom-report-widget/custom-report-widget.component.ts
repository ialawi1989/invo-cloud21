import { Component, Input, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartPreviewComponent } from '../../../reports/custom/components/chart-preview/chart-preview.component';
import { PaginationComponent } from '../../../reports/custom/components/pagination/pagination.component';
import { CustomReportsService } from '../../../reports/custom/services/custom-reports.service';
import {
  SheetConfig,
  SortRule,
  FilterRule,
  FlatField,
  DataSourceTable,
  ColumnFormat,
  CustomReportRequest,
  shelvesToApiParams,
  buildValidFilterRules,
  buildColumnMeta,
  flattenSheetFields,
  legacySheetFromConfig,
  coerceNumericMeasures,
  coerceNumericRows,
  applyCalculatedFields,
} from '../../../reports/custom/shared/models/custom-report.model';

/**
 * Renders a saved custom report (by module id) as a dashboard widget, using the
 * SAME rendering pipeline as the report builder/view: shared field metadata
 * (currency/number formats, types), backend grouping + subtotals, and the
 * shared <app-chart-preview>. The sheet and filter values are chosen at
 * add-time in the Customize modal (`sheetId` / `filters`), so the widget shows
 * exactly the same data as the report builder/view.
 */
@Component({
  selector: 'app-custom-report-widget',
  standalone: true,
  imports: [CommonModule, ChartPreviewComponent, PaginationComponent],
  templateUrl: './custom-report-widget.component.html',
  styleUrls: ['./custom-report-widget.component.scss'],
})
export class CustomReportWidgetComponent implements OnChanges {
  @Input() moduleId = '';
  /** Sheet chosen for this widget in the Customize modal. */
  @Input() sheetId = '';
  /** Report filter values chosen for this widget in the Customize modal. */
  @Input() filters: any[] = [];
  /** Records to show, chosen in the Customize modal (0 → report's saved size). */
  @Input() pageSize = 0;
  /** Default sort chosen in the Customize modal (SortRule[]; empty → sheet's). */
  @Input() sort: SortRule[] = [];

  loading = false;
  error: string | null = null;

  // Pagination + sort state (server-side — each change re-runs the query).
  totalRows = 0;
  currentPage = 1;
  /** Effective page size used by the last query (drives the pager). */
  pageSizeUsed = 15;
  /** Runtime page-size override from the pager's "Rows" selector (0 → none). */
  private _pageSizeOverride = 0;
  /** Active sort shown in the table header + sent to the backend. */
  currentSort: { key: string; dir: 'ASC' | 'DESC' } | null = null;

  reportName = '';
  chartType = 'table';
  data: any[] = [];
  dimKey: string | null = null;
  measKeys: string[] = [];

  // Rich rendering metadata (mirrors the builder), so the widget matches the
  // builder/view output exactly.
  colorField: string | null = null;
  columnLabels: { [key: string]: string } = {};
  columnFormats: { [key: string]: ColumnFormat } = {};
  columnTypes: { [key: string]: string } = {};
  columnNumberFormats: { [key: string]: string } = {};
  orderedColumns: string[] = [];
  groupedData: { value: any; count: number; len: number; subtotals: { [key: string]: number } }[] | null = null;
  groupFieldLabel = '';
  groupByKey: string | null = null;

  private allSheets: SheetConfig[] = [];
  private sheet: SheetConfig | null = null;
  private allFields: FlatField[] = [];
  private dataSources: DataSourceTable[] = [];

  // Data sources (full schema) are stable per session — fetch once, share
  // across every custom-report widget on the dashboard.
  private static cachedSources: DataSourceTable[] | null = null;
  private static sourcesInflight: Promise<DataSourceTable[]> | null = null;

  constructor(
    private customReports: CustomReportsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['moduleId']) {
      if (this.moduleId) this.load();
      return;
    }
    // The chosen sheet can change if the saved selection updates — re-render it.
    if (changes['sheetId'] && !changes['sheetId'].firstChange && this.allSheets.length) {
      this.applySheet();
      this.runQuery();
      return;
    }
    // Sort / page-size chosen in the Customize modal changed — re-init and refetch.
    if ((changes['sort'] || changes['pageSize']) &&
        !(changes['sort']?.firstChange || changes['pageSize']?.firstChange) &&
        this.sheet) {
      this.currentSort = this.initialSort();
      this.currentPage = 1;
      this.runQuery();
      return;
    }
    // `filters` are read inside load()/runQuery(); they're fixed per widget on
    // the dashboard, so we deliberately do NOT re-run on every change-detection
    // pass — doing so spun an infinite request loop and a stuck spinner.
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.sheet = null;
    this.allSheets = [];
    try {
      const mod = await this.customReports.getModule(this.moduleId);
      if (!mod) {
        this.error = 'Report not found';
        return;
      }
      this.reportName = mod.name || '';

      const cfg = typeof mod.text === 'string' ? JSON.parse(mod.text) : mod.text;
      if (!cfg) {
        this.error = 'This report cannot be shown here';
        return;
      }

      this.dataSources = await this.loadDataSources();

      if (cfg.version === 2 && Array.isArray(cfg.sheets) && cfg.sheets.length > 0) {
        this.allSheets = cfg.sheets;
        this.applySheet(cfg.activeSheetId);
      } else {
        // Legacy (v1) module — convert to a sheet so it renders like the rest.
        this.allSheets = [legacySheetFromConfig(cfg, this.dataSources[0]?.id || '')];
        this.applySheet();
      }

      await this.runQuery();
    } catch (e) {
      console.error('[CustomReportWidget] Failed to load report:', e);
      this.error = 'Failed to load report';
    } finally {
      // Guarantee the spinner clears on every path (incl. early returns).
      this.loading = false;
      // The dashboard is OnPush, so a promise settling here won't repaint the
      // view unless we mark the path to root for check.
      this.cdr.markForCheck();
    }
  }

  /** Resolve the sheet + derive its column metadata (labels/formats/types). */
  private applySheet(activeSheetId?: string): void {
    const wanted = this.sheetId || activeSheetId;
    this.sheet = this.allSheets.find(s => s.id === wanted) || this.allSheets[0] || null;
    this.chartType = this.sheet?.chartType || 'table';
    if (!this.sheet) return;

    this.allFields = flattenSheetFields(this.dataSources, this.sheet);
    const meta = buildColumnMeta(this.sheet, this.allFields);
    this.columnLabels = meta.columnLabels;
    this.columnFormats = meta.columnFormats;
    this.columnTypes = meta.columnTypes;
    this.columnNumberFormats = meta.columnNumberFormats;
    this.orderedColumns = meta.orderedColumns;

    const colorMark = this.sheet.marks.find(m => m.channel === 'color');
    this.colorField = colorMark ? colorMark.field.col : null;
    this.groupByKey = this.sheet.groupBy || null;

    // Reset paging + seed the sort from the Customize selection (falls back to
    // the sheet's own saved sort) whenever the sheet is (re)applied.
    this.currentPage = 1;
    this.currentSort = this.initialSort();
  }

  /** Sort from the Customize modal if set, else the sheet's saved sort. */
  private initialSort(): { key: string; dir: 'ASC' | 'DESC' } | null {
    const base = (this.sort && this.sort.length) ? this.sort : (this.sheet?.sortBy || []);
    return base.length ? { key: base[0].id, dir: base[0].mod } : null;
  }

  /** Run the report query for the cached sheet, applying filters + grouping. */
  private async runQuery(): Promise<void> {
    const sheet = this.sheet;
    if (!sheet) return;
    this.loading = true;
    this.error = null;
    try {
      const { columns, groupBy } = shelvesToApiParams(sheet);
      // Records: the pager's runtime override, else the value chosen in the
      // Customize modal, else the dashboard default of 15. (Kept compact for the
      // dashboard rather than inheriting the report's larger saved page size.)
      const pageSize = this._pageSizeOverride || this.pageSize || 15;
      this.pageSizeUsed = pageSize;
      // Server-side sort: the active header/Customize sort (single column, as in
      // the builder) — falls back to the sheet's saved sort when none is set.
      const sort: SortRule[] = this.currentSort
        ? [{ id: this.currentSort.key, mod: this.currentSort.dir }]
        : sheet.sortBy;
      const request: CustomReportRequest = {
        tableName: sheet.primaryTable,
        columns,
        joins: sheet.joins,
        sort,
        group: groupBy,
        limit: pageSize,
        offset: (this.currentPage - 1) * pageSize,
      };
      if (sheet.groupBy) request.groupBy = sheet.groupBy;

      const rules = this.buildMergedFilters(sheet);
      if (rules.length > 0) {
        request.query = { glue: sheet.filterGlue, rules };
      }

      const result = await this.customReports.getCustomizedReport(request);

      // totalCount drives the pager; -1 means the backend didn't send it, so we
      // fall back to the current page's row count (single page → pager hides).
      const total = (result as any)?.totalCount;
      this.totalRows = typeof total === 'number' && total >= 0
        ? total
        : (this.currentPage - 1) * this.pageSizeUsed + (result?.rows?.length || 0);

      // Grouped response → flatten rows + keep per-group subtotal metadata.
      let rows = result?.rows || [];
      let grouped: { value: any; count: number; len: number; subtotals: any }[] | null = null;
      if (sheet.groupBy && (result as any)?.groups?.length) {
        rows = (result as any).groups.flatMap((g: any) => g.rows || []);
        grouped = (result as any).groups.map((g: any) => {
          const len = (g.rows || []).length;
          return { value: g.value, count: typeof g.count === 'number' ? g.count : len, len, subtotals: g.subtotals || {} };
        });
      }

      coerceNumericMeasures(rows);
      coerceNumericRows(rows, sheet, this.fieldMeta());
      if (sheet.calculatedFields?.length) {
        applyCalculatedFields(rows, sheet.calculatedFields);
      }

      this.groupedData = grouped;
      this.groupFieldLabel = grouped && sheet.groupBy
        ? (this.allFields.find(f => f.fullId === sheet.groupBy)?.label || sheet.groupBy.split('.').pop() || '')
        : '';
      this.data = rows;
      this.dimKey = this.getDimKey(rows);
      this.measKeys = this.getMeasKeys(rows);
    } catch (e) {
      console.error('[CustomReportWidget] Failed to run report:', e);
      this.error = 'Failed to load report';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  /** Header click → server-side sort by that column (resets to page 1). */
  onSortChange(event: { key: string; dir: 'ASC' | 'DESC' }): void {
    this.currentSort = event;
    this.currentPage = 1;
    this.runQuery();
  }

  /** Pager → fetch the requested page from the backend. */
  onPageChange(page: number): void {
    if (page < 1 || page === this.currentPage) return;
    this.currentPage = page;
    this.runQuery();
  }

  /** Pager "Rows" selector → change page size and refetch from page 1. */
  onPageSizeChange(size: number): void {
    this._pageSizeOverride = size;
    this.currentPage = 1;
    this.runQuery();
  }

  private loadDataSources(): Promise<DataSourceTable[]> {
    if (CustomReportWidgetComponent.cachedSources) {
      return Promise.resolve(CustomReportWidgetComponent.cachedSources);
    }
    if (!CustomReportWidgetComponent.sourcesInflight) {
      CustomReportWidgetComponent.sourcesInflight = this.customReports.getDataSource()
        .then(s => {
          CustomReportWidgetComponent.cachedSources = s || [];
          return CustomReportWidgetComponent.cachedSources;
        })
        .catch(() => {
          CustomReportWidgetComponent.sourcesInflight = null;
          return [];
        });
    }
    return CustomReportWidgetComponent.sourcesInflight;
  }

  private fieldMeta(): { [fullId: string]: { id?: string; type?: string; numberFormat?: string } } {
    const out: { [fullId: string]: { id?: string; type?: string; numberFormat?: string } } = {};
    for (const f of this.allFields) {
      out[f.fullId] = { id: f.id, type: f.type, numberFormat: (f as any).numberFormat };
    }
    return out;
  }

  /**
   * Effective filters: the widget's chosen filter values (from the Customize
   * modal) if present, else the report's own saved filters — matching the
   * builder/view. No dashboard-level overrides, so the data stays identical.
   */
  private buildMergedFilters(sheet: SheetConfig): FilterRule[] {
    const base = (this.filters && this.filters.length) ? this.filters : sheet.filterRules;
    return buildValidFilterRules(base);
  }

  private getDimKey(data: any[]): string | null {
    if (!data || data.length === 0) return null;
    const keys = Object.keys(data[0]);
    return keys.find(k => !/^(sum|count|avg|max|min)\./.test(k) && k !== 'value') || keys[0];
  }

  private getMeasKeys(data: any[]): string[] {
    if (!data || data.length === 0) return [];
    const dimKey = this.getDimKey(data);
    return Object.keys(data[0]).filter(k => k !== dimKey);
  }
}
