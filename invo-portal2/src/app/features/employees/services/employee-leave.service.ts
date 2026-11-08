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
  /** How Annual leave is made available: all upfront, or accrued monthly. */
  accrualMethod: 'upfront' | 'monthly' | null;
  /** The part of the annual entitlement accrued so far (all of it when upfront). */
  accruedToDate: number | null;
  /** Accrued + opening + carry-over − used: what can be booked today. */
  availableNow: number | null;
  byEntitlement: LeaveEntitlementRow[];
  /** Net manual adjustments made in this leave year (already inside the figures above). */
  adjustments: number;
  /** Months that earned no annual leave, and why. */
  accrualSkipped: { month: string; reason: 'beforeFirstFullMonth' | 'unpaidLeave'; unpaidDays: number }[];
  unpaidThresholdDays: number | null;
  /** Time off in lieu — its own bucket, expiring, never part of annual leave. */
  compensatory: {
    earned: number;
    used: number;
    remaining: number;
    nextExpiry: string | null;
    expiryDays: number;
  } | null;
}

export type LedgerReason =
  'CORRECTION' | 'LEGAL_SETTLEMENT' | 'OPENING_BALANCE_FIX' | 'MANUAL_GRANT' | 'COMPENSATORY_EARNED' | 'OTHER';
export type LedgerBucket = 'annual' | 'compensatory';

export interface LedgerEntry {
  id: string;
  bucket: LedgerBucket;
  delta: number;
  reason: LedgerReason;
  comment: string;
  earnedOn: string | null;
  expiresOn: string | null;
  createdAt: string;
  createdByName: string | null;
}

export interface LeaveSettings {
  unpaidAccrualThresholdDays: number;
  compensatoryExpiryDays: number;
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
  /**
   * The branch this leave was filed against — whose holiday calendar decides
   * which days do not count. NOT the employee's primary branch.
   */
  branchId: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
  files: LeaveFile[];
}

export interface AirTicketEntitlement {
  isEntitled: boolean | null;
  class: string | null;
  destination: string | null;
  dependantsCovered: boolean | null;
  lastIssued: string | null;
}

export interface LeaveProfile {
  policyName: string | null;
  leaveYearStart: string | null;
  annualEntitlementDays: number | null;
  openingBalance: number | null;
  carryOverDays: number | null;
  carryOverExpiry: string | null;
  encashmentEligible: boolean | null;
  delegateEmployeeId: string | null;
  accrualRateDays: number | null;
  accrualOverrideReason: string | null;
  /**
   * Set once the first leave year has closed. After that the opening balance is
   * FIXED — the server keeps the stored value and ignores whatever is sent, so
   * the field must be shown read-only rather than silently discarded.
   */
  openingBalanceLockedAt: string | null;
  airTicket: AirTicketEntitlement | null;
  /**
   * False. Encashment and the air ticket are stored and nothing is computed
   * from them — no payout value, no accrual, no next-due date. Read from the
   * response rather than hardcoded, so the day those calculations land the
   * caveat disappears on its own.
   */
  entitlementValuesCalculated: boolean;
  /** Joined from the employee record; what a HireAnniversary year needs. */
  hireDate: string | null;
}

/** What a leave type gives. Descriptive: the server only ever WARNS against it. */
export interface LeaveEntitlement {
  /** null = as long as the supporting document says (exams). */
  days: number | null;
  /** year = refreshes each leave year; event = per occasion; lifetime = per career. */
  per: 'year' | 'event' | 'lifetime';
  dayBasis: 'calendar' | 'working';
  maxPerRequest?: number;
  maxTimes?: number;
  pay: 'full' | 'half' | 'unpaid' | 'mixed';
  minServiceMonths?: number;
  audience?: 'female' | 'male' | 'muslim' | 'muslimFemale';
  /** upfront = whole figure from day one; monthly = one twelfth per completed month. */
  accrualMethod?: 'upfront' | 'monthly';
  source?: string;
  /** From a secondary summary — confirm against the law before relying on it. */
  verify?: boolean;
}

export interface LeaveTypeDescriptor {
  key: string;
  /** i18n key for a built-in type; empty for one the company added. */
  labelKey: string;
  /** Name of a company-added type (no i18n key). */
  label?: string;
  deductsBalance: boolean;
  paid: boolean;
  /** False = switched off for this company: hidden from new requests. */
  enabled?: boolean;
  entitlement?: LeaveEntitlement;
}

/**
 * A multiplier on the BASE rate, as a TOTAL: 1.25 = one and a quarter times the
 * normal rate. null = not configured for this country (not "zero" or "one").
 */
export interface RateMultiplier {
  multiplier: number | null;
  compensatoryDayAllowed?: boolean;
  /** Default not yet confirmed against the law. */
  verify?: boolean;
  source?: string;
}

export type RateMultiplierKey =
  'overtimeDaytime' | 'overtimeNighttime' | 'weeklyRestDayWorked' | 'publicHolidayWorked';
export type RateMultipliers = Record<RateMultiplierKey, RateMultiplier>;

/** One yearly-refreshing entitlement with its running balance. */
export interface LeaveEntitlementRow {
  leaveType: string;
  /** Sick leave only: full / half / unpaid. */
  tier: string | null;
  pay: string;
  allowance: number;
  used: number;
  remaining: number;
  accrualMethod?: 'upfront' | 'monthly';
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
      delegateEmployeeId: r?.delegateEmployeeId ?? null,
      accrualRateDays: num(r?.accrualRateDays),
      accrualOverrideReason: r?.accrualOverrideReason ?? null,
      openingBalanceLockedAt: r?.openingBalanceLockedAt ?? null,
      airTicket: r?.airTicket
        ? {
            isEntitled: typeof r.airTicket.isEntitled === 'boolean' ? r.airTicket.isEntitled : null,
            class: r.airTicket.class ?? null,
            destination: r.airTicket.destination ?? null,
            dependantsCovered:
              typeof r.airTicket.dependantsCovered === 'boolean' ? r.airTicket.dependantsCovered : null,
            lastIssued: r.airTicket.lastIssued ?? null,
          }
        : null,
      // Defaults to FALSE when absent: assume nothing is computed and keep the
      // caveat up. Assuming the other way would present a stored eligibility
      // flag as if a value had been worked out from it.
      entitlementValuesCalculated: r?.entitlementValuesCalculated === true,
      hireDate: r?.hireDate ?? null,
    };
  }

  /**
   * Save the leave profile — this is what sets someone's entitlement.
   *
   * HR only: the server requires `employeeLeaveSecurity.edit` and does NOT fall
   * back to `isSelf`, unlike a leave request. Nobody sets their own entitlement.
   *
   * `openingBalance` is ignored by the server once `openingBalanceLockedAt` is
   * set — the first leave-year close freezes it, because every historical
   * balance is derived from it.
   */
  async saveProfile(payload: Record<string, unknown>): Promise<{ id: string }> {
    const res = await this.api.request<any>(this.api.post('employee/saveLeaveProfile', payload));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the leave profile');
    return { id: res?.data?.id ?? '' };
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
      accrualMethod: r?.accrualMethod === 'monthly' ? 'monthly' : r?.accrualMethod === 'upfront' ? 'upfront' : null,
      accruedToDate: num(r?.accruedToDate),
      availableNow: num(r?.availableNow),
      byEntitlement: Array.isArray(r?.byEntitlement)
        ? r.byEntitlement.map((e: any) => ({
            leaveType: e?.leaveType ?? '',
            tier: e?.tier ?? null,
            pay: e?.pay ?? 'full',
            allowance: Number(e?.allowance ?? 0),
            used: Number(e?.used ?? 0),
            remaining: Number(e?.remaining ?? 0),
            accrualMethod: e?.accrualMethod === 'monthly' ? 'monthly' : e?.accrualMethod === 'upfront' ? 'upfront' : undefined,
          }))
        : [],
      adjustments: Number(r?.adjustments ?? 0),
      accrualSkipped: Array.isArray(r?.accrualSkipped) ? r.accrualSkipped : [],
      unpaidThresholdDays: num(r?.unpaidThresholdDays),
      compensatory: r?.compensatory
        ? {
            earned: Number(r.compensatory.earned ?? 0),
            used: Number(r.compensatory.used ?? 0),
            remaining: Number(r.compensatory.remaining ?? 0),
            nextExpiry: r.compensatory.nextExpiry ?? null,
            expiryDays: Number(r.compensatory.expiryDays ?? 90),
          }
        : null,
    };
  }

  /** The balance ledger, newest first. HR only. */
  async ledger(employeeId: string): Promise<LedgerEntry[]> {
    const res = await this.api.request<any>(this.api.get(`employee/getLeaveLedger/${employeeId}`));
    return Array.isArray(res?.data) ? res.data : [];
  }

  /**
   * Add or remove days by hand. Append-only on the server: a mistake is fixed
   * with an opposite entry, never an edit. The comment is mandatory.
   */
  async adjustBalance(payload: {
    employeeId: string; bucket: LedgerBucket; delta: number;
    reason: LedgerReason; comment: string; earnedOn?: string | null;
  }): Promise<void> {
    const res = await this.api.request<any>(this.api.post('employee/adjustLeaveBalance', payload));
    if (res?.success === false) throw new Error(res?.msg || 'Could not record the adjustment');
  }

  async leaveSettings(): Promise<LeaveSettings> {
    const res = await this.api.request<any>(this.api.get('employee/leaveSettings'));
    return {
      unpaidAccrualThresholdDays: Number(res?.data?.unpaidAccrualThresholdDays ?? 15),
      compensatoryExpiryDays: Number(res?.data?.compensatoryExpiryDays ?? 90),
    };
  }

  async saveLeaveSettings(s: LeaveSettings): Promise<void> {
    const res = await this.api.request<any>(this.api.post('employee/saveLeaveSettings', s));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the accrual rules');
  }

  async resetLeaveSettings(): Promise<void> {
    const res = await this.api.request<any>(this.api.post('employee/saveLeaveSettings', { reset: true }));
    if (res?.success === false) throw new Error(res?.msg || 'Could not reset the accrual rules');
  }

  /** Replace the company's whole leave-type list (HR only). */
  async saveEntitlementTypes(types: LeaveTypeDescriptor[]): Promise<void> {
    const res = await this.api.request<any>(this.api.post('employee/saveLeaveEntitlementTypes', { types }));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the leave types');
  }

  /** Pay multipliers for overtime, rest days and public holidays. */
  async rateMultipliers(): Promise<RateMultipliers> {
    const res = await this.api.request<any>(this.api.get('employee/rateMultipliers'));
    const d = res?.data ?? {};
    const one = (k: string): RateMultiplier => ({
      multiplier: typeof d?.[k]?.multiplier === 'number' ? d[k].multiplier : null,
      compensatoryDayAllowed: d?.[k]?.compensatoryDayAllowed === true,
      verify: d?.[k]?.verify === true,
      source: d?.[k]?.source ?? undefined,
    });
    return {
      overtimeDaytime: one('overtimeDaytime'),
      overtimeNighttime: one('overtimeNighttime'),
      weeklyRestDayWorked: one('weeklyRestDayWorked'),
      publicHolidayWorked: one('publicHolidayWorked'),
    };
  }

  async saveRateMultipliers(multipliers: RateMultipliers): Promise<void> {
    const res = await this.api.request<any>(this.api.post('employee/saveRateMultipliers', { multipliers }));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the rates');
  }

  async resetRateMultipliers(): Promise<void> {
    const res = await this.api.request<any>(this.api.post('employee/saveRateMultipliers', { reset: true }));
    if (res?.success === false) throw new Error(res?.msg || 'Could not reset the rates');
  }

  /** Back to the country's defaults. */
  async resetEntitlementTypes(): Promise<void> {
    const res = await this.api.request<any>(this.api.get('employee/resetLeaveEntitlementTypes'));
    if (res?.success === false) throw new Error(res?.msg || 'Could not reset the leave types');
  }

  /**
   * The catalogue, optionally with a day suggestion for a range.
   *
   * The suggestion is asked of the server rather than counted here so there is
   * one implementation of "how many days is that". The portal counting its own
   * would disagree the moment rest days become configurable.
   */
  async catalog(
    range?: { startDate: string; endDate: string; halfDay?: string },
    /**
     * The branch whose holiday calendar applies.
     *
     * ── NO CALLER SUPPLIES THIS YET, AND THAT IS SAFE ──────────────────────
     * The server excludes public holidays only for a branch that HAS a
     * calendar, and answers `suggestionExcludesPublicHolidays: true` when it
     * cannot tell — which is what happens while this is undefined. So the
     * count is unchanged and the disclaimer stays.
     *
     * That is the conservative direction on purpose: the failure of guessing a
     * branch would be a suggestion that silently excluded the WRONG branch's
     * holidays. Wiring it up needs the employee's branch on the leave screen,
     * which it does not currently load.
     */
    branchId?: string,
  ): Promise<LeaveCatalog> {
    const query = range
      ? `?startDate=${encodeURIComponent(range.startDate)}`
        + `&endDate=${encodeURIComponent(range.endDate)}`
        + `&halfDay=${encodeURIComponent(range.halfDay ?? 'none')}`
        + (branchId ? `&branchId=${encodeURIComponent(branchId)}` : '')
      : (branchId ? `?branchId=${encodeURIComponent(branchId)}` : '');
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
      branchId: r?.branchId ?? null,
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
