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
 *   /employees/:id/leave       → leave tab (reachable by the subject with no grant)
 *   /employees/:id/performance → performance reviews and trainings
 *   /employees/:id/disciplinary → disciplinary records (subject may read their own)
 *   /employees/:id/payroll     → pay, bank details and loans
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
    // Holiday calendars — the last piece of Leave. Gated on the same view
    // grant as leave itself: a calendar is leave configuration, and someone
    // who may not see leave has no reason to see which days are public
    // holidays for every branch.
    path: 'holiday-calendars',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'employeeLeaveSecurity.actions.view' },
    loadComponent: () =>
      import('./pages/holiday-calendars/holiday-calendars.component')
        .then(m => m.HolidayCalendarsComponent),
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
      {
        path: 'leave',
        canActivate: [hrPrivilegeGuard],
        data: {
          hrGroup: 'employeeLeaveSecurity',
          hrAction: 'view',
          /**
           * The subject reaches their own leave with no grant at all — the
           * server admits them on `isSelf`, because leave is the module where
           * the employee is the author. Requiring the view grant here would
           * lock every employee out of their own leave while the API would
           * have served them.
           *
           * Set on this route ONLY. Reading your own disciplinary record or
           * your own calibration is a different question, and the server
           * answers it differently.
           */
          hrSelfAllowed: true,
        },
        loadComponent: () =>
          import('./pages/employee-leave/employee-leave.component')
            .then(m => m.EmployeeLeaveComponent),
      },
      {
        path: 'performance',
        canActivate: [hrPrivilegeGuard],
        // `view` only. The subject and the named reviewer also reach reviews
        // server-side, but neither is knowable from the route — the reviewer
        // is a property of individual ROWS, not of the record — so the guard
        // asks the one question it can answer and the tab asks the rest per
        // review. No hrSelfAllowed: reading your own calibration is not the
        // same question as reading your own leave.
        data: { hrGroup: 'employeePerformanceSecurity', hrAction: 'view' },
        loadComponent: () =>
          import('./pages/employee-performance/employee-performance.component')
            .then(m => m.EmployeePerformanceComponent),
      },
      {
        path: 'disciplinary',
        canActivate: [hrPrivilegeGuard],
        data: {
          hrGroup: 'employeeDisciplinarySecurity',
          hrAction: 'view',
          /**
           * The SECOND route to carry this, and for a different reason from
           * leave's. There the subject is the author; here they are only a
           * reader — but `mayRead` in the controller opens with
           * `if (isSelf(...)) return true`, because a warning nobody is allowed
           * to show the employee is not a warning.
           *
           * The tab enforces the rest: no edit, no acknowledgement, and the
           * escalation panel is absent for them entirely.
           */
          hrSelfAllowed: true,
        },
        loadComponent: () =>
          import('./pages/employee-disciplinary/employee-disciplinary.component')
            .then(m => m.EmployeeDisciplinaryComponent),
      },
      {
        // End of Service. `complete` is a separate grant, but the guard can
        // only ask one question, so it asks the broader entry condition — the
        // tab itself hides the completion button from anyone without it.
        path: 'end-of-service',
        canActivate: [hrPrivilegeGuard],
        data: { hrGroup: 'employeeEosSecurity', hrAction: 'view' },
        loadComponent: () =>
          import('./pages/employee-eos/employee-eos.component')
            .then(m => m.EmployeeEosComponent),
      },
      {
        path: 'payroll',
        canActivate: [hrPrivilegeGuard],
        // `viewPay`, NOT `view` — payroll's grants are named differently
        // because pay and bank details are separate. The guard can only ask one
        // question, so it asks the broader of the two entry conditions and the
        // tab gates each panel on its own grant; someone holding `viewBank`
        // alone reaches the route and sees the bank panel only.
        //
        // No hrSelfAllowed: the server admits the subject on `isSelf`, but a
        // waiver here would open the route to anyone viewing their own record
        // and the panels below already handle it — `mayViewPay` and
        // `mayViewBank` both return true for the subject.
        data: { hrGroup: 'employeePayrollSecurity', hrAction: 'viewPay' },
        loadComponent: () =>
          import('./pages/employee-payroll/employee-payroll.component')
            .then(m => m.EmployeePayrollComponent),
      },
    ],
  },
];
