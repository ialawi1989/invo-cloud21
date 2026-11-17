import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { UserPreferencesService } from './user-preferences.service';

/**
 * Holds the signed-in area back until the employee's preferences are read, so the first screen already shows dates in the
 * chosen format and timezone (a `date` pipe runs once per value, so a preference that arrives later would not reach it).
 * Never blocks sign-in: a failed read just means the defaults.
 */
export const preferencesLoadedGuard: CanActivateFn = async () => {
  try { await inject(UserPreferencesService).load(); } catch { /* defaults */ }
  return true;
};
