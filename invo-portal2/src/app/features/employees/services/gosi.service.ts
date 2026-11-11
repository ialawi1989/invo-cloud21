import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import {
  GosiCatalog,
  GosiSettingsInput,
  GosiSettingsRow,
  GosiCountryRule,
  GosiExemption,
  GosiSuggestion,
  GosiTier3PolicyInput,
  GosiTier3PolicyRow, RetirementAges, RetirementAgesInput } from './gosi.types';

/**
 * GosiService
 * ───────────
 * Wraps `InvoCloudBack`'s `employee/gosi*` endpoints (see
 * `src/routes/v1/app/employee.ts` and `src/controller/admin/employeeGosi.controller.ts`):
 *
 *   GET  employee/gosiCatalog        — tiers, wage bases, computationAvailable
 *   GET  employee/gosiSettings       — GosiSettingsRow[], one per effective period
 *   POST employee/saveGosiSettings   — create a new effective period
 *   GET  employee/gosiTier3Policy    — GosiTier3PolicyRow[]
 *   POST employee/saveGosiTier3Policy — create a new tier-3 policy period
 *
 * ── PORTED AGAINST AN UNRESOLVED MERGE CONFLICT ──────────────────────────────
 * At the time this was written, `InvoCloudBack`'s
 * `src/repo/admin/employeeGosiTypes.ts` and `employeeGosi.repo.ts` carried
 * committed, unresolved `<<<<<<<`/`=======`/`>>>>>>>` markers from merge
 * `fafa671ba` (merging `3a7d47902` "no computation" into `cd83c333a` "with
 * per-rate escalation schedule"). The escalation-schedule (HEAD) side was
 * taken as authoritative because the repo's own `INSERT INTO "GosiSettings"`
 * column list matches it — but that file needs to be fixed on the backend
 * before this can be verified end-to-end. If the resolved backend ends up
 * with a different shape, `gosi.types.ts` and the mapping below are the only
 * two places that need to change.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The backend's `numeric` columns arrive as strings; every rate/amount field
 * is coerced through `num()` here so the rest of the app only ever sees
 * numbers or `null`, matching the codebase's existing coercion pattern (see
 * `employee-payroll.service.ts`).
 */
@Injectable({ providedIn: 'root' })
export class GosiService {
  private api = inject(ApiService);

  async getCatalog(): Promise<GosiCatalog | null> {
    const res = await this.api.request<any>(this.api.get('employee/gosiCatalog'));
    if (res?.success === false || !res?.data) return null;
    return {
      tiers: Array.isArray(res.data.tiers) ? res.data.tiers : [],
      wageBases: Array.isArray(res.data.wageBases) ? res.data.wageBases : [],
      computationAvailable: res.data.computationAvailable === true,
    };
  }

  /** Every stored effective period, in whatever order the server returns —
   *  callers sort by `effectiveFrom` descending for display. */
  /** Suggested, UNCONFIRMED values for the company's country, or null. */
  async suggestions(): Promise<GosiSuggestion | null> {
    const res = await this.api.request<any>(this.api.get('employee/gosiSuggestions'));
    if (res?.success === false) return null;
    return (res?.data?.suggestion as GosiSuggestion | null) ?? null;
  }

  /** Waiver windows for one employee, newest first. */
  async exemptions(employeeId: string): Promise<GosiExemption[]> {
    const res = await this.api.request<any>(this.api.get('employee/gosiExemptions/' + encodeURIComponent(employeeId)));
    if (res?.success === false) throw new Error(res?.msg || 'Could not load the exemptions');
    return Array.isArray(res?.data) ? (res.data as GosiExemption[]) : [];
  }

  async saveExemption(input: { employeeId: string; fromDate: string; toDate: string | null; scope: string; reason: string }): Promise<GosiExemption> {
    const res = await this.api.request<any>(this.api.post('employee/saveGosiExemption', input));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the exemption');
    return res.data as GosiExemption;
  }

  async deleteExemption(id: string): Promise<void> {
    const res = await this.api.request<any>(this.api.post('employee/deleteGosiExemption', { id }));
    if (res?.success === false) throw new Error(res?.msg || 'Could not delete the exemption');
  }

  /** INVO-maintained rules for the company country (every status; payroll applies verified ones only). */
  async countryRules(): Promise<GosiCountryRule[]> {
    const res = await this.api.request<any>(this.api.get('employee/gosiCountryRules'));
    if (res?.success === false) return [];
    return Array.isArray(res?.data?.rules) ? (res.data.rules as GosiCountryRule[]) : [];
  }

  async retirementAges(): Promise<RetirementAges | null> {
    const res = await this.api.request<any>(this.api.get('employee/retirementAges'));
    if (res?.success === false) return null;
    const d = res?.data;
    if (!d) return null;
    return {
      country: String(d.country ?? ''),
      nationalAge: num(d.nationalAge),
      expatriateAge: num(d.expatriateAge),
      source: String(d.source ?? ''),
      own: d.own ? { nationalAge: num(d.own.nationalAge), expatriateAge: num(d.own.expatriateAge) } : null,
      verify: d.verify !== false,
      note: String(d.note ?? ''),
    };
  }

  async saveRetirementAges(input: RetirementAgesInput): Promise<void> {
    const res = await this.api.request<any>(this.api.post('employee/saveRetirementAges', input));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the retirement ages');
  }

  async resetRetirementAges(): Promise<void> {
    const res = await this.api.request<any>(this.api.post('employee/saveRetirementAges', { reset: true }));
    if (res?.success === false) throw new Error(res?.msg || 'Could not reset the retirement ages');
  }

  async list(): Promise<GosiSettingsRow[]> {
    const res = await this.api.request<any>(this.api.get('employee/gosiSettings'));
    if (res?.success === false) throw new Error(res?.msg || 'Could not load GOSI settings');
    const raw = Array.isArray(res?.data) ? res.data : [];
    return raw.map(mapSettingsRow);
  }

  /** Appends a new effective period. The backend never updates a row in
   *  place — a changed rate is always a new dated period. */
  async save(input: GosiSettingsInput): Promise<GosiSettingsRow> {
    const res = await this.api.request<any>(
      this.api.post('employee/saveGosiSettings', toSettingsPayload(input)),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not save GOSI settings');
    return mapSettingsRow(res?.data ?? {});
  }

  /** Removes one rate period (company-scoped on the server). */
  async delete(id: string): Promise<void> {
    const res = await this.api.request<any>(this.api.post('employee/deleteGosiSettings', { id }));
    if (res?.success === false) throw new Error(res?.msg || 'Could not delete the GOSI period');
  }

  async listTier3Policy(): Promise<GosiTier3PolicyRow[]> {
    const res = await this.api.request<any>(this.api.get('employee/gosiTier3Policy'));
    if (res?.success === false) throw new Error(res?.msg || 'Could not load the Tier 3 gratuity policy');
    const raw = Array.isArray(res?.data) ? res.data : [];
    return raw.map(mapTier3Row);
  }

  async saveTier3Policy(input: GosiTier3PolicyInput): Promise<GosiTier3PolicyRow> {
    const res = await this.api.request<any>(
      this.api.post('employee/saveGosiTier3Policy', toTier3Payload(input)),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the Tier 3 gratuity policy');
    return mapTier3Row(res?.data ?? {});
  }
}

// ─── Wire mapping ────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapSettingsRow(r: any): GosiSettingsRow {
  return {
    id: String(r?.id ?? ''),
    companyId: String(r?.companyId ?? ''),
    effectiveFrom: String(r?.effectiveFrom ?? '').slice(0, 10),

    tier1EmployeeRatePercent: num(r?.tier1EmployeeRatePercent),
    tier1EmployerRatePercent: num(r?.tier1EmployerRatePercent),
    tier1EmployeeRateAnnualIncrementPercent: num(r?.tier1EmployeeRateAnnualIncrementPercent),
    tier1EmployeeRateEscalationEndYear: num(r?.tier1EmployeeRateEscalationEndYear),
    tier1EmployerRateAnnualIncrementPercent: num(r?.tier1EmployerRateAnnualIncrementPercent),
    tier1EmployerRateEscalationEndYear: num(r?.tier1EmployerRateEscalationEndYear),

    tier2EmployeeRatePercent: num(r?.tier2EmployeeRatePercent),
    tier2EmployerRatePercent: num(r?.tier2EmployerRatePercent),
    tier2EmployeeRateAnnualIncrementPercent: num(r?.tier2EmployeeRateAnnualIncrementPercent),
    tier2EmployeeRateEscalationEndYear: num(r?.tier2EmployeeRateEscalationEndYear),
    tier2EmployerRateAnnualIncrementPercent: num(r?.tier2EmployerRateAnnualIncrementPercent),
    tier2EmployerRateEscalationEndYear: num(r?.tier2EmployerRateEscalationEndYear),

    tier3EmployeeRatePercent: num(r?.tier3EmployeeRatePercent),
    tier3EmployerRatePercent: num(r?.tier3EmployerRatePercent),

    wageBasis: r?.wageBasis === 'basic' || r?.wageBasis === 'basic_plus_allowances'
      || r?.wageBasis === 'basic_plus_housing' ? r.wageBasis : null,
    wageFloor: num(r?.wageFloor),
    tier1WageFloor: num(r?.tier1WageFloor),
    tier2WageFloor: num(r?.tier2WageFloor),
    tier3WageFloor: num(r?.tier3WageFloor),
    wageCeiling: num(r?.wageCeiling),
    reduceForAbsence: r?.reduceForAbsence === true,

    reviewIntervalMonths: num(r?.reviewIntervalMonths),

    source: r?.source ?? null,
    notes: r?.notes ?? null,

    createdAt: String(r?.createdAt ?? ''),
    createdBy: r?.createdBy ?? null,
  };
}

function toSettingsPayload(input: GosiSettingsInput): Record<string, unknown> {
  return { ...input };
}

function mapTier3Row(r: any): GosiTier3PolicyRow {
  return {
    id: String(r?.id ?? ''),
    companyId: String(r?.companyId ?? ''),
    effectiveFrom: String(r?.effectiveFrom ?? '').slice(0, 10),
    stateContributionReplacesGratuity:
      r?.stateContributionReplacesGratuity === true
        ? true
        : r?.stateContributionReplacesGratuity === false
          ? false
          : null,
    source: r?.source ?? null,
    notes: r?.notes ?? null,
    createdAt: String(r?.createdAt ?? ''),
    createdBy: r?.createdBy ?? null,
  };
}

function toTier3Payload(input: GosiTier3PolicyInput): Record<string, unknown> {
  return { ...input };
}
