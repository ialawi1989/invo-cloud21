import { Injectable, inject } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { LanguageService } from '@core/i18n/language.service';

import { RecurringBillRepeat, RecurringPeriodicity } from '../models/recurring-bill.model';
import { RequiredRule } from '../../services/document-validation';
import { DocActionsBase } from '../../services/doc-actions-base';
import { RecurringBillsService } from './recurring-bills.service';

/** Header rules of the bill template: the backend schema needs branch + supplier (+ lines). */
export const RECURRING_BILL_RULES: RequiredRule[] = [
  { field: 'branchId', labelKey: 'RECURRING_BILLS.REQUIRED.BRANCH' },
  { field: 'supplierId', labelKey: 'RECURRING_BILLS.REQUIRED.SUPPLIER' },
];

/** Payment terms the backend turns into a due date for each generated bill (`Bill.dueDateFromTerm`). */
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
      label: periodicity === 'Monthly' ? String(i) : periodicity === 'Weekly' ? t('RECURRING_BILLS.WEEKDAYS.' + i) : t('RECURRING_BILLS.MONTHS.' + i),
    });
  }
  return out;
}

/** "Every 2 month(s)" sentence of a schedule. */
export function frequencyLabel(repeat: Partial<RecurringBillRepeat> | null | undefined, lang: LanguageService): string {
  const qty = repeat?.periodQty ?? 1;
  switch (repeat?.periodicity) {
    case 'Monthly': return lang.instant('RECURRING_BILLS.LIST.FREQUENCY_SENTENCE_MONTH', { qty });
    case 'Yearly': return lang.instant('RECURRING_BILLS.LIST.FREQUENCY_SENTENCE_YEAR', { qty });
    case 'Weekly': return lang.instant('RECURRING_BILLS.LIST.FREQUENCY_SENTENCE_WEEK', { qty });
    default: return '';
  }
}

/** Single home of a recurring profile's actions: rules, what the buttons do, and the "Actions" menu (see {@link DocActionsBase}). */
@Injectable({ providedIn: 'root' })
export class RecurringBillActions extends DocActionsBase {
  private service = inject(RecurringBillsService);

  get canAdd() { return this.can('recurringBillSecurity.actions.add.access'); }
  get canDelete() { return this.can('recurringBillSecurity.actions.delete.access'); }

  /** Once an bill was generated the profile can no longer be deleted (the backend refuses it too). */
  delete(r: { childBillsQty?: number; hasBills?: boolean }): boolean {
    return this.canDelete && (r.childBillsQty ?? 0) === 0 && !r.hasBills;
  }

  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('RECURRING_BILLS.ACTIONS.DELETE', 'RECURRING_BILLS.ACTIONS.CONFIRM_DELETE', true,
      () => this.service.delete(id), after, 'RECURRING_BILLS.ACTIONS.DELETED');
  }

  menu(r: { childBillsQty?: number; hasBills?: boolean }, id: string, after: () => void): DropdownMenuBtnItem[] {
    return this.delete(r)
      ? [this.item(this.t('RECURRING_BILLS.ACTIONS.DELETE'), () => void this.runDelete(id, after), { danger: true })]
      : [];
  }
}
