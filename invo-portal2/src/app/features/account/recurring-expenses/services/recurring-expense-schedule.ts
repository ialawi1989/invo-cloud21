import { Injectable, inject } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { LanguageService } from '@core/i18n/language.service';

import { RecurringExpenseRepeat, RecurringPeriodicity } from '../models/recurring-expense.model';
import { RequiredRule } from '../../services/document-validation';
import { DocActionsBase } from '../../services/doc-actions-base';
import { RecurringExpensesService } from './recurring-expenses.service';

/** Header rules of the expense template: the backend schema needs the branch and the payment method (+ lines). */
export const RECURRING_EXPENSE_RULES: RequiredRule[] = [
  { field: 'branchId', labelKey: 'RECURRING_EXPENSES.REQUIRED.BRANCH' },
  { field: 'paymentMethodId', labelKey: 'RECURRING_EXPENSES.REQUIRED.PAYMENT_METHOD' },
];

/** Payment terms the backend turns into a due date for each generated expense (`Expense.dueDateFromTerm`). */
export const RECURRING_TERMS = [
  { value: 'net7', label: 'Net 7' },
  { value: 'net10', label: 'Net 10' },
  { value: 'net15', label: 'Net 15' },
  { value: 'net30', label: 'Net 30' },
  { value: 'net60', label: 'Net 60' },
  { value: 'net90', label: 'Net 90' },
  { value: 'endOfTheMonth', label: 'End of the month' },
  { value: 'onReceiptDue', label: 'On Receipt Due' },
];

export interface PeriodOption { value: number; label: string; }

/** What `repeatData.on` means for a periodicity: Monthly → day, Weekly → weekday (1=Mon), Yearly → month. */
export const PERIOD_MAX: Record<RecurringPeriodicity, number> = { Monthly: 31, Weekly: 7, Yearly: 12 };

/** Labels of the "On" dropdown for a periodicity (weekday / month names come from i18n). */
export function periodOptions(periodicity: RecurringPeriodicity, t: (key: string) => string): PeriodOption[] {
  const out: PeriodOption[] = [];
  for (let i = 1; i <= PERIOD_MAX[periodicity]; i++) {
    out.push({
      value: i,
      label: periodicity === 'Monthly' ? String(i) : periodicity === 'Weekly' ? t('RECURRING_EXPENSES.WEEKDAYS.' + i) : t('RECURRING_EXPENSES.MONTHS.' + i),
    });
  }
  return out;
}

/** "Every 2 month(s)" sentence of a schedule. */
export function frequencyLabel(repeat: Partial<RecurringExpenseRepeat> | null | undefined, lang: LanguageService): string {
  const qty = repeat?.periodQty ?? 1;
  switch (repeat?.periodicity) {
    case 'Monthly': return lang.instant('RECURRING_EXPENSES.LIST.FREQUENCY_SENTENCE_MONTH', { qty });
    case 'Yearly': return lang.instant('RECURRING_EXPENSES.LIST.FREQUENCY_SENTENCE_YEAR', { qty });
    case 'Weekly': return lang.instant('RECURRING_EXPENSES.LIST.FREQUENCY_SENTENCE_WEEK', { qty });
    default: return '';
  }
}

/** Single home of a recurring profile's actions: rules, what the buttons do, and the "Actions" menu (see {@link DocActionsBase}). */
@Injectable({ providedIn: 'root' })
export class RecurringExpenseActions extends DocActionsBase {
  private service = inject(RecurringExpensesService);

  get canAdd() { return this.can('recurringExpenseSecurity.actions.add.access'); }
  get canDelete() { return this.can('recurringExpenseSecurity.actions.delete.access'); }

  /** Once an expense was generated the profile can no longer be deleted (the backend refuses it too). */
  delete(r: { childExpensesQty?: number; hasExpenses?: boolean }): boolean {
    return this.canDelete && (r.childExpensesQty ?? 0) === 0 && !r.hasExpenses;
  }

  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('RECURRING_EXPENSES.ACTIONS.DELETE', 'RECURRING_EXPENSES.ACTIONS.CONFIRM_DELETE', true,
      () => this.service.delete(id), after, 'RECURRING_EXPENSES.ACTIONS.DELETED');
  }

  menu(r: { childExpensesQty?: number; hasExpenses?: boolean }, id: string, after: () => void): DropdownMenuBtnItem[] {
    return this.delete(r)
      ? [this.item(this.t('RECURRING_EXPENSES.ACTIONS.DELETE'), () => void this.runDelete(id, after), { danger: true })]
      : [];
  }
}
