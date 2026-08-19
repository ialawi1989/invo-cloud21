import { ErrorHandler, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

// The REAL bundles. Without them ngx-translate echoes every key back and the
// unresolved-key guard below asserts nothing.
import employeesEn from '../../i18n/en.json';
// The common bundle too — COMMON.SAVE and COMMON.DELETE live there, and
// without it the unresolved-key guard reports them as product defects.
import commonEn from '../../../../../../public/i18n/en.json';

import { EmployeeEosService } from '../../services/employee-eos.service';
import { EmployeeService } from '../../services/employee.service';
import { EosRecord } from '../../services/employee-eos.types';
import { EmployeeEosComponent } from './employee-eos.component';

/**
 * Does the End of Service tab render at all?
 *
 * The rules under it are covered (employee-eos.spec.ts, 13 mutants) and the tab
 * gating is covered, but until now NOTHING exercised this template — so a
 * binding typo or a key missing from the bundle would have shipped. Those are
 * the defects this file exists for; they are invisible to every other test.
 *
 * Three cases, the same three the attachments card uses:
 *   EMPTY      no record yet — the blank seeded shape the server returns for
 *              an employee who has not left. Must render, not throw.
 *   POPULATED  one of everything, including a blocked clearance row and an
 *              overridden settlement line.
 *   DEGRADED   the endpoint rejects, which is what a deployment that has not
 *              migrated yet does. Must show an empty screen, not an error page.
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
 * A whole-string search, not a per-token one: adjacent inline elements render
 * with no whitespace between them, so a raw key sitting against its neighbour
 * defeats an anchored regex. That exact mistake let two raw keys through in the
 * benefits tab while its test passed.
 */
const UNRESOLVED_KEY = /[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+/g;

function expectNoUnresolvedKeys(fixture: ComponentFixture<unknown>, label: string): void {
  const text = String((fixture.nativeElement as HTMLElement).textContent ?? '');
  const unresolved = [...new Set(text.match(UNRESOLVED_KEY) ?? [])].sort();
  expect(
    unresolved.length ? `${label}: unresolved translation keys -> ${unresolved.join(', ')}` : null,
  ).toBeNull();
}

const RAIL_EMPLOYEE: any = {
  id: 'emp-1', name: 'Fatima Al-Sayed', email: 'f@example.com', avatar: '',
  admin: false, superAdmin: false, user: true, isDriver: false, isInvitedUser: false,
  branchId: 'br-1', branches: [], hasSystemAccess: true,
  hireDate: '2025-07-14', terminationDate: null,
  profile: { employeeNumber: 'E-633648' },
  employment: { position: 'Senior Accountant', employmentType: 'Full-time' },
};

const BLANK: EosRecord = {
  id: null, type: null, noticeGivenDate: null, lastWorkingDay: null,
  reason: null, rehireEligible: true, rehireReason: null,
  exitInterview: { conductedBy: null, date: null, summary: null },
  clearance: [
    { id: '', department: 'IT', owner: null, status: 'Pending', blockingReason: null, clearedAt: null },
    { id: '', department: 'Finance', owner: null, status: 'Pending', blockingReason: null, clearedAt: null },
  ],
  settlement: [],
  visaCancellationDate: null, accessRevokedAt: null, completedAt: null,
};

const POPULATED: EosRecord = {
  ...BLANK,
  id: 'eos-1',
  type: 'Resignation',
  noticeGivenDate: '2026-08-01',
  lastWorkingDay: '2026-08-31',
  reason: 'Moving abroad',
  rehireEligible: false,
  rehireReason: 'Repeated lateness',
  clearance: [
    { id: 'c1', department: 'IT', owner: null, status: 'Cleared', blockingReason: null, clearedAt: null },
    { id: 'c2', department: 'Finance', owner: null, status: 'Blocked', blockingReason: 'Laptop not returned', clearedAt: null },
  ],
  settlement: [
    { id: 's1', lineKey: 'UnpaidSalary', amount: 1500, calculationNote: 'Aug 1-31', isOverridden: false, overrideReason: null },
    { id: 's2', lineKey: 'NoticeInLieu', amount: 800, calculationNote: null, isOverridden: true, overrideReason: 'Agreed with HR' },
  ],
};

async function render(opts: {
  record?: EosRecord;
  rejects?: boolean;
  /** Make the identity-rail lookup fail, leaving the form untouched. */
  employeeRejects?: boolean;
  openAssets?: number;
  statutory?: boolean;
}) {
  const handler = new CapturingErrorHandler();

  await TestBed.resetTestingModule().configureTestingModule({
    imports: [EmployeeEosComponent, TranslateModule.forRoot()],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideRouter([]),
      { provide: ErrorHandler, useValue: handler },
      {
        provide: EmployeeService,
        useValue: {
          getOne: opts.employeeRejects
            ? () => Promise.reject(new Error('refused'))
            : () => Promise.resolve(RAIL_EMPLOYEE),
        },
      },
      {
        provide: EmployeeEosService,
        useValue: {
          get: opts.rejects
            ? () => Promise.reject(new Error('endpoint does not exist'))
            : () => Promise.resolve(opts.record ?? BLANK),
          lastCapabilities: () => ({
            available: !opts.rejects,
            statutoryCalculationsAvailable: opts.statutory === true,
            reason: null,
          }),
          lastOpenAssetCount: () => opts.openAssets ?? 0,
          save: () => Promise.resolve({ id: 'eos-1' }),
          complete: () => Promise.resolve({}),
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

  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', commonEn as any, true);
  translate.setTranslation('en', employeesEn as any, true);
  translate.use('en');

  const fixture = TestBed.createComponent(EmployeeEosComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  const el = fixture.nativeElement as HTMLElement;
  // ── textContent DOES NOT CONTAIN INPUT VALUES ──────────────────────────────
  // Half of this screen is <input [value]>, and an input's value lives on the
  // property, not in the text. The first version of these tests asserted
  // `text).toContain('Moving abroad')` and failed for that reason alone —
  // an assertion looking in a place the observable can never appear.
  const values = [...el.querySelectorAll('input, select')]
    .map((i) => String((i as HTMLInputElement).value ?? ''))
    .join(' | ');

  return { fixture, errors: handler.errors, text: String(el.textContent ?? ''), values };
}

describe('employee EOS tab — EMPTY', () => {
  it('renders the blank seeded record without throwing', async () => {
    const { fixture, errors, text } = await render({});

    expect(errors).toEqual([]);
    expect(text).toContain('End of service details');

    // The seeded clearance rows are the point of the blank shape. Read from
    // the FIRST CELL of each row, not from the page text: a page-wide
    // toContain('IT') is satisfied by any uppercase run anywhere on screen,
    // and a mutant binding the department cell to `status` survived exactly
    // that.
    const departments = [...fixture.nativeElement.querySelectorAll('[data-test="clearance"] tbody tr td:first-child')]
      .map((td: any) => String(td.textContent ?? '').trim());
    expect(departments).toEqual(['IT', 'Finance']);

    expectNoUnresolvedKeys(fixture, 'empty');
  });

  it('says the settlement is empty rather than showing a total of zero', async () => {
    // A total over an empty settlement would present "0" as the final figure.
    const { text } = await render({});

    expect(text).toContain('No settlement lines yet');
    expect(text).toContain('Not yet');
  });

  it('shows the not-calculated banner when the server does not calculate', async () => {
    const { text } = await render({ statutory: false });

    expect(text).toContain('No settlement figure is calculated');
  });

  it('drops the banner when the server says it DOES calculate', async () => {
    // The inverse, and the one that matters: the banner is driven by the
    // server's flag, not hardcoded. A template that always renders it satisfies
    // the case above and would keep disclaiming after the disclaimer stopped
    // being true.
    const { text } = await render({ statutory: true });

    expect(text).not.toContain('No settlement figure is calculated');
  });
});

describe('employee EOS tab — POPULATED', () => {
  it('renders the record, its clearance and its settlement', async () => {
    const { fixture, errors, text, values } = await render({ record: POPULATED });

    expect(errors).toEqual([]);
    // Field values, read from the inputs rather than the text.
    expect(values).toContain('Moving abroad');
    expect(values).toContain('Laptop not returned');
    expect(text).toContain('UnpaidSalary');
    expect(text).toContain('NoticeInLieu');
    expectNoUnresolvedKeys(fixture, 'populated');
  });

  it('shows a total once every line has an amount', async () => {
    // 1500 + 800. The inverse of the empty case's "Not yet".
    const { text } = await render({ record: POPULATED });

    expect(text).not.toContain('Not yet');
    expect(text).toContain('2,300');
  });

  it('withholds the total while a line is undecided', async () => {
    // The pair that matters. An undecided line is not a zero line, and a total
    // over a partial settlement presents an incomplete figure as final.
    const { text } = await render({
      record: {
        ...POPULATED,
        settlement: [
          POPULATED.settlement[0],
          { ...POPULATED.settlement[1], amount: null },
        ],
      },
    });

    expect(text).toContain('Not yet');
    expect(text).not.toContain('2,300');
  });

  it('lists why completion is blocked', async () => {
    const { fixture, text } = await render({ record: POPULATED, openAssets: 2 });
    expect(text).toContain('This cannot be completed yet');

    // ── SCOPED TO THE BLOCKERS PANEL, DELIBERATELY ─────────────────────────
    // Asserting on the whole page passed for the wrong reason: the clearance
    // section renders "Company property is still assigned" from its OWN
    // hardcoded key, so a page-wide toContain was satisfied even when the
    // blocker list beneath it rendered raw keys. A mutant that stripped the
    // key prefix survived exactly that.
    const panel = fixture.nativeElement.querySelector('.eos__card--blockers');
    expect(panel).toBeTruthy();
    const panelText = String(panel.textContent ?? '');

    expect(panelText).toContain('Company property is still assigned');
    expect(panelText).toContain('Clearance is blocked');

    // And nothing in that panel may look like an unresolved key. The guard
    // above only catches DOTTED keys; a mapper that dropped the prefix yields
    // bare `NEEDS_TYPE`, which is just as broken on screen and has no dot.
    expect(panelText).not.toMatch(/[A-Z][A-Z0-9]*_[A-Z0-9_]+/);

    expectNoUnresolvedKeys(fixture, 'blocked');
  });

  it('shows the rehire reason only when someone is marked not eligible', async () => {
    const notEligible = await render({ record: POPULATED });
    expect(notEligible.values).toContain('Repeated lateness');

    // The inverse: a template that always renders the field would show an
    // empty "why not eligible" box on every ordinary resignation.
    const eligible = await render({
      record: { ...POPULATED, rehireEligible: true, rehireReason: null },
    });
    expect(eligible.text).not.toContain('Why not eligible for rehire');
  });
});

describe('employee EOS tab — the SERVER refuses', () => {
  it("renders the server's own blocker keys as sentences", async () => {
    // ── THE PATH THE PORTAL'S OWN RULES NEVER TAKE ─────────────────────────
    // completionBlockers() emits full `EMPLOYEES.EOS.*` keys, so every test
    // above exercises the mapper's pass-through branch. The SERVER speaks
    // `eos.needsType`, and NOTHING covered that until now — a mutant stripping
    // the prefix survived the whole file while leaving `NEEDS_TYPE` on screen
    // for any refusal the server issues.
    const handler = new CapturingErrorHandler();
    await TestBed.resetTestingModule().configureTestingModule({
      imports: [EmployeeEosComponent, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        { provide: ErrorHandler, useValue: handler },
        {
          provide: EmployeeService,
          useValue: { getOne: () => Promise.resolve(RAIL_EMPLOYEE) },
        },
        {
          provide: EmployeeEosService,
          useValue: {
            get: () => Promise.resolve(POPULATED),
            lastCapabilities: () => ({ available: true, statutoryCalculationsAvailable: false, reason: null }),
            lastOpenAssetCount: () => 0,
            save: () => Promise.resolve({ id: 'eos-1' }),
            complete: () => Promise.resolve({
              blockers: [
                { key: 'eos.needsVisaCancellation', detail: null },
                { key: 'eos.blockedOpenAssets', detail: '3' },
              ],
            }),
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

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', commonEn as any, true);
    translate.setTranslation('en', employeesEn as any, true);
    translate.use('en');

    const fixture = TestBed.createComponent(EmployeeEosComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance.complete();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.eos__card--blockers');
    expect(panel).toBeTruthy();
    const panelText = String(panel.textContent ?? '');

    expect(panelText).toContain('Enter the visa cancellation date');
    expect(panelText).toContain('Company property is still assigned');
    // Nothing that still looks like a key — dotted or bare UPPER_SNAKE.
    expect(panelText).not.toMatch(/[A-Z][A-Z0-9]*_[A-Z0-9_]+/);
    expect(handler.errors).toEqual([]);
  });
});

/**
 * The confirmatory rail.
 *
 * Stubbing `EmployeeService` made the rail POSSIBLE; without these it is still
 * verified nowhere, and a rail that silently stopped rendering would leave
 * every other test green. This is the screen where acting on the wrong person
 * cannot be undone, so "the identity panel is on screen" is a claim worth
 * asserting rather than assuming.
 */
describe('employee EOS tab — the identity rail', () => {
  it('names the employee and the facts that tell two people apart', async () => {
    const { text } = await render({ record: POPULATED });

    expect(text).toContain('Fatima Al-Sayed');
    // The number, the position and the hire date — a name alone does not
    // distinguish two employees who share one.
    expect(text).toContain('E-633648');
    expect(text).toContain('Senior Accountant');
    // dd/mm/yyyy, and the 14th — not the 13th, which is what `new Date()` on a
    // bare ISO day yields west of Greenwich.
    expect(text).toContain('14/07/2025');
  });

  it('still renders the form when the employee lookup fails', async () => {
    // The rail is confirmatory, not functional. Losing it must not cost the
    // user the offboarding screen — which is exactly what folding this fetch
    // into the record's own await once did.
    const { text, errors } = await render({
      record: POPULATED,
      employeeRejects: true,
    });

    expect(text).toContain('End of service details');
    expect(text).not.toContain('E-633648');
    expect(errors).toEqual([]);
  });
});

describe('employee EOS tab — DEGRADED', () => {
  it('renders an empty screen when the endpoint rejects', async () => {
    // TODAY's state on any deployment that has not migrated. The service
    // degrades reads to a blank record, so the tab must show the blank shape
    // rather than an error page or a blank white screen.
    const { fixture, errors, text } = await render({ rejects: true });

    expect(errors).toEqual([]);
    expect(text).toContain('End of service details');
    expectNoUnresolvedKeys(fixture, 'degraded');
  });
});
