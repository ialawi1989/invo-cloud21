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

import { Supplier } from '../../models/supplier.model';
import { SuppliersService } from '../../services/suppliers.service';
import { buildSupplierForm } from '../../services/supplier-form.builder';
import { SupplierFormDetailsComponent } from '../../components/supplier-form-details/supplier-form-details.component';

/**
 * Suppliers → create / edit page (`/account/suppliers/new`, `/account/suppliers/:id`). Legacy
 * `SupplierFormComponent`: loads the supplier, builds the validated form, saves through
 * `accounts/saveSupplier` (only the modified supplier items travel), then returns to the list keeping its
 * page / limit / search query params.
 */
@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, BreadcrumbsComponent, FormStickyFooterComponent, SupplierFormDetailsComponent],
  templateUrl: './supplier-form.component.html',
  styleUrl: './supplier-form.component.scss',
})
export class SupplierFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(SuppliersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  supplierForm: FormGroup | null = null;
  supplierData = new Supplier();
  formStatus: 'new' | 'edit' = 'new';
  saving = false;
  breadcrumbs: BreadcrumbItem[] = [];
  private params: Record<string, any> = {};
  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/suppliers');
    const q = this.route.snapshot.queryParams;
    for (const k of ['pageNum', 'pageLimit', 'searchTerm']) if (q[k]) this.params[k] = q[k];

    const id = this.route.snapshot.paramMap.get('id');
    const isNew = !id || id === '0' || id === 'new';
    this.formStatus = isNew ? 'new' : 'edit';
    if (!isNew) this.supplierData = await this.service.getSupplier(id!);
    else this.supplierData.active = true;

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('SUPPLIERS.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('SUPPLIERS.TEXT'), routerLink: '/account/suppliers' },
      { label: t(isNew ? 'SUPPLIERS.FORM.NEW_SUPPLIER' : 'SUPPLIERS.FORM.EDIT_SUPPLIER') },
    ];

    this.supplierForm = buildSupplierForm(this.supplierData, this.service, () => (isNew ? null : id));
    this.cdr.detectChanges();
  }

  hasUnsavedChanges(): boolean { return !this.saving && !!this.supplierForm?.dirty; }

  get canSave(): boolean {
    return !!this.supplierForm?.valid && this.supplierData.is_email_valid && !this.supplierForm?.pending;
  }

  async save(): Promise<void> {
    if (!this.supplierForm || !this.canSave || this.saving) return;
    this.saving = true;
    try {
      // Like legacy: rows without a product are dropped and only the modified items are sent.
      const items = this.supplierData.supplierItems;
      this.supplierData.supplierItems = items.filter(i => !!i.productId && i.modified);
      const res: any = await this.service.saveSupplier(this.supplierData);
      if (res?.success) {
        this.supplierForm.markAsPristine();
        this.supplierForm.markAsUntouched();
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/account/suppliers'], { queryParams: this.params });
      } else {
        this.supplierData.supplierItems = items;
        this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.saving = false;
    }
  }

  cancel(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigate(['/account/suppliers'], { queryParams: this.params });
  }
}
