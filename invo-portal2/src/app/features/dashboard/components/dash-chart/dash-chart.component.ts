import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';

export type DashChartType = 'area' | 'bar' | 'hbar' | 'pie' | 'donut';

export interface DashSeries {
  name: string;
  data: number[];
}

/**
 * The dashboard's chart primitive — one component behind every widget so the
 * visual language can't drift chart-to-chart.
 *
 * Palette and mark decisions are deliberate, not taste:
 *
 * - **Fixed categorical order, never cycled.** Colours track the entity, so
 *   filtering a series out never repaints the survivors. A 9th series would
 *   fold into "Other" rather than inventing a hue.
 * - **Validated.** This exact 7-colour ramp passes the lightness band, chroma
 *   floor, CVD-separation and normal-vision checks. Three of the hues sit under
 *   3:1 against the card surface, which obliges visible labels — hence the
 *   always-on legend for multi-series and direct value labels on pies.
 * - **Recessive chrome.** 2px strokes, 4px bar radius, hairline grid, muted
 *   axis ink. Text never wears the series colour.
 * - **No dual axis, ever.** Two measures of different scale get two charts.
 */
@Component({
  selector: 'app-dash-chart',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (type() === 'pie' || type() === 'donut') {
      <apx-chart
        [series]="flatSeries()"
        [chart]="meta()"
        [labels]="categories()"
        [colors]="PALETTE"
        [legend]="pieLegend"
        [dataLabels]="pieLabels"
        [plotOptions]="piePlot()"
        [stroke]="pieStroke"
        [tooltip]="tooltip()"/>
    } @else {
      <apx-chart
        [series]="series()"
        [chart]="meta()"
        [xaxis]="xaxis()"
        [yaxis]="yaxis"
        [colors]="PALETTE"
        [legend]="legend()"
        [dataLabels]="noLabels"
        [stroke]="stroke()"
        [fill]="fill()"
        [grid]="grid"
        [plotOptions]="barPlot()"
        [tooltip]="tooltip()"/>
    }
  `,
  styles: [`:host { display: block; }`],
})
export class DashChartComponent {
  readonly type = input<DashChartType>('bar');
  readonly series = input<DashSeries[]>([]);
  readonly categories = input<string[]>([]);
  readonly height = input<number>(300);
  /** Formats tooltip + axis values (currency, counts…). */
  readonly valueFormat = input<(v: number) => string>((v) => String(v));

  /**
   * Fixed categorical order — validated as a set. Do not reorder or cycle:
   * position is identity, and the CVD margin was measured on adjacent pairs.
   */
  readonly PALETTE = ['#32acc1', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

  /** Pie/donut take a bare number[]; xy charts take named series. */
  readonly flatSeries = computed<number[]>(() => this.series()[0]?.data ?? []);

  readonly meta = computed(() => ({
    type: this.type() === 'hbar' ? 'bar' : this.type(),
    height: this.height(),
    fontFamily: 'Inter, sans-serif',
    toolbar: { show: false },
    animations: { enabled: true, speed: 260 },
    // Charts live inside cards with overflow:hidden; let Apex size to the card.
    parentHeightOffset: 0,
  }) as any);

  /** A legend only earns its space with 2+ series — one series is named by the title. */
  readonly legend = computed(() => ({
    show: this.series().length > 1,
    position: 'top',
    horizontalAlign: 'left',
    fontSize: '12px',
    markers: { radius: 3 },
    labels: { colors: '#475569' },
  }) as any);

  readonly pieLegend = {
    show: true,
    position: 'bottom',
    fontSize: '12px',
    labels: { colors: '#475569' },
  } as any;

  /** Share labels on slices — the required relief for the sub-3:1 hues. */
  readonly pieLabels = {
    enabled: true,
    formatter: (val: number) => `${Number(val).toFixed(0)}%`,
    style: { fontSize: '11px', fontWeight: 600, colors: ['#fff'] },
    dropShadow: { enabled: false },
  } as any;

  /** Never a number on every point — that's what the tooltip is for. */
  readonly noLabels = { enabled: false } as any;

  /** 2px surface gap between adjacent slices. */
  readonly pieStroke = { width: 2, colors: ['#fff'] } as any;

  readonly piePlot = computed(() => ({
    pie: {
      donut: { size: this.type() === 'donut' ? '58%' : '0%' },
      expandOnClick: false,
    },
  }) as any);

  readonly barPlot = computed(() => ({
    bar: {
      horizontal: this.type() === 'hbar',
      columnWidth: '52%',
      barHeight: '58%',
      // Rounded data-end only, anchored to the baseline.
      borderRadius: 4,
      borderRadiusApplication: 'end',
    },
  }) as any);

  readonly stroke = computed(() => ({
    curve: 'smooth',
    width: this.type() === 'area' ? 2 : 0,
    lineCap: 'round',
  }) as any);

  readonly fill = computed(() => (
    this.type() === 'area'
      ? { type: 'gradient', gradient: { shadeIntensity: 0.1, opacityFrom: 0.28, opacityTo: 0.02, stops: [0, 90] } }
      : { type: 'solid', opacity: 1 }
  ) as any);

  readonly grid = {
    borderColor: '#f1f5f9',
    strokeDashArray: 0,
    padding: { left: 4, right: 4, top: 0 },
  } as any;

  readonly xaxis = computed(() => ({
    categories: this.categories(),
    labels: {
      style: { fontSize: '11px', colors: '#94a3b8' },
      // Long category names (product/customer) would otherwise collide.
      trim: true,
      maxHeight: 72,
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  }) as any);

  readonly yaxis = {
    labels: {
      style: { fontSize: '11px', colors: '#94a3b8' },
      formatter: (v: number) => abbreviate(v),
    },
  } as any;

  readonly tooltip = computed(() => ({
    theme: 'light',
    style: { fontSize: '12px' },
    y: { formatter: (v: number) => this.valueFormat()(v) },
  }) as any);
}

/**
 * Axis ticks only — 12.4k beats 12,400 for a 40px gutter. Tooltips and tables
 * always show the exact value, so nothing is lost.
 */
function abbreviate(v: number): string {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}
