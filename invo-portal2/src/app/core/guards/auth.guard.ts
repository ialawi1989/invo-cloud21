import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = (route) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  const returnUrl = encodeURIComponent(route.url.map(s => s.path).join('/'));
  router.navigate(['/login'], { queryParams: { returnUrl } });
  return false;
};
