import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * URL pattern
 *   /settings/service-management            → list
 *   /settings/service-management/new        → create
 *   /settings/service-management/:id        → edit
 *
 * Privilege gate maps to `serviceSecurity.actions.*` on the
 * settings tile that surfaces this feature.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('service-management');
  return true;
};

export const SERVICE_MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded],
    loadComponent: () =>
      import('./pages/list/service-management-list.component').then(m => m.ServiceManagementListComponent),
  },
  {
    path: ':id',
    canActivate:   [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/form/service-management-form.component').then(m => m.ServiceManagementFormComponent),
  },
];
