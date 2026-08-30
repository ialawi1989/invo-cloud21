/**
 * GOSI (Bahrain social insurance) settings — storage only.
 *
 * Mirrors `InvoCloudBack/src/repo/admin/employeeGosiTypes.ts` (the
 * escalation-schedule shape — see the header note in
 * `gosi.service.ts` about that file's unresolved merge conflict at the time
 * this was ported). This is company-wide statutory CONFIGURATION: the API
 * does not compute a GOSI deduction from it (`computationAvailable: false`
 * on `gosiCatalog`), it only stores the rates for payroll to use later.
 */

/** How wages are counted toward the contribution base. */
export type WageBasis = 'basic' | 'basic_plus_allowances';

/** One effective-dated GOSI contribution-rate period. */
export interface GosiSettingsRow {
  id: string;
  companyId: string;
  effectiveFrom: string;

  tier1EmployeeRatePercent: number | null;
  tier1EmployerRatePercent: number | null;

  /** Auto-escalation: the rate climbs each year without a new row. */
  tier1EmployeeRateAnnualIncrementPercent: number | null;
  tier1EmployeeRateEscalationEndYear: number | null;
  tier1EmployerRateAnnualIncrementPercent: number | null;
  tier1EmployerRateEscalationEndYear: number | null;

  tier2EmployeeRatePercent: number | null;
  tier2EmployerRatePercent: number | null;

  tier2EmployeeRateAnnualIncrementPercent: number | null;
  tier2EmployeeRateEscalationEndYear: number | null;
  tier2EmployerRateAnnualIncrementPercent: number | null;
  tier2EmployerRateEscalationEndYear: number | null;

  wageBasis: WageBasis | null;
  wageFloor: number | null;
  wageCeiling: number | null;

  /** Provenance — required on save. The source site blocks automated
   *  verification, so this is the audit trail for where a figure came from. */
  source: string | null;
  notes: string | null;

  createdAt: string;
  createdBy: string | null;
}

/** The payload the "add new effective period" form sends to `saveGosiSettings`. */
export type GosiSettingsInput = Omit<GosiSettingsRow, 'id' | 'companyId' | 'createdAt' | 'createdBy'>;

/** Tier 3 (non-GCC expatriate) end-of-service gratuity policy, effective-dated. */
export interface GosiTier3PolicyRow {
  id: string;
  companyId: string;
  effectiveFrom: string;
  /**
   * Three states, not two: `null` means the company has not yet decided
   * whether the state contribution replaces the end-of-service gratuity.
   * That is NOT the same as an explicit `false` ("no, gratuity is still owed
   * separately") — collapsing the two would silently misrepresent an
   * unconfigured company as having decided against it.
   */
  stateContributionReplacesGratuity: boolean | null;
  source: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
}

export type GosiTier3PolicyInput = Omit<GosiTier3PolicyRow, 'id' | 'companyId' | 'createdAt' | 'createdBy'>;

/** Static reference data from `gosiCatalog` — tiers, wage bases, and whether
 *  the API can compute a deduction from any of this (it cannot, yet). */
export interface GosiCatalog {
  tiers: string[];
  wageBases: string[];
  computationAvailable: boolean;
}
