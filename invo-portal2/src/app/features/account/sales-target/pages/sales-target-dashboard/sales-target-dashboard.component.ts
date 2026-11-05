import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';

import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';

import { PeriodAnchor, SavedTarget, TargetDashboard } from '../../models/sales-target.model';
import { SalesTargetService } from '../../services/sales-target.service';
import { anchorOfTarget, fmtShort, periodPayload, targetMatches } from '../../services/sales-target-calc';
import { PeriodAnchorComponent } from '../../components/period-anchor/period-anchor.component';
import { SavedTargetPick, SavedTargetsDrawerComponent } from '../../components/saved-targets-drawer/saved-targets-drawer.component';
import { SetTargetData, SetTargetModalComponent, SetTargetResult } from '../../components/set-target-modal/set-target-modal.component';

const PRIMARY = '#2691a4';
const SLATE = '#94a3b8';
const AMBER = '#f59e0b';

/**
 * Sales Target dashboard (`/account/sales-target-dashboard`, legacy `DashboardComponent`): pick a month / quarter / year
 * and see its KPIs against the saved target - orders, total and net sales with achievement, forecast and the daily
 * rate needed - the progress and daily charts, and each branch's sales against its target. "Set Target" opens the
 * period / company / branch wizard; "Saved Targets" lists every stored target. The period shows the target saved for
 * it automatically; without one the same figures appear with a zero target.
 */
@Component({
  selector: 'app-sales-target-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule, NgApexchartsModule, BreadcrumbsComponent, PeriodAnchorComponent, MycurrencyPipe],
  providers: [MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-target-dashboard.component.html',
  styleUrl: './sales-target-dashboard.component.scss',
})
export class SalesTargetDashboardComponent implements OnInit {
  private service = inject(SalesTargetService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private lang = inject(LanguageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private currency = inject(MycurrencyPipe);

  breadcrumbs: BreadcrumbItem[] = [];

  anchor = signal<PeriodAnchor>(this.currentMonth());
  compare = signal(true);
  active = signal<SavedTarget | null>(null);
  data = signal<TargetDashboard | null>(null);
  loading = signal(false);
  failed = signal(false);
  private seq = 0;

  kpi = computed(() => this.data()?.kpi ?? null);
  money = (v: number) => this.currency.transform(v, { symbol: this.kpi()?.currency });

  subtitle = computed(() => {
    const d = this.data();
    if (!d) return '';
    return this.lang.instant('SALES_TARGET.SUBTITLE', {
      from: d.dateFrom, to: d.dateTo, day: d.dayIndex, days: d.periodDays,
      compare: this.lang.instant(this.compare() ? 'SALES_TARGET.ON' : 'SALES_TARGET.OFF'),
    });
  });

  // ── charts ──────────────────────────────────────────────────────────
  private common = { fontFamily: 'inherit', toolbar: { show: false } };
  private moneyAxis = { labels: { formatter: (v: number) => fmtShort(v) } };
  private tooltip = { y: { formatter: (v: number) => this.money(v) } };
  grid = { borderColor: '#f1f5f9', strokeDashArray: 4 };
  legend = { position: 'bottom' as const };
  noLabels = { enabled: false };

  barSeries = computed(() => {
    const d = this.data();
    if (!d) return [];
    const series: { name: string; data: number[] }[] = [{ name: this.lang.instant('SALES_TARGET.THIS_PERIOD'), data: d.progress.cur }];
    if (this.compare() && d.progress.prev) series.push({ name: this.lang.instant('SALES_TARGET.PREV_PERIOD'), data: d.progress.prev });
    return series;
  });
  barChart = computed(() => ({ type: 'bar' as const, height: 240, ...this.common }));
  barX = computed(() => ({ categories: ['SALES_TARGET.CURRENT', 'SALES_TARGET.FORECAST', 'SALES_TARGET.TARGET'].map(k => this.lang.instant(k)) }));
  barPlot = { bar: { borderRadius: 6, columnWidth: '55%' } };
  barColors = [PRIMARY, SLATE];

  lineSeries = computed(() => {
    const d = this.data()?.daily;
    if (!d || !d.labels.length) return [];
    return [
      { name: this.lang.instant('SALES_TARGET.ACTUAL'), data: d.actuals },
      { name: this.lang.instant('SALES_TARGET.REQUIRED_DAILY'), data: d.labels.map(() => d.requiredDaily) },
    ];
  });
  lineChart = computed(() => ({ type: 'line' as const, height: 240, ...this.common }));
  lineX = computed(() => ({ categories: this.data()?.daily.labels ?? [], tickAmount: 6 }));
  stroke = { curve: 'smooth' as const, width: [2.5, 2], dashArray: [0, 7] };
  lineColors = [PRIMARY, AMBER];
  yAxis = this.moneyAxis;
  tip = this.tooltip;

  ngOnInit(): void {
    this.breadcrumbs = [
      { label: this.lang.instant('SALES_TARGET.DASHBOARD'), routerLink: '/dashboard' },
      { label: this.lang.instant('SALES_TARGET.TITLE') },
    ];
    void this.init();
  }

  /** Opens the target named by `?target=` when there is one, otherwise the current month. */
  private async init(): Promise<void> {
    const id = this.route.snapshot.queryParamMap.get('target');
    if (id) {
      try {
        const res = await this.service.list({ page: 1, limit: 100 });
        const match = res.rows.find(t => t.id === id);
        if (match) { this.active.set(match); this.anchor.set(anchorOfTarget(match)); }
      } catch { /* falls back to the current month */ }
    }
    void this.load();
  }

  private currentMonth(): PeriodAnchor {
    const now = new Date();
    return { period: 'monthly', year: now.getFullYear(), month: now.getMonth() + 1, quarter: Math.floor(now.getMonth() / 3) + 1 };
  }

  private setActive(t: SavedTarget | null): void {
    this.active.set(t);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { target: t?.id ?? null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  // ── actions ─────────────────────────────────────────────────────────
  /** A new period was picked: show whatever target is saved for it. */
  onAnchor(a: PeriodAnchor): void {
    this.anchor.set(a);
    this.setActive(null);
    void this.load();
  }

  toggleCompare(): void {
    this.compare.update(v => !v);
    void this.load();
  }

  async load(): Promise<void> {
    const run = ++this.seq;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const a = this.anchor();
      let id = this.active()?.id ?? '';
      if (!id) {
        const res = await this.service.list({ page: 1, limit: 100 });
        const match = res.rows.find(t => targetMatches(t, a)) ?? null;
        if (run !== this.seq) return;
        this.setActive(match);
        id = match?.id ?? '';
      }
      const dash = await this.service.getDashboard(id, periodPayload(a), this.compare());
      if (run !== this.seq) return;
      this.data.set(dash);
    } catch (e: any) {
      if (run !== this.seq) return;
      this.failed.set(true);
      this.toast.error('COMMON.OPS', e?.message ?? this.lang.instant('SALES_TARGET.LOAD_FAILED'));
    } finally {
      if (run === this.seq) this.loading.set(false);
    }
  }

  async openSaved(): Promise<void> {
    const pick = await this.modal.open<SavedTargetsDrawerComponent, void, SavedTargetPick | null>(SavedTargetsDrawerComponent, {
      drawer: true, drawerWidth: '520px', drawerResizable: true,
    }).afterClosed();
    if (!pick) return;
    if (pick.action === 'edit') { this.setActive(pick.target); await this.openTargetModal(); return; }
    this.setActive(pick.target);
    this.anchor.set(anchorOfTarget(pick.target));
    void this.load();
  }

  async openTargetModal(): Promise<void> {
    const edit = this.active();
    const result = await this.modal.open<SetTargetModalComponent, SetTargetData, SetTargetResult | null>(SetTargetModalComponent, {
      size: 'xl', closeOnBackdrop: false, panelClass: 'invo-modal-panel--fit',
      data: { editTarget: edit, initial: edit ? anchorOfTarget(edit) : this.anchor() },
    }).afterClosed();
    if (!result) return;
    this.anchor.set(result.anchor);
    this.setActive(result.target);
    this.toast.success('SALES_TARGET.SAVED');
    void this.load();
  }

  // ── view helpers ────────────────────────────────────────────────────
  clamp(v: number | null, max = 120): number { return Math.max(0, Math.min(max, v ?? 0)); }
  pct(v: number | null): string { return v == null || !Number.isFinite(v) ? '—' : v.toFixed(1) + '%'; }
  chipText(d: number | null): string { return d == null || !Number.isFinite(d) ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(1)}%`; }
  chipClass(d: number | null): string { return d == null || !Number.isFinite(d) ? 'flat' : d > 0 ? 'up' : 'down'; }
  statusKey(s: string): string { return 'SALES_TARGET.STATUS.' + s; }
  statusClass(s: string): string { return 'st-status--' + s.toLowerCase(); }
  num(v: number): string { return Number(v ?? 0).toLocaleString(); }
}
