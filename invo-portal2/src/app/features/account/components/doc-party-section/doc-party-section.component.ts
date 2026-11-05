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
      <h2 class="df-card__title"><span class="df-ico df-ico--blue" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg></span>{{ 'DOC_FORM.CUSTOMER_INFORMATION' | translate }}</h2>
      <div class="df-field df-field--wide">
        <label>{{ 'DOC_FORM.CUSTOMER_NAME' | translate }} <span class="req">*</span></label>
        <app-customer-picker [value]="customer()" [allowCreate]="true" [allowAdvanced]="!locked()" [disabled]="locked()"
          [placeholder]="'DOC_FORM.SELECT_CUSTOMER' | translate"
          (advancedSearch)="advancedSearch.emit()" (valueChange)="customerChange.emit($event)" (createNew)="createNew.emit()"/>
        @if (error()) { <p class="df-error">{{ error() }}</p> }
      </div>
      @if (customer()) {
        <div class="df-field df-field--wide">
          <label>{{ 'DOC_FORM.CUSTOMER_ADDRESS' | translate }} @if (addressRequired()) { <span class="req">*</span> }</label>
          @if (addresses().length) {
            <app-search-dropdown [items]="addresses()" [displayWith]="label" [compareWith]="same" [searchable]="false"
              [value]="selected()" (valueChange)="addressChange.emit($any($event)?.title ?? '')"
              [clearable]="!addressRequired()" [placeholder]="'DOC_FORM.SELECT_ADDRESS' | translate">
              <ng-template #footer>
                <button type="button" class="dps-new" (mousedown)="$event.preventDefault()" (click)="addAddress.emit()">
                  <span class="dps-new__plus">+</span> {{ 'DOC_FORM.ADD_ADDRESS' | translate }}
                </button>
              </ng-template>
            </app-search-dropdown>
          } @else {
            <div class="df-warn dps-warn">
              <span>{{ 'DOC_FORM.NO_ADDRESSES' | translate }} @if (addressRequired()) { {{ 'DOC_FORM.ADDRESS_REQUIRED_HINT' | translate }} }</span>
              <button type="button" class="df-link" (click)="addAddress.emit()">+ {{ 'DOC_FORM.ADD_ADDRESS' | translate }}</button>
            </div>
          }
        </div>
      }
      <ng-content/>
    </section>
  `,
  styles: [`
    .dps-warn { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .df-link { background: none; border: 0; padding: 0; margin-top: 6px; cursor: pointer; white-space: nowrap; }
    .dps-warn .df-link { margin-top: 0; }
    .dps-new { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; border: 0; background: none; color: #227d8d; font-weight: 500; cursor: pointer; text-align: start; }
    .dps-new:hover { background: #f1f5f9; }
    .dps-new__plus { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: #227d8d; color: #fff; font-size: 14px; line-height: 1; }
  `],
})
export class DocPartySectionComponent {
  customer = input<CustomerMini | null>(null);
  addresses = input<CustomerAddress[]>([]);
  /** Title of the selected address. */
  address = input<string>('');
  /** Address becomes mandatory (e.g. Delivery invoices). */
  addressRequired = input<boolean>(false);
  error = input<string>('');
  /** Customer can't be changed any more. */
  locked = input<boolean>(false);

  customerChange = output<CustomerMini | undefined>();
  addressChange = output<string>();
  createNew = output<void>();
  addAddress = output<void>();
  advancedSearch = output<void>();

  label = (a: CustomerAddress) => a?.title ?? '';
  same = (a: CustomerAddress, b: CustomerAddress) => a?.title === b?.title;
  selected = () => this.addresses().find(a => a.title == this.address()) ?? null;
}
