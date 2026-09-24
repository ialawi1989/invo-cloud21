import { AbstractControl, AsyncValidatorFn, FormArray, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, from, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { CustomerAddress } from '../models/customer.model';
import { CustomersService } from './customers.service';

/**
 * Customer form validators, ported from the legacy `CustomValidatorsService`
 * (`customerPhoneExistInTable`, `customerMobileExistInTable`,
 * `checkIfAddressTitleIsExists`): same probe (`company/validateName`), same
 * error keys, same rules.
 */

const DEBOUNCE_MS = 500;

/** `id` of 0 / '0' means "new" and is sent as null (legacy `normalizeId`). */
function normalizeId(id: any): any {
  return id === '0' || id === 0 || id === 'new' ? null : id;
}

/**
 * Async "this value is already used by another customer" check. Skips empty
 * values and untouched (pristine) controls, like the legacy validator.
 * `errorKey`: `phoneExists` | `mobileExists`.
 */
export function customerFieldExistsValidator(
  service: CustomersService,
  getId: () => any,
  errorKey: 'phoneExists' | 'mobileExists',
  tableName = 'customer',
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = control.value?.trim();
    if (!value || !control.dirty) return of(null);
    return timer(DEBOUNCE_MS).pipe(
      switchMap(() =>
        from(service.validateName({ tableName, id: normalizeId(getId()), name: control.value })),
      ),
      map(res => (res?.success ? null : { [errorKey]: true })),
      catchError(() => of(null)),
    );
  };
}

/** Address titles must be unique within the customer (`addressExists`). */
export function addressTitleUniqueValidator(getAddresses: () => CustomerAddress[]): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const model = getAddresses();
    if (!model.length) return null;

    const parentGroup = c.parent;
    if (!(parentGroup instanceof FormGroup)) return null;
    const formArray = parentGroup.parent;
    if (!(formArray instanceof FormArray)) return null;

    const controlIndex = formArray.controls.indexOf(parentGroup);
    // Group not yet inserted into the array (e.g. during a rebuild)
    if (controlIndex === -1) return null;

    const current = c.value?.toString().trim().toLowerCase();
    if (!current) return null;

    const exists = model.some((item, index) => {
      const v = item.title;
      return v != null && v !== '' && v.toString().toLowerCase() === current && index !== controlIndex;
    });
    return exists ? { addressExists: true } : null;
  };
}
