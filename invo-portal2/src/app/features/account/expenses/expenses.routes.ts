import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';
import { ExpensesService } from './services/expenses.service';
import { ExpenseActions } from './services/expense-actions';
import { docEditableGuard } from '../guards/doc-editable.guard';

// /account/expense            -> list
// /account/expense/view/:id   -> view
// /account/expense/:id        -> form (0 / new = create, ?cloned=yes = clone)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/expenses');
  return true;
};

/** `/account/expenses/:id`: a reconciled expense, or one in a locked period, opens read-only. */
const expenseEditableGuard = docEditableGuard(() => {
  const svc = inject(ExpensesService);
  const actions = inject(ExpenseActions);
  return {
    load: (id: string) => svc.getExpense(id),
    block: async (e: any) => { await actions.refresh(e.branchId || null); return actions.editStateBlock(e); },
  };
}, '/account/expenses/view');

export const EXPENSES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'expenseSecurity.actions.view.access' },
    loadComponent: () => import('./pages/expenses-list/expenses-list.component').then(m => m.ExpensesListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'expenseSecurity.actions.view.access' },
    loadComponent: () => import('./pages/expense-view/expense-view.component').then(m => m.ExpenseViewComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard, expenseEditableGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'expenseSecurity.actions.add.access' },
    loadComponent: () => import('./pages/expense-form/expense-form.component').then(m => m.ExpenseFormComponent),
  },
];
