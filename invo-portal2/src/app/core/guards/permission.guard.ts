import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../auth/permission.service';
import { Permission } from '../auth/auth.models';

export const permissionGuard: CanActivateFn = (route) => {
  const permissionService = inject(PermissionService);
  const router            = inject(Router);
  const permission        = route.data['permission'] as Permission | Permission[] | undefined;
  if (!permission) return true;
  const allowed = Array.isArray(permission)
    ? permissionService.hasAny(permission)
    : permissionService.has(permission);
  if (allowed) return true;
  router.navigate(['/403']);
  return false;
};
