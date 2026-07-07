import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import { BarcodeComparisonRow } from '../../utils/variant-generator';

export interface BarcodeChangeConfirmModalData {
  comparison: BarcodeComparisonRow[];
}

/**
 * Barcode-change confirmation modal
 * ─────────────────────────────────
 * Shown before applying a parent-barcode change that cascades new
 * barcodes/SKUs onto every child variant. Lists the old→new diff so the
 * user can review before committing. Returns `true` to confirm, else
 * `false`/`null`.
 */
@Component({
  selector: 'app-barcode-change-confirm-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './barcode-change-confirm-modal.component.html',
  styleUrl: './barcode-change-confirm-modal.component.scss',
})
export class BarcodeChangeConfirmModalComponent {
  private modalRef = inject<ModalRef<boolean>>(MODAL_REF);
  private data = inject<BarcodeChangeConfirmModalData>(MODAL_DATA) ?? { comparison: [] };

  readonly rows: BarcodeComparisonRow[] = this.data.comparison ?? [];

  constructor() {
    withTranslations('products/matrix-item');
  }

  confirm(): void {
    this.modalRef.close(true);
  }

  cancel(): void {
    this.modalRef.close(false);
  }
}
