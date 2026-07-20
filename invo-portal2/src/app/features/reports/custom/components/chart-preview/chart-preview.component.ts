import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';
import { CHART_COLORS, ColumnFormat, formatValue } from '../../shared/models/custom-report.model';
import {
  IDENTIFIER_FIELD_PATTERN,
  isIdentifierFieldName,
  BOOLEAN_FIELD_PATTERN,
  INTEGER_FIELD_PATTERN,
  fieldNameOf,
} from '../../shared/marks/field-patterns';
import { CompanyService } from '@core/auth/company.service';

// ─── Pre-computed view models (used directly in template, no function calls) ──

interface BarItem {
  dimLabel: string;
  bars: { height: string; color: string; tooltip: string }[];
}

interface HBarItem {
  dimLabel: string;
  bars: { width: string; color: string; tooltip: string; fmtVal: string }[];
}

interface SvgDot {
  cx: number;
  cy: number;
}

interface SvgLine {
  path: string;
  areaPath: string;
  color: string;
  dots: SvgDot[];
}

interface SvgGrid {
  y: number;
  label: string;
}

interface TableRow {
  cells: { value: string; isNum: boolean }[];
  colorBorder: string;
}

interface PivotRow {
  dimLabel: string;
  values: string[];
  total: string;
}

interface SeriesGroup {
  name: string;
  color: string;
  data: any[];
}

interface SliceItem {
  label: string;
  value: number;
  fmtValue: string;
  color: string;
  path: string;
}

interface LegendItem {
  color: string;
  label: string;
}

@Component({
  selector: 'app-chart-preview',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './chart-preview.component.html',
  styleUrls: ['./chart-preview.component.scss'],
})
export class ChartPreviewComponent implements OnChanges {
  private company = inject(CompanyService);

  @Input() data: any[] = [];
  @Input() chartType = 'vertical-bar';
  @Input() dimKey: string | null = null;
  @Input() measKeys: string[] = [];
  @Input() colorField: string | null = null;
  @Input() columnLabels: { [key: string]: string } = {};
  @Input() orderedColumns: string[] = [];
  @Input() columnFormats: { [key: string]: ColumnFormat } = {};
  /**
   * Backend-declared type per column key (text / number / date / boolean / …).
   * Built by the parent from getDataSource — see report-builder.rebuildDerived.
   * Used in buildTableData to classify cells precisely instead of guessing
   * from value shape or field-name patterns.
   */
  @Input() columnTypes: { [key: string]: string } = {};
  /**
   * Toggle ApexCharts `dataLabels.enabled` for chart types that support it.
   * `null`/`undefined` falls back to the per-chart default in `buildApexOptions`.
   * Surfaced as a "Data labels" toggle in the Marks card on the right panel,
   * only for chart types ApexCharts supports labels on.
   */
  @Input() showDataLabels: boolean | null = null;
  /**
   * Sub-format for numeric columns: 'currency' | 'decimal' | 'integer'.
   * Sourced from DataSourceField.numberFormat via the parent. Branches
   * the number renderer:
   *   - currency → MycurrencyPipe (symbol + companyDecimals + thousand sep)
   *   - decimal  → MynumberPipe   (companyDecimals + thousand sep)
   *   - integer  → integer + thousand sep, no decimals
   *   - undefined → fallback to existing behaviour
   */
  @Input() columnNumberFormats: { [key: string]: string } = {};
  @Input() currentSort: { key: string; dir: 'ASC' | 'DESC' } | null = null;
  /**
   * True when fields are on the shelves (columns/rows). Distinguishes
   * "no data because user hasn't dropped anything" from "user dropped
   * fields but server returned 0 rows" in the empty state.
   */
  @Input() hasShelfFields = false;
  /**
   * Group by shelf result. When set (Table only) the table renders grouped:
   * a group-header row, the group's detail rows, then a subtotal row — driven
   * by the backend. `len` = rows for this group in the current page slice (used
   * to slice `tableRows`); `count` = the full group size (shown in the badge).
   */
  @Input() groupedData: { value: any; count: number; len: number; subtotals: { [key: string]: number } }[] | null = null;
  @Input() groupFieldLabel = '';
  /** Data key of the group-by column. When it's also a displayed column its
   *  value is shown only in the group header and blanked in the detail rows
   *  (avoids repeating the group name on every row). */
  @Input() groupByKey: string | null = null;
  @Output() columnsReordered = new EventEmitter<string[]>();
  @Output() openReorder = new EventEmitter<void>();
  @Output() sortChange = new EventEmitter<{ key: string; dir: 'ASC' | 'DESC' }>();
  @Output() loadModuleAction = new EventEmitter<void>();

  colors = CHART_COLORS;

  // ─── Cached view models (template reads these, zero function calls) ──
  hasData = false;
  hasChartData = false;
  /** True when data exists but the chart type can't render it (missing measure/dim). */
  chartUnsupported = false;
  chartUnsupportedReason = '';
  hasColorSeries = false;
  maxVal = 1;
  total = 0;
  fmtTotal = '0';
  yTicks: string[] = [];  // pre-formatted
  yTickCount = 0;

  // Bar charts
  vbarItems: BarItem[] = [];
  hbarItems: HBarItem[] = [];

  // Line/Area
  svgGridLines: SvgGrid[] = [];
  svgXLabels: { x: number; label: string }[] = [];
  svgLines: SvgLine[] = [];
  isArea = false;

  // Donut/Pie
  slices: SliceItem[] = [];

  // KPI
  kpiLabel = '';

  // Table
  cachedTableKeys: string[] = [];
  tableHeaders: { key: string; label: string; isNum: boolean; sortDir: 'asc' | 'desc' | null }[] = [];
  tableRows: TableRow[] = [];

  // Grouped table (Group by shelf)
  hasGroupedTable = false;
  groupedBlocks: {
    value: string;
    groupColIdx: number;
    rows: TableRow[];
    totalCells: { value: string; isNum: boolean; isLabel: boolean }[];
  }[] = [];

  // Pivot
  pivotDimLabel = '';
  pivotMeasHeaders: { key: string; label: string }[] = [];
  pivotRows: PivotRow[] = [];
  pivotColTotals: string[] = [];
  pivotGrandTotal = '0';

  // Legend
  legendItems: LegendItem[] = [];

  // Table interaction state
  numColumns = new Set<string>();
  dragColIndex: number | null = null;
  dragOverColIndex: number | null = null;

  // Sort state
  sortKey: string | null = null;
  sortDir: 'asc' | 'desc' = 'asc';

  // ApexCharts config (rebuilt in ngOnChanges; null when not chart-rendered)
  apexOptions: any = null;
  // True when the current chartType should render via apex (vs. KPI/table/pivot)
  isApexChart = false;


  // ─── Rebuild everything on input change ────────────

  ngOnChanges(_changes: SimpleChanges): void {
    // Sync sort state from parent input
    if (this.currentSort) {
      this.sortKey = this.currentSort.key;
      this.sortDir = this.currentSort.dir === 'ASC' ? 'asc' : 'desc';
    } else {
      this.sortKey = null;
      this.sortDir = 'asc';
    }

    this.hasData = !!this.data?.length;
    this.hasChartData = this.hasData && !!this.measKeys?.length;

    // Determine if the chosen chart type can be rendered with the current data
    this.chartUnsupported = false;
    this.chartUnsupportedReason = '';
    if (this.hasData) {
      const tabularTypes = ['table', 'pivot'];
      const needsDimAndMeas = ['vertical-bar', 'horizontal-bar', 'line', 'area', 'donut', 'pie'];
      if (!tabularTypes.includes(this.chartType)) {
        if (!this.measKeys?.length) {
          this.chartUnsupported = true;
          this.chartUnsupportedReason =
            'This chart needs at least one numeric measure on the rows shelf. Add a field with an aggregation (sum, count, avg…) to plot.';
        } else if (needsDimAndMeas.includes(this.chartType) && !this.dimKey) {
          this.chartUnsupported = true;
          this.chartUnsupportedReason =
            'This chart needs a dimension on the columns shelf in addition to a measure.';
        }
      }
    }

    if (this.hasChartData) {
      this.maxVal = Math.max(...this.data.flatMap(d => this.measKeys.map(k => this.toNum(d[k]))), 1);
      const vk = this.measKeys[0] || 'value';
      this.total = this.data.reduce((s, d) => s + this.toNum(d[vk]), 0);
      this.fmtTotal = this.fmt(this.total);
      this.buildYTicks();
    } else {
      this.maxVal = 1;
      this.total = 0;
      this.fmtTotal = '0';
      this.yTicks = ['0'];
      this.yTickCount = 1;
    }

    this.buildColorSeries();
    this.buildTableData();
    this.buildKpi();
    this.buildPivotData();
    this.buildLegend();
    this.buildApexOptions();
  }

  // ─── ApexCharts options ───────────────────────────
  //
  // Single entry point that converts the current data+chartType into an
  // ApexCharts options object. Replaces the old hand-rolled SVG/CSS bar,
  // line, area, donut and pie renderers — apex handles label collision,
  // tooltips, animations and responsive sizing out of the box.

  private buildApexOptions(): void {
    const apexTypes = ['vertical-bar', 'horizontal-bar', 'line', 'area', 'donut', 'pie'];
    this.isApexChart = this.hasChartData && apexTypes.includes(this.chartType);
    if (!this.isApexChart) { this.apexOptions = null; return; }

    const dk = this.dimKey || '';
    const fmt = (v: any) => this.fmt(this.toNum(v));
    // showDataLabels === null → use the per-chart default (current behaviour).
    // showDataLabels === true/false → user override from the Marks card.
    const labelsEnabledFor = (chartDefault: boolean) =>
      this.showDataLabels === null || this.showDataLabels === undefined
        ? chartDefault
        : !!this.showDataLabels;

    // ── Donut / Pie share a different data shape (numeric series + labels) ──
    if (this.chartType === 'donut' || this.chartType === 'pie') {
      const vk = this.measKeys[0] || 'value';
      this.apexOptions = {
        chart: { type: this.chartType, height: '100%', toolbar: { show: false }, fontFamily: 'Inter, system-ui, sans-serif' },
        series: this.data.map(d => this.toNum(d[vk])),
        labels: this.data.map(d => String(d[dk] ?? '')),
        colors: this.colors,
        legend: { position: 'bottom', fontSize: '12px', fontWeight: 500 },
        dataLabels: { enabled: labelsEnabledFor(true), style: { fontSize: '11px', fontWeight: 600 } },
        stroke: { width: 2, colors: ['#fff'] },
        tooltip: { y: { formatter: (val: number) => fmt(val) } },
        plotOptions: this.chartType === 'donut' ? {
          pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'Total', formatter: () => this.fmtTotal } } } }
        } : {},
        responsive: [{ breakpoint: 600, options: { legend: { position: 'bottom' } } }],
      };
      return;
    }

    // ── Bar / Line / Area share categorical xaxis + named series ────────
    const isHorizontal = this.chartType === 'horizontal-bar';
    const apexType: 'bar' | 'line' | 'area' =
      this.chartType === 'line' ? 'line' :
      this.chartType === 'area' ? 'area' : 'bar';

    const categories = this.data.map(d => String(d[dk] ?? ''));
    let series: { name: string; data: number[] }[];

    if (this.colorField && this.hasColorSeries) {
      // One series per distinct colorField value (matches the old multi-line behavior).
      const groups = new Map<string, any[]>();
      this.data.forEach(row => {
        const key = String(row[this.colorField!] ?? 'Other');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      });
      const vk = this.measKeys[0] || 'value';
      series = [...groups.entries()].map(([name, rows]) => ({
        name,
        data: categories.map(cat => {
          const match = rows.find(r => String(r[dk] ?? '') === cat);
          return match ? this.toNum(match[vk]) : 0;
        }),
      }));
    } else {
      // One series per measure (sum/avg/etc.).
      series = this.measKeys.map(k => ({
        name: this.labelFor(k),
        data: this.data.map(d => this.toNum(d[k])),
      }));
    }

    this.apexOptions = {
      chart: {
        type: apexType,
        height: '100%',
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'Inter, system-ui, sans-serif',
        animations: { enabled: true, easing: 'easeout', speed: 300 },
      },
      series,
      colors: this.colors,
      stroke: {
        curve: 'smooth',
        width: apexType === 'line' ? 3 : apexType === 'area' ? 2 : 0,
      },
      fill: apexType === 'area'
        ? { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] } }
        : { opacity: 1 },
      markers: { size: (apexType === 'line' || apexType === 'area') ? 4 : 0, strokeWidth: 2, strokeColors: '#fff', hover: { size: 6 } },
      plotOptions: {
        bar: {
          horizontal: isHorizontal,
          columnWidth: '65%',
          borderRadius: 4,
          borderRadiusApplication: 'end',
          dataLabels: { position: isHorizontal ? 'top' : 'top' },
        },
      },
      // Default off for bar/line/area (categorical x can overcrowd quickly);
      // user can switch on via the Marks card → Data labels.
      dataLabels: {
        enabled: labelsEnabledFor(false),
        style: { fontSize: '10px', fontWeight: 600 },
        background: { enabled: true, foreColor: '#1f2328', borderRadius: 3, padding: 3 },
        formatter: (val: number) => fmt(val),
      },
      xaxis: {
        categories,
        labels: {
          style: { fontSize: '11px', fontWeight: 500, colors: '#6b7280' },
          // ApexCharts handles overflow gracefully — rotation + auto-hide
          // — so the dense overlapping labels in the old SVG renderer go away.
          hideOverlappingLabels: true,
          trim: true,
          maxHeight: 80,
          rotate: -35,
          rotateAlways: false,
        },
        axisBorder: { color: '#e5e7eb' },
        axisTicks: { color: '#e5e7eb' },
      },
      yaxis: {
        labels: {
          formatter: (val: number) => fmt(val),
          style: { fontSize: '11px', colors: '#6b7280' },
        },
      },
      grid: { borderColor: '#f0f0f0', strokeDashArray: 3, padding: { top: 0, right: 12, bottom: 0, left: 8 } },
      legend: {
        show: series.length > 1,
        position: 'bottom',
        fontSize: '12px',
        fontWeight: 500,
        markers: { width: 10, height: 10, radius: 3 },
      },
      tooltip: {
        theme: 'light',
        y: { formatter: (val: number) => fmt(val) },
      },
    };
  }

  // ─── Y-Axis ticks ─────────────────────────────────

  private buildYTicks(): void {
    const raw = this.maxVal;
    if (raw <= 0) { this.yTicks = ['0']; this.yTickCount = 1; return; }

    const targetTicks = 5;
    const roughStep = raw / (targetTicks - 1);
    const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const residual = roughStep / mag;
    let niceStep: number;
    if (residual <= 1.5) niceStep = mag;
    else if (residual <= 3) niceStep = 2 * mag;
    else if (residual <= 7) niceStep = 5 * mag;
    else niceStep = 10 * mag;

    const niceMax = Math.ceil(raw / niceStep) * niceStep;
    this.maxVal = niceMax;

    const ticks: string[] = [];
    for (let v = niceMax; v >= 0; v -= niceStep) {
      ticks.push(this.fmt(Math.round(v * 100) / 100));
    }
    if (ticks[ticks.length - 1] !== '0') ticks.push('0');
    this.yTicks = ticks;
    this.yTickCount = ticks.length;
  }

  // ─── Color series ─────────────────────────────────

  private buildColorSeries(): void {
    if (!this.colorField || !this.hasData) {
      this.hasColorSeries = false;
      return;
    }
    const groups = new Map<string, any[]>();
    this.data.forEach(row => {
      const key = String(row[this.colorField!] ?? 'Other');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    });
    this.hasColorSeries = groups.size > 0;
  }

  // Legacy bar / SVG line / slice builders were removed — ApexCharts handles
  // those chart types via `buildApexOptions()` now.

  // ─── KPI ──────────────────────────────────────────

  private buildKpi(): void {
    this.kpiLabel = this.labelFor(this.measKeys[0] || 'value');
  }

  // ─── Table data ───────────────────────────────────

  private buildTableData(): void {
    if (!this.hasData) {
      this.cachedTableKeys = [];
      this.tableHeaders = [];
      this.tableRows = [];
      this.hasGroupedTable = false;
      this.groupedBlocks = [];
      return;
    }

    // Build ordered keys
    const dataKeys = Object.keys(this.data[0]);
    if (this.orderedColumns.length > 0) {
      const dataKeySet = new Set(dataKeys);
      const ordered = this.orderedColumns.filter(k => dataKeySet.has(k));
      const orderedSet = new Set(ordered);
      dataKeys.forEach(k => { if (!orderedSet.has(k)) ordered.push(k); });
      this.cachedTableKeys = ordered;
    } else {
      this.cachedTableKeys = dataKeys;
    }

    // Build numColumns set.
    //
    // Prefer the backend-declared type from `columnTypes` (sourced from
    // getDataSource). Only fall back to value-shape + name-pattern heuristics
    // when the parent hasn't supplied a type for this key.
    this.numColumns = new Set<string>();
    for (const key of this.cachedTableKeys) {
      const declared = this.columnTypes[key];
      if (declared) {
        if (declared === 'number') this.numColumns.add(key);
        continue;
      }
      const prefix = key.split('.')[0];
      if (['sum', 'count', 'avg', 'max', 'min'].includes(prefix)) {
        this.numColumns.add(key);
      } else if (this.data.length > 0) {
        const v = this.data[0][key];
        const isBoolean = typeof v === 'boolean';
        const field = fieldNameOf(key);
        if (
          v !== null && v !== undefined && v !== '' &&
          !isBoolean &&
          !isNaN(Number(v)) &&
          !isIdentifierFieldName(field) &&
          !BOOLEAN_FIELD_PATTERN.test(field)
        ) {
          this.numColumns.add(key);
        }
      }
    }

    // Pre-build headers
    this.tableHeaders = this.cachedTableKeys.map(k => ({
      key: k,
      label: this.labelFor(k),
      isNum: this.numColumns.has(k),
      sortDir: this.sortKey === k ? this.sortDir : null as ('asc' | 'desc' | null),
    }));

    // Pre-build rows (apply column formats using same logic as MynumberPipe/MycurrencyPipe)
    const cs = this.company.settings();
    this.tableRows = this.data.map(row => {
      const colorVal = this.colorField ? row[this.colorField] : null;
      const colorIdx = colorVal ? [...new Set(this.data.map(r => r[this.colorField!]))].indexOf(colorVal) : -1;
      return {
        cells: this.cachedTableKeys.map(k => {
          const colFmt = this.columnFormats[k];
          let value: string;
          const declared = this.columnTypes[k];
          const nf = this.columnNumberFormats[k];
          if (colFmt && colFmt.type !== 'none') {
            value = formatValue(row[k], colFmt, cs);
          } else if (declared === 'boolean') {
            value = this.fmtBoolean(row[k]);
          } else if (declared === 'date') {
            value = this.fmtDate(row[k]);
          } else if (this.numColumns.has(k)) {
            // Branch on backend-declared numberFormat. Currency uses the
            // company symbol + decimals (MycurrencyPipe behaviour); integer
            // drops decimals; decimal/undefined fall through to existing
            // company-afterDecimal formatting.
            if (nf === 'currency') {
              value = this.fmtCurrency(this.toNum(row[k]), cs);
            } else if (nf === 'integer') {
              value = this.fmtInteger(this.toNum(row[k]));
            } else {
              value = this.fmtNumber(this.toNum(row[k]), cs, k);
            }
          } else {
            value = String(row[k] ?? '');
          }
          return { value, isNum: this.numColumns.has(k) };
        }),
        colorBorder: colorVal ? '3px solid ' + (this.colors[colorIdx % this.colors.length] || '#ddd') : 'none',
      };
    });

    this.buildGroupedBlocks(cs);
  }

  /**
   * Interleave the flat `tableRows` into per-group blocks (header + rows +
   * subtotal) using the backend's grouped metadata. `tableRows` is already
   * the concatenation of every group's page-slice rows in order, so each block
   * just slices its own `len` rows. Subtotals come from the backend (keyed like
   * the columns) and are formatted with the same column rules as data cells.
   */
  private buildGroupedBlocks(cs: any): void {
    this.hasGroupedTable = !!(this.groupedData && this.groupedData.length);
    this.groupedBlocks = [];
    if (!this.hasGroupedTable) return;
    // Column the group name occupies. The value is rendered once as a vertically
    // merged (rowspan) cell over the group's detail rows; the same column on the
    // Total row carries the "Total" label. Falls back to the first column when
    // the group-by field isn't a displayed column.
    const gIdx = this.groupByKey ? this.cachedTableKeys.indexOf(this.groupByKey) : -1;
    const groupColIdx = gIdx >= 0 ? gIdx : 0;
    let idx = 0;
    for (const g of this.groupedData!) {
      const len = g.len || 0;
      const start = idx;
      const rows = this.tableRows.slice(start, start + len);
      const dataSlice = this.data.slice(start, start + len);
      idx += len;
      // Total row: "Total" label in the group column, aggregates under the
      // numeric columns, everything else blank.
      const totalCells = this.cachedTableKeys.map((k, i) => {
        if (i === groupColIdx) return { value: 'Total', isNum: false, isLabel: true };
        if (this.numColumns.has(k)) {
          // Prefer the backend's per-group subtotal; fall back to summing this
          // column over the group's own rows when the backend omits it (e.g. it
          // only sends subtotals for plain columns, not aggregated measures).
          let sv = this.subtotalFor(g.subtotals, k);
          if (sv === undefined) sv = dataSlice.reduce((s, r) => s + this.toNum(r[k]), 0);
          return { value: this.formatNumericKey(k, sv, cs), isNum: true, isLabel: false };
        }
        return { value: '', isNum: false, isLabel: false };
      });
      this.groupedBlocks.push({ value: String(g.value ?? ''), groupColIdx, rows, totalCells });
    }
  }

  /**
   * Look up a group's subtotal for a column key. The backend may key subtotals
   * by the raw column ("Table.qty") while the table column carries an agg/date
   * prefix ("sum.Table.qty") — so try the full key first, then the prefix-
   * stripped form. Returns undefined when there's no subtotal for the column.
   */
  private subtotalFor(subtotals: { [key: string]: number } | undefined, key: string): number | undefined {
    if (!subtotals) return undefined;
    const direct = subtotals[key];
    if (direct !== undefined && direct !== null) return direct;
    const parts = key.split('.');
    const prefixes = ['sum', 'count', 'avg', 'max', 'min', 'year', 'month', 'day', 'yearmonth', 'yearmonthday'];
    if (parts.length >= 3 && prefixes.includes(parts[0])) {
      const raw = parts.slice(1).join('.');
      const v = subtotals[raw];
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  }

  /** Format a numeric value for `key` using the same rules as data cells. */
  private formatNumericKey(key: string, raw: any, cs: any): string {
    const colFmt = this.columnFormats[key];
    if (colFmt && colFmt.type !== 'none') return formatValue(raw, colFmt, cs);
    const nf = this.columnNumberFormats[key];
    if (nf === 'currency') return this.fmtCurrency(this.toNum(raw), cs);
    if (nf === 'integer') return this.fmtInteger(this.toNum(raw));
    return this.fmtNumber(this.toNum(raw), cs, key);
  }

  // ─── Pivot data ───────────────────────────────────

  private buildPivotData(): void {
    if (!this.hasData || this.chartType !== 'pivot') {
      this.pivotRows = [];
      this.pivotMeasHeaders = [];
      this.pivotColTotals = [];
      this.pivotGrandTotal = '0';
      this.pivotDimLabel = '';
      return;
    }

    const dk = this.dimKey || '';
    this.pivotDimLabel = this.labelFor(dk);
    this.pivotMeasHeaders = this.measKeys.map(k => ({ key: k, label: this.labelFor(k) }));

    this.pivotRows = this.data.map(row => ({
      dimLabel: String(row[dk] ?? ''),
      values: this.measKeys.map(k => this.fmt(this.toNum(row[k]))),
      total: this.fmt(this.measKeys.reduce((s, k) => s + this.toNum(row[k]), 0)),
    }));

    this.pivotColTotals = this.measKeys.map(k =>
      this.fmt(this.data.reduce((s, r) => s + this.toNum(r[k]), 0))
    );
    this.pivotGrandTotal = this.fmt(
      this.data.reduce((s, r) => s + this.measKeys.reduce((ss, k) => ss + this.toNum(r[k]), 0), 0)
    );
  }

  // ─── Legend ───────────────────────────────────────

  private buildLegend(): void {
    if (!this.hasChartData || ['table', 'pivot', 'kpi'].includes(this.chartType)) {
      this.legendItems = [];
      return;
    }

    // Color series legend (from Marks → Color)
    if (this.hasColorSeries && this.colorField) {
      const vals = [...new Set(this.data.map(r => String(r[this.colorField!] ?? 'Other')))];
      this.legendItems = vals.map((name, i) => ({
        color: this.colors[i % this.colors.length],
        label: name,
      }));
      return;
    }

    // Always show measure legend for bar/line/area/donut/pie
    this.legendItems = this.measKeys.map((k, i) => ({
      color: this.colors[i % this.colors.length],
      label: this.labelFor(k),
    }));
  }

  // ─── Column drag-reorder (interaction, not precomputed) ──

  onColDragStart(event: DragEvent, index: number): void {
    this.dragColIndex = index;
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', String(index));
  }

  onColDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    this.dragOverColIndex = index;

  }

  onColDragLeave(): void {
    this.dragOverColIndex = null;

  }

  onColDrop(event: DragEvent, toIndex: number): void {
    event.preventDefault();
    this.dragOverColIndex = null;
    const fromIndex = this.dragColIndex;
    this.dragColIndex = null;
    if (fromIndex === null || fromIndex === toIndex) return;

    const keys = [...this.cachedTableKeys];
    const [moved] = keys.splice(fromIndex, 1);
    keys.splice(toIndex, 0, moved);
    this.cachedTableKeys = keys;
    this.buildTableData();
    this.columnsReordered.emit(keys);

  }

  onColDragEnd(): void {
    this.dragColIndex = null;
    this.dragOverColIndex = null;

  }

  // ─── Sort on column click ─────────────────────────

  onSortColumn(key: string): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.buildTableData(); // update sort indicator in headers
    this.sortChange.emit({ key, dir: this.sortDir === 'asc' ? 'ASC' : 'DESC' });
  }

  /** Called by parent after reorder dialog applies new column order */
  applyColumnOrder(keys: string[]): void {
    this.cachedTableKeys = keys;
    this.buildTableData();
    this.columnsReordered.emit(keys);
  }

  // ─── Pure utility (never called from template) ────

  private toNum(v: any): number {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const cleaned = v.replace(/[, ]/g, '');
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }

  /** Format for charts (Y-axis, tooltips, KPI) — no decimals, just thousands */
  private fmt(n: number | string): string {
    const num = typeof n === 'string' ? parseFloat(n) : n;
    return isNaN(num) ? '0' : Math.round(num).toLocaleString();
  }

  /**
   * True when the column should be rendered as an integer:
   *  - COUNT aggregation (always integer by definition)
   *  - SUM/AVG/MIN/MAX of a field whose name matches INTEGER_FIELD_PATTERN
   *  - non-aggregated field whose name matches the pattern
   * Patterns live in shared/marks/field-patterns so the renderer and the
   * smart-marks classifier agree on what's an integer-named column.
   */
  private isIntegerColumn(key: string): boolean {
    if (!key) return false;
    const parts = key.split('.');
    const agg = parts.length >= 3 && ['sum', 'count', 'avg', 'max', 'min'].includes(parts[0])
      ? parts[0]
      : '';
    if (agg === 'count') return true;
    return INTEGER_FIELD_PATTERN.test(fieldNameOf(key));
  }

  /** Render a backend-declared boolean column. Accepts true/false/0/1/'0'/'1'/'true'/'false'. */
  private fmtBoolean(v: any): string {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return v ? 'Yes' : 'No';
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === 'true' || s === '1' || s === 'yes') return 'Yes';
      if (s === 'false' || s === '0' || s === 'no') return 'No';
    }
    return String(v);
  }

  /** Render a backend-declared date column as yyyy-MM-dd HH:mm (locale-independent). */
  private fmtDate(v: any): string {
    if (v === null || v === undefined || v === '') return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    // Include time only when it isn't midnight UTC (avoid noisy " 00:00" on
    // pure date columns).
    const h = d.getHours(), m = d.getMinutes();
    return h === 0 && m === 0 ? date : `${date} ${pad(h)}:${pad(m)}`;
  }

  /**
   * Currency format — same shape as MycurrencyPipe: company currencySymbol +
   * companyDecimals + thousand sep. Falls back to a bare formatted number
   * if no symbol is configured.
   */
  private fmtCurrency(num: number, cs: any): string {
    if (isNaN(num)) return '0';
    const decimals: number = cs?.settings?.afterDecimal ?? 3;
    const symbol: string = cs?.settings?.currencySymbol ?? '';
    const fixed = num.toFixed(decimals);
    const [intPart, fracPart] = fixed.split('.');
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const body = fracPart ? `${formatted}.${fracPart}` : formatted;
    return symbol ? `${symbol} ${body}` : body;
  }

  /** Integer format — thousand sep, no decimals. Used for explicit
   *  numberFormat = 'integer' and COUNT aggregations. */
  private fmtInteger(num: number): string {
    if (isNaN(num)) return '0';
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** Format number using same logic as MynumberPipe (company afterDecimal + thousand sep) */
  private fmtNumber(num: number, cs: any, key?: string): string {
    if (isNaN(num)) return '0';
    const decimals: number = key && this.isIntegerColumn(key)
      ? 0
      : (cs?.settings?.afterDecimal ?? 3);
    const fixed = num.toFixed(decimals);
    const [intPart, fracPart] = fixed.split('.');
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fracPart ? `${formatted}.${fracPart}` : formatted;
  }

  private labelFor(key: string): string {
    if (this.columnLabels[key]) return this.columnLabels[key];
    const parts = (key || '').split('.');
    // Formula leaves arrive as "@key"; strip the marker so a missing label never
    // renders a raw "@daysToExpire" (the parent supplies the real name via columnLabels).
    const leaf = (seg: string) => (seg && seg.startsWith('@') ? seg.slice(1) : seg);
    if (parts.length >= 3 && ['sum', 'count', 'avg', 'max', 'min'].includes(parts[0])) {
      return parts[0].toUpperCase() + '(' + leaf(parts[parts.length - 1]) + ')';
    }
    if (parts.length >= 3 && ['year', 'month', 'day', 'yearmonth', 'yearmonthday'].includes(parts[0])) {
      return parts[0] + '(' + leaf(parts[parts.length - 1]) + ')';
    }
    if (parts.length >= 2) return leaf(parts[parts.length - 1]);
    return key || '';
  }

  private makeArc(sa: number, ea: number, oR: number, iR: number): string {
    const cx = 100, cy = 100;
    const toRad = (a: number) => ((a - 90) * Math.PI) / 180;
    const x1 = cx + oR * Math.cos(toRad(sa)), y1 = cy + oR * Math.sin(toRad(sa));
    const x2 = cx + oR * Math.cos(toRad(ea)), y2 = cy + oR * Math.sin(toRad(ea));
    const lg = ea - sa > 180 ? 1 : 0;
    if (iR === 0) return `M${cx},${cy} L${x1},${y1} A${oR},${oR} 0 ${lg} 1 ${x2},${y2} Z`;
    const x3 = cx + iR * Math.cos(toRad(ea)), y3 = cy + iR * Math.sin(toRad(ea));
    const x4 = cx + iR * Math.cos(toRad(sa)), y4 = cy + iR * Math.sin(toRad(sa));
    return `M${x1},${y1} A${oR},${oR} 0 ${lg} 1 ${x2},${y2} L${x3},${y3} A${iR},${iR} 0 ${lg} 0 ${x4},${y4} Z`;
  }
}
