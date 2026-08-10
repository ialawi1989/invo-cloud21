import { describe, expect, it } from 'vitest';

import { LeaveRequest } from '../../services/employee-leave.service';
import {
  LeaveActor,
  isSelf,
  mayCreateRequest,
  mayDecideRequest,
  mayDeleteRequest,
  mayEditRequest,
  mayViewLeave,
} from './leave-permissions';

/**
 * Self versus privilege.
 *
 * ── WHY THIS IS THE MOST IMPORTANT TEST IN THE MODULE ────────────────────────
 * Leave is the one place where the two questions come apart, and both possible
 * mistakes are invisible from the screen:
 *
 *   Gate on the grant alone → every employee loses access to their own leave.
 *   The tab is simply absent, the API would have served them, and nobody who
 *   holds the grant (i.e. whoever tests it) ever sees the problem.
 *
 *   Gate on self alone → an approver approves their own request. The server
 *   refuses it, so it surfaces as a confusing error rather than a breach, but
 *   the button should never have been there.
 *
 * Every actor below is a NON-admin without the relevant grant unless the test
 * is specifically about the grant — an admin bypasses everything and would pass
 * against a completely broken rule.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const NOBODY: LeaveActor = {
  actorEmployeeId: 'emp-1',
  subjectEmployeeId: 'emp-2',
  canView: false, canEdit: false, canApprove: false,
};

/** The same person looking at their own record, holding nothing. */
const SUBJECT: LeaveActor = { ...NOBODY, subjectEmployeeId: 'emp-1' };

const VIEWER: LeaveActor = { ...NOBODY, canView: true };
const EDITOR: LeaveActor = { ...NOBODY, canView: true, canEdit: true };
const APPROVER: LeaveActor = { ...NOBODY, canView: true, canApprove: true };

const request = (over: Partial<LeaveRequest> = {}): LeaveRequest => ({
  id: 'req-1',
  employeeId: 'emp-2',
  leaveType: 'Annual leave',
  status: 'Pending',
  startDate: '2026-03-01',
  endDate: '2026-03-05',
  halfDay: 'none',
  days: 3,
  reason: null,
  handoverToEmployeeId: null,
  decidedBy: null,
  decidedAt: null,
  decisionComment: null,
  files: [],
  ...over,
});

describe('isSelf', () => {
  it('is false when the actor is unknown', () => {
    // A null id must never match a null subject into "self".
    expect(isSelf({ ...SUBJECT, actorEmployeeId: null })).toBe(false);
  });

  it('compares the actor against the record being viewed', () => {
    expect(isSelf(SUBJECT)).toBe(true);
    expect(isSelf(NOBODY)).toBe(false);
  });
});

describe('mayViewLeave', () => {
  it('lets the subject see their own leave with no grant whatsoever', () => {
    // The rule the server has and the one a normal HR gate would get wrong.
    expect(mayViewLeave(SUBJECT)).toBe(true);
  });

  it('needs the view grant for anyone else', () => {
    expect(mayViewLeave(NOBODY)).toBe(false);
    expect(mayViewLeave(VIEWER)).toBe(true);
  });
});

describe('mayCreateRequest', () => {
  it('lets the subject request their own leave with no grant', () => {
    // A leave system nobody can request leave from is a spreadsheet.
    expect(mayCreateRequest(SUBJECT)).toBe(true);
  });

  it('lets HR raise one on someone else’s behalf', () => {
    expect(mayCreateRequest(EDITOR)).toBe(true);
  });

  it('refuses someone with neither', () => {
    // A viewer may read a colleague's leave but not book it for them.
    expect(mayCreateRequest(VIEWER)).toBe(false);
  });
});

describe('mayEditRequest — while it is still theirs to change', () => {
  const own = (status: string) => request({ employeeId: 'emp-1', status });

  it('lets the subject edit their own Draft or Pending request', () => {
    expect(mayEditRequest(own('Draft'), SUBJECT)).toBe(true);
    expect(mayEditRequest(own('Pending'), SUBJECT)).toBe(true);
  });

  it('stops once the request has been decided', () => {
    // Editing approved leave moves dates an approver already agreed to;
    // editing a rejected one quietly resurrects it.
    expect(mayEditRequest(own('Approved'), SUBJECT)).toBe(false);
    expect(mayEditRequest(own('Rejected'), SUBJECT)).toBe(false);
    expect(mayEditRequest(own('Cancelled'), SUBJECT)).toBe(false);
  });

  it('lets the edit grant through in any state', () => {
    expect(mayEditRequest(request({ status: 'Approved' }), EDITOR)).toBe(true);
  });

  it('refuses a viewer on someone else’s request', () => {
    expect(mayEditRequest(request({ status: 'Pending' }), VIEWER)).toBe(false);
  });

  it('deletes on exactly the same rule as it edits', () => {
    // The server's deleteRequest reuses mayEditOwnRequest verbatim.
    for (const status of ['Draft', 'Pending', 'Approved', 'Rejected']) {
      expect(mayDeleteRequest(own(status), SUBJECT))
        .toBe(mayEditRequest(own(status), SUBJECT));
    }
  });
});

describe('mayDecideRequest', () => {
  it('needs the approve grant', () => {
    // Correcting a date on a request must not thereby approve it.
    expect(mayDecideRequest(request(), EDITOR)).toBe(false);
    expect(mayDecideRequest(request(), APPROVER)).toBe(true);
  });

  it('only on a request that is still pending', () => {
    // The repo refuses anything else, so buttons elsewhere only produce errors.
    for (const status of ['Draft', 'Approved', 'Rejected', 'Cancelled']) {
      expect(mayDecideRequest(request({ status }), APPROVER)).toBe(false);
    }
  });

  /**
   * THE ONE NO PRIVILEGE SPLIT CATCHES.
   *
   * The approver holds the grant legitimately; they simply must not use it on
   * themselves. The server refuses this outright in `decideRequest`, and the UI
   * has to agree or it offers a button whose only outcome is an error.
   */
  it('never on one’s own request', () => {
    const mine = request({ employeeId: APPROVER.actorEmployeeId! });
    expect(mayDecideRequest(mine, APPROVER)).toBe(false);
  });

  it('compares against the request’s employee, not the record being viewed', () => {
    // An approver browsing a colleague's record must still not decide a request
    // that happens to be their own — the two ids are different questions.
    const onSomeoneElsesRecord: LeaveActor = { ...APPROVER, subjectEmployeeId: 'emp-9' };
    const mine = request({ employeeId: 'emp-1' });
    expect(mayDecideRequest(mine, onSomeoneElsesRecord)).toBe(false);
    expect(mayDecideRequest(request({ employeeId: 'emp-9' }), onSomeoneElsesRecord)).toBe(true);
  });

  it('refuses when the actor is unknown', () => {
    // An unidentified actor cannot be shown not to be the subject.
    expect(mayDecideRequest(request(), { ...APPROVER, actorEmployeeId: null })).toBe(false);
  });
});
