import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import { Dimension, emptyTranslation } from '../../services/matrix-item.types';

export interface BulkTranslationModalData {
  dimensions: Dimension[];
}

/**
 * Bulk-translation modal
 * ──────────────────────
 * Edit English + Arabic names for every dimension AND every attribute in
 * one pass. Works on a deep clone (with translation objects backfilled) so
 * Cancel leaves the caller's data untouched; Save returns the updated clone.
 *
 * The `[(ngModel)]` bindings mutate the clone's nested `translation.name`
 * objects in place — cheap and correct here since the modal owns the clone.
 */
@Component({
  selector: 'app-bulk-translation-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-translation-modal.component.html',
  styleUrl: './bulk-translation-modal.component.scss',
})
export class BulkTranslationModalComponent {
  private modalRef = inject<ModalRef<Dimension[] | null>>(MODAL_REF);
  private data = inject<BulkTranslationModalData>(MODAL_DATA) ?? { dimensions: [] };

  /** Deep clone with translation objects guaranteed on the dimension and
   *  each attribute, so the template can bind `translation.name.{en,ar}`. */
  readonly dimensions: Dimension[] = (this.data.dimensions ?? []).map((dim) => {
    const clone: Dimension = JSON.parse(JSON.stringify(dim));
    clone.translation = this.ensureTranslation(clone.translation, clone.name);
    clone.attributes = (clone.attributes ?? []).map((attr) => ({
      ...attr,
      translation: this.ensureTranslation(attr.translation, attr.name),
    }));
    return clone;
  });

  private ensureTranslation(t: any, fallbackEn: string) {
    const base = emptyTranslation();
    if (t && typeof t === 'object' && t.name) {
      base.name = { en: t.name.en ?? '', ar: t.name.ar ?? '' };
    }
    if (!base.name.en && fallbackEn) base.name.en = fallbackEn;
    return base;
  }

  constructor() {
    withTranslations('products/matrix-item');
  }

  /** Only color dimensions get a colour swatch. Non-colour attributes carry a
   *  default '#000000' value which would otherwise render as a black square. */
  isColorDim(dim: Dimension): boolean {
    return /colou?r/i.test(dim.type || dim.name || '');
  }

  save(): void {
    this.modalRef.close(this.dimensions);
  }

  cancel(): void {
    this.modalRef.close(null);
  }
}
