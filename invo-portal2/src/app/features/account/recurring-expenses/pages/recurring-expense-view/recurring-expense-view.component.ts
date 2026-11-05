import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { CompanyService } from '@core/auth/company.service';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { LayoutService } from '@core/layout/services/layout.service';

import { RecurringExpense } from '../../models/recurring-expense.model';
import { RecurringExpensesService } from '../../services/recurring-expenses.service';
import { RecurringExpenseActions, frequencyLabel } from '../../services/recurring-expense-schedule';
import { DocumentBuilderService } from '../../../../settings/document-builder/services/document-builder.service';
import type { DocumentTemplate } from '../../../../settings/document-builder/services/document-template.types';
import type { ReportTemplate } from '../../../../settings/document-builder/report-engine/core/types/template.types';
import { toReportData, CompanyLike } from '../../../../settings/document-builder/report-engine/utils/report-data';
import { expenseToRenderData } from '../../../expenses/services/expense-render-data';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import { LogEntry, LogsService } from '@shared/services/logs.service';
import type { DocRailItem } from '../../../services/document-view-base';

type Tab = 'overview' | 'next' | 'activity';

/**
 * Recurring Expense → read-only page, laid out like the customer / supplier pages: the shared doc-view
 * shell with the record rail (all profiles) beside the open one, a title bar with the actions, and
 * Overview / generated-expenses tabs. Reads `getRecurringExpenseOverview`, which carries `branchName`,
 * `nextExpenseDate` and `childExpenses` that the edit payload doesn't.
 */
@Component({
  selector: 'app-recurring-expense-view',
  standalone: true,
  imports: [StatusBadgeComponent, CommonModule, RouterModule, TranslateModule, MycurrencyPipe, DocViewShellComponent],
  providers: [MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recurring-expense-view.component.html',
  styleUrl: './recurring-expense-view.component.scss',
  // The shell must be the effective flex child of the no-padding main area (same as the document views).
  host: { style: 'display: contents' },
})
export class RecurringExpenseViewComponent implements OnInit, OnDestroy {
  private service = inject(RecurringExpensesService);
  private translate = inject(TranslateService);
  private lang = inject(LanguageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private layout = inject(LayoutService);
  private destroyRef = inject(DestroyRef);
  private builder = inject(DocumentBuilderService);
  private company = inject(CompanyService);
  private logs = inject(LogsService);
  readonly actions = inject(RecurringExpenseActions);

  profileId = '';
  profile = signal<RecurringExpense | null>(null);
  tab = signal<Tab>('overview');
  /** The document the schedule generates from (`getById` -> `transactionDetails`); loaded when its tab opens. */
  template = signal<any>(null);
  templateLoading = signal(false);

  // ── "Next expense" tab: the schedule's document drawn on the default expense template, like the real view ──
  paperTemplate = signal<DocumentTemplate | null>(null);
  zoom = signal(100);
  setZoom(v: number): void { this.zoom.set(v); }

  /** A copy of the template document dated for the next run (the saved one is left untouched). */
  private nextDoc = computed<any>(() => {
    const t = this.template();
    const p = this.profile();
    if (!t || !p) return null;
    const c: any = Object.assign(Object.create(Object.getPrototypeOf(t)), t);
    const auto = this.lang.instant('RECURRING_EXPENSES.VIEW.AUTO_GENERATED');
    const next = p.nextExpenseDate ?? c.expenseDate;
    c.expenseNumber = auto; c.expenseDate = next; c.supplierName = p.supplierName; c.supplierId = p.supplierId; c.customerName = p.customerName; c.customerId = p.customerId; c.branchName = p.branchName;
    try { c.calculateTotal?.(); } catch { /* keep the saved totals */ }
    return c;
  });
  renderData = computed<DocumentRenderData | null>(() => {
    const d = this.nextDoc();
    return d ? expenseToRenderData(d) : null;
  });
  reportDesign = computed<ReportTemplate | null>(() => {
    const t = this.paperTemplate();
    return t?.renderMode === 'designer' && t.reportDesign?.sections?.length ? t.reportDesign : null;
  });
  reportData = computed<Record<string, unknown> | null>(() => {
    const d = this.nextDoc();
    return d ? toReportData(d, this.company.currentCompany() as CompanyLike | null, this.lang.current()) : null;
  });
  /** An ended schedule is flagged on the paper. */
  expiredText = computed<string>(() => (this.isActive() ? '' : this.lang.instant('RECURRING_EXPENSES.VIEW.STATUS_EXPIRED')));

  children = computed<any[]>(() => this.profile()?.childExpenses ?? []);

  /** A schedule is active until its end date has passed. */
  isActive = computed<boolean>(() => {
    const p = this.profile();
    return !p || p.endTerm !== 'by' || !p.endDate || new Date(p.endDate) >= new Date(new Date().toDateString());
  });

  /** The customer / supplier the records are generated for (`null` for a journal). */
  party = computed<{ id: string | null; name: string; route: string } | null>(() => {
    const p = this.profile();
    return p ? (p.supplierId ? { id: p.supplierId, name: p.supplierName, route: '/account/suppliers/view' } : p.customerId ? { id: p.customerId, name: p.customerName, route: '/account/customers/view' } : null) : null;
  });

  /** Activity log of the profile (bills / expenses only — the backend writes no log for the others). */
  activity = signal<LogEntry[] | null>(null);
  activityLoading = signal(false);

  private i18nTick = signal(0);

  readonly tabs: { value: Tab; label: string }[] = [
    { value: 'overview', label: 'RECURRING_EXPENSES.VIEW.OVERVIEW' },
    { value: 'next', label: 'RECURRING_EXPENSES.VIEW.NEXT_DOC' },
    { value: 'activity', label: 'RECURRING_EXPENSES.VIEW.ACTIVITY' },
  ];

  // ── record rail (all profiles beside the open one) ──
  readonly railPageSize = 15;
  railItems = signal<DocRailItem[]>([]);
  railLoading = signal(false);
  railPage = signal(1);
  railPageCount = signal(1);
  railTerm = signal('');
  private railSeq = 0;
  private railTimer: ReturnType<typeof setTimeout> | null = null;

  /** The overview has no child counter; the generated expenses are the proof (the backend refuses the delete too). */
  canDelete = computed(() => {
    const p = this.profile();
    return !!p && this.actions.delete({ childExpensesQty: p.childExpenses.length });
  });

  frequency = computed(() => {
    this.i18nTick();
    return frequencyLabel(this.profile()?.repeatData, this.lang);
  });

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.layout.setNoPadding(true);
    void this.builder.getDefault('expense').then(t => this.paperTemplate.set(t)).catch(() => undefined);
    // `account/components/doc-lines-table` carries the shared DOC_VIEW strings the rail/shell use (empty state, ...).
    await Promise.all([this.lang.loadFeature('account/recurring-expenses'), this.lang.loadFeature('account/components/doc-lines-table')]);
    void this.loadRail(1);
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => void this.load());
  }

  ngOnDestroy(): void {
    this.layout.setNoPadding(false);
    if (this.railTimer) clearTimeout(this.railTimer);
  }

  private async load(): Promise<void> {
    this.profileId = this.route.snapshot.paramMap.get('id') ?? '';
    const p = await this.service.getOverview(this.profileId);
    if (!p) {
      this.goToList();
      return;
    }
    this.template.set(null);
    this.profile.set(p);
    void this.loadTemplate();
    this.activity.set(null);
    if (this.tab() === 'activity') void this.loadActivity();
  }

  // ── rail ──
  async loadRail(page: number): Promise<void> {
    const seq = ++this.railSeq;
    this.railLoading.set(true);
    try {
      const data = await this.service.getList({
        page, limit: this.railPageSize, searchTerm: this.railTerm(), sortBy: { sortValue: 'name', sortDirection: 'ASC' }, filter: { branches: [] },
      });
      if (seq !== this.railSeq) return;
      this.railItems.set((data?.list ?? []).map((r: any): DocRailItem => ({
        id: r.id,
        primary: r.name,
        amountLabel: '',
        sub: r.supplierName || r.branchName || '',
        data: r,
      })));
      this.railPage.set(page);
      this.railPageCount.set(Math.max(1, data?.pageCount || 1));
    } finally {
      if (seq === this.railSeq) this.railLoading.set(false);
    }
  }
  onRailSearch(term: string): void {
    if (this.railTimer) clearTimeout(this.railTimer);
    this.railTimer = setTimeout(() => { this.railTerm.set(term); void this.loadRail(1); }, 300);
  }
  railPrev(): void { if (this.railPage() > 1) void this.loadRail(this.railPage() - 1); }
  railNext(): void { if (this.railPage() < this.railPageCount()) void this.loadRail(this.railPage() + 1); }
  railGoTo(item: DocRailItem): void { void this.router.navigate(['/account/recurring-expense', 'view', item.id]); }

  selectTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'activity' && !this.activity()) void this.loadActivity();
  }

  private async loadActivity(): Promise<void> {
    const id = this.profileId;
    this.activityLoading.set(true);
    try {
      const res = await this.logs.getLogs({ sourceTable: ['RecurringExpenses'], sourceId: id, limit: 50 });
      if (id === this.profileId) this.activity.set(res.list);
    } finally {
      this.activityLoading.set(false);
    }
  }

  private async loadTemplate(): Promise<void> {
    const id = this.profileId;
    this.templateLoading.set(true);
    try {
      const r = await this.service.getById(id);
      if (id === this.profileId) this.template.set(r?.transactionDetails ?? {});
    } finally {
      this.templateLoading.set(false);
    }
  }
  goToList(): void { void this.router.navigate(['/account/recurring-expense']); }
  add(): void { void this.router.navigate(['/account/recurring-expense', 'new']); }

  edit(): void {
    if (this.profileId) void this.router.navigate(['/account/recurring-expense', this.profileId]);
  }

  remove(): Promise<void> {
    const p = this.profile();
    if (!p || !this.canDelete()) return Promise.resolve();
    return this.actions.runDelete(p.id!, () => this.goToList());
  }
}
