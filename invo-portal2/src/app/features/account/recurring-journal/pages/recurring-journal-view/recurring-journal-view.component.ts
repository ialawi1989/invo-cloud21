import { formatJournalDate } from '../../../services/journal-date';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { LayoutService } from '@core/layout/services/layout.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ErrorService } from '@core/http/error.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { RecurringJournalService } from '../../services/recurring-journal.service';
import { RecurringJournal } from '../../models/recurring-journal.model';
import { AccountService } from '../../../../settings/chart-of-accounts/services/account.service';
import { ManualJournalPaperComponent } from '../../../manual-journals/components/manual-journal-paper/manual-journal-paper.component';
import { Journal } from '../../../manual-journals/services/manual-journals.types';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import { DocViewerBarComponent } from '../../../components/doc-viewer-bar/doc-viewer-bar.component';
import { LogEntry, LogsService } from '@shared/services/logs.service';
import type { DocRailItem } from '../../../services/document-view-base';

type Tab = 'overview' | 'next' | 'activity';

/**
 * Read-only detail page — port of legacy `recurring-journal-view`, laid out like the customer / supplier
 * pages: the shared doc-view shell with the record rail (all profiles) beside the open one, a title bar
 * with the actions, and Overview / generated-journals tabs.
 * Uses `getRecurringJournalOverview` (NOT `getRecurringJournalById` —
 * verified to be a genuinely different, view-only payload that also
 * carries `branchName` / `nextJournalDate` / the generated-journal history
 * in `childJournals`, none of which `getById` returns).
 */
@Component({
  selector: 'app-recurring-journal-view',
  standalone: true,
  imports: [StatusBadgeComponent, CommonModule, RouterModule, TranslateModule, MycurrencyPipe, DocViewShellComponent, DocViewerBarComponent, ManualJournalPaperComponent],
  providers: [MycurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recurring-journal-view.component.html',
  styleUrl: './recurring-journal-view.component.scss',
  // The shell must be the effective flex child of the no-padding main area (same as the document views).
  host: { style: 'display: contents' },
})
export class RecurringJournalViewComponent implements OnInit, OnDestroy {
  private service = inject(RecurringJournalService);
  private translate = inject(TranslateService);
  private lang = inject(LanguageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private layout = inject(LayoutService);
  private toast = inject(ToastService);
  private errorService = inject(ErrorService);
  private privileges = inject(PrivilegeService);
  private modalService = inject(ModalService);
  private destroyRef = inject(DestroyRef);
  private logs = inject(LogsService);
  private accountService = inject(AccountService);

  readonly canEdit = this.privileges.check('recurringJournalSecurity.actions.add.access');
  readonly canDelete = this.privileges.check('recurringJournalSecurity.actions.delete.access');

  journalId = '';
  journal = signal<RecurringJournal | null>(null);
  tab = signal<Tab>('overview');
  /** The document the schedule generates from (`getById` -> `transactionDetails`); loaded when its tab opens. */
  template = signal<any>(null);
  templateLoading = signal(false);

  /** Activity log of the profile (written by the backend on create / update). */
  activity = signal<LogEntry[] | null>(null);
  activityLoading = signal(false);

  // ── "Next journal" tab: the schedule's entry drawn on the manual-journal paper ──
  private accountNames = signal<Map<string, string>>(new Map());
  zoom = signal(100);

  /** Debit total of the saved lines (the edit payload carries no stored totals). */
  templateDebits = computed<number>(() => ((this.template()?.lines ?? []) as any[])
    .filter(l => !l.isVoided).reduce((s, l) => s + (Number(l.debit) || 0), 0));

  /** The entry as the schedule will post it, in the shape the manual-journal paper draws. */
  nextJournal = computed<Journal | null>(() => {
    const j = this.journal();
    const t = this.template();
    if (!j || !t) return null;
    const names = this.accountNames();
    return {
      id: '',
      notes: j.name,
      reference: this.lang.instant('RECURRING_JOURNAL.VIEW.AUTO_GENERATED'),
      status: '' as Journal['status'],
      attachment: [],
      journalDate: formatJournalDate(j.nextJournalDate),
      comments: [],
      branchId: j.branchId,
      branchName: j.branchName ?? '',
      reconciled: false,
      lines: ((t.lines ?? []) as any[]).map(l => ({ ...l, accountName: l.accountName || names.get(l.accountId) || '' })),
    };
  });

  children = computed<any[]>(() => this.journal()?.childJournals ?? []);

  /** A schedule is active until its end date has passed. */
  isActive = computed<boolean>(() => {
    const j = this.journal();
    return !j || j.endTerm !== 'by' || !j.endDate || new Date(j.endDate) >= new Date(new Date().toDateString());
  });

  /** The customer / supplier the records are generated for (`null` for a journal). */
  party = computed<{ id: string | null; name: string; route: string } | null>(() => {
    const j = this.journal();
    return j ? (null) : null;
  });


  private i18nTick = signal(0);

  readonly tabs: { value: Tab; label: string }[] = [
    { value: 'overview', label: 'RECURRING_JOURNAL.VIEW.OVERVIEW' },
    { value: 'next', label: 'RECURRING_JOURNAL.VIEW.NEXT_DOC' },
    { value: 'activity', label: 'RECURRING_JOURNAL.VIEW.ACTIVITY' },
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

  /** Mirrors legacy's delete gate exactly:
   *  `childJournalsQty == 0 && !hasJournals && <add-access>` — note legacy
   *  guards the delete BUTTON on the *add* privilege (not a separate
   *  delete privilege), which we intentionally do NOT replicate: this app
   *  has a dedicated `recurringJournalSecurity.actions.delete.access` key
   *  in the registry, so we gate on that instead (a stricter, more correct
   *  check — see feature report for this deliberate deviation). */
  canDeleteRecord = computed<boolean>(() => {
    const j = this.journal();
    if (!j) return false;
    return (j.childJournalsQty ?? 0) === 0 && !j.hasJournals && this.canDelete;
  });

  frequency = computed<string>(() => {
    this.i18nTick();
    const j = this.journal();
    if (!j) return '';
    const qty = j.repeatData?.periodQty ?? 1;
    switch (j.repeatData?.periodicity) {
      case 'Monthly': return this.translate.instant('RECURRING_JOURNAL.LIST.FREQUENCY_SENTENCE_MONTH', { qty, period: 'Month' });
      case 'Yearly': return this.translate.instant('RECURRING_JOURNAL.LIST.FREQUENCY_SENTENCE_YEAR', { qty, period: 'Year' });
      case 'Weekly': return this.translate.instant('RECURRING_JOURNAL.LIST.FREQUENCY_SENTENCE_WEEK', { qty, period: 'Week' });
      default: return '';
    }
  });

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.layout.setNoPadding(true);
    // `account/components/doc-lines-table` carries the shared DOC_VIEW strings the rail/shell use (empty state, ...).
    await Promise.all([this.lang.loadFeature('account/recurring-journal'), this.lang.loadFeature('account/manual-journals'), this.lang.loadFeature('account/components/doc-lines-table')]);
    void this.loadRail(1);
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => void this.load());
  }

  ngOnDestroy(): void {
    this.layout.setNoPadding(false);
    if (this.railTimer) clearTimeout(this.railTimer);
  }

  private async load(): Promise<void> {
    this.journalId = this.route.snapshot.paramMap.get('id') ?? '';
    const j = await this.service.getOverview(this.journalId);
    if (!j) {
      this.back();
      return;
    }
    this.template.set(null);
    this.journal.set(j);
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
        page, limit: this.railPageSize, searchTerm: this.railTerm(), sortBy: { sortValue: 'name', sortDirection: 'asc' },
      });
      if (seq !== this.railSeq) return;
      this.railItems.set(data.list.map((r): DocRailItem => ({ id: r.id, primary: r.name, amountLabel: '', sub: r.branchName || '', data: r })));
      this.railPage.set(page);
      this.railPageCount.set(Math.max(1, data.pageCount || 1));
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
  railGoTo(item: DocRailItem): void { void this.router.navigate(['/account/recurring-journal', item.id]); }

  selectTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'activity' && !this.activity()) void this.loadActivity();
  }

  private async loadActivity(): Promise<void> {
    const id = this.journalId;
    this.activityLoading.set(true);
    try {
      const res = await this.logs.getLogs({ sourceTable: ['RecurringJournals'], sourceId: id, limit: 50 });
      if (id === this.journalId) this.activity.set(res.list);
    } finally {
      this.activityLoading.set(false);
    }
  }

  private async loadTemplate(): Promise<void> {
    const id = this.journalId;
    this.templateLoading.set(true);
    try {
      const r = await this.service.getById(id);
      if (this.accountNames().size === 0) {
        const res = await this.accountService.getList({ page: 1, limit: 999, searchTerm: '' }).catch(() => null);
        this.accountNames.set(new Map((res?.list ?? []).map(a => [a.id, a.name] as [string, string])));
      }
      if (id === this.journalId) this.template.set(r?.transactionDetails ?? {});
    } finally {
      this.templateLoading.set(false);
    }
  }
  add(): void { void this.router.navigate(['/account/recurring-journal', 'new']); }
  back(): void { void this.router.navigate(['/account/recurring-journal']); }

  edit(): void {
    if (this.journalId) void this.router.navigate(['/account/recurring-journal', this.journalId, 'edit']);
  }

  async delete(): Promise<void> {
    const j = this.journal();
    if (!j || !this.canDeleteRecord()) return;

    const ref = this.modalService.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.translate.instant('COMMON.DELETE'),
        message: this.translate.instant('COMMON.CONFIRM_DELETE'),
        confirm: this.translate.instant('COMMON.DELETE'),
        danger: true,
      },
    });
    const confirmed = await ref.afterClosed();
    if (!confirmed) return;

    try {
      await this.service.delete(j.id);
      this.toast.success('COMMON.DELETED_OK');
      this.back();
    } catch (err: any) {
      this.toast.error('COMMON.DELETE_FAILED', err?.message);
      await this.errorService.handleError(err);
    }
  }
}
