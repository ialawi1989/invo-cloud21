import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('appointments');
  return true;
};

export const APPOINTMENTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'appointmentsSecurity.actions.view.access' },
    loadComponent: () => import('./pages/calendar/appointment-calendar.component').then(m => m.AppointmentCalendarComponent),
  },
  {
    path: 'waitlist',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'appointmentsSecurity.actions.view.access' },
    loadComponent: () => import('./pages/waitlist/waitlist.component').then(m => m.WaitlistComponent),
  },
  {
    path: 'form',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'appointmentsSecurity.actions.add.access' },
    loadComponent: () => import('./pages/form/appointment-form.component').then(m => m.AppointmentFormComponent),
  },
];
