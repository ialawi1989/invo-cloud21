import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DateFieldComponent } from '@shared/components/date-field/date-field.component';

import { withTranslations } from '@core/i18n/with-translations';
import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { AlertComponent } from '@shared/components/alert/alert.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { hrGrantFor } from '../../hr-privilege';
import { EmployeeService } from '../../services/employee.service';
import { EmployeeDetails } from '../../models/employee.types';
import { EmployeeEosService } from '../../services/employee-eos.service';
import {
  ClearanceRow,
  EosRecord,
  SettlementLine,
  blockerLabelKey,
  completionBlockers,
  noticeServedDays,
  settlementTotal,
} from '../../services/employee-eos.types';
import { describeError, HrError } from '../../hr-error';

/**
 * End of Service — spec §4.11.
 *
 * ── NOTHING ON THIS SCREEN CALCULATES A SETTLEMENT ───────────────────────────
 * Every amount is typed in. The total is a sum of what was entered and is
 * BLANK while any line is undecided, because a total over a partial settlement
 * presents an incomplete figure as final. The "nothing is calculated" banner is
 * driven by `statutoryCalculationsAvailable` from the SERVER, not hardcoded —
 * so the day a jurisdiction rule set exists the server flips it and the banner
 * disappears with no portal release.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── COMPLETION IS THE IRREVERSIBLE STEP ──────────────────────────────────────
 * It sets the employee's top-level termination date and revokes their access
 * for THIS company. The blockers are shown before the button is offered, and
 * the server re-checks every one of them — what is rendered here is a
 * courtesy, not the control.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Component({
  selector: 'app-employee-eos',
  standalone: true,
  imports: [TranslateModule, LoadingOverlayComponent, MycurrencyPipe, AlertComponent, SearchDropdownComponent, FormStickyFooterComponent, DateFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-eos.component.html',
  styleUrl: './employee-eos.component.scss',
})
export class EmployeeEosComponent implements OnInit {
  private service = inject(EmployeeEosService);
  private employees = inject(EmployeeService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private modal = inject(ModalService);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);
  private auth = inject(AuthService);

  loading = signal(false);
  saving = signal(false);
  error = signal<HrError | null>(null);

  record = signal<EosRecord | null>(null);
  openAssetCount = signal(0);
  statutoryAvailable = signal(false);
  /** Blockers the SERVER returned when it refused. Its list, not ours. */
  serverBlockers = signal<{ key: string; detail: string | null }[]>([]);

  private employeeId = signal<string>('');

  // ── Who is being offboarded ──────────────────────────────────────────────
  /**
   * The employee, for the summary rail beside the form.
   *
   * Ending someone's employment is the one screen where "which record am I
   * on?" must never be a guess, and the tab strip above shows a name but not
   * the number, the position or the hire date that distinguish two people with
   * the same one. Read-only and purely confirmatory — nothing here is posted.
   */
  readonly employee = signal<EmployeeDetails | null>(null);

  readonly employeeNumber = computed(() => this.employee()?.profile?.employeeNumber ?? '');
  readonly position       = computed(() => this.employee()?.employment?.position ?? '');
  readonly employmentType = computed(() => this.employee()?.employment?.employmentType ?? '');

  /** dd/mm/yyyy. Split, not `new Date()` — a bare ISO day parses as UTC
   *  midnight and renders as the day before west of Greenwich. */
  hireDate = computed<string>(() => {
    const iso = this.employee()?.hireDate;
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return y && m && d ? `${d}/${m}/${y}` : '';
  });

  readonly canEdit = computed(() =>
    hrGrantFor(this.privileges, this.auth, 'employeeEosSecurity', 'edit'));
  readonly canComplete = computed(() =>
    hrGrantFor(this.privileges, this.auth, 'employeeEosSecurity', 'complete'));

  readonly isCompleted = computed(() => !!this.record()?.completedAt);

  readonly noticeServed = computed(() => {
    const r = this.record();
    return r ? noticeServedDays(r.noticeGivenDate, r.lastWorkingDay) : null;
  });

  /** Null while any line is undecided — see the header. */
  readonly total = computed(() => {
    const r = this.record();
    return r ? settlementTotal(r.settlement) : null;
  });

  /**
   * Why completion is not available yet.
   *
   * The visa rule needs a nationality the portal does not reliably hold, so
   * `false` is passed and the SERVER applies it. Showing a blocker the server
   * would not raise is worse than omitting one it will — the server's refusal
   * carries its own list, rendered from `serverBlockers`.
   */
  readonly blockers = computed(() => {
    const r = this.record();
    return r ? completionBlockers(r, this.openAssetCount(), false) : [];
  });

  constructor() {
    withTranslations('employees');
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.parent?.snapshot.paramMap.get('id')
      ?? this.route.snapshot.paramMap.get('id') ?? '';
    this.employeeId.set(id);
    this.loadEmployee();
    await this.load();
  }

  /**
   * The summary rail's data, fetched ALONGSIDE the record and never awaited
   * with it.
   *
   * Two reasons, and the second was found the hard way. It is confirmatory,
   * not functional: a failed or slow lookup must cost the user the rail, never
   * the offboarding screen. And putting it in the same `await` as the record
   * added a microtask hop to the record's own path — which was enough to make
   * every render test see an empty screen, because the record signal had not
   * been set by the time change detection ran.
   */
  private loadEmployee(): void {
    this.employees.getOne(this.employeeId())
      .then((e) => this.employee.set(e))
      .catch(() => this.employee.set(null));
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const record = await this.service.get(this.employeeId());
      const caps = this.service.lastCapabilities();
      this.record.set(record);
      // A brand-new record starts undecided; a saved one carries its answer.
      this.rehireChoice.set(record.id ? (record.rehireEligible ? 'yes' : 'no') : 'undecided');
      this.statutoryAvailable.set(caps.statutoryCalculationsAvailable);
      this.openAssetCount.set(this.service.lastOpenAssetCount());
      this.serverBlockers.set([]);
    } catch (e) {
      // The service degrades reads itself, so this should be unreachable — but
      // "should be" is how a tab ends up rendering a blank white screen. A
      // caught failure shows the empty record and the error, which is at least
      // legible; leaving it uncaught left `record()` null and the template
      // rendered NOTHING AT ALL. Found by the render test, not by reading.
      this.record.set(blankRecord());
      this.error.set(describeError(e));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Presentation state ───────────────────────────────────────────────────
  /** Inline "required" messages stay quiet until someone tries to save or finalize. */
  readonly showErrors = signal(false);

  /**
   * "Eligible for rehire" is three-state in the UI.
   * TODO(backend): the contract stores a boolean, so "Not decided" is sent as
   * `true` exactly as the old pre-ticked checkbox did. A nullable column is
   * needed before "not decided" can be stored as such.
   */
  readonly rehireChoice = signal<'undecided' | 'yes' | 'no'>('undecided');

  readonly optLabel = (o: { label: string }) => o?.label ?? '';
  readonly optSame = (a: any, b: any) => (a?.key ?? a) === (b?.key ?? b);

  private tr(key: string): string { return this.translate.instant(key); }

  readonly typeOptions = computed(() => [
    { key: 'Resignation', label: this.tr('EMPLOYEES.EOS.TYPE_RESIGNATION') },
    { key: 'Termination', label: this.tr('EMPLOYEES.EOS.TYPE_TERMINATION') },
    { key: 'EndOfContract', label: this.tr('EMPLOYEES.EOS.TYPE_END_OF_CONTRACT') },
    { key: 'Retirement', label: this.tr('EMPLOYEES.EOS.TYPE_RETIREMENT') },
    { key: 'DeathInService', label: this.tr('EMPLOYEES.EOS.TYPE_DEATH') },
  ]);
  readonly selectedType = computed(() => this.typeOptions().find(o => o.key === this.record()?.type) ?? null);

  readonly rehireOptions = computed(() => [
    { key: 'undecided', label: this.tr('EMPLOYEES.EOS.REHIRE_UNDECIDED') },
    { key: 'yes', label: this.tr('EMPLOYEES.EOS.REHIRE_YES') },
    { key: 'no', label: this.tr('EMPLOYEES.EOS.REHIRE_NO') },
  ]);
  readonly selectedRehire = computed(() => this.rehireOptions().find(o => o.key === this.rehireChoice()) ?? null);

  readonly statusOptions = computed(() => [
    { key: 'Pending', label: this.tr('EMPLOYEES.EOS.PENDING') },
    { key: 'Cleared', label: this.tr('EMPLOYEES.EOS.CLEARED') },
    { key: 'Blocked', label: this.tr('EMPLOYEES.EOS.BLOCKED') },
  ]);
  statusOption(status: string) { return this.statusOptions().find(o => o.key === status) ?? null; }

  onDate(field: keyof EosRecord, iso: string | null): void {
    this.patch({ [field]: iso } as any);
  }

  onType(opt: { key: string } | null): void {
    this.patch({ type: (opt?.key ?? null) as any });
  }

  onRehireChoice(opt: { key: string } | null): void {
    const choice = (opt?.key ?? 'undecided') as 'undecided' | 'yes' | 'no';
    this.rehireChoice.set(choice);
    this.patch({ rehireEligible: choice !== 'no' });
  }

  onClearanceStatusPick(index: number, opt: { key: string } | null): void {
    if (opt) this.onClearance(index, { status: opt.key as any });
  }

  /** The seeded departments carry code names; show them as people say them. */
  deptLabel(department: string): string {
    const key = 'EMPLOYEES.EOS.DEPT_' + String(department).toUpperCase();
    const out = this.translate.instant(key);
    return out === key ? department : out;
  }

  /** dd/mm/yyyy, split rather than parsed (a bare ISO day is UTC midnight). */
  fmtDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return y && m && d ? `${d}/${m}/${y}` : String(iso);
  }

  /** Last working day may not precede the day notice was given. */
  readonly dateError = computed<string | null>(() => {
    const r = this.record();
    if (r?.noticeGivenDate && r.lastWorkingDay && r.lastWorkingDay < r.noticeGivenDate) {
      return 'EMPLOYEES.EOS.DATE_ORDER_ERROR';
    }
    return null;
  });

  /** The "Blocking Reason" column only exists once a department is Blocked. */
  readonly hasBlocked = computed(() => (this.record()?.clearance ?? []).some(c => c.status === 'Blocked'));

  /** Problems currently in the way, counted for the footer. */
  readonly errorCount = computed(() => {
    const r = this.record();
    if (!r) return 0;
    let n = 0;
    if (!r.type) n++;
    if (!r.reason?.trim()) n++;
    if (this.dateError()) n++;
    n += r.clearance.filter(c => c.status === 'Blocked' && !c.blockingReason?.trim()).length;
    return n;
  });

  /** Bring the first problem into view. */
  jumpToError(): void {
    this.showErrors.set(true);
    setTimeout(() => {
      document.querySelector<HTMLElement>('.eos .is-invalid, .eos .field-error')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  readonly clearedCount = computed(() => (this.record()?.clearance ?? []).filter(c => c.status === 'Cleared').length);
  readonly clearedPercent = computed(() => {
    const total = this.record()?.clearance.length ?? 0;
    return total ? Math.round((this.clearedCount() / total) * 100) : 0;
  });

  /**
   * Finalize is available only when every department has cleared, type and
   * reason are filled, the dates are in order and nothing else (open assets,
   * overrides without reasons) stands in the way. The server re-checks all of it.
   */
  readonly finalizeReady = computed(() => {
    const r = this.record();
    return !!r && !!r.type && !!r.reason?.trim() && !this.dateError()
      && r.clearance.length > 0 && this.blockers().length === 0
      && r.clearance.every(c => c.status === 'Cleared');
  });

  // ── Field handlers ────────────────────────────────────────────────────────
  patch(patch: Partial<EosRecord>): void {
    this.record.update(r => (r ? { ...r, ...patch } : r));
  }

  onField(field: keyof EosRecord, event: Event): void {
    this.patch({ [field]: (event.target as HTMLInputElement).value || null } as any);
  }

  onRehire(event: Event): void {
    this.patch({ rehireEligible: (event.target as HTMLInputElement).checked });
  }

  onClearance(index: number, patch: Partial<ClearanceRow>): void {
    this.record.update(r => r && ({
      ...r,
      clearance: r.clearance.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  onClearanceStatus(index: number, event: Event): void {
    this.onClearance(index, { status: (event.target as HTMLSelectElement).value as any });
  }

  onClearanceReason(index: number, event: Event): void {
    this.onClearance(index, { blockingReason: (event.target as HTMLInputElement).value || null });
  }

  onLine(index: number, patch: Partial<SettlementLine>): void {
    this.record.update(r => r && ({
      ...r,
      settlement: r.settlement.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  }

  onLineAmount(index: number, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    // Empty stays NULL, never 0 — an undecided line is not a zero line, and
    // coercing it here would put a number in a settlement nobody agreed to.
    this.onLine(index, { amount: raw === '' ? null : Number(raw) });
  }

  onLineNote(index: number, event: Event): void {
    this.onLine(index, { calculationNote: (event.target as HTMLInputElement).value || null });
  }

  onLineOverride(index: number, event: Event): void {
    this.onLine(index, { isOverridden: (event.target as HTMLInputElement).checked });
  }

  onLineOverrideReason(index: number, event: Event): void {
    this.onLine(index, { overrideReason: (event.target as HTMLInputElement).value || null });
  }

  addLine(): void {
    this.record.update(r => r && ({
      ...r,
      settlement: [...r.settlement, {
        id: '', lineKey: '', amount: null, calculationNote: null,
        isOverridden: false, overrideReason: null,
      }],
    }));
  }

  removeLine(index: number): void {
    this.record.update(r => r && ({
      ...r, settlement: r.settlement.filter((_, i) => i !== index),
    }));
  }

  // ── Save / complete ───────────────────────────────────────────────────────
  async save(): Promise<void> {
    const r = this.record();
    if (!r) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.service.save(this.employeeId(), r);
      this.toast.success('EMPLOYEES.EOS.SAVED');
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.saving.set(false);
    }
  }

  /** Save without finalizing. Required-field messages show, but a draft may be incomplete. */
  async saveDraft(): Promise<void> {
    this.showErrors.set(true);
    await this.save();
  }

  cancel(): void {
    void this.router.navigate(['/employees', this.employeeId()]);
  }

  /** Finalize is the irreversible step, so it asks first. */
  async finalize(): Promise<void> {
    this.showErrors.set(true);
    if (!this.finalizeReady()) return;
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.tr('EMPLOYEES.EOS.FINALIZE_CONFIRM_TITLE'),
        message: this.tr('EMPLOYEES.EOS.FINALIZE_CONFIRM'),
        confirm: this.tr('EMPLOYEES.EOS.FINALIZE'),
        danger: true,
      },
    }).afterClosed();
    if (ok) await this.complete();
  }

  async complete(): Promise<void> {
    const r = this.record();
    if (!r) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const result = await this.service.complete(this.employeeId(), r);
      if (result?.blockers?.length) {
        // The SERVER's list, rendered as given. It re-checks every gate, and
        // it may know things this screen does not — the visa rule, for one.
        this.serverBlockers.set(result.blockers);
        return;
      }
      this.toast.success('EMPLOYEES.EOS.COMPLETED');
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.saving.set(false);
    }
  }

  /** Server blocker key -> bundle key. See employee-eos.types.ts. */
  blockerLabelKey = blockerLabelKey;

  trackClearance = (i: number) => i;
  trackLine = (i: number) => i;
}

/** The shape the server returns for an employee who has not left. */
function blankRecord(): EosRecord {
  return {
    id: null, type: null, noticeGivenDate: null, lastWorkingDay: null,
    reason: null, rehireEligible: true, rehireReason: null,
    exitInterview: { conductedBy: null, date: null, summary: null },
    clearance: [], settlement: [],
    visaCancellationDate: null, accessRevokedAt: null, completedAt: null,
  };
}
