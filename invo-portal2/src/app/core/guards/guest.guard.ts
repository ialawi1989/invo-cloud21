import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/**
 * Blocks access to public-only routes (login) when the user is already
 * authenticated. Redirects them to returnUrl if present, otherwise to /.
 */
export const guestGuard: CanActivateFn = (route) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return true;

  // Already logged in — send them where they were going (or home)
  const returnUrl = route.queryParams['returnUrl']
    ? decodeURIComponent(route.queryParams['returnUrl'])
    : '/';

  router.navigateByUrl(returnUrl);
  return false;
};
