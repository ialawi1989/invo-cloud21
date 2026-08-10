import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { HrError, describeError } from '../../hr-error';
import { portalKey } from '../../hr-labels';
import { hrGrantFor } from '../../hr-privilege';
import { FileCatalog, HrFile } from '../../services/employee-file.service';
import {
  EmployeePerformanceService,
  EmployeeTraining,
  PerformanceCatalog,
  PerformanceReview,
} from '../../services/employee-performance.service';
import {
  ReviewActor,
  isLocked,
  isReviewer,
  isSubject,
  mayAcknowledge,
  mayCalibrate,
  mayEditReview,
  mayWriteSelfAssessment,
  weightTotal,
  weightsAreValid,
} from './review-rules';

/**
 * The performance tab — reviews and trainings.
 *
 * ── ALL THREE SCORES ARE SHOWN, AND THE OVERRIDE IS SHOWN AS AN OVERRIDE ─────
 * The server preserves the computed figure when a score is moderated. Rendering
 * only `effectiveScore` would throw that away — which is the entire point of
 * keeping it. A calibrated review shows the computed number, the override, who
 * made it and why, side by side.
 *
 * ── THE LIFECYCLE COMES FROM THE CATALOGUE ───────────────────────────────────
 * Which statuses let the employee write, and which lock the review, are read
 * off the server's status list. Nothing here hardcodes the lifecycle. See
 * review-rules.ts.
 *
 * ── FOUR PERMISSIONS, ASKED PER REVIEW ───────────────────────────────────────
 * edit, calibrate, self-assess and acknowledge are four different questions
 * with four different answers, and two of them are the employee's own acts
 * authorised against the row rather than against any privilege.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Component({
  selector: 'app-employee-performance',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TranslateModule,
    SearchDropdownComponent, MycurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-performance.component.html',
  styleUrls: ['./employee-performance.component.scss'],
})
export class EmployeePerformanceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(EmployeePerformanceService);
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

  readonly reviews = signal<PerformanceReview[]>([]);
  readonly trainings = signal<EmployeeTraining[]>([]);
  readonly catalog = signal<PerformanceCatalog>({ cycles: [], statuses: [], ratingScale: [] });
  readonly fileCatalog = signal<FileCatalog | null>(null);

  readonly actor = computed<ReviewActor>(() => ({
    actorEmployeeId: (this.auth.currentEmployee as any)?.id ?? null,
    subjectEmployeeId: this.employeeId,
    canView: hrGrantFor(this.privileges, this.auth, 'employeePerformanceSecurity', 'view'),
    canEdit: hrGrantFor(this.privileges, this.auth, 'employeePerformanceSecurity', 'edit'),
    // A separate grant from edit, deliberately — see review-rules.ts.
    canCalibrate: hrGrantFor(this.privileges, this.auth, 'employeePerformanceSecurity', 'calibrate'),
  }));

  readonly canEditAnything = computed(() => this.actor().canEdit);
  readonly canUpload = computed(() => this.fileCatalog()?.storageConfigured === true);
  readonly catalogMissing = computed(() => this.catalog().statuses.length === 0);

  /** Per review, because the answers differ per row. */
  mayEdit = (r: PerformanceReview) => mayEditReview(r, this.actor(), this.catalog().statuses);
  mayCalibrate = (r: PerformanceReview) => mayCalibrate(r, this.actor(), this.catalog().statuses);
  maySelfAssess = (r: PerformanceReview) =>
    mayWriteSelfAssessment(r, this.actor(), this.catalog().statuses);
  mayAcknowledge = (r: PerformanceReview) => mayAcknowledge(r, this.actor());
  isReviewerOf = (r: PerformanceReview) => isReviewer(r, this.actor());
  locked = (r: PerformanceReview) => isLocked(r, this.catalog().statuses);
  readonly isOwnRecord = computed(() => isSubject(this.actor()));

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [reviews, trainings, catalog, fileCatalog] = await Promise.all([
        this.service.reviews(this.employeeId),
        this.service.trainings(this.employeeId).catch(() => [] as EmployeeTraining[]),
        this.service.catalog().catch(() => this.catalog()),
        this.service.fileCatalog().catch(() => null),
      ]);
      this.reviews.set(reviews);
      this.trainings.set(trainings);
      this.catalog.set(catalog);
      this.fileCatalog.set(fileCatalog);
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Scores, shown as three things ─────────────────────────────────────

  /** Has anyone moderated this review? */
  isCalibrated(r: PerformanceReview): boolean {
    return r.calibratedScore !== null;
  }

  /**
   * Formats a score, or the unknown marker.
   *
   * Null is rendered as "—", never as 0. Zero is a real and very different
   * statement about someone's year from "nothing scoreable yet", and the
   * server's own scoring returns null for exactly that case.
   */
  score(value: number | null): string {
    return value === null ? '—' : String(value);
  }

  // ─── The review editor ─────────────────────────────────────────────────

  readonly editing = signal<string | null>(null);

  readonly form = this.fb.group({
    reviewCycle: this.fb.control<string | null>(null, Validators.required),
    status: this.fb.control<string>('Draft', Validators.required),
    periodStart: this.fb.control<string | null>(null, Validators.required),
    periodEnd: this.fb.control<string | null>(null, Validators.required),
    reviewerName: this.fb.control<string | null>(null),
    managerFeedback: this.fb.control<string | null>(null),
    pip: this.fb.control<string | null>(null),
    goals: this.fb.array<any>([]),
    competencies: this.fb.array<any>([]),
  });

  get goals(): FormArray { return this.form.controls.goals as FormArray; }
  get competencies(): FormArray { return this.form.controls.competencies as FormArray; }

  /**
   * The live weight total.
   *
   * A signal driven by an explicit bump rather than by `valueChanges`, so the
   * template re-reads it on every keystroke without a subscription per goal row.
   */
  readonly weightTick = signal(0);

  readonly currentWeightTotal = computed(() => {
    this.weightTick();
    return weightTotal(this.goals.getRawValue());
  });

  /**
   * Do the weights satisfy the server's rule?
   *
   * Shown as it is typed. The server refuses a non-empty goal list that does
   * not total 100, and finding that out after entering six goals is a bad way
   * to learn the rule.
   */
  readonly weightsOk = computed(() => {
    this.weightTick();
    return weightsAreValid(this.goals.getRawValue());
  });

  onWeightInput(): void {
    this.weightTick.update(n => n + 1);
  }

  private goalGroup(g?: any) {
    return this.fb.group({
      title: this.fb.control<string | null>(g?.title ?? null, Validators.required),
      metric: this.fb.control<string | null>(g?.metric ?? null),
      target: this.fb.control<number | null>(g?.target ?? null),
      weight: this.fb.control<number | null>(g?.weight ?? null),
      achieved: this.fb.control<number | null>(g?.achieved ?? null),
    });
  }

  private competencyGroup(c?: any) {
    return this.fb.group({
      competency: this.fb.control<string | null>(c?.competency ?? null, Validators.required),
      rating: this.fb.control<number | null>(c?.rating ?? null),
      comment: this.fb.control<string | null>(c?.comment ?? null),
    });
  }

  addGoal(): void { this.goals.push(this.goalGroup()); this.onWeightInput(); }
  removeGoal(i: number): void { this.goals.removeAt(i); this.onWeightInput(); }
  addCompetency(): void { this.competencies.push(this.competencyGroup()); }
  removeCompetency(i: number): void { this.competencies.removeAt(i); }

  startAdd(): void {
    this.form.reset({
      reviewCycle: null, status: 'Draft', periodStart: null, periodEnd: null,
      reviewerName: null, managerFeedback: null, pip: null,
    });
    this.goals.clear();
    this.competencies.clear();
    this.onWeightInput();
    this.error.set(null);
    this.editing.set('new');
  }

  startEdit(r: PerformanceReview): void {
    this.form.reset({
      reviewCycle: r.reviewCycle,
      status: r.status ?? 'Draft',
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      reviewerName: r.reviewerName,
      managerFeedback: r.managerFeedback,
      pip: r.pip,
    });
    this.goals.clear();
    r.goals.forEach(g => this.goals.push(this.goalGroup(g)));
    this.competencies.clear();
    r.competencies.forEach(c => this.competencies.push(this.competencyGroup(c)));
    this.onWeightInput();
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
    // Refused here as well as server-side, because the server's message arrives
    // after the whole form has been filled in.
    if (!this.weightsOk()) return;

    this.busy.set(editing);
    this.error.set(null);
    try {
      await this.service.saveReview({
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

  async remove(r: PerformanceReview): Promise<void> {
    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.removeReview(r.id);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── The employee's own acts ───────────────────────────────────────────

  readonly selfAssessing = signal<string | null>(null);
  readonly selfAssessmentText = signal('');

  startSelfAssessment(r: PerformanceReview): void {
    this.selfAssessmentText.set(r.selfAssessment ?? '');
    this.selfAssessing.set(r.id);
  }

  onSelfAssessmentInput(event: Event): void {
    this.selfAssessmentText.set((event.target as HTMLTextAreaElement).value);
  }

  async saveSelfAssessment(r: PerformanceReview): Promise<void> {
    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.saveSelfAssessment(r.id, this.selfAssessmentText());
      this.selfAssessing.set(null);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  readonly acknowledgeComment = signal('');

  onAcknowledgeInput(event: Event): void {
    this.acknowledgeComment.set((event.target as HTMLInputElement).value);
  }

  async acknowledge(r: PerformanceReview): Promise<void> {
    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.acknowledge(r.id, this.acknowledgeComment() || null);
      this.acknowledgeComment.set('');
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Calibration ───────────────────────────────────────────────────────

  readonly calibrating = signal<string | null>(null);
  readonly calibrationScore = signal<number | null>(null);
  readonly calibrationReason = signal('');

  startCalibration(r: PerformanceReview): void {
    // Seeded from the current effective figure, so the moderator adjusts from
    // where the review actually stands rather than from an empty box.
    this.calibrationScore.set(r.effectiveScore);
    this.calibrationReason.set(r.calibrationReason ?? '');
    this.calibrating.set(r.id);
  }

  onCalibrationScore(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.calibrationScore.set(v === '' ? null : Number(v));
  }

  onCalibrationReason(event: Event): void {
    this.calibrationReason.set((event.target as HTMLTextAreaElement).value);
  }

  /** The server refuses a calibration with no reason; so does the button. */
  readonly calibrationValid = computed(() => {
    const score = this.calibrationScore();
    return score !== null && score >= 0 && score <= 100
      && this.calibrationReason().trim().length > 0;
  });

  async saveCalibration(r: PerformanceReview): Promise<void> {
    if (!this.calibrationValid()) return;
    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.calibrate(r.id, this.calibrationScore()!, this.calibrationReason().trim());
      this.calibrating.set(null);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Trainings ─────────────────────────────────────────────────────────

  readonly editingTraining = signal<string | null>(null);

  readonly trainingForm = this.fb.group({
    name: this.fb.control<string>('', Validators.required),
    provider: this.fb.control<string | null>(null),
    completionDate: this.fb.control<string | null>(null),
    expiryDate: this.fb.control<string | null>(null),
    cost: this.fb.control<number | null>(null),
    notes: this.fb.control<string | null>(null),
  });

  startAddTraining(): void {
    this.trainingForm.reset({
      name: '', provider: null, completionDate: null,
      expiryDate: null, cost: null, notes: null,
    });
    this.error.set(null);
    this.editingTraining.set('new');
  }

  startEditTraining(t: EmployeeTraining): void {
    this.trainingForm.reset({
      name: t.name,
      provider: t.provider,
      completionDate: t.completionDate,
      expiryDate: t.expiryDate,
      cost: t.cost,
      notes: t.notes,
    });
    this.error.set(null);
    this.editingTraining.set(t.id);
  }

  cancelTraining(): void { this.editingTraining.set(null); }

  async submitTraining(): Promise<void> {
    const editing = this.editingTraining();
    if (!editing) return;
    if (this.trainingForm.invalid) {
      this.trainingForm.markAllAsTouched();
      return;
    }
    this.busy.set(editing);
    this.error.set(null);
    try {
      await this.service.saveTraining({
        ...(editing === 'new' ? {} : { id: editing }),
        employeeId: this.employeeId,
        ...this.trainingForm.getRawValue(),
      });
      this.editingTraining.set(null);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  async removeTraining(t: EmployeeTraining): Promise<void> {
    this.busy.set(t.id);
    this.error.set(null);
    try {
      await this.service.removeTraining(t.id);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Attachments ───────────────────────────────────────────────────────

  private checkFile(file: File): boolean {
    const catalog = this.fileCatalog();
    if (!catalog) return true;
    if (catalog.accepted.length && !catalog.accepted.includes(file.type)) {
      this.error.set({ titleKey: 'EMPLOYEES.HR.ERR.TYPE_REJECTED', detail: file.type || file.name, hintKey: null });
      return false;
    }
    if (file.size > catalog.maxBytes) {
      this.error.set({ titleKey: 'EMPLOYEES.HR.ERR.TOO_LARGE', detail: `${Math.round(file.size / 1024 / 1024)}MB`, hintKey: null });
      return false;
    }
    return true;
  }

  async onReviewFilePicked(r: PerformanceReview, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.checkFile(file)) return;

    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.uploadReviewFile(r.id, file);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  async onTrainingFilePicked(t: EmployeeTraining, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.checkFile(file)) return;

    this.busy.set(t.id);
    this.error.set(null);
    try {
      await this.service.uploadTrainingFile(t.id, file);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  /** A PIP document is confidential; every signed URL issued for one is audited. */
  async downloadReviewFile(file: HrFile): Promise<void> {
    await this.openUrl(file, () => this.service.reviewFileUrl(file.id));
  }

  async downloadTrainingFile(file: HrFile): Promise<void> {
    await this.openUrl(file, () => this.service.trainingFileUrl(file.id));
  }

  private async openUrl(file: HrFile, get: () => Promise<{ url: string }>): Promise<void> {
    this.busy.set(file.id);
    this.error.set(null);
    try {
      const { url } = await get();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Display helpers ───────────────────────────────────────────────────

  statusLabel(r: PerformanceReview): string {
    const found = this.catalog().statuses.find(s => s.key === r.status);
    return found?.labelKey ? portalKey(found.labelKey) : (r.status ?? '');
  }

  statusClass(r: PerformanceReview): string {
    if (this.locked(r) === true) return 'perf-badge perf-badge--final';
    if (r.status === 'AwaitingAcknowledgement') return 'perf-badge perf-badge--awaiting';
    if (r.status === 'SelfAssessment') return 'perf-badge perf-badge--self';
    if (r.status) return 'perf-badge perf-badge--open';
    // No status from the server. Its own look, never a real state's.
    return 'perf-badge perf-badge--unknown';
  }

  cycleLabel(r: PerformanceReview): string {
    const found = this.catalog().cycles.find(c => c.key === r.reviewCycle);
    return found?.labelKey ? portalKey(found.labelKey) : (r.reviewCycle ?? '');
  }

  ratingLabel(rating: number | null): string {
    if (rating === null) return '';
    const found = this.catalog().ratingScale.find(x => x.value === rating);
    return found?.labelKey ? portalKey(found.labelKey) : String(rating);
  }

  /** Only the statuses the editor may set. Locked is reached by acknowledging. */
  readonly editableStatuses = computed(() =>
    this.catalog().statuses.filter(s => !s.locked));

  optionKey = (o: { key: string }) => o.key;
  optionName = (o: { key: string; labelKey?: string }) =>
    o?.labelKey ? this.translate.instant(portalKey(o.labelKey)) : String(o?.key ?? '');
  optionMatches = (a: any, b: any) => (a?.key ?? a) === (b?.key ?? b);

  ratingKey = (o: { value: number }) => o.value;
  ratingName = (o: { value: number; labelKey: string }) =>
    o?.labelKey ? this.translate.instant(portalKey(o.labelKey)) : String(o?.value ?? '');
  ratingMatches = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);

  fileSize(file: HrFile): string {
    if (file.sizeBytes === null) return '';
    if (file.sizeBytes < 1024) return `${file.sizeBytes} B`;
    if (file.sizeBytes < 1024 * 1024) return `${Math.round(file.sizeBytes / 1024)} KB`;
    return `${(file.sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /** Ids, so a reload after a calibration does not rebuild every card. */
  trackReview = (_: number, r: PerformanceReview) => r.id;
  trackTraining = (_: number, t: EmployeeTraining) => t.id;
  trackFile = (_: number, f: HrFile) => f.id;
  trackIndex = (i: number) => i;
}
