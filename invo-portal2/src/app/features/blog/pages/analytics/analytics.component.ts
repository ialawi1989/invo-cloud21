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

import { withTranslations } from '@core/i18n/with-translations';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { DateRange, DatePreset, isCompleteRange } from '@shared/components/datepicker/date-picker.types';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { BLOG_API } from '../../services/blog-api';
import { BlogReport, BlogReportPost } from '../../services/blog.types';

type MetricTab = 'views' | 'visitors' | 'engagement';

/** Left-rail metric a post list can be broken down by. */
type PostsByKey = 'publishDate' | 'views' | 'clicks' | 'readingTime' | 'engagement';

/**
 * Blog Analytics dashboard. Summary tiles + "Posts by views" are wired to
 * the real `blog/getReport`; the time-series chart, time-of-day heatmap,
 * traffic sources and Google Search Console are placeholders until the
 * backend exposes those metrics (BlogPostVisits table, GSC integration).
 */
@Component({
  selector: 'app-blog-analytics',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, DatePickerComponent, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
})
export class AnalyticsComponent implements OnInit {
  private api        = inject(BLOG_API);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  report  = signal<BlogReport | null>(null);
  metric  = signal<MetricTab>('views');

  /** Selected analytics date range (defaults to the last 30 days). */
  range = signal<DateRange>(this.lastNDays(30));

  private i18nTick = signal(0);

  totals    = computed(() => this.report()?.totals ?? null);
  topPosts  = computed(() => this.report()?.topPosts ?? []);

  /** Engagement headline = comments + likes. */
  engagementTotal = computed(() => (this.totals()?.totalComments ?? 0) + (this.totals()?.totalLikes ?? 0));

  // ── "Posts by …" panel ──────────────────────────────────────────────
  /** Selected left-rail metric. */
  postsBy = signal<PostsByKey>('publishDate');

  /** Left-rail items (icon + i18n label). */
  postsByTabs: { key: PostsByKey; labelKey: string }[] = [
    { key: 'publishDate', labelKey: 'BLOG.ANALYTICS.PB_PUBLISH_DATE' },
    { key: 'views',       labelKey: 'BLOG.ANALYTICS.PB_VIEWS' },
    { key: 'clicks',      labelKey: 'BLOG.ANALYTICS.PB_CLICKS' },
    { key: 'readingTime', labelKey: 'BLOG.ANALYTICS.PB_READING_TIME' },
    { key: 'engagement',  labelKey: 'BLOG.ANALYTICS.PB_ENGAGEMENT' },
  ];

  /** Rows for the active metric, sorted by that metric (desc). */
  postsByRows = computed<BlogReportPost[]>(() => {
    const posts = this.topPosts();
    switch (this.postsBy()) {
      case 'publishDate':
        return [...posts].sort((a, b) => this.dateMs(b.publishDate) - this.dateMs(a.publishDate));
      case 'views':
        return [...posts].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
      case 'engagement':
        return [...posts].sort((a, b) => this.engagementOf(b) - this.engagementOf(a));
      case 'readingTime':
        return [...posts].sort((a, b) => (b.avgReadTime ?? 0) - (a.avgReadTime ?? 0));
      default:
        return posts;
    }
  });

  /** Whether the active metric has any non-zero data to show a table for. */
  postsByHasData = computed<boolean>(() => {
    const rows = this.postsByRows();
    if (rows.length === 0) return false;
    switch (this.postsBy()) {
      case 'publishDate': return true; // any post with a publish date is enough
      case 'views':       return rows.some(p => (p.views ?? 0) > 0);
      case 'readingTime': return rows.some(p => (p.avgReadTime ?? 0) > 0);
      case 'engagement':  return rows.some(p => this.engagementOf(p) > 0);
      default:            return false;
    }
  });

  engagementOf(p: BlogReportPost): number { return (p.comments ?? 0) + (p.likes ?? 0); }
  private dateMs(iso?: string): number { return iso ? new Date(iso).getTime() : 0; }

  /** "0s" / "1m 30s" formatting for read time. */
  readTime(sec?: number): string {
    const s = Math.max(0, Math.round(sec ?? 0));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
  }

  setPostsBy(k: PostsByKey): void { this.postsBy.set(k); }

  // ── Traffic sources ─────────────────────────────────────────────────
  /** Per-post filter for the traffic panel ('' = all posts). */
  trafficPost = signal<string>('');

  /** "All posts" + each reported post — options for the traffic dropdown. */
  trafficPostOptions = computed(() => {
    this.i18nTick();
    return [
      { value: '', label: this.translate.instant('BLOG.ANALYTICS.ALL_POSTS') },
      ...this.topPosts().map(p => ({ value: p.id, label: p.title || '(untitled)' })),
    ];
  });

  /** GSC search performance for the period (null until GSC configured). */
  search = computed(() => this.report()?.search ?? null);
  /** Which Google integrations are live. */
  integrations = computed(() => this.report()?.integrations ?? { ga4Enabled: false, gscEnabled: false });

  /** Traffic sources with sessions + share-of-total. Uses the GA4 breakdown
   *  when present; otherwise the canonical 5 sources at 0. Share is computed
   *  safely so it never renders "NaN%". */
  trafficSources = computed(() => {
    this.i18nTick();
    const fromApi = this.report()?.traffic;
    const sources = (fromApi && fromApi.length)
      ? fromApi.map(t => ({ label: t.source, sessions: t.sessions ?? 0 }))
      : [
          { label: 'Direct',           sessions: 0 },
          { label: 'Google (Organic)', sessions: 0 },
          { label: 'Email',            sessions: 0 },
          { label: 'Google (Paid)',    sessions: 0 },
          { label: 'Facebook',         sessions: 0 },
        ];
    const total = sources.reduce((s, x) => s + x.sessions, 0);
    return sources.map(s => ({
      ...s,
      pct: total > 0 ? (s.sessions / total) * 100 : 0,
    }));
  });

  /** Thousands-separated integer (e.g. 12,345). */
  num(n: number | null | undefined): string {
    return (n ?? 0).toLocaleString();
  }

  /** Safe percentage string (never NaN); 1 decimal unless whole. */
  pct(value: number | null | undefined): string {
    const v = Number.isFinite(value as number) ? (value as number) : 0;
    const rounded = Math.round(v * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
  }

  onTrafficPost(id: string): void { this.trafficPost.set(id ?? ''); }

  // app-search-dropdown adapters for the {value,label} option shape
  trafficLabel   = (o: { value: string; label: string }) => o.label;
  trafficValue   = (o: { value: string; label: string }) => o.value;
  trafficCompare = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);

  /** "compared to previous period (… – …)" — the equal-length window
   *  immediately before the selected range. */
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

  /** Quick-pick presets shown in the date-picker panel. */
  presets = computed<DatePreset[]>(() => {
    this.i18nTick();
    const t = (k: string) => this.translate.instant(k);
    const today = () => this.dayStart(new Date());
    return [
      { label: t('BLOG.ANALYTICS.TODAY'),      range: () => ({ start: today(), end: today() }) },
      { label: t('BLOG.ANALYTICS.YESTERDAY'),  range: () => { const y = this.addDays(today(), -1); return { start: y, end: y }; } },
      { label: t('BLOG.ANALYTICS.LAST_7'),     range: () => this.lastNDays(7) },
      { label: t('BLOG.ANALYTICS.LAST_14'),    range: () => this.lastNDays(14) },
      { label: t('BLOG.ANALYTICS.LAST_30'),    range: () => this.lastNDays(30) },
      { label: t('BLOG.ANALYTICS.LAST_90'),    range: () => this.lastNDays(90) },
      { label: t('BLOG.ANALYTICS.LAST_365'),   range: () => this.lastNDays(365) },
      { label: t('BLOG.ANALYTICS.THIS_MONTH'), range: () => { const n = new Date(); return { start: new Date(n.getFullYear(), n.getMonth(), 1), end: this.dayStart(n) }; } },
      { label: t('BLOG.ANALYTICS.THIS_YEAR'),  range: () => { const n = new Date(); return { start: new Date(n.getFullYear(), 0, 1), end: this.dayStart(n) }; } },
    ];
  });

  constructor() {
    withTranslations('blog');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  // ── Date helpers ────────────────────────────────────────────────────
  private dayStart(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  private addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  private lastNDays(n: number): DateRange { const end = this.dayStart(new Date()); return { start: this.addDays(end, -(n - 1)), end }; }
  private fmt(d: Date): string { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }

  /** Apply a new range. (Backend getReport has no date params yet, so this
   *  updates the displayed range + comparison; data refreshes when the
   *  backend supports a date-filtered report.) */
  onRange(r: DateRange | Date | null): void {
    if (r instanceof Date || r == null) return;
    if (isCompleteRange(r)) {
      this.range.set(r);
      void this.loadReport();
    }
  }

  async ngOnInit(): Promise<void> {
    await this.loadReport();
  }

  /** Load the report for the currently selected range. */
  private async loadReport(): Promise<void> {
    this.loading.set(true);
    try {
      const r = this.range();
      this.report.set(await this.api.getReport({
        from: r.start ? this.isoDate(r.start) : undefined,
        to:   r.end   ? this.isoDate(r.end)   : undefined,
      }));
    } catch {
      this.report.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  /** YYYY-MM-DD in local time (avoids the UTC shift of toISOString). */
  private isoDate(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  setMetric(m: MetricTab): void { this.metric.set(m); }

  // ── Trend chart ─────────────────────────────────────────────────────
  private readonly CHART_W = 640;
  private readonly CHART_H = 200;
  private readonly PAD_X = 8;
  private readonly PAD_TOP = 14;
  private readonly PAD_BOTTOM = 14;

  chartSeries = computed(() => this.report()?.series ?? []);

  /** Daily values for the active metric (engagement has no daily series). */
  chartValues = computed<number[]>(() => {
    const s = this.chartSeries();
    if (this.metric() === 'visitors') return s.map(p => p.visitors ?? 0);
    if (this.metric() === 'engagement') return [];
    return s.map(p => p.views ?? 0);
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

  trendLine = computed(() => {
    const pts = this.chartPoints();
    return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  });

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

  private fmtShort(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // ── Time-of-day heatmap ─────────────────────────────────────────────
  hourlyCells = computed(() => this.report()?.hourly ?? []);
  hourlyHasData = computed(() => this.hourlyCells().some(c => c.views > 0));

  /** 7×24 grid of normalized intensities (0..1). Row 0 = Sunday. */
  heatGrid = computed<number[][]>(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    for (const c of this.hourlyCells()) {
      if (c.weekday >= 0 && c.weekday < 7 && c.hour >= 0 && c.hour < 24) {
        grid[c.weekday][c.hour] = c.views;
        if (c.views > max) max = c.views;
      }
    }
    return grid.map(row => row.map(v => (max ? v / max : 0)));
  });

  /** Localized short weekday names (Sun…Sat) for the heatmap rows. */
  weekdayLabels = computed<string[]>(() => {
    this.i18nTick();
    const fmt = new Intl.DateTimeFormat(this.translate.currentLang || undefined, { weekday: 'short' });
    // 2024-01-07 is a Sunday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 7 + i)));
  });

  /** Hour ruler ticks shown under the heatmap. */
  readonly heatHourTicks = [0, 6, 12, 18];

  /** Heat cell background — teal ramp by intensity. */
  heatColor(intensity: number): string {
    if (intensity <= 0) return '#f1f5f9';
    // 0→light teal, 1→brand teal.
    const alpha = 0.12 + intensity * 0.88;
    return `rgba(0, 170, 179, ${alpha.toFixed(3)})`;
  }
}
