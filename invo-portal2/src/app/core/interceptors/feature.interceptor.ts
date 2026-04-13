import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { FeatureService } from '../auth/feature.service';
import { AppFeature } from '../auth/auth.models';

const API_FEATURE_MAP: Record<string, AppFeature> = {
  '/invoices':              'sales.invoices',
  '/estimates':             'sales.estimates',
  '/payments':              'sales.payments',
  '/website-builder':       'website-builder',
  '/settings/billing':      'settings.billing',
  '/settings/integrations': 'settings.integrations',
};

export const featureInterceptor: HttpInterceptorFn = (req, next) => {
  const featureService  = inject(FeatureService);
  const matchedFeature  = Object.entries(API_FEATURE_MAP)
    .find(([path]) => req.url.includes(path))?.[1];
  if (matchedFeature && !featureService.isEnabled(matchedFeature)) {
    return throwError(() => ({ status: 403, message: `Feature "${matchedFeature}" is not enabled for this tenant.` }));
  }
  return next(req);
};
