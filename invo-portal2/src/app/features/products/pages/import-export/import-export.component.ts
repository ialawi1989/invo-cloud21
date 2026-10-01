import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ModalService } from '@shared/modal/modal.service';
import { ImportWizardComponent } from '@shared/components/import-wizard/import-wizard.component';
import {
  ImportSummaryCounts,
  ImportWizardConfig,
} from '@shared/components/import-wizard/import-wizard.types';

import { ProductCrudService } from '../../services/product-crud.service';
import { buildProductImportConfig } from './product-import.config';
import { ExportProductsModalComponent } from './export-products-modal/export-products-modal.component';

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
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-export.component.html',
})
export class ImportExportComponent {
  private readonly crud = inject(ProductCrudService);
  private readonly modal = inject(ModalService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  async openImport(): Promise<void> {
    const config: ImportWizardConfig = buildProductImportConfig(this.crud, this.translate);
    const ref = this.modal.open<ImportWizardComponent, ImportWizardConfig, ImportSummaryCounts | undefined>(
      ImportWizardComponent,
      { size: 'lg', data: config, closeOnBackdrop: false },
    );
    await ref.afterClosed();
  }

  /** Export — same "Options" modal pattern as Import (pick, then run), instead
   *  of a fire-and-forget dropdown with no loading state or error handling. */
  async openExport(): Promise<void> {
    const ref = this.modal.open<ExportProductsModalComponent, never, void>(
      ExportProductsModalComponent,
      { size: 'sm', closeOnBackdrop: false },
    );
    await ref.afterClosed();
  }

  backToList(): void {
    void this.router.navigate(['/products/list']);
  }
}
