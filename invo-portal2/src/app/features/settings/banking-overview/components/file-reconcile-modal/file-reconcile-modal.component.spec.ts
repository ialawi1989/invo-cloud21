import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { provideTranslateService } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ToastService } from '@shared/components/toast/toast.service';
import { ReconciliationTransaction } from '../../services/banking-overview.types';
import { parseGenericCsv } from '../../pages/file-reconciliation/file-reconciliation-csv';
import { FileReconcileModalComponent } from './file-reconcile-modal.component';

const tx = (id: string, ref: string, debit: number, credit: number, date: string): ReconciliationTransaction => ({
  id, reference: 'Invoice Payment', referenceId: null, referenceNumber: ref, transactionDetails: '', date,
  Debit: debit, Credit: credit, reconcile: false, reconciliationId: null,
} as ReconciliationTransaction);

/** Mirrors the two sample statements: one matched by reference, one by amount + date with split money in/out columns. */
describe('FileReconcileModalComponent', () => {
  const make = (rows: ReconciliationTransaction[], csv: string) => {
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ fallbackLang: 'en' }),
        { provide: MODAL_DATA, useValue: { transactions: rows } },
        { provide: MODAL_REF, useValue: { close, dismiss: vi.fn() } },
        { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn() } },
      ],
    });
    const c = TestBed.createComponent(FileReconcileModalComponent).componentInstance;
    c.applyFile(parseGenericCsv(csv), 'statement.csv');
    return { c, close };
  };

  it('pre-fills the columns from the header names and picks the two-column layout', () => {
    const { c } = make([], 'Posting date,Narration,Ref,Deposit,Withdrawal\n2025-02-11,Deposit test,,4.700,\n');
    expect(c.dateCol()).toBe('Posting date');
    expect(c.descCol()).toBe('Narration');
    expect(c.refCol()).toBeNull();                   // empty column is never a default
    expect(c.amountMode()).toBe('split');
    expect(c.inCol()).toBe('Deposit');
    expect(c.outCol()).toBe('Withdrawal');
  });

  it('matches by reference, flags an amount difference, and skips total/blank lines', () => {
    const { c, close } = make(
      [tx('a', 'R-1', 9.25, 0, '2025-10-20'), tx('b', 'R-2', 9.25, 0, '2025-10-20'), tx('c', 'R-3', 9.25, 0, '2025-10-20')],
      [
        'Date,Description,Reference,Money In,Money Out',
        '2025-10-20,Card,R-1,9.250,',
        '2025-10-20,Card,R-2,9.750,',            // same reference, different amount
        '2025-10-21,Bank charges,,,1.500',        // not in the books
        ',Total,,,',                              // junk
      ].join('\n'),
    );
    const r = c.result()!;
    expect(r.matched.map(p => p.file2['__id']).sort()).toEqual(['a', 'b']);
    expect(c.diff(r.matched.find(p => p.file2['__id'] === 'b')!)).toBe(0.5);
    expect(r.unmatchedFile1.length).toBe(1);        // the bank charge
    expect(r.unmatchedFile2.map(x => x['__id'])).toEqual(['c']); // outstanding in books
    expect(c.prepared().skipped).toBe(1);           // the Total row
    c.apply();
    expect(close).toHaveBeenCalledWith(['a', 'b']);
  });

  it('matches by amount + date within the window, and never a deposit with a withdrawal', () => {
    const { c } = make(
      [tx('a', '', 5.3, 0, '2025-02-10'), tx('b', '', 4.7, 0, '2025-02-10'), tx('c', '', 3.8, 0, '2025-02-10')],
      [
        'Posting date,Narration,Ref,Deposit,Withdrawal',
        '2025-02-11,Deposit,,5.300,',             // 1 day late: inside the window
        '2025-02-16,Deposit,,4.700,',             // 6 days late: outside the window
        '2025-02-10,Fee,,,3.800',                 // withdrawal of a deposit's size: must NOT match
      ].join('\n'),
    );
    const r = c.result()!;
    expect(r.matched.map(p => p.file2['__id'])).toEqual(['a']);
    expect(r.matched[0].dayDiff).toBe(1);
    expect(r.unmatchedFile1.length).toBe(2);
    c.dateWindow.set(7);
    expect(c.result()!.matched.map(p => p.file2['__id']).sort()).toEqual(['a', 'b']);
  });

  it('folds the setup into a summary once there is a result, and reopens on demand', () => {
    const { c } = make([tx('a', 'R-1', 10, 0, '2025-10-20')], 'Date,Reference,Amount\n2025-10-20,R-1,10\n');
    expect(c.result()).not.toBeNull();
    expect(c.showSetup()).toBe(false);          // folded: mapping is complete
    expect(c.amountSummary()).toBe('Amount');
    c.setupOpen.set(true);
    expect(c.showSetup()).toBe(true);
    c.setupOpen.set(false);
    c.dateCol.set(null); c.refCol.set(null);    // mapping no longer gives a result -> must stay open
    expect(c.result()).toBeNull();
    expect(c.showSetup()).toBe(true);
  });

  it('warns when the chosen reference column is empty in almost every line', () => {
    const { c } = make([], 'Date,Ref,Amount\n2025-02-10,,5.3\n2025-02-11,-,4.7\n2025-02-12,,3.8\n');
    c.refCol.set('Ref');
    expect(c.refWarning()).toBe(true);
    c.method.set('amount-date');
    expect(c.refWarning()).toBe(false);
  });

  it('applies only the ticked matches (all start ticked)', () => {
    const { c, close } = make(
      [tx('a', 'R-1', 10, 0, '2025-10-20'), tx('b', 'R-2', 5, 0, '2025-10-20')],
      'Date,Reference,Amount\n2025-10-20,R-1,10\n2025-10-20,R-2,5\n',
    );
    expect(c.checkedIds().sort()).toEqual(['a', 'b']);
    c.toggle('a');
    expect(c.someChecked()).toBe(true);
    c.apply();
    expect(close).toHaveBeenCalledWith(['b']);
    c.toggleAll(false);
    expect(c.checkedIds()).toEqual([]);
    c.toggleAll(true);
    expect(c.allChecked()).toBe(true);
  });
});
