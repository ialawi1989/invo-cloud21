import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageService } from '@core/i18n/language.service';
import { FeatureService } from '@core/auth/feature.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { EmployeeOptionsService } from '@core/layout/services/employee-options.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { GuidedTourService, toPhysicalAlign, toPhysicalSide } from '@shared/services/guided-tour.service';
import { BranchSettingsService } from '../../../settings/services/branch-settings.service';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeFieldManifestService } from '../../services/employee-field-manifest.service';
import { EMPLOYEE_FIELD_MANIFEST } from '../../models/employee-field-manifest';
import { EMPLOYEE_HR_FIELDS } from '../../employee-feature-flags';
import { EmployeeFormComponent } from './employee-form.component';
import { EMPLOYEE_FORM_TOUR, EMPLOYEE_TOUR_ANCHORS, EMPLOYEE_TOUR_KEY } from './employee-form.tour';

/**
 * The tour points at `data-tour` anchors in the template. Nothing in the type
 * system ties the two together, so these tests are the tie: a renamed or
 * dropped anchor fails here instead of producing a step that spotlights
 * nothing at runtime.
 *
 * Everything is checked with the HR flag **off** as well as on, because off is
 * what production sees today.
 */

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

/** Anchors present in the DOM right now, in document order. */
function anchorsIn(fixture: ComponentFixture<unknown>): string[] {
  return Array.from(fixture.nativeElement.querySelectorAll('[data-tour]'))
    .map((el) => (el as HTMLElement).getAttribute('data-tour')!)
    .filter(Boolean);
}

function setup(opts: { hrFields?: boolean; record?: any; id?: string; features?: string[] } = {}) {
  const record = opts.record ?? {
    id: 'emp-1', name: 'Sara Ahmed', email: 'sara@example.com', avatar: '',
    admin: true, superAdmin: false, user: true, isDriver: false, isInvitedUser: false,
    branchId: 'br-1', branches: [{ id: 'br-1', name: 'Main' }],
    mediaUrl: { defaultUrl: '' }, mediaId: null, privilegeId: null, privileges: null,
    hasSystemAccess: true, isHrDataOwner: true,
    password: '', passCode: '', MSR: '', base64Image: '', companyId: 'co-1',
    companyGroupId: null, createdAt: '', apply2fa: false, hasPermissionToChange2fa: true,
    resetPasswordDate: null, hireDate: null, terminationDate: null,
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [EmployeeFormComponent, TranslateModule.forRoot()],
    providers: [
      {
        provide: EmployeeService,
        useValue: {
          getOne: vi.fn().mockResolvedValue(record),
          save: vi.fn().mockResolvedValue({ success: true }),
          getEmploymentLookups: vi.fn().mockResolvedValue({ departments: [], positions: [] }),
          searchEmployees: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
        },
      },
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
      { provide: EmployeeOptionsService, useValue: { get: vi.fn().mockResolvedValue(null), patch: vi.fn().mockResolvedValue(undefined) } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: new Map([['id', opts.id ?? 'emp-1']]) } },
      },
    ],
  });

  const features = [
    ...(opts.hrFields ? [EMPLOYEE_HR_FIELDS] : []),
    ...(opts.features ?? []),
  ];
  if (features.length) TestBed.inject(FeatureService).setFeatures(features);

  const fixture = TestBed.createComponent(EmployeeFormComponent);
  return { fixture, component: fixture.componentInstance };
}

/** ngOnInit runs from the first detectChanges — never call it by hand as well. */
async function load(fixture: ComponentFixture<EmployeeFormComponent>): Promise<void> {
  fixture.detectChanges();
  await flush();
  await flush();
  fixture.detectChanges();
}

describe('employee-form tour anchors — HR flag OFF (what production sees)', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(async () => {
    ctx = setup({ hrFields: false });
    await load(ctx.fixture);
  });

  it('renders every non-HR anchor the catalog points at', () => {
    const present = anchorsIn(ctx.fixture);
    const expected = [
      EMPLOYEE_TOUR_ANCHORS.systemAccess,
      EMPLOYEE_TOUR_ANCHORS.basic,
      EMPLOYEE_TOUR_ANCHORS.email,
      EMPLOYEE_TOUR_ANCHORS.password,
      EMPLOYEE_TOUR_ANCHORS.roles,
      EMPLOYEE_TOUR_ANCHORS.access,
      EMPLOYEE_TOUR_ANCHORS.image,
      EMPLOYEE_TOUR_ANCHORS.branches,
      EMPLOYEE_TOUR_ANCHORS.primaryStar,
      EMPLOYEE_TOUR_ANCHORS.employment,
    ];
    for (const anchor of expected) expect(present).toContain(anchor);
  });

  it('renders neither HR anchor, so those steps drop', () => {
    const present = anchorsIn(ctx.fixture);
    expect(present).not.toContain(EMPLOYEE_TOUR_ANCHORS.hrProfile);
    expect(present).not.toContain(EMPLOYEE_TOUR_ANCHORS.hrEmployment);
  });

  it('leaves no catalog anchor unaccounted for', () => {
    // Every anchor is either in the DOM or explained by a condition that isn't
    // met — nothing may be missing because someone renamed an attribute.
    const present = new Set(anchorsIn(ctx.fixture));
    const conditional = new Set<string>([
      EMPLOYEE_TOUR_ANCHORS.hrProfile,       // flag off
      EMPLOYEE_TOUR_ANCHORS.hrEmployment,    // flag off
      // Bank details need `employeePayrollSecurity.editBank`, which this
      // fixture's privilege stub does not grant.
      EMPLOYEE_TOUR_ANCHORS.payment,
    ]);
    const missing = EMPLOYEE_FORM_TOUR
      .map((s) => s.anchor)
      .filter((a): a is string => !!a)
      .filter((a) => !present.has(a) && !conditional.has(a));
    expect(missing).toEqual([]);
  });

  it('exposes the tour trigger in the page header', () => {
    expect(ctx.fixture.nativeElement.querySelector('.tour-btn')).toBeTruthy();
  });
});

/**
 * The one conditional anchor, asserted where it DOES render.
 *
 * Without this, `payment` would appear in the catalog and in every
 * "unaccounted for" exemption list and nowhere else — so a typo in the
 * `data-tour` attribute would ship green. An exemption that is never balanced
 * by a positive case is not a condition, it is a hole.
 */
describe('employee-form tour anchors — the conditional one', () => {
  it('renders the payment anchor with the payroll module on', async () => {
    const ctx = setup({ id: '0', features: ['hr.payroll'] });
    await load(ctx.fixture);
    expect(anchorsIn(ctx.fixture)).toContain(EMPLOYEE_TOUR_ANCHORS.payment);
  });

  it('does not render it without the payroll module', async () => {
    const ctx = setup({ id: '0' });
    await load(ctx.fixture);
    expect(anchorsIn(ctx.fixture)).not.toContain(EMPLOYEE_TOUR_ANCHORS.payment);
  });
});

describe('employee-form tour anchors — HR flag ON', () => {
  it('adds the two HR anchors and keeps the rest', async () => {
    const ctx = setup({ hrFields: true });
    await load(ctx.fixture);

    const present = new Set(anchorsIn(ctx.fixture));
    expect(present.has(EMPLOYEE_TOUR_ANCHORS.hrProfile)).toBe(true);
    expect(present.has(EMPLOYEE_TOUR_ANCHORS.hrEmployment)).toBe(true);

    // The HR flag says nothing about `editBank`, so that anchor is still
    // legitimately absent here.
    const conditional = new Set<string>([
      EMPLOYEE_TOUR_ANCHORS.payment,
    ]);
    const missing = EMPLOYEE_FORM_TOUR
      .map((s) => s.anchor)
      .filter((a): a is string => !!a)
      .filter((a) => !present.has(a) && !conditional.has(a));
    expect(missing).toEqual([]);
  });
});

describe('employee-form tour anchors — role-conditional fields', () => {
  it('drops the credential anchors when system access is off', async () => {
    const ctx = setup({ hrFields: false });
    await load(ctx.fixture);

    ctx.component.toggleSystemAccess(false);
    ctx.fixture.detectChanges();

    const present = anchorsIn(ctx.fixture);
    expect(present).not.toContain(EMPLOYEE_TOUR_ANCHORS.email);
    expect(present).not.toContain(EMPLOYEE_TOUR_ANCHORS.password);
    expect(present).not.toContain(EMPLOYEE_TOUR_ANCHORS.roles);
    // The card itself stays — the tour still has something to say about it.
    expect(present).toContain(EMPLOYEE_TOUR_ANCHORS.basic);
  });

  it('drops the email and password anchors for a POS-only account', async () => {
    const ctx = setup({ hrFields: false });
    await load(ctx.fixture);

    // Cloud Admin off, POS User on → pass code, no email/password.
    ctx.component.toggleRole('admin');
    ctx.fixture.detectChanges();

    const present = anchorsIn(ctx.fixture);
    expect(present).not.toContain(EMPLOYEE_TOUR_ANCHORS.email);
    expect(present).not.toContain(EMPLOYEE_TOUR_ANCHORS.password);
    expect(present).toContain(EMPLOYEE_TOUR_ANCHORS.access);
  });

  it('drops the primary-branch star when no branch is selected', async () => {
    const ctx = setup({ hrFields: false });
    await load(ctx.fixture);

    ctx.component.form.controls['branchIds'].setValue([]);
    ctx.fixture.detectChanges();

    const present = anchorsIn(ctx.fixture);
    expect(present).not.toContain(EMPLOYEE_TOUR_ANCHORS.primaryStar);
    // …while the branch card, whose copy explains the star, stays.
    expect(present).toContain(EMPLOYEE_TOUR_ANCHORS.branches);
  });

  it('marks exactly one star, even with several branches assigned', async () => {
    const ctx = setup({ hrFields: false });
    await load(ctx.fixture);

    ctx.component.branches.set([{ id: 'br-1', name: 'Main' }, { id: 'br-2', name: 'Depot' }]);
    ctx.component.form.controls['branchIds'].setValue(['br-1', 'br-2']);
    ctx.fixture.detectChanges();

    const stars = anchorsIn(ctx.fixture).filter((a) => a === EMPLOYEE_TOUR_ANCHORS.primaryStar);
    expect(stars.length).toBe(1);
  });
});

describe('employee-form tour catalog', () => {
  it('names a translation key for every step and never a raw string', () => {
    for (const step of EMPLOYEE_FORM_TOUR) {
      expect(step.titleKey.startsWith('EMPLOYEES.TOUR.')).toBe(true);
      expect(step.bodyKey.startsWith('EMPLOYEES.TOUR.')).toBe(true);
    }
  });

  it('uses logical sides only, so RTL can flip them', () => {
    const logical = ['inline-start', 'inline-end', 'block-start', 'block-end'];
    for (const step of EMPLOYEE_FORM_TOUR) {
      if (step.side) expect(logical).toContain(step.side);
    }
  });

  it('walks the form in the order the cards appear', () => {
    const order = EMPLOYEE_FORM_TOUR.map((s) => s.anchor).filter(Boolean);
    expect(order).toEqual([
      EMPLOYEE_TOUR_ANCHORS.systemAccess,
      EMPLOYEE_TOUR_ANCHORS.basic,
      EMPLOYEE_TOUR_ANCHORS.email,
      EMPLOYEE_TOUR_ANCHORS.password,
      EMPLOYEE_TOUR_ANCHORS.roles,
      EMPLOYEE_TOUR_ANCHORS.access,
      EMPLOYEE_TOUR_ANCHORS.image,
      EMPLOYEE_TOUR_ANCHORS.branches,
      EMPLOYEE_TOUR_ANCHORS.primaryStar,
      EMPLOYEE_TOUR_ANCHORS.employment,
      EMPLOYEE_TOUR_ANCHORS.hrProfile,
      EMPLOYEE_TOUR_ANCHORS.hrEmployment,
      // Last card on the page.
      EMPLOYEE_TOUR_ANCHORS.payment,
    ]);
  });

  it('opens with an anchorless intro step', () => {
    expect(EMPLOYEE_FORM_TOUR[0].anchor).toBeUndefined();
  });
});

describe('GuidedTourService', () => {
  let service: GuidedTourService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        { provide: EmployeeOptionsService, useValue: { get: vi.fn().mockResolvedValue(null), patch: vi.fn().mockResolvedValue(undefined) } },
      ],
    });
    service = TestBed.inject(GuidedTourService);
    localStorage.clear();
    document.documentElement.removeAttribute('dir');
    document.body.innerHTML = '';
  });

  it('shows nothing, and says so, when no anchor is on the page', async () => {
    const shown = await service.run(EMPLOYEE_FORM_TOUR.filter((s) => !!s.anchor), { tourKey: 't1' });
    expect(shown).toBe(0);
    expect(service.isRunning()).toBe(false);
  });

  it('drives only the steps whose anchors exist', async () => {
    document.body.innerHTML = `<div data-tour="${EMPLOYEE_TOUR_ANCHORS.basic}">x</div>`;
    const shown = await service.run(
      [
        { anchor: EMPLOYEE_TOUR_ANCHORS.basic, titleKey: 'a', bodyKey: 'b' },
        { anchor: 'not-rendered', titleKey: 'c', bodyKey: 'd' },
      ],
      { tourKey: 't2' },
    );
    expect(shown).toBe(1);
    service.stop();
  });

  it('persists seen state per user, and can clear it again', async () => {
    expect(await service.hasSeen(EMPLOYEE_TOUR_KEY)).toBe(false);
    await service.markSeen(EMPLOYEE_TOUR_KEY);
    expect(await service.hasSeen(EMPLOYEE_TOUR_KEY)).toBe(true);
    await service.clearSeen(EMPLOYEE_TOUR_KEY);
    expect(await service.hasSeen(EMPLOYEE_TOUR_KEY)).toBe(false);
  });

  it('reads seen state back from the server options when localStorage is empty', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        {
          provide: EmployeeOptionsService,
          useValue: { get: vi.fn().mockResolvedValue({ toursSeen: { [EMPLOYEE_TOUR_KEY]: true } }), patch: vi.fn() },
        },
      ],
    });
    const fresh = TestBed.inject(GuidedTourService);
    expect(await fresh.hasSeen(EMPLOYEE_TOUR_KEY)).toBe(true);
  });

  it('marks the document while a tour runs, and unmarks it after', async () => {
    document.body.innerHTML = `<div data-tour="x">x</div>`;
    await service.run([{ anchor: 'x', titleKey: 'a', bodyKey: 'b' }], { tourKey: 't3' });
    expect(document.documentElement.classList.contains('app-guided-tour-active')).toBe(true);
    service.stop();
    expect(document.documentElement.classList.contains('app-guided-tour-active')).toBe(false);
  });
});

describe('guided tour placement in RTL', () => {
  it('flips inline sides, so a popover sits on the same side of the card in Arabic', () => {
    expect(toPhysicalSide('inline-end', false)).toBe('right');
    expect(toPhysicalSide('inline-end', true)).toBe('left');
    expect(toPhysicalSide('inline-start', false)).toBe('left');
    expect(toPhysicalSide('inline-start', true)).toBe('right');
  });

  it('leaves block sides alone — vertical placement does not mirror', () => {
    expect(toPhysicalSide('block-end', true)).toBe('bottom');
    expect(toPhysicalSide('block-start', true)).toBe('top');
  });

  it('flips alignment along a horizontal edge, where start means left to driver.js', () => {
    expect(toPhysicalAlign('start', 'block-end', true)).toBe('end');
    expect(toPhysicalAlign('end', 'block-end', true)).toBe('start');
    expect(toPhysicalAlign('center', 'block-end', true)).toBe('center');
  });

  it('leaves alignment alone on a vertical edge, and in LTR', () => {
    expect(toPhysicalAlign('start', 'inline-end', true)).toBe('start');
    expect(toPhysicalAlign('start', 'block-end', false)).toBe('start');
  });

  it('maps every side the employee catalog actually uses', () => {
    const used = new Set(EMPLOYEE_FORM_TOUR.map((s) => s.side).filter(Boolean));
    for (const side of used) {
      expect(toPhysicalSide(side as any, false)).toBeDefined();
      expect(toPhysicalSide(side as any, true)).toBeDefined();
    }
  });
});
