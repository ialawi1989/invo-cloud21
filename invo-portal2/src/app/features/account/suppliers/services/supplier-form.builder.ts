import { AbstractControl, AsyncValidatorFn, FormArray, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Observable, from, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { Supplier, SupplierContact } from '../models/supplier.model';
import { SuppliersService } from './suppliers.service';

export const PHONE_LENGTH = 8;
const PHONE_PATTERN = /^\+?[0-9]+$/;
const DEBOUNCE_MS = 500;

/** `id` of 0 / '0' / 'new' means "new" and is sent as null (legacy `normalizeId`). */
const normalizeId = (id: any) => (id === '0' || id === 0 || id === 'new' ? null : id);

/**
 * Async "already used by another supplier" probe (`company/validateName`). Skips empty and untouched
 * controls like the legacy validator. The legacy supplier form probes the PHONE with table `supplier`
 * (error key `exist`) and the email with `supplierEmail` (`emailExists`) — kept as is.
 */
function existsValidator(service: SuppliersService, getId: () => any, tableName: string, errorKey: string): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = control.value?.trim();
    if (!value || !control.dirty) return of(null);
    return timer(DEBOUNCE_MS).pipe(
      switchMap(() => from(service.validateName({ tableName, id: normalizeId(getId()), name: control.value }))),
      map(res => (res?.success ? null : { [errorKey]: true })),
      catchError(() => of(null)),
    );
  };
}

/** A contact name / phone must be unique within the supplier's contacts. */
function uniqueInContacts(getContacts: () => SupplierContact[], prop: 'contact' | 'phone', errorKey: string): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const group = c.parent;
    const array = group?.parent;
    if (!(group instanceof FormGroup) || !(array instanceof FormArray)) return null;
    const index = array.controls.indexOf(group);
    const value = c.value?.toString().trim().toLowerCase();
    if (!value || index === -1) return null;
    const dup = getContacts().some((x, i) => i !== index && (x[prop] ?? '').toString().trim().toLowerCase() === value);
    return dup ? { [errorKey]: true } : null;
  };
}

/** One contact's controls: required name + phone, optional unique email. */
export function contactGroup(contact: SupplierContact, supplier: Supplier, service: SuppliersService, getId: () => any): FormGroup {
  return new FormGroup({
    contContactInput: new FormControl(contact.contact, [Validators.required, uniqueInContacts(() => supplier.contacts, 'contact', 'contactExists')]),
    contPhoneInput: new FormControl(contact.phone, [
      Validators.required, Validators.pattern(PHONE_PATTERN), Validators.minLength(PHONE_LENGTH),
      uniqueInContacts(() => supplier.contacts, 'phone', 'phoneExists'),
    ]),
    contEmailInput: new FormControl(contact.email, [Validators.email], [existsValidator(service, getId, 'supplierEmail', 'emailExists')]),
  });
}

/**
 * The reactive form behind the supplier form: required name, required + unique phone, optional unique
 * email, and one group per contact — same rules as the legacy form. `getId` supplies the supplier id for the
 * uniqueness probes (0 / null = new).
 */
export function buildSupplierForm(supplier: Supplier, service: SuppliersService, getId: () => any): FormGroup {
  return new FormGroup({
    supplierNameInput: new FormControl(supplier.name, [Validators.required]),
    supplierPhoneInput: new FormControl(
      supplier.phone,
      [Validators.required, Validators.pattern(PHONE_PATTERN), Validators.minLength(PHONE_LENGTH)],
      [existsValidator(service, getId, 'supplier', 'exist')],
    ),
    supplierEmailInput: new FormControl(supplier.email, [Validators.email], [existsValidator(service, getId, 'supplierEmail', 'emailExists')]),
    contacts: new FormArray(supplier.contacts.map(c => contactGroup(c, supplier, service, getId))),
  });
}
