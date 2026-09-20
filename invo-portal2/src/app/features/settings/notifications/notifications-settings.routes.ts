import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('settings/notifications');
  return true;
};

/**
 * Notification Settings — Events/Templates/Logs. Mounted at `/settings/notifications`
 * (deliberately NOT mirroring the legacy portal's flat `/notification-settings` +
 * `/templates/templates-form` routes — templates are nested here since they only
 * exist to serve notifications in this scope).
 */
export const NOTIFICATIONS_SETTINGS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'notificationSettingsSecurity.actions.view.access' },
    loadComponent: () => import('./pages/overview/notification-settings.component').then(m => m.NotificationSettingsComponent),
  },
  {
    path: 'templates/new',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'messageTemplatesSecurity.actions.edit.access' },
    loadComponent: () => import('./pages/template-form/template-form.component').then(m => m.TemplateFormComponent),
  },
  {
    path: 'templates/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'messageTemplatesSecurity.actions.view.access' },
    loadComponent: () => import('./pages/template-form/template-form.component').then(m => m.TemplateFormComponent),
  },
];
