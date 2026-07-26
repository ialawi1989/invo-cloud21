import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService, hasPrivilegeAccess } from '@core/auth/privileges/privilege.service';
import { EmployeePrivilege } from '@core/auth/privileges/models/privilege.model';
import { ToastService } from '@shared/components/toast/toast.service';
import { BranchConnectionService } from '@core/layout/services/branch.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';
import type { DateRange } from '@shared/components/datepicker/date-picker.types';
import { isCompleteRange } from '@shared/components/datepicker/date-picker.types';

import { ModalService } from '@shared/modal/modal.service';

import { DashboardService } from '../services/dashboard.service';
import {
  DashboardCustomizeModalComponent,
  CustomizeData,
  CustomizeResult,
} from '../components/customize-modal/customize-modal.component';
import { DashboardScope } from '../services/dashboard.types';
import { SeriesWidgetComponent, SeriesLoader } from '../widgets/series-widget/series-widget.component';
import { BusinessSummaryWidgetComponent } from '../widgets/business-summary/business-summary.component';
import { SummaryBlocksWidgetComponent } from '../widgets/summary-blocks/summary-blocks.component';
import { IncomeExpenseWidgetComponent } from '../widgets/income-expense/income-expense.component';
import { PaymentsFlowWidgetComponent } from '../widgets/payments-flow/payments-flow.component';
import { SalesByDayWidgetComponent } from '../widgets/sales-by-day/sales-by-day.component';
import {
  LowStockWidgetComponent,
  ExpiringBatchesWidgetComponent,
} from '../widgets/inventory-widgets/inventory-widgets.component';
import { AdminOverviewWidgetComponent } from '../widgets/admin-overview/admin-overview.component';
import { BranchComparisonWidgetComponent } from '../widgets/branch-comparison/branch-comparison.component';
import { LiveOperationsWidgetComponent } from '../widgets/live-operations/live-operations.component';
import { CompanyKpisWidgetComponent } from '../widgets/company-kpis/company-kpis.component';
import { AttentionAlertsWidgetComponent } from '../widgets/attention-alerts/attention-alerts.component';
import { FinancialSnapshotWidgetComponent } from '../widgets/financial-snapshot/financial-snapshot.component';
import { EmployeesOverviewWidgetComponent } from '../widgets/employees-overview/employees-overview.component';
import { NewCustomersWidgetComponent } from '../widgets/new-customers/new-customers.component';
import { AttendanceTodayWidgetComponent } from '../widgets/attendance-today/attendance-today.component';
import { SalesTargetWidgetComponent } from '../widgets/sales-target/sales-target.component';
import { MySalesWidgetComponent } from '../widgets/my-sales/my-sales.component';
import { StatusBreakdownWidgetComponent } from '../widgets/status-breakdown/status-breakdown.component';
import { RefundsVoidsWidgetComponent } from '../widgets/refunds-voids/refunds-voids.component';
import {
  DEFAULT_LAYOUT, WIDGET_BY_SLUG, WidgetDef, WidgetView,
  customReportWidget, customReportId, canAccessWidget,
} from '../models/widget-registry';
import { CustomReportWidgetComponent } from '../widgets/custom-report-widget/custom-report-widget.component';
import { CustomReportsService } from '../../reports/custom/services/custom-reports.service';
import type { SavedModule } from '../../reports/custom/shared/models/custom-report.model';

interface BranchOption { id: string; name: string; }

/** A date preset for the dashboard's preset-only date dropdown. */
interface DatePresetOption { labelKey: string; range: () => DateRange; }

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
    RouterLink,
    TranslateModule,
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
    AdminOverviewWidgetComponent,
    BranchComparisonWidgetComponent,
    LiveOperationsWidgetComponent,
    CompanyKpisWidgetComponent,
    AttentionAlertsWidgetComponent,
    FinancialSnapshotWidgetComponent,
    EmployeesOverviewWidgetComponent,
    NewCustomersWidgetComponent,
    AttendanceTodayWidgetComponent,
    SalesTargetWidgetComponent,
    MySalesWidgetComponent,
    StatusBreakdownWidgetComponent,
    RefundsVoidsWidgetComponent,
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
  private privileges = inject(PrivilegeService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private customReports = inject(CustomReportsService);

  private i18nTick = signal(0);

  // ─── role editor mode ─────────────────────────────────────────────
  /**
   * When true the board edits a ROLE's default dashboard instead of the
   * signed-in employee's own. Widget access is checked against the role's
   * permissions and the layout is persisted onto the privilege record — the
   * employee-layout endpoints are never touched. Default (false) is exactly the
   * existing employee dashboard.
   */
  readonly roleMode = input(false);
  /** The privilege (role) id being edited, in role mode. */
  readonly roleId = input<string | null>(null);

  /** The loaded role record, kept so a save can write its `dashBoardOptions`. */
  private role: EmployeePrivilege | null = null;
  /** Display name of the edited role, for the header banner. */
  readonly roleName = signal('');
  /** Raw (pre-filter) role layout, re-applied once custom reports resolve. */
  private roleSourceRows: { id: string; widgets: { slug: string; colSpan: number; view?: WidgetView }[] }[] = [];

  /** Cached "reset target" — the role default the "Reset Layout" button
   *  restores (role's own default in role mode; the employee's role default in
   *  employee mode; global default as a last resort). Lazily resolved. */
  private roleDefaultRows: { id: string; widgets: { slug: string; colSpan: number; view?: WidgetView }[] }[] | null = null;

  /**
   * Permission checker used for widget access. Employee mode uses the signed-in
   * user's live permissions; role mode swaps in a checker bound to the edited
   * role's tree. Same allow-by-default semantics either way.
   */
  private checkFn: (permission: string) => boolean = (p) => this.privileges.check(p);

  /** True only when a super admin is viewing their OWN dashboard (never in role
   *  mode — a role is not a super admin). Gates the super-admin-only widgets.
   *  Detected via the employee flag OR the absence of a loaded privilege tree:
   *  super admins bypass the privilege system server-side, so they arrive with
   *  no tree, whereas every scoped user has one after login. */
  private get isViewerSuperAdmin(): boolean {
    if (this.roleMode()) return false;
    const emp: any = this.auth.currentEmployee;
    if (emp?.superAdmin === true) return true;
    return !this.privileges.privileges;
  }

  /** The empty-state CTA only appears when the viewer may customise — always
   *  true today (any viewer reaching the board owns or edits its layout), but
   *  kept as a gate so a future read-only mode can hide it. */
  readonly canCustomize = true;

  /** Back link to the role's privilege form, shown in role-edit mode. */
  readonly backLink = computed(() => ['/employees/privileges', this.roleId() ?? '0']);

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

  /**
   * Date presets. The dashboard uses a preset-only dropdown (no calendar), so
   * these are the entire date UX. Range thunks so "Today"/"This week" stay
   * correct across midnight.
   */
  readonly datePresets: DatePresetOption[] = [
    { labelKey: 'DASHBOARD.RANGE.TODAY',            range: () => todayRange() },
    { labelKey: 'DASHBOARD.RANGE.YESTERDAY',        range: () => yesterday() },
    { labelKey: 'DASHBOARD.RANGE.THIS_WEEK',        range: () => thisWeek() },
    { labelKey: 'DASHBOARD.RANGE.THIS_MONTH',       range: () => thisMonth() },
    { labelKey: 'DASHBOARD.RANGE.THIS_QUARTER',     range: () => thisQuarter() },
    { labelKey: 'DASHBOARD.RANGE.THIS_YEAR',        range: () => thisYear() },
    { labelKey: 'DASHBOARD.RANGE.YEAR_TO_DATE',     range: () => yearToDate() },
    { labelKey: 'DASHBOARD.RANGE.PREVIOUS_WEEK',    range: () => previousWeek() },
    { labelKey: 'DASHBOARD.RANGE.PREVIOUS_MONTH',   range: () => previousMonth() },
    { labelKey: 'DASHBOARD.RANGE.PREVIOUS_QUARTER', range: () => previousQuarter() },
    { labelKey: 'DASHBOARD.RANGE.PREVIOUS_YEAR',    range: () => previousYear() },
    { labelKey: 'DASHBOARD.RANGE.LAST_7',           range: () => lastNDays(7) },
    { labelKey: 'DASHBOARD.RANGE.LAST_30',          range: () => lastNDays(30) },
  ];

  /** Currently-selected preset — the dropdown's model. Defaults to This Month. */
  readonly selectedPreset = signal<DatePresetOption>(this.datePresets[3]);
  displayPreset = (p: DatePresetOption): string => { this.i18nTick(); return this.translate.instant(p.labelKey); };
  comparePreset = (a: DatePresetOption, b: DatePresetOption): boolean => a?.labelKey === b?.labelKey;

  onPresetChange(p: DatePresetOption | null): void {
    if (!p) return;
    this.selectedPreset.set(p);
    this.onRange(p.range());
  }

  /** Point the dropdown at whichever preset matches the current range; if none
   *  does (legacy custom range), fall back to This Month. */
  private syncSelectedPreset(): void {
    const cur = this.range();
    const key = (r: DateRange) => `${iso(r.start ?? new Date())}|${iso(r.end ?? new Date())}`;
    const curKey = key(cur);
    const match = this.datePresets.find((p) => key(p.range()) === curKey);
    if (match) {
      this.selectedPreset.set(match);
    } else {
      const thisMonthPreset = this.datePresets[3];
      this.selectedPreset.set(thisMonthPreset);
      this.range.set(thisMonthPreset.range());
    }
  }

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
    'expenses-by-category': (s) => this.service.expensesByCategory(s),
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
    'expenses-by-category': 'hbar',
  };

  /** Counts, not money. */
  readonly countWidgets = new Set(['online-invoices']);

  /** Slugs with a bespoke layout — everything else renders as a series widget. */
  readonly BESPOKE = new Set([
    'business-summary', 'summary-blocks', 'expense-income',
    'payments-flow', 'sales-by-day', 'low-quantity-products', 'expiry-date-products',
    'admin-company-overview', 'branch-comparison', 'live-operations',
    'company-kpis', 'attention-alerts', 'financial-snapshot', 'employees-overview',
    'new-customers', 'attendance-today', 'sales-target', 'my-sales',
    'purchase-order-status', 'delivery-status', 'refunds-voids',
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
    // Sync the preset dropdown to the restored range. A saved range that no
    // longer matches any preset (e.g. a legacy custom range from the old
    // calendar) snaps back to This Month so the label and data stay consistent.
    this.syncSelectedPreset();
    // The custom-report pool is needed in both modes (it's a pickable source and
    // a renderable widget) — load it regardless.
    this.loadCustomReports();

    if (this.roleMode()) {
      // Editing a role's default dashboard: never read/write the employee
      // endpoints or this device's localStorage.
      void this.initRoleMode();
      return;
    }

    // Show something immediately from the local copy, then reconcile with the
    // server. Without the local paint the board is blank for a round-trip; and
    // without the server fetch a layout saved elsewhere never arrives.
    const hadStored = this.restoreLayout();

    this.service.loadLayout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          // Never personalised server-side: fall back to the role default, then
          // the global default — but keep a layout this device already stored.
          if (!saved.length) { void this.applyRoleFallback(hadStored); return; }
          // The wire format is flat with a `rowId` per widget; rebuild the rows
          // from it, preserving the order the service already sorted into.
          const rows = this.savedToRows(saved);
          this.applyLayout(rows);
          localStorage.setItem(LAYOUT_KEY, JSON.stringify(rows));
        },
        // Offline or a failing endpoint must not blank the dashboard.
        error: () => { /* local layout stands */ },
      });
  }

  // ─── role editor ──────────────────────────────────────────────────
  /**
   * Load the role, bind widget access to its permissions, and seed the board
   * from its saved default (or the global default, filtered by that access).
   */
  private async initRoleMode(): Promise<void> {
    const id = this.roleId();
    if (!id) { this.applyLayout(DEFAULT_LAYOUT); return; }
    try {
      const role = await this.privileges.getPrivilege(id);
      this.role = role;
      this.roleName.set(role.name ?? '');
      const tree = role.privileges.ToJson();
      this.checkFn = (p) => hasPrivilegeAccess(tree, p);

      this.roleSourceRows = role.dashBoardOptions?.length
        ? this.savedToRows(this.normalizeOptions(role.dashBoardOptions))
        : DEFAULT_LAYOUT.map((r) => ({ id: r.id, widgets: r.widgets.map((w) => ({ ...w })) }));
      // "Reset Layout" in the role editor returns to the role's saved default.
      this.roleDefaultRows = this.roleSourceRows;
      this.applyLayout(this.roleSourceRows);
    } catch {
      // Couldn't load the role — show the global default under the viewer's
      // own access rather than a blank board.
      this.applyLayout(DEFAULT_LAYOUT);
    }
  }

  /**
   * Persist the current board as the edited role's default dashboard. Writes
   * the same flat `dashBoardOptions` shape the employee endpoint uses, onto the
   * privilege record — never the employee-layout endpoint.
   */
  saveRole(): void {
    const role = this.role;
    if (!role) return;
    role.dashBoardOptions = this.rows().flatMap((row, rowIndex) =>
      row.widgets.map((w, i) => ({
        slug: w.def.slug,
        isAdded: true,
        index: rowIndex,
        rowId: row.id,
        colSpan: w.colSpan,
        order: i,
        view: w.view,
      })),
    );
    this.privileges.savePrivilege(role.ToJson())
      .then(() => this.toast.success('DASHBOARD.ROLE_SAVED'))
      .catch(() => this.toast.error('COMMON.SAVE_FAILED'));
  }

  /**
   * Employee fallback when the server has no saved layout: the employee's role
   * default first, then the global default. Skipped when this device already
   * holds a personalised layout.
   */
  private async applyRoleFallback(hadStored: boolean): Promise<void> {
    if (hadStored) return;                 // personalised on this device — keep it
    const roleId = this.auth.currentEmployee?.['privilegeId'];
    if (roleId) {
      try {
        const role = await this.privileges.getPrivilege(String(roleId));
        if (role.dashBoardOptions?.length) {
          this.applyLayout(this.savedToRows(this.normalizeOptions(role.dashBoardOptions)));
          return;
        }
      } catch { /* fall through to the global default */ }
    }
    this.applyLayout(DEFAULT_LAYOUT);       // access-filtered in applyLayout
  }

  /**
   * The layout "Reset Layout" restores — the ROLE default. In role mode it's
   * the role's own saved default; in employee mode it's the employee's role
   * default (fetched once, cached), else the global default.
   */
  private async resolveRoleDefaultRows(): Promise<
    { id: string; widgets: { slug: string; colSpan: number; view?: WidgetView }[] }[]
  > {
    if (this.roleDefaultRows) return this.roleDefaultRows;
    const roleId = this.auth.currentEmployee?.['privilegeId'];
    if (roleId) {
      try {
        const role = await this.privileges.getPrivilege(String(roleId));
        if (role.dashBoardOptions?.length) {
          this.roleDefaultRows = this.savedToRows(this.normalizeOptions(role.dashBoardOptions));
          return this.roleDefaultRows;
        }
      } catch { /* fall through to the global default */ }
    }
    this.roleDefaultRows = DEFAULT_LAYOUT.map((r) => ({ id: r.id, widgets: r.widgets.map((w) => ({ ...w })) }));
    return this.roleDefaultRows;
  }

  /** Groups a flat saved/normalized widget list into explicit rows by `rowId`,
   *  restoring any locally remembered view the server hasn't stored yet. */
  private savedToRows(
    saved: { slug: string; rowId?: string; colSpan: number; view?: string }[],
  ): { id: string; widgets: { slug: string; colSpan: number; view?: WidgetView }[] }[] {
    // The `view` field is newer than the endpoint. If the server hasn't stored
    // it, keep whatever this device last chose rather than reverting the form.
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
    return [...byRow].map(([id, widgets]) => ({ id, widgets }));
  }

  /** Normalizes a raw `dashBoardOptions` array (role default) into the sorted
   *  flat shape `savedToRows` consumes — mirrors `DashboardService.loadLayout`. */
  private normalizeOptions(
    raw: any[],
  ): { slug: string; rowId: string; colSpan: number; view?: string }[] {
    return (raw ?? [])
      .filter((w) => w?.slug && w?.isAdded !== false)
      .map((w) => ({
        slug: String(w.slug),
        rowId: String(w?.rowId ?? ''),
        colSpan: Number(w?.colSpan) || 12,
        order: Number(w?.order) || 0,
        index: Number(w?.index) || 0,
        view: w?.view ? String(w.view) : undefined,
      }))
      .sort((a, b) => (a.index - b.index) || (a.order - b.order))
      .map(({ slug, rowId, colSpan, view }) => ({ slug, rowId, colSpan, view }));
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

  /** Writes the current layout locally, then syncs it. In role mode changes are
   *  staged in memory and persisted only on an explicit Save / Customize apply. */
  private persistLayout(): void {
    if (this.roleMode()) return;
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

  /** Re-run the layout once modules are known, so a custom widget that was
   *  skipped as "unsupported" before its module loaded now appears. In role
   *  mode the source is the role layout, not this device's localStorage. */
  private reapplyLayout(): void {
    if (this.roleMode()) { this.applyLayout(this.roleSourceRows); return; }
    this.restoreLayout();
  }

  // ─── layout ───────────────────────────────────────────────────────
  /** Applies the stored layout; returns whether a stored layout existed
   *  (i.e. this device was personalised), so callers can decide whether a
   *  role/global fallback should run. */
  private restoreLayout(): boolean {
    let rows = DEFAULT_LAYOUT;
    let hadStored = false;
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
          hadStored = true;
        }
      }
    } catch { /* fall back to the default layout */ }

    this.applyLayout(rows);
    return hadStored;
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
    ]
      // Only offer widgets the current access (employee or role) can see, so the
      // picker never lists a gated widget. Custom reports are already filtered.
      .filter((slug) => {
        const def = this.defOf(slug);
        return !def || canAccessWidget(def, this.checkFn, this.isViewerSuperAdmin);
      });
    // The role default powers the modal's "Reset Layout" button.
    const defaultRows = await this.resolveRoleDefaultRows();
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
          defaultRows,
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;

    this.applyLayout(result.rows);

    // Role mode persists onto the privilege record; keep this device's
    // localStorage and the employee endpoint out of it entirely.
    if (this.roleMode()) {
      this.roleSourceRows = result.rows;
      this.saveRole();
      return;
    }

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
              // Also drop any widget the current access (employee or role) can't
              // see, so a layout can never surface a gated widget.
              const supported = def
                && canAccessWidget(def, this.checkFn, this.isViewerSuperAdmin)
                && (this.loaders[def.slug] || this.BESPOKE.has(def.slug) || this.isCustomReport(def.slug));
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
function yesterday(): DateRange { return shiftDays(todayRange(), -1); }
function thisWeek(): DateRange {
  const now = dayStart(new Date());
  const start = new Date(now); start.setDate(now.getDate() - now.getDay()); // week starts Sunday
  return { start, end: now };
}
function previousWeek(): DateRange {
  const tw = thisWeek();
  const start = new Date(tw.start!); start.setDate(start.getDate() - 7);
  const end   = new Date(tw.start!); end.setDate(end.getDate() - 1);
  return { start, end };
}
function thisQuarter(): DateRange {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  return { start: new Date(now.getFullYear(), q * 3, 1), end: dayStart(now) };
}
function previousQuarter(): DateRange {
  const now = new Date();
  const startMonth = Math.floor(now.getMonth() / 3) * 3 - 3;
  return {
    start: new Date(now.getFullYear(), startMonth, 1),
    end:   new Date(now.getFullYear(), startMonth + 3, 0),
  };
}
function yearToDate(): DateRange {
  const now = new Date();
  return { start: new Date(now.getFullYear(), 0, 1), end: dayStart(now) };
}
function previousYear(): DateRange {
  const now = new Date();
  return { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear() - 1, 11, 31) };
}
