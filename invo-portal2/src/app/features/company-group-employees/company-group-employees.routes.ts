import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

import './company-group-employees-i18n';

// /company-group-employees → employees of the whole company group and the companies they can work in

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('company-group-employees');
  return true;
};

export const COMPANY_GROUP_EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/company-group-employees-list/company-group-employees-list.component').then(m => m.CompanyGroupEmployeesListComponent),
    data: { permissionPath: 'companyGroupEmployeesSecurity.actions.view.access' },
  },
];
