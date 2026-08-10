import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';

import { hrDocumentsEnabled, hrFieldsEnabled } from '../../employee-feature-flags';
import { hrGrantFor } from '../../hr-privilege';

/**
 * The employee record shell — the tab strip and the outlet its tabs render into.
 *
 * ── THE DEFAULT TAB IS TODAY'S FORM, AT TODAY'S URL ──────────────────────────
 * `/employees/:id` still renders the employee form, unchanged. It is now a
 * child route rather than the leaf, but the path is identical, so every
 * existing link, bookmark and redirect keeps working. Nothing about the profile
 * form changed in this commit.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── TABS ARE HIDDEN, NOT DISABLED ────────────────────────────────────────────
 * A tab someone may not open is absent, not greyed out. A disabled tab tells
 * them the feature exists and that they are excluded from it — which for
 * disciplinary records or salary is itself information, and for a merchant who
 * has not bought the module it is an advert they did not ask for.
 *
 * Two independent conditions, both required:
 *
 *   • the FEATURE FLAG — is the module sold to this company at all;
 *   • the GRANT — may this particular user see it.
 *
 * They are not the same question and either alone is the wrong gate. The grant
 * is checked with `hrGrantFor`, the explicit-grant helper, NOT with
 * `PrivilegeService.check()` — see hr-privilege.ts. Using `check()` here would
 * show every tab to everyone and every request inside would be refused.
 *
 * **Admins and super admins bypass the grant**, exactly as the server does.
 * That is correct, and it is also what hides a broken gate: anyone verifying
 * this must sign in as a non-admin holding a known grant.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * New employees (`:id === '0'`) get no tabs. There is no record to hang a
 * document or a leave request on until the profile has been saved once, and
 * offering the tabs would produce a set of screens that all fail the same way.
 */
export interface RecordTab {
  /** Route segment under `/employees/:id`. Empty string is the default child. */
  path: string;
  labelKey: string;
  /** Privilege group, or null for the profile tab which needs no HR grant. */
  group: string | null;
  action: string | null;
  /** Whether the module's feature flag is on. */
  enabled: () => boolean;
  /**
   * Does this tab's route and component exist yet?
   *
   * The HR modules land one commit at a time. A tab is listed here from the
   * start so the gating is written once and reviewable as a whole, but it is
   * not rendered until its route exists — linking to a route that is not
   * registered produces a dead tab, which is worse than no tab.
   *
   * Each subsequent commit flips one of these to `true` and registers the
   * matching child route.
   */
  ready: boolean;
  /**
   * May the subject open this tab on their OWN record without a grant?
   *
   * True for leave only, and it matters: leave is the module where the employee
   * is the normal author, and the server admits them on `isSelf` with no
   * privilege at all. Gating the tab on `employeeLeaveSecurity.view` would hide
   * leave from every employee it is for, while the API would have served them.
   *
   * Deliberately opt-in per tab. It is NOT true of the others — reading your own
   * disciplinary record or your own calibration is a different question, and the
   * server answers it differently.
   */
  selfAllowed?: boolean;
}

/**
 * Which tabs are visible, as a pure function.
 *
 * Extracted from the component so the gating can be tested directly. It is the
 * only place the three conditions combine, and testing it through the rendered
 * component alone proved to be a trap: every HR tab is `ready: false` until its
 * commit lands, so a test asserting "hidden without a grant" passed without the
 * grant check running at all.
 *
 * @param hasGrant supplied by the caller so this stays free of injection.
 * @param isOwnRecord whether the viewer is the subject of this record.
 */
export function visibleTabs(
  all: RecordTab[],
  opts: {
    isNew: boolean;
    hasGrant: (group: string, action: string) => boolean;
    isOwnRecord?: boolean;
  },
): RecordTab[] {
  if (opts.isNew) return [];
  return all.filter(tab => {
    // Route not registered yet — a tab here would be a dead link.
    if (!tab.ready) return false;
    // Is the module sold to this company at all?
    if (!tab.enabled()) return false;
    // The profile tab is the record itself and needs no HR grant.
    if (!tab.group || !tab.action) return true;
    // Leave, on one's own record. The feature flag above still applies — this
    // waives the GRANT, not the question of whether the company bought the
    // module.
    if (tab.selfAllowed && opts.isOwnRecord) return true;
    // Explicit grant only. NOT PrivilegeService.check(), which is
    // default-allow — see hr-privilege.ts.
    return opts.hasGrant(tab.group, tab.action);
  });
}

@Component({
  selector: 'app-employee-record',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-record.component.html',
  styleUrls: ['./employee-record.component.scss'],
})
export class EmployeeRecordComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly privileges = inject(PrivilegeService);
  private readonly auth = inject(AuthService);

  private readonly profileFlag = hrFieldsEnabled();
  private readonly documentsFlag = hrDocumentsEnabled();

  /** The record being viewed. `'0'` means a new employee. */
  readonly employeeId = toSignal(
    this.route.paramMap.pipe(map(p => p.get('id') ?? '0')),
    { initialValue: this.route.snapshot.paramMap.get('id') ?? '0' },
  );

  readonly isNew = computed(() => this.employeeId() === '0');

  /** Is this the signed-in employee's own record? Leave turns on this. */
  readonly isOwnRecord = computed(() => {
    const me = (this.auth.currentEmployee as any)?.id ?? null;
    return !!me && String(me) === String(this.employeeId());
  });

  /**
   * Every tab this record could have, before gating.
   *
   * Declared in the order they appear. Profile is first and always present —
   * it is the record itself, not an HR module, and it is reachable without any
   * HR grant because it is the screen that already existed.
   */
  private readonly ALL_TABS: RecordTab[] = [
    {
      path: '', labelKey: 'EMPLOYEES.TABS.PROFILE',
      group: null, action: null, enabled: () => true, ready: true,
    },
    {
      path: 'documents', labelKey: 'EMPLOYEES.TABS.DOCUMENTS',
      group: 'employeeDocumentSecurity', action: 'view',
      enabled: () => this.documentsFlag(), ready: true,
    },
    {
      path: 'assets', labelKey: 'EMPLOYEES.TABS.ASSETS',
      group: 'employeeAssetSecurity', action: 'view',
      // Assets, leave, performance, disciplinary and payroll have no flag of
      // their own yet — the admin portal writes hr.profile and hr.documents
      // only. They ride on the profile flag until sub-keys are added for them,
      // which is a deliberate choice: shipping a tab no flag can turn off would
      // be worse than one that follows the module it belongs to.
      enabled: () => this.profileFlag(), ready: true,
    },
    {
      path: 'leave', labelKey: 'EMPLOYEES.TABS.LEAVE',
      group: 'employeeLeaveSecurity', action: 'view',
      // The only tab an employee reaches on their own record without a grant.
      selfAllowed: true,
      enabled: () => this.profileFlag(), ready: true,
    },
    {
      path: 'performance', labelKey: 'EMPLOYEES.TABS.PERFORMANCE',
      group: 'employeePerformanceSecurity', action: 'view',
      enabled: () => this.profileFlag(), ready: true,
    },
    {
      path: 'disciplinary', labelKey: 'EMPLOYEES.TABS.DISCIPLINARY',
      group: 'employeeDisciplinarySecurity', action: 'view',
      enabled: () => this.profileFlag(), ready: false,
    },
    {
      path: 'payroll', labelKey: 'EMPLOYEES.TABS.PAYROLL',
      // viewPay, not view — payroll's grants are named differently because pay
      // and bank details are separate. Getting this wrong would hide the tab
      // from someone who holds the grant, or show it to someone who does not.
      group: 'employeePayrollSecurity', action: 'viewPay',
      enabled: () => this.profileFlag(), ready: false,
    },
  ];

  /**
   * The tabs this user actually sees.
   *
   * A signal so it re-evaluates when the company payload hydrates the feature
   * flags — the tabs appear without a reload, the same way the HR cards do.
   */
  readonly tabs = computed<RecordTab[]>(() =>
    visibleTabs(this.ALL_TABS, {
      isNew: this.isNew(),
      hasGrant: (group, action) => hrGrantFor(this.privileges, this.auth, group, action),
      isOwnRecord: this.isOwnRecord(),
    }),
  );

  /**
   * Whether to show the strip at all.
   *
   * One tab is not a tab strip — if every HR module is off or ungranted, the
   * record looks exactly as it did before this commit rather than growing a
   * lone "Profile" tab that does nothing.
   */
  readonly showTabs = computed(() => this.tabs().length > 1);

  /** `routerLink` for a tab. The default child is the record URL itself. */
  linkFor(tab: RecordTab): unknown[] {
    return tab.path
      ? ['/employees', this.employeeId(), tab.path]
      : ['/employees', this.employeeId()];
  }
}
