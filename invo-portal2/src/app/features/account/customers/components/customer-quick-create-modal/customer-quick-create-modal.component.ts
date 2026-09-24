import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { Customer } from '../../models/customer.model';
import { CustomersService } from '../../services/customers.service';
import { buildCustomerForm } from '../../services/customer-form.builder';
import { CustomerFormDetailsComponent } from '../customer-form-details/customer-form-details.component';

/**
 * Create a customer without leaving the current screen (parent-customer picker,
 * and later invoices / vouchers pickers). Legacy `customer-form-popup`: the same
 * form body, saved through `accounts/saveCustomer`; closes with
 * `{ customerId, customerName }` so the caller can select the new customer.
 */
@Component({
  selector: 'app-customer-quick-create-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, CustomerFormDetailsComponent],
  template: `
    <app-modal-header [title]="'CUSTOMERS.FORM.NEW_CUSTOMER' | translate"/>
    @if (customerForm) {
      <form [formGroup]="customerForm" class="cqc__body" (keydown.enter)="$event.preventDefault()">
        <app-customer-form-details [customerData]="customerData" [customerForm]="customerForm"
          formStatus="new" [allowCreateParent]="false"/>
      </form>
    }
    <app-modal-footer>
      <button type="button" class="cqc-btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="cqc-btn cqc-btn--primary" [disabled]="!canSave || saving" (click)="save()">{{ 'COMMON.SAVE' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .cqc__body { padding: 16px 20px; max-height: 68vh; overflow-y: auto; min-width: 640px; max-width: 100%; }
    .cqc-btn {
      padding: 9px 18px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff;
      color: #334155; font-size: 13.5px; font-weight: 600; cursor: pointer;
    }
    .cqc-btn:hover { background: #f8fafc; }
    .cqc-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cqc-btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
    .cqc-btn--primary:hover:not(:disabled) { background: #227d8d; }
  `],
})
export class CustomerQuickCreateModalComponent implements OnInit {
  ref = inject<ModalRef<{ customerId: string; customerName: string } | null>>(MODAL_REF);
  private service = inject(CustomersService);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);

  customerData = new Customer();
  customerForm: FormGroup | null = null;
  saving = false;

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/customers');
    this.customerForm = buildCustomerForm(this.customerData, this.service, () => null);
  }

  get canSave(): boolean {
    return !!this.customerForm?.valid && this.customerData.is_email_valid && !this.customerForm?.pending;
  }

  async save(): Promise<void> {
    if (!this.canSave || this.saving) return;
    this.saving = true;
    try {
      const res: any = await this.service.saveCustomer(this.customerData);
      if (res?.success) this.ref.close({ customerId: res.data?.id, customerName: this.customerData.name });
      else this.toast.error('CUSTOMERS.FORM.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
    } finally {
      this.saving = false;
    }
  }
}
