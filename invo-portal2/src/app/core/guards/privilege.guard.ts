import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { PrivilegeService } from '../auth/privileges/privilege.service';

/**
 * Route guard that mirrors the v16 PermissionGuard.
 *
 * Route data:
 *   permissionPath  — dot-path e.g. "invoiceSecurity.actions.view"
 *                     or "invoiceSecurity.access"
 *   redirectTo      — where to go on deny (default: 'dashboard')
 *   silentRedirect  — if true, redirect without an error message
 */
export const privilegeGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const privilegeService = inject(PrivilegeService);
  const router           = inject(Router);

  const permissionPath: string | undefined = route.data['permissionPath'];
  const redirectTo:     string             = route.data['redirectTo'] ?? '/dashboard';
  const silentRedirect: boolean            = route.data['silentRedirect'] ?? false;

  if (!permissionPath) {
    router.navigate([redirectTo]);
    return false;
  }

  const allowed = privilegeService.check(permissionPath);

  if (allowed) return true;

  if (silentRedirect) {
    router.navigate([redirectTo]);
    return false;
  }

  // Non-silent: navigate and the target page can show the error
  // (replaces generalHelpers.errorMsg from v16)
  router.navigate(['/403'], {
    state: { permissionPath, redirectTo }
  });
  return false;
};
