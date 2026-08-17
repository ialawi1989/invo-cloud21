import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/http/api.service';
import {
  ClearanceRow,
  EosCapabilities,
  EosRecord,
  SettlementLine,
  seedClearance,
} from './employee-eos.types';

/**
 * End of Service.
 *
 * The endpoints exist as of InvoCloudBack `8bebfe1fe`; this was written against
 * a proposed contract and the server implements it. Two shapes were reconciled
 * on the server side rather than here, and the divergence is recorded in
 * docs/hr-api-reference.md: `exitInterview` is nested, and settlement lines are
 * keyed `lineKey`.
 *
 * Reads still degrade to "unavailable" rather than throwing — a deployment that
 * has not migrated yet must not show an error page. Writes do NOT degrade: an EOS someone believes
 * they recorded, and did not, is the worst outcome available here — it is the
 * record that says whether a person still has system access.
 *
 * ── ACCESS REVOCATION IS NOT WRITTEN HERE ────────────────────────────────────
 * `accessRevokedAt` must set `hasSystemAccess = false`, clear `passCode` and
 * `MSR` and drop `privilegeId`. The backend ALREADY does exactly that in
 * `revokeSystemAccess`, per-company and credential-free.
 *
 * This service calls that concept; it does not reimplement it, and must never
 * grow its own field-clearing. Two revocation paths would drift, and the one
 * that drifts is the one that leaves a passCode working after someone has left.
 *
 * It must also stay PER-COMPANY. An employee can work for several companies in
 * this system; a tenant admin completing an EOS must not sign that person out
 * of every other company they work for.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Injectable({ providedIn: 'root' })
export class EmployeeEosService {
  private api = inject(ApiService);

  private openAssets = 0;

  private capabilities: EosCapabilities = {
    available: true,
    // Assumed FALSE until the server says otherwise, so the disclaimer shows
    // by default. The failure of assuming true is a settlement presented as
    // computed when nothing computed it.
    statutoryCalculationsAvailable: false,
    reason: null,
  };

  lastCapabilities(): EosCapabilities {
    return this.capabilities;
  }

  /**
   * How many assets the employee still holds, as of the last `get`.
   *
   * The SERVER's count, from its own definition of "still assigned". Kept
   * beside the record rather than derived here: a second definition would
   * disagree the first time an asset status is added, and the disagreement
   * would show as clearance that cannot complete for no visible reason.
   */
  lastOpenAssetCount(): number {
    return this.openAssets;
  }

  /** The record, or a blank seeded one when there is none yet. */
  async get(employeeId: string): Promise<EosRecord> {
    try {
      const res = await this.api.request<any>(this.api.get(`employee/getEos/${employeeId}`));
      if (res?.success === false) {
        this.capabilities = { available: false, statutoryCalculationsAvailable: false, reason: res?.msg ?? null };
        return blank();
      }
      this.capabilities = {
        available: true,
        // Read from the server, never inferred. This is the flag that turns the
        // "nothing is calculated" banner off, and only the server knows.
        statutoryCalculationsAvailable: res?.data?.statutoryCalculationsAvailable === true,
        reason: null,
      };
      this.openAssets = Number(res?.data?.openAssetCount ?? 0);
      return res?.data ? mapRecord(res.data) : blank();
    } catch (e: any) {
      this.capabilities = { available: false, statutoryCalculationsAvailable: false, reason: e?.message ?? null };
      return blank();
    }
  }

  /** Open assets are the clearance gate. The SERVER defines "still held". */
  async openAssetCount(employeeId: string): Promise<number> {
    try {
      const res = await this.api.request<any>(this.api.get(`employee/getOpenAssets/${employeeId}`));
      return Array.isArray(res?.data) ? res.data.length : 0;
    } catch {
      // Unknown, not zero — but the screen must not claim clearance is possible
      // on a guess, so this is surfaced as "cannot confirm" by the caller.
      return -1;
    }
  }

  async save(employeeId: string, record: EosRecord): Promise<{ id: string }> {
    const res = await this.api.request<any>(
      this.api.post('employee/saveEos', { employeeId, ...record } as any),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the record');
    return { id: res?.data?.id ?? '' };
  }

  /**
   * Complete the EOS.
   *
   * Separate from `save` because it is the irreversible step: it sets the
   * employee's TOP-LEVEL `terminationDate` from `lastWorkingDay` and triggers
   * revocation. A screen that completed as a side effect of saving would make
   * that a typo away.
   */
  async complete(
    employeeId: string,
    record: EosRecord,
  ): Promise<{ blockers?: { key: string; detail: string | null }[] }> {
    const res = await this.api.request<any>(
      this.api.post('employee/completeEos', { employeeId, ...record } as any),
    );
    if (res?.success === false) {
      // A refusal because clearance is outstanding is NOT an error — it is the
      // workflow working, and the server sends every reason. Returned rather
      // than thrown so the screen can list them; only a refusal with no
      // blockers is a genuine failure worth raising.
      const blockers = res?.data?.blockers;
      if (Array.isArray(blockers) && blockers.length) return { blockers };
      throw new Error(res?.msg || 'Could not complete');
    }
    return {};
  }
}

function blank(): EosRecord {
  return {
    id: null,
    type: null,
    noticeGivenDate: null,
    lastWorkingDay: null,
    reason: null,
    rehireEligible: true,
    rehireReason: null,
    exitInterview: { conductedBy: null, date: null, summary: null },
    clearance: seedClearance(),
    settlement: [],
    visaCancellationDate: null,
    accessRevokedAt: null,
    completedAt: null,
  };
}

function mapRecord(d: any): EosRecord {
  const base = blank();
  return {
    ...base,
    id: d?.id ?? null,
    type: d?.type ?? null,
    noticeGivenDate: str(d?.noticeGivenDate),
    lastWorkingDay: str(d?.lastWorkingDay),
    reason: d?.reason ?? null,
    rehireEligible: d?.rehireEligible !== false,
    rehireReason: d?.rehireReason ?? null,
    exitInterview: {
      conductedBy: d?.exitInterview?.conductedBy ?? null,
      date: str(d?.exitInterview?.date),
      summary: d?.exitInterview?.summary ?? null,
    },
    // A stored clearance list wins; the seed is only for a record that has none.
    clearance: Array.isArray(d?.clearance) && d.clearance.length
      ? d.clearance.map(mapClearance)
      : base.clearance,
    settlement: Array.isArray(d?.settlement) ? d.settlement.map(mapLine) : [],
    visaCancellationDate: str(d?.visaCancellationDate),
    accessRevokedAt: d?.accessRevokedAt ?? null,
    completedAt: d?.completedAt ?? null,
  };
}

/** Dates are days. A timestamp from the server still yields a date. */
function str(v: any): string | null {
  return v ? String(v).slice(0, 10) : null;
}

function mapClearance(r: any): ClearanceRow {
  return {
    id: String(r?.id ?? ''),
    department: r?.department ?? '',
    owner: r?.owner ?? null,
    status: r?.status === 'Cleared' || r?.status === 'Blocked' ? r.status : 'Pending',
    blockingReason: r?.blockingReason ?? null,
    clearedAt: r?.clearedAt ?? null,
  };
}

function mapLine(l: any): SettlementLine {
  return {
    id: String(l?.id ?? ''),
    lineKey: l?.lineKey ?? '',
    // null, never 0 — an undecided line is not a zero line.
    amount: l?.amount === null || l?.amount === undefined ? null : Number(l.amount),
    calculationNote: l?.calculationNote ?? null,
    isOverridden: l?.isOverridden === true,
    overrideReason: l?.overrideReason ?? null,
  };
}
