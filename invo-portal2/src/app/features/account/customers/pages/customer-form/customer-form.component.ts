import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { Customer } from '../../models/customer.model';
import { CustomersService } from '../../services/customers.service';
import { buildCustomerForm } from '../../services/customer-form.builder';
import { CustomerFormDetailsComponent } from '../../components/customer-form-details/customer-form-details.component';

/**
 * Customers → create / edit page (`/account/customers/new`, `/account/customers/:id`).
 * Legacy `CustomerFormComponent`: loads the customer, builds the validated form,
 * saves through `accounts/saveCustomer`, then returns to the list keeping its
 * page / limit / search query params.
 */
@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TranslateModule, BreadcrumbsComponent, FormStickyFooterComponent,
    CustomerFormDetailsComponent,
  ],
  templateUrl: './customer-form.component.html',
  styleUrl: './customer-form.component.scss',
})
export class CustomerFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(CustomersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  customerForm: FormGroup | null = null;
  customerData = new Customer();
  formStatus: 'new' | 'edit' = 'new';
  saving = false;
  breadcrumbs: BreadcrumbItem[] = [];
  private params: Record<string, any> = {};
  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/customers');
    const q = this.route.snapshot.queryParams;
    for (const k of ['pageNum', 'pageLimit', 'searchTerm']) if (q[k]) this.params[k] = q[k];

    const id = this.route.snapshot.paramMap.get('id');
    const isNew = !id || id === '0' || id === 'new';
    this.formStatus = isNew ? 'new' : 'edit';
    if (!isNew) this.customerData = await this.service.getCustomer(id!);

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('CUSTOMERS.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('CUSTOMERS.TEXT'), routerLink: '/account/customers' },
      { label: t(isNew ? 'CUSTOMERS.FORM.NEW_CUSTOMER' : 'CUSTOMERS.FORM.EDIT_CUSTOMER') },
    ];

    this.customerForm = buildCustomerForm(this.customerData, this.service, () => (isNew ? null : id));
    this.cdr.detectChanges();
  }

  hasUnsavedChanges(): boolean {
    return !this.saving && !!this.customerForm?.dirty;
  }

  get canSave(): boolean {
    return !!this.customerForm?.valid && this.customerData.is_email_valid && !this.customerForm?.pending;
  }

  async save(): Promise<void> {
    if (!this.customerForm || !this.canSave || this.saving) return;
    this.saving = true;
    try {
      const res: any = await this.service.saveCustomer(this.customerData);
      if (res?.success) {
        this.customerForm.markAsPristine();
        this.customerForm.markAsUntouched();
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/account/customers'], { queryParams: this.params });
      } else {
        this.toast.error('CUSTOMERS.FORM.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
      }
    } finally {
      this.saving = false;
    }
  }

  cancel(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigate(['/account/customers'], { queryParams: this.params });
  }
}
