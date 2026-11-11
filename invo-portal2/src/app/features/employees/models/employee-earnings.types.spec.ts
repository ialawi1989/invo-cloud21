import { describe, expect, it } from 'vitest';

import { companySavePayload, isEmployeeEarningsEnabled } from '@core/auth/employee-earnings';
import {
  EmployeeCommissionOptions,
  EmployeeTipOptions,
  PayableRecord,
  PayoutLine,
  buildPayoutLines,
  payoutTotal,
  splitEvenly,
  toPayoutLinesPayload,
} from './employee-earnings.types';

function record(init: Partial<PayableRecord>): PayableRecord {
  return {
    source: 'commission',
    id: 'c1',
    status: 'Earned',
    invoiceNumber: 'INV-1001',
    date: '2026-08-12',
    description: 'Hair colour',
    outstandingAmount: 5,
    lastEarnedDate: '2026-08-20',
    preselected: true,
    ...init,
  };
}

describe('Employee payout lines', () => {
  it('ticks pre-selected rows and fills Pay with the outstanding balance', () => {
    const [a, b] = buildPayoutLines([
      record({ id: 'a', preselected: true, outstandingAmount: 5 }),
      record({ id: 'b', preselected: false, outstandingAmount: 3 }),
    ]);
    expect(a.selected).toBe(true);
    expect(a.amount).toBe(5);
    expect(b.selected).toBe(false);
    expect(b.amount).toBe(3);
  });

  it('accepts a positive amount above 0 and up to the outstanding balance', () => {
    const line = new PayoutLine(record({ outstandingAmount: 5 }));
    line.amount = 5;
    expect(line.amountError).toBeNull();
    line.amount = 0.5;
    expect(line.amountError).toBeNull();
    line.amount = 5.001;
    expect(line.amountError).toBe('EMPLOYEE_PAYOUT.ERRORS.AMOUNT_RANGE');
    line.amount = 0;
    expect(line.amountError).toBe('EMPLOYEE_PAYOUT.ERRORS.AMOUNT_RANGE');
  });

  it('accepts an offset below 0 and not beyond the negative balance', () => {
    const line = new PayoutLine(record({ outstandingAmount: -1.25, status: 'Overpaid' }));
    expect(line.isOffset).toBe(true);
    line.amount = -1.25;
    expect(line.amountError).toBeNull();
    line.amount = -0.5;
    expect(line.amountError).toBeNull();
    line.amount = -2;
    expect(line.amountError).toBe('EMPLOYEE_PAYOUT.ERRORS.OFFSET_RANGE');
    line.amount = 0;
    expect(line.amountError).toBe('EMPLOYEE_PAYOUT.ERRORS.OFFSET_RANGE');
  });

  it('flags an empty amount', () => {
    const line = new PayoutLine(record({ outstandingAmount: 5 }));
    line.amount = null;
    expect(line.amountError).toBe('EMPLOYEE_PAYOUT.ERRORS.AMOUNT_NOT_NUMBER');
  });

  it('does not check unticked rows', () => {
    const line = new PayoutLine(record({ outstandingAmount: 5 }));
    line.selected = false;
    line.amount = 999;
    expect(line.amountError).toBeNull();
  });

  it('totals the ticked rows, offsets included', () => {
    const lines = buildPayoutLines([
      record({ id: 'a', outstandingAmount: 5 }),
      record({ id: 'b', outstandingAmount: 3, preselected: false }),
      record({ id: 'c', outstandingAmount: -1.25 }),
    ]);
    expect(payoutTotal(lines)).toBe(3.75);
  });

  it('sends only ticked rows as source, sourceId and amount', () => {
    const lines = buildPayoutLines([
      record({ id: 'a', outstandingAmount: 5 }),
      record({ id: 'b', outstandingAmount: 3, preselected: false }),
      record({ id: 't', source: 'tip', outstandingAmount: 2 }),
    ]);
    expect(toPayoutLinesPayload(lines)).toEqual([
      { source: 'commission', sourceId: 'a', amount: 5 },
      { source: 'tip', sourceId: 't', amount: 2 },
    ]);
  });

  describe('when editing a payout', () => {
    it("adds the payout's own amount back to a row still in the payables", () => {
      const [line] = buildPayoutLines(
        [record({ id: 'a', outstandingAmount: 2, preselected: false })],
        [{ source: 'commission', sourceId: 'a', amount: 3 }]
      );
      expect(line.record.outstandingAmount).toBe(5);
      expect(line.selected).toBe(true);
      expect(line.amount).toBe(3);
    });

    it('rebuilds a row the payout paid in full', () => {
      const lines = buildPayoutLines(
        [],
        [{ source: 'tip', sourceId: 't', amount: 4, invoiceNumber: 'INV-1002', date: '2026-09-01', description: 'Tip' }]
      );
      expect(lines.length).toBe(1);
      expect(lines[0].record.source).toBe('tip');
      expect(lines[0].record.id).toBe('t');
      expect(lines[0].record.outstandingAmount).toBe(4);
      expect(lines[0].selected).toBe(true);
      expect(lines[0].amount).toBe(4);
    });

    it("leaves rows the payout didn't pay unticked, even when pre-selected", () => {
      const lines = buildPayoutLines(
        [record({ id: 'a', outstandingAmount: 2 }), record({ id: 'b', outstandingAmount: 3, preselected: true })],
        [{ source: 'commission', sourceId: 'a', amount: 1 }]
      );
      expect(lines.find((l) => l.record.id === 'b')?.selected).toBe(false);
    });
  });
});

describe('splitEvenly (pool tip preview)', () => {
  it('gives the rounding remainder to the first employees, one smallest unit each', () => {
    expect(splitEvenly(10, 3, 3)).toEqual([3.334, 3.333, 3.333]);
    expect(splitEvenly(0.005, 3, 3)).toEqual([0.002, 0.002, 0.001]);
  });

  it('splits exactly when it divides evenly', () => {
    expect(splitEvenly(9, 3, 3)).toEqual([3, 3, 3]);
  });

  it('keeps the sign of a negative total', () => {
    expect(splitEvenly(-10, 3, 3)).toEqual([-3.334, -3.333, -3.333]);
  });

  it('respects the company decimal places', () => {
    expect(splitEvenly(10, 3, 2)).toEqual([3.34, 3.33, 3.33]);
  });

  it('returns nothing without employees', () => {
    expect(splitEvenly(10, 0, 3)).toEqual([]);
  });
});

function options(init: Partial<EmployeeCommissionOptions>): EmployeeCommissionOptions {
  const o = new EmployeeCommissionOptions();
  Object.assign(o, init);
  return o;
}

describe('EmployeeCommissionOptions', () => {
  describe('effectiveDefault', () => {
    it('is after the return period when the company has one', () => {
      expect(EmployeeCommissionOptions.effectiveDefault(14).eligibilityType).toBe('after_return_period');
    });

    it('is immediate without a return period', () => {
      expect(EmployeeCommissionOptions.effectiveDefault(0).eligibilityType).toBe('immediate');
      expect(EmployeeCommissionOptions.effectiveDefault(null).eligibilityType).toBe('immediate');
    });

    it('uses the monthly cycle', () => {
      expect(EmployeeCommissionOptions.effectiveDefault(0).paymentCycle).toBe('monthly');
    });
  });

  describe('validate', () => {
    it('needs an eligibility type', () => {
      expect(options({ eligibilityType: null }).validate(0)).toBe('COMMISSION_SETTINGS.ERRORS.ELIGIBILITY_REQUIRED');
    });

    it('needs whole days of at least 1 for days after sale', () => {
      for (const days of [null, 0, 1.5]) {
        expect(options({ eligibilityType: 'days_after_sale', eligibilityDays: days }).validate(0))
          .toBe('COMMISSION_SETTINGS.ERRORS.DAYS_INVALID');
      }
      expect(options({ eligibilityType: 'days_after_sale', eligibilityDays: 3 }).validate(0)).toBeNull();
    });

    it('refuses after the return period when the company has none', () => {
      expect(options({ eligibilityType: 'after_return_period' }).validate(0))
        .toBe('COMMISSION_SETTINGS.ERRORS.NO_RETURN_PERIOD');
      expect(options({ eligibilityType: 'after_return_period' }).validate(7)).toBeNull();
    });

    it('needs a start date for weekly and biweekly cycles only', () => {
      expect(options({ eligibilityType: 'immediate', paymentCycle: 'weekly' }).validate(0))
        .toBe('COMMISSION_SETTINGS.ERRORS.START_DATE_REQUIRED');
      expect(options({ eligibilityType: 'immediate', paymentCycle: 'biweekly' }).validate(0))
        .toBe('COMMISSION_SETTINGS.ERRORS.START_DATE_REQUIRED');
      expect(options({ eligibilityType: 'immediate', paymentCycle: 'weekly', paymentCycleStartDate: '2026-09-01' }).validate(0))
        .toBeNull();
      expect(options({ eligibilityType: 'immediate', paymentCycle: 'monthly' }).validate(0)).toBeNull();
    });
  });

  describe('toPayload', () => {
    it('always carries every field (enabled included)', () => {
      const payload = options({ eligibilityType: 'immediate' }).toPayload();
      expect(Object.keys(payload).sort()).toEqual(
        ['eligibilityDays', 'eligibilityType', 'enabled', 'paymentCycle', 'paymentCycleStartDate']
      );
    });

    it('clears the days unless commission is earned days after the sale', () => {
      expect(options({ eligibilityType: 'immediate', eligibilityDays: 5 }).toPayload().eligibilityDays).toBeNull();
      expect(options({ eligibilityType: 'days_after_sale', eligibilityDays: 5 }).toPayload().eligibilityDays).toBe(5);
    });

    it('clears the start date unless the cycle is weekly or biweekly', () => {
      expect(options({ paymentCycle: 'monthly', paymentCycleStartDate: '2026-09-01' }).toPayload().paymentCycleStartDate)
        .toBeNull();
      expect(options({ paymentCycle: 'biweekly', paymentCycleStartDate: '2026-09-01' }).toPayload().paymentCycleStartDate)
        .toBe('2026-09-01');
    });
  });

  it('reads saved options', () => {
    const o = new EmployeeCommissionOptions();
    o.ParseJson({ eligibilityType: 'days_after_sale', eligibilityDays: 3, paymentCycle: 'weekly', paymentCycleStartDate: '2026-09-01' });
    expect(o.eligibilityType).toBe('days_after_sale');
    expect(o.eligibilityDays).toBe(3);
    expect(o.paymentCycle).toBe('weekly');
    expect(o.paymentCycleStartDate).toBe('2026-09-01');
  });
});

describe('EmployeeTipOptions', () => {
  it('does not deduct card fees from tips until it is switched on', () => {
    expect(new EmployeeTipOptions().deductCardFeeFromTips).toBe(false);
  });

  it('reads the saved setting', () => {
    const o = new EmployeeTipOptions();
    o.ParseJson({ deductCardFeeFromTips: true });
    expect(o.deductCardFeeFromTips).toBe(true);
  });

  it('sends the setting as a boolean, which is all the server accepts', () => {
    const o = new EmployeeTipOptions();
    o.ParseJson({ deductCardFeeFromTips: 'yes' });
    expect(o.toPayload().deductCardFeeFromTips).toBe(true);
    o.ParseJson({ deductCardFeeFromTips: null });
    expect(o.toPayload().deductCardFeeFromTips).toBe(false);
  });
});

describe('companySavePayload', () => {
  function configuredCompany() {
    const tips = new EmployeeTipOptions();
    tips.deductCardFeeFromTips = true;
    return { name: 'Salon', employeeCommissionOptions: options({ eligibilityType: 'immediate' }), employeeTipOptions: tips } as any;
  }

  it('sends null commission and tip options by default, so an older copy of the company cannot revert them', () => {
    const payload = companySavePayload(configuredCompany());
    expect(payload.employeeCommissionOptions).toBeNull();
    expect(payload.employeeTipOptions).toBeNull();
    expect(payload.name).toBe('Salon');
  });

  it('leaves the company object it was given untouched', () => {
    const company = configuredCompany();
    companySavePayload(company);
    expect(company.employeeCommissionOptions?.eligibilityType).toBe('immediate');
    expect(company.employeeTipOptions?.deductCardFeeFromTips).toBe(true);
  });

  it('keeps both when the commission settings page saves them', () => {
    const payload = companySavePayload(configuredCompany(), true);
    expect(payload.employeeCommissionOptions?.eligibilityType).toBe('immediate');
    expect(payload.employeeTipOptions?.deductCardFeeFromTips).toBe(true);
  });
});

describe('enabled', () => {
  it('is off for commission and tips until switched on, including the effective default', () => {
    expect(new EmployeeCommissionOptions().enabled).toBe(false);
    expect(EmployeeCommissionOptions.effectiveDefault(14).enabled).toBe(false);
    expect(new EmployeeTipOptions().enabled).toBe(false);
  });

  it('is read from the saved options and sent as a boolean', () => {
    const commission = new EmployeeCommissionOptions();
    commission.ParseJson({ enabled: true });
    expect(commission.toPayload().enabled).toBe(true);
    const tips = new EmployeeTipOptions();
    tips.ParseJson({ enabled: 1 });
    expect(tips.toPayload().enabled).toBe(true);
    tips.ParseJson({ enabled: null });
    expect(tips.toPayload().enabled).toBe(false);
  });
});

describe('isEmployeeEarningsEnabled', () => {
  function company(commission: boolean | null, tips: boolean | null) {
    return {
      employeeCommissionOptions: commission == null ? null : { enabled: commission },
      employeeTipOptions: tips == null ? null : { enabled: tips },
    };
  }

  it('treats never-configured options and a missing company as off', () => {
    expect(isEmployeeEarningsEnabled(company(null, null), 'commission')).toBe(false);
    expect(isEmployeeEarningsEnabled(company(null, null), 'tips')).toBe(false);
    expect(isEmployeeEarningsEnabled(null, ['commission', 'tips'])).toBe(false);
  });

  it('checks each feature on its own options', () => {
    expect(isEmployeeEarningsEnabled(company(true, false), 'commission')).toBe(true);
    expect(isEmployeeEarningsEnabled(company(true, false), 'tips')).toBe(false);
    expect(isEmployeeEarningsEnabled(company(false, true), 'tips')).toBe(true);
  });

  it('passes an array when any one of the features is on', () => {
    expect(isEmployeeEarningsEnabled(company(false, true), ['commission', 'tips'])).toBe(true);
    expect(isEmployeeEarningsEnabled(company(false, false), ['commission', 'tips'])).toBe(false);
  });
});
