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
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { AuthService } from '@core/auth/auth.service';
import { BranchConnectionService } from '@core/layout/services/branch.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import type { DatePreset, DateRange } from '@shared/components/datepicker/date-picker.types';
import { isCompleteRange } from '@shared/components/datepicker/date-picker.types';

import { DashboardService } from '../services/dashboard.service';
import { DashboardScope } from '../services/dashboard.types';
import { SeriesWidgetComponent, SeriesLoader } from '../widgets/series-widget.component';
import { BusinessSummaryWidgetComponent } from '../widgets/business-summary.component';
import { DEFAULT_LAYOUT, WIDGET_BY_SLUG, WidgetDef } from '../models/widget-registry';

interface BranchOption { id: string; name: string; }

/** A widget as placed on the grid. */
interface Placed {
  def: WidgetDef;
  colSpan: number;
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
    SeriesWidgetComponent,
    BusinessSummaryWidgetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private service = inject(DashboardService);
  private branchService = inject(BranchConnectionService);
  private auth = inject(AuthService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

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
  readonly placed = signal<Placed[]>([]);

  /** Loaders live here so a widget stays a pure presentation component. */
  readonly loaders: Record<string, SeriesLoader> = {
    'top-items':           (s) => this.service.topItems(s),
    'top-customers':       (s) => this.service.topCustomers(s),
    'sales-by-category':   (s) => this.service.salesByCategory(s),
    'sales-by-department': (s) => this.service.salesByDepartment(s),
    'sales-by-brand':      (s) => this.service.salesByBrand(s),
    'sales-by-service':    (s) => this.service.salesByService(s),
    'sales-by-source':     (s) => this.service.salesBySource(s),
    'sales-by-employee':   (s) => this.service.salesByEmployee(s),
    'sales-by-time':       (s) => this.service.salesByTime(s),
    'payment-methods':     (s) => this.service.paymentMethods(s),
    'online-invoices':     (s) => this.service.onlineInvoices(s),
  };

  /** Chart form per widget — magnitude→bar, part-of-whole→donut, ranked→hbar. */
  readonly chartFor: Record<string, 'bar' | 'hbar' | 'donut' | 'pie'> = {
    'top-items':           'hbar',
    'top-customers':       'hbar',
    'sales-by-category':   'hbar',
    'sales-by-department': 'hbar',
    'sales-by-brand':      'donut',
    'sales-by-service':    'donut',
    'sales-by-source':     'donut',
    'sales-by-employee':   'hbar',
    'sales-by-time':       'bar',
    'payment-methods':     'bar',
    'online-invoices':     'bar',
  };

  /** Counts, not money. */
  readonly countWidgets = new Set(['online-invoices']);

  /** Slugs with a bespoke layout — everything else renders as a series widget. */
  readonly BESPOKE = new Set(['business-summary']);
  isBespoke(slug: string) { return this.BESPOKE.has(slug); }

  constructor() {
    withTranslations('dashboard');
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  ngOnInit(): void {
    this.restoreScope();
    this.restoreLayout();
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

  // ─── layout ───────────────────────────────────────────────────────
  private restoreLayout(): void {
    let slugs: { slug: string; colSpan: number }[] = DEFAULT_LAYOUT;
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) slugs = parsed;
      }
    } catch { /* fall back to the default layout */ }

    this.placed.set(
      slugs
        .map((s) => {
          const def = WIDGET_BY_SLUG.get(s.slug);
          // A slug we no longer ship (or haven't built yet) is skipped rather
          // than rendering a hole.
          const supported = def && (this.loaders[def.slug] || this.BESPOKE.has(def.slug));
          return supported ? { def: def!, colSpan: s.colSpan ?? def!.defaultSpan } : null;
        })
        .filter((p): p is Placed => p !== null),
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
