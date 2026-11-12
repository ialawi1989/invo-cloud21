import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ReportBuilderComponent } from './components/report-builder/report-builder.component';
import { McpTokensComponent } from './components/mcp-tokens/mcp-tokens.component';
import {
  customReportsEditPrivilegeFullKey,
  customReportsViewPrivilegeFullKey,
} from './custom-reports.privileges';

/**
 * Report-builder routes. Converted from the legacy NgModule routing to
 * invo-portal2's standalone `Routes` + `privilegeGuard` (which reads
 * `data.permissionPath`). Behaviour is unchanged: `new`/`edit` require the Edit
 * privilege, `view` is read-only, and the bare `:moduleId` opens a saved report.
 */
const EDIT_DATA = { permissionPath: customReportsEditPrivilegeFullKey };

/**
 * The saved-reports list (and the AI access tokens screen) need View *or* Edit
 * (Edit implies View in the legacy list) — `privilegeGuard` only takes a single
 * permission path, so this is the "either" variant.
 */
export const customReportsViewGuard: CanActivateFn = () => {
  const privileges = inject(PrivilegeService);
  if (privileges.isSuperAdmin
    || privileges.check(customReportsViewPrivilegeFullKey)
    || privileges.check(customReportsEditPrivilegeFullKey)) return true;
  return inject(Router).createUrlTree(['/dashboard']);
};

export const CUSTOM_REPORTS_ROUTES: Routes = [
  { path: '', component: ReportBuilderComponent },

  { path: 'new', component: ReportBuilderComponent, canActivate: [privilegeGuard], data: EDIT_DATA },
  { path: 'new/:moduleId', component: ReportBuilderComponent, canActivate: [privilegeGuard], data: EDIT_DATA },
  { path: 'edit/:moduleId', component: ReportBuilderComponent, canActivate: [privilegeGuard], data: EDIT_DATA },

  { path: 'view/:moduleId', component: ReportBuilderComponent, data: { mode: 'view' } },

  // AI (MCP) access tokens — must stay above the ':moduleId' catch-all below
  { path: 'mcp-tokens', component: McpTokensComponent },

  { path: ':moduleId', component: ReportBuilderComponent },
  { path: ':moduleId/view', component: ReportBuilderComponent, data: { mode: 'view' } },
];
