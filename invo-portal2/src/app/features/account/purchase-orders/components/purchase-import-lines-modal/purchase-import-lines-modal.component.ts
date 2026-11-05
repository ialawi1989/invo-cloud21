import '../../../account-i18n';
import { Component, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import * as XLSX from 'xlsx';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { LanguageService } from '@core/i18n/language.service';

export interface PurchaseImportRow { barcode: string; productName: string; SIC: string; qty: number; unitCost: number; }
export interface PurchaseImportResult { lines: PurchaseImportRow[]; skipDuplicate: boolean; }

const TEMPLATE = [
  ['ProductName', 'Barcode', 'Quantity', 'UnitCost', 'SIC'],
  ['Example Product', 'BARCODE123', 5, 100, 'SIC001'],
];

const norm = (h: unknown) => (h ? String(h).trim().toLowerCase().replace(/[\s_]+/g, '') : '');

/**
 * "Import" of a purchase document's lines from a CSV / XLSX file (legacy `ExportImportLinesComponent`):
 * columns ProductName, Barcode, Quantity, UnitCost, SIC - found by header name (with the usual aliases) and
 * falling back to that order. A row needs a barcode or a product name; the caller matches them to products
 * and turns what it can't match into note lines.
 */
@Component({
  selector: 'app-purchase-import-lines-modal',
  standalone: true,
  imports: [TranslateModule, ModalHeaderComponent, ModalFooterComponent, DropdownMenuBtnComponent],
  template: `
    <app-modal-header [title]="'PURCHASE_ORDERS.IMPORT.TITLE' | translate"/>
    <div class="im">
      <label class="im__label">{{ 'DOC_IMPORT.FILE' | translate }}</label>
      <input class="im__file" type="file" accept=".csv,.xlsx,.xls" (change)="onFile($event)"/>
      @if (fileError()) { <p class="im__err">{{ 'DOC_IMPORT.ONLY_CSV' | translate }}</p> }
      @if (rows().length) { <p class="im__ok">{{ 'DOC_IMPORT.READY' | translate: { count: rows().length } }}</p> }
      @if (skipped().length) {
        <div class="im__warn">
          <b>{{ 'DOC_IMPORT.SKIPPED' | translate }}</b>
          <ul>@for (s of skipped(); track s) { <li>{{ s }}</li> }</ul>
        </div>
      }
      <label class="im__switch">
        <input type="checkbox" [checked]="skipDuplicate()" (change)="skipDuplicate.set($any($event.target).checked)"/>
        {{ 'DOC_IMPORT.SKIP_DUPLICATE' | translate }}
      </label>
    </div>
    <app-modal-footer>
      <span class="im__tpl">{{ 'DOC_IMPORT.TEMPLATE' | translate }}</span>
      <app-dropdown-menu-btn [items]="templateMenu()" [appendToBody]="true" align="end" triggerClass="im__btn">{{ 'DOC_IMPORT.DOWNLOAD' | translate }}</app-dropdown-menu-btn>
      <button type="button" class="im__btn im__btn--primary" [disabled]="!rows().length" (click)="apply()">{{ 'DOC_IMPORT.IMPORT' | translate }}</button>
      <button type="button" class="im__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .im { padding: 16px 24px; display: flex; flex-direction: column; gap: 10px; }
    .im__label { font-size: 13px; font-weight: 600; color: #334155; }
    .im__file { border: 1px solid #d0d5dd; border-radius: 8px; padding: 8px; font: inherit; font-size: 13px; }
    .im__err { margin: 0; color: #dc2626; font-size: 12.5px; }
    .im__ok { margin: 0; color: #227d8d; font-size: 13px; }
    .im__warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; border-radius: 8px; padding: 8px 12px; font-size: 12.5px; max-height: 140px; overflow: auto; }
    .im__warn ul { margin: 4px 0 0; padding-inline-start: 18px; }
    .im__switch { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; color: #334155; cursor: pointer; }
    .im__tpl { margin-inline-end: auto; font-size: 13px; color: #64748b; }
    :host ::ng-deep .im__btn, .im__btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .im__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
    .im__btn:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class PurchaseImportLinesModalComponent {
  ref = inject<ModalRef<PurchaseImportResult | null>>(MODAL_REF);
  private lang = inject(LanguageService);

  rows = signal<PurchaseImportRow[]>([]);
  skipped = signal<string[]>([]);
  fileError = signal(false);
  skipDuplicate = signal(true);

  templateMenu = (): DropdownMenuBtnItem[] => [
    { label: 'CSV', click: () => this.downloadTemplate('csv'), disabled: false, danger: false },
    { label: 'XLSX', click: () => this.downloadTemplate('xlsx'), disabled: false, danger: false },
  ];

  downloadTemplate(type: 'csv' | 'xlsx'): void {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(TEMPLATE), 'Lines');
    XLSX.writeFile(wb, `purchase-order-lines-template.${type}`, { bookType: type });
  }

  /** Column positions from the header row (by name, with aliases) - the template order when a name isn't found. */
  private detectColumns(header: unknown[]): { productName: number; barcode: number; quantity: number; unitCost: number; sic: number } {
    const d = { productName: 0, barcode: 1, quantity: 2, unitCost: 3, sic: 4 };
    if (!Array.isArray(header) || !header.length) return d;
    const h = header.map(norm);
    const find = (aliases: string[]) => h.findIndex(x => aliases.includes(x));
    const barcode = find(['barcode', 'bar_code', 'sku', 'itemcode']);
    const name = find(['productname', 'product', 'name', 'itemname', 'description']);
    const qty = find(['quantity', 'qty', 'count']);
    const cost = find(['unitcost', 'cost', 'price', 'unitprice']);
    const sic = find(['sic', 'supplieritemcode', 'suppliercode']);
    return {
      barcode: barcode >= 0 ? barcode : d.barcode,
      productName: name >= 0 ? name : (barcode === 0 ? -1 : d.productName),
      quantity: qty >= 0 ? qty : d.quantity,
      unitCost: cost >= 0 ? cost : d.unitCost,
      sic: sic >= 0 ? sic : d.sic,
    };
  }

  async onFile(ev: Event): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0];
    this.rows.set([]);
    this.skipped.set([]);
    this.fileError.set(false);
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const data: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true });
      const col = this.detectColumns(data[0]);
      const cell = (r: any[], i: number) => (i >= 0 && r[i] !== '' && r[i] != null ? String(r[i]).trim() : '');
      const ok: PurchaseImportRow[] = [];
      const bad: string[] = [];

      data.slice(1).forEach((r, i) => {
        const productName = cell(r, col.productName);
        const barcode = cell(r, col.barcode);
        const sic = cell(r, col.sic);
        const qty = Number(r[col.quantity]) || 0;
        const unitCost = Number(r[col.unitCost]) || 0;
        if (!productName && !barcode && !qty && !unitCost && !sic) return;

        const row = i + 2;
        const id = barcode || productName;
        if (!barcode && !productName) { bad.push(this.lang.instant('PURCHASE_ORDERS.IMPORT.ERR_IDENTIFIER', { row })); return; }
        if (qty < 0) { bad.push(this.lang.instant('PURCHASE_ORDERS.IMPORT.ERR_QTY', { row, name: id })); return; }
        if (unitCost < 0) { bad.push(this.lang.instant('PURCHASE_ORDERS.IMPORT.ERR_COST', { row, name: id })); return; }
        ok.push({ barcode, productName, SIC: sic, qty: qty > 0 ? qty : 1, unitCost: unitCost > 0 ? unitCost : 0 });
      });
      this.rows.set(ok);
      this.skipped.set(bad);
    } catch {
      this.fileError.set(true);
    }
  }

  apply(): void { this.ref.close({ lines: this.rows(), skipDuplicate: this.skipDuplicate() }); }
}
