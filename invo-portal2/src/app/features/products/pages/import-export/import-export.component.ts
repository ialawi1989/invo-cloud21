import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ModalService } from '@shared/modal/modal.service';import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ImportWizardComponent } from '@shared/components/import-wizard/import-wizard.component';
import {
  ImportSummaryCounts,
  ImportWizardConfig,
} from '@shared/components/import-wizard/import-wizard.types';

import { ProductCrudService } from '../../services/product-crud.service';
import { buildProductImportConfig } from './product-import.config';

/**
 * Import / Export for the **local** product catalogue — a CSV / XLSX of your
 * own products, in and out.
 *
 * NOT the Shopify catalog import. That is a separate feature with a different
 * backend (`product/importShopifyProducts`, paged + mandatory dry run) and its
 * own modal — see `ImportShopifyModalComponent`. The two stay apart: different
 * origins, different endpoints, different failure modes.
 *
 * Ported from the legacy `export-import-produsts` modal, which exposed exactly
 * this: a template download, a file upload, and a CSV/XLSX export. The import
 * now runs through the shared `<app-import-wizard>` (upload → preview →
 * validate → import) instead of legacy's raw Papa-parse-and-POST, so row
 * errors are shown inline before anything is written.
 */
@Component({
  selector: 'app-import-export',
  standalone: true,
  imports: [TranslateModule, DropdownMenuBtnComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-export.component.html',
})
export class ImportExportComponent {
  private readonly crud = inject(ProductCrudService);
  private readonly modal = inject(ModalService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  exporting = false;

  /** Export dropdown — the backend serves the whole catalogue as one file. */
  exportMenuItems(): DropdownMenuBtnItem[] {
    return [
      {
        label: this.translate.instant('PRODUCTS.IMPORT_EXPORT.EXPORT.CSV'),
        click: () => this.exportAs('csv'),
        disabled: this.exporting,
        danger: false,
      },
      {
        label: this.translate.instant('PRODUCTS.IMPORT_EXPORT.EXPORT.XLSX'),
        click: () => this.exportAs('xlsx'),
        disabled: this.exporting,
        danger: false,
      },
    ];
  }

  async openImport(): Promise<void> {
    const config: ImportWizardConfig = buildProductImportConfig(this.crud);
    const ref = this.modal.open<ImportWizardComponent, ImportWizardConfig, ImportSummaryCounts | undefined>(
      ImportWizardComponent,
      { size: 'lg', data: config, closeOnBackdrop: false },
    );
    await ref.afterClosed();
  }

  /**
   * `exportProducts` is fire-and-forget: it subscribes internally and triggers
   * the download, so there is nothing to await or catch here — the flag only
   * exists to stop a double-click stacking two downloads.
   */
  exportAs(type: 'csv' | 'xlsx'): void {
    if (this.exporting) return;
    this.exporting = true;
    this.crud.exportProducts(type);
    // The request is fire-and-forget; clear on the next tick so the menu is
    // usable again without pretending to know when the file lands.
    setTimeout(() => { this.exporting = false; }, 1500);
  }

  backToList(): void {
    void this.router.navigate(['/products/list']);
  }
}
