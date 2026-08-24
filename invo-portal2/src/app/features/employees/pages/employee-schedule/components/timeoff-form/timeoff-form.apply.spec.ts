import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ToastService } from '@shared/components/toast/toast.service';
import { FeatureService } from '@core/auth/feature.service';

import { EmployeeService } from '../../../../services/employee.service';
import { TimeoffFormComponent } from './timeoff-form.component';

/**
 * The verb on the button, and why it changes.
 *
 * A company WITH the HR leave module has a second authority: the board raises,
 * HR decides, and the server stores the entry as `Pending`. Labelling that
 * button "Save" tells the supervisor the matter is settled when it is not —
 * the screen would be claiming an authority the request does not have.
 *
 * A company WITHOUT the module has nobody else to approve anything. There the
 * supervisor's decision IS the decision, and "Apply" would be a lie in the
 * other direction.
 *
 * ── ASSERTED AS A PAIR ───────────────────────────────────────────────────────
 * Either case alone passes under a constant. The last test is the one a
 * constant cannot satisfy.
 */

function setup(features: string[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TimeoffFormComponent, TranslateModule.forRoot()],
    providers: [
      { provide: MODAL_DATA, useValue: { employees: [], employee: null, day: null } },
      { provide: MODAL_REF, useValue: { close: vi.fn() } },
      { provide: EmployeeService, useValue: { saveEmployeeOffDay: vi.fn() } },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  });
  TestBed.inject(FeatureService).setFeatures(features);
  return TestBed.createComponent(TimeoffFormComponent).componentInstance;
}

describe('time-off form — apply or save', () => {
  it('says APPLY when the company owns the HR leave module', () => {
    const c = setup(['hr', 'hr.leave']);
    expect(c.needsApproval()).toBe(true);
    expect(c.actionLabelKey()).toBe('EMPLOYEES.SCHEDULE.APPLY');
  });

  it('says SAVE when it does not', () => {
    const c = setup(['hr']);
    expect(c.needsApproval()).toBe(false);
    expect(c.actionLabelKey()).toBe('COMMON.SAVE');
  });

  it('reads `hr.leave` specifically, not `hr`', () => {
    // A company can own the HR module without the leave feature. Matching on
    // the prefix would put a supervisor in front of an approval queue that
    // does not exist.
    const c = setup(['hr', 'hr.documents', 'hr.assets']);
    expect(c.needsApproval()).toBe(false);
  });

  it('the two answers DIFFER', () => {
    // The assertion a constant cannot satisfy: an implementation returning
    // 'APPLY' always passes the first test, one returning 'COMMON.SAVE'
    // always passes the second, and either would be a screen that lies about
    // who decides.
    const withHr = setup(['hr.leave']).actionLabelKey();
    const withoutHr = setup([]).actionLabelKey();
    expect(withHr).not.toBe(withoutHr);
  });
});
