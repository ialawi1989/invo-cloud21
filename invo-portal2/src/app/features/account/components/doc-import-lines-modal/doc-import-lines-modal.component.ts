import '../../account-i18n';
import { Component, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import * as XLSX from 'xlsx';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { LanguageService } from '@core/i18n/language.service';
import { parseNumberField } from '../../services/document-line-editor';

export interface ImportedLine { barcode: string; productName: string; qty: number; price: number | null; discountTotal: number; }
export interface ImportLinesResult { lines: ImportedLine[]; skipDuplicate: boolean; }

const TEMPLATE = [
  ['ProductName', 'Barcode', 'Quantity', 'Price', 'DiscountTotal'],
  ['Product A', 'BARCODE123', 1, 10.5, 0],
  ['Product B', 'BARCODE456', 2, 25, 0],
  ['Product C', 'BARCODE789', 5, 15.75, 2.5],
];

/**
 * "Import" of a document's lines from a CSV / XLSX file (columns: ProductName, Barcode, Quantity,
 * Price, DiscountTotal — first row is the header). Only rows with a barcode are kept; the caller
 * matches them to products and reports the barcodes it could not find.
 */
@Component({
  selector: 'app-doc-import-lines-modal',
  standalone: true,
  imports: [TranslateModule, ModalHeaderComponent, ModalFooterComponent, DropdownMenuBtnComponent],
  template: `
    <app-modal-header [title]="'DOC_IMPORT.TITLE' | translate"/>
    <div class="im">
      <label class="im__label">{{ 'DOC_IMPORT.FILE' | translate }}</label>
      <input class="im__file" type="file" accept=".csv,.xlsx,.xls" (change)="onFile($event)"/>
      @if (fileError()) { <p class="im__err">{{ 'DOC_IMPORT.ONLY_CSV' | translate }}</p> }
      @if (rows().length) {
        <p class="im__ok">{{ 'DOC_IMPORT.READY' | translate: { count: rows().length } }}</p>
      }
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
export class DocImportLinesModalComponent {
  ref = inject<ModalRef<ImportLinesResult | null>>(MODAL_REF);
  private lang = inject(LanguageService);

  rows = signal<ImportedLine[]>([]);
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
    XLSX.writeFile(wb, `lines-template.${type}`, { bookType: type });
  }

  async onFile(ev: Event): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0];
    this.rows.set([]);
    this.skipped.set([]);
    this.fileError.set(false);
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
      const ok: ImportedLine[] = [];
      const bad: string[] = [];
      data.slice(1).forEach((r, i) => {
        const name = String(r[0] ?? '').trim();
        const barcode = String(r[1] ?? '').trim();
        if (!name && !barcode && r[2] === '' && r[3] === '') return;
        if (!barcode) { bad.push(this.lang.instant('DOC_IMPORT.ROW_NO_BARCODE', { row: i + 2, name })); return; }
        ok.push({
          barcode, productName: name,
          qty: parseNumberField(r[2], 1) as number,
          price: parseNumberField(r[3], null),
          discountTotal: parseNumberField(r[4], 0) as number,
        });
      });
      this.rows.set(ok);
      this.skipped.set(bad);
    } catch {
      this.fileError.set(true);
    }
  }

  apply(): void { this.ref.close({ lines: this.rows(), skipDuplicate: this.skipDuplicate() }); }
}
