import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ErrorService } from '@core/http/error.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { BranchSettingsService, BranchSummary } from 'src/app/features/settings/services/branch-settings.service';

import { RecurringJournalService } from '../../services/recurring-journal.service';
import {
  JournalLine,
  RecurringEndTerm,
  RecurringJournal,
  RecurringPeriodicity,
  emptyRecurringJournal,
} from '../../models/recurring-journal.model';
import { JournalLinesEditorComponent } from './components/journal-lines-editor/journal-lines-editor.component';

interface Option<V> { value: V; label: string; }

/**
 * Create/edit form — 1:1 port of legacy
 * `recurring-journal-form.component` (recurrence schedule fields) +
 * `app-journal-form-lines` (now `<app-journal-lines-editor>`, extracted as
 * its own reusable component per this app's convention).
 *
 * Recurrence-schedule business logic preserved exactly:
 *  - `endTerm`: 'none' (never ends) | 'by' (ends on `endDate`, which must be
 *    >= `startDate` — legacy auto-bumped `endDate` forward when the start
 *    date moved past it; done here via `onStartDateChange`).
 *  - `repeatData.on` meaning depends on `periodicity`:
 *      Monthly → day-of-month (1-31), Weekly → weekday (1=Mon..7=Sun),
 *      Yearly → month (1=Jan..12=Dec). Switching periodicity resets the
 *      available `on` option list (mirrors legacy `getCurrentPeriodCount`).
 *  - Branch is LOCKED once the record exists (legacy: `[readonly]` on edit)
 *    — a recurring journal's branch can't be changed after creation.
 *  - Save is blocked (mirrors legacy `[disabled]` on the Save button) while
 *    the form is invalid, a save is in flight, or there are fewer than 2
 *    lines — balance (`debit === credit`) is still enforced server-side and
 *    surfaced via the centralized error modal if violated, since the
 *    client-side line editor already warns about it inline.
 */
@Component({
  selector: 'app-recurring-journal-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SearchDropdownComponent,
    JournalLinesEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recurring-journal-form.component.html',
  styleUrl: './recurring-journal-form.component.scss',
})
export class RecurringJournalFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(RecurringJournalService);
  private branchSettings = inject(BranchSettingsService);
  private translate = inject(TranslateService);
  private lang = inject(LanguageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private errorService = inject(ErrorService);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  submitAttempted = signal<boolean>(false);

  journal = signal<RecurringJournal>(emptyRecurringJournal());
  cleanSnapshot = signal<string>('');
  branches = signal<BranchSummary[]>([]);

  private i18nTick = signal(0);

  formStatus = computed<'new' | 'edit'>(() => (this.journal().id ? 'edit' : 'new'));
  isExisting = computed<boolean>(() => this.formStatus() === 'edit');

  pageTitle = computed<string>(() => {
    this.i18nTick();
    return this.isExisting()
      ? this.translate.instant('RECURRING_JOURNAL.FORM.EDIT_TITLE')
      : this.translate.instant('RECURRING_JOURNAL.FORM.NEW_TITLE');
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('RECURRING_JOURNAL.LIST.TITLE'), routerLink: '/account/recurring-journal' },
      { label: this.pageTitle() },
    ];
  });

  // ─── Recurrence option lists ────────────────────────────────────
  periodicityOptions: Option<RecurringPeriodicity>[] = [];
  endTermOptions: Option<RecurringEndTerm>[] = [];
  private days: Option<number>[] = [];
  private weekdays: Option<number>[] = [];
  private months: Option<number>[] = [];

  currentOnOptions(): Option<number>[] {
    switch (this.journal().repeatData.periodicity) {
      case 'Weekly': return this.weekdays;
      case 'Yearly': return this.months;
      default: return this.days;
    }
  }

  onFieldLabelKey(): string {
    switch (this.journal().repeatData.periodicity) {
      case 'Weekly': return 'RECURRING_JOURNAL.FORM.ON_WEEKDAY';
      case 'Yearly': return 'RECURRING_JOURNAL.FORM.ON_MONTH';
      default: return 'RECURRING_JOURNAL.FORM.ON_DAY';
    }
  }

  periodUnitLabelKey(): string {
    switch (this.journal().repeatData.periodicity) {
      case 'Weekly': return 'RECURRING_JOURNAL.FORM.WEEK';
      case 'Yearly': return 'RECURRING_JOURNAL.FORM.YEAR';
      default: return 'RECURRING_JOURNAL.FORM.MONTH';
    }
  }

  // ─── Validation ─────────────────────────────────────────────────
  nameError = computed<string | null>(() => (!this.journal().name?.trim() ? 'COMMON.REQUIRED' : null));
  startDateError = computed<string | null>(() => (!this.journal().startDate ? 'COMMON.REQUIRED' : null));
  endDateError = computed<string | null>(() => {
    const j = this.journal();
    if (j.endTerm !== 'by') return null;
    return !j.endDate ? 'COMMON.REQUIRED' : null;
  });
  branchError = computed<string | null>(() => (!this.journal().transactionDetails?.branchId ? 'COMMON.REQUIRED' : null));
  linesError = computed<string | null>(() => {
    const lines = (this.journal().transactionDetails?.lines ?? []).filter(l => !l.isVoided);
    if (lines.length < 2) return 'RECURRING_JOURNAL.FORM.MIN_TWO_LINES';
    const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (debit - credit !== 0) return 'RECURRING_JOURNAL.FORM.MUST_BALANCE';
    return null;
  });

  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());
  canSave = computed<boolean>(() =>
    !this.nameError() && !this.startDateError() && !this.endDateError() &&
    !this.branchError() && !this.linesError() && !this.saving(),
  );

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/recurring-journal');
    this.buildOptionLists();

    const branchesRes = await this.branchSettings.getList({ page: 1, limit: 999 });
    this.branches.set(branchesRes.list);

    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (!id || id === 'new') {
      const defaultBranchId = this.branches()[0]?.id ?? '';
      this.journal.set(emptyRecurringJournal(defaultBranchId));
      this.cleanSnapshot.set(this.snapshot());
      return;
    }

    this.loading.set(true);
    try {
      const j = await this.service.getById(id);
      if (j) this.journal.set(j);
      this.cleanSnapshot.set(this.snapshot());
    } finally {
      this.loading.set(false);
    }
  }

  private buildOptionLists(): void {
    this.periodicityOptions = [
      { value: 'Weekly', label: this.translate.instant('RECURRING_JOURNAL.FORM.WEEKLY') },
      { value: 'Monthly', label: this.translate.instant('RECURRING_JOURNAL.FORM.MONTHLY') },
      { value: 'Yearly', label: this.translate.instant('RECURRING_JOURNAL.FORM.YEARLY') },
    ];
    this.endTermOptions = [
      { value: 'none', label: this.translate.instant('RECURRING_JOURNAL.FORM.END_NONE') },
      { value: 'by', label: this.translate.instant('RECURRING_JOURNAL.FORM.END_BY') },
    ];
    this.days = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
    this.weekdays = [
      { value: 1, label: this.translate.instant('RECURRING_JOURNAL.WEEKDAYS.MONDAY') },
      { value: 2, label: this.translate.instant('RECURRING_JOURNAL.WEEKDAYS.TUESDAY') },
      { value: 3, label: this.translate.instant('RECURRING_JOURNAL.WEEKDAYS.WEDNESDAY') },
      { value: 4, label: this.translate.instant('RECURRING_JOURNAL.WEEKDAYS.THURSDAY') },
      { value: 5, label: this.translate.instant('RECURRING_JOURNAL.WEEKDAYS.FRIDAY') },
      { value: 6, label: this.translate.instant('RECURRING_JOURNAL.WEEKDAYS.SATURDAY') },
      { value: 7, label: this.translate.instant('RECURRING_JOURNAL.WEEKDAYS.SUNDAY') },
    ];
    this.months = [
      { value: 1, label: this.translate.instant('RECURRING_JOURNAL.MONTHS.JAN') },
      { value: 2, label: this.translate.instant('RECURRING_JOURNAL.MONTHS.FEB') },
      { value: 3, label: this.translate.instant('RECURRING_JOURNAL.MONTHS.MAR') },
      { value: 4, label: this.translate.instant('RECURRING_JOURNAL.MONTHS.APR') },
      { value: 5, label: this.translate.instant('RECURRING_JOURNAL.MONTHS.MAY') },
      { value: 6, label: this.translate.instant('RECURRING_JOURNAL.MONTHS.JUN') },
      { value: 7, label: this.translate.instant('RECURRING_JOURNAL.MONTHS.JUL') },
      { value: 8, label: this.translate.instant('RECURRING_JOURNAL.MONTHS.AUG') },
      { value: 9, label: this.translate.instant('RECURRING_JOURNAL.MONTHS.SEP') },
      { value: 10, label: this.translate.instant('RECURRING_JOURNAL.MONTHS.OCT') },
      { value: 11, label: this.translate.instant('RECURRING_JOURNAL.MONTHS.NOV') },
      { value: 12, label: this.translate.instant('RECURRING_JOURNAL.MONTHS.DEC') },
    ];
  }

  // ─── search-dropdown glue (generic option lists) ───────────────
  optDisplay = (o: Option<any> | null) => o?.label ?? '';
  optCompare = (a: Option<any> | null, b: Option<any> | null) => a?.value === b?.value;
  optToValue = (o: Option<any> | null) => o?.value;

  selectedPeriodicity = (): Option<RecurringPeriodicity> | null =>
    this.periodicityOptions.find(o => o.value === this.journal().repeatData.periodicity) ?? null;
  setPeriodicity(value: Option<RecurringPeriodicity> | Option<RecurringPeriodicity>[] | null): void {
    const opt = Array.isArray(value) ? value[0] ?? null : value;
    if (!opt) return;
    this.journal.update(j => ({
      ...j,
      repeatData: { ...j.repeatData, periodicity: opt.value, on: this.currentOnOptionsFor(opt.value)[0]?.value ?? 1 },
    }));
  }
  private currentOnOptionsFor(p: RecurringPeriodicity): Option<number>[] {
    if (p === 'Weekly') return this.weekdays;
    if (p === 'Yearly') return this.months;
    return this.days;
  }

  selectedEndTerm = (): Option<RecurringEndTerm> | null =>
    this.endTermOptions.find(o => o.value === this.journal().endTerm) ?? null;
  setEndTerm(value: Option<RecurringEndTerm> | Option<RecurringEndTerm>[] | null): void {
    const opt = Array.isArray(value) ? value[0] ?? null : value;
    if (!opt) return;
    this.journal.update(j => ({
      ...j,
      endTerm: opt.value,
      endDate: opt.value === 'by' ? (j.endDate || j.startDate) : null,
    }));
  }

  selectedOn = (): Option<number> | null =>
    this.currentOnOptions().find(o => o.value === this.journal().repeatData.on) ?? null;
  setOn(value: Option<number> | Option<number>[] | null): void {
    const opt = Array.isArray(value) ? value[0] ?? null : value;
    if (!opt) return;
    this.journal.update(j => ({ ...j, repeatData: { ...j.repeatData, on: opt.value } }));
  }

  branchDisplay = (b: BranchSummary | null) => b?.name ?? '';
  branchCompare = (a: BranchSummary | null, b: BranchSummary | null) => (a?.id ?? '') === (b?.id ?? '');
  branchToValue = (b: BranchSummary | null) => b?.id ?? '';
  selectedBranch = (): BranchSummary | null =>
    this.branches().find(b => b.id === this.journal().transactionDetails?.branchId) ?? null;
  setBranch(value: BranchSummary | BranchSummary[] | null): void {
    const b = Array.isArray(value) ? value[0] ?? null : value;
    if (!b) return;
    this.journal.update(j => ({
      ...j,
      branchId: b.id,
      transactionDetails: { ...(j.transactionDetails ?? { lines: [] }), branchId: b.id },
    }));
  }

  // ─── Plain field setters ────────────────────────────────────────
  setName(value: string): void { this.journal.update(j => ({ ...j, name: value })); }

  setStartDate(value: string): void {
    this.journal.update(j => {
      const endDate = j.endTerm === 'by' && j.endDate && value > j.endDate ? value : j.endDate;
      return { ...j, startDate: value, endDate };
    });
  }

  setEndDate(value: string): void { this.journal.update(j => ({ ...j, endDate: value })); }

  setPeriodQty(value: number): void {
    this.journal.update(j => ({ ...j, repeatData: { ...j.repeatData, periodQty: Math.max(1, Number(value) || 1) } }));
  }

  setLines(lines: JournalLine[]): void {
    this.journal.update(j => ({ ...j, transactionDetails: { ...(j.transactionDetails ?? { branchId: j.branchId, lines: [] }), lines } }));
  }

  // ─── Save / cancel ──────────────────────────────────────────────
  async save(): Promise<void> {
    this.submitAttempted.set(true);
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const res = await this.service.save(this.journal());
      this.journal.update(j => ({ ...j, id: res.id }));
      this.cleanSnapshot.set(this.snapshot());
      this.toast.success('COMMON.SAVED_OK');
      void this.router.navigate(['/account/recurring-journal']);
    } catch (err: any) {
      this.toast.error('COMMON.DELETE_FAILED', err?.message);
      await this.errorService.handleError(err);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { void this.router.navigate(['/account/recurring-journal']); }

  view(): void {
    const id = this.journal().id;
    if (id) void this.router.navigate(['/account/recurring-journal', id]);
  }

  // ─── Unsaved-changes guard ────────────────────────────────────
  private snapshot(): string { return JSON.stringify(this.journal()); }
  hasUnsavedChanges(): boolean { return this.snapshot() !== this.cleanSnapshot(); }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void this.save();
    }
  }
}
