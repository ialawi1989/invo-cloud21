import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/http/api.service';
import {
  FILE_ENTITY,
  FileCatalog,
  HrFile,
  EmployeeFileService,
  mapHrFiles,
} from './employee-file.service';

/**
 * Performance reviews and trainings.
 *
 * ── THREE SCORES, AND THEY ARE NOT INTERCHANGEABLE ───────────────────────────
 * The server sends all three on every review and the distinction is the point:
 *
 *   finalScore       computed from the goals and competencies on the row.
 *   calibratedScore  a human override, with a reason and an author. Null when
 *                    nobody has moderated the review.
 *   effectiveScore   `calibratedScore ?? finalScore` — which one actually counts.
 *
 * The server NEVER overwrites the computed figure when a calibration lands.
 * That is what the spec means by "original preserved", and rendering only
 * `effectiveScore` would destroy exactly what it went to the trouble of
 * keeping: that someone's number was changed by hand, by whom, and why.
 *
 * `goalScore` and `competencyScore` are computed on read too, from the stored
 * goals and competencies — none of them is a stored column. A stored score can
 * disagree with the numbers it came from the moment either is edited, and a
 * score that contradicts its own inputs is the worst thing in HR to be on the
 * wrong end of.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ReviewFile = HrFile;

export interface ReviewGoal {
  title: string | null;
  metric: string | null;
  target: number | null;
  weight: number | null;
  achieved: number | null;
}

export interface ReviewCompetency {
  competency: string | null;
  rating: number | null;
  comment: string | null;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  reviewCycle: string | null;
  status: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  nextReviewDate: string | null;
  reviewerId: string | null;
  reviewerName: string | null;
  goals: ReviewGoal[];
  competencies: ReviewCompetency[];
  selfAssessment: string | null;
  managerFeedback: string | null;
  pip: string | null;

  /** Computed from goals and competencies. Null when nothing is scoreable. */
  goalScore: number | null;
  competencyScore: number | null;
  finalScore: number | null;
  /** The human override. Null means nobody has calibrated this review. */
  calibratedScore: number | null;
  calibrationReason: string | null;
  calibratedBy: string | null;
  calibratedAt: string | null;
  /** Which score counts. Shown WITH the other two, never instead of them. */
  effectiveScore: number | null;

  acknowledgedAt: string | null;
  acknowledgementComment: string | null;
  /** The server's own reading of `locked` from the status catalogue. */
  isFinal: boolean | null;
  files: ReviewFile[];
}

/**
 * One review status from the server's catalogue.
 *
 * ── THE TWO FLAGS ARE THE RULES ──────────────────────────────────────────────
 * `employeeMayWrite` is the self-assessment window; `locked` means the review
 * is finished and its scores are history. The repo enforces both — a
 * self-assessment outside the window and a calibration on a locked review are
 * refused on exactly these flags.
 *
 * **Read them from here, never hardcode which statuses allow what.** Same
 * reasoning as the asset return flags: a second copy of the lifecycle in the
 * portal drifts the moment a status is added, and the server's is the one that
 * refuses.
 */
export interface ReviewStatusDescriptor {
  key: string;
  labelKey: string;
  employeeMayWrite: boolean;
  locked: boolean;
}

export interface PerformanceCatalog {
  cycles: { key: string; labelKey: string; months: number }[];
  statuses: ReviewStatusDescriptor[];
  ratingScale: { value: number; labelKey: string }[];
}

/**
 * A training course.
 *
 * ── NO COMPUTED EXPIRY STATE, UNLIKE DOCUMENTS ───────────────────────────────
 * `getTrainings` returns the rows undecorated: there is no `status` and no
 * `daysRemaining`, where a document gets both. The expiry date still feeds the
 * reminder engine server-side, but nothing computes a badge for it.
 *
 * So this tab shows the date and does NOT invent a status. Computing "expiring"
 * here would be the portal deciding a rule the server has not stated, and the
 * first time the server states a different one the two would disagree with
 * nothing on screen to say which is right.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface EmployeeTraining {
  id: string;
  employeeId: string;
  reviewId: string | null;
  name: string;
  provider: string | null;
  completionDate: string | null;
  expiryDate: string | null;
  cost: number | null;
  reminderDays: number[];
  notes: string | null;
  files: ReviewFile[];
}

export const REVIEW_ENTITY = FILE_ENTITY.performance;
export const TRAINING_ENTITY = FILE_ENTITY.training;

@Injectable({ providedIn: 'root' })
export class EmployeePerformanceService {
  private api = inject(ApiService);
  private files = inject(EmployeeFileService);

  // ─── Reviews ───────────────────────────────────────────────────────────

  async reviews(employeeId: string): Promise<PerformanceReview[]> {
    const res = await this.api.request<any>(this.api.get(`employee/getReviews/${employeeId}`));
    const rows: any[] = Array.isArray(res?.data) ? res.data : [];
    return rows.map(r => this.mapReview(r));
  }

  async saveReview(payload: Record<string, unknown>): Promise<{ id: string }> {
    const res = await this.api.request<any>(this.api.post('employee/saveReview', payload));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the review');
    return { id: res?.data?.id ?? '' };
  }

  /**
   * The employee's own words.
   *
   * Its own endpoint with NO privilege check server-side: the rule is "your own
   * review, window open", and both facts live on the row. That is deliberate —
   * no privilege can stand in for being the subject, so a manager cannot write
   * the employee's assessment for them.
   */
  async saveSelfAssessment(reviewId: string, text: string): Promise<void> {
    const res = await this.api.request<any>(
      this.api.post('employee/saveSelfAssessment', { reviewId, text }),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the self-assessment');
  }

  /**
   * Override the computed score.
   *
   * `reason` is required by the server and refused if blank — a moderated score
   * with no explanation is a number nobody can defend to the person it is
   * about. The computed figure is left untouched.
   */
  async calibrate(reviewId: string, score: number, reason: string): Promise<void> {
    const res = await this.api.request<any>(
      this.api.post('employee/calibrateReview', { reviewId, score, reason }),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not calibrate the review');
  }

  /** The employee's act, and the one that makes a review final. */
  async acknowledge(reviewId: string, comment: string | null): Promise<void> {
    const res = await this.api.request<any>(
      this.api.post('employee/acknowledgeReview', { reviewId, comment }),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not acknowledge the review');
  }

  async removeReview(reviewId: string): Promise<void> {
    const res = await this.api.request<any>(this.api.get(`employee/deleteReview/${reviewId}`));
    if (res?.success === false) throw new Error(res?.msg || 'Could not delete the review');
  }

  async catalog(): Promise<PerformanceCatalog> {
    const res = await this.api.request<any>(this.api.get('employee/performanceCatalog'));
    return {
      cycles: Array.isArray(res?.data?.cycles) ? res.data.cycles : [],
      statuses: Array.isArray(res?.data?.statuses) ? res.data.statuses : [],
      ratingScale: Array.isArray(res?.data?.ratingScale) ? res.data.ratingScale : [],
    };
  }

  // ─── Trainings ─────────────────────────────────────────────────────────

  async trainings(employeeId: string): Promise<EmployeeTraining[]> {
    const res = await this.api.request<any>(this.api.get(`employee/getTrainings/${employeeId}`));
    const rows: any[] = Array.isArray(res?.data) ? res.data : [];
    return rows.map(r => this.mapTraining(r));
  }

  async saveTraining(payload: Record<string, unknown>): Promise<{ id: string }> {
    const res = await this.api.request<any>(this.api.post('employee/saveTraining', payload));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the training');
    return { id: res?.data?.id ?? '' };
  }

  async removeTraining(trainingId: string): Promise<void> {
    const res = await this.api.request<any>(this.api.get(`employee/deleteTraining/${trainingId}`));
    if (res?.success === false) throw new Error(res?.msg || 'Could not delete the training');
  }

  // ─── Attachments ───────────────────────────────────────────────────────
  // Two entities, and they differ: a PIP document is CONFIDENTIAL — it is about
  // someone's job security, so downloads are audited — while a course
  // certificate is not.

  fileCatalog(): Promise<FileCatalog> {
    return this.files.catalog();
  }

  uploadReviewFile(reviewId: string, file: File): Promise<void> {
    return this.files.upload(REVIEW_ENTITY, reviewId, file);
  }

  uploadTrainingFile(trainingId: string, file: File): Promise<void> {
    return this.files.upload(TRAINING_ENTITY, trainingId, file);
  }

  reviewFileUrl(fileId: string): Promise<{ url: string; fileName: string }> {
    return this.files.downloadUrl(REVIEW_ENTITY, fileId);
  }

  trainingFileUrl(fileId: string): Promise<{ url: string; fileName: string }> {
    return this.files.downloadUrl(TRAINING_ENTITY, fileId);
  }

  // ─── Mapping ───────────────────────────────────────────────────────────

  private mapReview(r: any): PerformanceReview {
    return {
      id: r?.id ?? '',
      employeeId: r?.employeeId ?? '',
      reviewCycle: r?.reviewCycle ?? null,
      status: r?.status ?? null,
      periodStart: r?.periodStart ?? null,
      periodEnd: r?.periodEnd ?? null,
      nextReviewDate: r?.nextReviewDate ?? null,
      reviewerId: r?.reviewerId ?? null,
      reviewerName: r?.reviewerName ?? null,
      goals: Array.isArray(r?.goals) ? r.goals.map((g: any) => this.mapGoal(g)) : [],
      competencies: Array.isArray(r?.competencies)
        ? r.competencies.map((c: any) => ({
            competency: c?.competency ?? null,
            rating: num(c?.rating),
            comment: c?.comment ?? null,
          }))
        : [],
      selfAssessment: r?.selfAssessment ?? null,
      managerFeedback: r?.managerFeedback ?? null,
      pip: r?.pip ?? null,

      // All four taken as sent, all four nullable. `num` rather than a
      // `typeof === 'number'` guard because `calibratedScore` is a Postgres
      // numeric and arrives as a STRING — discarding it would show a calibrated
      // review as never having been calibrated.
      goalScore: num(r?.goalScore),
      competencyScore: num(r?.competencyScore),
      finalScore: num(r?.finalScore),
      calibratedScore: num(r?.calibratedScore),
      calibrationReason: r?.calibrationReason ?? null,
      calibratedBy: r?.calibratedBy ?? null,
      calibratedAt: r?.calibratedAt ?? null,
      effectiveScore: num(r?.effectiveScore),

      acknowledgedAt: r?.acknowledgedAt ?? null,
      acknowledgementComment: r?.acknowledgementComment ?? null,
      isFinal: typeof r?.isFinal === 'boolean' ? r.isFinal : null,
      files: mapHrFiles(r?.files),
    };
  }

  private mapGoal(g: any): ReviewGoal {
    return {
      title: g?.title ?? null,
      metric: g?.metric ?? null,
      target: num(g?.target),
      weight: num(g?.weight),
      // Null, not zero. Zero achieved against a target is a real and very
      // different statement from "no outcome recorded yet", and the server's
      // scoring excludes the latter from the weighting entirely.
      achieved: num(g?.achieved),
    };
  }

  private mapTraining(r: any): EmployeeTraining {
    return {
      id: r?.id ?? '',
      employeeId: r?.employeeId ?? '',
      reviewId: r?.reviewId ?? null,
      name: r?.name ?? '',
      provider: r?.provider ?? null,
      completionDate: r?.completionDate ?? null,
      expiryDate: r?.expiryDate ?? null,
      cost: num(r?.cost),
      reminderDays: Array.isArray(r?.reminderDays) ? r.reminderDays : [],
      notes: r?.notes ?? null,
      files: mapHrFiles(r?.files),
    };
  }
}

/**
 * A numeric column as a number, or null.
 *
 * Postgres returns `numeric` through node-postgres as a STRING, so
 * `calibratedScore` and `cost` arrive as `"78.50"`. A `typeof === 'number'`
 * guard alone would discard them and render them in the unknown state — which
 * is worse than a crash here, because the unknown state was built deliberately
 * and looks exactly like the server having sent nothing.
 *
 * Null stays null. Only an actual number survives.
 */
function num(v: any): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }
  return null;
}
