import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { saveAs } from 'file-saver';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import {
  SegmentedToggleComponent, SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { parseCsv, CsvColumn } from '@shared/components/import-wizard/csv-parser';
import { readXlsx } from '@shared/components/import-wizard/xlsx-reader';
import { buildXlsxBlob } from '@shared/components/import-wizard/xlsx-writer';

import {
  OpeningBalancesService, FileType, ImportError,
  InventoryImportRow, PartyImportRow,
} from '../../services/opening-balances.service';

export interface ImportExportData { branchId: string; }
export interface ImportExportResult { reload: boolean; }

type TabKey = 'inventory' | 'supplier' | 'customer';

interface TabConfig {
  key:        TabKey;
  labelKey:   string;
  exportKind: 'inventory' | 'suppliers' | 'customers';
  fileBase:   string;
  /** Column order for template + parsing (label = template header). */
  columns:    CsvColumn[];
  /** One example row for the template. */
  example:    string[];
}

const TABS: TabConfig[] = [
  {
    key: 'inventory', labelKey: 'OPENING_BALANCES.IE.INVENTORY', exportKind: 'inventory', fileBase: 'products',
    columns: [
      { key: 'barcode', label: 'Barcode' }, { key: 'name', label: 'Product Name' },
      { key: 'openingBalance', label: 'Opening Balance' }, { key: 'openingBalanceCost', label: 'Unit Cost' },
    ],
    example: ['1234567890', 'Sample Product', '100', '5.500'],
  },
  {
    key: 'supplier', labelKey: 'OPENING_BALANCES.IE.SUPPLIER', exportKind: 'suppliers', fileBase: 'suppliers',
    columns: [{ key: 'name', label: 'Supplier Name' }, { key: 'phone', label: 'Phone' }, { key: 'openingBalance', label: 'Opening Balance' }],
    example: ['Sample Supplier', '+97300000000', '250.000'],
  },
  {
    key: 'customer', labelKey: 'OPENING_BALANCES.IE.CUSTOMER', exportKind: 'customers', fileBase: 'customers',
    columns: [{ key: 'name', label: 'Customer Name' }, { key: 'phone', label: 'Phone' }, { key: 'openingBalance', label: 'Opening Balance' }],
    example: ['Sample Customer', '+97300000000', '150.000'],
  },
];

/**
 * import-export-modal
 * ───────────────────
 * Bulk import/export opening balances for Inventory Assets, Suppliers and
 * Customers. Per tab: download a CSV/XLSX template, import a filled file, or
 * export the current balances. Imports are parsed client-side (CSV or XLSX)
 * and posted via {@link OpeningBalancesService}; any per-row errors the
 * backend returns are surfaced inline.
 */
@Component({
  selector: 'app-opening-balances-import-export',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, SegmentedToggleComponent, LoadingOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'OPENING_BALANCES.IE.TITLE' | translate" />

    <app-loading-overlay [show]="busy()" />

    <div class="body">
      <app-segmented-toggle
        [options]="tabOptions" [value]="tab()" (valueChange)="onTab($any($event))" />

      @if (notice(); as n) {
        <div class="ie-notice" [class.ie-notice--ok]="n.kind === 'ok'" [class.ie-notice--err]="n.kind === 'err'">
          {{ n.text | translate }}
        </div>
      }

      <!-- Import -->
      <section class="ie-block">
        <h4 class="ie-h">{{ 'OPENING_BALANCES.IE.IMPORT' | translate }}</h4>
        <p class="ie-hint">{{ 'OPENING_BALANCES.IE.IMPORT_HINT' | translate }}</p>

        <label class="ie-drop" [class.ie-drop--has]="fileName()">
          <input type="file" accept=".csv,.xlsx" hidden (change)="onFile($any($event))" />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          <span>{{ fileName() || ('OPENING_BALANCES.IE.CHOOSE_FILE' | translate) }}</span>
          @if (rows().length) { <span class="ie-count">{{ 'OPENING_BALANCES.IE.ROWS_READY' | translate: { count: rows().length } }}</span> }
        </label>

        <div class="ie-tpl">
          {{ 'OPENING_BALANCES.IE.TEMPLATE' | translate }}:
          <button type="button" (click)="downloadTemplate('csv')">CSV</button>
          <button type="button" (click)="downloadTemplate('xlsx')">XLSX</button>
        </div>

        @if (errors().length) {
          <div class="ie-errors">
            <b>{{ 'OPENING_BALANCES.IE.ERRORS' | translate: { count: errors().length } }}</b>
            <ul>
              @for (e of errors().slice(0, 8); track $index) { <li>{{ e.name }} — {{ e.error }}</li> }
            </ul>
          </div>
        }

        <button type="button" class="ie-import" [disabled]="!rows().length || busy()" (click)="doImport()">
          @if (busy()) { {{ 'COMMON.SAVING' | translate }} } @else { {{ 'OPENING_BALANCES.IE.IMPORT_BTN' | translate: { count: rows().length } }} }
        </button>
      </section>

      <!-- Export -->
      <section class="ie-block ie-block--export">
        <h4 class="ie-h">{{ 'OPENING_BALANCES.IE.EXPORT' | translate }}</h4>
        <p class="ie-hint">{{ 'OPENING_BALANCES.IE.EXPORT_HINT' | translate }}</p>
        <div class="ie-tpl">
          <button type="button" [disabled]="busy()" (click)="doExport('csv')">CSV</button>
          <button type="button" [disabled]="busy()" (click)="doExport('xlsx')">XLSX</button>
        </div>
      </section>
    </div>

    <app-modal-footer>
      <button type="button" class="btn-cancel" (click)="close()">{{ 'COMMON.CLOSE' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .body { padding: 16px; display: flex; flex-direction: column; gap: 18px; max-width: 520px; }
    .ie-notice { padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 500;
      &--ok  { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
      &--err { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; } }
    .ie-block { display: flex; flex-direction: column; gap: 8px; }
    .ie-block--export { border-top: 1px solid #eef2f6; padding-top: 16px; }
    .ie-h { margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; }
    .ie-hint { margin: 0; font-size: 12.5px; color: #64748b; }
    .ie-drop {
      display: flex; align-items: center; gap: 10px; padding: 14px 16px;
      border: 1.5px dashed #cbd5e1; border-radius: 12px; cursor: pointer; color: #475569;
      background: #f8fafc; transition: border-color .15s, background .15s;
      svg { color: #94a3b8; flex-shrink: 0; }
      &:hover { border-color: var(--color-brand-400, #4fbfd0); background: #f1fbfd; }
      &--has { border-style: solid; border-color: var(--color-brand-300, #7ad3df); background: var(--color-brand-50, #effbfd); color: #0f172a; }
    }
    .ie-count { margin-inline-start: auto; font-size: 12px; font-weight: 600; color: var(--color-brand-700, #207484); }
    .ie-tpl { font-size: 12.5px; color: #64748b; display: flex; align-items: center; gap: 8px;
      button { padding: 5px 12px; border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--color-brand-700, #207484); cursor: pointer;
        &:hover:not(:disabled) { background: var(--color-brand-50, #effbfd); border-color: var(--color-brand-300, #7ad3df); } &:disabled { opacity: .5; cursor: not-allowed; } } }
    .ie-errors { padding: 10px 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; font-size: 12px; color: #991b1b;
      ul { margin: 6px 0 0; padding-inline-start: 18px; } li { margin: 2px 0; } }
    .ie-import {
      align-self: flex-start; margin-top: 4px; padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
      color: #fff; border: none; cursor: pointer;
      background: var(--color-brand-600, #2691a4); &:hover:not(:disabled) { background: var(--color-brand-700, #207484); }
      &:disabled { opacity: .5; cursor: not-allowed; } }
    .btn-cancel { padding: 9px 18px; border-radius: 8px; font-size: 13px; font-weight: 500; background: #fff; border: 1px solid #e5e7eb; color: #475569; cursor: pointer;
      &:hover { background: #f8fafc; } }
  `],
})
export class ImportExportModalComponent {
  private data    = inject<ImportExportData>(MODAL_DATA);
  private ref     = inject<ModalRef<ImportExportResult>>(MODAL_REF);
  private service = inject(OpeningBalancesService);

  readonly tabOptions: SegmentedToggleOption[] = TABS.map((t) => ({ value: t.key, label: t.labelKey }));

  tab      = signal<TabKey>('inventory');
  fileName = signal<string>('');
  rows     = signal<Array<Record<string, string>>>([]);
  errors   = signal<ImportError[]>([]);
  busy     = signal<boolean>(false);
  /** Inline success/error banner (toasts render behind the modal overlay). */
  notice   = signal<{ kind: 'ok' | 'err'; text: string } | null>(null);
  /** Set once any import succeeds, so the parent reloads on close. */
  private didImport = false;

  private cfg = computed(() => TABS.find((t) => t.key === this.tab())!);

  onTab(v: string): void {
    this.tab.set((v as TabKey) ?? 'inventory');
    this.fileName.set(''); this.rows.set([]); this.errors.set([]); this.notice.set(null);
  }

  async onFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    this.errors.set([]); this.notice.set(null);
    try {
      const cols = this.cfg().columns;
      let records: Array<Record<string, string>>;
      if (/\.xlsx$/i.test(file.name)) {
        const grid = await readXlsx(file);
        records = grid.slice(1).map((cells) => {   // skip header row
          const r: Record<string, string> = {};
          cols.forEach((c, i) => (r[c.key] = String(cells[i] ?? '').trim()));
          return r;
        });
      } else {
        records = parseCsv(await file.text(), cols);
      }
      // Keep rows that carry a name / barcode.
      const keyField = this.cfg().key === 'inventory' ? 'barcode' : 'name';
      this.rows.set(records.filter((r) => (r[keyField] || r['name'] || '').trim().length > 0));
      if (!this.rows().length) this.notice.set({ kind: 'err', text: 'OPENING_BALANCES.IE.EMPTY_FILE' });
    } catch {
      this.rows.set([]);
      this.notice.set({ kind: 'err', text: 'OPENING_BALANCES.IE.PARSE_FAILED' });
    } finally {
      input.value = ''; // allow re-picking the same file
    }
  }

  downloadTemplate(type: FileType): void {
    const cfg = this.cfg();
    const rows: string[][] = [cfg.columns.map((c) => c.label), cfg.example];
    if (type === 'csv') {
      const csv = rows.map((r) => r.map((c) => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\r\n');
      saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${cfg.fileBase}_template.csv`);
    } else {
      saveAs(buildXlsxBlob(rows), `${cfg.fileBase}_template.xlsx`);
    }
  }

  async doExport(type: FileType): Promise<void> {
    this.busy.set(true);
    this.notice.set(null);
    try {
      await this.service.exportFile(this.cfg().exportKind, this.data.branchId, type);
    } catch {
      this.notice.set({ kind: 'err', text: 'COMMON.SAVE_FAILED' });
    } finally {
      this.busy.set(false);
    }
  }

  async doImport(): Promise<void> {
    const cfg = this.cfg();
    const raw = this.rows();
    if (!raw.length) return;
    this.busy.set(true);
    this.errors.set([]);
    try {
      const num = (v: string) => Math.max(0, parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')) || 0);
      let res;
      if (cfg.key === 'inventory') {
        const products: InventoryImportRow[] = raw.map((r) => ({
          barcode: (r['barcode'] || '').trim(), name: (r['name'] || '').trim(),
          openingBalance: num(r['openingBalance']), openingBalanceCost: num(r['openingBalanceCost']),
        }));
        res = await this.service.importInventory(this.data.branchId, products);
      } else {
        const party: PartyImportRow[] = raw.map((r) => ({
          name: (r['name'] || '').trim(), phone: (r['phone'] || '').trim(), openingBalance: num(r['openingBalance']),
        }));
        res = cfg.key === 'supplier'
          ? await this.service.importSuppliers(this.data.branchId, party)
          : await this.service.importCustomers(this.data.branchId, party);
      }

      this.errors.set(res.errors);
      if (res.success) {
        this.didImport = true;
        this.notice.set({ kind: 'ok', text: 'OPENING_BALANCES.IE.IMPORTED' });
        this.fileName.set(''); this.rows.set([]);
      } else if (!res.errors.length) {
        this.notice.set({ kind: 'err', text: res.msg || 'COMMON.SAVE_FAILED' });
      }
    } catch {
      this.notice.set({ kind: 'err', text: 'COMMON.SAVE_FAILED' });
    } finally {
      this.busy.set(false);
    }
  }

  close(): void { this.ref.close({ reload: this.didImport }); }
}
