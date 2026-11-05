import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import * as XLSX from 'xlsx';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

/** One row of the file: the product's barcode, the supplier's own code, minimum order and unit cost. */
export interface SupplierImportLine { barcode: string; SIC: string; minimumOrder: number; unitCost: number }
export interface SupplierImportResult { lines: SupplierImportLine[]; errors: { row: number; barcode: string; SIC: string; reason: string }[] }

const TEMPLATE = [
  ['Barcode', 'Supplier Item Code', 'Minimum Order', 'Unit Cost'],
  ['BARCODE123', 'SUPPLIER123', 0, 0],
];

/**
 * "Import" of a supplier's items from a CSV / XLSX file (legacy `ExportImportLinesComponent`): columns
 * Barcode, Supplier Item Code, Minimum Order, Unit Cost. Rows without a barcode are reported, not imported.
 * Closes with `{ lines, errors }`.
 */
@Component({
  selector: 'app-supplier-items-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, DropdownMenuBtnComponent],
  template: `
    <app-modal-header [title]="'SUPPLIERS.ITEMS.IMPORT_TITLE' | translate"/>
    <div class="im">
      <p class="im__hint">{{ 'SUPPLIERS.ITEMS.IMPORT_HINT' | translate }}</p>
      <div class="im__row">
        <input class="im__file" type="file" accept=".csv,.xlsx,.xls" (change)="onFile($event)"/>
        <app-dropdown-menu-btn [items]="templateMenu()" [appendToBody]="true" align="end" triggerClass="im__btn">{{ 'SUPPLIERS.ITEMS.DOWNLOAD_TEMPLATE' | translate }}</app-dropdown-menu-btn>
      </div>
      @if (error()) { <p class="im__error">{{ 'SUPPLIERS.ITEMS.FILE_ERROR' | translate }}</p> }
      @if (rows().length) { <p class="im__ok">{{ rows().length }} {{ 'SUPPLIERS.ITEMS.ROWS_READ' | translate }}</p> }
    </div>
    <app-modal-footer>
      <button type="button" class="im__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="im__btn im__btn--primary" [disabled]="!rows().length" (click)="importRows()">{{ 'SUPPLIERS.ITEMS.IMPORT' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .im { padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; min-width: 460px; max-width: 100%; }
    .im__hint { margin: 0; color: #64748b; font-size: 13px; }
    .im__row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .im__file { flex: 1; font: inherit; }
    .im__error { margin: 0; color: #dc2626; font-size: 13px; }
    .im__ok { margin: 0; color: #15803d; font-size: 13px; }
    .im__btn { padding: 9px 18px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; cursor: pointer; }
    .im__btn:disabled { opacity: .5; cursor: not-allowed; }
    .im__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
  `],
})
export class SupplierItemsImportModalComponent {
  ref = inject<ModalRef<SupplierImportResult | null>>(MODAL_REF);

  rows = signal<any[][]>([]);
  error = signal(false);

  templateMenu = (): DropdownMenuBtnItem[] => [
    { label: 'CSV', click: () => this.downloadTemplate('csv'), disabled: false, danger: false },
    { label: 'XLSX', click: () => this.downloadTemplate('xlsx'), disabled: false, danger: false },
  ];

  downloadTemplate(type: 'csv' | 'xlsx'): void {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(TEMPLATE), 'Items');
    XLSX.writeFile(wb, `suppliers-list-template.${type}`, { bookType: type });
  }

  async onFile(ev: Event): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // First row is the header (legacy skips it).
      this.rows.set((XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as any[][]).slice(1));
      this.error.set(false);
    } catch {
      this.rows.set([]);
      this.error.set(true);
    }
  }

  importRows(): void {
    const lines: SupplierImportLine[] = [];
    const errors: SupplierImportResult['errors'] = [];
    this.rows().forEach((r, i) => {
      if (!r[0] && !r[1] && !r[2] && !r[3]) return;
      const barcode = String(r[0] ?? '').trim();
      if (!barcode) { errors.push({ row: i + 2, barcode: '', SIC: String(r[1] ?? ''), reason: 'Barcode is required' }); return; }
      lines.push({ barcode, SIC: String(r[1] ?? ''), minimumOrder: Number(r[2]) || 0, unitCost: Number(r[3]) || 0 });
    });
    this.ref.close({ lines, errors });
  }
}
