import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = async (route) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  // silently refreshes a stale access token (refresh cookie) before bouncing to /login
  if (await auth.ensureValidSession()) return true;
  const returnUrl = encodeURIComponent(route.url.map(s => s.path).join('/'));
  router.navigate(['/login'], { queryParams: { returnUrl } });
  return false;
};
