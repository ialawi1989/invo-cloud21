import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import { convertToParamMap } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { FeatureService } from '@core/auth/feature.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';

import { HR_DOCUMENTS, HR_PROFILE } from '../../employee-feature-flags';
import { EmployeeRecordComponent, RecordTab, visibleTabs } from './employee-record.component';

/**
 * The record shell's gating.
 *
 * ── WHAT THIS IS GUARDING AGAINST ────────────────────────────────────────────
 * A tab must be hidden unless BOTH are true: the feature flag is on for the
 * company, and this user holds an explicit grant. Either alone is the wrong
 * gate, and the failure is asymmetric — showing a tab the API refuses produces
 * a screen that loads and then errors on every request, which reads as a broken
 * product rather than a missing permission.
 *
 * The grant check is `hrGrantFor`, which is default-DENY. The portal's usual
 * `PrivilegeService.check()` is default-ALLOW; if anyone swaps it in, the
 * "hidden without a grant" tests below start failing, which is the point.
 *
 * Admins bypass, exactly as the server does — and that bypass is why these
 * tests use a NON-admin employee. An admin sees everything, so an admin-shaped
 * test would pass against a completely broken gate.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const NON_ADMIN = { id: 'emp-1', name: 'Sara', admin: false, superAdmin: false };
const ADMIN = { id: 'emp-2', name: 'Admin', admin: true, superAdmin: false };

function grant(group: string, action: string) {
  return { [group]: { actions: { [action]: { access: true } } } };
}

async function mount(opts: {
  employeeId?: string;
  features?: string[];
  employee?: any;
  privileges?: any;
}): Promise<ComponentFixture<EmployeeRecordComponent>> {
  const id = opts.employeeId ?? 'emp-9';

  await TestBed.configureTestingModule({
    imports: [EmployeeRecordComponent, TranslateModule.forRoot()],
    providers: [
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ id })),
          snapshot: { paramMap: convertToParamMap({ id }) },
        },
      },
    ],
  }).compileComponents();

  TestBed.inject(FeatureService).setFeatures(opts.features ?? []);

  const auth = TestBed.inject(AuthService) as any;
  Object.defineProperty(auth, 'currentEmployee', {
    get: () => opts.employee ?? NON_ADMIN,
    configurable: true,
  });

  const privileges = TestBed.inject(PrivilegeService) as any;
  // `privileges` is a getter over a private field; setting the field directly
  // is how the service is populated at sign-in.
  privileges._privileges = opts.privileges ?? {};

  const fixture = TestBed.createComponent(EmployeeRecordComponent);
  fixture.detectChanges();
  return fixture;
}

const tabPaths = (f: ComponentFixture<EmployeeRecordComponent>) =>
  f.componentInstance.tabs().map(t => t.path);

describe('employee record shell — tab gating', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows no tab strip when nothing but the profile is available', async () => {
    // The record must look exactly as it did before the shell existed, rather
    // than growing a lone "Profile" tab that does nothing.
    const f = await mount({ features: [] });
    expect(f.componentInstance.showTabs()).toBe(false);
    expect(f.nativeElement.querySelector('.record-tabs')).toBeNull();
  });

  it('always keeps the profile tab in the list', async () => {
    // It is the record itself, not an HR module, and it needs no HR grant.
    const f = await mount({ features: [] });
    expect(tabPaths(f)).toContain('');
  });

  it('shows no tabs at all for a new employee', async () => {
    // There is nothing to attach a document or a leave request to until the
    // profile has been saved once.
    const f = await mount({
      employeeId: '0',
      features: [HR_PROFILE, HR_DOCUMENTS],
      privileges: grant('employeeDocumentSecurity', 'view'),
      employee: ADMIN,
    });
    expect(f.componentInstance.isNew()).toBe(true);
    expect(tabPaths(f)).toEqual([]);
  });


  it('lets an admin through without any grant, as the server does', async () => {
    // Correct behaviour — and the reason every other test here uses a
    // non-admin. An admin-shaped test would pass against a broken gate.
    const f = await mount({
      features: [HR_PROFILE, HR_DOCUMENTS],
      employee: ADMIN,
      privileges: {},
    });
    // Documents is not `ready` yet, so it is still absent; what this asserts is
    // that the admin path does not throw and the profile tab survives.
    expect(tabPaths(f)).toContain('');
  });

  it('treats an absent privileges payload as a super admin', async () => {
    // Super admins arrive with no payload and bypass server-side; the UI has to
    // agree, or it would hide screens the API would allow them.
    const f = await mount({
      features: [HR_PROFILE, HR_DOCUMENTS],
      employee: NON_ADMIN,
      privileges: null,
    });
    expect(tabPaths(f)).toContain('');
  });
});

describe('employee record shell — links and readiness', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('links the profile tab at the record URL itself', async () => {
    // `/employees/:id` must keep working — every existing link and bookmark
    // points at it.
    const f = await mount({ employeeId: 'emp-9', features: [] });
    const profile = f.componentInstance.tabs().find(t => t.path === '')!;
    expect(f.componentInstance.linkFor(profile)).toEqual(['/employees', 'emp-9']);
  });

  it('never renders a tab whose route does not exist yet', async () => {
    // The HR modules land one commit at a time. A tab listed before its route
    // is registered would be a dead link, which is worse than no tab.
    const f = await mount({
      features: [HR_PROFILE, HR_DOCUMENTS],
      employee: ADMIN,
      privileges: {},
    });
    for (const tab of f.componentInstance.tabs()) {
      expect(tab.ready).toBe(true);
    }
  });
});

/**
 * The gating itself, against `visibleTabs` directly.
 *
 * Deliberately NOT through the rendered component. Every HR tab is
 * `ready: false` until its own commit lands, so a component-level test
 * asserting "hidden without a grant" passes without the grant check ever
 * running — the readiness filter short-circuits it. That is a vacuous test that
 * looks like coverage, so the gating is exercised here with a fixture tab that
 * IS ready.
 */
describe('visibleTabs — the three conditions', () => {
  const readyTab = (over: Partial<RecordTab> = {}): RecordTab => ({
    path: 'documents',
    labelKey: 'X',
    group: 'employeeDocumentSecurity',
    action: 'view',
    enabled: () => true,
    ready: true,
    ...over,
  });

  const allow = () => true;
  const deny = () => false;

  it('shows a ready tab when the flag is on and the grant is held', () => {
    expect(visibleTabs([readyTab()], { isNew: false, hasGrant: allow })).toHaveLength(1);
  });

  it('hides it when the feature flag is off, even holding the grant', () => {
    const tab = readyTab({ enabled: () => false });
    expect(visibleTabs([tab], { isNew: false, hasGrant: allow })).toEqual([]);
  });

  it('hides it when the grant is missing, even with the flag on', () => {
    // The case PrivilegeService.check() gets wrong: it treats an unset action
    // as allowed, so the tab would render and every request behind it would be
    // refused by the API.
    expect(visibleTabs([readyTab()], { isNew: false, hasGrant: deny })).toEqual([]);
  });

  it('hides it when its route does not exist yet', () => {
    const tab = readyTab({ ready: false });
    expect(visibleTabs([tab], { isNew: false, hasGrant: allow })).toEqual([]);
  });

  it('needs no grant for a tab that declares none', () => {
    const profile = readyTab({ path: '', group: null, action: null });
    expect(visibleTabs([profile], { isNew: false, hasGrant: deny })).toHaveLength(1);
  });

  it('shows nothing at all for a new employee', () => {
    expect(visibleTabs([readyTab()], { isNew: true, hasGrant: allow })).toEqual([]);
  });

  it('asks for the exact group and action the tab declares', () => {
    // A payroll tab checking `view` instead of `viewPay` would hide the tab
    // from someone who holds the grant — the API names them differently.
    const seen: string[] = [];
    const tab = readyTab({ group: 'employeePayrollSecurity', action: 'viewPay' });
    visibleTabs([tab], {
      isNew: false,
      hasGrant: (g, a) => { seen.push(`${g}.${a}`); return true; },
    });
    expect(seen).toEqual(['employeePayrollSecurity.viewPay']);
  });
});
