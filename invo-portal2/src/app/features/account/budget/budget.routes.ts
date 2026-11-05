import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// /account/budget              -> list
// /account/budget/new          -> form (create)
// /account/budget/:id          -> form (edit)
// /account/budget/:id/report   -> Budget vs Actual
// Legacy used `/budget/0` for new and `?report=true` for the report.

const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('account/budget');
  // `DOC_VIEW.*` / `COMMON` labels shared with the document pages.
  await lang.loadFeature('account/components/doc-lines-table');
  return true;
};

export const BUDGET_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'budgetSecurity.actions.view.access' },
    loadComponent: () => import('./pages/budget-list/budget-list.component').then(m => m.BudgetListComponent),
  },
  {
    path: 'new',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'budgetSecurity.actions.add.access' },
    loadComponent: () => import('./pages/budget-form/budget-form.component').then(m => m.BudgetFormComponent),
  },
  {
    path: ':id/report',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'budgetSecurity.actions.view.access' },
    loadComponent: () => import('./pages/budget-report/budget-report.component').then(m => m.BudgetReportComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'budgetSecurity.actions.add.access' },
    loadComponent: () => import('./pages/budget-form/budget-form.component').then(m => m.BudgetFormComponent),
  },
];
