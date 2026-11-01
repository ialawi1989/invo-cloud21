import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as XLSX from 'xlsx';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { InventoryRequestService } from '../../../services/inventory-request.service';

export interface ExportRequestsData { id: string }
type ExportType = 'csv' | 'xlsx';

/**
 * Per-request export (legacy `export-import-requests`). The legacy modal's import half is commented
 * out in InvoCloudFront2, so only the export remains: the request's lines as
 * Barcode / Product / Qty / Supplier / Priority, in CSV or XLSX.
 */
@Component({
  selector: 'app-export-requests-modal',
  standalone: true,
  imports: [TranslateModule, ModalHeaderComponent, ModalFooterComponent, SegmentedToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './export-requests-modal.component.html',
  styleUrl: './export-requests-modal.component.scss',
})
export class ExportRequestsModalComponent {
  ref = inject<ModalRef<void>>(MODAL_REF);
  private data = inject<ExportRequestsData>(MODAL_DATA);
  private service = inject(InventoryRequestService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  readonly formatOptions: SegmentedToggleOption<ExportType>[] = [
    { value: 'csv', label: 'PRODUCTS.INVENTORY_REQUEST.EXPORT_MODAL.CSV' },
    { value: 'xlsx', label: 'PRODUCTS.INVENTORY_REQUEST.EXPORT_MODAL.XLSX' },
  ];

  format = signal<ExportType>('csv');
  exporting = signal(false);
  errorMsg = signal('');

  async startExport(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.errorMsg.set('');
    try {
      const req = await this.service.getById(this.data.id);
      if (!req) throw new Error(this.translate.instant('PRODUCTS.INVENTORY_REQUEST.NOT_FOUND'));
      const rows: (string | number)[][] = [['Barcode', 'Product', 'Qty', 'Supplier', 'Priority']];
      for (const l of req.lines) rows.push([l.barcode, l.productName, l.qty, l.supplierName, l.priority]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Inventory Request');
      const type = this.format();
      XLSX.writeFile(wb, `inventory-request-data.${type}`, { bookType: type });
      this.toast.success('PRODUCTS.INVENTORY_REQUEST.EXPORT_MODAL.DONE');
      this.ref.close();
    } catch (err: any) {
      this.errorMsg.set(err?.message || this.translate.instant('PRODUCTS.INVENTORY_REQUEST.EXPORT_MODAL.FAILED'));
    } finally {
      this.exporting.set(false);
    }
  }

  cancel(): void {
    this.ref.dismiss();
  }
}
