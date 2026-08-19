import { ErrorHandler, Type, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

// The REAL bundles. Without them every key resolves to itself and the
// unresolved-key guard below would be meaningless — see expectNoUnresolvedKeys.
import employeesEn from '../i18n/en.json';
import commonEn from '../../../../../public/i18n/en.json';

import { EmployeeAssetsComponent } from './employee-assets/employee-assets.component';
import { EmployeeDisciplinaryComponent } from './employee-disciplinary/employee-disciplinary.component';
import { EmployeeDocumentsComponent } from './employee-documents/employee-documents.component';
import { EmployeeLeaveComponent } from './employee-leave/employee-leave.component';
import { EmployeePayrollComponent } from './employee-payroll/employee-payroll.component';
import { EmployeePerformanceComponent } from './employee-performance/employee-performance.component';

import { EmployeeAssetService } from '../services/employee-asset.service';
import { EmployeeDisciplinaryService } from '../services/employee-disciplinary.service';
import { EmployeeDocumentService } from '../services/employee-document.service';
import { EmployeeLeaveService } from '../services/employee-leave.service';
import { EmployeePayrollService } from '../services/employee-payroll.service';
import { EmployeePerformanceService } from '../services/employee-performance.service';

/**
 * Smoke tests — do these six components actually render?
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 * Every one of these tabs shipped without ever being instantiated: not in a
 * test, not in a browser. The other specs cover pure functions and the route
 * table, and `tsc --noEmit` does NOT type-check Angular templates — so a
 * directive missing from `imports`, an unprovided dependency, or a null
 * dereference inside a `@for` would all reach a user before anything failed.
 *
 * These are deliberately NOT behaviour tests. Each component is rendered twice
 * and that is the whole assertion:
 *
 *   EMPTY    every service returns null / [] — the state on a fresh record, and
 *            the one that finds null dereferences in templates.
 *   POPULATED one realistic row per collection — finds binding errors that an
 *            empty list hides, because `@for` over `[]` renders nothing at all.
 *
 * The populated fixtures deliberately include the nullable computed fields as
 * `null` (`status`, `isOverdue`, `isSpent`, `effectiveScore`, `basis`), because
 * that is exactly what the server sends when it cannot compute them and it is
 * the case every template is supposed to render as "unknown" rather than crash.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const FILE_CATALOG = { maxBytes: 10485760, accepted: ['application/pdf'], storageConfigured: true };
const FILE = {
  id: 'f1', fileName: 'a.pdf', contentType: 'application/pdf',
  sizeBytes: 1024, uploadedAt: '2026-08-01', uploadedBy: 'emp-1',
};

/** A service mock: every method resolves, so the constructor's load() settles. */
function mock(shape: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(shape)) out[k] = () => Promise.resolve(v);
  return out;
}

interface Case {
  name: string;
  component: Type<unknown>;
  token: unknown;
  empty: Record<string, unknown>;
  populated: Record<string, unknown>;
  /** A string only present once real data has rendered. */
  marker: string;
}

const CASES: Case[] = [
  {
    name: 'documents',
    marker: 'X1',
    component: EmployeeDocumentsComponent,
    token: EmployeeDocumentService,
    empty: { list: [], types: [], fileCatalog: null, save: { id: '', warnings: [] } },
    populated: {
      types: [{ key: 'Passport', labelKey: 'employees.documents.type.passport', expiryRequired: true }],
      fileCatalog: FILE_CATALOG,
      save: { id: 'd1', warnings: ['needs evidence'] },
      list: [{
        id: 'd1', employeeId: 'e1', type: 'Passport', number: 'X1',
        issueDate: '2020-01-01', expiryDate: '2027-01-01', issuingCountry: 'BH',
        reminderDays: [90, 30], visaType: null, workPermitNumber: null,
        workPermitExpiry: null, sponsor: null, licenceCategories: [],
        gosiNumber: null, cprNumber: null, isVerified: true, verifiedBy: 'e2',
        verifiedByName: 'Sara', verifiedAt: '2026-01-01', notes: 'n',
        // The server could not compute these — must render as unknown.
        status: null, daysRemaining: null,
        files: [FILE],
      }],
    },
  },
  {
    name: 'assets',
    marker: 'LT-1',
    component: EmployeeAssetsComponent,
    token: EmployeeAssetService,
    empty: {
      list: [], listOpen: [], fileCatalog: null,
      catalog: { categories: [], statuses: [], conditions: [] },
    },
    populated: {
      listOpen: [], fileCatalog: FILE_CATALOG,
      catalog: {
        categories: [{ key: 'Laptop', labelKey: 'employees.assets.category.laptop' }],
        statuses: [{ key: 'Assigned', labelKey: 'employees.assets.status.assigned', closesAssignment: false, expectsReturn: false }],
        conditions: [{ key: 'Good', labelKey: 'employees.assets.condition.good' }],
      },
      list: [{
        id: 'a1', employeeId: 'e1', assetTag: 'LT-1', category: 'Laptop',
        description: 'Dell', serialNumber: 'SN1', value: 500,
        assignedDate: '2026-01-01', expectedReturnDate: '2026-12-01',
        returnDate: null, conditionOut: 'Good', conditionIn: null,
        status: 'Assigned', notes: null,
        isOverdue: null, daysUntilReturn: null,
        files: [FILE],
      }],
    },
  },
  {
    name: 'leave',
    marker: 'holiday',
    component: EmployeeLeaveComponent,
    token: EmployeeLeaveService,
    empty: {
      requests: [], balance: null, profile: null, fileCatalog: null,
      catalog: { types: [], statuses: [], yearStarts: [], suggestedDays: null, suggestionExcludesPublicHolidays: true },
    },
    populated: {
      profile: {
        policyName: 'Std', leaveYearStart: 'CompanyYear', annualEntitlementDays: 30,
        openingBalance: 0, carryOverDays: 5, carryOverExpiry: '2026-03-31',
        encashmentEligible: true, delegateEmployeeId: null,
        accrualRateDays: 2.5, accrualOverrideReason: 'pro-rata',
        // Locked, so the opening balance renders read-only with its reason.
        openingBalanceLockedAt: '2026-01-01T00:00:00Z',
        airTicket: { isEntitled: true, class: 'Economy', destination: 'BAH',
                     dependantsCovered: true, lastIssued: '2025-07-01' },
        // The house rule: stored, nothing computed from it.
        entitlementValuesCalculated: false,
        hireDate: '2020-01-01',
      },
      saveProfile: { id: 'lp1' },
      fileCatalog: FILE_CATALOG,
      catalog: {
        types: [{ key: 'Annual leave', labelKey: 'employees.leave.type.annual', deductsBalance: true, paid: true }],
        statuses: [{ key: 'Pending', labelKey: 'employees.leave.status.pending', consumesBalance: true, open: true }],
        yearStarts: [], suggestedDays: 3, suggestionExcludesPublicHolidays: true,
      },
      balance: {
        // The fallback basis — the loud case the panel must call out.
        yearStart: '2026-01-01', yearEnd: '2026-12-31', basis: 'HireAnniversaryUnavailable',
        entitlementDays: 30, openingBalance: 0, carryOverDays: 0,
        usedDays: 3, remainingDays: 27,
        byType: [{ leaveType: 'Annual leave', days: 3, requests: 1, deductsBalance: true }],
      },
      requests: [{
        id: 'r1', employeeId: 'e1', leaveType: 'Annual leave', status: 'Pending',
        startDate: '2026-03-01', endDate: '2026-03-03', halfDay: 'none',
        days: 3, reason: 'holiday', handoverToEmployeeId: null,
        decidedBy: null, decidedAt: null, decisionComment: null, files: [FILE],
      }],
    },
  },
  {
    name: 'performance',
    marker: 'Layla',
    component: EmployeePerformanceComponent,
    token: EmployeePerformanceService,
    empty: {
      reviews: [], trainings: [], fileCatalog: null,
      catalog: { cycles: [], statuses: [], ratingScale: [] },
    },
    populated: {
      fileCatalog: FILE_CATALOG,
      catalog: {
        cycles: [{ key: 'Annual', labelKey: 'employees.performance.cycle.annual', months: 12 }],
        statuses: [{ key: 'ManagerReview', labelKey: 'employees.performance.status.managerReview', employeeMayWrite: false, locked: false }],
        ratingScale: [{ value: 3, labelKey: 'employees.performance.rating.meetsExpectations' }],
      },
      trainings: [{
        id: 't1', employeeId: 'e1', reviewId: null, name: 'Safety',
        provider: 'X', completionDate: '2026-01-01', expiryDate: '2027-01-01',
        cost: 100, reminderDays: [30], notes: null, files: [FILE],
      }],
      reviews: [{
        id: 'rv1', employeeId: 'e1', reviewCycle: 'Annual', status: 'ManagerReview',
        periodStart: '2026-01-01', periodEnd: '2026-12-31', nextReviewDate: null,
        reviewerId: 'e2', reviewerName: 'Layla',
        goals: [{ title: 'G', metric: 'm', target: 10, weight: 100, achieved: null }],
        competencies: [{ competency: 'Teamwork', rating: null, comment: null }],
        selfAssessment: null, managerFeedback: 'ok', pip: null,
        // A calibrated review, with the computed figure preserved beside it.
        goalScore: null, competencyScore: null, finalScore: 72,
        calibratedScore: 80, calibrationReason: 'moderation', calibratedBy: 'e3',
        calibratedAt: '2026-06-01', effectiveScore: 80,
        acknowledgedAt: null, acknowledgementComment: null, isFinal: null,
        files: [FILE],
      }],
    },
  },
  {
    name: 'disciplinary',
    marker: 'Hassan',
    component: EmployeeDisciplinaryComponent,
    token: EmployeeDisciplinaryService,
    empty: {
      records: [], escalation: null, fileCatalog: null,
      catalog: { warningTypes: [], severities: [], reasons: [], appealOutcomes: [], payrollImpactTypes: [] },
    },
    populated: {
      fileCatalog: FILE_CATALOG,
      escalation: { level: 2, liveCount: 1, records: [] },
      catalog: {
        warningTypes: [{ key: 'Written', labelKey: 'employees.disciplinary.type.written', rank: 2, endsEmployment: false }],
        severities: [{ key: 'Medium', labelKey: 'employees.disciplinary.severity.medium' }],
        reasons: [{ key: 'Conduct', labelKey: 'employees.disciplinary.reason.conduct' }],
        appealOutcomes: [{ key: 'Overturned', labelKey: 'employees.disciplinary.appeal.overturned', overturnsRecord: true }],
        payrollImpactTypes: [{ key: 'None', labelKey: 'employees.disciplinary.payroll.none' }],
      },
      records: [{
        id: 'w1', employeeId: 'e1', warningType: 'Written', severity: 'Medium',
        reason: 'Conduct', incidentDate: '2026-05-01', reportedDate: '2026-05-02',
        expiryDate: '2027-05-01', statementDeadline: '2026-05-09',
        description: 'd', actionTaken: 'a', issuedBy: 'e2', issuedByName: 'Hassan',
        employeeStatement: null, acknowledged: null, acknowledgedAt: null,
        refusedToSign: true, witnessName: null, payrollImpact: 'None', notes: null,
        appeal: { submittedAt: '2026-05-10', grounds: 'unfair', outcome: null, decidedAt: null, decidedBy: null },
        isSpent: null, responseWindowOpen: null,
        files: [FILE],
      }],
    },
  },
  {
    name: 'payroll',
    marker: 'NBB',
    component: EmployeePayrollComponent,
    token: EmployeePayrollService,
    empty: {
      current: null, history: [], bankDetails: null, loans: [],
      catalog: { frequencies: [], paymentMethods: [], changeReasons: [], componentTypes: [], calculationMethods: [], statutoryCalculationsAvailable: false },
    },
    populated: {
      catalog: {
        frequencies: [{ key: 'Monthly', labelKey: 'employees.payroll.frequency.monthly', perYear: 12 }],
        paymentMethods: [{ key: 'BankTransfer', labelKey: 'employees.payroll.method.bankTransfer', needsBank: true }],
        changeReasons: [{ key: 'Promotion', labelKey: 'employees.payroll.reason.promotion' }],
        // Bonus is the newest catalogue entry (backend db8b4f991) and the one
        // most likely to ship with no Arabic string, so it is rendered here
        // rather than assumed. A deduction is included too: `direction` picks
        // a different branch in the template.
        componentTypes: [
          { key: 'Housing', labelKey: 'employees.payroll.component.housing', direction: 'earning' },
          { key: 'Bonus', labelKey: 'employees.payroll.component.bonus', direction: 'earning' },
          { key: 'Penalty', labelKey: 'employees.payroll.component.penalty', direction: 'deduction' },
        ],
        calculationMethods: ['Fixed', 'PercentOfBasic'],
        statutoryCalculationsAvailable: false,
      },
      bankDetails: {
        id: 'b1', bankName: 'NBB', iban: 'BH67BMAG00001299123456', swift: 'NBOBBHBM',
        accountHolderName: 'Sara', splitAccounts: [{ bankName: 'X', iban: 'BH67BMAG00001299123456', percentage: 100 }],
        updatedAt: '2026-01-01', updatedBy: 'e2',
      },
      loans: [{ id: 'l1', employeeId: 'e1', amount: 1000, currency: 'BHD', instalment: 100, startDate: '2026-01-01', repaidAmount: 300, balance: 700, isSettled: false, notes: null }],
      current: {
        id: 'p1', employeeId: 'e1', effectiveFrom: '2026-01-01', basicSalary: 1250,
        currency: 'BHD', payFrequency: 'Monthly', changeReason: 'Promotion',
        changeNote: null, paymentMethod: 'BankTransfer',
        socialInsuranceApplicable: true, wpsEnabled: false, gosiNumber: null,
        components: [
          { type: 'Housing', direction: 'earning', amount: 25, calculation: 'PercentOfBasic', isRecurring: true, effectiveFrom: null, effectiveTo: null },
          // Non-recurring by design: a bonus is a one-off, and this is the
          // path that distinguishes it from any other earning.
          { type: 'Bonus', direction: 'earning', amount: 500, calculation: 'Fixed', isRecurring: false, effectiveFrom: '2026-03-01', effectiveTo: null },
          { type: 'Penalty', direction: 'deduction', amount: 50, calculation: 'Fixed', isRecurring: false, effectiveFrom: null, effectiveTo: null },
        ],
        grossSalary: 1562.5, recurringDeductions: 0, netBeforeStatutory: 1562.5,
        statutoryDeductionsIncluded: false, isCurrent: true, isFuture: false,
      },
      history: [{
        id: 'p1', employeeId: 'e1', effectiveFrom: '2026-01-01', basicSalary: 1250,
        currency: 'BHD', payFrequency: 'Monthly', changeReason: 'Promotion',
        changeNote: 'note', paymentMethod: 'BankTransfer',
        socialInsuranceApplicable: true, wpsEnabled: false, gosiNumber: null,
        components: [], grossSalary: 1250, recurringDeductions: 0,
        netBeforeStatutory: 1250, statutoryDeductionsIncluded: false,
        isCurrent: true, isFuture: false,
      }],
    },
  },
];

/**
 * Angular routes template errors through `ErrorHandler`, which LOGS and
 * continues — a `TypeError` inside a `@for` does not fail `detectChanges()`.
 * Without capturing them, a component can throw on every row and the spec
 * still reports green. (It did.)
 */
class CapturingErrorHandler implements ErrorHandler {
  readonly errors: unknown[] = [];
  handleError(error: unknown): void { this.errors.push(error); }
}

async function render(c: Case, data: Record<string, unknown>): Promise<{
  fixture: ComponentFixture<unknown>;
  errors: unknown[];
}> {
  const handler = new CapturingErrorHandler();
  await TestBed.configureTestingModule({
    imports: [c.component, TranslateModule.forRoot()],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideRouter([]),
      { provide: ErrorHandler, useValue: handler },
      { provide: c.token, useValue: mock(data) },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap({ id: 'e1' }) },
          parent: { snapshot: { paramMap: convertToParamMap({ id: 'e1' }) } },
        },
      },
    ],
  }).compileComponents();

  // Load the real strings, so a key that fails to resolve is genuinely absent
  // from the bundle rather than merely absent from the test.
  TestBed.inject(TranslateService).setTranslation('en', { ...commonEn, ...employeesEn });
  TestBed.inject(TranslateService).use('en');

  const fixture = TestBed.createComponent(c.component);

  /**
   * Drain the constructor's `load()` before asserting.
   *
   * ── `whenStable()` IS NOT ENOUGH HERE, AND THE FIRST VERSION OF THIS FILE
   *    SHIPPED BECAUSE OF IT ──────────────────────────────────────────────────
   * These components are zoneless and `load()` is a plain async method awaiting
   * `Promise.all` — Angular has no knowledge of it, so `whenStable()` resolves
   * immediately and the fixture still shows `COMMON.LOADING`.
   *
   * Every case passed that way while rendering nothing but the loading state:
   * no row template was ever evaluated, so the tests proved only that the
   * component could be constructed. A deliberately broken label helper
   * (`found!.labelKey` against an empty catalogue) survived all of them.
   *
   * A macrotask tick drains the pending microtask queue, and several of them
   * cover chained awaits. The loop stops as soon as the loading state clears.
   */
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    if (!String(fixture.nativeElement.textContent).includes('COMMON.LOADING')) break;
  }
  return { fixture, errors: handler.errors };
}

/** Fail loudly with the real message rather than an unhelpful length assertion. */
function expectNoTemplateErrors(errors: unknown[]): void {
  const first = errors[0] as any;
  expect(first ? `${first?.name ?? 'Error'}: ${first?.message ?? first}` : null).toBeNull();
}

/**
 * The shape of a translation key that never resolved.
 *
 * `EMPLOYEES.PAYROLL.COMPONENT.HOUSING` — screaming snake, at least one dot.
 * ngx-translate returns the key itself on a miss, so an unresolved label is
 * indistinguishable from working software until someone looks at the screen.
 */
// Unanchored and GLOBAL, to match the whole-string search below. The anchored
// per-token form this replaced could only ever match a token that WAS the key
// with nothing attached to it.
const UNRESOLVED_KEY = /[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+/g;

/**
 * Assert nothing rendered as a raw translation key.
 *
 * ── WHY THIS IS A CLASS, NOT A BUG ───────────────────────────────────────────
 * The payroll tab shipped with EMPLOYEES.PAYROLL.FREQUENCY and .METHOD defined
 * as STRINGS while portalKey() maps the server's labelKeys onto
 * `…FREQUENCY.MONTHLY` — a string cannot be a namespace, so every frequency,
 * method, change reason and component name rendered as a dotted key. REASON and
 * COMPONENT had no block at all.
 *
 * The smoke tests passed throughout, because they assert a component RENDERS,
 * not that its text is readable. This closes exactly that gap, for all six tabs
 * at once, and it costs one pass over the rendered text.
 *
 * ── SEARCH THE WHOLE STRING, NEVER SPLIT ON WHITESPACE ──────────────────────
 * This function used to split `textContent` into tokens and test each one. That
 * fails SILENTLY: adjacent inline elements render with no whitespace between
 * them, so a label and its value concatenate —
 * `ClassEMPLOYEES.BENEFITS.CLASS.CLASS_AStart date` — and a per-token match
 * never sees the key. `employee-benefits.smoke.spec.ts` found this the hard
 * way: its POPULATED case passed while displaying two raw keys, and a mutant
 * that deleted the key from the bundle passed too.
 *
 * A guard that cannot go red is not a guard. Same implementation as the
 * benefits spec, deliberately — two copies that disagree is how one of them
 * silently stops working.
 */
function expectNoUnresolvedKeys(fixture: ComponentFixture<unknown>, label: string): void {
  const text = String(fixture.nativeElement.textContent ?? '');
  const unresolved = [...new Set(text.match(UNRESOLVED_KEY) ?? [])].sort();
  expect(unresolved.length ? `${label}: unresolved translation keys -> ${unresolved.join(', ')}` : null)
    .toBeNull();
}

describe('HR tab components — do they render at all', () => {
  beforeEach(() => TestBed.resetTestingModule());

  for (const c of CASES) {
    describe(c.name, () => {
      it('renders with no data', async () => {
        const { fixture, errors } = await render(c, c.empty);
        expectNoTemplateErrors(errors);
        expectNoUnresolvedKeys(fixture, `${c.name} (empty)`);
        expect(fixture.nativeElement.textContent).toBeDefined();
      });

      it('renders with one row in every collection', async () => {
        const { fixture, errors } = await render(c, c.populated);
        expectNoTemplateErrors(errors);
        expectNoUnresolvedKeys(fixture, `${c.name} (populated)`);
        // A marker from the DATA, not just "some text" — otherwise a harness
        // that only ever renders the loading state passes every case.
        expect(String(fixture.nativeElement.textContent)).toContain(c.marker);
      });

      /**
       * Rows present, catalogue missing — and this is the case that earns its
       * keep.
       *
       * The list and the catalogue are SEPARATE requests, and every component
       * `.catch()`es the catalogue into an empty fallback so one failure does
       * not blank the tab. So "rows I cannot find labels for" is a state the
       * server can genuinely produce, and it is the one where label lookups
       * return undefined.
       *
       * The first version of this file had only the two cases above. A
       * deliberate break — `found!.labelKey` in a label helper, which compiles
       * because the assertion silences TypeScript — passed both of them: the
       * empty case never reaches the helper, and the populated case supplies a
       * matching catalogue. This case fails it.
       */
      it('renders rows whose catalogue did not load', async () => {
        const catalogKeys = Object.keys(c.empty).filter(k => /catalog|types/i.test(k));
        const degraded = { ...c.populated };
        for (const k of catalogKeys) degraded[k] = c.empty[k];
        const { fixture, errors } = await render(c, degraded);
        expectNoTemplateErrors(errors);
        expectNoUnresolvedKeys(fixture, `${c.name} (no catalogue)`);
        expect(String(fixture.nativeElement.textContent).trim().length).toBeGreaterThan(0);
      });
    });
  }
});
