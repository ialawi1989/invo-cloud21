import { DisciplinaryRecord } from '../../services/employee-disciplinary.service';

/**
 * Who may do what to a disciplinary record.
 *
 * ── THE SUBJECT HAS RIGHTS OVER THIS RECORD, AND ONLY THESE ──────────────────
 * A warning nobody is allowed to show the employee is not a warning. They may
 * READ their own records — what was alleged, what action was taken, when it
 * lapses, and what they said about it. That is not a convenience; a process
 * that denies it is not defensible.
 *
 * They may write exactly two things, both their own words:
 *
 *   the STATEMENT, while the response window is open;
 *   the APPEAL GROUNDS, while no outcome has been decided.
 *
 * Nothing else. Not the warning, not the acknowledgement, not the expiry.
 *
 * ── AND THREE THINGS NOBODY MAY DO, HOWEVER PRIVILEGED ───────────────────────
 * 1. HR cannot write the employee's statement. The server's endpoint checks the
 *    ROW — `employeeId === caller` and the window — and deliberately checks no
 *    privilege at all, so a grant cannot stand in for being the subject. A
 *    statement written for someone is worth nothing as evidence.
 * 2. The issuer cannot decide the appeal against their own warning. `decideAppeal`
 *    is a separate grant, and the server refuses this case outright on top of
 *    it — the decider usually holds the grant perfectly legitimately.
 * 3. Nobody can reopen the statement window. Once it closes the statement is
 *    fixed, because a statement that can be revised later is not evidence of
 *    what was said at the time.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface DisciplinaryActor {
  actorEmployeeId: string | null;
  subjectEmployeeId: string;
  canView: boolean;
  canEdit: boolean;
  /** A separate grant. Holding `edit` does not confer it. */
  canDecideAppeal: boolean;
}

export function isSubject(actor: DisciplinaryActor): boolean {
  return !!actor.actorEmployeeId && actor.actorEmployeeId === actor.subjectEmployeeId;
}

/** Is this particular record about the person looking at it? */
export function isOwnRecord(record: DisciplinaryRecord, actor: DisciplinaryActor): boolean {
  return !!actor.actorEmployeeId && actor.actorEmployeeId === record.employeeId;
}

/**
 * May they see the records at all?
 *
 * The view grant, or the subject reading their own. (The server also admits a
 * direct line manager holding the view grant, but the reporting relationship
 * lives on the employee row and is not knowable here — the tab lets the server
 * answer that one.)
 */
export function mayViewRecords(actor: DisciplinaryActor): boolean {
  return actor.canView || isSubject(actor);
}

/**
 * May they see the ESCALATION position?
 *
 * The view grant alone. **Not the subject**, and not on the strength of being
 * able to read the records: this is the number someone consults while deciding
 * whether to escalate, and the subject reading it changes the process it is
 * part of. The server refuses it to them, and the panel is hidden rather than
 * left to fail.
 */
export function mayViewEscalation(actor: DisciplinaryActor): boolean {
  return actor.canView;
}

/** May they issue or amend a warning? HR's act, and only HR's. */
export function mayEditRecord(actor: DisciplinaryActor): boolean {
  return actor.canEdit;
}

/**
 * May they write the employee's statement?
 *
 * The subject of THIS RECORD, while the window is open. `responseWindowOpen` is
 * computed by the server and taken as sent; when it is null the answer is no,
 * because "we do not know whether the window is open" cannot justify writing
 * into a record that may already be closed.
 */
export function mayWriteStatement(
  record: DisciplinaryRecord,
  actor: DisciplinaryActor,
): boolean {
  if (!isOwnRecord(record, actor)) return false;
  return record.responseWindowOpen === true;
}

/**
 * Has the window closed on a record the subject could otherwise have answered?
 *
 * Distinguished from "no window at all" so the UI can say the statement period
 * has ENDED rather than silently offering nothing — the difference between a
 * right that has expired and one that never existed matters to the person
 * reading it.
 */
export function statementWindowClosed(
  record: DisciplinaryRecord,
  actor: DisciplinaryActor,
): boolean {
  if (!isOwnRecord(record, actor)) return false;
  if (!record.statementDeadline) return false;
  return record.responseWindowOpen === false;
}

/**
 * May they appeal?
 *
 * The subject, on a record whose appeal has not been decided. Re-submitting
 * grounds before a decision is allowed — the server merges them onto the same
 * appeal object — but once an outcome exists the appeal is over.
 */
export function mayAppeal(record: DisciplinaryRecord, actor: DisciplinaryActor): boolean {
  if (!isOwnRecord(record, actor)) return false;
  return !record.appeal?.outcome;
}

/**
 * May they decide this appeal?
 *
 * Four conditions. The last is the one no privilege split can express: the
 * person who issued the warning must not rule on the appeal against it, and
 * they will usually hold the grant legitimately.
 */
export function mayDecideAppeal(
  record: DisciplinaryRecord,
  actor: DisciplinaryActor,
): boolean {
  if (!actor.canDecideAppeal) return false;
  // Nothing to decide until an appeal has been submitted.
  if (!record.appeal?.submittedAt) return false;
  // And not twice.
  if (record.appeal?.outcome) return false;
  // Never one's own warning. Compared against the record's ISSUER — a null
  // issuer is not a match, and an unknown actor cannot be shown not to be them.
  if (!actor.actorEmployeeId) return false;
  return actor.actorEmployeeId !== record.issuedBy;
}

/**
 * May they record the acknowledgement or the refusal to sign?
 *
 * HR's act — the server requires the edit grant. It is HR attesting that the
 * warning was put to the employee, which is why the employee cannot record it
 * themselves.
 */
export function mayRecordAcknowledgement(actor: DisciplinaryActor): boolean {
  return actor.canEdit;
}

/**
 * Is an acknowledgement entry complete enough to submit?
 *
 * **A refusal to sign must name a witness.** The server refuses without one,
 * and so does this — not as a duplicate check but because the witness can only
 * be obtained at the moment of entry. Someone who submits, gets an error, and
 * comes back an hour later no longer has a witness to name, and the temptation
 * is then to write down whoever is nearest.
 */
export function acknowledgementIsComplete(input: {
  acknowledged?: boolean;
  refusedToSign?: boolean;
  witnessName?: string | null;
}): boolean {
  const refused = input.refusedToSign === true;
  if (refused) return !!input.witnessName && input.witnessName.trim().length > 0;
  // The server accepts neither-nor as an error too: something must be recorded.
  return input.acknowledged === true;
}
