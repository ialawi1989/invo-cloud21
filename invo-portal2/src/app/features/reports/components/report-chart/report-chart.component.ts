import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';
import { LanguageService } from '@core/i18n/language.service';
import { ReportChartConfig } from '../../models/report.model';

/**
 * Thin ApexCharts wrapper driven by a report's `ReportChartConfig` + normalized
 * rows. Supports bar / line / area / donut. Brand-themed palette matching the
 * rest of the portal.
 */
@Component({
  selector: 'app-report-chart',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  template: `
    @if (hasData()) {
      <div class="rc-card">
        @if (config().type === 'donut') {
          <apx-chart
            [series]="donutSeries()"
            [chart]="chartMeta()"
            [labels]="labels()"
            [colors]="palette"
            [legend]="legend"
            [dataLabels]="donutDataLabels"
            [plotOptions]="donutPlot">
          </apx-chart>
        } @else {
          <apx-chart
            [series]="xySeries()"
            [chart]="chartMeta()"
            [xaxis]="xaxis()"
            [yaxis]="yaxis"
            [colors]="palette"
            [legend]="legend"
            [dataLabels]="dataLabels"
            [stroke]="stroke()"
            [fill]="fill()"
            [grid]="grid"
            [tooltip]="tooltip"
            [plotOptions]="barPlot">
          </apx-chart>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; margin-bottom: 16px; }
    .rc-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px 4px;
    }
  `],
})
export class ReportChartComponent {
  private lang = inject(LanguageService);

  config = input.required<ReportChartConfig>();
  rows = input<Record<string, any>[]>([]);

  readonly palette = ['#32acc1', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

  hasData = computed(() => {
    const cfg = this.config();
    const rows = this.rows();
    if (!rows.length) return false;
    return rows.some(r => cfg.series.some(s => (Number(r[s.key]) || 0) !== 0));
  });

  labels = computed(() => this.rows().map(r => String(r[this.config().labelKey] ?? '')));

  chartMeta = computed(() => ({
    type: this.config().type === 'bar' ? 'bar' : this.config().type,
    height: 300,
    fontFamily: 'Inter, sans-serif',
    toolbar: { show: false },
    animations: { enabled: true },
  }));

  xySeries = computed(() =>
    this.config().series.map(s => ({
      name: s.nameKey ? this.lang.instant(s.nameKey) : s.key,
      type: s.kind ?? (this.config().type === 'bar' ? 'column' : this.config().type),
      data: this.rows().map(r => Number(r[s.key]) || 0),
    })),
  );

  donutSeries = computed(() => {
    const key = this.config().series[0]?.key;
    return this.rows().map(r => Number(r[key]) || 0);
  });

  xaxis = computed(() => ({
    categories: this.labels(),
    labels: { rotate: -35, style: { fontSize: '11px', colors: '#64748b' } },
  }));

  stroke = computed(() => ({
    width: this.config().type === 'line' ? 3 : this.config().type === 'area' ? 2 : 0,
    curve: 'smooth' as const,
  }));

  fill = computed(() =>
    this.config().type === 'area'
      ? { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 } }
      : { opacity: 1 },
  );

  readonly yaxis = { labels: { style: { fontSize: '11px', colors: '#64748b' } } };
  readonly grid = { borderColor: '#f1f5f9' };
  readonly dataLabels = { enabled: false };
  readonly tooltip = { shared: true, intersect: false };
  readonly barPlot = { bar: { columnWidth: '55%', borderRadius: 4 } };
  readonly legend = { position: 'top' as const, horizontalAlign: 'left' as const, fontSize: '12px', labels: { colors: '#475569' } };
  readonly donutDataLabels = { enabled: true, formatter: (val: number) => `${val.toFixed(1)}%` };
  readonly donutPlot = { pie: { donut: { size: '65%' } } };
}
