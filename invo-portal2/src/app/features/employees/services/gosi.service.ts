import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import {
  GosiCatalog,
  GosiSettingsInput,
  GosiSettingsRow,
  GosiTier3PolicyInput,
  GosiTier3PolicyRow,
} from './gosi.types';

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

    wageBasis: r?.wageBasis === 'basic' || r?.wageBasis === 'basic_plus_allowances' ? r.wageBasis : null,
    wageFloor: num(r?.wageFloor),
    wageCeiling: num(r?.wageCeiling),

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
