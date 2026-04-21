import { Component, HostBinding, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ProductsService, Last12MonthRow } from '../../../services/products.service';
import { VisibleDirective } from '../../../../../shared/directives/visible.directive';

/**
 * "Sales in last 12 months" — grouped bar (Sales / Returns) + net line overlay.
 * Uses ApexCharts for zoom, tooltips, responsive, RTL, and export.
 */
@Component({
  selector: 'app-sales-last-12-month',
  standalone: true,
  imports: [CommonModule, TranslateModule, NgApexchartsModule],
  hostDirectives: [VisibleDirective],
  template: `
    @if (loading() || !hasLoaded) {
      <div class="card">
        <div class="card-head">{{ 'PRODUCTS.SALES.LAST_12_MONTHS' | translate }}</div>
        <div class="card-body">
          <div class="chart-skeleton">
            @for (i of [1,2,3,4,5,6,7,8]; track i) {
              <div class="skeleton-bar" [style.--h]="(30 + i * 7) + '%'"></div>
            }
          </div>
        </div>
      </div>
    } @else if (points().length) {
      <div class="card">
        <div class="card-head">{{ 'PRODUCTS.SALES.LAST_12_MONTHS' | translate }}</div>
        <div class="card-body">
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
        </div>
      </div>
    } @else {
      <div class="card">
        <div class="card-head">{{ 'PRODUCTS.SALES.LAST_12_MONTHS' | translate }}</div>
        <div class="card-body">
          <div class="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M7 14l4-4 4 4 5-5"/>
            </svg>
            <p>{{ 'PRODUCTS.SALES.NO_LAST_12_MONTHS' | translate }}</p>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-height: 320px; }
    :host(.loaded) { min-height: 0; }
    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .card-head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px;
      padding: 10px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px; font-weight: 600; color: #0f172a;
    }
    .card-body { padding: 14px; }

    .empty {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 8px;
      padding: 48px 20px;
      color: #94a3b8;
    }
    .empty svg { opacity: .5; }
    .empty p { margin: 0; font-size: 13px; }

    /* Skeleton */
    .chart-skeleton {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 16px;
      height: 260px;
      padding: 20px 10px 10px;
      align-items: end;
    }
    @keyframes skel-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }
    .skeleton-bar {
      height: var(--h);
      background: linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%);
      background-size: 200% 100%;
      animation: skel-shimmer 1.4s ease-in-out infinite;
      border-radius: 4px 4px 0 0;
    }
  `],
})
export class SalesLast12MonthComponent implements OnInit {
  @Input() productId: string | null = null;

  private svc = inject(ProductsService);
  private visibility = inject(VisibleDirective);

  hasLoaded = false;
  @HostBinding('class.loaded') get loadedClass() { return this.hasLoaded; }
  loading = signal(false);
  points  = signal<Last12MonthRow[]>([]);

  // ─── Chart config (populated after data loads) ─────────────
  chartSeries: any[] = [];
  chartOptions: any = {};
  chartXaxis: any = {};
  chartYaxis: any = {};
  chartTooltip: any = {};
  chartLegend: any = {};
  chartDataLabels: any = {};
  chartGrid: any = {};
  chartStroke: any = {};
  chartMarkers: any = {};
  chartColors: string[] = [];
  chartPlotOptions: any = {};

  ngOnInit(): void {
    this.visibility.visible.subscribe(() => {
      if (!this.hasLoaded) this.load();
    });
  }

  private async load(): Promise<void> {
    if (!this.productId) return;
    this.loading.set(true);
    try {
      const rows = await this.svc.getProductLast12MonthSales(this.productId);
      // Hide the chart entirely if there's no data or all values are zero.
      const hasData = rows.length > 0 && rows.some(r =>
        (Number(r.sales_amount) || 0) !== 0 ||
        (Number(r.return_amount) || 0) !== 0 ||
        (Number(r.net_amount) || 0) !== 0
      );
      this.points.set(hasData ? rows : []);
      if (hasData) this.buildChart(rows);
    } catch (e) {
      console.error('[sales-last-12-month] load failed', e);
    } finally {
      this.loading.set(false);
      this.hasLoaded = true;
    }
  }

  private buildChart(rows: Last12MonthRow[]): void {
    const categories   = rows.map(r => r.month_label);
    const salesAmounts  = rows.map(r => Number(r.sales_amount)  || 0);
    const returnAmounts = rows.map(r => Number(r.return_amount) || 0);
    const netAmounts    = rows.map(r => Number(r.net_amount)    || 0);

    this.chartSeries = [
      { name: 'Sales',   data: salesAmounts,  type: 'column' },
      { name: 'Returns', data: returnAmounts, type: 'column' },
      { name: 'Net',     data: netAmounts,    type: 'line'   },
    ];

    this.chartColors = ['#32acc1', '#f59e0b', '#0f172a'];

    this.chartOptions = {
      height: 380,
      type: 'line',
      toolbar: {
        show: true,
        offsetY: -8,
        tools: {
          download: true,
          selection: false,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: false,
          reset: true,
        },
      },
      zoom: { enabled: true },
      fontFamily: 'Inter, sans-serif',
    };

    this.chartPlotOptions = {
      bar: {
        columnWidth: '55%',
        borderRadius: 3,
      },
    };

    this.chartStroke = {
      width: [0, 0, 3],
      curve: 'smooth',
    };

    this.chartMarkers = {
      size: [0, 0, 5],
      hover: { size: 7 },
    };

    this.chartXaxis = {
      categories,
      labels: {
        rotate: -45,
        style: { fontSize: '11px', colors: '#64748b' },
      },
    };

    this.chartYaxis = {
      labels: {
        style: { fontSize: '11px', colors: '#64748b' },
        formatter: (v: number) => this.formatShort(v),
      },
    };

    this.chartTooltip = {
      shared: true,
      intersect: false,
      y: {
        formatter: (v: number) => v?.toFixed(2) ?? '0',
      },
    };

    this.chartLegend = {
      position: 'top',
      horizontalAlign: 'left',
      fontSize: '12px',
      fontWeight: 500,
      labels: { colors: '#475569' },
      markers: {
        width: 10,
        height: 10,
        radius: 3,
        offsetX: -2,
      },
      itemMargin: {
        horizontal: 12,
        vertical: 4,
      },
    };

    this.chartDataLabels = { enabled: false };

    this.chartGrid = {
      borderColor: '#f1f5f9',
      row: {
        colors: ['#f8fafc', 'transparent'],
        opacity: 0.5,
      },
    };
  }

  private formatShort(v: number): string {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000)     return (v / 1_000).toFixed(1)     + 'K';
    return v.toFixed(0);
  }
}
