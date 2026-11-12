import { Component, Input, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';

import { ChartPreviewComponent } from '../../../reports/custom/components/chart-preview/chart-preview.component';
import { PaginationComponent } from '../../../reports/custom/components/pagination/pagination.component';
import { ReportV2Service } from '../../../reports/custom/services/report-v2.service';
import { SavedReportsService } from '../../../reports/custom/services/saved-reports.service';
import {
  SheetConfig,
  SortRule,
  FilterRule,
  FlatField,
  ColumnFormat,
  buildValidFilterRules,
  buildColumnMeta,
  coerceNumericMeasures,
  coerceNumericRows,
  applyCalculatedFields,
} from '../../../reports/custom/shared/models/custom-report.model';
import {
  CatalogIndex,
  nodeFields,
  sheetNodeIds,
} from '../../../reports/custom/shared/v2/catalog-fields';
import { coerceByRunColumns, sheetToSpec } from '../../../reports/custom/shared/v2/spec-adapter';

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
  imports: [ChartPreviewComponent, PaginationComponent],
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
  /** hasNext cursor pagination: true when more records follow this page. */
  hasNext = false;
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
  groupedData:
    | { value: any; count: number; len: number; subtotals: { [key: string]: number } }[]
    | null = null;
  groupFieldLabel = '';
  groupByKey: string | null = null;

  private allSheets: SheetConfig[] = [];
  private sheet: SheetConfig | null = null;
  private allFields: FlatField[] = [];
  /** v2 catalog (cached per session by ReportV2Service). */
  private catalogIndex: CatalogIndex = new Map();

  constructor(
    private savedReports: SavedReportsService,
    private reportsV2: ReportV2Service,
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
    if (
      (changes['sort'] || changes['pageSize']) &&
      !(changes['sort']?.firstChange || changes['pageSize']?.firstChange) &&
      this.sheet
    ) {
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
      // A v2 spec, or a report from the previous builder converted to v2.
      const report = await this.savedReports.open(this.moduleId);
      if (!report) {
        this.error = 'Report not found';
        return;
      }
      this.reportName = report.name || '';
      this.catalogIndex = report.catalogIndex;
      this.allSheets = report.sheets;
      this.applySheet(report.activeSheetId);

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
    this.sheet = this.allSheets.find((s) => s.id === wanted) || this.allSheets[0] || null;
    this.chartType = this.sheet?.chartType || 'table';
    if (!this.sheet) return;

    const sheet = this.sheet;
    this.allFields = [sheet.primaryTable, ...sheetNodeIds(sheet)]
      .filter((n, i, all) => all.indexOf(n) === i)
      .flatMap((n) => nodeFields(this.catalogIndex, n));
    const meta = buildColumnMeta(this.sheet, this.allFields);
    this.columnLabels = meta.columnLabels;
    this.columnFormats = meta.columnFormats;
    this.columnTypes = meta.columnTypes;
    this.columnNumberFormats = meta.columnNumberFormats;
    this.orderedColumns = meta.orderedColumns;

    const colorMark = this.sheet.marks.find((m) => m.channel === 'color');
    this.colorField = colorMark ? colorMark.field.col : null;
    this.groupByKey = this.sheet.groupBy || null;

    // Reset paging + seed the sort from the Customize selection (falls back to
    // the sheet's own saved sort) whenever the sheet is (re)applied.
    this.currentPage = 1;
    this.currentSort = this.initialSort();
  }

  /** Sort from the Customize modal if set, else the sheet's saved sort. */
  private initialSort(): { key: string; dir: 'ASC' | 'DESC' } | null {
    const base = this.sort && this.sort.length ? this.sort : this.sheet?.sortBy || [];
    return base.length ? { key: base[0].id, dir: base[0].mod } : null;
  }

  /** Run the report query for the cached sheet, applying filters + grouping. */
  private async runQuery(): Promise<void> {
    const sheet = this.sheet;
    if (!sheet) return;
    this.loading = true;
    this.error = null;
    try {
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
      // The widget's chosen filters replace the sheet's own (see buildMergedFilters).
      const spec = sheetToSpec(
        { ...sheet, filterRules: this.buildMergedFilters(sheet) },
        { index: this.catalogIndex, sort, limit: pageSize, page: this.currentPage },
      );
      const result = await this.reportsV2.run(spec);

      // hasNext cursor pagination: the backend reports whether more records
      // follow this page. Drives the pager's "Next" control (no total count).
      this.hasNext = result?.hasNext === true;

      // Grouped response → flatten rows + keep per-group subtotal metadata.
      let rows = result?.rows || [];
      let grouped: { value: any; count: number; len: number; subtotals: any }[] | null = null;
      if (sheet.groupBy && (result as any)?.groups?.length) {
        rows = (result as any).groups.flatMap((g: any) => g.rows || []);
        grouped = (result as any).groups.map((g: any) => {
          const len = (g.rows || []).length;
          return {
            value: g.value,
            count: typeof g.count === 'number' ? g.count : len,
            len,
            subtotals: g.subtotals || {},
          };
        });
      }

      coerceByRunColumns(rows, result.columns);
      coerceNumericMeasures(rows);
      coerceNumericRows(rows, sheet, this.fieldMeta());
      if (sheet.calculatedFields?.length) {
        applyCalculatedFields(rows, sheet.calculatedFields);
      }

      this.groupedData = grouped;
      this.groupFieldLabel =
        grouped && sheet.groupBy
          ? this.allFields.find((f) => f.fullId === sheet.groupBy)?.label ||
            sheet.groupBy.split('.').pop() ||
            ''
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
    // Values picked before a report moved to v2 name the old views; field
    // paths are relative to the entity, so only same-entity rules apply.
    const own = (this.filters || []).filter(
      (r: FilterRule) => (r?.field || '').split('.')[0] === sheet.primaryTable,
    );
    const base = own.length ? own : sheet.filterRules;
    return buildValidFilterRules(base);
  }

  private getDimKey(data: any[]): string | null {
    if (!data || data.length === 0) return null;
    const keys = Object.keys(data[0]);
    return keys.find((k) => !/^(sum|count|avg|max|min)\./.test(k) && k !== 'value') || keys[0];
  }

  private getMeasKeys(data: any[]): string[] {
    if (!data || data.length === 0) return [];
    const dimKey = this.getDimKey(data);
    return Object.keys(data[0]).filter((k) => k !== dimKey);
  }
}
