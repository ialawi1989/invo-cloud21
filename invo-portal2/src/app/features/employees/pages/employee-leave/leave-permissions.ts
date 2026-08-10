import { LeaveRequest } from '../../services/employee-leave.service';

/**
 * Who may do what to a leave request.
 *
 * ── LEAVE IS THE ONE MODULE WHERE THE SUBJECT IS THE AUTHOR ──────────────────
 * Every other HR module is HR writing about someone. Here the employee writes
 * their own requests, and the server admits them on `isSelf` with NO privilege
 * at all — `employeeLeave.controller.saveRequest` falls back to
 * `isSelf(callerId, employeeId)` when `canEditLeave` says no.
 *
 * So a UI that gated the create button on the edit grant would hide leave from
 * everyone it is for. That failure is silent and total: a leave system nobody
 * can request leave from is a spreadsheet.
 *
 * The four rules, mirrored from the server so the buttons match what the API
 * will accept:
 *
 *   view    self, or the view grant                     (controller: isSelf ||)
 *   create  self for themselves, or the edit grant      (controller: isSelf ||)
 *   edit    the edit grant, or self WHILE Draft/Pending (mayEditOwnRequest)
 *   decide  the approve grant, on a Pending request,
 *           and NEVER one's own                         (repo: refuses outright)
 *
 * ── SELF-APPROVAL IS REFUSED IN THE REPO, NOT BY THE PRIVILEGE ───────────────
 * A manager approving their own leave holds the approve grant perfectly
 * legitimately — they simply must not use it on themselves. No privilege split
 * catches that, which is why the server refuses it in `decideRequest` and why
 * the decide controls are hidden here on one's own request rather than left to
 * fail.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** What the UI knows about the person looking at the screen. */
export interface LeaveActor {
  /** The signed-in employee's id. Null when unknown — treated as "not self". */
  actorEmployeeId: string | null;
  /** The record being viewed. */
  subjectEmployeeId: string;
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
}

/** Is the person looking at this record its subject? */
export function isSelf(actor: LeaveActor): boolean {
  return !!actor.actorEmployeeId && actor.actorEmployeeId === actor.subjectEmployeeId;
}

/**
 * May this person open the leave tab at all?
 *
 * Self OR the view grant. An employee with no leave privilege whatsoever still
 * sees their own leave — that is the server's rule and the whole point of the
 * module.
 */
export function mayViewLeave(actor: LeaveActor): boolean {
  return isSelf(actor) || actor.canView;
}

/** May they create a new request on this record? */
export function mayCreateRequest(actor: LeaveActor): boolean {
  return isSelf(actor) || actor.canEdit;
}

/**
 * May they change this request?
 *
 * The edit grant covers anyone's request in any state the server permits. The
 * subject covers only their own, and only while it is still theirs — Draft or
 * Pending. Once decided it is out of their hands: editing approved leave would
 * move dates an approver has already agreed to, and editing a rejected request
 * would quietly resurrect it.
 */
export function mayEditRequest(request: LeaveRequest, actor: LeaveActor): boolean {
  if (actor.canEdit) return true;
  if (!isSelf(actor)) return false;
  return request.status === 'Draft' || request.status === 'Pending';
}

/** Deleting follows exactly the same rule as editing — the server's does too. */
export function mayDeleteRequest(request: LeaveRequest, actor: LeaveActor): boolean {
  return mayEditRequest(request, actor);
}

/**
 * May they approve or reject this request?
 *
 * Three conditions, all required. The third is the one that is easy to leave
 * out and impossible to see the absence of: **never your own**.
 */
export function mayDecideRequest(request: LeaveRequest, actor: LeaveActor): boolean {
  if (!actor.canApprove) return false;
  // Only a pending request can be decided — the repo refuses anything else, so
  // showing the buttons on an approved request would only produce an error.
  if (request.status !== 'Pending') return false;
  // Not one's own. Compared against the REQUEST's employee, not the record's,
  // so an approver looking at a colleague's record still cannot slip a decision
  // onto a request that happens to be theirs.
  return !!actor.actorEmployeeId && actor.actorEmployeeId !== request.employeeId;
}
