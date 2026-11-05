import { Injectable, inject } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { LanguageService } from '@core/i18n/language.service';

import { RecurringInvoiceRepeat, RecurringPeriodicity } from '../models/recurring-invoice.model';
import { RequiredRule } from '../../services/document-validation';
import { DocActionsBase } from '../../services/doc-actions-base';
import { RecurringInvoicesService } from './recurring-invoices.service';

/** Header rules of the invoice template: the backend schema needs branch + customer (+ lines). */
export const RECURRING_INVOICE_RULES: RequiredRule[] = [
  { field: 'branchId', labelKey: 'RECURRING_INVOICES.REQUIRED.BRANCH' },
  { field: 'customerId', labelKey: 'RECURRING_INVOICES.REQUIRED.CUSTOMER' },
];

/** Payment terms the backend turns into a due date for each generated invoice (`Invoice.dueDateFromTerm`). */
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
      label: periodicity === 'Monthly' ? String(i) : periodicity === 'Weekly' ? t('RECURRING_INVOICES.WEEKDAYS.' + i) : t('RECURRING_INVOICES.MONTHS.' + i),
    });
  }
  return out;
}

/** "Every 2 month(s)" sentence of a schedule. */
export function frequencyLabel(repeat: Partial<RecurringInvoiceRepeat> | null | undefined, lang: LanguageService): string {
  const qty = repeat?.periodQty ?? 1;
  switch (repeat?.periodicity) {
    case 'Monthly': return lang.instant('RECURRING_INVOICES.LIST.FREQUENCY_SENTENCE_MONTH', { qty });
    case 'Yearly': return lang.instant('RECURRING_INVOICES.LIST.FREQUENCY_SENTENCE_YEAR', { qty });
    case 'Weekly': return lang.instant('RECURRING_INVOICES.LIST.FREQUENCY_SENTENCE_WEEK', { qty });
    default: return '';
  }
}

/** Single home of a recurring profile's actions: rules, what the buttons do, and the "Actions" menu (see {@link DocActionsBase}). */
@Injectable({ providedIn: 'root' })
export class RecurringInvoiceActions extends DocActionsBase {
  private service = inject(RecurringInvoicesService);

  get canAdd() { return this.can('recurringInvoiceSecurity.actions.add.access'); }
  get canDelete() { return this.can('recurringInvoiceSecurity.actions.delete.access'); }

  /** Once an invoice was generated the profile can no longer be deleted (the backend refuses it too). */
  delete(r: { childInvoicesQty?: number; hasInvoices?: boolean }): boolean {
    return this.canDelete && (r.childInvoicesQty ?? 0) === 0 && !r.hasInvoices;
  }

  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('RECURRING_INVOICES.ACTIONS.DELETE', 'RECURRING_INVOICES.ACTIONS.CONFIRM_DELETE', true,
      () => this.service.delete(id), after, 'RECURRING_INVOICES.ACTIONS.DELETED');
  }

  menu(r: { childInvoicesQty?: number; hasInvoices?: boolean }, id: string, after: () => void): DropdownMenuBtnItem[] {
    return this.delete(r)
      ? [this.item(this.t('RECURRING_INVOICES.ACTIONS.DELETE'), () => void this.runDelete(id, after), { danger: true })]
      : [];
  }
}
