import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

import {
  Dimension,
  DimensionDisplayType,
  PREDEFINED_DIMENSIONS,
  emptyDimension,
  emptyTranslation,
} from '../../services/matrix-item.types';

export interface AddDimensionModalData {
  existingNames: string[];
}

/**
 * Add-dimension modal
 * ───────────────────
 * Builds a NEW dimension for a matrix item — name + a `PREDEFINED_DIMENSIONS`
 * shortcut + display type. Reusing an existing saved dimension is a separate
 * flow (the "Pick from saved dimensions" button/modal in the Dimensions
 * header), so it's intentionally not offered here.
 */
@Component({
  selector: 'app-add-dimension-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    SegmentedToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './add-dimension-modal.component.html',
  styleUrl: './add-dimension-modal.component.scss',
})
export class AddDimensionModalComponent {
  private modalRef = inject<ModalRef<Dimension | null>>(MODAL_REF);
  private data = inject<AddDimensionModalData>(MODAL_DATA) ?? { existingNames: [] };

  /** Lowercased set of names already on the matrix — rejects duplicates and
   *  hides already-added predefined suggestions. */
  private takenNames = new Set(
    (this.data.existingNames ?? []).map((n) => n.trim().toLowerCase()),
  );

  // ── Form state ────────────────────────────────────────────────────
  name = signal<string>('');
  displayType = signal<DimensionDisplayType>('buttons');

  readonly displayTypeOptions: SegmentedToggleOption<DimensionDisplayType>[] = [
    { value: 'buttons', label: 'MATRIX.DIMENSION.BUTTONS' },
    { value: 'radio', label: 'MATRIX.DIMENSION.RADIO' },
    { value: 'dropdown', label: 'MATRIX.DIMENSION.DROPDOWN' },
  ];

  /** Predefined shortcuts minus the ones already on the matrix. */
  readonly suggestions = computed(() =>
    PREDEFINED_DIMENSIONS.filter((p) => !this.takenNames.has(p.label.toLowerCase())),
  );

  readonly nameError = computed<string | null>(() => {
    const n = this.name().trim();
    if (!n) return null;
    if (this.takenNames.has(n.toLowerCase())) return 'DIMENSIONS.FORM.NAME_DUPLICATE';
    return null;
  });

  readonly canConfirm = computed<boolean>(
    () => !!this.name().trim() && !this.nameError(),
  );

  constructor() {
    withTranslations('products/matrix-item');
  }

  // ── Field handlers ────────────────────────────────────────────────
  onNameInput(v: string): void { this.name.set(v); }
  onDisplayTypeChange(t: DimensionDisplayType): void { this.displayType.set(t); }
  pickSuggestion(s: { label: string; type: string }): void { this.name.set(s.label); }

  // ── Close ─────────────────────────────────────────────────────────
  confirm(): void {
    if (!this.canConfirm()) return;
    const name = this.name().trim();
    const dim = emptyDimension();
    dim.name = name;
    dim.type = name.toLowerCase().replace(/\s+/g, '');
    dim.displayType = this.displayType();
    dim.translation = emptyTranslation();
    dim.translation.name.en = name;
    this.modalRef.close(dim);
  }

  cancel(): void {
    this.modalRef.close(null);
  }
}
