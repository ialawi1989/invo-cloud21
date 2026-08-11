import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageService } from '@core/i18n/language.service';
import { FeatureService } from '@core/auth/feature.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { EmployeeOptionsService } from '@core/layout/services/employee-options.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { BranchSettingsService } from '../../../settings/services/branch-settings.service';

// The REAL bundles. Without them ngx-translate echoes every key back and the
// guard below asserts nothing — the same trap the tab smoke spec documents.
import employeesEn from '../../i18n/en.json';
import commonEn from '../../../../../../public/i18n/en.json';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeFieldManifestService } from '../../services/employee-field-manifest.service';
import { EMPLOYEE_FIELD_MANIFEST } from '../../models/employee-field-manifest';
import { EMPLOYEE_HR_FIELDS } from '../../employee-feature-flags';
import { EmployeeFormComponent } from './employee-form.component';

/**
 * The unresolved-key guard, extended from the six HR tabs onto the employee
 * FORM.
 *
 * ── WHY THE FORM NEEDS ITS OWN COVERAGE ─────────────────────────────────────
 * The tab guard cannot see this screen. The two HR cards render their labels
 * from the FIELD MANIFEST — `labelKey`/`hintKey` strings that live in the
 * manifest, not in any template — so nothing here is reachable from the tab
 * spec, and `tsc` cannot check a key that is a data value.
 *
 * That is exactly the shape of the payroll defect: EMPLOYEES.PAYROLL.FREQUENCY
 * was defined as a STRING while the label helper addressed it as a namespace,
 * so every value rendered as a raw dotted key and every existing test stayed
 * green. A manifest label with no bundle entry fails identically, and looks
 * identical on screen — working software with `EMPLOYEES.FIELDS.PROFILE.GENDER`
 * where a field name should be.
 *
 * Both flag states are covered, because OFF is what production sees today and
 * ON is what the manifest work is for.
 */

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * The shape of a key that never resolved: screaming snake, at least one dot.
 * ngx-translate returns the key itself on a miss, which is why an unresolved
 * label is invisible to every other kind of test.
 */
const UNRESOLVED_KEY = /^[A-Z][A-Z0-9_]*(\.[A-Z0-9_]+)+$/;

/**
 * Assert nothing rendered as a raw translation key.
 *
 * Reads `textContent` AND the attributes that carry user-visible text but
 * never appear in it — placeholder, title, aria-label. The manifest drives
 * placeholders as well as labels, so a text-only sweep would miss half of
 * what it is meant to protect.
 */
function expectNoUnresolvedKeys(fixture: ComponentFixture<unknown>, label: string): void {
  const root = fixture.nativeElement as HTMLElement;
  const tokens: string[] = String(root.textContent ?? '').split(/\s+/);

  for (const attr of ['placeholder', 'title', 'aria-label', 'alt']) {
    for (const el of Array.from(root.querySelectorAll(`[${attr}]`))) {
      tokens.push(...String(el.getAttribute(attr) ?? '').split(/\s+/));
    }
  }

  const unresolved = [...new Set(tokens.filter((t) => UNRESOLVED_KEY.test(t)))].sort();
  expect(
    unresolved.length ? `${label}: unresolved translation keys -> ${unresolved.join(', ')}` : null,
  ).toBeNull();
}

/** Template errors go through ErrorHandler, which logs and continues. */
class CapturingErrorHandler implements ErrorHandler {
  readonly errors: unknown[] = [];
  handleError(error: unknown): void { this.errors.push(error); }
}

const RECORD = {
  id: 'emp-1', name: 'Sara Ahmed', email: 'sara@example.com', avatar: '',
  admin: true, superAdmin: false, user: true, isDriver: false, isInvitedUser: false,
  branchId: 'br-1', branches: [{ id: 'br-1', name: 'Main' }],
  mediaUrl: { defaultUrl: '' }, mediaId: null, privilegeId: null, privileges: null,
  hasSystemAccess: true, isHrDataOwner: true,
  password: '', passCode: '', MSR: '', base64Image: '', companyId: 'co-1',
  companyGroupId: null, createdAt: '', apply2fa: false, hasPermissionToChange2fa: true,
  resetPasswordDate: null, hireDate: null, terminationDate: null,

  /**
   * One row in every `group[]`.
   *
   * Not decoration: with all three empty the renderer takes its
   * `RENDERER.NO_ROWS` branch and `RENDERER.REMOVE_ROW` plus every
   * `rowLabelKey` never render at all. Verified by deleting the whole
   * RENDERER block — with empty groups only NO_ROWS and SELECT were caught,
   * so half the renderer sat behind a guard that could not see it.
   */
  profile: {
    gender: 'Female', nationality: 'BH', maritalStatus: 'Single',
    emergencyContacts: [{ name: 'Noor', relationship: 'Sibling', phone: '39000000', isPrimary: true }],
    dependents: [{ name: 'Yusuf', relationship: 'Child', dateOfBirth: '2020-01-01', cpr: '', isInsured: true, isOnVisa: false }],
    education: [{ level: 'Bachelor', institution: 'UoB', graduationYear: 2015, fieldOfStudy: 'Accounting' }],
  },
  employment: {
    employmentType: 'FullTime', status: 'Active', department: 'Operations',
    position: 'Cashier', jobGrade: 'B', reportsTo: null,
  },
};

/** The same employee with every `group[]` empty — the fresh-record state. */
const RECORD_NO_ROWS = {
  ...RECORD,
  profile: { ...RECORD.profile, emergencyContacts: [], dependents: [], education: [] },
};

function setup(opts: { hrFields: boolean; record?: unknown }) {
  const handler = new CapturingErrorHandler();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [EmployeeFormComponent, TranslateModule.forRoot()],
    providers: [
      { provide: ErrorHandler, useValue: handler },
      {
        provide: EmployeeService,
        useValue: {
          getOne: vi.fn().mockResolvedValue(opts.record ?? RECORD),
          save: vi.fn().mockResolvedValue({ success: true }),
          // Non-empty, so the lookup dropdowns render options rather than
          // staying collapsed and hiding whatever they would have shown.
          getEmploymentLookups: vi.fn().mockResolvedValue({
            departments: ['Operations'], positions: ['Cashier'],
          }),
          searchEmployees: vi.fn().mockResolvedValue({
            items: [{ id: 'emp-2', name: 'Ali' }], hasMore: false,
          }),
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
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 'emp-1']]) } } },
    ],
  });

  if (opts.hrFields) TestBed.inject(FeatureService).setFeatures([EMPLOYEE_HR_FIELDS]);

  TestBed.inject(TranslateService).setTranslation('en', { ...commonEn, ...employeesEn });
  TestBed.inject(TranslateService).use('en');

  const fixture = TestBed.createComponent(EmployeeFormComponent);
  return { fixture, handler };
}

/** ngOnInit runs from the first detectChanges — never call it by hand too. */
async function load(fixture: ComponentFixture<EmployeeFormComponent>): Promise<void> {
  fixture.detectChanges();
  await flush();
  await flush();
  fixture.detectChanges();
}

describe('employee form — no label renders as a raw translation key', () => {
  describe('HR fields ON (the manifest-driven cards)', () => {
    let ctx: ReturnType<typeof setup>;

    beforeEach(async () => {
      ctx = setup({ hrFields: true });
      await load(ctx.fixture);
    });

    it('renders both HR cards', () => {
      // If these are absent the guard below passes vacuously — the same way
      // the tab smoke tests passed while showing nothing but COMMON.LOADING.
      const root = ctx.fixture.nativeElement as HTMLElement;
      expect(root.querySelector('[data-tour="emp-hr-profile"]')).toBeTruthy();
      expect(root.querySelector('[data-tour="emp-hr-employment"]')).toBeTruthy();
    });

    it('renders manifest field labels from the bundle, not as keys', () => {
      expectNoUnresolvedKeys(ctx.fixture, 'employee-form (HR on)');
    });

    it('renders without template errors', () => {
      const first = ctx.handler.errors[0] as any;
      expect(first ? `${first?.name ?? 'Error'}: ${first?.message ?? first}` : null).toBeNull();
    });
  });

  /**
   * The empty-group state renders a DIFFERENT branch of the renderer:
   * `RENDERER.NO_ROWS` instead of `RENDERER.REMOVE_ROW` and the row labels.
   * Covering only one of the two leaves half the renderer unguarded — proven
   * by deleting the RENDERER block against each fixture in turn.
   */
  describe('HR fields ON, every group empty (a fresh record)', () => {
    let ctx: ReturnType<typeof setup>;

    beforeEach(async () => {
      ctx = setup({ hrFields: true, record: RECORD_NO_ROWS });
      await load(ctx.fixture);
    });

    it('renders the empty-state renderer text from the bundle', () => {
      expectNoUnresolvedKeys(ctx.fixture, 'employee-form (HR on, no rows)');
    });
  });

  describe('HR fields OFF (what production sees today)', () => {
    let ctx: ReturnType<typeof setup>;

    beforeEach(async () => {
      ctx = setup({ hrFields: false });
      await load(ctx.fixture);
    });

    it('renders the base form without unresolved keys', () => {
      expectNoUnresolvedKeys(ctx.fixture, 'employee-form (HR off)');
    });

    it('renders without template errors', () => {
      const first = ctx.handler.errors[0] as any;
      expect(first ? `${first?.name ?? 'Error'}: ${first?.message ?? first}` : null).toBeNull();
    });
  });
});
