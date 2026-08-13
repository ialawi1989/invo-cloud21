/**
 * Benefits rules — pure, so they can be tested without a component or a server.
 *
 * The same arrangement as `asset-return-rules.ts`: the decisions live here and
 * the template asks; nothing conditional is spelled out twice.
 */

/** A payroll component as the payroll tab sees it. */
export interface PayrollComponentLike {
  type: string | null;
  direction?: string | null;
}

/**
 * The payroll component key that conflicts with company housing.
 *
 * Matched case-insensitively against the server's catalogue key, which is
 * `Housing` (`employeePayrollTypes.ts`). Kept as a constant rather than
 * inlined so the conflict has exactly one definition.
 */
export const HOUSING_COMPONENT_KEY = 'housing';

/**
 * Does this employee already receive a housing ALLOWANCE?
 *
 * ── WHY THIS RULE EXISTS ─────────────────────────────────────────────────────
 * A housing allowance and a company-provided unit are two answers to the same
 * question — the company either houses someone or pays them to house
 * themselves. The spec marks them mutually exclusive because recording both is
 * either paying twice or a reconciliation someone does by hand forever.
 *
 * The check is deliberately narrow: it looks only for a live Housing component
 * and says nothing about whether it is recurring or what it is worth. A zero
 * housing allowance is still a housing allowance, and treating it as absent
 * would let both be set.
 */
export function hasHousingAllowance(components: readonly PayrollComponentLike[] | null): boolean {
  if (!Array.isArray(components)) return false;
  return components.some(
    (c) => String(c?.type ?? '').trim().toLowerCase() === HOUSING_COMPONENT_KEY,
  );
}

/** Why company housing cannot be switched on, or null when it can. */
export type HousingBlock = 'payrollHousingComponent' | null;

/**
 * May company housing be enabled?
 *
 * Returns the REASON rather than a boolean so the template renders an
 * explanation instead of a disabled control with no cause — a toggle that
 * silently refuses is indistinguishable from a broken one.
 *
 * Note the asymmetry, and it is deliberate: this blocks TURNING IT ON. A record
 * that already has both — because the data predates the rule, or payroll
 * changed afterwards — is shown as-is with the conflict visible. Silently
 * clearing one side would destroy a value the user never asked to lose, and
 * which side is wrong is not this screen's decision.
 */
export function housingBlockedBy(
  components: readonly PayrollComponentLike[] | null,
): HousingBlock {
  return hasHousingAllowance(components) ? 'payrollHousingComponent' : null;
}

/**
 * Is the record in the conflicting state right now?
 *
 * Distinct from `housingBlockedBy`: that one guards the control, this one
 * reports an existing contradiction so it can be surfaced rather than hidden.
 */
export function housingConflict(
  isProvided: boolean,
  components: readonly PayrollComponentLike[] | null,
): boolean {
  return isProvided && hasHousingAllowance(components);
}

/**
 * A contribution rate for display.
 *
 * Rates arrive as STRINGS (Postgres `numeric` through node-postgres). Parsing
 * happens here, at the point of use, and an unparseable or absent value returns
 * null so it renders as unknown — never as 0%. A retirement contribution shown
 * as zero because a field was empty is a claim the server never made.
 */
export function ratePercent(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Is an entitlement window currently open?
 *
 * `endDate` absent means open-ended, which is the common case — most benefits
 * have a start and no end. Dates are compared as ISO day strings rather than
 * `Date` objects so a timezone never moves an expiry across midnight.
 */
export function isActiveWindow(
  startDate: string | null,
  endDate: string | null,
  today: string,
): boolean {
  if (startDate && startDate > today) return false;
  if (endDate && endDate < today) return false;
  return true;
}
