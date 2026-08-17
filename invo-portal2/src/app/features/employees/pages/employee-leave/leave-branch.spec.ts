import { ErrorHandler, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

import employeesEn from '../../i18n/en.json';
import commonEn from '../../../../../../public/i18n/en.json';

import { EmployeeLeaveService } from '../../services/employee-leave.service';
import { EmployeeFileService } from '../../services/employee-file.service';
import { BranchSettingsService } from '../../../settings/services/branch-settings.service';
// THE REAL rule, imported from the component that uses it. A local copy would
// pass while the component did something else — the failure this file exists
// to prevent elsewhere.
import { EmployeeLeaveComponent, branchForSuggestion } from './employee-leave.component';

/**
 * Which branch a leave request's holidays come from, and what the disclaimer
 * does about it.
 */

describe('branchForSuggestion — the request decides, never the employee', () => {
  it('sends the branch on the request', () => {
    expect(branchForSuggestion({ branchId: 'branch-a' })).toBe('branch-a');
  });

  it('sends NOTHING when the request has no branch', () => {
    // The conservative direction, already correct server-side: no branchId
    // means "cannot tell", which keeps the count unchanged and the disclaimer
    // up.
    //
    // Mutant: `form.branchId ?? employee.branchId` — compiles, runs, reddens
    // here. That is the live danger: Employees.branchId comes from branches[0],
    // so a leave-day count would start depending on array order.
    expect(branchForSuggestion({ branchId: null })).toBeUndefined();
  });

  it('does not turn an absent branch into an empty string', () => {
    // '' would be sent as `&branchId=`, which the server reads as a real (and
    // unmatchable) id rather than as "not supplied".
    expect(branchForSuggestion({ branchId: null })).not.toBe('');
  });
});

// ─── The disclaimer, rendered ────────────────────────────────────────────────

class CapturingErrorHandler implements ErrorHandler {
  readonly errors: unknown[] = [];
  handleError(error: unknown): void { this.errors.push(error); }
}

const REJECT = () => Promise.reject(new Error('endpoint does not exist'));

async function renderLeave(excludesPublicHolidays: boolean) {
  const handler = new CapturingErrorHandler();
  /** Every branchId the component asked the server about, in order. */
  const askedBranches: (string | undefined)[] = [];

  await TestBed.resetTestingModule().configureTestingModule({
    imports: [EmployeeLeaveComponent, TranslateModule.forRoot()],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideRouter([]),
      { provide: ErrorHandler, useValue: handler },
      {
        provide: EmployeeLeaveService,
        useValue: {
          requests: () => Promise.resolve([]),
          balance: () => Promise.resolve({
            entitlementDays: '20', usedDays: '0', remainingDays: '20',
            openingBalance: '0', carryOverDays: '0', byType: [],
          }),
          profile: REJECT,
          fileCatalog: REJECT,
          catalog: (_range?: unknown, branchId?: string) => {
            askedBranches.push(branchId);
            return Promise.resolve({
              types: [], statuses: [], yearStarts: [], suggestedDays: 4,
              // ── THE ONLY THING THAT VARIES BETWEEN THE TWO CASES ────────
              suggestionExcludesPublicHolidays: excludesPublicHolidays,
            });
          },
        },
      },
      { provide: EmployeeFileService, useValue: { catalog: REJECT } },
      { provide: BranchSettingsService, useValue: { getList: () => Promise.resolve({ list: [] }) } },
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

  const fixture = TestBed.createComponent(EmployeeLeaveComponent);
  fixture.detectChanges();
  // ── ONE whenStable() IS NOT ENOUGH HERE ─────────────────────────────────
  // `load()` awaits a Promise.all of five calls and then sets signals, so the
  // first stable point is still mid-load. Asserting there caught the component
  // rendering "Loading..." and would have reported a missing caveat that was
  // simply not rendered yet — a false red that a `.not.toContain` case would
  // have turned into a false GREEN.
  for (let i = 0; i < 5; i++) {
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }

  return {
    fixture,
    component: fixture.componentInstance,
    askedBranches,
    errors: handler.errors,
    text: String((fixture.nativeElement as HTMLElement).textContent ?? ''),
  };
}

/** The English of `EMPLOYEES.LEAVE.EXCLUDES_HOLIDAYS_BALANCE`, in the bundle. */
const CAVEAT = (employeesEn as any).EMPLOYEES.LEAVE.EXCLUDES_HOLIDAYS_BALANCE as string;

describe('the holiday disclaimer follows the SERVER, both ways', () => {
  it('RENDERS the caveat when the server says holidays were NOT excluded', async () => {
    // `suggestionExcludesPublicHolidays: true` — a request with no branch, or a
    // branch with no calendar. This is the assertion the naming trap needs:
    // someone who "fixes" the apparently-inverted flag removes this text while
    // the arithmetic stays wrong, and nothing else would notice.
    const { errors, text } = await renderLeave(true);

    expect(errors).toEqual([]);
    expect(CAVEAT.length).toBeGreaterThan(0);
    expect(text).toContain(CAVEAT);
  });

  it('does NOT render it when the server says they WERE excluded', async () => {
    // The inverse, and the pair is the point: a template that always showed the
    // caveat satisfies the case above and disclaims forever; one that never
    // showed it satisfies this case and hides a count that is genuinely high.
    const { errors, text } = await renderLeave(false);

    expect(errors).toEqual([]);
    expect(text).not.toContain(CAVEAT);
  });
});

describe('the component ASKS the server about the request branch', () => {
  it('passes the form branch through to catalog()', async () => {
    // ── ASSERTED AT THE CALL SITE, NOT ONLY ON THE PURE RULE ──────────────
    // branchForSuggestion() is covered above, but a mutant that stopped
    // PASSING its result to the service survived all of it: the rule was right
    // and nobody used it. This drives the real refreshSuggestion() and asserts
    // what the service actually received.
    const { component, askedBranches } = await renderLeave(false);
    askedBranches.length = 0;

    component.form.patchValue({
      startDate: '2026-08-02', endDate: '2026-08-06', branchId: 'branch-a',
    });
    await component.refreshSuggestion();

    expect(askedBranches).toEqual(['branch-a']);
  });

  it('asks with NO branch when the request has none', async () => {
    // The inverse. A mutant hardcoding a branch satisfies the case above and
    // fails here — and that mutant is the dangerous one, because it would send
    // some other branch's holidays for every request that never chose one.
    const { component, askedBranches } = await renderLeave(true);
    askedBranches.length = 0;

    component.form.patchValue({
      startDate: '2026-08-02', endDate: '2026-08-06', branchId: null,
    });
    await component.refreshSuggestion();

    expect(askedBranches).toEqual([undefined]);
  });
});
