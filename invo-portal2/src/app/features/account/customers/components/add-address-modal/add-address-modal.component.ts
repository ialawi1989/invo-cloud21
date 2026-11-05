import '../../../account-i18n';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { CountriesService, Country } from '@shared/services/countries.service';

import { CustomerAddress } from '../../models/customer.model';

export interface AddAddressModalData {
  /** Individual shows Block/Road/Building/Flat/City; Business shows the fuller address-line layout. */
  customerType: 'Business' | 'Individual';
  /** Existing address titles of the customer, to block duplicates. */
  existingTitles: string[];
}

/**
 * Standalone "create one address" dialog (legacy add-address-modal): same fields and title
 * presets as the customer form's address card, but self-contained so any document form with a
 * customer picker can add an address. Closes with the new CustomerAddress (or null).
 */
@Component({
  selector: 'app-add-address-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, SearchDropdownComponent],
  template: `
    <app-modal-header [title]="'CUSTOMERS.FORM.ADD_ADDRESS' | translate"/>
    <div class="aa__body">
      <div class="aa-field">
        <label>{{ 'CUSTOMERS.FORM.CUSTOMER_TYPE' | translate }}</label>
        <div class="aa-presets">
          <button type="button" class="aa-chip" [class.is-on]="type() === 'Individual'" (click)="changeType('Individual')">{{ 'CUSTOMERS.FORM.INDIVIDUAL' | translate }}</button>
          <button type="button" class="aa-chip" [class.is-on]="type() === 'Business'" (click)="changeType('Business')">{{ 'CUSTOMERS.FORM.BUSINESS' | translate }}</button>
        </div>
      </div>

      <div class="aa-field">
        <label>{{ 'CUSTOMERS.FORM.ADDRESS_TITLE' | translate }}</label>
        <input type="text" class="aa-input" [class.is-invalid]="submitted() && titleError" [(ngModel)]="address.title"/>
        @if (submitted() && titleError === 'required') { <p class="aa-error">{{ 'CUSTOMERS.FORM.THIS_VALUE_IS_REQUIRED' | translate }}</p> }
        @if (submitted() && titleError === 'exists') { <p class="aa-error">{{ 'CUSTOMERS.FORM.NAME_EXISTS' | translate }}</p> }
        <div class="aa-presets">
          @for (p of presets; track p.id) {
            <button type="button" class="aa-chip" [class.is-on]="address.title === p.id" (click)="address.title = p.id">{{ p.key | translate }}</button>
          }
        </div>
      </div>

      <div class="aa-grid">
        @if (type() !== 'Business') {
          <div class="aa-field"><label>{{ 'CUSTOMERS.FORM.BLOCK' | translate }}</label><input type="text" class="aa-input" [(ngModel)]="address.block"/></div>
          <div class="aa-field"><label>{{ 'CUSTOMERS.FORM.ROAD' | translate }}</label><input type="text" class="aa-input" [(ngModel)]="address.road"/></div>
          <div class="aa-field"><label>{{ 'CUSTOMERS.FORM.BUILDING' | translate }}</label><input type="text" class="aa-input" [(ngModel)]="address.building"/></div>
          <div class="aa-field"><label>{{ 'CUSTOMERS.FORM.FLAT' | translate }}</label><input type="text" class="aa-input" [(ngModel)]="address.flat"/></div>
          <div class="aa-field"><label>{{ 'CUSTOMERS.FORM.CITY' | translate }}</label><input type="text" class="aa-input" [(ngModel)]="address.city"/></div>
        } @else {
          <div class="aa-field">
            <label>{{ 'CUSTOMERS.FORM.COUNTRY' | translate }}</label>
            <app-search-dropdown [items]="countries()" [displayWith]="displayCountry" [compareWith]="compareCountry"
              [clearable]="true" [searchable]="true" [placeholder]="'CUSTOMERS.FORM.COUNTRY' | translate"
              [value]="address.country ? { name: address.country } : null"
              (valueChange)="address.country = $any($event)?.name ?? ''"/>
          </div>
          <div class="aa-field"><label>{{ 'CUSTOMERS.FORM.REGION' | translate }}</label><input type="text" class="aa-input" [(ngModel)]="address.region"/></div>
          <div class="aa-field"><label>{{ 'CUSTOMERS.FORM.ADDRESS_LINE_1' | translate }}</label><input type="text" class="aa-input" [(ngModel)]="address.addressLine1"/></div>
          <div class="aa-field"><label>{{ 'CUSTOMERS.FORM.ADDRESS_LINE_2' | translate }}</label><input type="text" class="aa-input" [(ngModel)]="address.addressLine2"/></div>
          <div class="aa-field"><label>{{ 'CUSTOMERS.FORM.CITY' | translate }}</label><input type="text" class="aa-input" [(ngModel)]="address.city"/></div>
          <div class="aa-field"><label>{{ 'CUSTOMERS.FORM.DISTRICT' | translate }}</label><input type="text" class="aa-input" [(ngModel)]="address.district"/></div>
          <div class="aa-field"><label>{{ 'CUSTOMERS.FORM.POSTAL_CODE' | translate }}</label><input type="text" class="aa-input" [(ngModel)]="address.postalCode"/></div>
          <div class="aa-field"><label>{{ 'CUSTOMERS.FORM.BUILDING' | translate }}</label><input type="text" class="aa-input" [(ngModel)]="address.building"/></div>
          <div class="aa-field"><label>{{ 'CUSTOMERS.FORM.OFFICE' | translate }}</label><input type="text" class="aa-input" [(ngModel)]="address.office"/></div>
        }
      </div>

      <div class="aa-field">
        <label>{{ 'CUSTOMERS.FORM.NOTE' | translate }}</label>
        <input type="text" class="aa-input" [(ngModel)]="address.note"/>
      </div>
    </div>
    <app-modal-footer>
      <button type="button" class="aa-btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="aa-btn aa-btn--primary" (click)="save()">{{ 'COMMON.SAVE' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .aa__body { padding: 16px 20px; max-height: 68vh; overflow-y: auto; min-width: 560px; max-width: 100%; display: flex; flex-direction: column; gap: 14px; }
    .aa-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .aa-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .aa-field > label { font-size: 13px; font-weight: 600; color: #334155; }
    .aa-input { padding: 9px 12px; border: 1px solid #d0d5dd; border-radius: 8px; font-size: 13.5px; color: #0f172a; font-family: inherit; }
    .aa-input:focus { outline: none; border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38, 145, 164, .12); }
    .aa-input.is-invalid { border-color: #dc2626; }
    .aa-error { margin: 0; font-size: 12px; color: #dc2626; }
    .aa-presets { display: flex; flex-wrap: wrap; gap: 8px; }
    .aa-chip { padding: 4px 12px; border-radius: 999px; border: 1px solid #d0d5dd; background: #fff; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; }
    .aa-chip.is-on { background: #2691a4; border-color: #2691a4; color: #fff; }
    .aa-btn { padding: 9px 18px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .aa-btn:hover { background: #f8fafc; }
    .aa-btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
    .aa-btn--primary:hover { background: #227d8d; }
  `],
})
export class AddAddressModalComponent implements OnInit {
  ref = inject<ModalRef<CustomerAddress | null>>(MODAL_REF);
  data = inject<AddAddressModalData>(MODAL_DATA);
  private lang = inject(LanguageService);
  private countriesSvc = inject(CountriesService);

  address = new CustomerAddress();
  type = signal<'Business' | 'Individual'>('Individual');
  countries = signal<Country[]>([]);
  submitted = signal(false);

  presets = [
    { id: 'Home', key: 'CUSTOMERS.FORM.LABEL_HOME' },
    { id: 'Office', key: 'CUSTOMERS.FORM.LABEL_OFFICE' },
    { id: 'Billing', key: 'CUSTOMERS.FORM.LABEL_BILLING' },
    { id: 'Shipping', key: 'CUSTOMERS.FORM.LABEL_SHIPPING' },
    { id: 'Warehouse', key: 'CUSTOMERS.FORM.LABEL_WAREHOUSE' },
  ];
  displayCountry = (c: any) => c?.name ?? '';
  compareCountry = (a: any, b: any) => a?.name === b?.name;

  async ngOnInit(): Promise<void> {
    this.type.set(this.data?.customerType ?? 'Individual');
    await this.lang.loadFeature('account/customers');
    this.countries.set(await this.countriesSvc.load().catch(() => []));
  }

  /** Carries typed data across layouts without overwriting anything already entered (legacy behaviour). */
  changeType(t: 'Business' | 'Individual'): void {
    if (t === this.type()) return;
    const a = this.address;
    if (t === 'Business') {
      if (!a.addressLine1 && (a.block || a.road)) {
        a.addressLine1 = [a.block ? `Block ${a.block}` : '', a.road ? `Road ${a.road}` : ''].filter(Boolean).join(', ');
      }
      if (!a.office && a.flat) a.office = a.flat;
    } else if (!a.flat && a.office) {
      a.flat = a.office;
    }
    this.type.set(t);
  }

  get titleError(): 'required' | 'exists' | null {
    const title = (this.address.title || '').trim();
    if (!title) return 'required';
    if ((this.data?.existingTitles ?? []).some(t => (t ?? '').toLowerCase() === title.toLowerCase())) return 'exists';
    return null;
  }

  save(): void {
    this.submitted.set(true);
    if (this.titleError) return;
    this.ref.close(this.address);
  }
}
