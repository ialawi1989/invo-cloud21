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
 * Employee leave — profile, requests and balance.
 *
 * ── THE MODULE WHERE THE EMPLOYEE IS THE AUTHOR ──────────────────────────────
 * Every other HR module is written by HR about someone. Leave is written by the
 * person taking it: they create and cancel their own requests while Draft or
 * Pending, and the server admits them on `isSelf` with no privilege at all. They
 * may not approve their own — that is refused in the repo, not merely by the
 * privilege split, because the person approving usually holds the privilege
 * legitimately and simply must not use it on themselves.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── A BALANCE WITHOUT ITS WINDOW IS A WRONG NUMBER ───────────────────────────
 * `LeaveBalance` carries `yearStart`, `yearEnd` and `basis`, and none of them is
 * optional decoration. `basis` exists because a `HireAnniversary` profile with
 * no hire date FALLS BACK to the calendar year, and the fallback has to be
 * visible rather than looking like an answer — silently defaulting to
 * January–December is the exact bug the server was fixed for.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type LeaveFile = HrFile;

/**
 * How the balance window was chosen.
 *
 *   CompanyYear                 the calendar year, as the profile asks for
 *   HireAnniversary             twelve months from the employee's anniversary
 *   HireAnniversaryUnavailable  asked for the anniversary, no hire date on the
 *                               record — THIS IS A FALLBACK, and the figures
 *                               beside it cover the calendar year instead
 *   Explicit                    a window the caller supplied
 */
export type LeaveYearBasis =
  | 'CompanyYear'
  | 'HireAnniversary'
  | 'HireAnniversaryUnavailable'
  | 'Explicit';

export interface LeaveBalanceByType {
  leaveType: string;
  days: number | null;
  requests: number | null;
  deductsBalance: boolean;
}

export interface LeaveBalance {
  /** The period every figure below covers. Never render a figure without it. */
  yearStart: string | null;
  yearEnd: string | null;
  basis: LeaveYearBasis | null;
  entitlementDays: number | null;
  openingBalance: number | null;
  carryOverDays: number | null;
  usedDays: number | null;
  /**
   * Entitlement + opening + carry-over − used.
   *
   * **`usedDays` counts Pending as well as Approved requests** — the server's
   * consumed query is `status IN ('Pending','Approved')`. That is deliberate:
   * if pending did not count, someone could book their entitlement three times
   * over while the first request sat unapproved. The UI must not present any
   * other definition of remaining, or people will book against a number the
   * server disagrees with.
   */
  remainingDays: number | null;
  byType: LeaveBalanceByType[];
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: string;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  halfDay: string | null;
  /** The DECIDED figure, stored on the row. Not recomputed here — see below. */
  days: number | null;
  reason: string | null;
  handoverToEmployeeId: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
  files: LeaveFile[];
}

export interface LeaveProfile {
  policyName: string | null;
  leaveYearStart: string | null;
  annualEntitlementDays: number | null;
  openingBalance: number | null;
  carryOverDays: number | null;
  carryOverExpiry: string | null;
  encashmentEligible: boolean | null;
  airTicket: boolean | null;
  delegateEmployeeId: string | null;
  /** Joined from the employee record; what a HireAnniversary year needs. */
  hireDate: string | null;
}

export interface LeaveTypeDescriptor {
  key: string;
  labelKey: string;
  deductsBalance: boolean;
  paid: boolean;
}

export interface LeaveStatusDescriptor {
  key: string;
  labelKey: string;
  /** Counted by the balance. True for Pending as well as Approved. */
  consumesBalance: boolean;
  open: boolean;
}

export interface LeaveCatalog {
  types: LeaveTypeDescriptor[];
  statuses: LeaveStatusDescriptor[];
  yearStarts: { key: string; labelKey: string }[];
  /**
   * The server's day count for a supplied range, or null.
   *
   * **A suggestion, not the answer.** See `suggestionExcludesPublicHolidays`.
   */
  suggestedDays: number | null;
  /**
   * Always true today, and the reason the count above is only a suggestion:
   * spec 4.5 is not built, no holiday calendar exists anywhere, so the count
   * excludes rest days but NOT public holidays.
   *
   * Read from the response rather than assumed, so the day a calendar lands and
   * the server sends `false` the UI stops disclaiming without a redeploy.
   */
  suggestionExcludesPublicHolidays: boolean;
}

export const LEAVE_ENTITY = FILE_ENTITY.leave;

@Injectable({ providedIn: 'root' })
export class EmployeeLeaveService {
  private api = inject(ApiService);
  private files = inject(EmployeeFileService);

  async profile(employeeId: string): Promise<LeaveProfile | null> {
    const res = await this.api.request<any>(
      this.api.get(`employee/getLeaveProfile/${employeeId}`),
    );
    const r = res?.data;
    if (!r) return null;
    return {
      policyName: r?.policyName ?? null,
      leaveYearStart: r?.leaveYearStart ?? null,
      annualEntitlementDays: num(r?.annualEntitlementDays),
      openingBalance: num(r?.openingBalance),
      carryOverDays: num(r?.carryOverDays),
      carryOverExpiry: r?.carryOverExpiry ?? null,
      encashmentEligible: typeof r?.encashmentEligible === 'boolean' ? r.encashmentEligible : null,
      airTicket: typeof r?.airTicket === 'boolean' ? r.airTicket : null,
      delegateEmployeeId: r?.delegateEmployeeId ?? null,
      hireDate: r?.hireDate ?? null,
    };
  }

  async requests(employeeId: string): Promise<LeaveRequest[]> {
    const res = await this.api.request<any>(
      this.api.get(`employee/getLeaveRequests/${employeeId}`),
    );
    const rows: any[] = Array.isArray(res?.data) ? res.data : [];
    return rows.map(r => this.mapRequest(r));
  }

  /**
   * The balance, over the window the SERVER resolves.
   *
   * No `yearStart` / `yearEnd` is sent. The window belongs to the employee's
   * leave profile, and supplying one from here would be a second implementation
   * of the rule — precisely the bug the server was fixed for, where the
   * controller defaulted to January–December and anyone on a hire anniversary
   * had their balance computed over the wrong twelve months.
   */
  async balance(employeeId: string): Promise<LeaveBalance | null> {
    const res = await this.api.request<any>(
      this.api.get(`employee/getLeaveBalance/${employeeId}`),
    );
    const r = res?.data;
    if (!r) return null;
    return {
      yearStart: r?.yearStart ?? null,
      yearEnd: r?.yearEnd ?? null,
      // Taken as sent and never defaulted. A missing basis is not CompanyYear.
      basis: (r?.basis as LeaveYearBasis) ?? null,
      entitlementDays: num(r?.entitlementDays),
      openingBalance: num(r?.openingBalance),
      carryOverDays: num(r?.carryOverDays),
      usedDays: num(r?.usedDays),
      remainingDays: num(r?.remainingDays),
      byType: Array.isArray(r?.byType)
        ? r.byType.map((b: any) => ({
            leaveType: b?.leaveType ?? '',
            days: num(b?.days),
            requests: num(b?.requests),
            deductsBalance: b?.deductsBalance === true,
          }))
        : [],
    };
  }

  /**
   * The catalogue, optionally with a day suggestion for a range.
   *
   * The suggestion is asked of the server rather than counted here so there is
   * one implementation of "how many days is that". The portal counting its own
   * would disagree the moment rest days become configurable.
   */
  async catalog(range?: { startDate: string; endDate: string; halfDay?: string }): Promise<LeaveCatalog> {
    const query = range
      ? `?startDate=${encodeURIComponent(range.startDate)}`
        + `&endDate=${encodeURIComponent(range.endDate)}`
        + `&halfDay=${encodeURIComponent(range.halfDay ?? 'none')}`
      : '';
    const res = await this.api.request<any>(this.api.get(`employee/leaveCatalog${query}`));
    const d = res?.data;
    return {
      types: Array.isArray(d?.types) ? d.types : [],
      statuses: Array.isArray(d?.statuses) ? d.statuses : [],
      yearStarts: Array.isArray(d?.yearStarts) ? d.yearStarts : [],
      // Null means the server would not count it — an inverted range, an
      // unparseable date, or one longer than its 366-day bound. Null is NOT
      // zero: zero is a legitimate answer for a range falling entirely on rest
      // days, and conflating them would show "0 days" for a typo.
      suggestedDays: typeof d?.suggestedDays === 'number' ? d.suggestedDays : null,
      // Defaults to TRUE when absent. If the server did not say, assume the
      // count is still missing public holidays and keep disclaiming — the
      // failure of assuming otherwise is a day count presented as authoritative.
      suggestionExcludesPublicHolidays: d?.suggestionExcludesPublicHolidays !== false,
    };
  }

  async saveRequest(payload: Record<string, unknown>): Promise<{ id: string; warnings: string[] }> {
    const res = await this.api.request<any>(this.api.post('employee/saveLeaveRequest', payload));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the request');
    return {
      id: res?.data?.id ?? '',
      // The sick-leave evidence rule, returned as advice. It cannot be enforced
      // until uploads are proven, and refusing the save would make sick leave
      // unrecordable rather than merely undocumented.
      warnings: Array.isArray(res?.data?.warnings) ? res.data.warnings : [],
    };
  }

  /**
   * Approve or reject.
   *
   * Its own endpoint behind its own privilege — saving a request must not be
   * able to approve it in passing.
   */
  async decide(requestId: string, decision: 'Approved' | 'Rejected', comment: string | null): Promise<void> {
    const res = await this.api.request<any>(
      this.api.post('employee/decideLeaveRequest', { requestId, decision, comment }),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not record the decision');
  }

  async removeRequest(requestId: string): Promise<void> {
    const res = await this.api.request<any>(
      this.api.get(`employee/deleteLeaveRequest/${requestId}`),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not delete the request');
  }

  // ─── Attachments ───────────────────────────────────────────────────────
  // Sick-leave evidence. A CONFIDENTIAL entity server-side — medical
  // information — so every signed URL issued is audited.

  fileCatalog(): Promise<FileCatalog> {
    return this.files.catalog();
  }

  upload(requestId: string, file: File): Promise<void> {
    return this.files.upload(LEAVE_ENTITY, requestId, file);
  }

  downloadUrl(fileId: string): Promise<{ url: string; fileName: string }> {
    return this.files.downloadUrl(LEAVE_ENTITY, fileId);
  }

  removeFile(fileId: string): Promise<void> {
    return this.files.remove(LEAVE_ENTITY, fileId);
  }

  // ─── Mapping ───────────────────────────────────────────────────────────

  private mapRequest(r: any): LeaveRequest {
    return {
      id: r?.id ?? '',
      employeeId: r?.employeeId ?? '',
      leaveType: r?.leaveType ?? '',
      status: r?.status ?? null,
      startDate: r?.startDate ?? null,
      endDate: r?.endDate ?? null,
      halfDay: r?.halfDay ?? null,
      // The figure that was DECIDED and stored, which is what the balance
      // deducts. Never recomputed from the dates: a request approved for 5 days
      // must still say 5 days once a holiday calendar exists, or building one
      // would restate every historical balance in the system.
      days: num(r?.days),
      reason: r?.reason ?? null,
      handoverToEmployeeId: r?.handoverToEmployeeId ?? null,
      decidedBy: r?.decidedBy ?? null,
      decidedAt: r?.decidedAt ?? null,
      decisionComment: r?.decisionComment ?? null,
      files: mapHrFiles(r?.files),
    };
  }
}

/**
 * A numeric column as a number, or null.
 *
 * Postgres returns `numeric` as a STRING through node-postgres, so `days`,
 * `usedDays` and `remainingDays` all arrive as `"5.00"` rather than `5`. A
 * `typeof === 'number'` guard alone would discard every one of them and render
 * the whole balance as unknown.
 *
 * Null stays null. Absent stays null. Only an actual number survives.
 */
function num(v: any): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }
  return null;
}
