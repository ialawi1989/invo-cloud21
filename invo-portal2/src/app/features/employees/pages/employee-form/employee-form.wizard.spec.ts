import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { LanguageService } from '@core/i18n/language.service';
import { FeatureService } from '@core/auth/feature.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { EmployeeOptionsService } from '@core/layout/services/employee-options.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { BranchSettingsService } from '../../../settings/services/branch-settings.service';

import { EmployeeService } from '../../services/employee.service';
import { EmployeePayrollService } from '../../services/employee-payroll.service';
import { EmployeeFieldManifestService } from '../../services/employee-field-manifest.service';
import { EMPLOYEE_FIELD_MANIFEST } from '../../models/employee-field-manifest';
import { EmployeeFormComponent } from './employee-form.component';

/**
 * The add-employee wizard.
 *
 * ── WHAT THESE ACTUALLY GUARD ────────────────────────────────────────────────
 * The wizard's whole structure rests on one thing: step 1 creates the employee
 * and ADOPTS the id the API returns, so steps 2-4 are updates of that record.
 * If the id is not adopted, every later step still posts `id: null` and the
 * server dutifully inserts another employee — four steps, four people, no error
 * anywhere. Nothing about the screen looks wrong while it happens.
 *
 * So the sharp assertion is not "step 1 saved" (a create always saves). It is
 * that the SECOND save carries the id and `formStatus: 'edit'`. That is the
 * only observable that differs between the working and broken versions, which
 * is why it is asserted directly on the payload rather than on the step index.
 *
 * Verified by mutation: dropping the `employeeId.set(newId)` line in `save()`
 * reddens "the second step updates the record step 1 created" on its
 * `formStatus` expectation, while every other test here still passes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

const NEW_ID = 'created-1';

const CURRENT_PAY: any = {
  id: 'pay-1', employeeId: NEW_ID, effectiveFrom: '2025-07-14',
  basicSalary: 950, currency: 'BHD', payFrequency: 'Monthly',
  changeReason: 'AnnualReview', paymentMethod: 'BankTransfer',
  components: [{ type: 'Housing', amount: 220, calculation: 'Fixed' }],
};

function setup(opts: {
  id?: string;
  features?: string[];
  /** The pay revision in force. `null` = none on file. */
  pay?: any;
  /** Put the id on the PARENT route instead, as `/employees/:id/edit` does. */
  parentId?: string;
  section?: string;
} = {}) {
  const save = vi.fn().mockResolvedValue({ success: true, data: { id: NEW_ID } });
  const saveBankDetails = vi.fn().mockResolvedValue({ id: 'bank-1' });
  const recordChange = vi.fn().mockResolvedValue({ id: 'pay-2' });
  // The pay revision the payment METHOD is a column on. Null means there is
  // none, and the method then has nowhere to be stored.
  const current = vi.fn().mockResolvedValue(opts.pay === undefined ? CURRENT_PAY : opts.pay);
  const getOne = vi.fn().mockResolvedValue(
    opts.parentId
      ? {
          id: opts.parentId, name: 'Fatima Al-Sayed', email: 'fatima@example.com', avatar: '',
          admin: false, superAdmin: false, user: true, isDriver: false, isInvitedUser: false,
          branchId: 'br-1', branches: [{ id: 'br-1', name: 'Main' }],
          mediaUrl: { defaultUrl: '' }, mediaId: null, privilegeId: null, privileges: null,
          hasSystemAccess: true, isHrDataOwner: true,
          password: '', passCode: '', MSR: '', base64Image: '', companyId: 'co-1',
          companyGroupId: null, createdAt: '', apply2fa: false, hasPermissionToChange2fa: true,
          resetPasswordDate: null, hireDate: null, terminationDate: null,
        }
      : null,
  );

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [EmployeeFormComponent, TranslateModule.forRoot()],
    providers: [
      {
        provide: EmployeeService,
        useValue: {
          save,
          getOne,
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
      { provide: EmployeePayrollService, useValue: { saveBankDetails, recordChange, current } },
      { provide: LanguageService, useValue: { loadFeature: vi.fn() } },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: ModalService, useValue: { open: vi.fn() } },
      {
        provide: EmployeeOptionsService,
        useValue: { get: vi.fn().mockResolvedValue(null), patch: vi.fn().mockResolvedValue(undefined) },
      },
      { provide: Router, useValue: { navigate: vi.fn() } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            // A child of the record shell declares no `:id` of its own, so its
            // own paramMap is EMPTY — that is the shape the bug hid in.
            paramMap: opts.parentId ? new Map() : new Map([['id', opts.id ?? '0']]),
            queryParamMap: new Map(opts.section ? [['section', opts.section]] : []),
          },
          parent: opts.parentId
            ? { snapshot: { paramMap: new Map([['id', opts.parentId]]), queryParamMap: new Map() } }
            : null,
        },
      },
    ],
  });

  if (opts.features?.length) TestBed.inject(FeatureService).setFeatures(opts.features);

  const fixture = TestBed.createComponent(EmployeeFormComponent);
  return {
    fixture,
    component: fixture.componentInstance,
    save,
    saveBankDetails,
    recordChange,
    current,
    getOne,
    router: TestBed.inject(Router),
  };
}

/**
 * Create the employee, then jump to the payment step.
 *
 * Going through step 1 for real matters: `saveBank` refuses while `isCreate()`
 * is still true, so a test that only called `goToStep` would exercise the early
 * return rather than the post.
 */
async function createThenPayment(ctx: ReturnType<typeof setup>): Promise<void> {
  fillStepOne(ctx.component);
  await ctx.component.saveAndContinue();
  ctx.component.goToStep(ctx.component.steps().length - 1);
}

async function load(fixture: ComponentFixture<EmployeeFormComponent>): Promise<void> {
  fixture.detectChanges();
  await flush();
  await flush();
  fixture.detectChanges();
}

/** The minimum step 1 will accept — a cloud account needs a real email. */
function fillStepOne(component: EmployeeFormComponent): void {
  component.form.patchValue({
    name: 'Fatima Al-Sayed',
    email: 'fatima@example.com',
    password: 'Passw0rd!2026',
    passcode: '4821',
  });
  component.form.markAsDirty();
}

describe('the add-employee wizard', () => {
  it('is on for a new employee and off for an existing one', async () => {
    const create = setup({ id: '0' });
    await load(create.fixture);
    expect(create.component.wizardActive()).toBe(true);

    const edit = setup({ id: 'emp-1' });
    await load(edit.fixture);
    expect(edit.component.wizardActive()).toBe(false);
  });

  it('shows one step at a time', async () => {
    const ctx = setup({ id: '0' });
    await load(ctx.fixture);

    expect(ctx.component.showsSection('basic')).toBe(true);
    expect(ctx.component.showsSection('personal')).toBe(false);

    ctx.component.goToStep(1);
    expect(ctx.component.showsSection('basic')).toBe(false);
    expect(ctx.component.showsSection('personal')).toBe(true);
  });

  it('shows everything at once when editing', async () => {
    const ctx = setup({ id: 'emp-1' });
    await load(ctx.fixture);
    // Not a step index question — the edit page is one page.
    for (const key of ['basic', 'personal', 'employment', 'payment']) {
      expect(ctx.component.showsSection(key)).toBe(true);
    }
  });

  it('refuses to leave step 1 with nothing filled in', async () => {
    const ctx = setup({ id: '0' });
    await load(ctx.fixture);

    await ctx.component.saveAndContinue();

    // Both halves matter: not advancing is the visible symptom, but not
    // POSTING is the one that would otherwise create a nameless employee.
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.component.step()).toBe(0);
  });

  it('saves step 1 and advances', async () => {
    const ctx = setup({ id: '0' });
    await load(ctx.fixture);
    fillStepOne(ctx.component);

    await ctx.component.saveAndContinue();

    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.save.mock.calls[0][0]).toMatchObject({ id: null, formStatus: 'new' });
    expect(ctx.component.step()).toBe(1);
  });

  it('the second step UPDATES the record step 1 created', async () => {
    // The test this file exists for. A wizard that re-creates on every step
    // passes every other assertion here.
    const ctx = setup({ id: '0' });
    await load(ctx.fixture);
    fillStepOne(ctx.component);

    await ctx.component.saveAndContinue();   // step 1 → creates
    await ctx.component.saveAndContinue();   // step 2 → must update

    expect(ctx.save).toHaveBeenCalledTimes(2);
    const second = ctx.save.mock.calls[1][0];
    expect(second.formStatus).toBe('edit');
    expect(second.id).toBe(NEW_ID);
  });

  it('does not advance when the save is refused', async () => {
    const ctx = setup({ id: '0' });
    await load(ctx.fixture);
    fillStepOne(ctx.component);
    ctx.save.mockResolvedValueOnce({ success: false, msg: 'Employee Email Already Exist' });

    await ctx.component.saveAndContinue();

    // Advancing here would strand the user on step 2 editing a record that was
    // never created, and every later save would fail the same way.
    expect(ctx.component.step()).toBe(0);
  });

  it('lets Skip move on without posting anything', async () => {
    const ctx = setup({ id: '0' });
    await load(ctx.fixture);
    fillStepOne(ctx.component);
    await ctx.component.saveAndContinue();
    ctx.save.mockClear();

    ctx.component.skipStep();

    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.component.step()).toBe(2);
  });

  it('remembers the furthest step reached, so Back does not lock the way forward', async () => {
    const ctx = setup({ id: '0' });
    await load(ctx.fixture);

    ctx.component.goToStep(2);
    ctx.component.back();

    expect(ctx.component.step()).toBe(1);
    expect(ctx.component.furthestStep()).toBe(2);
  });

  it('offers the payment step only with the payroll module on', async () => {
    const without = setup({ id: '0' });
    await load(without.fixture);
    expect(without.component.steps().map((s) => s.key)).toEqual(['basic', 'personal', 'employment']);

    const withPayroll = setup({ id: '0', features: ['hr.payroll'] });
    await load(withPayroll.fixture);
    expect(withPayroll.component.steps().map((s) => s.key)).toContain('payment');
  });

  // ── Bank details, step 4 ────────────────────────────────────────────────
  // `saveBank` has three early returns and they are not interchangeable:
  // no id / still creating, not paying to a bank, and nothing typed. A test
  // that only walked the happy path would pass with any of the three deleted,
  // so each has its own case and its own inverse.
  describe('the payment step', () => {
    it('posts the account when paying by bank transfer', async () => {
      const ctx = setup({ id: '0', features: ['hr.payroll'] });
      await load(ctx.fixture);
      await createThenPayment(ctx);

      ctx.component.selectPaymentMethod('BankTransfer');
      ctx.component.bankForm.patchValue({
        bankName: 'Bank of Bahrain and Kuwait',
        accountHolderName: 'Fatima Al-Sayed',
        iban: 'BH67BMAG00001299123456',
      });
      ctx.component.bankForm.markAsDirty();

      await ctx.component.saveAndContinue();

      expect(ctx.saveBankDetails).toHaveBeenCalledTimes(1);
      // The id is the whole point: an account posted against the wrong
      // employee redirects someone else's salary.
      expect(ctx.saveBankDetails.mock.calls[0][0]).toMatchObject({
        employeeId: NEW_ID,
        iban: 'BH67BMAG00001299123456',
      });
    });

    it('posts nothing when they are paid in cash', async () => {
      const ctx = setup({ id: '0', features: ['hr.payroll'] });
      await load(ctx.fixture);
      await createThenPayment(ctx);

      // Typed first, THEN switched to cash — so passing requires the method
      // check, not merely an untouched form. Without it a stale IBAN from a
      // changed mind would be saved against someone paid in notes.
      ctx.component.bankForm.patchValue({ iban: 'BH67BMAG00001299123456' });
      ctx.component.bankForm.markAsDirty();
      ctx.component.selectPaymentMethod('Cash');

      await ctx.component.saveAndContinue();

      expect(ctx.saveBankDetails).not.toHaveBeenCalled();
    });

    it('posts nothing when the form was never touched', async () => {
      const ctx = setup({ id: '0', features: ['hr.payroll'] });
      await load(ctx.fixture);
      await createThenPayment(ctx);

      // Bank transfer is the default, so without the pristine check every
      // employee would get an empty account row written on finish.
      await ctx.component.saveAndContinue();

      expect(ctx.saveBankDetails).not.toHaveBeenCalled();
    });

    it('stays on the step when the account is refused', async () => {
      const ctx = setup({ id: '0', features: ['hr.payroll'] });
      await load(ctx.fixture);
      await createThenPayment(ctx);
      const last = ctx.component.step();

      ctx.component.bankForm.patchValue({ iban: 'not-an-iban' });
      ctx.component.bankForm.markAsDirty();
      ctx.saveBankDetails.mockRejectedValueOnce(new Error('That IBAN is not valid'));

      await ctx.component.saveAndContinue();

      // Leaving for the list here would report success for a save the server
      // rejected, and the user would never learn the account is missing.
      expect(ctx.component.step()).toBe(last);
      expect(ctx.router.navigate).not.toHaveBeenCalledWith(['/employees']);
    });
  });

  // ── The focused editor, at /employees/:id/edit ──────────────────────────
  describe('a focused edit reached from the overview', () => {
    it('finds the id on the PARENT route and loads the record', async () => {
      // The regression this describes: `:id` belongs to the record shell, and
      // Angular does not inherit params into a child of a component-bearing
      // route. Reading only the child's paramMap returned null, so the form
      // believed it was creating — it fetched nothing and showed the wizard.
      const ctx = setup({ parentId: 'emp-77', section: 'personal' });
      await load(ctx.fixture);

      expect(ctx.getOne).toHaveBeenCalledWith('emp-77');
      expect(ctx.component.employeeId()).toBe('emp-77');
      expect(ctx.component.isCreate()).toBe(false);
    });

    it('is not a wizard', async () => {
      // The visible half of the same bug, asserted separately: `wizardActive`
      // is captured from `isCreate()`, so a null id turned an edit into a
      // four-step create over somebody who already exists.
      const ctx = setup({ parentId: 'emp-77', section: 'personal' });
      await load(ctx.fixture);

      expect(ctx.component.wizardActive()).toBe(false);
    });

    it('narrows to the requested section and nothing else', async () => {
      const ctx = setup({ parentId: 'emp-77', section: 'personal' });
      await load(ctx.fixture);

      expect(ctx.component.editSection()).toBe('personal');
      expect(ctx.component.showsSection('personal')).toBe(true);
      expect(ctx.component.showsSection('basic')).toBe(false);
    });

    it('returns to the record, not the list', async () => {
      const ctx = setup({ parentId: 'emp-77', section: 'personal' });
      await load(ctx.fixture);

      ctx.component.cancel();

      expect(ctx.router.navigate).toHaveBeenCalledWith(['/employees', 'emp-77']);
    });
  });

  /**
   * Changing how an existing employee is paid.
   *
   * This is the screen the bug was found on — `/employees/:id/edit?section=
   * payment`, not the wizard. `paymentMethod` is a column on the PAY REVISION,
   * so it goes to `savePayroll`; posting it to `saveBankDetails` (which has no
   * such column) dropped it, and picking Cash skipped that call entirely, so
   * nothing whatsoever was written.
   */
  describe('changing the payment method on an existing employee', () => {
    const editPayment = () =>
      setup({ parentId: 'emp-77', section: 'payment', features: ['hr.payroll'] });

    it('records a CASH choice, and writes no account', async () => {
      const ctx = editPayment();
      await load(ctx.fixture);

      ctx.component.selectPaymentMethod('Cash');
      await ctx.component.save();

      expect(ctx.saveBankDetails).not.toHaveBeenCalled();
      expect(ctx.recordChange).toHaveBeenCalledTimes(1);
      const sent = ctx.recordChange.mock.calls[0][0];
      expect(sent.paymentMethod).toBe('Cash');
      // Carried forward, never restated: changing the method must not move
      // anybody's salary.
      expect(sent.basicSalary).toBe(950);
      expect(sent.currency).toBe('BHD');
    });

    it('writes no revision when the method did not change', async () => {
      // Seeded from the record as BankTransfer. Re-picking it must not
      // manufacture a revision that changes nothing — pay history is read by
      // humans, and a row saying "Correction" that corrects nothing is noise.
      const ctx = editPayment();
      await load(ctx.fixture);

      ctx.component.selectPaymentMethod('BankTransfer');
      await ctx.component.save();

      expect(ctx.recordChange).not.toHaveBeenCalled();
    });

    it('cannot store a method when the employee has no pay on file', async () => {
      // Nowhere to put it: the column lives on the revision. The step says so
      // rather than accepting a choice it is going to drop.
      const ctx = setup({
        parentId: 'emp-77', section: 'payment', features: ['hr.payroll'], pay: null,
      });
      await load(ctx.fixture);

      expect(ctx.component.canStoreMethod()).toBe(false);

      ctx.component.selectPaymentMethod('Cheque');
      await ctx.component.save();

      expect(ctx.recordChange).not.toHaveBeenCalled();
    });
  });

  it('leaves the list for the record when a focused edit finishes', async () => {
    // `?section=` is absent from this route stub, so this is the plain edit
    // form and Cancel returns to the list — the control for the case below.
    const ctx = setup({ id: 'emp-1' });
    await load(ctx.fixture);

    ctx.component.cancel();

    expect(ctx.router.navigate).toHaveBeenCalledWith(['/employees']);
  });
});

describe('required stays strict for the whole wizard', () => {
  /*
   * ── THE HOLE THIS CLOSES ───────────────────────────────────────────────────
   * `requiredMode` used to read `isCreate()`, which flips to FALSE the moment
   * step 1 persists the record. Steps 2-4 of the ADD flow then validated as
   * ordinary edits, where `required` is advisory — so nationality, date of
   * birth and the rest of the personal step were never enforced on anybody,
   * on the one screen whose whole job is to collect them.
   *
   * Measured on dev 2026-08-24: 292 employees with a company, ONE with a
   * nationality, a field the manifest has marked `required` since phase 1.
   *
   * Nationality is the sharp case rather than a representative one: social
   * insurance is selected by it, and the scheme has three tiers, so a blank is
   * not a blank field on a form — it is a contribution the engine cannot
   * compute and must either refuse or guess.
   * See docs/reference/gosi-bahrain.md.
   */

  it('is strict AFTER step 1 has saved and isCreate() has flipped', async () => {
    const ctx = setup({ id: '0', features: ['hr.profile'] });
    await load(ctx.fixture);

    expect(ctx.component.requiredMode()).toBe('strict');

    fillStepOne(ctx.component);
    await ctx.component.saveAndContinue();
    await flush();

    // The precondition. Without this the assertion below could pass because
    // the record never saved, which is a different test passing by accident.
    expect(ctx.component.isCreate()).toBe(false);
    expect(ctx.component.requiredMode()).toBe('strict');
  });

  it('will not let the wizard finish while nationality is blank', async () => {
    // `hr.profile` is what puts the manifest groups on the form at all; without
    // it there is no nationality control to assert about.
    const ctx = setup({ id: '0', features: ['hr.profile'] });
    await load(ctx.fixture);
    fillStepOne(ctx.component);
    await ctx.component.saveAndContinue();
    await flush();

    const nationality = ctx.component.form.get('profile.nationality');
    expect(nationality).toBeTruthy();

    nationality!.setValue('');
    nationality!.updateValueAndValidity();
    expect(nationality!.valid).toBe(false);

    nationality!.setValue('OM');
    nationality!.updateValueAndValidity();
    expect(nationality!.valid).toBe(true);
  });

  it('leaves an EXISTING record lenient', async () => {
    // The regression this must not cause: an admin changing a pass code on a
    // record that predates the manifest is not asked for a nationality.
    const ctx = setup({ parentId: 'emp-1' });
    await load(ctx.fixture);

    expect(ctx.component.wizardActive()).toBe(false);
    expect(ctx.component.requiredMode()).toBe('lenient');
  });
});
