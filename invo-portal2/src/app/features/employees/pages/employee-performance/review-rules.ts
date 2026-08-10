import {
  PerformanceReview,
  ReviewGoal,
  ReviewStatusDescriptor,
} from '../../services/employee-performance.service';

/**
 * Who may do what to a review, and whether its goal weights add up.
 *
 * ── FOUR DISTINCT PERMISSIONS ON ONE SCREEN ──────────────────────────────────
 * Performance has more moving parts than any other HR module, and per-screen
 * gating cannot express them:
 *
 *   read       the view grant, the SUBJECT, or the named REVIEWER on the row
 *   edit       the edit grant — whoever conducts the review
 *   calibrate  a SEPARATE grant. The point of moderation is that it is not the
 *              reviewer restating their own arithmetic, so someone who may
 *              write a review must not thereby be able to override its score.
 *   self-assess
 *   acknowledge
 *              the EMPLOYEE's own acts. Authorised against the ROW'S STATUS,
 *              not against any privilege — the server's endpoints check
 *              `employeeId === caller` and the status flags, and deliberately
 *              check no privilege at all, so that no grant can stand in for
 *              being the subject.
 *
 * ── THE LIFECYCLE FLAGS COME FROM THE CATALOGUE ──────────────────────────────
 * `employeeMayWrite` and `locked` are read off the server's status list, never
 * hardcoded. Same reasoning as the asset return flags: a second copy of the
 * lifecycle drifts the moment a status is added, and the server's is the one
 * that refuses. When the catalogue is unreadable these helpers say NO to the
 * write actions rather than guessing — unlike the asset case, where refusing
 * would have cleared a field the save required, here the fallback costs a
 * disabled button and the server still gives the real answer.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ReviewActor {
  actorEmployeeId: string | null;
  subjectEmployeeId: string;
  canView: boolean;
  canEdit: boolean;
  canCalibrate: boolean;
}

export function isSubject(actor: ReviewActor): boolean {
  return !!actor.actorEmployeeId && actor.actorEmployeeId === actor.subjectEmployeeId;
}

/** Is the viewer the reviewer named on this row? */
export function isReviewer(review: PerformanceReview, actor: ReviewActor): boolean {
  return !!actor.actorEmployeeId && actor.actorEmployeeId === review.reviewerId;
}

/** The status descriptor for a review, or null when the catalogue cannot say. */
export function statusOf(
  review: PerformanceReview,
  statuses: ReviewStatusDescriptor[],
): ReviewStatusDescriptor | null {
  if (!review.status || !statuses?.length) return null;
  return statuses.find(s => s.key === review.status) ?? null;
}

/**
 * Is this review finished?
 *
 * Prefers the server's own `isFinal`, which it computed from the same
 * catalogue; falls back to the catalogue directly. Null when neither can say —
 * NOT false, because "we do not know whether this is locked" and "this is still
 * open" are different claims.
 */
export function isLocked(
  review: PerformanceReview,
  statuses: ReviewStatusDescriptor[],
): boolean | null {
  if (typeof review.isFinal === 'boolean') return review.isFinal;
  const descriptor = statusOf(review, statuses);
  return descriptor ? descriptor.locked === true : null;
}

/** May this person read the review at all? */
export function mayViewReview(review: PerformanceReview, actor: ReviewActor): boolean {
  return actor.canView || isSubject(actor) || isReviewer(review, actor);
}

/** May they edit it? The edit grant, and not once it is locked. */
export function mayEditReview(
  review: PerformanceReview,
  actor: ReviewActor,
  statuses: ReviewStatusDescriptor[],
): boolean {
  if (!actor.canEdit) return false;
  // A locked review's scores are history. Reopening one to change a number
  // after the fact is the failure the transition table exists to prevent.
  return isLocked(review, statuses) !== true;
}

/**
 * May they override the score?
 *
 * The calibrate grant, on a review that is not locked. Separate from edit on
 * purpose — the server refuses a calibration on an acknowledged review, and
 * moderating a score is not the same act as writing one.
 */
export function mayCalibrate(
  review: PerformanceReview,
  actor: ReviewActor,
  statuses: ReviewStatusDescriptor[],
): boolean {
  if (!actor.canCalibrate) return false;
  return isLocked(review, statuses) !== true;
}

/**
 * May they write the self-assessment?
 *
 * The subject, while the window is open. No privilege enters into it: a manager
 * with every grant in the system still cannot write the employee's own words,
 * and the server enforces that by checking the row rather than the caller's
 * permissions.
 *
 * False when the catalogue cannot say — a disabled button and a clear server
 * error beats a form whose save is refused for an invisible reason.
 */
export function mayWriteSelfAssessment(
  review: PerformanceReview,
  actor: ReviewActor,
  statuses: ReviewStatusDescriptor[],
): boolean {
  if (!isSubject(actor)) return false;
  // Compared against the REVIEW's employee too: a subject viewing their own
  // record is not automatically the subject of every row on it.
  if (review.employeeId !== actor.actorEmployeeId) return false;
  return statusOf(review, statuses)?.employeeMayWrite === true;
}

/**
 * May they acknowledge it?
 *
 * The subject, and only from `AwaitingAcknowledgement` — the one status the
 * server accepts. This is the act that makes a review final, which is why it is
 * the employee's and nobody else's.
 */
export function mayAcknowledge(review: PerformanceReview, actor: ReviewActor): boolean {
  if (!isSubject(actor)) return false;
  if (review.employeeId !== actor.actorEmployeeId) return false;
  return review.status === 'AwaitingAcknowledgement';
}

// ─── Goal weights ────────────────────────────────────────────────────────

/**
 * The running total of the goal weights.
 *
 * Shown live as someone types. The server refuses a non-empty goal list whose
 * weights do not total 100, and learning that after filling in six goals is a
 * bad way to meet the rule.
 *
 * Goals with no weight count as 0 rather than being skipped — an unweighted
 * goal in a weighted review is a mistake, and hiding it from the total would
 * make the form look correct while the save failed.
 */
export function weightTotal(goals: Pick<ReviewGoal, 'weight'>[] | null | undefined): number {
  return (goals ?? []).reduce((sum, g) => sum + (Number(g?.weight) || 0), 0);
}

/**
 * Do the weights satisfy the server's rule?
 *
 * Tolerant to 0.01, exactly as `weightsAreValid` on the server is, so three
 * goals at 33.33 are accepted by both. An empty list is valid — a review may be
 * competency-only.
 *
 * The tolerance is copied rather than referenced, and that is worth knowing: if
 * the server ever changes it, this is the second place to change. The
 * alternative — not checking here at all — trades a rare divergence for a
 * guaranteed bad experience on every review.
 */
export function weightsAreValid(goals: Pick<ReviewGoal, 'weight'>[] | null | undefined): boolean {
  const list = goals ?? [];
  if (list.length === 0) return true;
  return Math.abs(weightTotal(list) - 100) < 0.01;
}
