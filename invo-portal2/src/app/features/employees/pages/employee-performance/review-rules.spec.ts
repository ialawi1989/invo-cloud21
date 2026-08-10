import { describe, expect, it } from 'vitest';

import {
  PerformanceReview,
  ReviewStatusDescriptor,
} from '../../services/employee-performance.service';
import {
  ReviewActor,
  isLocked,
  mayAcknowledge,
  mayCalibrate,
  mayEditReview,
  mayViewReview,
  mayWriteSelfAssessment,
  weightTotal,
  weightsAreValid,
} from './review-rules';

/**
 * Four permissions and a lifecycle, none of them interchangeable.
 *
 * Every actor here is a NON-admin, and the grants are given one at a time. An
 * actor holding everything would pass against a rule that checked nothing.
 */

/** Copied verbatim from the server's REVIEW_STATUSES. */
const STATUSES: ReviewStatusDescriptor[] = [
  { key: 'Draft', labelKey: 'x', employeeMayWrite: false, locked: false },
  { key: 'SelfAssessment', labelKey: 'x', employeeMayWrite: true, locked: false },
  { key: 'ManagerReview', labelKey: 'x', employeeMayWrite: false, locked: false },
  { key: 'Calibration', labelKey: 'x', employeeMayWrite: false, locked: false },
  { key: 'AwaitingAcknowledgement', labelKey: 'x', employeeMayWrite: false, locked: false },
  { key: 'Acknowledged', labelKey: 'x', employeeMayWrite: false, locked: true },
];

const review = (over: Partial<PerformanceReview> = {}): PerformanceReview => ({
  id: 'rev-1',
  employeeId: 'emp-2',
  reviewCycle: 'Annual',
  status: 'ManagerReview',
  periodStart: '2026-01-01',
  periodEnd: '2026-12-31',
  nextReviewDate: null,
  reviewerId: 'emp-7',
  reviewerName: 'Layla',
  goals: [],
  competencies: [],
  selfAssessment: null,
  managerFeedback: null,
  pip: null,
  goalScore: null,
  competencyScore: null,
  finalScore: 72,
  calibratedScore: null,
  calibrationReason: null,
  calibratedBy: null,
  calibratedAt: null,
  effectiveScore: 72,
  acknowledgedAt: null,
  acknowledgementComment: null,
  isFinal: null,
  files: [],
  ...over,
});

const NOBODY: ReviewActor = {
  actorEmployeeId: 'emp-1', subjectEmployeeId: 'emp-2',
  canView: false, canEdit: false, canCalibrate: false,
};
/** The subject of the record, holding nothing. */
const SUBJECT: ReviewActor = { ...NOBODY, subjectEmployeeId: 'emp-1' };
const EDITOR: ReviewActor = { ...NOBODY, canView: true, canEdit: true };
const CALIBRATOR: ReviewActor = { ...NOBODY, canView: true, canCalibrate: true };
/** The reviewer named on the row, with no privileges at all. */
const REVIEWER: ReviewActor = { ...NOBODY, actorEmployeeId: 'emp-7' };

describe('mayViewReview', () => {
  it('admits the view grant, the subject, and the named reviewer', () => {
    expect(mayViewReview(review(), { ...NOBODY, canView: true })).toBe(true);
    expect(mayViewReview(review({ employeeId: 'emp-1' }), SUBJECT)).toBe(true);
    // The reviewer holds nothing — being named on the row is the whole claim.
    expect(mayViewReview(review(), REVIEWER)).toBe(true);
  });

  it('refuses someone who is none of those', () => {
    expect(mayViewReview(review(), NOBODY)).toBe(false);
  });
});

describe('isLocked', () => {
  it('prefers the server’s own isFinal', () => {
    expect(isLocked(review({ isFinal: true, status: 'Draft' }), STATUSES)).toBe(true);
  });

  it('falls back to the catalogue when the server did not say', () => {
    expect(isLocked(review({ status: 'Acknowledged' }), STATUSES)).toBe(true);
    expect(isLocked(review({ status: 'Draft' }), STATUSES)).toBe(false);
  });

  it('returns null rather than false when neither can say', () => {
    // "We do not know whether this is locked" and "this is still open" are
    // different claims, and only one of them justifies showing edit controls.
    expect(isLocked(review({ status: 'Draft' }), [])).toBeNull();
    expect(isLocked(review({ status: 'Invented' }), STATUSES)).toBeNull();
  });
});

describe('mayEditReview', () => {
  it('needs the edit grant', () => {
    expect(mayEditReview(review(), NOBODY, STATUSES)).toBe(false);
    expect(mayEditReview(review(), EDITOR, STATUSES)).toBe(true);
  });

  it('stops once the review is acknowledged', () => {
    // Reopening a finished review to change a score after the fact is the
    // failure the transition table exists to prevent.
    expect(mayEditReview(review({ status: 'Acknowledged' }), EDITOR, STATUSES)).toBe(false);
  });

  it('allows editing when lockedness is unknown, and lets the server refuse', () => {
    // isLocked() === null, not true. Disabling on an unreadable catalogue would
    // make every review uneditable the moment one request fails.
    expect(mayEditReview(review(), EDITOR, [])).toBe(true);
  });
});

describe('mayCalibrate — a separate grant from edit', () => {
  it('is not granted by the edit privilege', () => {
    // The point of moderation is that it is not the reviewer restating their
    // own arithmetic. Someone who may write a review must not thereby override
    // its score.
    expect(mayCalibrate(review(), EDITOR, STATUSES)).toBe(false);
    expect(mayCalibrate(review(), CALIBRATOR, STATUSES)).toBe(true);
  });

  it('is refused on an acknowledged review', () => {
    expect(mayCalibrate(review({ status: 'Acknowledged' }), CALIBRATOR, STATUSES)).toBe(false);
  });
});

describe('mayWriteSelfAssessment — the employee’s own act', () => {
  const mine = (status: string) => review({ employeeId: 'emp-1', status });

  it('is open only in the window the catalogue marks', () => {
    // Read off employeeMayWrite, never from a hardcoded status name.
    expect(mayWriteSelfAssessment(mine('SelfAssessment'), SUBJECT, STATUSES)).toBe(true);
    for (const status of ['Draft', 'ManagerReview', 'Calibration', 'AwaitingAcknowledgement', 'Acknowledged']) {
      expect(mayWriteSelfAssessment(mine(status), SUBJECT, STATUSES)).toBe(false);
    }
  });

  /**
   * THE ONE THAT CATCHES A HARDCODED LIFECYCLE.
   *
   * A status the server has never had, flagged `employeeMayWrite`. Only an
   * implementation that reads the flag gets this right — and the same list with
   * SelfAssessment's flag off must flip the other way.
   */
  it('follows the flag, not the status name', () => {
    const invented: ReviewStatusDescriptor[] = [
      { key: 'PeerInput', labelKey: 'x', employeeMayWrite: true, locked: false },
      { key: 'SelfAssessment', labelKey: 'x', employeeMayWrite: false, locked: false },
    ];
    expect(mayWriteSelfAssessment(mine('PeerInput'), SUBJECT, invented)).toBe(true);
    expect(mayWriteSelfAssessment(mine('SelfAssessment'), SUBJECT, invented)).toBe(false);
  });

  it('is not something a privilege can stand in for', () => {
    // A manager with every grant in the system cannot write the employee's own
    // words — the server checks the row, not the caller's permissions.
    const everything: ReviewActor = {
      ...EDITOR, canCalibrate: true, canView: true,
    };
    expect(mayWriteSelfAssessment(review({ status: 'SelfAssessment' }), everything, STATUSES))
      .toBe(false);
  });

  it('checks the review’s employee, not just the record being viewed', () => {
    // A subject viewing their own record is not the subject of every row on it.
    const strayRow = review({ employeeId: 'emp-99', status: 'SelfAssessment' });
    expect(mayWriteSelfAssessment(strayRow, SUBJECT, STATUSES)).toBe(false);
  });

  it('says no when the catalogue cannot say', () => {
    // A disabled button plus a clear server error beats a form whose save is
    // refused for an invisible reason.
    expect(mayWriteSelfAssessment(mine('SelfAssessment'), SUBJECT, [])).toBe(false);
  });
});

describe('mayAcknowledge', () => {
  it('is the subject’s act, from AwaitingAcknowledgement only', () => {
    expect(mayAcknowledge(review({ employeeId: 'emp-1', status: 'AwaitingAcknowledgement' }), SUBJECT))
      .toBe(true);
    expect(mayAcknowledge(review({ employeeId: 'emp-1', status: 'ManagerReview' }), SUBJECT))
      .toBe(false);
  });

  it('is not available to a manager, however privileged', () => {
    // Acknowledging is what makes a review final. Nobody may do it for someone.
    expect(mayAcknowledge(review({ status: 'AwaitingAcknowledgement' }), EDITOR)).toBe(false);
  });
});

describe('goal weights', () => {
  it('totals them live, counting an unweighted goal as zero', () => {
    // Skipping it would make the form look correct while the save failed.
    expect(weightTotal([{ weight: 40 }, { weight: 60 }])).toBe(100);
    expect(weightTotal([{ weight: 40 }, { weight: null }])).toBe(40);
  });

  it('accepts an empty goal list — a review may be competency-only', () => {
    expect(weightsAreValid([])).toBe(true);
    expect(weightsAreValid(null)).toBe(true);
  });

  /**
   * The tolerance, exercised with weights that actually need it.
   *
   * The obvious case — 33.33 + 33.33 + 33.34 — is NOT one: it comes to exactly
   * 100 in IEEE 754, so it passes with or without the tolerance and tests
   * nothing. (Written that way first; the deliberate break is what revealed it.)
   *
   * These two do need it. Ten goals at 10.1/9.1 sum to 99.99999999999999 and
   * thirteen at 7.7/7.6 to 100.00000000000001 — both would be refused by an
   * exact comparison, on a form the user filled in correctly.
   */
  it('absorbs floating-point residue, as the server’s 0.01 tolerance does', () => {
    const ten = [10.1, 10.1, 10.1, 10.1, 10.1, 10.1, 10.1, 10.1, 10.1, 9.1]
      .map(weight => ({ weight }));
    expect(weightTotal(ten)).not.toBe(100);      // 99.99999999999999
    expect(weightsAreValid(ten)).toBe(true);

    const thirteen = [7.7, 7.7, 7.7, 7.7, 7.7, 7.7, 7.7, 7.7, 7.7, 7.7, 7.7, 7.7, 7.6]
      .map(weight => ({ weight }));
    expect(weightTotal(thirteen)).not.toBe(100); // 100.00000000000001
    expect(weightsAreValid(thirteen)).toBe(true);
  });

  it('does not let the tolerance swallow a real shortfall', () => {
    // Three goals at 33.33 come to 99.99 — off by exactly 0.01, which the
    // server's `< 0.01` refuses too. The tolerance is for float residue, not
    // for rounding someone's weights for them.
    expect(weightsAreValid([{ weight: 33.33 }, { weight: 33.33 }, { weight: 33.33 }]))
      .toBe(false);
  });

  it('refuses a list that does not add up', () => {
    expect(weightsAreValid([{ weight: 40 }, { weight: 40 }])).toBe(false);
    expect(weightsAreValid([{ weight: 60 }, { weight: 60 }])).toBe(false);
  });
});
