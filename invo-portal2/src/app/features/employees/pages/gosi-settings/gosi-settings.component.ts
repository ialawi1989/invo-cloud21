import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { hrGrantFor } from '../../hr-privilege';

import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { GosiService } from '../../services/gosi.service';
import { GosiSettingsRow, GosiTier3PolicyRow, WageBasis } from '../../services/gosi.types';

/** Wage-basis dropdown option. */
interface WageBasisOption {
  value: WageBasis;
  labelKey: string;
}

const WAGE_BASIS_OPTIONS: readonly WageBasisOption[] = [
  { value: 'basic', labelKey: 'EMPLOYEES.GOSI.WAGE_BASIS_BASIC' },
  { value: 'basic_plus_allowances', labelKey: 'EMPLOYEES.GOSI.WAGE_BASIS_BASIC_PLUS_ALLOWANCES' },
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
    SearchDropdownComponent,
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
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);
  private auth = inject(AuthService);

  loading = signal(false);
  savingRate = signal(false);
  savingTier3 = signal(false);

  periods = signal<GosiSettingsRow[]>([]);
  tier3History = signal<GosiTier3PolicyRow[]>([]);
  computationAvailable = signal(false);

  /** New-period form is collapsed by default — mirrors the pay-history
   *  "record a pay change" pattern rather than always showing an empty form. */
  addingPeriod = signal(false);

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

    wageBasis: [null as WageBasis | null],
    wageFloor: [null as number | null],
    wageCeiling: [null as number | null],

    reviewIntervalMonths: [null as number | null],

    source: ['', Validators.required],
    notes: [''],
  });

  tier3Form: FormGroup = this.fb.group({
    decision: ['undecided' as Tier3Decision],
    effectiveFrom: [''],
    notes: [''],
  });

  constructor() {
    withTranslations('employees');
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
    if (!this.addingPeriod()) this.periodForm.reset();
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
  }

  async saveRatePeriod(): Promise<void> {
    if (!this.canEdit()) return;
    if (this.periodForm.invalid) {
      this.periodForm.markAllAsTouched();
      return;
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
        wageBasis: v.wageBasis,
        wageFloor: v.wageFloor,
        wageCeiling: v.wageCeiling,
        reviewIntervalMonths: v.reviewIntervalMonths,
        source: v.source,
        notes: v.notes || null,
      });
      this.periods.update((list) => [...list, saved]);
      this.periodForm.reset();
      this.addingPeriod.set(false);
      this.toast.success('EMPLOYEES.GOSI.RATE_SAVED');
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
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
  }

  async saveTier3Policy(): Promise<void> {
    if (!this.canEdit()) return;
    const decision: Tier3Decision = this.tier3Form.get('decision')?.value ?? 'undecided';
    if (decision === 'undecided') {
      this.toast.error('EMPLOYEES.GOSI.TIER3.DECISION_REQUIRED');
      return;
    }
    const v = this.tier3Form.getRawValue();
    if (!v.effectiveFrom) {
      this.tier3Form.get('effectiveFrom')?.markAsTouched();
      this.toast.error('EMPLOYEES.GOSI.TIER3.EFFECTIVE_FROM_REQUIRED');
      return;
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
      this.toast.success('EMPLOYEES.GOSI.TIER3.SAVED');
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.savingTier3.set(false);
    }
  }

  // ─── Navigation ────────────────────────────────────────────────────────
  back(): void {
    this.router.navigate(['/employees']);
  }
}
