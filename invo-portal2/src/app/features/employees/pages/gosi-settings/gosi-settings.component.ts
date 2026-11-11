import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DateFieldComponent } from '@shared/components/date-field/date-field.component';

import { withTranslations } from '@core/i18n/with-translations';
import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { hrGrantFor } from '../../hr-privilege';

import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormErrorSummaryComponent } from '@shared/components/form-error-summary/form-error-summary.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { GosiService } from '../../services/gosi.service';
import { GosiCountryRule, GosiSettingsRow, GosiSuggestion, GosiTier3PolicyRow, RetirementAges, WageBasis } from '../../services/gosi.types';

/** Wage-basis dropdown option. */
interface WageBasisOption {
  value: WageBasis;
  labelKey: string;
}

const WAGE_BASIS_OPTIONS: readonly WageBasisOption[] = [
  { value: 'basic', labelKey: 'EMPLOYEES.GOSI.WAGE_BASIS_BASIC' },
  { value: 'basic_plus_allowances', labelKey: 'EMPLOYEES.GOSI.WAGE_BASIS_BASIC_PLUS_ALLOWANCES' },
  { value: 'basic_plus_housing', labelKey: 'EMPLOYEES.GOSI.WAGE_BASIS_BASIC_PLUS_HOUSING' },
];

/**
 * How often this row's figures should be re-checked against the official
 * source. Added because the real GOSI escalation figures (open question 1.a)
 * are unknown — rather than guess an annual increment, the stakeholder asked
 * for a review REMINDER instead. `null` = no reminder configured, distinct
 * from the auto-escalation fields already on the form: those compute a
 * number with no human involved, this only says when a human should look.
 */
interface ReviewIntervalOption {
  value: number | null;
  labelKey: string;
}

const REVIEW_INTERVAL_OPTIONS: readonly ReviewIntervalOption[] = [
  { value: null, labelKey: 'EMPLOYEES.GOSI.REVIEW_INTERVAL_NONE' },
  { value: 12, labelKey: 'EMPLOYEES.GOSI.REVIEW_INTERVAL_YEARLY' },
  { value: 24, labelKey: 'EMPLOYEES.GOSI.REVIEW_INTERVAL_EVERY_2_YEARS' },
];

/** The tier-3 decision, rendered as a 3-item dropdown rather than a toggle so
 *  "not yet decided" is a visible, selectable state — not a hidden default. */
type Tier3Decision = 'undecided' | 'yes' | 'no';

interface Tier3DecisionOption {
  value: Tier3Decision;
  labelKey: string;
}

const TIER3_DECISION_OPTIONS: readonly Tier3DecisionOption[] = [
  { value: 'undecided', labelKey: 'EMPLOYEES.GOSI.TIER3.DECISION_UNDECIDED' },
  { value: 'yes', labelKey: 'EMPLOYEES.GOSI.TIER3.DECISION_YES' },
  { value: 'no', labelKey: 'EMPLOYEES.GOSI.TIER3.DECISION_NO' },
];

/**
 * Employees → GOSI settings
 * ──────────────────────────
 * Bahrain social-insurance contribution-rate storage. Two independent
 * sections:
 *
 *   A) An effective-dated list of Tier 1 (Bahraini) / Tier 2 (GCC)
 *      contribution rates, with optional per-side auto-escalation, plus an
 *      "add new effective period" form. Every save is a NEW row — the
 *      backend never updates one in place, matching how pay-history and
 *      holiday-calendar entries behave elsewhere in this feature.
 *
 *   B) The Tier 3 (non-GCC expatriate) end-of-service gratuity policy: does
 *      the state contribution replace gratuity, or not — with an explicit
 *      third "not yet decided" state, and an effective-from date + notes
 *      that stay disabled (not hidden) until a decision is made.
 *
 * ── NOT A CALCULATOR ─────────────────────────────────────────────────────────
 * This screen stores rates; it does not compute a GOSI deduction. The
 * backend's `gosiCatalog.computationAvailable` flag says so explicitly, and
 * `catalog()` surfaces it as an informational note only.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Component({
  selector: 'app-gosi-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    FormErrorSummaryComponent,
    SearchDropdownComponent, DateFieldComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gosi-settings.component.html',
  styleUrl: './gosi-settings.component.scss',
})
export class GosiSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(GosiService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly host: HTMLElement = this.el.nativeElement;
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private privileges = inject(PrivilegeService);
  private auth = inject(AuthService);

  loading = signal(false);
  savingRate = signal(false);
  savingTier3 = signal(false);
  savingRetirement = signal(false);
  retirement = signal<RetirementAges | null>(null);
  /** True once loading finished and the server did not answer the retirement endpoint. */
  retirementUnavailable = signal(false);

  /** INVO-maintained rules for the company country (read-only; verified ones apply automatically). */
  countryRules = signal<GosiCountryRule[]>([]);
  periods = signal<GosiSettingsRow[]>([]);
  tier3History = signal<GosiTier3PolicyRow[]>([]);
  computationAvailable = signal(false);

  /** New-period form is collapsed by default — mirrors the pay-history
   *  "record a pay change" pattern rather than always showing an empty form. */
  addingPeriod = signal(false);

  /** The period being edited (null when adding a new one). */
  editingPeriod = signal<GosiSettingsRow | null>(null);

  /** Suggested, UNCONFIRMED values for the company's country (null when none). */
  suggestion = signal<GosiSuggestion | null>(null);
  /** True once the user has loaded a suggestion into the form this session. */
  suggestionApplied = signal(false);

  /**
   * Fill the form from the suggestion. Only fills — nothing is saved, and the
   * "source" box is left empty on purpose: it is required, so the user has to say
   * where they checked the figures before the row can be saved.
   */
  applySuggestion(): void {
    const s = this.suggestion();
    if (!s) return;
    this.periodForm.patchValue({ ...s.values });
    this.periodForm.markAsDirty();
    this.suggestionApplied.set(true);
  }

  private i18nTick = signal(0);

  readonly wageBasisOptions: WageBasisOption[] = [...WAGE_BASIS_OPTIONS];
  readonly tier3DecisionOptions: Tier3DecisionOption[] = [...TIER3_DECISION_OPTIONS];
  readonly reviewIntervalOptions: ReviewIntervalOption[] = [...REVIEW_INTERVAL_OPTIONS];

  // ─── Privilege gates ───────────────────────────────────────────────────
  canView = computed(() => hrGrantFor(this.privileges, this.auth, 'employeeGosiSecurity', 'view'));
  canEdit = computed(() => hrGrantFor(this.privileges, this.auth, 'employeeGosiSecurity', 'edit'));

  // ─── Derived ───────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('EMPLOYEES.TITLE'), routerLink: '/employees' },
      { label: this.translate.instant('EMPLOYEES.GOSI.TITLE') },
    ];
  });

  /** Newest effective period first. */
  sortedPeriods = computed<GosiSettingsRow[]>(() =>
    [...this.periods()].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1)),
  );

  /**
   * `effectiveFrom + reviewIntervalMonths`, for the list to show a reminder
   * date. `null` when the row has no interval set — display-only, mirrors
   * `nextReviewDue` in the backend's `employeeGosiTypes.ts` exactly so the
   * two never disagree about what date a given interval implies.
   */
  nextReviewDue(row: GosiSettingsRow): string | null {
    if (row.reviewIntervalMonths == null) return null;
    const [y, m, d] = row.effectiveFrom.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    const due = new Date(Date.UTC(y, m - 1 + row.reviewIntervalMonths, d));
    const yy = due.getUTCFullYear();
    const mm = String(due.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(due.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  /** Whether that reminder date has already passed — drives a badge, not a
   *  block: an overdue review is a nudge, never something that stops a save. */
  reviewOverdue(row: GosiSettingsRow): boolean {
    const due = this.nextReviewDue(row);
    if (!due) return false;
    return due < new Date().toISOString().slice(0, 10);
  }

  /** Groups no INVO rule covers (any status) — the company enters these itself. */
  uncoveredTiers = computed<GosiCountryRule['tier'][]>(() => {
    const have = new Set(this.countryRules().map((r) => r.tier));
    return (['Tier1Bahraini', 'Tier2Gcc', 'Tier3NonGccExpatriate'] as const).filter((t) => !have.has(t));
  });

  tierLabelKey(tier: GosiCountryRule['tier']): string {
    return tier === 'Tier1Bahraini' ? 'EMPLOYEES.GOSI.RATES.TIER1_LEGEND'
      : tier === 'Tier2Gcc' ? 'EMPLOYEES.GOSI.RATES.TIER2_LEGEND' : 'EMPLOYEES.GOSI.RATES.TIER3_LEGEND';
  }

  /** The current tier-3 policy is whichever row has the latest `effectiveFrom`. */
  currentTier3 = computed<GosiTier3PolicyRow | null>(() => {
    const rows = this.tier3History();
    if (!rows.length) return null;
    return [...rows].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
  });

  sortedTier3History = computed<GosiTier3PolicyRow[]>(() =>
    [...this.tier3History()].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1)),
  );

  // ─── Forms ─────────────────────────────────────────────────────────────
  periodForm: FormGroup = this.fb.group({
    effectiveFrom: ['', Validators.required],

    tier1EmployeeRatePercent: [null as number | null],
    tier1EmployerRatePercent: [null as number | null],
    tier1EmployeeRateAnnualIncrementPercent: [null as number | null],
    tier1EmployeeRateEscalationEndYear: [null as number | null],
    tier1EmployerRateAnnualIncrementPercent: [null as number | null],
    tier1EmployerRateEscalationEndYear: [null as number | null],

    tier2EmployeeRatePercent: [null as number | null],
    tier2EmployerRatePercent: [null as number | null],
    tier2EmployeeRateAnnualIncrementPercent: [null as number | null],
    tier2EmployeeRateEscalationEndYear: [null as number | null],
    tier2EmployerRateAnnualIncrementPercent: [null as number | null],
    tier2EmployerRateEscalationEndYear: [null as number | null],

    tier3EmployeeRatePercent: [null as number | null],
    tier3EmployerRatePercent: [null as number | null],

    wageBasis: [null as WageBasis | null],
    wageFloor: [null as number | null],
    tier1WageFloor: [null as number | null],
    tier2WageFloor: [null as number | null],
    tier3WageFloor: [null as number | null],
    wageCeiling: [null as number | null],
    reduceForAbsence: [false],

    reviewIntervalMonths: [null as number | null],

    source: ['', Validators.required],
    notes: [''],
  });

  tier3Form: FormGroup = this.fb.group({
    decision: ['undecided' as Tier3Decision],
    effectiveFrom: [''],
    notes: [''],
  });

  /** Retirement ages: its own card, its own Save and Reset (separate endpoint). */
  retirementForm: FormGroup = this.fb.group({
    nationalAge: [null as number | null],
    expatriateAge: [null as number | null],
    source: [''],
  });

  /** Unconfirmed until an explicit save has recorded the company's own figures. */
  readonly retirementConfirmed = computed(() => this.retirement()?.own != null);

  /** Bumped on every period-form status change so `errorCount` re-evaluates. */
  private periodStatusTick = signal(0);

  /** Invalid fields in the add-period form (0 while it is closed) — feeds the footer summary. */
  readonly errorCount = computed<number>(() => {
    this.periodStatusTick();
    if (!this.addingPeriod()) return 0;
    return Object.values(this.periodForm.controls).filter((c) => c.invalid).length;
  });

  constructor() {
    withTranslations('employees');
    this.periodForm.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.periodStatusTick.update((n) => n + 1));
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));

    // The tier-3 date/notes fields are disabled (not hidden) until a decision
    // is made — same idiom as `restDays` beside `worksEveryDay` in pos-options.
    this.tier3Form.get('decision')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((decision: Tier3Decision) => this.syncTier3FieldState(decision));
    this.syncTier3FieldState(this.tier3Form.get('decision')?.value ?? 'undecided');
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [catalog, periods, tier3] = await Promise.all([
        this.service.getCatalog(),
        this.service.list(),
        this.service.listTier3Policy(),
      ]);
      this.computationAvailable.set(catalog?.computationAvailable === true);
      this.suggestion.set(await this.service.suggestions().catch(() => null));
      this.countryRules.set(await this.service.countryRules().catch(() => []));
      // Older servers do not have this endpoint: the card then just stays empty.
      this.retirement.set(await this.service.retirementAges().catch(() => null));
      this.retirementUnavailable.set(this.retirement() === null);
      this.hydrateRetirementForm();
      this.periods.set(periods);
      this.tier3History.set(tier3);
      this.hydrateTier3Form();
    } catch (e: any) {
      this.toast.error('COMMON.LOAD_FAILED', e?.message);
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Section A — contribution rates ─────────────────────────────────────
  toggleAddPeriod(): void {
    this.addingPeriod.update((v) => !v);
    if (!this.addingPeriod()) this.closePeriodForm();
    else this.exitEditMode();
  }

  /** "Edit" a period = start a NEW period pre-filled from it. The original row is never
   *  changed, so it stays in the history; the new one takes effect from the chosen date. */
  editPeriod(p: GosiSettingsRow): void {
    if (!this.canEdit()) return;
    this.editingPeriod.set(p);
    this.suggestionApplied.set(false);
    this.periodForm.reset({
      effectiveFrom: new Date().toLocaleDateString('en-CA'),
      tier1EmployeeRatePercent: p.tier1EmployeeRatePercent,
      tier1EmployerRatePercent: p.tier1EmployerRatePercent,
      tier1EmployeeRateAnnualIncrementPercent: p.tier1EmployeeRateAnnualIncrementPercent,
      tier1EmployeeRateEscalationEndYear: p.tier1EmployeeRateEscalationEndYear,
      tier1EmployerRateAnnualIncrementPercent: p.tier1EmployerRateAnnualIncrementPercent,
      tier1EmployerRateEscalationEndYear: p.tier1EmployerRateEscalationEndYear,
      tier2EmployeeRatePercent: p.tier2EmployeeRatePercent,
      tier2EmployerRatePercent: p.tier2EmployerRatePercent,
      tier2EmployeeRateAnnualIncrementPercent: p.tier2EmployeeRateAnnualIncrementPercent,
      tier2EmployeeRateEscalationEndYear: p.tier2EmployeeRateEscalationEndYear,
      tier2EmployerRateAnnualIncrementPercent: p.tier2EmployerRateAnnualIncrementPercent,
      tier2EmployerRateEscalationEndYear: p.tier2EmployerRateEscalationEndYear,
      tier3EmployeeRatePercent: p.tier3EmployeeRatePercent,
      tier3EmployerRatePercent: p.tier3EmployerRatePercent,
      wageBasis: p.wageBasis,
      wageFloor: p.wageFloor,
      tier1WageFloor: p.tier1WageFloor,
      tier2WageFloor: p.tier2WageFloor,
      tier3WageFloor: p.tier3WageFloor,
      wageCeiling: p.wageCeiling,
      reduceForAbsence: p.reduceForAbsence === true,
      reviewIntervalMonths: p.reviewIntervalMonths,
      source: p.source ?? '',
      notes: p.notes ?? '',
    });
    // The new date already differs from the base period, so this counts as a change.
    this.periodForm.markAsDirty();
    this.addingPeriod.set(true);
    this.periodStatusTick.update((n) => n + 1);
    setTimeout(() => this.host.querySelector('.gosi-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async deletePeriod(p: GosiSettingsRow): Promise<void> {
    if (!this.canEdit() || this.saving()) return;
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.translate.instant('EMPLOYEES.GOSI.RATES.DELETE_TITLE'),
        message: this.translate.instant('EMPLOYEES.GOSI.RATES.DELETE_CONFIRM', { date: p.effectiveFrom }),
        note: this.translate.instant('EMPLOYEES.GOSI.RATES.DELETE_NOTE'),
        confirm: this.translate.instant('EMPLOYEES.GOSI.RATES.DELETE'),
        danger: true,
      },
    });
    if (!(await ref.afterClosed())) return;
    this.savingRate.set(true);
    try {
      await this.service.delete(p.id);
      this.periods.update((list) => list.filter((r) => r.id !== p.id));
      // The form was based on the row that just went away — close it.
      if (this.editingPeriod()?.id === p.id) this.closePeriodForm();
      this.toast.success('EMPLOYEES.GOSI.RATES.DELETED');
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.savingRate.set(false);
    }
  }

  private exitEditMode(): void {
    this.editingPeriod.set(null);
    this.periodForm.get('effectiveFrom')?.enable({ emitEvent: false });
  }

  private closePeriodForm(): void {
    this.exitEditMode();
    this.periodForm.reset();
    this.addingPeriod.set(false);
  }

  wageBasisDisplay = (o: WageBasisOption | null) => (o ? this.translate.instant(o.labelKey) : '');
  wageBasisCompare = (a: WageBasisOption | null, b: WageBasisOption | null) => (a?.value ?? null) === (b?.value ?? null);
  wageBasisToValue = (o: WageBasisOption | null) => o?.value ?? null;

  selectedWageBasis(): WageBasisOption | null {
    const v: WageBasis | null = this.periodForm.get('wageBasis')?.value ?? null;
    return this.wageBasisOptions.find((o) => o.value === v) ?? null;
  }

  setWageBasis(opt: WageBasisOption | null): void {
    this.periodForm.get('wageBasis')?.setValue(opt?.value ?? null);
    this.periodForm.markAsDirty();
  }

  reviewIntervalDisplay = (o: ReviewIntervalOption | null) => (o ? this.translate.instant(o.labelKey) : '');
  reviewIntervalCompare = (a: ReviewIntervalOption | null, b: ReviewIntervalOption | null) =>
    (a?.value ?? null) === (b?.value ?? null);
  reviewIntervalToValue = (o: ReviewIntervalOption | null) => o?.value ?? null;

  selectedReviewInterval(): ReviewIntervalOption | null {
    const v: number | null = this.periodForm.get('reviewIntervalMonths')?.value ?? null;
    return this.reviewIntervalOptions.find((o) => o.value === v) ?? this.reviewIntervalOptions[0];
  }

  setReviewInterval(opt: ReviewIntervalOption | null): void {
    this.periodForm.get('reviewIntervalMonths')?.setValue(opt?.value ?? null);
    this.periodForm.markAsDirty();
  }

  private async saveRatePeriod(silent: boolean): Promise<boolean> {
    if (this.periodForm.invalid) {
      this.periodForm.markAllAsTouched();
      return false;
    }
    this.savingRate.set(true);
    try {
      const v = this.periodForm.getRawValue();
      const saved = await this.service.save({
        effectiveFrom: v.effectiveFrom,
        tier1EmployeeRatePercent: v.tier1EmployeeRatePercent,
        tier1EmployerRatePercent: v.tier1EmployerRatePercent,
        tier1EmployeeRateAnnualIncrementPercent: v.tier1EmployeeRateAnnualIncrementPercent,
        tier1EmployeeRateEscalationEndYear: v.tier1EmployeeRateEscalationEndYear,
        tier1EmployerRateAnnualIncrementPercent: v.tier1EmployerRateAnnualIncrementPercent,
        tier1EmployerRateEscalationEndYear: v.tier1EmployerRateEscalationEndYear,
        tier2EmployeeRatePercent: v.tier2EmployeeRatePercent,
        tier2EmployerRatePercent: v.tier2EmployerRatePercent,
        tier2EmployeeRateAnnualIncrementPercent: v.tier2EmployeeRateAnnualIncrementPercent,
        tier2EmployeeRateEscalationEndYear: v.tier2EmployeeRateEscalationEndYear,
        tier2EmployerRateAnnualIncrementPercent: v.tier2EmployerRateAnnualIncrementPercent,
        tier2EmployerRateEscalationEndYear: v.tier2EmployerRateEscalationEndYear,
        tier3EmployeeRatePercent: v.tier3EmployeeRatePercent,
        tier3EmployerRatePercent: v.tier3EmployerRatePercent,
        wageBasis: v.wageBasis,
        wageFloor: v.wageFloor,
        tier1WageFloor: v.tier1WageFloor,
        tier2WageFloor: v.tier2WageFloor,
        tier3WageFloor: v.tier3WageFloor,
        wageCeiling: v.wageCeiling,
        reduceForAbsence: v.reduceForAbsence === true,
        reviewIntervalMonths: v.reviewIntervalMonths,
        source: v.source,
        notes: v.notes || null,
      });
      // A new period is appended; the period it was based on stays in the history.
      this.periods.update((list) =>
        list.some((r) => r.id === saved.id) ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved],
      );
      this.closePeriodForm();
      if (!silent) this.toast.success('EMPLOYEES.GOSI.RATE_SAVED');
      return true;
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
      return false;
    } finally {
      this.savingRate.set(false);
    }
  }

  // ─── Section B — tier 3 gratuity policy ─────────────────────────────────
  private syncTier3FieldState(decision: Tier3Decision): void {
    const effFrom = this.tier3Form.get('effectiveFrom');
    const notes = this.tier3Form.get('notes');
    if (decision === 'undecided') {
      effFrom?.disable({ emitEvent: false });
      notes?.disable({ emitEvent: false });
    } else {
      effFrom?.enable({ emitEvent: false });
      notes?.enable({ emitEvent: false });
    }
  }

  private hydrateTier3Form(): void {
    const current = this.currentTier3();
    const decision: Tier3Decision =
      current == null || current.stateContributionReplacesGratuity == null
        ? 'undecided'
        : current.stateContributionReplacesGratuity
          ? 'yes'
          : 'no';
    this.tier3Form.patchValue(
      {
        decision,
        effectiveFrom: current?.effectiveFrom ?? '',
        notes: current?.notes ?? '',
      },
      { emitEvent: false },
    );
    this.syncTier3FieldState(decision);
    this.tier3Form.markAsPristine();
  }

  tier3DecisionDisplay = (o: Tier3DecisionOption | null) => (o ? this.translate.instant(o.labelKey) : '');
  tier3DecisionCompare = (a: Tier3DecisionOption | null, b: Tier3DecisionOption | null) =>
    (a?.value ?? null) === (b?.value ?? null);
  tier3DecisionToValue = (o: Tier3DecisionOption | null) => o?.value ?? 'undecided';

  selectedTier3Decision(): Tier3DecisionOption | null {
    const v: Tier3Decision = this.tier3Form.get('decision')?.value ?? 'undecided';
    return this.tier3DecisionOptions.find((o) => o.value === v) ?? null;
  }

  setTier3Decision(opt: Tier3DecisionOption | null): void {
    this.tier3Form.get('decision')?.setValue(opt?.value ?? 'undecided');
    this.tier3Form.markAsDirty();
  }

  private async saveTier3Policy(silent: boolean): Promise<boolean> {
    const decision: Tier3Decision = this.tier3Form.get('decision')?.value ?? 'undecided';
    const v = this.tier3Form.getRawValue();
    if (!v.effectiveFrom) {
      this.tier3Form.get('effectiveFrom')?.markAsTouched();
      this.toast.error('EMPLOYEES.GOSI.TIER3.EFFECTIVE_FROM_REQUIRED');
      return false;
    }
    this.savingTier3.set(true);
    try {
      const saved = await this.service.saveTier3Policy({
        effectiveFrom: v.effectiveFrom,
        stateContributionReplacesGratuity: decision === 'yes',
        notes: v.notes || null,
        source: null,
      });
      this.tier3History.update((list) => [...list, saved]);
      this.hydrateTier3Form();
      if (!silent) this.toast.success('EMPLOYEES.GOSI.TIER3.SAVED');
      return true;
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
      return false;
    } finally {
      this.savingTier3.set(false);
    }
  }

  // ─── Section C — retirement ages ───────────────────────────────────────
  private hydrateRetirementForm(): void {
    const r = this.retirement();
    this.retirementForm.reset({
      nationalAge: r?.own?.nationalAge ?? null,
      expatriateAge: r?.own?.expatriateAge ?? null,
      source: r?.source ?? '',
    });
  }

  private async saveRetirement(silent: boolean): Promise<boolean> {
    const v = this.retirementForm.getRawValue();
    const national = v.nationalAge === null || v.nationalAge === '' ? null : Number(v.nationalAge);
    const expat = v.expatriateAge === null || v.expatriateAge === '' ? null : Number(v.expatriateAge);
    const bad = (n: number | null) => n !== null && (!Number.isInteger(n) || n < 40 || n > 80);
    if (bad(national) || bad(expat)) {
      this.toast.error('EMPLOYEES.GOSI.RETIREMENT.AGE_RANGE');
      return false;
    }
    const source = String(v.source ?? '').trim();
    if ((national !== null || expat !== null) && !source) {
      this.retirementForm.get('source')?.markAsTouched();
      this.toast.error('EMPLOYEES.GOSI.RETIREMENT.SOURCE_REQUIRED');
      return false;
    }
    this.savingRetirement.set(true);
    try {
      await this.service.saveRetirementAges({ nationalAge: national, expatriateAge: expat, source });
      this.retirement.set(await this.service.retirementAges().catch(() => null));
      this.hydrateRetirementForm();
      if (!silent) this.toast.success('EMPLOYEES.GOSI.RETIREMENT.SAVED');
      return true;
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
      return false;
    } finally {
      this.savingRetirement.set(false);
    }
  }

  async resetRetirement(): Promise<void> {
    if (!this.canEdit()) return;
    this.savingRetirement.set(true);
    try {
      await this.service.resetRetirementAges();
      this.retirement.set(await this.service.retirementAges().catch(() => null));
      this.hydrateRetirementForm();
      this.toast.success('EMPLOYEES.GOSI.RETIREMENT.RESET_DONE');
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.savingRetirement.set(false);
    }
  }

  // ─── Single Save — only the sections the user actually changed ─────────
  private ratesPending(): boolean { return this.addingPeriod() && this.periodForm.dirty; }
  private tier3Pending(): boolean {
    return this.tier3Form.dirty && (this.tier3Form.get('decision')?.value ?? 'undecided') !== 'undecided';
  }
  private retirementPending(): boolean { return !this.retirementUnavailable() && this.retirementForm.dirty; }

  /** Drives the footer Save button — enabled only when something is waiting to be saved. */
  hasChanges(): boolean {
    return this.canEdit() && (this.ratesPending() || this.tier3Pending() || this.retirementPending());
  }

  saving(): boolean { return this.savingRate() || this.savingTier3() || this.savingRetirement(); }

  async save(): Promise<void> {
    if (!this.canEdit() || this.saving() || !this.hasChanges()) return;
    const base = this.editingPeriod();
    if (base && this.ratesPending() && this.periodForm.getRawValue().effectiveFrom === base.effectiveFrom) {
      this.toast.error(this.translate.instant('EMPLOYEES.GOSI.RATES.EDIT_NEW_DATE', { date: base.effectiveFrom }));
      return;
    }
    // Validate everything first so a bad section never leaves the others half-saved.
    if (this.ratesPending() && this.periodForm.invalid) {
      this.periodForm.markAllAsTouched();
      // Errors are listed in the footer summary; just bring the first one into view.
      // The invalid field is often below the fold — bring it into view.
      setTimeout(() => {
        const el = this.host.querySelector<HTMLElement>('input.ng-invalid, textarea.ng-invalid, app-date-field.ng-invalid');
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el?.focus?.();
      });
      return;
    }
    let ok = true;
    if (this.ratesPending()) ok = (await this.saveRatePeriod(true)) && ok;
    if (this.tier3Pending()) ok = (await this.saveTier3Policy(true)) && ok;
    if (this.retirementPending()) ok = (await this.saveRetirement(true)) && ok;
    if (ok) {
      this.toast.success('COMMON.SAVED_OK');
      this.router.navigate(['/employees']);
    }
  }

  // ─── Navigation ────────────────────────────────────────────────────────
  back(): void {
    this.router.navigate(['/employees']);
  }
}
