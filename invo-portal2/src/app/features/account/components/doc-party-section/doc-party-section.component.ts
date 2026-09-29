import '../../account-i18n';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown';
import { CustomerMini, CustomerPickerComponent } from '@shared/components/customer-picker/customer-picker.component';
import { CustomerAddress } from '../../customers/models/customer.model';

/**
 * "Customer Information" card shared by the sales documents: the customer picker (create new +
 * advanced search) and, once a customer with addresses is chosen, an address dropdown. The
 * parent owns the state; this only renders it and raises events.
 */
@Component({
  selector: 'app-doc-party-section',
  standalone: true,
  imports: [TranslateModule, SearchDropdownComponent, CustomerPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="df-card">
      <h2 class="df-card__title">{{ 'DOC_FORM.CUSTOMER_INFORMATION' | translate }}</h2>
      <div class="df-field df-field--wide">
        <label>{{ 'DOC_FORM.CUSTOMER_NAME' | translate }} <span class="req">*</span></label>
        <app-customer-picker [value]="customer()" [allowCreate]="true" [allowAdvanced]="true"
          [placeholder]="'DOC_FORM.SELECT_CUSTOMER' | translate"
          (advancedSearch)="advancedSearch.emit()" (valueChange)="customerChange.emit($event)" (createNew)="createNew.emit()"/>
        @if (error()) { <p class="df-error">{{ error() }}</p> }
      </div>
      @if (addresses().length || addressRequired()) {
        <div class="df-field df-field--wide">
          <label>{{ 'DOC_FORM.CUSTOMER_ADDRESS' | translate }} @if (addressRequired()) { <span class="req">*</span> }</label>
          @if (addresses().length) {
            <app-search-dropdown [items]="addresses()" [displayWith]="label" [compareWith]="same" [searchable]="false"
              [value]="selected()" (valueChange)="addressChange.emit($any($event)?.title ?? '')"
              [clearable]="!addressRequired()" [placeholder]="'DOC_FORM.SELECT_ADDRESS' | translate"/>
          } @else {
            <div class="df-warn">{{ 'DOC_FORM.NO_ADDRESSES' | translate }} @if (addressRequired()) { {{ 'DOC_FORM.ADDRESS_REQUIRED_HINT' | translate }} }</div>
          }
        </div>
      }
      <ng-content/>
    </section>
  `,
})
export class DocPartySectionComponent {
  customer = input<CustomerMini | null>(null);
  addresses = input<CustomerAddress[]>([]);
  /** Title of the selected address. */
  address = input<string>('');
  /** Address becomes mandatory (e.g. Delivery invoices). */
  addressRequired = input<boolean>(false);
  error = input<string>('');

  customerChange = output<CustomerMini | undefined>();
  addressChange = output<string>();
  createNew = output<void>();
  advancedSearch = output<void>();

  label = (a: CustomerAddress) => a?.title ?? '';
  same = (a: CustomerAddress, b: CustomerAddress) => a?.title === b?.title;
  selected = () => this.addresses().find(a => a.title == this.address()) ?? null;
}
