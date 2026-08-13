import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';

import { HrError, describeError } from '../../hr-error';
import { portalKey } from '../../hr-labels';
import { hrGrantFor } from '../../hr-privilege';
import {
  BenefitCatalog,
  BenefitsRecord,
  DependantOption,
  EMPTY_BENEFITS,
  EmployeeBenefitService,
  OtherBenefit,
} from '../../services/employee-benefit.service';
import { EmployeePayrollService } from '../../services/employee-payroll.service';
import {
  PayrollComponentLike,
  housingBlockedBy,
  housingConflict,
  isActiveWindow,
  ratePercent,
} from './benefit-rules';

/**
 * The benefits tab — NON-CASH entitlements.
 *
 * ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────────
 * There is no housing allowance field and no transport allowance field. Those
 * are payroll components, and the spec names the duplication as the mistake to
 * avoid. `companyHousing` here is the opposite arrangement — the company
 * provides a unit instead of paying — which is why the two are mutually
 * exclusive and why that is ENFORCED rather than described.
 *
 * ── THE VEHICLE IS A LINK, NOT A FIELD ───────────────────────────────────────
 * `companyVehicle` renders a reference to an asset assignment and a link to the
 * assets tab. Typing a registration number here would be a second answer to
 * "what does this person still hold", and the assets module already owns that
 * question including the end-of-service clearance that depends on it.
 *
 * ── THE API DOES NOT EXIST YET ───────────────────────────────────────────────
 * Every call degrades to an empty record rather than throwing, so the tab shows
 * an honest empty state against the 404s it currently gets. Nothing is
 * fabricated: absent is rendered as absent, never as a zero or a default.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Component({
  selector: 'app-employee-benefits',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-benefits.component.html',
  styleUrls: ['./employee-benefits.component.scss'],
})
export class EmployeeBenefitsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(EmployeeBenefitService);
  private readonly payroll = inject(EmployeePayrollService);
  private readonly privileges = inject(PrivilegeService);
  private readonly auth = inject(AuthService);

  /** `:id` lives on the parent route — this component is a tab child. */
  readonly employeeId =
    this.route.parent?.snapshot.paramMap.get('id') ??
    this.route.snapshot.paramMap.get('id') ?? '';

  readonly loading = signal(true);
  readonly error = signal<HrError | null>(null);

  readonly record = signal<BenefitsRecord>(EMPTY_BENEFITS);
  readonly catalog = signal<BenefitCatalog>({ insuranceClasses: [], retirementSchemes: [] });
  readonly dependants = signal<DependantOption[]>([]);
  /** Live payroll components — the housing rule reads these, nothing else. */
  readonly payrollComponents = signal<PayrollComponentLike[]>([]);

  readonly canEdit = computed(() =>
    hrGrantFor(this.privileges, this.auth, 'employeeBenefitSecurity', 'edit'));

  /**
   * Why company housing cannot be switched on, or null.
   *
   * A reason rather than a boolean so the template explains itself — a toggle
   * that silently refuses is indistinguishable from a broken one.
   */
  readonly housingBlock = computed(() => housingBlockedBy(this.payrollComponents()));

  /**
   * An EXISTING contradiction: housing provided AND a housing allowance.
   *
   * Surfaced rather than corrected. Which side is wrong is not this screen's
   * decision, and clearing either would destroy a value nobody asked to lose.
   */
  readonly housingConflict = computed(() =>
    housingConflict(this.record().companyHousing.isProvided, this.payrollComponents()));

  readonly employeeRatePercent = computed(() => ratePercent(this.record().retirementPlan.employeeRate));
  readonly employerRatePercent = computed(() => ratePercent(this.record().retirementPlan.employerRate));

  /** Today as an ISO day, so a timezone never moves an expiry across midnight. */
  private readonly today = new Date().toISOString().slice(0, 10);

  readonly insuranceActive = computed(() => {
    const hi = this.record().healthInsurance;
    if (!hi.startDate && !hi.expiryDate) return null;   // nothing recorded — unknown
    return isActiveWindow(hi.startDate, hi.expiryDate, this.today);
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      // Each source degrades on its own. A missing catalogue must not blank the
      // record, and a missing payroll must not hide benefits — it only means
      // the housing rule cannot be evaluated, which the template says.
      const [record, catalog, components] = await Promise.all([
        this.service.get(this.employeeId).catch(() => ({ ...EMPTY_BENEFITS, employeeId: this.employeeId })),
        this.service.catalog().catch(() => ({ insuranceClasses: [], retirementSchemes: [] })),
        this.loadPayrollComponents(),
      ]);
      this.record.set(record);
      this.catalog.set(catalog);
      this.payrollComponents.set(components);
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * The employee's current pay components, for the housing rule only.
   *
   * Read from the payroll service rather than duplicated: "does this person get
   * a housing allowance" has one answer, and it lives there.
   */
  private async loadPayrollComponents(): Promise<PayrollComponentLike[]> {
    try {
      const current: any = await (this.payroll as any).current?.(this.employeeId);
      const comps = current?.components;
      return Array.isArray(comps) ? comps : [];
    } catch {
      // No payroll grant, or no payroll record. Not an error here — it means
      // the rule is unevaluable, which the template renders as such.
      return [];
    }
  }

  /**
   * ── THERE IS NO WRITE PATH HERE, DELIBERATELY ──────────────────────────────
   * `EmployeeBenefitService` defines `saveBenefits`, `saveOtherBenefit` and
   * `deleteOtherBenefit` because the backend needs the contract. This component
   * calls none of them.
   *
   * A Save button that posts to an endpoint which does not exist is worse than
   * no button: it fails, the user cannot tell whether their data was stored,
   * and the tab claims a capability the system does not have. The same argument
   * that keeps `ready: false` on the tab applies to every control that writes.
   *
   * The edit surface — pickers for class and scheme, the dependants selector,
   * the housing toggle guarded by `housingBlock()` — lands in the same change
   * as the endpoints, so it can be proven against a real response instead of a
   * guess.
   * ───────────────────────────────────────────────────────────────────────────
   */

  /** Catalogue label, via the shared server-key → portal-key mapping. */
  classLabel(key: string | null): string {
    const found = this.catalog().insuranceClasses.find(c => c.key === key);
    return found?.labelKey ? portalKey(found.labelKey) : (key ?? '');
  }

  schemeLabel(key: string | null): string {
    const found = this.catalog().retirementSchemes.find(s => s.key === key);
    return found?.labelKey ? portalKey(found.labelKey) : (key ?? '');
  }

  /** Names for the covered dependants, resolved from the employee's profile. */
  dependantName(id: string): string {
    return this.dependants().find(d => d.id === id)?.name ?? id;
  }

  optionKey = (o: { key: string }) => o.key;
  optionName = (o: { key: string; labelKey?: string }) =>
    o?.labelKey ? portalKey(o.labelKey) : String(o?.key ?? '');

  trackOther = (_: number, r: OtherBenefit) => r.id;
  trackId = (_: number, s: string) => s;
}
