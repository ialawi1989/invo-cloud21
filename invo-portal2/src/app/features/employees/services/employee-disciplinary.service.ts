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
 * Disciplinary records — the most restricted module in HR.
 *
 * ── ALMOST EVERY RULE HERE EXISTS BECAUSE A RECORD IS EVIDENCE ───────────────
 * The statement is fixed once the response window closes, because a statement
 * that can be revised later is not evidence of what was said at the time. The
 * issuer may not decide the appeal against their own warning. A refusal to sign
 * needs a named witness, obtainable only at the moment of entry. None of that is
 * ceremony; it is what makes the record defensible.
 *
 * ── isSpent AND responseWindowOpen ARE SERVER-COMPUTED AND NULLABLE ──────────
 * Both are decorated on read and neither is stored. They are taken exactly as
 * sent and typed `boolean | null`.
 *
 * `isSpent` is the one that matters most. It is true when the warning has
 * expired OR when an appeal overturned it — an overturned warning is not merely
 * old, it is WITHDRAWN, and it is spent regardless of date. Recomputing it here
 * from `expiryDate` alone would produce the two worst possible errors in this
 * module: escalating on a warning that has been withdrawn, or ignoring one that
 * is still live.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type DisciplinaryFile = HrFile;

export interface DisciplinaryAppeal {
  submittedAt: string | null;
  grounds: string | null;
  /** Null while an appeal has been submitted but not yet decided. */
  outcome: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
}

export interface DisciplinaryRecord {
  id: string;
  employeeId: string;
  warningType: string;
  severity: string | null;
  reason: string | null;
  incidentDate: string | null;
  reportedDate: string | null;
  expiryDate: string | null;
  statementDeadline: string | null;
  description: string | null;
  actionTaken: string | null;
  issuedBy: string | null;
  issuedByName: string | null;
  /** The employee's own words. Written by them alone, never by HR. */
  employeeStatement: string | null;
  acknowledged: boolean | null;
  acknowledgedAt: string | null;
  refusedToSign: boolean | null;
  witnessName: string | null;
  appeal: DisciplinaryAppeal | null;
  payrollImpact: string | null;
  notes: string | null;

  /**
   * Expired, or overturned on appeal. Excluded from escalation either way.
   * Null means the server did not say — never treated as "still live".
   */
  isSpent: boolean | null;
  /** May the employee still write their statement? Null means unknown. */
  responseWindowOpen: boolean | null;
  files: DisciplinaryFile[];
}

/**
 * The escalation position.
 *
 * HR only — not the subject and not a manager. This is the number someone
 * consults while deciding whether to escalate, and the subject reading it
 * changes the process it is part of.
 */
export interface DisciplinaryEscalation {
  /** The highest rank still live. 0 when nothing counts against the employee. */
  level: number | null;
  liveCount: number | null;
  records: DisciplinaryRecord[];
}

export interface WarningTypeDescriptor {
  key: string;
  labelKey: string;
  /** Escalation order. "Their second written warning" is about rank, not count. */
  rank: number;
  /** Suspension and dismissal are outcomes, not warnings. */
  endsEmployment: boolean;
}

export interface AppealOutcomeDescriptor {
  key: string;
  labelKey: string;
  /** Overturning makes the record spent immediately, whatever its expiry says. */
  overturnsRecord: boolean;
}

export interface DisciplinaryCatalog {
  warningTypes: WarningTypeDescriptor[];
  severities: { key: string; labelKey: string }[];
  reasons: { key: string; labelKey: string }[];
  appealOutcomes: AppealOutcomeDescriptor[];
  payrollImpactTypes: { key: string; labelKey: string }[];
}

export const DISCIPLINARY_ENTITY = FILE_ENTITY.disciplinary;

@Injectable({ providedIn: 'root' })
export class EmployeeDisciplinaryService {
  private api = inject(ApiService);
  private files = inject(EmployeeFileService);

  async records(employeeId: string): Promise<DisciplinaryRecord[]> {
    const res = await this.api.request<any>(this.api.get(`employee/getDisciplinary/${employeeId}`));
    const rows: any[] = Array.isArray(res?.data) ? res.data : [];
    return rows.map(r => this.mapRecord(r));
  }

  /**
   * The escalation position.
   *
   * Fetched separately and allowed to fail on its own: the server refuses it to
   * the subject and to a manager while still serving them the records, so a
   * failure here must not take the whole tab down with it.
   */
  async escalation(employeeId: string): Promise<DisciplinaryEscalation | null> {
    const res = await this.api.request<any>(
      this.api.get(`employee/getDisciplinaryEscalation/${employeeId}`),
    );
    if (res?.success === false || !res?.data) return null;
    return {
      level: num(res.data.level),
      liveCount: num(res.data.liveCount),
      records: Array.isArray(res.data.records) ? res.data.records.map((r: any) => this.mapRecord(r)) : [],
    };
  }

  async save(payload: Record<string, unknown>): Promise<{ id: string }> {
    const res = await this.api.request<any>(this.api.post('employee/saveDisciplinary', payload));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the record');
    return { id: res?.data?.id ?? '' };
  }

  /**
   * The employee's statement.
   *
   * Its own endpoint with NO privilege check server-side — the rule is "your own
   * record, window open" and both facts live on the row. HR holding every grant
   * in the system cannot reach this: the statement is the employee's alone, and
   * one written for them is worth nothing as evidence.
   */
  async saveStatement(recordId: string, statement: string): Promise<void> {
    const res = await this.api.request<any>(
      this.api.post('employee/saveDisciplinaryStatement', { recordId, statement }),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the statement');
  }

  /**
   * Record that the employee signed, or refused to.
   *
   * HR's act, not the employee's — the server requires the edit grant. A refusal
   * MUST name a witness; the server refuses without one, and the form does too,
   * because the witness can only be obtained at the moment of entry.
   */
  async acknowledge(
    recordId: string,
    input: { acknowledged?: boolean; refusedToSign?: boolean; witnessName?: string },
  ): Promise<void> {
    const res = await this.api.request<any>(
      this.api.post('employee/acknowledgeDisciplinary', { recordId, ...input }),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not record the acknowledgement');
  }

  /** The employee's own act. Grounds are required. */
  async appeal(recordId: string, grounds: string): Promise<void> {
    const res = await this.api.request<any>(
      this.api.post('employee/appealDisciplinary', { recordId, grounds }),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not submit the appeal');
  }

  /**
   * Decide an appeal.
   *
   * A separate grant, and the server additionally refuses the issuer deciding
   * the appeal against their own warning — the one case no privilege split
   * catches, because the decider holds the grant legitimately.
   */
  async decideAppeal(recordId: string, outcome: string): Promise<void> {
    const res = await this.api.request<any>(
      this.api.post('employee/decideDisciplinaryAppeal', { recordId, outcome }),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not decide the appeal');
  }

  async remove(recordId: string): Promise<void> {
    const res = await this.api.request<any>(this.api.get(`employee/deleteDisciplinary/${recordId}`));
    if (res?.success === false) throw new Error(res?.msg || 'Could not delete the record');
  }

  async catalog(): Promise<DisciplinaryCatalog> {
    const res = await this.api.request<any>(this.api.get('employee/disciplinaryCatalog'));
    const d = res?.data;
    return {
      warningTypes: Array.isArray(d?.warningTypes) ? d.warningTypes : [],
      severities: Array.isArray(d?.severities) ? d.severities : [],
      reasons: Array.isArray(d?.reasons) ? d.reasons : [],
      appealOutcomes: Array.isArray(d?.appealOutcomes) ? d.appealOutcomes : [],
      payrollImpactTypes: Array.isArray(d?.payrollImpactTypes) ? d.payrollImpactTypes : [],
    };
  }

  // ─── Attachments ───────────────────────────────────────────────────────
  // Evidence attached to a warning. CONFIDENTIAL — every signed URL issued is
  // audited, the same as an identity document.

  fileCatalog(): Promise<FileCatalog> {
    return this.files.catalog();
  }

  upload(recordId: string, file: File): Promise<void> {
    return this.files.upload(DISCIPLINARY_ENTITY, recordId, file);
  }

  downloadUrl(fileId: string): Promise<{ url: string; fileName: string }> {
    return this.files.downloadUrl(DISCIPLINARY_ENTITY, fileId);
  }

  // ─── Mapping ───────────────────────────────────────────────────────────

  private mapRecord(r: any): DisciplinaryRecord {
    return {
      id: r?.id ?? '',
      employeeId: r?.employeeId ?? '',
      warningType: r?.warningType ?? '',
      severity: r?.severity ?? null,
      reason: r?.reason ?? null,
      incidentDate: r?.incidentDate ?? null,
      reportedDate: r?.reportedDate ?? null,
      expiryDate: r?.expiryDate ?? null,
      statementDeadline: r?.statementDeadline ?? null,
      description: r?.description ?? null,
      actionTaken: r?.actionTaken ?? null,
      issuedBy: r?.issuedBy ?? null,
      issuedByName: r?.issuedByName ?? null,
      employeeStatement: r?.employeeStatement ?? null,
      // Tri-state. `=== true` would turn an absent acknowledgement into a
      // confident "not acknowledged", which on this record is a claim about
      // whether someone was ever shown their own warning.
      acknowledged: typeof r?.acknowledged === 'boolean' ? r.acknowledged : null,
      acknowledgedAt: r?.acknowledgedAt ?? null,
      refusedToSign: typeof r?.refusedToSign === 'boolean' ? r.refusedToSign : null,
      witnessName: r?.witnessName ?? null,
      appeal: r?.appeal
        ? {
            submittedAt: r.appeal.submittedAt ?? null,
            grounds: r.appeal.grounds ?? null,
            outcome: r.appeal.outcome ?? null,
            decidedAt: r.appeal.decidedAt ?? null,
            decidedBy: r.appeal.decidedBy ?? null,
          }
        : null,
      payrollImpact: r?.payrollImpact ?? null,
      notes: r?.notes ?? null,

      // Taken as sent. NEVER recomputed — see the header note.
      isSpent: typeof r?.isSpent === 'boolean' ? r.isSpent : null,
      responseWindowOpen: typeof r?.responseWindowOpen === 'boolean' ? r.responseWindowOpen : null,
      files: mapHrFiles(r?.files),
    };
  }
}

/** A numeric column as a number, or null. See the leave service for why. */
function num(v: any): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }
  return null;
}
