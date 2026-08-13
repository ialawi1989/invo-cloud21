import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/http/api.service';
import { FileCatalog, HrFile, EmployeeFileService, mapHrFiles } from './employee-file.service';

/**
 * Employee benefits — NON-CASH entitlements only.
 *
 * ── WHAT DOES NOT BELONG HERE ────────────────────────────────────────────────
 * Housing and transport ALLOWANCES are payroll components (`employees.payroll.
 * component.housing` / `.transport`), not benefits. The spec calls the
 * duplication out by name because it is the obvious wrong turn: a housing
 * allowance recorded here as well as in payroll is either paid twice or
 * reconciled by hand forever.
 *
 * `companyHousing` below is the opposite thing — the company PROVIDES a unit
 * instead of paying an allowance — which is why the two are mutually exclusive
 * and why that rule is enforced rather than documented (see benefit-rules.ts).
 *
 * ── NONE OF THIS HAS EXECUTED ────────────────────────────────────────────────
 * The backend has no benefits endpoints yet. The names below are a CONTRACT
 * PROPOSAL, written to the conventions the other HR services already follow —
 * `employee/verbNoun`, the `{ success, msg, data }` envelope, GET for deletes
 * (matching `deleteAsset`). Every field is defaulted so the tab renders an
 * honest empty state against a 404 rather than throwing.
 *
 * ── NUMERICS ARRIVE AS STRINGS ───────────────────────────────────────────────
 * `employeeRate` / `employerRate` are Postgres `numeric`, which node-postgres
 * returns as a STRING. They are typed `string | null` and kept that way rather
 * than parsed on arrival: `Number('')` is 0, and a contribution rate that
 * renders as 0% because a field was empty is a claim the server never made.
 * Parse at the point of arithmetic, never at the boundary.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type BenefitFile = HrFile;

/** Health cover. `dependantsCovered` holds ids from `profile.dependents[]`. */
export interface HealthInsurance {
  provider: string | null;
  policyNumber: string | null;
  class: string | null;
  startDate: string | null;
  expiryDate: string | null;
  /** Ids into the employee's own `profile.dependents[]`, never free text. */
  dependantsCovered: string[];
  /** The insurance card itself. Empty until the file entity is registered. */
  card: BenefitFile[];
}

export interface RetirementPlan {
  scheme: string | null;
  /** Percentage, as sent. See the numerics note above. */
  employeeRate: string | null;
  employerRate: string | null;
  enrolledOn: string | null;
}

/**
 * A company-provided unit.
 *
 * Mutually exclusive with a Housing component on the employee's payroll — the
 * company either houses them or pays them to house themselves.
 */
export interface CompanyHousing {
  isProvided: boolean;
  unit: string | null;
  startDate: string | null;
  endDate: string | null;
}

/**
 * A company vehicle, as a REFERENCE to an asset assignment.
 *
 * Deliberately not a free-text "vehicle" field. The car is company property
 * that is issued, returned and cleared at end of service, which is precisely
 * what the assets module already does — a second copy here would be a second
 * answer to "what does this person still hold".
 */
export interface CompanyVehicle {
  /** `AssetAssignment.id`. Null when no vehicle is issued. */
  assetId: string | null;
  /** Denormalised for display so the tab need not fetch every assignment. */
  assetTag: string | null;
  description: string | null;
}

export interface OtherBenefit {
  id: string;
  name: string;
  value: string | null;
  startDate: string | null;
  endDate: string | null;
  files: BenefitFile[];
}

export interface BenefitsRecord {
  employeeId: string;
  healthInsurance: HealthInsurance;
  retirementPlan: RetirementPlan;
  companyHousing: CompanyHousing;
  companyVehicle: CompanyVehicle;
  /** Often after probation — the date entitlements begin. */
  eligibilityStart: string | null;
  other: OtherBenefit[];
}

/** One catalogue entry. Same shape the other HR catalogues use. */
export interface BenefitOptionDescriptor {
  key: string;
  labelKey: string;
}

export interface BenefitCatalog {
  insuranceClasses: BenefitOptionDescriptor[];
  retirementSchemes: BenefitOptionDescriptor[];
}

/** An option for the dependants picker, sourced from the employee's profile. */
export interface DependantOption {
  id: string;
  name: string;
  relationship: string | null;
}

export const EMPTY_BENEFITS: BenefitsRecord = {
  employeeId: '',
  healthInsurance: {
    provider: null, policyNumber: null, class: null,
    startDate: null, expiryDate: null, dependantsCovered: [], card: [],
  },
  retirementPlan: { scheme: null, employeeRate: null, employerRate: null, enrolledOn: null },
  companyHousing: { isProvided: false, unit: null, startDate: null, endDate: null },
  companyVehicle: { assetId: null, assetTag: null, description: null },
  eligibilityStart: null,
  other: [],
};

@Injectable({ providedIn: 'root' })
export class EmployeeBenefitService {
  private api = inject(ApiService);
  private files = inject(EmployeeFileService);

  // ─── The record ────────────────────────────────────────────────────────

  /** `GET employee/getBenefits/:employeeId` — PROPOSED, not yet implemented. */
  async get(employeeId: string): Promise<BenefitsRecord> {
    const res = await this.api.request<any>(this.api.get(`employee/getBenefits/${employeeId}`));
    return this.mapRecord(res?.data, employeeId);
  }

  /** `POST employee/saveBenefits` — PROPOSED. */
  async save(payload: Record<string, unknown>): Promise<void> {
    const res = await this.api.request<any>(this.api.post('employee/saveBenefits', payload));
    // HR refuses with HTTP 200 and a body that says no. The server's message is
    // more specific than anything this layer could substitute, so it is thrown
    // as-is — the same decision as every other HR service here.
    if (res?.success === false) throw new Error(res?.msg || 'Could not save benefits');
  }

  /** `GET employee/benefitCatalog` — PROPOSED. */
  async catalog(): Promise<BenefitCatalog> {
    const res = await this.api.request<any>(this.api.get('employee/benefitCatalog'));
    return {
      insuranceClasses: Array.isArray(res?.data?.insuranceClasses) ? res.data.insuranceClasses : [],
      retirementSchemes: Array.isArray(res?.data?.retirementSchemes) ? res.data.retirementSchemes : [],
    };
  }

  // ─── other[] rows ──────────────────────────────────────────────────────

  /** `POST employee/saveOtherBenefit` — PROPOSED. */
  async saveOther(payload: Record<string, unknown>): Promise<{ id: string }> {
    const res = await this.api.request<any>(this.api.post('employee/saveOtherBenefit', payload));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the benefit');
    return { id: res?.data?.id ?? '' };
  }

  /** `GET employee/deleteOtherBenefit/:id` — PROPOSED. GET, matching deleteAsset. */
  async removeOther(benefitId: string): Promise<void> {
    const res = await this.api.request<any>(
      this.api.get(`employee/deleteOtherBenefit/${benefitId}`),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not delete the benefit');
  }

  // ─── Attachments ───────────────────────────────────────────────────────
  //
  // The insurance card and any supporting document for an `other[]` row.
  //
  // NOTE FOR THE BACKEND: there is no `employeeBenefit` file entity registered
  // yet. Until there is, `fileCatalog()` answers with whatever the shared
  // catalogue returns and uploads are not offered by the tab — an upload
  // control that posts to an unregistered entity would fail per file with no
  // way for the user to tell why.

  fileCatalog(): Promise<FileCatalog> {
    return this.files.catalog();
  }

  // ─── Mapping ───────────────────────────────────────────────────────────

  private mapRecord(d: any, employeeId: string): BenefitsRecord {
    if (!d || typeof d !== 'object') return { ...EMPTY_BENEFITS, employeeId };
    const hi = d.healthInsurance ?? {};
    const rp = d.retirementPlan ?? {};
    const ch = d.companyHousing ?? {};
    const cv = d.companyVehicle ?? {};
    return {
      employeeId: d.employeeId ?? employeeId,
      healthInsurance: {
        provider: hi.provider ?? null,
        policyNumber: hi.policyNumber ?? null,
        class: hi.class ?? null,
        startDate: hi.startDate ?? null,
        expiryDate: hi.expiryDate ?? null,
        dependantsCovered: Array.isArray(hi.dependantsCovered) ? hi.dependantsCovered : [],
        card: mapHrFiles(hi.card),
      },
      retirementPlan: {
        scheme: rp.scheme ?? null,
        // Left as sent — see the numerics note at the top of this file.
        employeeRate: rp.employeeRate ?? null,
        employerRate: rp.employerRate ?? null,
        enrolledOn: rp.enrolledOn ?? null,
      },
      companyHousing: {
        // The only field defaulted to a concrete value: absent means "not
        // provided", which is the safe reading and matches the server default.
        isProvided: ch.isProvided === true,
        unit: ch.unit ?? null,
        startDate: ch.startDate ?? null,
        endDate: ch.endDate ?? null,
      },
      companyVehicle: {
        assetId: cv.assetId ?? null,
        assetTag: cv.assetTag ?? null,
        description: cv.description ?? null,
      },
      eligibilityStart: d.eligibilityStart ?? null,
      other: Array.isArray(d.other) ? d.other.map((r: any) => this.mapOther(r)) : [],
    };
  }

  private mapOther(r: any): OtherBenefit {
    return {
      id: r?.id ?? '',
      name: r?.name ?? '',
      value: r?.value ?? null,
      startDate: r?.startDate ?? null,
      endDate: r?.endDate ?? null,
      files: mapHrFiles(r?.files),
    };
  }
}
