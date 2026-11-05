import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// /account/recurring-expense            → list
// /account/recurring-expense/view/:id   → view
// /account/recurring-expense/:id        → form (`new` / `0` = create)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/recurring-expenses');
  return true;
};

export const RECURRING_EXPENSES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'recurringExpenseSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/recurring-expenses-list/recurring-expenses-list.component').then(m => m.RecurringExpensesListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'recurringExpenseSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/recurring-expense-view/recurring-expense-view.component').then(m => m.RecurringExpenseViewComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'recurringExpenseSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/recurring-expense-form/recurring-expense-form.component').then(m => m.RecurringExpenseFormComponent),
  },
];
