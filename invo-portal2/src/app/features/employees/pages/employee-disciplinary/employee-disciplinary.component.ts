import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { HrError, describeError } from '../../hr-error';
import { portalKey } from '../../hr-labels';
import { hrGrantFor } from '../../hr-privilege';
import { FileCatalog, HrFile } from '../../services/employee-file.service';
import {
  DisciplinaryCatalog,
  DisciplinaryEscalation,
  DisciplinaryRecord,
  EmployeeDisciplinaryService,
} from '../../services/employee-disciplinary.service';
import {
  DisciplinaryActor,
  acknowledgementIsComplete,
  isOwnRecord,
  isSubject,
  mayAppeal,
  mayDecideAppeal,
  mayEditRecord,
  mayRecordAcknowledgement,
  mayViewEscalation,
  mayWriteStatement,
  statementWindowClosed,
} from './disciplinary-rules';

/**
 * The disciplinary tab — the most restricted screen in the feature.
 *
 * ── WHAT IS DELIBERATELY WITHHELD ────────────────────────────────────────────
 * The escalation panel is hidden from the subject even though they may read
 * every record behind it. That is not an oversight: it is the figure someone
 * consults while deciding whether to escalate, the server refuses it to them,
 * and the subject reading it changes the process it is part of.
 *
 * ── isSpent IS TAKEN AS SENT ─────────────────────────────────────────────────
 * True when the warning expired OR when an appeal overturned it. An overturned
 * warning is spent regardless of date — it is withdrawn, not merely old.
 * Recomputing from `expiryDate` here would produce the two worst errors this
 * module can make: escalating on a withdrawn warning, or ignoring a live one.
 * Null renders as unknown, never as "still live".
 *
 * ── FIVE ACTS, FIVE DIFFERENT AUTHORS ────────────────────────────────────────
 * Issuing, acknowledging, the employee's statement, the appeal, and deciding
 * the appeal are five separate endpoints because they are five separate acts by
 * different people. Two of them are the employee's alone and no privilege
 * reaches them. See disciplinary-rules.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Component({
  selector: 'app-employee-disciplinary',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-disciplinary.component.html',
  styleUrls: ['./employee-disciplinary.component.scss'],
})
export class EmployeeDisciplinaryComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(EmployeeDisciplinaryService);
  private readonly privileges = inject(PrivilegeService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  readonly employeeId =
    this.route.parent?.snapshot.paramMap.get('id')
    ?? this.route.snapshot.paramMap.get('id')
    ?? '0';

  readonly loading = signal(true);
  readonly busy = signal<string | null>(null);
  readonly error = signal<HrError | null>(null);

  readonly records = signal<DisciplinaryRecord[]>([]);
  readonly escalation = signal<DisciplinaryEscalation | null>(null);
  readonly catalog = signal<DisciplinaryCatalog>({
    warningTypes: [], severities: [], reasons: [], appealOutcomes: [], payrollImpactTypes: [],
  });
  readonly fileCatalog = signal<FileCatalog | null>(null);

  readonly actor = computed<DisciplinaryActor>(() => ({
    actorEmployeeId: (this.auth.currentEmployee as any)?.id ?? null,
    subjectEmployeeId: this.employeeId,
    canView: hrGrantFor(this.privileges, this.auth, 'employeeDisciplinarySecurity', 'view'),
    canEdit: hrGrantFor(this.privileges, this.auth, 'employeeDisciplinarySecurity', 'edit'),
    canDecideAppeal:
      hrGrantFor(this.privileges, this.auth, 'employeeDisciplinarySecurity', 'decideAppeal'),
  }));

  readonly isOwnRecordPage = computed(() => isSubject(this.actor()));
  readonly canEdit = computed(() => mayEditRecord(this.actor()));
  readonly canSeeEscalation = computed(() => mayViewEscalation(this.actor()));
  readonly canUpload = computed(() =>
    this.canEdit() && this.fileCatalog()?.storageConfigured === true);

  mayWriteStatement = (r: DisciplinaryRecord) => mayWriteStatement(r, this.actor());
  windowClosed = (r: DisciplinaryRecord) => statementWindowClosed(r, this.actor());
  mayAppeal = (r: DisciplinaryRecord) => mayAppeal(r, this.actor());
  mayDecideAppeal = (r: DisciplinaryRecord) => mayDecideAppeal(r, this.actor());
  mayAcknowledge = () => mayRecordAcknowledgement(this.actor());
  isMine = (r: DisciplinaryRecord) => isOwnRecord(r, this.actor());

  /**
   * Is this a record the viewer could decide the appeal on, but for having
   * issued it?
   *
   * Surfaced as a note rather than silence, the same as leave's self-approval:
   * an appeal officer who sees no controls on a warning they issued would
   * otherwise assume the screen is broken.
   */
  isOwnIssuedAppeal = (r: DisciplinaryRecord) =>
    this.actor().canDecideAppeal
    && !!r.appeal?.submittedAt
    && !r.appeal?.outcome
    && !!r.issuedBy
    && r.issuedBy === this.actor().actorEmployeeId;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [records, catalog, fileCatalog] = await Promise.all([
        this.service.records(this.employeeId),
        this.service.catalog().catch(() => this.catalog()),
        this.service.fileCatalog().catch(() => null),
      ]);
      this.records.set(records);
      this.catalog.set(catalog);
      this.fileCatalog.set(fileCatalog);

      // Fetched separately and allowed to fail on its own: the server refuses
      // it to the subject and to a manager while still serving them the
      // records, so a refusal here must not take the tab down.
      if (this.canSeeEscalation()) {
        this.escalation.set(await this.service.escalation(this.employeeId).catch(() => null));
      } else {
        this.escalation.set(null);
      }
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Issuing a warning ─────────────────────────────────────────────────

  readonly editing = signal<string | null>(null);

  readonly form = this.fb.group({
    warningType: this.fb.control<string | null>(null, Validators.required),
    severity: this.fb.control<string | null>(null, Validators.required),
    reason: this.fb.control<string | null>(null, Validators.required),
    incidentDate: this.fb.control<string | null>(null, Validators.required),
    reportedDate: this.fb.control<string | null>(null, Validators.required),
    expiryDate: this.fb.control<string | null>(null),
    statementDeadline: this.fb.control<string | null>(null),
    description: this.fb.control<string | null>(null),
    actionTaken: this.fb.control<string>('', Validators.required),
    payrollImpact: this.fb.control<string | null>(null),
    notes: this.fb.control<string | null>(null),
  });

  /** Today, so the incident-date field can refuse the future the server refuses. */
  readonly today = new Date().toISOString().slice(0, 10);

  startAdd(): void {
    this.form.reset({
      warningType: null, severity: null, reason: null,
      incidentDate: null, reportedDate: null, expiryDate: null,
      statementDeadline: null, description: null, actionTaken: '',
      payrollImpact: null, notes: null,
    });
    this.error.set(null);
    this.editing.set('new');
  }

  startEdit(r: DisciplinaryRecord): void {
    this.form.reset({
      warningType: r.warningType || null,
      severity: r.severity,
      reason: r.reason,
      incidentDate: r.incidentDate,
      reportedDate: r.reportedDate,
      expiryDate: r.expiryDate,
      statementDeadline: r.statementDeadline,
      description: r.description,
      actionTaken: r.actionTaken ?? '',
      payrollImpact: r.payrollImpact,
      notes: r.notes,
    });
    this.error.set(null);
    this.editing.set(r.id);
  }

  cancelEdit(): void { this.editing.set(null); }

  async submit(): Promise<void> {
    const editing = this.editing();
    if (!editing) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(editing);
    this.error.set(null);
    try {
      await this.service.save({
        ...(editing === 'new' ? {} : { id: editing }),
        employeeId: this.employeeId,
        ...this.form.getRawValue(),
      });
      this.editing.set(null);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  async remove(r: DisciplinaryRecord): Promise<void> {
    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.remove(r.id);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── The employee's statement ──────────────────────────────────────────

  readonly writingStatement = signal<string | null>(null);
  readonly statementText = signal('');

  startStatement(r: DisciplinaryRecord): void {
    this.statementText.set(r.employeeStatement ?? '');
    this.writingStatement.set(r.id);
  }

  onStatementInput(event: Event): void {
    this.statementText.set((event.target as HTMLTextAreaElement).value);
  }

  async saveStatement(r: DisciplinaryRecord): Promise<void> {
    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.saveStatement(r.id, this.statementText());
      this.writingStatement.set(null);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Acknowledgement, and the witness rule ─────────────────────────────

  readonly acknowledging = signal<string | null>(null);
  readonly ackRefused = signal(false);
  readonly ackWitness = signal('');

  startAcknowledge(r: DisciplinaryRecord): void {
    this.ackRefused.set(false);
    this.ackWitness.set('');
    this.acknowledging.set(r.id);
  }

  onRefusedChange(event: Event): void {
    this.ackRefused.set((event.target as HTMLInputElement).checked);
  }

  onWitnessInput(event: Event): void {
    this.ackWitness.set((event.target as HTMLInputElement).value);
  }

  /**
   * Enforced here as well as server-side, deliberately.
   *
   * The witness can only be obtained at the moment of entry. Letting the save
   * through and reporting the error afterwards means the person has already
   * walked away, and the temptation is then to name whoever is nearest.
   */
  readonly ackComplete = computed(() =>
    acknowledgementIsComplete({
      acknowledged: !this.ackRefused(),
      refusedToSign: this.ackRefused(),
      witnessName: this.ackWitness(),
    }));

  async saveAcknowledgement(r: DisciplinaryRecord): Promise<void> {
    if (!this.ackComplete()) return;
    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.acknowledge(r.id, this.ackRefused()
        ? { refusedToSign: true, witnessName: this.ackWitness().trim() }
        : { acknowledged: true });
      this.acknowledging.set(null);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Appeals ───────────────────────────────────────────────────────────

  readonly appealing = signal<string | null>(null);
  readonly appealGrounds = signal('');

  startAppeal(r: DisciplinaryRecord): void {
    this.appealGrounds.set(r.appeal?.grounds ?? '');
    this.appealing.set(r.id);
  }

  onGroundsInput(event: Event): void {
    this.appealGrounds.set((event.target as HTMLTextAreaElement).value);
  }

  readonly appealValid = computed(() => this.appealGrounds().trim().length > 0);

  async submitAppeal(r: DisciplinaryRecord): Promise<void> {
    if (!this.appealValid()) return;
    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.appeal(r.id, this.appealGrounds().trim());
      this.appealing.set(null);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  async decideAppeal(r: DisciplinaryRecord, outcome: string): Promise<void> {
    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.decideAppeal(r.id, outcome);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Attachments ───────────────────────────────────────────────────────

  async onFilePicked(r: DisciplinaryRecord, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const catalog = this.fileCatalog();
    if (catalog) {
      if (catalog.accepted.length && !catalog.accepted.includes(file.type)) {
        this.error.set({ titleKey: 'EMPLOYEES.HR.ERR.TYPE_REJECTED', detail: file.type || file.name, hintKey: null });
        return;
      }
      if (file.size > catalog.maxBytes) {
        this.error.set({ titleKey: 'EMPLOYEES.HR.ERR.TOO_LARGE', detail: `${Math.round(file.size / 1024 / 1024)}MB`, hintKey: null });
        return;
      }
    }

    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.upload(r.id, file);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  /** Evidence on a warning is confidential; every URL issued is audited. */
  async download(file: HrFile): Promise<void> {
    this.busy.set(file.id);
    this.error.set(null);
    try {
      const { url } = await this.service.downloadUrl(file.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Display helpers ───────────────────────────────────────────────────

  typeLabel(r: DisciplinaryRecord): string {
    const found = this.catalog().warningTypes.find(w => w.key === r.warningType);
    return found?.labelKey ? portalKey(found.labelKey) : r.warningType;
  }

  severityLabel(r: DisciplinaryRecord): string {
    const found = this.catalog().severities.find(s => s.key === r.severity);
    return found?.labelKey ? portalKey(found.labelKey) : (r.severity ?? '');
  }

  reasonLabel(r: DisciplinaryRecord): string {
    const found = this.catalog().reasons.find(x => x.key === r.reason);
    return found?.labelKey ? portalKey(found.labelKey) : (r.reason ?? '');
  }

  outcomeLabel(outcome: string | null): string {
    if (!outcome) return '';
    const found = this.catalog().appealOutcomes.find(o => o.key === outcome);
    return found?.labelKey ? portalKey(found.labelKey) : outcome;
  }

  /** Does this outcome withdraw the warning? Read from the catalogue. */
  outcomeOverturns(outcome: string | null): boolean | null {
    if (!outcome) return null;
    const found = this.catalog().appealOutcomes.find(o => o.key === outcome);
    return found ? found.overturnsRecord === true : null;
  }

  /** Does this warning type end employment? Suspension and dismissal are outcomes. */
  endsEmployment(r: DisciplinaryRecord): boolean | null {
    const found = this.catalog().warningTypes.find(w => w.key === r.warningType);
    return found ? found.endsEmployment === true : null;
  }

  /**
   * The spent badge. Three states — the null one is its own.
   *
   * A record whose spent state is unknown must not read as live, and must not
   * read as spent either.
   */
  spentClass(r: DisciplinaryRecord): string {
    if (r.isSpent === true) return 'disc-badge disc-badge--spent';
    if (r.isSpent === false) return 'disc-badge disc-badge--live';
    return 'disc-badge disc-badge--unknown';
  }

  spentKey(r: DisciplinaryRecord): string {
    if (r.isSpent === true) return 'EMPLOYEES.DISCIPLINARY.SPENT';
    if (r.isSpent === false) return 'EMPLOYEES.DISCIPLINARY.LIVE';
    return 'EMPLOYEES.DISCIPLINARY.SPENT_UNKNOWN';
  }

  /** The escalation level as a warning-type name, when the catalogue can say. */
  escalationLabel(): string {
    const level = this.escalation()?.level;
    if (level === null || level === undefined) return '';
    if (level === 0) return 'EMPLOYEES.DISCIPLINARY.NO_LIVE_WARNINGS';
    const found = this.catalog().warningTypes.find(w => w.rank === level);
    return found?.labelKey ? portalKey(found.labelKey) : '';
  }

  optionKey = (o: { key: string }) => o.key;
  optionName = (o: { key: string; labelKey?: string }) =>
    o?.labelKey ? this.translate.instant(portalKey(o.labelKey)) : String(o?.key ?? '');
  optionMatches = (a: any, b: any) => (a?.key ?? a) === (b?.key ?? b);

  fileSize(file: HrFile): string {
    if (file.sizeBytes === null) return '';
    if (file.sizeBytes < 1024) return `${file.sizeBytes} B`;
    if (file.sizeBytes < 1024 * 1024) return `${Math.round(file.sizeBytes / 1024)} KB`;
    return `${(file.sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  }

  trackRecord = (_: number, r: DisciplinaryRecord) => r.id;
  trackFile = (_: number, f: HrFile) => f.id;
}
