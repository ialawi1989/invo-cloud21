import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';

import { Customer } from '../models/customer.model';
import { addressTitleUniqueValidator, customerFieldExistsValidator } from './customer-validators';
import { CustomersService } from './customers.service';

export const PHONE_LENGTH = 8;
const PHONE_PATTERN = /^\+?\d{1,4}[-\s]?\d{3,14}$/;

/**
 * The reactive form behind the customer form (page and quick-create dialog):
 * required name, required + unique phone, optional unique mobile, and one
 * `addressTitle` control per address — same rules as the legacy form.
 * `getId` supplies the customer id for the uniqueness probes (0 / null = new).
 */
export function buildCustomerForm(customer: Customer, service: CustomersService, getId: () => any): FormGroup {
  const addresses = customer.addresses.map(address =>
    new FormGroup({
      addressTitle: new FormControl(address.title, [
        Validators.required,
        addressTitleUniqueValidator(() => customer.addresses),
      ]),
    }),
  );

  return new FormGroup({
    name: new FormControl(customer.name, [Validators.required]),
    phone: new FormControl(
      customer.phone,
      [Validators.required, Validators.pattern(PHONE_PATTERN), Validators.minLength(PHONE_LENGTH)],
      [customerFieldExistsValidator(service, getId, 'phoneExists')],
    ),
    mobile: new FormControl(
      customer.mobile,
      [Validators.pattern(PHONE_PATTERN), Validators.minLength(PHONE_LENGTH)],
      [customerFieldExistsValidator(service, getId, 'mobileExists')],
    ),
    addresses: new FormArray(addresses),
  });
}
