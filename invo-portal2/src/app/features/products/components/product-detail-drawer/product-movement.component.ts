import { Component, ElementRef, HostBinding, HostListener, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { MycurrencyPipe, MynumberPipe } from '../../../../core/pipes';
import { ProductsService, ProductMovementPage, ProductMovementRow } from '../../services/products.service';
import { getTransactionRoute, LINKED_TYPES } from '../../../../shared/utils/linked-types';
import { VisibleDirective } from '../../../../shared/directives/visible.directive';
import { DatePickerComponent, DateRange, DatePreset } from '../../../../shared/components/datepicker';
import { BranchConnectionService, BranchConnection } from '../../../../core/layout/services/branch.service';

/**
 * Paginated product-movement table for the Product Movement tab.
 * Self-loads via IntersectionObserver. Supports branch + date-range filters.
 */
@Component({
  selector: 'app-product-movement',
  standalone: true,
  imports: [CommonModule, TranslateModule, DatePipe, MycurrencyPipe, MynumberPipe, DatePickerComponent, NgApexchartsModule],
  hostDirectives: [VisibleDirective],
  template: `
    <div class="filter-bar">
      <app-date-picker
        mode="range"
        [value]="dateRange()"
        (valueChange)="onDateRangeChange($any($event))"
        [presets]="datePresets"
        [monthsShown]="2"
        placeholder="{{ 'PRODUCTS.MOVEMENT.DATE_RANGE' | translate }}"
        displayFormat="yyyy-MM-dd"
        triggerClass="dp-trigger">
      </app-date-picker>

      <div class="branch-picker" (click)="$event.stopPropagation()">
        <button type="button" class="btn dp-trigger" (click)="toggleBranchMenu()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7h18M6 12h12M10 17h4"/>
          </svg>
          <span>{{ branchLabel() }}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        @if (branchMenuOpen()) {
          <div class="branch-menu">
            @if (!branches().length) {
              <div class="menu-empty">{{ 'PRODUCTS.MOVEMENT.NO_BRANCHES' | translate }}</div>
            } @else {
              <label class="menu-item">
                <input type="checkbox"
                  [checked]="allBranchesMode()"
                  (change)="toggleAllBranches()">
                <span>{{ 'PRODUCTS.MOVEMENT.ALL_BRANCHES' | translate }}</span>
              </label>
              <div class="menu-divider"></div>
              @for (b of branches(); track b.id) {
                <label class="menu-item">
                  <input type="checkbox"
                    [checked]="isBranchSelected(b.id)"
                    (change)="toggleBranch(b.id)">
                  <span>{{ b.name }}</span>
                </label>
              }
            }
          </div>
        }
      </div>

      <button type="button" class="btn btn--primary" (click)="applyFilters()">
        {{ 'PRODUCTS.MOVEMENT.APPLY' | translate }}
      </button>
      @if (hasActiveFilters()) {
        <button type="button" class="btn btn--ghost" (click)="clearFilters()">
          {{ 'PRODUCTS.MOVEMENT.CLEAR' | translate }}
        </button>
      }
    </div>

    @if (hasLoaded && page() && page()!.records.length) {
      <!-- ─── Metrics summary ─────────────────────────────────────── -->
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">{{ 'PRODUCTS.MOVEMENT.STARTING_BALANCE' | translate }}</div>
          <div class="metric-value">{{ metrics().startBalance | mynumber }}</div>
        </div>
        <div class="metric">
          <div class="metric-label">{{ 'PRODUCTS.MOVEMENT.FINAL_BALANCE' | translate }}</div>
          <div class="metric-value">{{ metrics().endBalance | mynumber }}</div>
        </div>
        <div class="metric" [attr.data-trend]="trendOf(metrics().netMovement)">
          <div class="metric-label">{{ 'PRODUCTS.MOVEMENT.NET_MOVEMENT' | translate }}</div>
          <div class="metric-value">{{ metrics().netMovement | mynumber }}</div>
        </div>
        <div class="metric" [attr.data-trend]="trendOf(metrics().costImpact)">
          <div class="metric-label">{{ 'PRODUCTS.MOVEMENT.COST_IMPACT' | translate }}</div>
          <div class="metric-value">{{ metrics().costImpact | mycurrency }}</div>
        </div>
      </div>
    }

    <div class="card">
      <div class="card-head">
        <span>{{ 'PRODUCTS.MOVEMENT.TITLE' | translate }}</span>

        @if (!loading() && page() && page()!.records.length) {
          <div class="pager">
            <button type="button" class="btn" [disabled]="pageNum() <= 1" (click)="prev()">
              {{ 'PRODUCTS.SALES.PREV' | translate }}
            </button>
            <span class="pager-num">{{ pageNum() }} / {{ page()!.pageCount || 1 }}</span>
            <button type="button" class="btn" [disabled]="pageNum() >= (page()!.pageCount || 1)" (click)="next()">
              {{ 'PRODUCTS.SALES.NEXT' | translate }}
            </button>
          </div>
        }
      </div>

      <div class="card-body">
        @if (loading() || !hasLoaded) {
          @for (i of [1,2,3,4,5]; track i) {
            <div class="row-skel">
              <div class="skeleton w-15"></div>
              <div class="skeleton w-15"></div>
              <div class="skeleton w-20"></div>
              <div class="skeleton w-10"></div>
              <div class="skeleton w-10"></div>
              <div class="skeleton w-15"></div>
              <div class="skeleton w-15"></div>
            </div>
          }
        } @else if (!page() || !page()!.records.length) {
          <div class="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M7 14l4-4 4 4 5-5"/>
            </svg>
            <p>{{ 'PRODUCTS.MOVEMENT.NO_DATA' | translate }}</p>
          </div>
        } @else {
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th class="start">{{ 'PRODUCTS.SALES.TYPE'             | translate }}</th>
                  <th class="start">{{ 'PRODUCTS.SALES.BRANCH'           | translate }}</th>
                  <th class="start">{{ 'PRODUCTS.SALES.DATE'             | translate }}</th>
                  <th class="end">{{   'PRODUCTS.MOVEMENT.QTY_USAGE'     | translate }}</th>
                  <th class="end">{{   'PRODUCTS.MOVEMENT.QTY_BALANCE'   | translate }}</th>
                  <th class="end">{{   'PRODUCTS.MOVEMENT.COST'          | translate }}</th>
                  <th class="end">{{   'PRODUCTS.MOVEMENT.COST_BALANCE'  | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of page()!.records; track $index) {
                  <tr>
                    <td>
                      @if (linkFor(row)) {
                        <a [href]="linkFor(row)" target="_blank" rel="noopener" class="link">
                          {{ row.type }}
                        </a>
                      } @else {
                        <span>{{ row.type || '—' }}</span>
                      }
                    </td>
                    <td>{{ row.branchName || '—' }}</td>
                    <td class="mono nowrap">{{ row.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                    <td class="end mono">{{ row.qtyUsage    | mynumber }}</td>
                    <td class="end mono">{{ row.qtyBalance  | mynumber }}</td>
                    <td class="end mono">{{ row.cost        | mycurrency }}</td>
                    <td class="end mono">{{ row.costBalance | mycurrency }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    @if (hasLoaded && page() && page()!.records.length) {
      <!-- ─── Chart (after the table for easier reading) ───────────── -->
      <div class="card chart-card">
        <div class="card-head chart-head">
          <span class="chart-title">
            {{ 'PRODUCTS.MOVEMENT.CHART_TITLE' | translate }}
            @if (chartBranchFilter() !== 'all') {
              <span class="chart-title-branch">— {{ chartBranchFilter() }}</span>
            }
          </span>

          @if (availableBranches().length > 1) {
            <select class="chart-branch-select"
              [value]="chartBranchFilter()"
              (change)="onChartBranchChange($any($event.target).value)">
              <option value="all">{{ 'PRODUCTS.MOVEMENT.ALL_BRANCHES' | translate }}</option>
              @for (b of availableBranches(); track b) {
                <option [value]="b">{{ b }}</option>
              }
            </select>
          }
        </div>

        <div class="card-body chart-body">
          <div class="chart-legend">
            <span class="legend-item">
              <span class="legend-swatch" style="background:#97C459"></span>
              {{ 'PRODUCTS.MOVEMENT.LEGEND_KIT_BUILD' | translate }}
            </span>
            <span class="legend-item">
              <span class="legend-swatch" style="background:#E24B4A"></span>
              {{ 'PRODUCTS.MOVEMENT.LEGEND_KIT_BREAK' | translate }}
            </span>
            <span class="legend-item">
              <span class="legend-swatch" style="background:#888780"></span>
              {{ 'PRODUCTS.MOVEMENT.LEGEND_INITIAL' | translate }}
            </span>
            <span class="legend-item">
              <span class="legend-swatch legend-swatch--line" style="background:#0e7490"></span>
              {{ 'PRODUCTS.MOVEMENT.LEGEND_BALANCE' | translate }}
            </span>
          </div>

          @if (chartSeries.length) {
            <apx-chart
              [series]="chartSeries"
              [chart]="chartOptions"
              [xaxis]="chartXaxis"
              [yaxis]="chartYaxis"
              [tooltip]="chartTooltip"
              [legend]="chartLegend"
              [dataLabels]="chartDataLabels"
              [grid]="chartGrid"
              [stroke]="chartStroke"
              [markers]="chartMarkers"
              [colors]="chartColors"
              [plotOptions]="chartPlotOptions">
            </apx-chart>
          } @else {
            <div class="empty">
              <p>{{ 'PRODUCTS.MOVEMENT.NO_DATA' | translate }}</p>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-height: 320px; }
    :host(.loaded) { min-height: 0; }

    .filter-bar {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      margin-bottom: 12px;
    }
    @media (max-width: 600px) {
      .filter-bar { gap: 6px; }
      .filter-bar app-date-picker,
      .filter-bar .branch-picker { flex: 1 1 100%; min-width: 0; }
      .filter-bar .branch-picker .btn { width: 100%; justify-content: space-between; }
      .filter-bar .btn--primary,
      .filter-bar .btn--ghost { flex: 1 1 auto; }
    }

    /* ── Metrics summary ─────────────────────────────────────── */
    .metrics {
      display: grid; gap: 10px; margin-bottom: 12px;
      grid-template-columns: repeat(4, 1fr);
    }
    @media (max-width: 900px) { .metrics { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .metrics { grid-template-columns: 1fr; } }
    .metric {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .metric-label {
      font-size: 11px; font-weight: 600; color: #64748b;
      text-transform: uppercase; letter-spacing: .04em;
    }
    .metric-value {
      font-size: 20px; font-weight: 700; color: #0f172a;
      font-variant-numeric: tabular-nums;
    }
    .metric[data-trend="up"]   { background:#f0fdf4; border-color:#bbf7d0; }
    .metric[data-trend="up"]   .metric-value { color:#15803d; }
    .metric[data-trend="down"] { background:#fef2f2; border-color:#fecaca; }
    .metric[data-trend="down"] .metric-value { color:#b91c1c; }

    .chart-card { margin-bottom: 12px; }
    .chart-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .chart-title { font-size: 13px; font-weight: 600; color: #0f172a; }
    .chart-title-branch { font-weight: 500; color: #64748b; margin-inline-start: 4px; }
    .chart-branch-select {
      padding: 4px 8px; border-radius: 6px; border: 1px solid #e2e8f0;
      background: #fff; font-size: 12px; font-weight: 600; color: #475569;
      cursor: pointer; max-width: 220px;
    }
    .chart-branch-select:hover { background: #f8fafc; }

    .chart-body { padding: 4px 4px 0; }
    :host ::ng-deep .chart-body .apexcharts-canvas {
      width: 100% !important;
      overflow: visible !important;   /* let toolbar render outside canvas top */
    }
    /* Apex inserts a default block-level margin under the SVG — strip it. */
    :host ::ng-deep .chart-body .apexcharts-svg { display: block; }
    :host ::ng-deep .chart-body .apexcharts-legend { display: none !important; }
    /* Lift the chart toolbar out of the chart area into the empty space on
       the right of our custom legend row. */
    :host ::ng-deep .chart-body .apexcharts-toolbar {
      top: -34px !important;
      inset-inline-end: 8px !important;
      z-index: 5;
    }

    .chart-legend {
      display: flex; flex-wrap: wrap; gap: 16px;
      padding: 14px 8px 10px;
      font-size: 12px; color: #475569;
    }
    .legend-item { display: inline-flex; align-items: center; gap: 6px; }
    .legend-swatch {
      display: inline-block; width: 12px; height: 12px; border-radius: 3px;
    }
    .legend-swatch--line { width: 18px; height: 3px; border-radius: 2px; }
    :host ::ng-deep .dp-trigger {
      padding: 6px 10px; border-radius: 6px;
      border: 1px solid #e2e8f0; background: #fff;
      font-size: 12px; font-weight: 600; color: #475569;
      cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
      outline: none;
      transition: border-color .12s, box-shadow .12s, background .12s;
    }
    :host ::ng-deep .dp-trigger:hover { background: #f8fafc; border-color: #cbd5e1; }
    :host ::ng-deep .dp-trigger:focus-visible,
    :host ::ng-deep .dp-trigger[aria-expanded="true"] {
      border-color: #32acc1;
      box-shadow: 0 0 0 3px rgba(50, 172, 193, 0.15);
    }
    /* Same treatment for the branch picker trigger so the focus ring is consistent. */
    .branch-picker .btn:focus-visible,
    .branch-picker .btn[aria-expanded="true"] {
      outline: none;
      border-color: #32acc1;
      box-shadow: 0 0 0 3px rgba(50, 172, 193, 0.15);
    }

    .branch-picker { position: relative; }
    .branch-menu {
      position: absolute; top: calc(100% + 4px); inset-inline-start: 0;
      min-width: 220px; max-height: 260px; overflow-y: auto;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
      box-shadow: 0 6px 20px rgba(15, 23, 42, .08);
      padding: 6px; z-index: 10;
    }
    .menu-item {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 8px; border-radius: 6px;
      font-size: 13px; color: #0f172a; cursor: pointer;
    }
    .menu-item:hover { background: #f8fafc; }
    .menu-item input { cursor: pointer; }
    .menu-empty { padding: 12px; font-size: 12px; color: #94a3b8; text-align: center; }
    .menu-divider { height: 1px; background: #e2e8f0; margin: 4px 0; }

    .card {
      background:#fff; border:1px solid #e2e8f0; border-radius:10px;
      overflow:hidden; margin-bottom: 12px;
    }
    .card:last-child { margin-bottom: 0; }
    .card-head {
      display:flex; align-items:center; justify-content:space-between; gap:16px;
      padding:10px 14px; background:#f8fafc; border-bottom:1px solid #e2e8f0;
      font-size:13px; font-weight:600; color:#0f172a;
    }
    .card-body { padding:0; }

    .pager { display:inline-flex; align-items:center; gap:8px; }
    .pager-num {
      padding:2px 10px; border-radius:999px;
      background:#e0f2f7; color:#0e7490;
      font-size:12px; font-weight:600; font-variant-numeric:tabular-nums;
    }
    .btn {
      padding:5px 10px; border-radius:6px;
      border:1px solid #e2e8f0; background:#fff;
      font-size:12px; font-weight:600; color:#475569;
      cursor:pointer; transition: background .12s, border-color .12s;
    }
    .btn:hover:not(:disabled) { background:#f8fafc; }
    .btn:disabled { opacity:.45; cursor:not-allowed; }
    .btn--primary { background:#32acc1; border-color:#32acc1; color:#fff; }
    .btn--primary:hover:not(:disabled) { background:#2890a3; border-color:#2890a3; }
    .btn--ghost { background:transparent; border-color:transparent; color:#64748b; }
    .btn--ghost:hover { background:#f1f5f9; }

    .tbl-wrap { width:100%; overflow-x:auto; }
    .tbl { width:100%; border-collapse:separate; border-spacing:0; font-size:13px; }
    .tbl thead th {
      background:#f8fafc; color:#64748b;
      font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.04em;
      padding:10px 14px; border-bottom:1px solid #e2e8f0; white-space:nowrap;
    }
    .tbl tbody td { padding:10px 14px; border-bottom:1px solid #f1f5f9; color:#0f172a; }
    .tbl tbody tr:last-child td { border-bottom:none; }
    .tbl tbody tr:hover { background:#f8fafc; }
    .start { text-align:start; }
    .end   { text-align:end; }
    .mono  { font-variant-numeric:tabular-nums; }
    .nowrap { white-space:nowrap; }

    .link { color:#0e7490; font-weight:500; text-decoration:none; }
    .link:hover { text-decoration:underline; }

    .empty {
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      gap:8px; padding:48px 20px; color:#94a3b8;
    }
    .empty svg { opacity:.5; }
    .empty p { margin:0; font-size:13px; }

    .row-skel { display:grid; grid-template-columns: repeat(7, 1fr); gap:10px; padding:14px; border-bottom:1px solid #f1f5f9; }
    .row-skel:last-child { border-bottom:none; }
    @keyframes skel-shimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
    .skeleton {
      height:12px;
      background: linear-gradient(90deg,#e2e8f0 0%,#f1f5f9 50%,#e2e8f0 100%);
      background-size:200% 100%;
      animation: skel-shimmer 1.4s ease-in-out infinite;
      border-radius:6px;
    }
    .w-10 { width:40%; }
    .w-15 { width:60%; }
    .w-20 { width:80%; }
  `],
})
export class ProductMovementComponent implements OnInit {
  @Input() productId: string | null = null;
  @Input() pageLimit = 15;

  private svc = inject(ProductsService);
  private visibility = inject(VisibleDirective);
  private branchSvc = inject(BranchConnectionService);
  private host = inject(ElementRef<HTMLElement>);

  hasLoaded = false;
  @HostBinding('class.loaded') get loadedClass() { return this.hasLoaded; }

  loading = signal(false);
  pageNum = signal(1);
  page    = signal<ProductMovementPage | null>(null);

  // ─── Chart config (populated when records load) ───────────────────
  chartSeries: any[] = [];
  chartOptions: any = {};
  chartXaxis: any = {};
  chartYaxis: any[] = [];
  chartTooltip: any = {};
  chartLegend: any = {};
  chartDataLabels: any = {};
  chartGrid: any = {};
  chartStroke: any = {};
  chartMarkers: any = {};
  chartColors: string[] = [];
  chartPlotOptions: any = {};

  /** Client-side branch filter applied to chart + metrics ('all' = no filter). */
  chartBranchFilter = signal<string>('all');

  /** Records sorted chronologically (oldest → newest). */
  private chronoRecords = computed<ProductMovementRow[]>(() => {
    const rows = this.page()?.records ?? [];
    return [...rows].sort((a, b) => {
      const ta = new Date(a.createdAt ?? 0).getTime();
      const tb = new Date(b.createdAt ?? 0).getTime();
      return ta - tb;
    });
  });

  /** Unique branch names present in the current page. */
  availableBranches = computed<string[]>(() => {
    const set = new Set<string>();
    for (const r of this.page()?.records ?? []) {
      if (r.branchName) set.add(r.branchName);
    }
    return Array.from(set).sort();
  });

  /** Records visible to the chart + metrics — filtered by `chartBranchFilter`. */
  private chartRecords = computed<ProductMovementRow[]>(() => {
    const filter = this.chartBranchFilter();
    const rows = this.chronoRecords();
    if (filter === 'all') return rows;
    return rows.filter(r => r.branchName === filter);
  });

  /** 4 KPI metrics — recomputed when filter or data changes. */
  metrics = computed(() => {
    const rows = this.chartRecords();
    if (!rows.length) {
      return { startBalance: 0, endBalance: 0, netMovement: 0, costImpact: 0 };
    }
    const startBalance = Number(rows[0].qtyBalance ?? 0);
    const endBalance   = Number(rows[rows.length - 1].qtyBalance ?? 0);
    const netMovement  = endBalance - startBalance;
    const costImpact   = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
    return { startBalance, endBalance, netMovement, costImpact };
  });

  trendOf(v: number): 'up' | 'down' | 'neutral' {
    if (!v) return 'neutral';
    return v > 0 ? 'up' : 'down';
  }


  // ─── Filters ──────────────────────────────────────────────────────
  dateRange = signal<DateRange | null>(this.defaultRange());
  selectedBranches = signal<string[]>([]);
  branchMenuOpen = signal(false);

  /**
   * Quick-pick presets shown in the date-picker sidebar. Each `range` is a
   * thunk so values like "Today" stay accurate every time the panel opens.
   */
  datePresets: DatePreset[] = [
    { label: 'Today',         range: () => this.preset(0, 0)                          },
    { label: 'Yesterday',     range: () => this.preset(-1, -1)                        },
    { label: 'Last 7 days',   range: () => this.preset(-6, 0)                         },
    { label: 'Last 30 days',  range: () => this.preset(-29, 0)                        },
    { label: 'This month',    range: () => this.presetMonth(0)                        },
    { label: 'Last month',    range: () => this.presetMonth(-1)                       },
    { label: 'This year',     range: () => this.presetYear(0)                         },
    { label: 'Year to date',  range: () => ({ start: this.startOfYear(), end: this.startOfDay(new Date()) }) },
  ];

  private startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private endOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  private startOfYear(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1);
  }

  /** Range relative to today, in whole days. `(0, 0)` = today; `(-6, 0)` = last 7 days. */
  private preset(startOffsetDays: number, endOffsetDays: number): DateRange {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() + startOffsetDays);
    const end   = new Date(now); end.setDate(now.getDate() + endOffsetDays);
    return { start: this.startOfDay(start), end: this.endOfDay(end) };
  }

  /** Whole-month range: `(0)` = this month, `(-1)` = last month. */
  private presetMonth(monthOffset: number): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
    return { start: this.startOfDay(start), end: this.endOfDay(end) };
  }

  /** Whole-year range: `(0)` = this year, `(-1)` = last year. */
  private presetYear(yearOffset: number): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear() + yearOffset, 0, 1);
    const end   = new Date(now.getFullYear() + yearOffset, 11, 31);
    return { start: this.startOfDay(start), end: this.endOfDay(end) };
  }

  branches = computed<BranchConnection[]>(() => this.branchSvc.branches());

  /** "All" mode = no explicit selection → every branch is implicitly included. */
  allBranchesMode = computed(() => this.selectedBranches().length === 0);

  branchLabel = computed(() => {
    const sel = this.selectedBranches();
    if (!sel.length) return 'All branches';
    if (sel.length === 1) {
      return this.branches().find(b => b.id === sel[0])?.name ?? '1 branch';
    }
    return `${sel.length} branches`;
  });

  hasActiveFilters = computed(() => {
    const r = this.dateRange();
    const def = this.defaultRange();
    const rangeChanged = !r || !r.start || !r.end ||
      r.start.getTime() !== def.start!.getTime() ||
      r.end.getTime()   !== def.end!.getTime();
    return rangeChanged || this.selectedBranches().length > 0;
  });

  ngOnInit(): void {
    if (!this.branchSvc.loaded()) void this.branchSvc.load();
    this.visibility.visible.subscribe(() => {
      if (!this.hasLoaded) this.load();
    });
  }

  // ─── Filter handlers ──────────────────────────────────────────────
  onDateRangeChange(v: DateRange | null): void {
    this.dateRange.set(v);
  }

  /** Chart-only branch filter (single-select). Doesn't trigger an API reload. */
  onChartBranchChange(v: string): void {
    this.chartBranchFilter.set(v || 'all');
    this.buildChart();
  }

  toggleBranchMenu(): void {
    this.branchMenuOpen.update(o => !o);
  }

  isBranchSelected(id: string): boolean {
    // In "All" mode every branch shows as checked, even though the underlying
    // selection list is empty (which the backend interprets as no filter).
    return this.allBranchesMode() || this.selectedBranches().includes(id);
  }

  toggleBranch(id: string): void {
    if (this.allBranchesMode()) {
      // Switching from "all" → explicit: keep every branch except the one
      // the user just unchecked.
      const explicit = this.branches().map(b => b.id).filter(x => x !== id);
      this.selectedBranches.set(explicit);
      return;
    }
    this.selectedBranches.update(arr => {
      const next = arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
      // If the explicit list now matches the full branch list, collapse back
      // to "all" mode so the master checkbox toggles on.
      const allIds = this.branches().map(b => b.id);
      if (next.length === allIds.length && allIds.every(x => next.includes(x))) {
        return [];
      }
      return next;
    });
  }

  /** Master "All branches" checkbox handler. */
  toggleAllBranches(): void {
    if (this.allBranchesMode()) {
      // Currently "all" — uncheck every branch (explicit empty selection).
      // We use a non-empty sentinel-free state by leaving the list empty AND
      // marking that the user cleared explicitly. To keep things simple, we
      // pick "no individual checked" by selecting all then immediately
      // signalling none — which we can't with `[]` (that's "all" too).
      // Practical compromise: leave it as "all" — clicking the already-checked
      // master is a no-op. Users uncheck individual branches to opt out.
      return;
    }
    // Returning from explicit selection back to "all" mode.
    this.selectedBranches.set([]);
  }

  applyFilters(): void {
    this.branchMenuOpen.set(false);
    this.pageNum.set(1);
    void this.load();
  }

  clearFilters(): void {
    this.dateRange.set(this.defaultRange());
    this.selectedBranches.set([]);
    this.branchMenuOpen.set(false);
    this.pageNum.set(1);
    void this.load();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.branchMenuOpen()) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.branchMenuOpen.set(false);
    }
  }

  // ─── Pagination ───────────────────────────────────────────────────
  async prev(): Promise<void> {
    if (this.pageNum() > 1) {
      this.pageNum.update(n => n - 1);
      await this.load();
    }
  }

  async next(): Promise<void> {
    const total = this.page()?.pageCount ?? 1;
    if (this.pageNum() < total) {
      this.pageNum.update(n => n + 1);
      await this.load();
    }
  }

  linkFor(row: ProductMovementRow): string | null {
    if (!row.transactionId || !row.type) return null;
    if (!LINKED_TYPES.includes(row.type)) return null;
    return getTransactionRoute(row.type, row.transactionId);
  }

  // ─── Data load ────────────────────────────────────────────────────
  private async load(): Promise<void> {
    if (!this.productId) return;
    this.loading.set(true);
    try {
      const r = this.dateRange();
      const def = this.defaultRange();
      const from = r?.start ?? def.start!;
      const to   = r?.end   ?? def.end!;

      const data = await this.svc.getProductMovement({
        route: 'productMovementReport',
        page: this.pageNum(),
        limit: this.pageLimit,
        filter: {
          productId: this.productId,
          fromDate: this.fmt(from),
          toDate:   this.fmt(to),
          branches: this.selectedBranches(),
        },
      });
      this.page.set(data);
      this.chartBranchFilter.set('all');
      this.buildChart();
    } catch (e) {
      console.error('[product-movement] load failed', e);
    } finally {
      this.loading.set(false);
      this.hasLoaded = true;
    }
  }

  private typeColor(type?: string): string {
    if (!type) return '#888780';
    const t = type.toLowerCase();
    if (t.includes('kit build')) return '#97C459';
    if (t.includes('kit break')) return '#E24B4A';
    if (t.includes('as of'))     return '#888780';
    return '#32acc1';
  }

  private buildChart(): void {
    const rows = this.chartRecords();
    if (!rows.length) {
      this.chartSeries = [];
      return;
    }

    const xLabels = rows.map(r => this.fmtAxisDate(r.createdAt));
    // Per-point bar data — `fillColor` overrides the series color per data point.
    const usageData = rows.map((r, i) => ({
      x: xLabels[i],
      y: Number(r.qtyUsage ?? 0),
      fillColor: this.typeColor(r.type),
    }));
    // Line uses {x, y} format too so both series share the same category axis.
    const balanceData = rows.map((r, i) => ({
      x: xLabels[i],
      y: Number(r.qtyBalance ?? 0),
    }));

    this.chartSeries = [
      { name: 'Qty Usage',   type: 'column', data: usageData },
      { name: 'Qty Balance', type: 'line',   data: balanceData },
    ];

    // Series-level colors — line uses the second entry; bars use per-point fillColor.
    this.chartColors = ['#32acc1', '#0e7490'];

    this.chartOptions = {
      height: 320,
      width: '100%',
      type: 'line',
      stacked: false,
      toolbar: {
        show: true,
        offsetY: 0,
        tools: { download: true, selection: false, zoom: true, zoomin: true, zoomout: true, pan: false, reset: true },
      },
      zoom: { enabled: true },
      fontFamily: 'Inter, sans-serif',
    };

    this.chartPlotOptions = {
      bar: { columnWidth: '55%', borderRadius: 3 },
    };

    this.chartStroke = { width: [0, 3], curve: 'smooth' };
    this.chartMarkers = { size: [0, 4], hover: { size: 6 } };

    this.chartXaxis = {
      type: 'category',
      labels: {
        rotate: -45,
        rotateAlways: true,
        trim: false,
        hideOverlappingLabels: false,
        maxHeight: 60,
        offsetY: 0,
        style: { fontSize: '11px', colors: '#64748b' },
      },
      axisBorder: { show: false },
      axisTicks: { show: true },
    };

    this.chartYaxis = [
      {
        seriesName: 'Qty Usage',
        title: { text: 'Qty Usage', style: { fontSize: '11px', color: '#64748b' } },
        labels: { style: { fontSize: '11px', colors: '#64748b' }, formatter: (v: number) => this.formatShort(v) },
      },
      {
        seriesName: 'Qty Balance',
        opposite: true,
        title: { text: 'Qty Balance', style: { fontSize: '11px', color: '#64748b' } },
        labels: { style: { fontSize: '11px', colors: '#64748b' }, formatter: (v: number) => this.formatShort(v) },
      },
    ];

    this.chartTooltip = { shared: true, intersect: false, y: { formatter: (v: number) => v?.toFixed(2) ?? '0' } };
    // Built-in legend hidden — we render a custom HTML legend above the chart.
    this.chartLegend = { show: false };
    this.chartDataLabels = { enabled: false };
    this.chartGrid = {
      borderColor: '#f1f5f9',
      row: { colors: ['#f8fafc', 'transparent'], opacity: 0.5 },
    };
  }

  private formatShort(v: number): string {
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(v) >= 1_000)     return (v / 1_000).toFixed(1) + 'K';
    return v.toFixed(0);
  }

  private fmtAxisDate(s?: string): string {
    if (!s) return '';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }

  private defaultRange(): DateRange {
    const end   = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return { start, end };
  }

  private fmt(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
}
