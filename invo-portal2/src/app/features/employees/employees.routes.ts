import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * Employees — team members, invitations, schedules, privileges & attendance.
 * Top-level feature (sidebar "Employees" group), living at `/employees/*`.
 *
 *   /employees                 → list
 *   /employees/privileges      → privilege-set list
 *   /employees/privileges/:id  → privilege-set form (0 = new)
 *   /employees/attendance      → attendance log
 *   /employees/attendance/:id  → attendance adjust form
 *   /employees/schedule        → team schedule board
 *   /employees/my-account      → the signed-in employee's own account
 *   /employees/invitation/:id  → invite / edit invited employee (0 = new)
 *   /employees/:id             → employee form (0 = new)
 *
 * Static segments are declared before `:id` so they win the match.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('employees');
  return true;
};

export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'employeeSecurity.actions.view' },
    loadComponent: () =>
      import('./pages/employees-list/employees-list.component').then(m => m.EmployeesListComponent),
  },
  {
    path: 'privileges',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'privilegeSecurity.actions.view' },
    loadComponent: () =>
      import('./pages/privileges-list/privileges-list.component').then(m => m.PrivilegesListComponent),
  },
  {
    path: 'privileges/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'privilegeSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/privilege-form/privilege-form.component').then(m => m.PrivilegeFormComponent),
  },
  {
    path: 'attendance',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'employeeAttendenceSecurity.actions.view' },
    loadComponent: () =>
      import('./pages/attendance-list/attendance-list.component').then(m => m.AttendanceListComponent),
  },
  {
    path: 'attendance/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'employeeAttendenceSecurity.actions.view' },
    loadComponent: () =>
      import('./pages/attendance-form/attendance-form.component').then(m => m.AttendanceFormComponent),
  },
  {
    path: 'schedule',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'employeeScheduleSecurity.actions.view' },
    loadComponent: () =>
      import('./pages/employee-schedule/employee-schedule.component').then(m => m.EmployeeScheduleComponent),
  },
  {
    path: 'my-account',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/my-account/my-account.component').then(m => m.MyAccountComponent),
  },
  {
    path: 'invitation/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'employeeInvitationSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/employee-invitation/employee-invitation.component').then(m => m.EmployeeInvitationComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'employeeSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/employee-form/employee-form.component').then(m => m.EmployeeFormComponent),
  },
];
