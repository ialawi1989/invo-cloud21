/**
 * End of Service — the contract and its rules.
 *
 * Spec §4.11. Frontend-first: NOTHING in InvoCloudBack serves any of this yet,
 * and the tab is staged `ready: false` behind an `hr.eos` feature key.
 *
 * ── NO GRATUITY. NO SETTLEMENT ARITHMETIC. AT ALL. ───────────────────────────
 * Settlement lines are MANUALLY ENTERED. Nothing here computes an amount from
 * a service period, a leave balance or a notice shortfall, and nothing should
 * be added later without the jurisdiction decision that is still open.
 *
 * The reason is the one the spec gives and payroll already learned twice: a
 * wrong final settlement is not a bug report, it is an underpayment that looks
 * authoritative all the way to the bank transfer, and it is discovered by the
 * person who has just left. `statutoryCalculationsAvailable: false` from the
 * server is what the screen displays; the caveat is NOT hardcoded here, so the
 * day a rule set exists the disclaimer stops on its own — the same mechanism as
 * `suggestionExcludesPublicHolidays` for leave.
 *
 * `noticeServedDays` is the ONE computed figure, and it is computed from two
 * dates and nothing else — no jurisdiction, no policy, no money.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── terminationDate STAYS TOP-LEVEL AND AUTHORITATIVE ────────────────────────
 * EOS hangs off it. `eos.lastWorkingDay` may legitimately differ (garden leave,
 * a notice period served after the last day worked), and on COMPLETION the
 * employee's `terminationDate` is set from `lastWorkingDay`. EOS never shadows
 * it and never becomes a second answer to "when did they leave".
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type EosType =
  | 'Resignation' | 'Termination' | 'EndOfContract' | 'Retirement' | 'DeathInService';

export type ClearanceStatus = 'Pending' | 'Cleared' | 'Blocked';

export interface ClearanceRow {
  id: string;
  department: string;
  owner: string | null;
  status: ClearanceStatus;
  /** Required when Blocked — a block nobody explained cannot be acted on. */
  blockingReason: string | null;
  clearedAt: string | null;
}

/**
 * One settlement line. Every amount is TYPED IN.
 *
 * `calculationNote` is free text a human writes to explain where the figure
 * came from — it is not generated, because generating it would imply the
 * figure was too.
 */
export interface SettlementLine {
  id: string;
  labelKey: string;
  /** Manually entered. Null means "not yet decided", never zero. */
  amount: number | null;
  calculationNote: string | null;
  isOverridden: boolean;
  /** Required when isOverridden — an override with no reason is unauditable. */
  overrideReason: string | null;
}

export interface ExitInterview {
  conductedBy: string | null;
  date: string | null;
  summary: string | null;
}

export interface EosRecord {
  id: string | null;
  type: EosType | null;
  noticeGivenDate: string | null;
  lastWorkingDay: string | null;
  reason: string | null;
  rehireEligible: boolean;
  /** Required when rehireEligible is false. */
  rehireReason: string | null;
  exitInterview: ExitInterview;
  clearance: ClearanceRow[];
  settlement: SettlementLine[];
  visaCancellationDate: string | null;
  accessRevokedAt: string | null;
  completedAt: string | null;
}

/** What the server says it can and cannot do. Displayed, never assumed. */
export interface EosCapabilities {
  available: boolean;
  /**
   * False today, and the screen says so in the server's own terms. When a
   * jurisdiction rule set exists the server flips this and the disclaimer
   * disappears with no portal release.
   */
  statutoryCalculationsAvailable: boolean;
  reason: string | null;
}

/** The departments a clearance list starts with, per spec §4.11. */
export const SEEDED_CLEARANCE_DEPARTMENTS = [
  'IT', 'Finance', 'HR', 'Admin', 'LineManager',
] as const;

export function seedClearance(): ClearanceRow[] {
  return SEEDED_CLEARANCE_DEPARTMENTS.map(department => ({
    id: '',
    department,
    owner: null,
    status: 'Pending' as ClearanceStatus,
    blockingReason: null,
    clearedAt: null,
  }));
}

// ─── Rules ────────────────────────────────────────────────────────────────────

/**
 * Days between notice and the last working day, inclusive of neither endpoint's
 * time of day — these are dates, not instants.
 *
 * The ONLY computed figure in the module, and it is arithmetic on two dates.
 * A shortfall against the contractual notice period is what creates a
 * payment-in-lieu line, but this function does not know what the contractual
 * period is and does not price anything.
 *
 * Returns null when either date is missing, never 0: "not entered" and "notice
 * given on the last day" are different answers and 0 is a real one.
 */
/**
 * A `YYYY-MM-DD` day as a UTC instant.
 *
 * ── EXPORTED SO THE UTC-NESS IS TESTABLE AT ALL ──────────────────────────────
 * Parsing these as LOCAL time shifts both endpoints equally, so the DIFFERENCE
 * between two days is unchanged and `noticeServedDays` cannot tell the two
 * apart — except across a DST boundary, which a machine in a zone without DST
 * can never produce. A mutant dropping the `Z` therefore survived every
 * assertion made through `noticeServedDays`.
 *
 * The parse is asserted directly instead: an absolute epoch IS observable from
 * any timezone. That is the only place the difference shows.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function parseDayUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function noticeServedDays(
  noticeGivenDate: string | null,
  lastWorkingDay: string | null,
): number | null {
  if (!noticeGivenDate || !lastWorkingDay) return null;
  const from = parseDayUtc(noticeGivenDate);
  const to = parseDayUtc(lastWorkingDay);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  // A last working day BEFORE notice was given is a data-entry error, not a
  // negative notice period. Reported as 0 rather than a negative number, which
  // would flow into a shortfall and read as an entitlement.
  const days = Math.round((to - from) / 86_400_000);
  return days < 0 ? 0 : days;
}

/**
 * Why clearance cannot complete yet.
 *
 * ── AN UNRETURNED ASSET BLOCKS, AND IT IS READ, NOT RE-DEFINED ───────────────
 * "Still assigned" is the SERVER's definition, delivered by
 * `getOpenAssets/:employeeId` — the same call the assets tab uses. It is passed
 * in here as a count rather than recomputed from an asset list, because
 * filtering client-side would be a second definition of "outstanding" and the
 * two would disagree the first time a status is added.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Returns i18n keys plus the offending rows, so the screen states every reason
 * at once. Someone chasing a clearance needs the whole list, not the first
 * problem re-discovered five times.
 */
export interface ClearanceBlocker {
  key: string;
  detail: string | null;
}

export function clearanceBlockers(
  clearance: ClearanceRow[],
  openAssetCount: number,
): ClearanceBlocker[] {
  const out: ClearanceBlocker[] = [];

  if (openAssetCount > 0) {
    out.push({ key: 'EMPLOYEES.EOS.BLOCKED_OPEN_ASSETS', detail: String(openAssetCount) });
  }
  for (const row of clearance) {
    if (row.status === 'Blocked') {
      out.push({ key: 'EMPLOYEES.EOS.BLOCKED_DEPARTMENT', detail: row.department });
    } else if (row.status === 'Pending') {
      out.push({ key: 'EMPLOYEES.EOS.PENDING_DEPARTMENT', detail: row.department });
    }
  }
  return out;
}

/** Clearance is complete only when every row is Cleared and no asset is held. */
export function clearanceComplete(clearance: ClearanceRow[], openAssetCount: number): boolean {
  return clearanceBlockers(clearance, openAssetCount).length === 0;
}

/**
 * Everything stopping the EOS being completed.
 *
 * Completion is what sets the employee's top-level `terminationDate`, so the
 * bar is deliberately high: it is the irreversible step.
 */
export function completionBlockers(
  record: EosRecord,
  openAssetCount: number,
  requiresVisaCancellation: boolean,
): ClearanceBlocker[] {
  const out = clearanceBlockers(record.clearance, openAssetCount);

  if (!record.type) out.push({ key: 'EMPLOYEES.EOS.NEEDS_TYPE', detail: null });
  if (!record.lastWorkingDay) out.push({ key: 'EMPLOYEES.EOS.NEEDS_LAST_DAY', detail: null });
  if (!record.reason) out.push({ key: 'EMPLOYEES.EOS.NEEDS_REASON', detail: null });
  // "Not eligible for rehire" follows someone for years; it does not get to be
  // an unexplained checkbox.
  if (!record.rehireEligible && !record.rehireReason?.trim()) {
    out.push({ key: 'EMPLOYEES.EOS.NEEDS_REHIRE_REASON', detail: null });
  }
  // Spec: required when the employee is not a national. The CALLER decides
  // that, from the profile — this function is not given a nationality, so it
  // cannot encode a country rule by accident.
  if (requiresVisaCancellation && !record.visaCancellationDate) {
    out.push({ key: 'EMPLOYEES.EOS.NEEDS_VISA_CANCELLATION', detail: null });
  }
  for (const line of record.settlement) {
    if (line.isOverridden && !line.overrideReason?.trim()) {
      out.push({ key: 'EMPLOYEES.EOS.NEEDS_OVERRIDE_REASON', detail: line.labelKey });
    }
  }
  return out;
}

/**
 * The settlement total.
 *
 * A SUM OF WHAT WAS TYPED IN, and nothing else. It derives no line, applies no
 * rate and prorates nothing. Lines left null are excluded rather than counted
 * as zero — a settlement with an undecided line has no total, and showing one
 * would present an incomplete figure as final.
 */
export function settlementTotal(lines: SettlementLine[]): number | null {
  const entered = lines.filter(l => typeof l.amount === 'number');
  if (!entered.length) return null;
  if (entered.length !== lines.length) return null;
  return entered.reduce((sum, l) => sum + (l.amount as number), 0);
}
