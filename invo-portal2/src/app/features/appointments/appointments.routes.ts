import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await Promise.all([lang.loadFeature('appointments'), lang.loadFeature('products')]);
  return true;
};

export const APPOINTMENTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { pageWidth: 'bleed', permissionPath: 'salonSecurity.actions.view.access' },
    loadComponent: () => import('./pages/calendar/appointment-calendar.component').then(m => m.AppointmentCalendarComponent),
  },
  {
    path: 'form',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { pageWidth: 'form', permissionPath: { new: 'salonSecurity.actions.newAppointment.access', edit: 'salonSecurity.actions.editAppointment.access' } },
    loadComponent: () => import('./pages/form/appointment-form.component').then(m => m.AppointmentFormComponent),
  },
];
