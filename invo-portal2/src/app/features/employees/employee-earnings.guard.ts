import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CompanyService } from '@core/auth/company.service';
import { EmployeeEarningsFeature, isEmployeeEarningsEnabled } from '@core/auth/employee-earnings';

/**
 * Blocks a commission / tips page unless the company switched the feature on.
 * The route's `data.earningsFeature` names it; an array means any of them.
 */
export const employeeEarningsGuard: CanActivateFn = async (route) => {
  const router  = inject(Router);
  const company = inject(CompanyService);
  const features: EmployeeEarningsFeature | EmployeeEarningsFeature[] = route.data['earningsFeature'];

  const settings = await company.loadSettings();
  return isEmployeeEarningsEnabled(settings, features) ? true : router.createUrlTree(['/dashboard']);
};
