import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { PrivilegeService } from '../auth/privileges/privilege.service';
import { AuthService } from '../auth/auth.service';

/**
 * Route guard that mirrors the v16 PermissionGuard.
 *
 * Route data:
 *   permissionPath  — dot-path e.g. "invoiceSecurity.actions.view"
 *                     or "invoiceSecurity.access"
 *   redirectTo      — where to go on deny (default: 'dashboard')
 *   silentRedirect  — if true, redirect without an error message
 *
 * A denied check first re-loads the privileges from the server, so changes
 * made after sign-in (approved access requests) apply without a new login.
 */
export const privilegeGuard: CanActivateFn = async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const privilegeService = inject(PrivilegeService);
  const router           = inject(Router);
  const auth             = inject(AuthService);

  const permissionPath: string | undefined = route.data['permissionPath'];
  const redirectTo:     string             = route.data['redirectTo'] ?? '/dashboard';
  const silentRedirect: boolean            = route.data['silentRedirect'] ?? false;

  // Super admins are exempt from privilege checks on every route.
  if (privilegeService.isSuperAdmin) return true;

  if (!permissionPath) {
    router.navigate([redirectTo]);
    return false;
  }

  // Time-limited access grants expire server-side, so a tree loaded a while ago
  // may still contain one. Refresh it (at most once a minute) before deciding.
  let refreshed = false;
  if (auth.privilegesStale()) {
    refreshed = true;
    await auth.refreshPrivileges();
  }

  const allowed = privilegeService.check(permissionPath);

  if (allowed) return true;

  // The stored privilege tree can be stale (role edited, access request
  // approved since sign-in). Re-check against the server once before denying.
  if (!refreshed && await auth.refreshPrivileges() && privilegeService.check(permissionPath)) return true;

  if (silentRedirect) {
    router.navigate([redirectTo]);
    return false;
  }

  // Non-silent: navigate and the target page can show the error
  // (replaces generalHelpers.errorMsg from v16)
  router.navigate(['/403'], {
    state: { permissionPath, redirectTo, attemptedUrl: state.url }
  });
  return false;
};
