import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { DateRange, DatePreset, isCompleteRange } from '@shared/components/datepicker/date-picker.types';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';

import { SiteAnalyticsService } from '../../services/site-analytics.service';
import { SiteAnalytics, RealtimeAnalytics } from '../../services/site-analytics.types';

type TrafficMetric = 'users' | 'sessions' | 'pageviews';

/**
 * Store-wide analytics dashboard — GA4 traffic + e-commerce + realtime and
 * GSC search for the whole site. Each section renders real data when the
 * backend returns it, and a connect/empty state otherwise (so the page is
 * useful before GA4/GSC are configured).
 */
@Component({
  selector: 'app-site-analytics',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, DatePickerComponent, MycurrencyPipe, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-analytics.component.html',
  styleUrl: './site-analytics.component.scss',
})
export class SiteAnalyticsComponent implements OnInit {
  private svc        = inject(SiteAnalyticsService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  loading  = signal(false);
  report   = signal<SiteAnalytics | null>(null);
  realtime = signal<RealtimeAnalytics | null>(null);

  range = signal<DateRange>(this.lastNDays(30));
  trafficMetric = signal<TrafficMetric>('users');

  private i18nTick = signal(0);

  integrations = computed(() => this.report()?.integrations ?? { ga4Enabled: false, gscEnabled: false });
  traffic   = computed(() => this.report()?.traffic ?? null);
  ecommerce = computed(() => this.report()?.ecommerce ?? null);
  search    = computed(() => this.report()?.search ?? null);

  prevPeriodLabel = computed(() => {
    this.i18nTick();
    const r = this.range();
    if (!isCompleteRange(r)) return '';
    const ms = 86_400_000;
    const len = Math.round((this.dayStart(r.end).getTime() - this.dayStart(r.start).getTime()) / ms) + 1;
    const prevEnd = this.addDays(r.start, -1);
    const prevStart = this.addDays(prevEnd, -(len - 1));
    return `${this.fmt(prevStart)} - ${this.fmt(prevEnd)}`;
  });

  presets = computed<DatePreset[]>(() => {
    this.i18nTick();
    const t = (k: string) => this.translate.instant(k);
    const today = () => this.dayStart(new Date());
    return [
      { label: t('ANALYTICS.TODAY'),      range: () => ({ start: today(), end: today() }) },
      { label: t('ANALYTICS.YESTERDAY'),  range: () => { const y = this.addDays(today(), -1); return { start: y, end: y }; } },
      { label: t('ANALYTICS.LAST_7'),     range: () => this.lastNDays(7) },
      { label: t('ANALYTICS.LAST_14'),    range: () => this.lastNDays(14) },
      { label: t('ANALYTICS.LAST_30'),    range: () => this.lastNDays(30) },
      { label: t('ANALYTICS.LAST_90'),    range: () => this.lastNDays(90) },
      { label: t('ANALYTICS.THIS_MONTH'), range: () => { const n = new Date(); return { start: new Date(n.getFullYear(), n.getMonth(), 1), end: this.dayStart(n) }; } },
      { label: t('ANALYTICS.THIS_YEAR'),  range: () => { const n = new Date(); return { start: new Date(n.getFullYear(), 0, 1), end: this.dayStart(n) }; } },
    ];
  });

  constructor() {
    withTranslations('analytics');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    // Realtime auto-refresh every 30s.
    interval(30_000).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.loadRealtime());
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadReport(), this.loadRealtime()]);
  }

  private async loadReport(): Promise<void> {
    this.loading.set(true);
    try {
      const r = this.range();
      this.report.set(await this.svc.getSiteAnalytics({
        from: r.start ? this.isoDate(r.start) : undefined,
        to:   r.end   ? this.isoDate(r.end)   : undefined,
      }));
    } catch {
      this.report.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadRealtime(): Promise<void> {
    try {
      this.realtime.set(await this.svc.getRealtime());
    } catch {
      /* realtime is best-effort — leave the last value */
    }
  }

  onRange(r: DateRange | Date | null): void {
    if (r instanceof Date || r == null) return;
    if (isCompleteRange(r)) {
      this.range.set(r);
      void this.loadReport();
    }
  }

  setTrafficMetric(m: TrafficMetric): void { this.trafficMetric.set(m); }

  // ── Formatting ──────────────────────────────────────────────────────
  num(n: number | null | undefined): string { return (n ?? 0).toLocaleString(); }

  pct(value: number | null | undefined): string {
    const v = Number.isFinite(value as number) ? (value as number) : 0;
    const r = Math.round(v * 10) / 10;
    return `${Number.isInteger(r) ? r : r.toFixed(1)}%`;
  }

  /** Seconds → "1m 30s" / "45s". */
  duration(sec: number | null | undefined): string {
    const s = Math.max(0, Math.round(sec ?? 0));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60), r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
  }

  // ── Date helpers ────────────────────────────────────────────────────
  private dayStart(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  private addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  private lastNDays(n: number): DateRange { const end = this.dayStart(new Date()); return { start: this.addDays(end, -(n - 1)), end }; }
  private fmt(d: Date): string { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  private isoDate(d: Date): string { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  private fmtShort(iso: string): string { const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

  // ── Traffic trend chart ─────────────────────────────────────────────
  private readonly CHART_W = 640;
  private readonly CHART_H = 200;
  private readonly PAD_X = 8;
  private readonly PAD_TOP = 14;
  private readonly PAD_BOTTOM = 14;

  private chartSeries = computed(() => this.traffic()?.series ?? []);

  chartValues = computed<number[]>(() => {
    const s = this.chartSeries();
    const m = this.trafficMetric();
    return s.map(p => (m === 'sessions' ? p.sessions : m === 'pageviews' ? p.pageviews : p.users) ?? 0);
  });

  chartHasData = computed(() => this.chartValues().some(v => v > 0));
  chartMax = computed(() => Math.max(...this.chartValues(), 0));

  private chartPoints = computed(() => {
    const v = this.chartValues();
    const n = v.length;
    if (n === 0) return [] as { x: number; y: number }[];
    const max = Math.max(...v, 1);
    const innerW = this.CHART_W - this.PAD_X * 2;
    const innerH = this.CHART_H - this.PAD_TOP - this.PAD_BOTTOM;
    const dx = n > 1 ? innerW / (n - 1) : 0;
    return v.map((val, i) => ({
      x: this.PAD_X + (n > 1 ? dx * i : innerW / 2),
      y: this.PAD_TOP + innerH - (val / max) * innerH,
    }));
  });

  trendLine = computed(() => this.chartPoints().map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));

  trendArea = computed(() => {
    const pts = this.chartPoints();
    if (!pts.length) return '';
    const baseY = this.CHART_H - this.PAD_BOTTOM;
    const first = pts[0], last = pts[pts.length - 1];
    return `M${first.x.toFixed(1)},${baseY} `
      + pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
      + ` L${last.x.toFixed(1)},${baseY} Z`;
  });

  chartStartLabel = computed(() => { const s = this.chartSeries(); return s.length ? this.fmtShort(s[0].date) : ''; });
  chartEndLabel   = computed(() => { const s = this.chartSeries(); return s.length ? this.fmtShort(s[s.length - 1].date) : ''; });

  // ── Traffic sources (with %) ────────────────────────────────────────
  trafficSources = computed(() => {
    const src = this.traffic()?.sources ?? [];
    const total = src.reduce((s, x) => s + (x.sessions ?? 0), 0);
    return src.map(s => ({ ...s, pct: total > 0 ? (s.sessions / total) * 100 : 0 }));
  });

  // ── Realtime sparkline ──────────────────────────────────────────────
  realtimeBars = computed(() => {
    const pts = this.realtime()?.last30min ?? [];
    const max = Math.max(...pts.map(p => p.users), 1);
    return pts.map(p => ({ users: p.users, h: Math.max(2, Math.round((p.users / max) * 100)) }));
  });
}
