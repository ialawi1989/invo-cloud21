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

/**
 * Plan-feature gate: `data: { planFeature: 'promotions.vouchers' }` (or a list = any-of).
 * A company whose plan lacks it lands on the "feature unavailable" page, which offers
 * "Request access", instead of the page firing requests the backend refuses.
 */
export const planFeatureGuard: CanActivateFn = (route, state) => {
  const featureService = inject(FeatureService);
  const router         = inject(Router);
  const feature = route.data['planFeature'] as string | string[] | undefined;
  if (!feature || featureService.isEnabled(feature)) return true;
  const name = Array.isArray(feature) ? feature[0] : feature;
  router.navigate(['/feature-unavailable'], { state: { feature: name, attemptedUrl: state.url } });
  return false;
};
