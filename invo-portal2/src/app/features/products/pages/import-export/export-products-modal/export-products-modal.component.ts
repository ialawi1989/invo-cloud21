import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { ProductCrudService } from '../../../services/product-crud.service';

type ExportType = 'csv' | 'xlsx';

/**
 * Export step of the local-catalogue Import/Export screen — an "Options"
 * style modal (format choice → confirm) matching the Import wizard's own
 * options step, instead of a fire-and-forget dropdown that gave no loading
 * state and swallowed errors.
 */
@Component({
  selector: 'app-export-products-modal',
  standalone: true,
  imports: [TranslateModule, ModalHeaderComponent, ModalFooterComponent, SegmentedToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './export-products-modal.component.html',
  styleUrl: './export-products-modal.component.scss',
})
export class ExportProductsModalComponent {
  ref = inject<ModalRef<void>>(MODAL_REF);
  private readonly crud = inject(ProductCrudService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly formatOptions: SegmentedToggleOption<ExportType>[] = [
    { value: 'csv', label: 'PRODUCTS.IMPORT_EXPORT.EXPORT.CSV' },
    { value: 'xlsx', label: 'PRODUCTS.IMPORT_EXPORT.EXPORT.XLSX' },
  ];

  format = signal<ExportType>('csv');
  exporting = signal(false);
  errorMsg = signal('');

  async startExport(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.errorMsg.set('');
    try {
      await this.crud.exportProducts(this.format());
      this.toast.success('PRODUCTS.IMPORT_EXPORT.EXPORT.DONE');
      this.ref.close();
    } catch (err: any) {
      this.errorMsg.set(
        err?.message || this.translate.instant('PRODUCTS.IMPORT_EXPORT.EXPORT.FAILED'),
      );
    } finally {
      this.exporting.set(false);
    }
  }

  cancel(): void {
    this.ref.dismiss();
  }
}
