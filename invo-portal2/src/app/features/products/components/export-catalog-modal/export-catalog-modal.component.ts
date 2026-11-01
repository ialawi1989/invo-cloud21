import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { BranchConnectionService } from '@core/layout/services/branch.service';

import { ProductListService } from '../../services/product-list.service';
import {
  CatalogExportEnvelope,
  CatalogExportFormat,
  CatalogExportQuery,
} from '../../models/product-sheet/product-sheet.types';
import { downloadBlob } from '../../utils/download-blob';

/** Standalone product types the catalog export can include. Matrices are always included. */
const STANDALONE_TYPES = ['inventory', 'batch', 'serialized', 'kit', 'service'];
/** The largest page the JSON export serves. */
const JSON_PAGE_LIMIT = 250;

/**
 * Catalog export — the "Export" half of the legacy catalog window
 * (`catalog-export.component`). Exports the catalogue in the same schema the
 * catalog import reads back (`GET product/exportCatalogProducts`).
 *
 * CSV / XLSX come back from the server as one file. JSON is paged, so the pages
 * are fetched one after another and saved as a single envelope that can be
 * imported again as-is. Cancelling a JSON run saves nothing (a partial file
 * would pass for the whole catalogue).
 */
@Component({
  selector: 'app-export-catalog-modal',
  standalone: true,
  imports: [
    FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent,
    SearchDropdownComponent, SegmentedToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './export-catalog-modal.component.html',
  styleUrl: './export-catalog-modal.component.scss',
})
export class ExportCatalogModalComponent {
  ref = inject<ModalRef<void>>(MODAL_REF);
  private readonly list = inject(ProductListService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly branchSvc = inject(BranchConnectionService);

  constructor() {
    withTranslations('products');
    void this.branchSvc.load().catch(() => {});
  }

  readonly formatOptions: SegmentedToggleOption<CatalogExportFormat>[] = [
    { value: 'xlsx', label: 'PRODUCTS.CATALOG_EXPORT.FORMAT_XLSX' },
    { value: 'csv',  label: 'PRODUCTS.CATALOG_EXPORT.FORMAT_CSV' },
    { value: 'json', label: 'PRODUCTS.CATALOG_EXPORT.FORMAT_JSON' },
  ];
  readonly standaloneTypes = STANDALONE_TYPES;

  format = signal<CatalogExportFormat>('xlsx');
  q = signal('');
  vendor = signal('');
  type = signal('');
  tag = signal('');
  sku = signal('');
  branchId = signal<string | null>(null);
  selectedTypes = signal<Set<string>>(new Set(STANDALONE_TYPES));

  busy = signal(false);
  page = signal(0);
  pages = signal<number | null>(null);
  error = signal<string | null>(null);
  private cancelRequested = false;

  noTypesSelected = computed(() => this.selectedTypes().size === 0);
  percent = computed(() => (this.pages() ? Math.round((this.page() / this.pages()!) * 100) : 0));

  branchItems = computed(() => this.branchSvc.branches().map(b => ({ label: b.name || '—', value: b.id })));
  selectedBranchItem = computed(() => this.branchItems().find(b => b.value === this.branchId()) ?? null);
  display = (item: any) => item?.label ?? '';
  compare = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);
  toValue = (item: any) => item?.value ?? item;
  onBranchChange(ev: any): void {
    const id = ev && typeof ev === 'object' ? ev.value : ev;
    this.branchId.set(id ?? null);
  }

  toggleType(type: string, checked: boolean): void {
    const next = new Set(this.selectedTypes());
    if (checked) next.add(type); else next.delete(type);
    this.selectedTypes.set(next);
  }

  cancelRun(): void { this.cancelRequested = true; }

  close(): void { this.ref.dismiss(); }

  async startExport(): Promise<void> {
    if (this.busy() || this.noTypesSelected()) return;
    this.busy.set(true);
    this.error.set(null);
    this.cancelRequested = false;
    try {
      if (this.format() === 'json') {
        if (!(await this.exportJson())) return;
      } else {
        const { blob, fileName } = await this.list.exportCatalogProductsFile(this.query());
        downloadBlob(blob, fileName);
      }
      this.toast.success('PRODUCTS.CATALOG_EXPORT.DONE');
      this.ref.close();
    } catch (err: any) {
      this.error.set(err?.error?.msg || err?.message || this.translate.instant('PRODUCTS.CATALOG_EXPORT.FAILED'));
    } finally {
      this.busy.set(false);
    }
  }

  /** @returns false when the user cancelled (nothing saved). */
  private async exportJson(): Promise<boolean> {
    const products: any[] = [];
    let first: CatalogExportEnvelope | null = null;
    this.page.set(0);
    this.pages.set(null);

    for (let page = 1; ; page++) {
      const response = await this.list.exportCatalogProductsPage({ ...this.query(), page, limit: JSON_PAGE_LIMIT });
      if (!response?.success) throw new Error(response?.msg || 'Export failed.');
      const data = response.data;
      first = first ?? data;
      products.push(...(data?.products ?? []));
      this.page.set(page);
      this.pages.set(data?.pages ?? page);
      if (page >= (data?.pages ?? 0)) break;
      if (this.cancelRequested) {
        this.page.set(0);
        this.pages.set(null);
        return false;
      }
    }

    // One envelope for the whole export — also a valid import payload, and
    // generatedAt is the updatedSince for the next incremental refresh.
    const envelope: CatalogExportEnvelope = {
      generatedAt: first?.generatedAt ?? new Date().toISOString(),
      total: products.length, page: 1, limit: products.length, pages: 1, products,
    };
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(
      new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }),
      `catalog-products-${date}.json`,
    );
    return true;
  }

  private query(): CatalogExportQuery {
    const types = this.selectedTypes();
    return {
      format: this.format(),
      q: this.q(), vendor: this.vendor(), type: this.type(), tag: this.tag(), sku: this.sku(),
      branchId: this.branchId() ?? undefined,
      // The server default is every type, so the full set is not sent.
      types: types.size === STANDALONE_TYPES.length ? undefined : STANDALONE_TYPES.filter(t => types.has(t)).join(','),
    };
  }
}
