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
 * The employee form, back to a single page.
 *
 * This form was briefly a four-step wizard; the stakeholder asked for it back
 * as one scrollable page with one Save. These tests cover what that means in
 * practice:
 *  - creating a brand-new employee is ONE save, not a sequence gated by steps;
 *  - bank details (a separate endpoint) still get posted on that same create,
 *    which only works if the employee id returned by the first call is
 *    adopted BEFORE the bank save is attempted — the ordering bug a wizard
 *    could never have surfaced, because there the bank step ran strictly
 *    after the id-adopting step had already completed;
 *  - validation surfaces across the WHOLE form on submit, not gated by step;
 *  - the `?section=` focused single-card edit (from the record overview) is
 *    untouched by any of this.
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

async function load(fixture: ComponentFixture<EmployeeFormComponent>): Promise<void> {
  fixture.detectChanges();
  await flush();
  await flush();
  fixture.detectChanges();
}

/** The minimum the top-of-page fields will accept — a cloud account needs a
 *  real email. */
function fillRequiredFields(component: EmployeeFormComponent): void {
  component.form.patchValue({
    name: 'Fatima Al-Sayed',
    email: 'fatima@example.com',
    password: 'Passw0rd!2026',
    passcode: '4821',
  });
  component.form.markAsDirty();
}

describe('the employee form is one page', () => {
  it('shows every section together, for a new employee and an existing one alike', async () => {
    const create = setup({ id: '0' });
    await load(create.fixture);
    for (const key of ['basic', 'personal', 'employment', 'payment']) {
      expect(create.component.showsSection(key)).toBe(true);
    }

    const edit = setup({ id: 'emp-1' });
    await load(edit.fixture);
    for (const key of ['basic', 'personal', 'employment', 'payment']) {
      expect(edit.component.showsSection(key)).toBe(true);
    }
  });

  it('refuses to save with nothing filled in', async () => {
    const ctx = setup({ id: '0' });
    await load(ctx.fixture);

    await ctx.component.save();

    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('creates a new employee with a single save call', async () => {
    const ctx = setup({ id: '0' });
    await load(ctx.fixture);
    fillRequiredFields(ctx.component);

    const ok = await ctx.component.save();

    expect(ok).toBe(true);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.save.mock.calls[0][0]).toMatchObject({ id: null, formStatus: 'new' });
    expect(ctx.router.navigate).toHaveBeenCalledWith(['/employees']);
  });

  it('does not navigate away when the save is refused', async () => {
    const ctx = setup({ id: '0' });
    await load(ctx.fixture);
    fillRequiredFields(ctx.component);
    ctx.save.mockResolvedValueOnce({ success: false, msg: 'Employee Email Already Exist' });

    const ok = await ctx.component.save();

    expect(ok).toBe(false);
    expect(ctx.router.navigate).not.toHaveBeenCalled();
  });

  it('offers the payment section only with the payroll module on', async () => {
    const without = setup({ id: '0' });
    await load(without.fixture);
    expect(without.component.canEditBank()).toBe(false);

    const withPayroll = setup({ id: '0', features: ['hr.payroll'] });
    await load(withPayroll.fixture);
    expect(withPayroll.component.canEditBank()).toBe(true);
  });

  // ── Bank details on the SAME save as the create ─────────────────────────
  // Bank details post to a different endpoint than the employee record, and
  // that endpoint needs a real employee id. On a brand-new employee the id
  // only exists once `save()`'s own EmployeeService call returns it — so the
  // bank post has to run AFTER that id is adopted onto the component, in the
  // very same submit. A wizard never had to get this right, because its
  // payment step ran as an independent, later save against an id that had
  // already landed.
  describe('bank details, saved alongside a brand-new employee', () => {
    it('posts the account once the new id has been adopted', async () => {
      const ctx = setup({ id: '0', features: ['hr.payroll'] });
      await load(ctx.fixture);
      fillRequiredFields(ctx.component);

      ctx.component.selectPaymentMethod('BankTransfer');
      ctx.component.bankForm.patchValue({
        bankName: 'Bank of Bahrain and Kuwait',
        accountHolderName: 'Fatima Al-Sayed',
        iban: 'BH67BMAG00001299123456',
      });
      ctx.component.bankForm.markAsDirty();

      await ctx.component.save();

      expect(ctx.saveBankDetails).toHaveBeenCalledTimes(1);
      // The id is the whole point: posted against the freshly created
      // employee, not against null / undefined.
      expect(ctx.saveBankDetails.mock.calls[0][0]).toMatchObject({
        employeeId: NEW_ID,
        iban: 'BH67BMAG00001299123456',
      });
    });

    it('posts nothing when they are paid in cash', async () => {
      const ctx = setup({ id: '0', features: ['hr.payroll'] });
      await load(ctx.fixture);
      fillRequiredFields(ctx.component);

      ctx.component.bankForm.patchValue({ iban: 'BH67BMAG00001299123456' });
      ctx.component.bankForm.markAsDirty();
      ctx.component.selectPaymentMethod('Cash');

      await ctx.component.save();

      expect(ctx.saveBankDetails).not.toHaveBeenCalled();
    });

    it('posts nothing when the payment card was never touched', async () => {
      const ctx = setup({ id: '0', features: ['hr.payroll'] });
      await load(ctx.fixture);
      fillRequiredFields(ctx.component);

      await ctx.component.save();

      expect(ctx.saveBankDetails).not.toHaveBeenCalled();
    });

    it('reports failure and does not navigate when the account is refused', async () => {
      const ctx = setup({ id: '0', features: ['hr.payroll'] });
      await load(ctx.fixture);
      fillRequiredFields(ctx.component);

      ctx.component.bankForm.patchValue({ iban: 'not-an-iban' });
      ctx.component.bankForm.markAsDirty();
      ctx.saveBankDetails.mockRejectedValueOnce(new Error('That IBAN is not valid'));

      const ok = await ctx.component.save();

      // The employee record itself was created — the account failed
      // afterwards — so leaving for the list here would report success for a
      // save that only half-happened.
      expect(ok).toBe(false);
      expect(ctx.router.navigate).not.toHaveBeenCalled();
    });
  });

  // ── The focused editor, at /employees/:id/edit ──────────────────────────
  // Untouched by the wizard→single-page change: a separate, still-wanted
  // feature reached from the record overview's per-section pencil.
  describe('a focused edit reached from the overview', () => {
    it('finds the id on the PARENT route and loads the record', async () => {
      // The regression this describes: `:id` belongs to the record shell, and
      // Angular does not inherit params into a child of a component-bearing
      // route. Reading only the child's paramMap returned null, so the form
      // believed it was creating.
      const ctx = setup({ parentId: 'emp-77', section: 'personal' });
      await load(ctx.fixture);

      expect(ctx.getOne).toHaveBeenCalledWith('emp-77');
      expect(ctx.component.employeeId()).toBe('emp-77');
      expect(ctx.component.isCreate()).toBe(false);
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
   * `/employees/:id/edit?section=payment`. `paymentMethod` is a column on the
   * PAY REVISION, so it goes to `savePayroll`; posting it to `saveBankDetails`
   * (which has no such column) dropped it, and picking Cash skipped that call
   * entirely, so nothing whatsoever was written.
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
      // manufacture a revision that changes nothing.
      const ctx = editPayment();
      await load(ctx.fixture);

      ctx.component.selectPaymentMethod('BankTransfer');
      await ctx.component.save();

      expect(ctx.recordChange).not.toHaveBeenCalled();
    });

    it('cannot store a method when the employee has no pay on file', async () => {
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
    const ctx = setup({ id: 'emp-1' });
    await load(ctx.fixture);

    ctx.component.cancel();

    expect(ctx.router.navigate).toHaveBeenCalledWith(['/employees']);
  });
});

describe('required stays strict throughout create, lenient on an existing record', () => {
  it('is strict while creating', async () => {
    const ctx = setup({ id: '0', features: ['hr.profile'] });
    await load(ctx.fixture);

    expect(ctx.component.requiredMode()).toBe('strict');
  });

  it('will not let a create save while nationality is blank', async () => {
    // `hr.profile` is what puts the manifest groups on the form at all; without
    // it there is no nationality control to assert about.
    const ctx = setup({ id: '0', features: ['hr.profile'] });
    await load(ctx.fixture);

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

    expect(ctx.component.isCreate()).toBe(false);
    expect(ctx.component.requiredMode()).toBe('lenient');
  });
});
