import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';
import { hrPrivilegeGuard } from './hr-privilege';

/**
 * Employees — team members, invitations, schedules, privileges & attendance.
 * Top-level feature (sidebar "Employees" group), living at `/employees/*`.
 *
 *   /employees                 → list
 *   /employees/privileges              → privilege-set list
 *   /employees/privileges/:id/dashboard → role default-dashboard editor
 *   /employees/privileges/:id          → privilege-set form (0 = new)
 *   /employees/attendance      → attendance log
 *   /employees/attendance/:id  → attendance adjust form
 *   /employees/schedule        → team schedule board
 *   /employees/my-account      → the signed-in employee's own account
 *   /employees/invitation/:id  → invite / edit invited employee (0 = new)
 *   /employees/:id             → employee record shell; default child is the
 *                                employee form, unchanged (0 = new)
 *   /employees/:id/documents   → documents tab
 *   /employees/:id/assets      → assets tab
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
    // Declared before `privileges/:id` so the deeper `.../dashboard` path wins.
    path: 'privileges/:id/dashboard',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'privilegeSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/privilege-dashboard/privilege-dashboard.component').then(m => m.PrivilegeDashboardComponent),
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
    /**
     * The employee record. `:id` gained children in HR phase 2 — the shell
     * renders a tab strip and an outlet, and the DEFAULT CHILD is the employee
     * form at the same URL, so `/employees/:id` behaves exactly as before and
     * every existing link and bookmark keeps working.
     *
     * `unsavedChangesGuard` moved to the profile child, deliberately. On the
     * parent it would fire when switching tabs — which is not leaving the
     * record, so prompting there is noise. On the child it fires exactly when
     * the profile form is dirty and the user navigates away from it, including
     * to another tab, which is the case worth interrupting.
     */
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'employeeSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/employee-record/employee-record.component').then(m => m.EmployeeRecordComponent),
    children: [
      {
        // Today's form, at today's URL.
        path: '',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./pages/employee-form/employee-form.component').then(m => m.EmployeeFormComponent),
      },
      /**
       * HR module tabs land here, one per commit, each alongside its component
       * and its entry flipped to `ready` in employee-record.component.ts.
       *
       * They are guarded with `hrPrivilegeGuard`, NOT `privilegeGuard`: the
       * latter is default-allow and would admit everyone to routes whose every
       * request the API refuses. See features/employees/hr-privilege.ts.
       *
       * The guard is a backstop for a typed or bookmarked URL — the primary
       * control is that the tab is absent from the strip for anyone without the
       * grant.
       */
      {
        path: 'documents',
        canActivate: [hrPrivilegeGuard],
        // `view`, spelled as the server's `employeeDocumentSecurity` helper
        // checks it. Pinned by hr-privilege-contract.spec.ts on this side and
        // hrPrivilegeContract.test.ts on the server's.
        data: { hrGroup: 'employeeDocumentSecurity', hrAction: 'view' },
        loadComponent: () =>
          import('./pages/employee-documents/employee-documents.component')
            .then(m => m.EmployeeDocumentsComponent),
      },
      {
        path: 'assets',
        canActivate: [hrPrivilegeGuard],
        // `view` on `employeeAssetSecurity`. The edit grant is checked inside
        // the tab, not here: an employee may read what they are said to be
        // holding without being able to mark their own laptop returned.
        data: { hrGroup: 'employeeAssetSecurity', hrAction: 'view' },
        loadComponent: () =>
          import('./pages/employee-assets/employee-assets.component')
            .then(m => m.EmployeeAssetsComponent),
      },
    ],
  },
];
