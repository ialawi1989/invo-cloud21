import '../../../account-i18n';
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

import { Supplier } from '../../models/supplier.model';
import { SuppliersService } from '../../services/suppliers.service';
import { buildSupplierForm } from '../../services/supplier-form.builder';
import { SupplierFormDetailsComponent } from '../supplier-form-details/supplier-form-details.component';

/**
 * Create a supplier without leaving the current screen (supplier pickers of purchase orders, bills, expenses,
 * bill payments …). Legacy opened the whole supplier form as a popup: the same form body, saved through
 * `accounts/saveSupplier`; closes with `{ supplierId, supplierName }` so the caller can select the new supplier.
 */
@Component({
  selector: 'app-supplier-quick-create-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, SupplierFormDetailsComponent],
  template: `
    <app-modal-header [title]="'SUPPLIERS.FORM.NEW_SUPPLIER' | translate"/>
    @if (supplierForm) {
      <form [formGroup]="supplierForm" class="sqc__body" (keydown.enter)="$event.preventDefault()">
        <app-supplier-form-details [supplierData]="supplierData" [supplierForm]="supplierForm" formStatus="new"/>
      </form>
    }
    <app-modal-footer>
      <button type="button" class="sqc-btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="sqc-btn sqc-btn--primary" [disabled]="!canSave || saving" (click)="save()">{{ 'COMMON.SAVE' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .sqc__body { padding: 16px 20px; max-height: 68vh; overflow-y: auto; min-width: 640px; max-width: 100%; }
    .sqc-btn { padding: 9px 18px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .sqc-btn:hover { background: #f8fafc; }
    .sqc-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sqc-btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
    .sqc-btn--primary:hover:not(:disabled) { background: #227d8d; }
  `],
})
export class SupplierQuickCreateModalComponent implements OnInit {
  ref = inject<ModalRef<{ supplierId: string; supplierName: string } | null>>(MODAL_REF);
  private service = inject(SuppliersService);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);

  supplierData = new Supplier();
  supplierForm: FormGroup | null = null;
  saving = false;

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/suppliers');
    this.supplierForm = buildSupplierForm(this.supplierData, this.service, () => null);
  }

  get canSave(): boolean {
    return !!this.supplierForm?.valid && this.supplierData.is_email_valid && !this.supplierForm?.pending;
  }

  async save(): Promise<void> {
    if (!this.canSave || this.saving) return;
    this.saving = true;
    try {
      const res: any = await this.service.saveSupplier(this.supplierData);
      if (res?.success) this.ref.close({ supplierId: res.data?.id, supplierName: this.supplierData.name });
      else this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.saving = false;
    }
  }
}
