import '../../account-i18n';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';

import { CustomerAddress } from '../../customers/models/customer.model';
import { CustomersService } from '../../customers/services/customers.service';
import { AddAddressModalComponent, AddAddressModalData } from '../../customers/components/add-address-modal/add-address-modal.component';

/**
 * Customer address picker with "Add new address" (legacy `app-customer-address-selector`): loads the
 * customer's addresses, selects the saved one (`initialTitle`) or the default, and lets the user add
 * another through the add-address dialog (persisted with `accounts/setCustomerAddresses`).
 * Emits the selected address (or a blank one) whenever it changes, including after load.
 */
@Component({
  selector: 'app-customer-address-field',
  standalone: true,
  imports: [TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="caf__label">{{ 'DOC_FORM.CUSTOMER_ADDRESS' | translate }} @if (required()) { <span class="req">*</span> }</label>
    @if (addresses().length) {
      <app-search-dropdown [items]="addresses()" [displayWith]="label" [compareWith]="same" [searchable]="false"
        [value]="selected()" (valueChange)="pick($any($event)?.title ?? '')"
        [clearable]="!required()" [placeholder]="'DOC_FORM.SELECT_ADDRESS' | translate">
        <ng-template #footer>
          <button type="button" class="caf__new" (mousedown)="$event.preventDefault()" (click)="add()">
            <span class="caf__plus">+</span> {{ 'DOC_FORM.ADD_ADDRESS' | translate }}
          </button>
        </ng-template>
      </app-search-dropdown>
    } @else {
      <div class="caf__warn">
        <span>{{ 'DOC_FORM.NO_ADDRESSES' | translate }}</span>
        <button type="button" class="caf__add" (click)="add()">+ {{ 'DOC_FORM.ADD_ADDRESS' | translate }}</button>
      </div>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 6px; }
    .caf__label { font-size: 13px; font-weight: 600; color: #334155; }
    .caf__label .req { color: #dc2626; }
    .caf__warn { padding: 8px 12px; border-radius: 8px; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: 13px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .caf__new { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; border: 0; background: none; color: #227d8d; font-weight: 500; cursor: pointer; text-align: start; }
    .caf__new:hover { background: #f1f5f9; }
    .caf__plus { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: #227d8d; color: #fff; font-size: 14px; line-height: 1; }
    .caf__add { white-space: nowrap; padding: 0; border: 0; background: none; color: #227d8d; font-size: 13px; font-weight: 600; cursor: pointer; }
    .caf__add:hover { text-decoration: underline; }
  `],
})
export class CustomerAddressFieldComponent {
  private customers = inject(CustomersService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  customerId = input<string | null>(null);
  required = input<boolean>(false);
  /** Title of an already-saved address to preselect on first load (editing). */
  initialTitle = input<string>('');
  addressChange = output<CustomerAddress>();

  addresses = signal<CustomerAddress[]>([]);
  private title = signal('');
  private firstLoad = true;

  label = (a: CustomerAddress) => a?.title ?? '';
  same = (a: CustomerAddress, b: CustomerAddress) => a?.title === b?.title;
  selected = () => this.addresses().find(a => a.title == this.title()) ?? null;

  constructor() {
    effect(() => {
      const id = this.customerId();
      void this.load(id);
    });
  }

  private parse(raw: any[]): CustomerAddress[] {
    return (raw ?? []).map(r => { const a = new CustomerAddress(); a.ParseJson(r); return a; });
  }

  private async load(customerId: string | null): Promise<void> {
    if (!customerId || customerId === 'WalkIn Customer') {
      this.addresses.set([]);
      this.pick('');
      return;
    }
    const list = this.parse(await this.customers.customerAddresses(customerId));
    this.addresses.set(list);
    const saved = this.firstLoad && this.initialTitle() ? list.find(a => a.title == this.initialTitle()) : undefined;
    this.firstLoad = false;
    const chosen = saved ?? list.find(a => a.isDefault) ?? list[0];
    this.pick(chosen?.title ?? '');
  }

  pick(title: string): void {
    this.title.set(title);
    this.addressChange.emit(this.addresses().find(a => a.title == title) ?? new CustomerAddress());
  }

  async add(): Promise<void> {
    const id = this.customerId();
    if (!id) return;
    const customer: any = await this.customers.getCustomer(id).catch(() => null);
    const created = await this.modal.open<AddAddressModalComponent, AddAddressModalData, CustomerAddress | null>(
      AddAddressModalComponent,
      { size: 'lg', data: { customerType: customer?.type === 'Business' ? 'Business' : 'Individual', existingTitles: this.addresses().map(a => a.title) } },
    ).afterClosed();
    if (!created) return;
    if (this.addresses().length === 0) created.isDefault = true;
    const res: any = await this.customers.setCustomerAddresses(id, [...this.addresses(), created]);
    if (res?.success) {
      this.addresses.set(this.parse(await this.customers.customerAddresses(id)));
      this.pick(created.title);
    } else {
      this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
    }
  }
}
