import { ErrorHandler, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

// The REAL bundles. Without them ngx-translate echoes every key back and the
// unresolved-key guard below asserts nothing.
import employeesEn from '../../i18n/en.json';
import commonEn from '../../../../../../public/i18n/en.json';

import { EmployeeBenefitService } from '../../services/employee-benefit.service';
import { EmployeePayrollService } from '../../services/employee-payroll.service';
import { EmployeeBenefitsComponent } from './employee-benefits.component';

/**
 * Benefits smoke tests — does the tab render at all?
 *
 * Its own file rather than a case in `hr-tabs.smoke.spec.ts`: that harness
 * provides exactly one service token, and this component reads TWO — benefits
 * for the record and payroll for the housing rule. Bending the shared harness
 * to fit would put the six tabs it already guards at risk for no gain.
 *
 * The three cases are the same three, for the same reasons:
 *   EMPTY      every call rejects — which is TODAY's state, since none of these
 *              endpoints exist. The tab must show empty states, not throw.
 *   POPULATED  one of everything, including the housing conflict.
 *   DEGRADED   a record arrives but the catalogue does not, so every label
 *              helper falls back to the raw key.
 *
 * Plus the i18n guard: nothing may render as a raw translation key. That is the
 * defect this repo keeps producing — a key that resolves to itself looks like
 * working software.
 */

/** Template errors go through ErrorHandler, which LOGS and continues. */
class CapturingErrorHandler implements ErrorHandler {
  readonly errors: unknown[] = [];
  handleError(error: unknown): void { this.errors.push(error); }
}

/**
 * A key that never resolved, found ANYWHERE in the text.
 *
 * ── WHY THIS IS A SEARCH AND NOT A TOKEN SPLIT ───────────────────────────────
 * The first version split `textContent` on whitespace and tested each token,
 * which is what `hr-tabs.smoke.spec.ts` still does. It does not work here, and
 * the failure is silent: adjacent inline elements render with NO whitespace
 * between them, so a label and its value concatenate —
 * `ClassEMPLOYEES.BENEFITS.CLASS.CLASS_AStart date` — and an anchored
 * per-token regex never matches. The POPULATED case passed while displaying two
 * raw keys, and a mutant that deleted the key from the bundle STILL passed.
 *
 * Scanning the whole string finds them wherever they sit.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const UNRESOLVED_KEY = /[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+/g;

function expectNoUnresolvedKeys(fixture: ComponentFixture<unknown>, label: string): void {
  const text = String((fixture.nativeElement as HTMLElement).textContent ?? '');
  const unresolved = [...new Set(text.match(UNRESOLVED_KEY) ?? [])].sort();
  expect(
    unresolved.length ? `${label}: unresolved translation keys -> ${unresolved.join(', ')}` : null,
  ).toBeNull();
}

const REJECT = () => Promise.reject(new Error('endpoint does not exist'));

const POPULATED_RECORD = {
  employeeId: 'e1',
  healthInsurance: {
    provider: 'Bupa', policyNumber: 'P-9', class: 'ClassA',
    startDate: '2026-01-01', expiryDate: '2027-01-01',
    dependantsCovered: ['d1'], card: [],
  },
  retirementPlan: {
    // Deliberately a STRING, as Postgres numeric arrives.
    scheme: 'GOSI', employeeRate: '7.5', employerRate: '12', enrolledOn: '2026-01-01',
  },
  companyHousing: { isProvided: true, unit: 'Flat 3', startDate: '2026-01-01', endDate: null },
  companyVehicle: { assetId: 'a1', assetTag: 'CAR-1', description: 'Hilux' },
  eligibilityStart: '2026-04-01',
  other: [{ id: 'o1', name: 'Gym', value: '50', startDate: '2026-01-01', endDate: null, files: [] }],
};

async function render(opts: {
  benefits: Partial<Record<'get' | 'catalog', () => Promise<any>>>;
  payrollComponents?: any[] | null;
}): Promise<{ fixture: ComponentFixture<unknown>; errors: unknown[] }> {
  const handler = new CapturingErrorHandler();

  await TestBed.resetTestingModule().configureTestingModule({
    imports: [EmployeeBenefitsComponent, TranslateModule.forRoot()],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideRouter([]),
      { provide: ErrorHandler, useValue: handler },
      {
        provide: EmployeeBenefitService,
        useValue: {
          get: opts.benefits.get ?? REJECT,
          catalog: opts.benefits.catalog ?? REJECT,
        },
      },
      {
        provide: EmployeePayrollService,
        useValue: {
          current: opts.payrollComponents === null
            ? REJECT
            : () => Promise.resolve({ components: opts.payrollComponents ?? [] }),
        },
      },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap({ id: 'e1' }) },
          parent: { snapshot: { paramMap: convertToParamMap({ id: 'e1' }) } },
        },
      },
    ],
  }).compileComponents();

  TestBed.inject(TranslateService).setTranslation('en', { ...commonEn, ...employeesEn });
  TestBed.inject(TranslateService).use('en');

  const fixture = TestBed.createComponent(EmployeeBenefitsComponent);

  // Drain the constructor's load(). `whenStable()` is NOT enough: the component
  // is zoneless and load() is a plain async method, so whenStable resolves
  // immediately and the fixture still shows COMMON.LOADING. That mistake
  // shipped once already in hr-tabs.smoke.spec.ts.
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    if (!String(fixture.nativeElement.textContent).includes('COMMON.LOADING')) break;
  }
  return { fixture, errors: handler.errors };
}

function expectNoTemplateErrors(errors: unknown[]): void {
  const first = errors[0] as any;
  expect(first ? `${first?.name ?? 'Error'}: ${first?.message ?? first}` : null).toBeNull();
}

describe('benefits tab — does it render at all', () => {
  it('EMPTY: every endpoint missing (today\'s actual state)', async () => {
    const { fixture, errors } = await render({ benefits: {}, payrollComponents: null });
    expectNoTemplateErrors(errors);
    const text = String(fixture.nativeElement.textContent);
    // A marker from the DATA path, not the loading state — the assertion that
    // catches a fixture stuck on COMMON.LOADING.
    expect(text).toContain('No health insurance recorded');
    expectNoUnresolvedKeys(fixture, 'benefits (empty)');
  });

  it('POPULATED: one of everything, including the housing conflict', async () => {
    const { fixture, errors } = await render({
      benefits: {
        get: () => Promise.resolve(POPULATED_RECORD),
        catalog: () => Promise.resolve({
          insuranceClasses: [{ key: 'ClassA', labelKey: 'employees.benefits.class.classA' }],
          retirementSchemes: [{ key: 'GOSI', labelKey: 'employees.benefits.schemeValue.gosi' }],
        }),
      },
      // A Housing component AND company housing provided — the conflict the
      // rule exists to surface.
      payrollComponents: [{ type: 'Housing', direction: 'earning' }],
    });
    expectNoTemplateErrors(errors);
    const text = String(fixture.nativeElement.textContent);
    expect(text).toContain('Flat 3');
    expect(text).toContain('CAR-1');
    // The rate is rendered from a STRING and must not become 0%.
    expect(text).toContain('7.5%');
    expect(text).toContain('Only one should apply');
    // Ran on ALL THREE cases, not two. The first version of this spec omitted
    // it here and the case passed while rendering
    // EMPLOYEES.BENEFITS.CLASS.CLASS_A and .SCHEME.GOSI as raw keys — the
    // catalogue value labels had no bundle entries. A guard that skips the one
    // case with catalogue data is not a guard.
    expectNoUnresolvedKeys(fixture, 'benefits (populated)');
  });

  it('DEGRADED: record arrives, catalogue does not', async () => {
    const { fixture, errors } = await render({
      benefits: { get: () => Promise.resolve(POPULATED_RECORD) },
      payrollComponents: [],
    });
    expectNoTemplateErrors(errors);
    // With no catalogue the label helpers fall back to the raw server key,
    // which is a value not a translation key — it must still not render as a
    // dotted SCREAMING_CASE token.
    expectNoUnresolvedKeys(fixture, 'benefits (degraded catalogue)');
  });
});
