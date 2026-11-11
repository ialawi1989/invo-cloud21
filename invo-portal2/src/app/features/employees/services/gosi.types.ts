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
export type WageBasis = 'basic' | 'basic_plus_allowances' | 'basic_plus_housing';

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

  /** Expatriate (non-national, non-GCC) shares. Both empty = outside the scheme.
   *  An employer-only charge is employee 0 + employer n. */
  tier3EmployeeRatePercent: number | null;
  tier3EmployerRatePercent: number | null;

  wageBasis: WageBasis | null;
  wageFloor: number | null;
  /** Per-tier minimums; each wins over `wageFloor` for its tier when set. */
  tier1WageFloor: number | null;
  tier2WageFloor: number | null;
  tier3WageFloor: number | null;
  wageCeiling: number | null;
  /** Scale the contributory wage down for unpaid leave and absence. Default off. */
  reduceForAbsence: boolean;

  /** Months between required re-checks of this row's figures against the
   *  official source (12 or 24 today), or `null` for no reminder. The
   *  stakeholder does not know the real escalation figures and would rather
   *  be prompted to look them up on a schedule than have the auto-escalation
   *  fields above guess at an annual increment — this is a reminder, never a
   *  computation. */
  reviewIntervalMonths: number | null;

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

/**
 * Suggested, UNCONFIRMED values for the company's country. They only pre-fill the
 * form — nothing is saved or deducted until the user reviews and saves.
 */
export interface GosiSuggestion {
  country: string;
  unconfirmed: true;
  authority: string;
  note: string;
  values: {
    tier1EmployeeRatePercent: number | null;
    tier1EmployerRatePercent: number | null;
    tier3EmployeeRatePercent: number | null;
    tier3EmployerRatePercent: number | null;
    wageBasis: WageBasis | null;
    wageFloor: number | null;
    tier1WageFloor: number | null;
    tier2WageFloor: number | null;
    tier3WageFloor: number | null;
    wageCeiling: number | null;
    reduceForAbsence: boolean;
  };
}

/**
 * A company's retirement ages (pension / social-insurance retirement age — used only
 * to WARN on the payroll run, never to stop a calculation). Empty = no figure.
 */
export interface RetirementAges {
  country: string;
  /** Effective ages: the company's own entry, else the country default (empty today). */
  nationalAge: number | null;
  expatriateAge: number | null;
  source: string;
  /** The company's OWN saved entry, or null when it has never saved one. */
  own: { nationalAge: number | null; expatriateAge: number | null } | null;
  /** True while the figures are unconfirmed. */
  verify: boolean;
  note: string;
}

export interface RetirementAgesInput {
  nationalAge: number | null;
  expatriateAge: number | null;
  source: string;
}

/** An INVO-maintained statutory rule for the company country (read-only). Payroll applies only `verified` ones. */
export interface GosiCountryRule {
  country: string;
  tier: 'Tier1Bahraini' | 'Tier2Gcc' | 'Tier3NonGccExpatriate';
  effectiveFrom: string;
  employeeRatePercent: number | null;
  employerRatePercent: number | null;
  employerRateAfterYears: number | null;
  employerRateAfterPercent: number | null;
  /** The employer rate climbs by this many points each calendar year, up to `employerRateEscalationEndYear`. */
  employerRateAnnualIncrementPercent?: number | null;
  employerRateEscalationEndYear?: number | null;
  wageBasis: WageBasis | null;
  wageFloor: number | null;
  wageCeiling: number | null;
  /** Wage bands (the flat rates above are then only the first band, for reference). */
  bands?: { from: number; to: number | null; employeeRatePercent: number; employerRatePercent: number }[] | null;
  bandMode?: 'marginal' | 'threshold' | null;
  status: 'verified' | 'awaiting_signoff';
  source: string | null;
  notes: string | null;
}

/** What a company-granted exemption waives for one employee. */
export type GosiExemptionScope = 'both' | 'employee' | 'employer';

/** A period during which one employee's contribution is waived. `toDate` null = open-ended. */
export interface GosiExemption {
  id: string;
  employeeId: string;
  fromDate: string;
  toDate: string | null;
  scope: GosiExemptionScope;
  reason: string;
  createdAt: string;
}
