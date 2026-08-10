import { describe, expect, it } from 'vitest';

import { DisciplinaryRecord } from '../../services/employee-disciplinary.service';
import {
  DisciplinaryActor,
  acknowledgementIsComplete,
  mayAppeal,
  mayDecideAppeal,
  mayEditRecord,
  mayRecordAcknowledgement,
  mayViewEscalation,
  mayViewRecords,
  mayWriteStatement,
  statementWindowClosed,
} from './disciplinary-rules';

/**
 * The disciplinary permission rules.
 *
 * ── FIXTURES CHOSEN TO DISTINGUISH IMPLEMENTATIONS ───────────────────────────
 * Every actor holds exactly one grant, and the ids are all different, so a rule
 * that checked the wrong grant or compared the wrong pair of ids fails rather
 * than coincidentally passing. In particular the ISSUER of the fixture warning
 * is neither the subject nor the default actor, so "not your own warning" and
 * "not your own record" are separable — a rule that confused them would pass
 * against a fixture where they were the same person.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SUBJECT_ID = 'emp-subject';
const ISSUER_ID = 'emp-issuer';
const OTHER_ID = 'emp-other';

const record = (over: Partial<DisciplinaryRecord> = {}): DisciplinaryRecord => ({
  id: 'rec-1',
  employeeId: SUBJECT_ID,
  warningType: 'Written',
  severity: 'Medium',
  reason: 'Conduct',
  incidentDate: '2026-05-01',
  reportedDate: '2026-05-02',
  expiryDate: '2027-05-01',
  statementDeadline: '2026-05-09',
  description: null,
  actionTaken: 'Written warning issued',
  issuedBy: ISSUER_ID,
  issuedByName: 'Hassan',
  employeeStatement: null,
  acknowledged: null,
  acknowledgedAt: null,
  refusedToSign: null,
  witnessName: null,
  appeal: null,
  payrollImpact: null,
  notes: null,
  isSpent: false,
  responseWindowOpen: true,
  files: [],
  ...over,
});

const actor = (over: Partial<DisciplinaryActor> = {}): DisciplinaryActor => ({
  actorEmployeeId: OTHER_ID,
  subjectEmployeeId: SUBJECT_ID,
  canView: false, canEdit: false, canDecideAppeal: false,
  ...over,
});

/** The employee the warning is about, holding nothing. */
const SUBJECT = actor({ actorEmployeeId: SUBJECT_ID });
/** The person who issued it, holding the appeal grant. */
const ISSUER = actor({ actorEmployeeId: ISSUER_ID, canDecideAppeal: true });
/** Somebody else entirely, holding the appeal grant. */
const APPEAL_OFFICER = actor({ canDecideAppeal: true });
const HR = actor({ canView: true, canEdit: true });

describe('reading', () => {
  it('lets the subject read their own records with no grant', () => {
    // A warning nobody may show the employee is not a warning.
    expect(mayViewRecords(SUBJECT)).toBe(true);
  });

  it('needs the view grant for anyone else', () => {
    expect(mayViewRecords(actor())).toBe(false);
    expect(mayViewRecords(actor({ canView: true }))).toBe(true);
  });

  /**
   * The one the subject must NOT see.
   *
   * Escalation is what someone consults while deciding whether to escalate, and
   * the subject reading it changes the process. Note this actor CAN read the
   * records — the two answers differ for the same person, which is why they are
   * separate functions.
   */
  it('hides the escalation position from the subject', () => {
    expect(mayViewRecords(SUBJECT)).toBe(true);
    expect(mayViewEscalation(SUBJECT)).toBe(false);
  });

  it('shows the escalation position to a view-grant holder', () => {
    expect(mayViewEscalation(actor({ canView: true }))).toBe(true);
  });
});

describe('the employee’s statement', () => {
  it('is writable by the subject while the window is open', () => {
    expect(mayWriteStatement(record(), SUBJECT)).toBe(true);
  });

  it('is NOT writable by HR, however privileged', () => {
    // The server checks the row and no privilege at all. A statement written
    // for someone is worth nothing as evidence.
    const everything = actor({ canView: true, canEdit: true, canDecideAppeal: true });
    expect(mayWriteStatement(record(), everything)).toBe(false);
  });

  it('closes with the window', () => {
    expect(mayWriteStatement(record({ responseWindowOpen: false }), SUBJECT)).toBe(false);
  });

  it('refuses when the server did not say whether the window is open', () => {
    // "We do not know" cannot justify writing into a record that may be closed.
    expect(mayWriteStatement(record({ responseWindowOpen: null }), SUBJECT)).toBe(false);
  });

  it('checks the record’s employee, not just the record being viewed', () => {
    // A stray row belonging to someone else on the same screen.
    const strayRow = record({ employeeId: 'emp-99' });
    expect(mayWriteStatement(strayRow, SUBJECT)).toBe(false);
  });

  it('tells a closed window apart from no window at all', () => {
    // A right that has expired and one that never existed read differently to
    // the person looking at the screen.
    expect(statementWindowClosed(record({ responseWindowOpen: false }), SUBJECT)).toBe(true);
    expect(statementWindowClosed(record({ statementDeadline: null, responseWindowOpen: false }), SUBJECT))
      .toBe(false);
    expect(statementWindowClosed(record(), SUBJECT)).toBe(false);
  });
});

describe('appealing', () => {
  it('is the subject’s act', () => {
    expect(mayAppeal(record(), SUBJECT)).toBe(true);
    expect(mayAppeal(record(), HR)).toBe(false);
  });

  it('is over once an outcome exists', () => {
    const decided = record({ appeal: { submittedAt: '2026-05-10', grounds: 'g', outcome: 'Upheld', decidedAt: '2026-05-20', decidedBy: OTHER_ID } });
    expect(mayAppeal(decided, SUBJECT)).toBe(false);
  });
});

describe('deciding an appeal', () => {
  const submitted = (over: Partial<DisciplinaryRecord> = {}) => record({
    appeal: { submittedAt: '2026-05-10', grounds: 'Unfair', outcome: null, decidedAt: null, decidedBy: null },
    ...over,
  });

  it('needs the decideAppeal grant, which edit does not confer', () => {
    // Whoever writes the warning must not thereby rule on the appeal.
    expect(mayDecideAppeal(submitted(), HR)).toBe(false);
    expect(mayDecideAppeal(submitted(), APPEAL_OFFICER)).toBe(true);
  });

  /**
   * THE ONE NO PRIVILEGE SPLIT CATCHES.
   *
   * ISSUER holds `decideAppeal` legitimately and is not the subject — so a rule
   * that only checked "not your own record" would let this through. The
   * comparison has to be against `issuedBy`.
   */
  it('never by the person who issued the warning', () => {
    expect(mayDecideAppeal(submitted(), ISSUER)).toBe(false);
  });

  it('is not confused by the subject-versus-issuer distinction', () => {
    // Same grant, same record, different person: the only difference is whether
    // they issued it.
    expect(mayDecideAppeal(submitted(), APPEAL_OFFICER)).toBe(true);
    expect(mayDecideAppeal(submitted(), { ...APPEAL_OFFICER, actorEmployeeId: ISSUER_ID })).toBe(false);
  });

  it('needs an appeal to have been submitted', () => {
    expect(mayDecideAppeal(record({ appeal: null }), APPEAL_OFFICER)).toBe(false);
  });

  it('refuses a second decision', () => {
    const decided = submitted();
    decided.appeal!.outcome = 'Upheld';
    expect(mayDecideAppeal(decided, APPEAL_OFFICER)).toBe(false);
  });

  it('refuses when the actor is unknown', () => {
    // An unidentified actor cannot be shown not to be the issuer.
    expect(mayDecideAppeal(submitted(), { ...APPEAL_OFFICER, actorEmployeeId: null })).toBe(false);
  });

  it('does not treat a record with no issuer as decidable by anyone', () => {
    // `issuedBy` null must not accidentally match a null actor into "same
    // person" — and must not be a loophole either. A named actor may decide it;
    // an anonymous one may not.
    const noIssuer = submitted({ issuedBy: null });
    expect(mayDecideAppeal(noIssuer, APPEAL_OFFICER)).toBe(true);
    expect(mayDecideAppeal(noIssuer, { ...APPEAL_OFFICER, actorEmployeeId: null })).toBe(false);
  });
});

describe('acknowledgement', () => {
  it('is HR’s act, not the employee’s', () => {
    // It is HR attesting the warning was put to the employee.
    expect(mayRecordAcknowledgement(HR)).toBe(true);
    expect(mayRecordAcknowledgement(SUBJECT)).toBe(false);
  });

  it('requires a witness for a refusal to sign', () => {
    // The witness can only be obtained at the moment of entry — an error
    // message an hour later is too late to be useful.
    expect(acknowledgementIsComplete({ refusedToSign: true })).toBe(false);
    expect(acknowledgementIsComplete({ refusedToSign: true, witnessName: '   ' })).toBe(false);
    expect(acknowledgementIsComplete({ refusedToSign: true, witnessName: 'Noor' })).toBe(true);
  });

  it('does not require a witness for a signature', () => {
    expect(acknowledgementIsComplete({ acknowledged: true })).toBe(true);
  });

  it('refuses an entry that records neither', () => {
    expect(acknowledgementIsComplete({})).toBe(false);
    expect(acknowledgementIsComplete({ acknowledged: false, refusedToSign: false })).toBe(false);
  });

  it('treats a refusal as a refusal even when acknowledged is also set', () => {
    // The server resolves the contradiction the same way: refused wins, and the
    // witness is then mandatory.
    expect(acknowledgementIsComplete({ acknowledged: true, refusedToSign: true })).toBe(false);
  });
});

describe('editing', () => {
  it('is the edit grant, and the subject never has it', () => {
    expect(mayEditRecord(HR)).toBe(true);
    expect(mayEditRecord(SUBJECT)).toBe(false);
    expect(mayEditRecord(actor({ canView: true }))).toBe(false);
  });
});
