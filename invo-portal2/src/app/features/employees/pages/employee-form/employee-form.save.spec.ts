import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageService } from '@core/i18n/language.service';
import { FeatureService } from '@core/auth/feature.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { BranchSettingsService } from '../../../settings/services/branch-settings.service';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeFieldManifestService } from '../../services/employee-field-manifest.service';
import { EMPLOYEE_FIELD_MANIFEST } from '../../models/employee-field-manifest';
import { EmployeeDetails } from '../../models/employee.types';
import { EMPLOYEE_HR_FIELDS } from '../../employee-feature-flags';
import { EmployeeFormComponent } from './employee-form.component';

/**
 * The save-contract regression.
 *
 * Phase 1 is only safe if a record that predates it round-trips unchanged. So:
 * load a legacy fixture with no HR groups, save it without touching anything,
 * and compare the *whole* payload against what the pre-phase-1 form produced.
 * The extractor being correct in isolation isn't the guarantee — this is.
 */

/** A record as the backend returns it today: no hasSystemAccess, no groups. */
const LEGACY: EmployeeDetails = {
  id: 'emp-1',
  name: 'Sara Ahmed',
  email: 'sara@example.com',
  avatar: '',
  admin: true,
  superAdmin: false,
  user: true,
  isDriver: false,
  isInvitedUser: false,
  branchId: 'br-1',
  formStatus: 'edit',
  password: '',
  passCode: '',
  MSR: '',
  base64Image: '',
  companyId: 'co-1',
  companyGroupId: null,
  createdAt: '2024-02-01T00:00:00.000Z',
  apply2fa: false,
  hasPermissionToChange2fa: true,
  branches: [{ id: 'br-1', name: 'Main' }],
  privileges: { employeeSecurity: { actions: { view: { access: true } } } },
  privilegeId: 'pv-1',
  mediaId: 'md-1',
  mediaUrl: { defaultUrl: 'https://cdn.example.com/sara.png' },
  resetPasswordDate: null,
  hireDate: '2024-02-01',
  terminationDate: null,
  // mapDetails() supplies this for every record; the groups stay absent.
  hasSystemAccess: true,
};

/**
 * The payload the form produced *before* phase 1, for this fixture, saved
 * untouched. Written out in full rather than derived, so a change to the
 * production builder can't quietly change the expectation too.
 */
const PRE_PHASE_1_PAYLOAD: Record<string, any> = {
  id: 'emp-1',
  name: 'Sara Ahmed',
  email: 'sara@example.com',
  avatar: '',
  admin: true,
  superAdmin: false,
  user: true,
  isDriver: false,
  isInvitedUser: false,
  branchId: 'br-1',
  formStatus: 'edit',
  password: '',
  passCode: '',
  MSR: '',
  base64Image: '',
  companyId: 'co-1',
  companyGroupId: null,
  createdAt: '2024-02-01T00:00:00.000Z',
  apply2fa: false,
  hasPermissionToChange2fa: true,
  branches: [{ id: 'br-1', name: 'Main' }],
  privilegeId: 'pv-1',
  mediaId: 'md-1',
  mediaUrl: { defaultUrl: 'https://cdn.example.com/sara.png' },
  resetPasswordDate: null,
  hireDate: '2024-02-01',
  terminationDate: null,
};

/**
 * The payload for an untouched record, as it stands after the write-only-column
 * fix: identical to pre-phase-1 except that `hasSystemAccess` is added and any
 * value the API didn't return is *omitted* rather than echoed back as null.
 * `terminationDate` is null on this fixture, so it is no longer sent — posting
 * it back is exactly what wiped stored dates.
 */
function untouchedPayload(): Record<string, any> {
  const expected: Record<string, any> = { ...PRE_PHASE_1_PAYLOAD, hasSystemAccess: true };
  delete expected['terminationDate'];
  return expected;
}

function setup(record: EmployeeDetails | null, routeId: string, hrFields = true) {
  const save = vi.fn().mockResolvedValue({ success: true });
  const employeeService = {
    getOne: vi.fn().mockResolvedValue(record),
    save,
    getEmploymentLookups: vi.fn().mockResolvedValue({ departments: [], positions: [] }),
    searchEmployees: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
    validateName: vi.fn().mockResolvedValue({ success: true }),
    getEmployeeByEmail: vi.fn().mockResolvedValue({ success: false }),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [EmployeeFormComponent, TranslateModule.forRoot()],
    providers: [
      { provide: EmployeeService, useValue: employeeService },
      {
        provide: EmployeeFieldManifestService,
        useValue: { getManifest: vi.fn().mockResolvedValue(EMPLOYEE_FIELD_MANIFEST) },
      },
      {
        provide: BranchSettingsService,
        useValue: { getList: vi.fn().mockResolvedValue({ list: [{ id: 'br-1', name: 'Main' }] }) },
      },
      { provide: PrivilegeService, useValue: { getPrivilegeList: vi.fn().mockResolvedValue({ list: [] }) } },
      { provide: LanguageService, useValue: { loadFeature: vi.fn() } },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: ModalService, useValue: { open: vi.fn() } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', routeId]]) } } },
    ],
  });

  // The HR cards are flagged off until the backend can store them; the phase-1
  // behaviour under test only exists with the flag on.
  if (hrFields) TestBed.inject(FeatureService).setFeatures([EMPLOYEE_HR_FIELDS]);

  const fixture = TestBed.createComponent(EmployeeFormComponent);
  return { fixture, component: fixture.componentInstance, save };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Run the component's init the way Angular does and render the result.
 *
 * Deliberately NOT `await component.ngOnInit()`: the first `detectChanges()`
 * calls ngOnInit itself, so doing both runs it twice and leaves the fixture
 * showing the loading spinner — which silently turns every DOM assertion into
 * a vacuous pass.
 */
async function load(fixture: ComponentFixture<EmployeeFormComponent>): Promise<void> {
  fixture.detectChanges();   // triggers ngOnInit
  await flush();             // its awaited loads settle
  await flush();
  fixture.detectChanges();   // render the loaded state
}

describe('employee-form save contract — legacy record', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(async () => {
    ctx = setup(LEGACY, 'emp-1');
    await load(ctx.fixture);
  });

  it('saves a legacy record unchanged, apart from the hasSystemAccess flag', async () => {
    await ctx.component.save();

    expect(ctx.save).toHaveBeenCalledTimes(1);
    const payload = ctx.save.mock.calls[0][0];

    // Every pre-phase-1 key, byte for byte — minus the ones the API never
    // returned, which are now withheld instead of nulled.
    expect(payload).toEqual(untouchedPayload());

    // …and nothing else. `hasSystemAccess` is the only added key; the HR
    // groups are absent, not empty objects.
    const added = Object.keys(payload).filter((k) => !(k in PRE_PHASE_1_PAYLOAD));
    expect(added).toEqual(['hasSystemAccess']);
    expect('profile' in payload).toBe(false);
    expect('employment' in payload).toBe(false);
  });

  it('still drops the privilege tree', async () => {
    await ctx.component.save();
    expect('privileges' in ctx.save.mock.calls[0][0]).toBe(false);
  });

  it('leaves the record valid and non-dirty on load', () => {
    // A legacy record has none of the new required fields. If `required` were
    // enforced strictly on edit, an admin couldn't save this record at all.
    expect(ctx.component.form.valid).toBe(true);
    expect(ctx.component.hasUnsavedChanges()).toBe(false);
  });

  it('adds the groups only once something is filled in', async () => {
    ctx.component.form.get('employment.department')!.setValue('  Finance  ');
    await ctx.component.save();

    const payload = ctx.save.mock.calls[0][0];
    expect(payload.employment).toEqual({ department: 'Finance' });
    expect('profile' in payload).toBe(false);
  });

  it('defaults seniority from a hire date the user changes, never from the loaded one', async () => {
    const seniority = ctx.component.form.get('employment.seniorityDate')!;
    expect(seniority.value).toBeNull();

    ctx.component.form.controls['hireDate'].setValue(new Date(2025, 5, 1));
    expect(seniority.value).toEqual(new Date(2025, 5, 1));
  });
});

describe('employee-form save contract — revoking system access', () => {
  it('clears the roles, the privilege set and every secret', async () => {
    const ctx = setup(LEGACY, 'emp-1');
    await load(ctx.fixture);

    ctx.component.toggleSystemAccess(false);
    await ctx.component.save();

    const payload = ctx.save.mock.calls[0][0];
    expect(payload.hasSystemAccess).toBe(false);
    // The role invariant must NOT re-add `user` here — guarded in both
    // enforceRoleInvariant() and save().
    expect(payload).toMatchObject({
      admin: false,
      user: false,
      superAdmin: false,
      privilegeId: null,
      email: '',
      password: '',
      passCode: '',
      MSR: '',
    });
  });
});

describe('employee-form save contract — new record', () => {
  it('enforces the manifest requirements strictly on create', async () => {
    const ctx = setup(null, '0');
    await load(ctx.fixture);

    ctx.component.form.controls['name'].setValue('New Person');
    expect(ctx.component.form.get('employment.noticePeriodDays')!.value).toBe(30);
    expect(ctx.component.form.get('profile.employeeNumber')!.hasError('required')).toBe(true);

    await ctx.component.save();
    expect(ctx.save).not.toHaveBeenCalled();
  });
});

describe('employee-form — EMPLOYEE_HR_FIELDS flag off', () => {
  it('renders no HR cards, fetches no manifest, and posts no groups', async () => {
    const ctx = setup(LEGACY, 'emp-1', false);
    await load(ctx.fixture);

    // No controls, so nothing can be typed in and nothing can be posted.
    expect(ctx.component.form.get('profile')).toBeNull();
    expect(ctx.component.form.get('employment')).toBeNull();
    expect(ctx.fixture.nativeElement.querySelector('app-field-renderer')).toBeNull();

    await ctx.component.save();
    const payload = ctx.save.mock.calls[0][0];
    expect(payload).toEqual(untouchedPayload());
  });

  it('round-trips groups an existing record already carries, rather than clearing them', async () => {
    const withGroups = {
      ...LEGACY,
      profile: { employeeNumber: 'E-1', mobile: '+97333000000' },
      employment: { department: 'Finance' },
    } as EmployeeDetails;

    const ctx = setup(withGroups, 'emp-1', false);
    await load(ctx.fixture);
    await ctx.component.save();

    const payload = ctx.save.mock.calls[0][0];
    expect(payload.profile).toEqual({ employeeNumber: 'E-1', mobile: '+97333000000' });
    expect(payload.employment).toEqual({ department: 'Finance' });
  });
});

describe('employee-form — caller does not own this employee HR data', () => {
  it('renders no HR cards when the API says another company owns them', async () => {
    // `isHrDataOwner` comes from the arm of the getEmployeeById UNION that
    // answered — the same place the nulling is enforced. The client renders
    // from it rather than re-deriving ownership from isInvitedUser, which
    // could disagree. Cards would otherwise let HR fill in fields the backend
    // drops on save.
    const invited = { ...LEGACY, isInvitedUser: true, isHrDataOwner: false } as EmployeeDetails;
    const ctx = setup(invited, 'emp-1');
    await load(ctx.fixture);

    expect(ctx.component.form.get('profile')).toBeNull();
    expect(ctx.component.form.get('employment')).toBeNull();
    expect(ctx.fixture.nativeElement.querySelector('app-field-renderer')).toBeNull();

    await ctx.component.save();
    const payload = ctx.save.mock.calls[0][0];
    expect('profile' in payload).toBe(false);
    expect('employment' in payload).toBe(false);
  });

  it('still renders them for an invited employee the API says we do own', async () => {
    // isInvitedUser and HR-data ownership are different questions; only the
    // API's answer decides.
    const invited = { ...LEGACY, isInvitedUser: true, isHrDataOwner: true } as EmployeeDetails;
    const ctx = setup(invited, 'emp-1');
    await load(ctx.fixture);

    expect(ctx.component.form.get('profile')).not.toBeNull();
    expect(ctx.fixture.nativeElement.querySelector('app-field-renderer')).not.toBeNull();
  });
});

describe('employee-form — restoring system access', () => {
  /** A record saved with access off: revocation cleared its credentials. */
  const REVOKED = { ...LEGACY, hasSystemAccess: false, admin: false, user: false } as EmployeeDetails;

  it('requires new credentials, as if the account were being created', async () => {
    const ctx = setup(REVOKED, 'emp-1');
    await load(ctx.fixture);

    expect(ctx.component.credentialsRequired()).toBe(false);   // access still off

    ctx.component.toggleSystemAccess(true);
    expect(ctx.component.accessBeingRestored()).toBe(true);
    expect(ctx.component.credentialsRequired()).toBe(true);
    // POS user is the role the invariant restores, so the pass code is the
    // credential in play — required, and offered as an input rather than a
    // "keep the current one" toggle.
    expect(ctx.component.showPassCode()).toBe(true);
    expect(ctx.component.form.controls['passcode'].hasError('required')).toBe(true);
    expect(ctx.component.passcodePlaceholder()).toBe('');

    await ctx.component.save();
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('leaves an untouched active record on the empty-means-keep contract', async () => {
    const ctx = setup(LEGACY, 'emp-1');
    await load(ctx.fixture);

    expect(ctx.component.accessBeingRestored()).toBe(false);
    expect(ctx.component.credentialsRequired()).toBe(false);
    expect(ctx.component.form.controls['passcode'].valid).toBe(true);
  });
});

describe('employee-form — columns the API does not return', () => {
  /** What the API actually answers today: no hireDate, no terminationDate, no branchId. */
  const AS_API_ANSWERS = (() => {
    const r: any = { ...LEGACY };
    delete r.hireDate;
    delete r.terminationDate;
    r.branchId = '';
    return r as EmployeeDetails;
  })();

  it('omits them rather than posting back nulls it never received', async () => {
    const ctx = setup(AS_API_ANSWERS, 'emp-1');
    await load(ctx.fixture);
    await ctx.component.save();

    const payload = ctx.save.mock.calls[0][0];
    // Absent, not null — a null here lands on top of a real stored hire date.
    expect('hireDate' in payload).toBe(false);
    expect('terminationDate' in payload).toBe(false);
    expect('branchId' in payload).toBe(false);
  });

  it('sends a date the user actually set', async () => {
    const ctx = setup(AS_API_ANSWERS, 'emp-1');
    await load(ctx.fixture);

    const hire = ctx.component.form.controls['hireDate'];
    hire.setValue(new Date(2025, 0, 15));
    hire.markAsDirty();          // what a user edit through the control does
    await ctx.component.save();

    expect(ctx.save.mock.calls[0][0].hireDate).toBe('2025-01-15');
  });

  it('still sends values the API did return, so a fixed API keeps working', async () => {
    const ctx = setup(LEGACY, 'emp-1');   // LEGACY carries hireDate + branchId
    await load(ctx.fixture);
    await ctx.component.save();

    const payload = ctx.save.mock.calls[0][0];
    expect(payload.hireDate).toBe('2024-02-01');
    expect(payload.branchId).toBe('br-1');
  });
});
