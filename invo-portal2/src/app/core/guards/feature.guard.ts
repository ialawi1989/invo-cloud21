import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FeatureService } from '../auth/feature.service';

export const featureGuard: CanActivateFn = (route) => {
  const featureService = inject(FeatureService);
  const router         = inject(Router);
  const feature        = route.data['feature'] as string | undefined;
  if (!feature) return true;
  if (featureService.isEnabled(feature)) return true;
  router.navigate(['/feature-unavailable']);
  return false;
};
