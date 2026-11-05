import { Injectable, inject } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocActionsBase } from '../../services/doc-actions-base';
import { TransactionLockService } from '../../services/transaction-lock.service';
import { ExpensesService } from './expenses.service';

/** What the rules read - satisfied by a record and by a list row. */
export interface ExpenseState {
  expenseDate?: any;
  reconciled?: boolean;
}

/**
 * Single home of an expense's actions: the period-lock / privilege / reconciliation rules, what the buttons do
 * and the "Actions" menu built from them (see {@link DocActionsBase}). A reconciled expense is read-only; call
 * {@link refresh} once when a screen opens so the accounting-period lock is known.
 */
@Injectable({ providedIn: 'root' })
export class ExpenseActions extends DocActionsBase {
  private lock = inject(TransactionLockService);
  private expenses = inject(ExpensesService);

  private lockInfo: any = null;
  async refresh(branchId: string | null = null): Promise<void> {
    this.lockInfo = await this.lock.transactionsDate(branchId);
    // The "why can't I edit" explanations live in the shared document-form bundle.
    await this.lang.loadFeature('account/components/doc-lines-table');
  }

  get canAdd() { return this.can('expenseSecurity.actions.add.access'); }
  get canPrint() { return this.can('expenseSecurity.actions.print.access'); }

  private unlocked(e: ExpenseState): boolean { return !!e.expenseDate && this.lock.isEditable(this.lockInfo, e.expenseDate); }

  edit(e: ExpenseState): boolean { return this.canAdd && this.unlocked(e) && !e.reconciled; }
  /** Why the expense's state forbids editing (an i18n key), or null. */
  /** Why Edit is unavailable (an i18n key), or null when it is available. Mirrors `edit()`. */
  editBlockedReason(e: ExpenseState): string | null {
    if (this.edit(e)) return null;
    if (!this.canAdd) return 'DOC_FORM.EDIT_BLOCKED.NO_PERMISSION';
    return this.editStateBlock(e) ?? 'DOC_FORM.EDIT_BLOCKED.PERIOD_LOCKED';
  }
  editStateBlock(e: ExpenseState): string | null {
    if (e.reconciled) return 'DOC_FORM.EDIT_BLOCKED.RECONCILED';
    if (!this.unlocked(e)) return 'DOC_FORM.EDIT_BLOCKED.PERIOD_LOCKED';
    return null;
  }
  clone(e: ExpenseState): boolean { return this.can('expenseSecurity.actions.clone.access') && !e.reconciled; }
  delete(e: ExpenseState): boolean { return this.can('expenseSecurity.actions.delete.access') && this.unlocked(e) && !e.reconciled; }

  goClone(id: string): void { this.goCloneOf('/account/expense', id); }
  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('COMMON.DELETE', 'EXPENSES.VIEW.CONFIRM_DELETE', true, () => this.expenses.deleteExpense(id), after);
  }

  menu(e: ExpenseState, id: string, after: () => void): DropdownMenuBtnItem[] {
    const t = this.t;
    const items: DropdownMenuBtnItem[] = [];
    if (this.clone(e)) items.push(this.item(t('EXPENSES.ACTIONS.CLONE'), () => this.goClone(id)));
    if (this.delete(e)) items.push(this.item(t('COMMON.DELETE'), () => void this.runDelete(id, after), { danger: true, separator: items.length > 0 }));
    return items;
  }
}
