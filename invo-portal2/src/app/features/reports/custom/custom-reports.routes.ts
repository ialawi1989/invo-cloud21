import { Routes } from '@angular/router';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { ReportBuilderComponent } from './components/report-builder/report-builder.component';
import { customReportsEditPrivilegeFullKey } from './custom-reports.privileges';

/**
 * Report-builder routes. Converted from the legacy NgModule routing to
 * invo-portal2's standalone `Routes` + `privilegeGuard` (which reads
 * `data.permissionPath`). Behaviour is unchanged: `new`/`edit` require the Edit
 * privilege, `view` is read-only, and the bare `:moduleId` opens a saved report.
 */
const EDIT_DATA = { permissionPath: customReportsEditPrivilegeFullKey };

export const CUSTOM_REPORTS_ROUTES: Routes = [
  { path: '', component: ReportBuilderComponent },

  { path: 'new', component: ReportBuilderComponent, canActivate: [privilegeGuard], data: EDIT_DATA },
  { path: 'new/:moduleId', component: ReportBuilderComponent, canActivate: [privilegeGuard], data: EDIT_DATA },
  { path: 'edit/:moduleId', component: ReportBuilderComponent, canActivate: [privilegeGuard], data: EDIT_DATA },

  { path: 'view/:moduleId', component: ReportBuilderComponent, data: { mode: 'view' } },

  { path: ':moduleId', component: ReportBuilderComponent },
  { path: ':moduleId/view', component: ReportBuilderComponent, data: { mode: 'view' } },
];
