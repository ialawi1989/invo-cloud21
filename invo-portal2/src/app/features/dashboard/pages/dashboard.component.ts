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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { AuthService } from '@core/auth/auth.service';
import { BranchConnectionService } from '@core/layout/services/branch.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import type { DatePreset, DateRange } from '@shared/components/datepicker/date-picker.types';
import { isCompleteRange } from '@shared/components/datepicker/date-picker.types';

import { ModalService } from '@shared/modal/modal.service';

import { DashboardService } from '../services/dashboard.service';
import {
  DashboardCustomizeModalComponent,
  CustomizeData,
  CustomizeResult,
} from '../components/customize-modal/customize-modal.component';
import { DashboardScope } from '../services/dashboard.types';
import { SeriesWidgetComponent, SeriesLoader } from '../widgets/series-widget.component';
import { BusinessSummaryWidgetComponent } from '../widgets/business-summary.component';
import { SummaryBlocksWidgetComponent } from '../widgets/summary-blocks.component';
import { IncomeExpenseWidgetComponent } from '../widgets/income-expense.component';
import { PaymentsFlowWidgetComponent } from '../widgets/payments-flow.component';
import { SalesByDayWidgetComponent } from '../widgets/sales-by-day.component';
import {
  LowStockWidgetComponent,
  ExpiringBatchesWidgetComponent,
} from '../widgets/inventory-widgets.component';
import {
  DEFAULT_LAYOUT, WIDGET_BY_SLUG, WidgetDef, WidgetView,
  customReportWidget, customReportId,
} from '../models/widget-registry';
import { CustomReportWidgetComponent } from '../widgets/custom-report-widget/custom-report-widget.component';
import { CustomReportsService } from '../../reports/custom/services/custom-reports.service';
import type { SavedModule } from '../../reports/custom/shared/models/custom-report.model';

interface BranchOption { id: string; name: string; }

/** A widget as placed on the grid. */
interface Placed {
  def: WidgetDef;
  colSpan: number;
  /** Form the user chose in the customizer; falls back to the widget default. */
  view?: WidgetView;
}

/** A row of placed widgets. Rows are explicit so a user's grouping survives
 *  adding or resizing a widget, which a flowing grid can't guarantee. */
interface PlacedRow {
  id: string;
  widgets: Placed[];
}

const LAYOUT_KEY = 'dashboard:layout';
const SCOPE_KEY  = 'dashboard:scope';

/**
 * Dashboard.
 *
 * Ported from the legacy dashboard, restructured around three ideas:
 *
 * 1. **One scope object.** Legacy threaded `from`, `to` and `currentBranch` into
 *    every widget as separate inputs, then each widget re-normalised the branch
 *    (string vs object) itself — eleven copies of the same three lines. Here the
 *    page owns a single `DashboardScope` and widgets take it whole.
 * 2. **A real date range.** Legacy offered 11 fixed presets and no custom range.
 *    This uses the shared range picker, so the presets remain but arbitrary
 *    windows are finally possible.
 * 3. **Widgets are data, not markup.** The grid renders from the registry, so
 *    adding a widget is a registry entry plus a loader — not another branch in a
 *    growing template switch.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    DatePickerComponent,
    SearchDropdownComponent,
    SkeletonComponent,
    SeriesWidgetComponent,
    BusinessSummaryWidgetComponent,
    SummaryBlocksWidgetComponent,
    IncomeExpenseWidgetComponent,
    PaymentsFlowWidgetComponent,
    SalesByDayWidgetComponent,
    LowStockWidgetComponent,
    ExpiringBatchesWidgetComponent,
    CustomReportWidgetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private service = inject(DashboardService);
  private modal = inject(ModalService);
  private branchService = inject(BranchConnectionService);
  private auth = inject(AuthService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private customReports = inject(CustomReportsService);

  private i18nTick = signal(0);

  // ─── scope ────────────────────────────────────────────────────────
  readonly range = signal<DateRange>(thisMonth());
  readonly branchId = signal<string | null>(null);

  readonly scope = computed<DashboardScope>(() => {
    const r = this.range();
    return {
      from: iso(r.start ?? new Date()),
      to:   iso(r.end ?? new Date()),
      branchId: this.branchId(),
    };
  });

  readonly greeting = computed(() => {
    this.i18nTick();
    const name = (this.auth.currentEmployee as any)?.name ?? '';
    return this.translate.instant('DASHBOARD.GREETING', { name });
  });

  /** Presets are thunks so "Today" stays correct across midnight. */
  readonly presets = computed<DatePreset[]>(() => {
    this.i18nTick();
    const t = (k: string) => this.translate.instant(k);
    return [
      { label: t('DASHBOARD.RANGE.TODAY'),          range: () => todayRange() },
      { label: t('DASHBOARD.RANGE.YESTERDAY'),      range: () => shiftDays(todayRange(), -1) },
      { label: t('DASHBOARD.RANGE.LAST_7'),         range: () => lastNDays(7) },
      { label: t('DASHBOARD.RANGE.LAST_30'),        range: () => lastNDays(30) },
      { label: t('DASHBOARD.RANGE.THIS_MONTH'),     range: () => thisMonth() },
      { label: t('DASHBOARD.RANGE.PREVIOUS_MONTH'), range: () => previousMonth() },
      { label: t('DASHBOARD.RANGE.THIS_YEAR'),      range: () => thisYear() },
    ];
  });

  readonly branchOptions = computed<BranchOption[]>(() => {
    this.i18nTick();
    return [
      { id: '', name: this.translate.instant('DASHBOARD.ALL_BRANCHES') },
      ...this.branchService.branches().map((b) => ({ id: String((b as any)?.id ?? ''), name: String((b as any)?.name ?? '') })),
    ].filter((b) => b.id !== '' || true);
  });

  readonly selectedBranch = computed<BranchOption | null>(
    () => this.branchOptions().find((b) => b.id === (this.branchId() ?? '')) ?? null,
  );

  branchDisplay = (b: BranchOption) => b?.name ?? '';
  branchCompare = (a: BranchOption, b: BranchOption) => a?.id === b?.id;

  // ─── layout ───────────────────────────────────────────────────────
  readonly rows = signal<PlacedRow[]>([]);

  /**
   * Saved custom reports (the report builder's modules), offered as dashboard
   * widgets. Loaded once from `getModules` in ngOnInit; the title is the user's
   * report name (a plain string, not an i18n key).
   */
  readonly customWidgets = signal<WidgetDef[]>([]);

  private readonly customBySlug = computed(
    () => new Map(this.customWidgets().map((w) => [w.slug, w])));

  /** Static catalogue plus the runtime custom reports. */
  private defOf(slug: string): WidgetDef | undefined {
    return WIDGET_BY_SLUG.get(slug) ?? this.customBySlug().get(slug);
  }

  /** A custom-report slug is renderable when its report is still in the catalog. */
  isCustomReport(slug: string): boolean { return customReportId(slug) !== null; }
  reportIdFor(slug: string): string { return customReportId(slug) ?? ''; }

  /** Loaders live here so a widget stays a pure presentation component. */
  readonly loaders: Record<string, SeriesLoader> = {
    'top-10-item-by-sales':           (s) => this.service.topItems(s),
    'top-customers':       (s) => this.service.topCustomers(s),
    'sales-by-category':   (s) => this.service.salesByCategory(s),
    'sales-by-departments': (s) => this.service.salesByDepartment(s),
    'top-brand-by-sales':      (s) => this.service.salesByBrand(s),
    'sales-by-service':    (s) => this.service.salesByService(s),
    'sales-by-source':     (s) => this.service.salesBySource(s),
    'sales-by-employee':   (s) => this.service.salesByEmployee(s),
    'sales-by-time':       (s) => this.service.salesByTime(s),
    'payment-method-overview':     (s) => this.service.paymentMethods(s),
    'online-invoices':     (s) => this.service.onlineInvoices(s),
  };

  /**
   * The form a placed widget renders as: the user's choice if they made one,
   * else the widget's declared default, else the chart type for its data shape.
   */
  viewFor(item: Placed): WidgetView {
    return item.view ?? item.def.defaultView ?? this.chartFor[item.def.slug] ?? 'bar';
  }

  /** Table is a view, not a chart type — the chart input keeps a real fallback. */
  chartTypeFor(item: Placed): 'bar' | 'hbar' | 'area' | 'pie' | 'donut' {
    const v = this.viewFor(item);
    return v === 'table' ? (this.chartFor[item.def.slug] ?? 'bar') : v;
  }

  isTableView(item: Placed): boolean { return this.viewFor(item) === 'table'; }

  /** Chart form per widget — magnitude→bar, part-of-whole→donut, ranked→hbar. */
  readonly chartFor: Record<string, 'bar' | 'hbar' | 'donut' | 'pie'> = {
    'top-10-item-by-sales':           'hbar',
    'top-customers':       'hbar',
    'sales-by-category':   'hbar',
    'sales-by-departments': 'hbar',
    'top-brand-by-sales':      'donut',
    'sales-by-service':    'donut',
    'sales-by-source':     'donut',
    'sales-by-employee':   'hbar',
    'sales-by-time':       'bar',
    'payment-method-overview':     'bar',
    'online-invoices':     'bar',
  };

  /** Counts, not money. */
  readonly countWidgets = new Set(['online-invoices']);

  /** Slugs with a bespoke layout — everything else renders as a series widget. */
  readonly BESPOKE = new Set([
    'business-summary', 'summary-blocks', 'expense-income',
    'payments-flow', 'sales-by-day', 'low-quantity-products', 'expiry-date-products',
  ]);
  isBespoke(slug: string) { return this.BESPOKE.has(slug); }

  constructor() {
    withTranslations('dashboard', 'reports');
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  ngOnInit(): void {
    this.restoreScope();
    // Show something immediately from the local copy, then reconcile with the
    // server. Without the local paint the board is blank for a round-trip; and
    // without the server fetch a layout saved elsewhere never arrives.
    this.restoreLayout();
    this.loadCustomReports();

    this.service.loadLayout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          if (!saved.length) return;               // never saved — keep the default
          // The wire format is flat with a `rowId` per widget; rebuild the rows
          // from it, preserving the order the service already sorted into.
          // The `view` field is newer than the endpoint. If the server hasn't
          // stored it, keep whatever this device last chose rather than silently
          // reverting the widget to its default form.
          const localViews = this.savedViews();

          const byRow = new Map<string, { slug: string; colSpan: number; view?: WidgetView }[]>();
          saved.forEach((w) => {
            const key = w.rowId || `row_${w.slug}`;   // orphans get their own row
            const list = byRow.get(key) ?? [];
            list.push({
              slug: w.slug,
              colSpan: w.colSpan,
              view: (w.view as WidgetView) ?? localViews.get(w.slug),
            });
            byRow.set(key, list);
          });
          const rows = [...byRow].map(([id, widgets]) => ({ id, widgets }));
          this.applyLayout(rows);
          localStorage.setItem(LAYOUT_KEY, JSON.stringify(rows));
        },
        // Offline or a failing endpoint must not blank the dashboard.
        error: () => { /* local layout stands */ },
      });
  }

  // ─── scope handlers ───────────────────────────────────────────────
  onRange(r: DateRange | Date | null): void {
    if (r instanceof Date || r == null) return;
    if (!isCompleteRange(r)) return;
    this.range.set(r);
    this.persistScope();
  }

  onBranch(v: BranchOption | BranchOption[] | null): void {
    const picked = Array.isArray(v) ? v[0] ?? null : v;
    this.branchId.set(picked?.id ? picked.id : null);
    this.persistScope();
  }

  private persistScope(): void {
    const r = this.range();
    localStorage.setItem(SCOPE_KEY, JSON.stringify({
      from: iso(r.start ?? new Date()),
      to:   iso(r.end ?? new Date()),
      branchId: this.branchId(),
    }));
  }

  private restoreScope(): void {
    try {
      const raw = localStorage.getItem(SCOPE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s?.from && s?.to) {
        this.range.set({ start: new Date(s.from), end: new Date(s.to) });
      }
      this.branchId.set(s?.branchId ?? null);
    } catch {
      // A corrupt saved scope must never block the page — fall back to defaults.
    }
  }

  /**
   * The widget's own chart⇄table toggle is the same preference the customizer
   * sets, so it persists the same way — otherwise flipping to the table view
   * would silently revert on the next visit.
   */
  onViewChange(item: Placed, mode: 'chart' | 'table'): void {
    const view: WidgetView = mode === 'table' ? 'table' : this.chartTypeFor(item);
    this.rows.update((rows) =>
      rows.map((r) => ({
        ...r,
        widgets: r.widgets.map((w) => (w.def.slug === item.def.slug ? { ...w, view } : w)),
      })));
    this.persistLayout();
  }

  /** Writes the current layout locally, then syncs it. */
  private persistLayout(): void {
    const rows = this.rows().map((r) => ({
      id: r.id,
      widgets: r.widgets.map((w) => ({ slug: w.def.slug, colSpan: w.colSpan, view: w.view })),
    }));
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(rows));

    this.service
      .saveLayout({
        rows: rows.map((r) => ({
          id: r.id,
          widgets: r.widgets.map((w, i) => ({ ...w, rowId: r.id, order: i })),
        })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => { /* local choice stands; server catches up */ } });
  }

  /** slug → chosen form, from the last layout saved on this device. */
  private savedViews(): Map<string, WidgetView> {
    const views = new Map<string, WidgetView>();
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) return views;
      for (const row of JSON.parse(raw) ?? []) {
        for (const w of row?.widgets ?? []) {
          if (w?.slug && w?.view) views.set(w.slug, w.view);
        }
      }
    } catch { /* a corrupt layout just means no remembered views */ }
    return views;
  }

  /** Saved report modules → custom widgets available in the Customize picker. */
  private loadCustomReports(): void {
    from(this.customReports.getModules())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (modules: SavedModule[]) => {
          this.customWidgets.set(
            (modules ?? [])
              .filter((m) => m?.id)
              .map((m) => customReportWidget(String(m.id), m.name || 'Custom report')),
          );
          // A layout restored before the modules arrived may have skipped a
          // custom widget as "unsupported" — re-apply now that they're known.
          this.reapplyLayout();
        },
        error: () => { /* no saved reports, or offline — board still works */ },
      });
  }

  /** Re-run the layout from storage once modules are known, so a custom widget
   *  that was skipped as "unsupported" before its module loaded now appears. */
  private reapplyLayout(): void {
    this.restoreLayout();
  }

  // ─── layout ───────────────────────────────────────────────────────
  private restoreLayout(): void {
    let rows = DEFAULT_LAYOUT;
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Layouts saved before the row model was introduced are a flat widget
        // list — wrap each one in its own row instead of discarding the layout.
        if (Array.isArray(parsed) && parsed.length) {
          rows = parsed[0]?.widgets
            ? parsed
            : parsed.map((w: { slug: string; colSpan: number }) => ({
                id: `row_${w.slug}`, widgets: [w],
              }));
        }
      }
    } catch { /* fall back to the default layout */ }

    this.applyLayout(rows);
  }

  /**
   * Customize. The chosen layout is written locally straight away so the board
   * updates instantly, then pushed to the server so it follows the employee to
   * another device. A failed sync doesn't roll back the local change — the user
   * asked for this arrangement, and losing it because a request failed would be
   * worse than a layout that syncs late.
   */
  async openCustomize(): Promise<void> {
    const customs = this.customWidgets();
    const supported = [
      ...Object.keys(this.loaders), ...this.BESPOKE, ...customs.map((w) => w.slug),
    ];
    const ref = this.modal.open<DashboardCustomizeModalComponent, CustomizeData, CustomizeResult>(
      DashboardCustomizeModalComponent,
      {
        // xl (1100px, tall) — the two panels each need room for a name plus a
        // six-button width control; anything narrower collapses the name away.
        size: 'xl',
        data: {
          rows: this.rows().map((r) => ({
            id: r.id,
            widgets: r.widgets.map((w) => ({ slug: w.def.slug, colSpan: w.colSpan, view: w.view })),
          })),
          supported,
          extraWidgets: customs,
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;

    this.applyLayout(result.rows);
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(result.rows));

    this.service
      .saveLayout({
        rows: result.rows.map((r) => ({
          id: r.id,
          widgets: r.widgets.map((w, i) => ({ ...w, rowId: r.id, order: i })),
        })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => { /* local layout stands; server catches up next time */ } });
  }

  private applyLayout(rows: { id: string; widgets: { slug: string; colSpan: number; view?: WidgetView }[] }[]): void {
    this.rows.set(
      rows
        .map((r) => ({
          id: r.id,
          widgets: r.widgets
            .map((w): Placed | null => {
              const def = this.defOf(w.slug);
              // Skip slugs we can't render rather than leaving a hole. Custom
              // reports are supported whenever the report is still in the catalog.
              const supported = def && (
                this.loaders[def.slug] || this.BESPOKE.has(def.slug) || this.isCustomReport(def.slug));
              return supported ? { def: def!, colSpan: w.colSpan ?? def!.defaultSpan, view: w.view } : null;
            })
            .filter((w): w is Placed => w !== null),
        }))
        .filter((r) => r.widgets.length > 0),
    );
  }

  loaderFor(slug: string) { return this.loaders[slug]; }
  isMoney(slug: string) { return !this.countWidgets.has(slug); }
}

// ─── date helpers ───────────────────────────────────────────────────
// Local-time throughout: toISOString() would shift the day for anyone east or
// west of UTC, which is exactly the class of bug that makes "Today" show
// yesterday's numbers.
function iso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dayStart(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function todayRange(): DateRange { const t = dayStart(new Date()); return { start: t, end: t }; }
function shiftDays(r: DateRange, n: number): DateRange {
  const s = new Date(r.start!); s.setDate(s.getDate() + n);
  const e = new Date(r.end!);   e.setDate(e.getDate() + n);
  return { start: s, end: e };
}
function lastNDays(n: number): DateRange {
  const end = dayStart(new Date());
  const start = new Date(end); start.setDate(start.getDate() - (n - 1));
  return { start, end };
}
function thisMonth(): DateRange {
  const now = new Date();
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: dayStart(now) };
}
function previousMonth(): DateRange {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    end:   new Date(now.getFullYear(), now.getMonth(), 0),
  };
}
function thisYear(): DateRange {
  const now = new Date();
  return { start: new Date(now.getFullYear(), 0, 1), end: dayStart(now) };
}
