import { Injectable, inject } from '@angular/core';

import { DocActionsBase } from '../../services/doc-actions-base';
import { BudgetService } from './budget.service';

/**
 * Single home of a budget's actions (see {@link DocActionsBase}). Legacy gated delete on
 * `budgetSecurity.actions.delete`, which the privilege definition never had (so it was open to everyone);
 * here it follows "add/edit Budget", the privilege an administrator can actually switch.
 */
@Injectable({ providedIn: 'root' })
export class BudgetActions extends DocActionsBase {
  private budgets = inject(BudgetService);

  get canView() { return this.can('budgetSecurity.actions.view.access'); }
  get canAdd() { return this.can('budgetSecurity.actions.add.access'); }
  get canEdit() { return this.canAdd; }
  get canDelete() { return this.canAdd; }

  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('COMMON.DELETE', 'BUDGET.LIST.CONFIRM_DELETE', true, () => this.budgets.deleteBudget(id), after, 'BUDGET.LIST.DELETED');
  }
}
