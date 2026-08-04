import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, from, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { EmployeeService } from './employee.service';

/**
 * Async validators for the employee form — ported from the legacy
 * `employee-form` (InvoCloudFront2), which ran the same two probes:
 * `employee/getEmployeeByEmail` for the email and `company/validateName`
 * (tableName `passCode`) for the pass code.
 */

export interface EmployeeEmailValidatorOptions {
  /** Current employee id — `'0'`/null when creating. */
  getEmployeeId: () => string | null | undefined;
  /** The email the record was loaded with; an unchanged email skips the probe. */
  getOriginalEmail: () => string;
  /** Debounce (ms) before hitting the backend. Default: 500ms. */
  debounceMs?: number;
}

/**
 * Resolves an email against the company's user base. The backend answers with
 * three meaningful shapes (legacy `createAsyncEmailValidator`):
 *
 *  1. `error: 2`                     → the address already works in this company
 *                                      → `{ emailTaken: true }` (blocks the save)
 *  2. `error: 1` + `canBeAdded`      → unknown address, free to create → valid
 *  3. `success` + `data.employeeId`  → an existing InvoCloud user → surfaced as
 *                                      `{ emailExists: {...} }` so the form can
 *                                      offer the "invite instead" shortcut.
 *
 * Case 3 is *informational* — the form treats it as a soft error (see
 * `emailSoftError` in the component) and still allows the invite flow.
 */
export function employeeEmailValidator(
  service: EmployeeService,
  opts: EmployeeEmailValidatorOptions,
): AsyncValidatorFn {
  const debounce = opts.debounceMs ?? 500;

  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const email = (control.value ?? '').toString().trim();
    if (!email) return of(null);

    // Editing and the address hasn't changed — nothing to check.
    const id = opts.getEmployeeId();
    const isEdit = !!id && id !== '0';
    if (isEdit && opts.getOriginalEmail() === email) return of(null);

    return timer(debounce).pipe(
      switchMap(() => from(service.getEmployeeByEmail(email))),
      map((res: any) => {
        const data = res?.data ?? null;

        // 1 — already an employee of this company.
        if (!res?.success && data?.error === 2) {
          return { emailTaken: true } as ValidationErrors;
        }
        // 2 — not recognised but can be added.
        if (!res?.success && data?.error === 1 && data?.canBeAdded) {
          return null;
        }
        // 3 — an existing InvoCloud user → offer the invitation flow.
        if (res?.success && data?.employeeId) {
          return {
            emailExists: {
              employeeId:   data.employeeId,
              employeeName: data.employeeName ?? '',
            },
          } as ValidationErrors;
        }
        return null;
      }),
      catchError(() => of(null)),
    );
  };
}

export interface PasscodeValidatorOptions {
  /** Current employee id — `'0'`/null when creating. */
  getEmployeeId: () => string | null | undefined;
  /** Debounce (ms) before hitting the backend. Default: 500ms. */
  debounceMs?: number;
}

/**
 * Pass codes must be unique across the company — legacy
 * `customValidatorsService.nameExistInTable(empId, 'passCode')`. Emits
 * `{ exist: true }` when the code is already in use.
 */
export function passcodeUniqueValidator(
  service: EmployeeService,
  opts: PasscodeValidatorOptions,
): AsyncValidatorFn {
  const debounce = opts.debounceMs ?? 500;

  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = (control.value ?? '').toString().trim();
    if (!value || !control.dirty) return of(null);

    const id = opts.getEmployeeId();

    return timer(debounce).pipe(
      switchMap(() => from(service.validateName({
        tableName: 'passCode',
        id:        !id || id === '0' ? '' : id,
        name:      value,
      }))),
      map(res => (res.success ? null : { exist: true })),
      catchError(() => of(null)),
    );
  };
}
