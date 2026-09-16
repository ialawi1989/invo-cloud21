import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  TranslationModalComponent,
  TranslationModalData,
  TranslationLang,
} from '@shared/components/translation-modal/translation-modal.component';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

import {
  Dimension,
  DimensionAttribute,
  DimensionDisplayType,
  emptyTranslation,
} from '../../services/matrix-item.types';
import {
  AddDimensionModalComponent,
  AddDimensionModalData,
} from '../add-dimension-modal/add-dimension-modal.component';
import {
  AddAttributeModalComponent,
  AddAttributeModalData,
} from '../add-attribute-modal/add-attribute-modal.component';
import {
  PickDimensionModalComponent,
  PickDimensionModalData,
} from '../pick-dimension-modal/pick-dimension-modal.component';
import {
  BulkTranslationModalComponent,
  BulkTranslationModalData,
} from '../bulk-translation-modal/bulk-translation-modal.component';
import { normalizeName } from '../../utils/variant-generator';

const MAX_DIMENSIONS = 3;

/**
 * manage-dimensions
 * ─────────────────
 * Embedded editor for a matrix item's up-to-3 dimensions. Orchestrates the
 * add-dimension / add-attribute / pick-from-catalog / bulk-translate modals and
 * per-field translation. `dimensions` is a two-way `model()` so the parent form
 * stays the single source of truth; `generate` fires whenever a change should
 * re-run variant generation (add/remove dimension or attribute).
 *
 * Ported from the legacy `DimensionManagerComponent` (`app-manage-dimension`),
 * collapsing its FormArray bookkeeping into signal-driven array replacement.
 */
import { TranslateLinkComponent } from '@shared/components/translate-link/translate-link.component';

@Component({
  selector: 'app-manage-dimensions',
  standalone: true,
  imports: [CommonModule, TranslateModule, SegmentedToggleComponent, TranslateLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './manage-dimensions.component.html',
  styleUrl: './manage-dimensions.component.scss',
})
export class ManageDimensionsComponent {
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  /** Two-way — parent owns the array; we replace it on every mutation. */
  dimensions = model<Dimension[]>([]);
  disabled = input<boolean>(false);
  /** `'new' | 'edit'` — mirrors the parent form status (unused for now but
   *  kept for parity with the legacy attribute dialog seeding). */
  formStatus = input<'new' | 'edit'>('new');

  /** Fires when the caller should regenerate the variant products. */
  generate = output<void>();

  readonly displayTypeOptions: SegmentedToggleOption<DimensionDisplayType>[] = [
    { value: 'buttons', label: 'MATRIX.DIMENSION.BUTTONS' },
    { value: 'radio', label: 'MATRIX.DIMENSION.RADIO' },
    { value: 'dropdown', label: 'MATRIX.DIMENSION.DROPDOWN' },
  ];

  constructor() {
    withTranslations('products/matrix-item');
  }

  get atMax(): boolean {
    return this.dimensions().length >= MAX_DIMENSIONS;
  }

  isColorDimension(d: Dimension): boolean {
    const t = (d.type || d.name || '').toLowerCase();
    return t.includes('color');
  }

  /** Case-insensitive, whitespace-normalized key for duplicate-name checks. */
  private nameKey(value: string): string {
    return normalizeName(value).toLowerCase();
  }

  /** True when `name` matches (case-insensitively) another dimension on the
   *  matrix, other than the one at `excludeIndex`. */
  private isDuplicateDimensionName(name: string, excludeIndex?: number): boolean {
    const key = this.nameKey(name);
    return this.dimensions().some(
      (d, i) => i !== excludeIndex && this.nameKey(d.name) === key,
    );
  }

  // ─── Mutation helpers ─────────────────────────────────────────────────
  /** Replace the dimensions array from a mutator applied to a shallow clone,
   *  keeping change detection honest for OnPush + signal `model`. */
  private update(mutate: (draft: Dimension[]) => void, regenerate = true): void {
    const next = this.dimensions().map((d) => ({
      ...d,
      attributes: [...d.attributes],
    }));
    mutate(next);
    this.dimensions.set(next);
    if (regenerate) this.generate.emit();
  }

  // ─── Dimensions ───────────────────────────────────────────────────────
  async openAddDimension(): Promise<void> {
    if (this.disabled() || this.atMax) return;
    const ref = this.modal.open<AddDimensionModalComponent, AddDimensionModalData, Dimension | null>(
      AddDimensionModalComponent,
      { size: 'md', data: { existingNames: this.dimensions().map((d) => d.name) } },
    );
    const dim = await ref.afterClosed();
    if (!dim) return;
    // Reject duplicates by id or by name (case-insensitive, whitespace
    // normalized) — the add-dimension modal already blocks this via its own
    // `existingNames` check, but re-guard here for any caller that bypasses it.
    if (this.dimensions().some((d) => d.id === dim.id) || this.isDuplicateDimensionName(dim.name)) {
      this.toast.error('DIMENSIONS.FORM.NAME_DUPLICATE');
      return;
    }
    this.update((draft) => draft.push(dim));
  }

  async openPicker(): Promise<void> {
    if (this.disabled()) return;
    const ref = this.modal.open<PickDimensionModalComponent, PickDimensionModalData, Dimension[] | null>(
      PickDimensionModalComponent,
      { size: 'md', data: { selectedIds: this.dimensions().map((d) => d.id) } },
    );
    const picked = await ref.afterClosed();
    if (!picked?.length) return;
    let skippedDuplicate = false;
    this.update((draft) => {
      for (const dim of picked) {
        if (draft.length >= MAX_DIMENSIONS) break;
        const key = this.nameKey(dim.name);
        if (draft.some((d) => d.id === dim.id || this.nameKey(d.name) === key)) {
          skippedDuplicate = true;
          continue;
        }
        draft.push(dim);
      }
    });
    if (skippedDuplicate) this.toast.error('DIMENSIONS.FORM.NAME_DUPLICATE');
  }

  removeDimension(index: number): void {
    if (this.disabled()) return;
    this.update((draft) => draft.splice(index, 1));
  }

  setDisplayType(index: number, displayType: DimensionDisplayType): void {
    // Display type is cosmetic — no regenerate needed.
    this.update((draft) => {
      draft[index] = { ...draft[index], displayType };
    }, false);
  }

  // ─── Attributes ───────────────────────────────────────────────────────
  async openAttribute(index: number): Promise<void> {
    if (this.disabled()) return;
    const dimension = this.dimensions()[index];
    const ref = this.modal.open<AddAttributeModalComponent, AddAttributeModalData, DimensionAttribute[] | null>(
      AddAttributeModalComponent,
      { size: 'lg', data: { dimension } },
    );
    const attributes = await ref.afterClosed();
    if (!attributes) return;
    this.update((draft) => {
      draft[index] = { ...draft[index], attributes: [...attributes] };
    });
  }

  removeAttribute(dimIndex: number, attrIndex: number): void {
    if (this.disabled()) return;
    this.update((draft) => {
      const attrs = [...draft[dimIndex].attributes];
      attrs.splice(attrIndex, 1);
      draft[dimIndex] = { ...draft[dimIndex], attributes: attrs };
    });
  }

  // ─── Translations ─────────────────────────────────────────────────────
  async translateDimension(index: number): Promise<void> {
    const dim = this.dimensions()[index];
    const initial = dim.translation?.name ?? { en: dim.name, ar: '' };
    const result = await this.openTranslationModal({ ...initial, en: initial.en || dim.name }, dim.name);
    if (!result) return;
    // Trim the English name coming back from the dialog, then reject it if it
    // now collides (case-insensitively) with another dimension already on the
    // matrix — keep the previous name/translation as-is rather than silently
    // creating two dimensions with the same effective name.
    const trimmedName = normalizeName(result.en);
    if (this.isDuplicateDimensionName(trimmedName, index)) {
      this.toast.error('DIMENSIONS.FORM.NAME_DUPLICATE');
      return;
    }
    this.update((draft) => {
      const t = draft[index].translation ?? emptyTranslation();
      draft[index] = {
        ...draft[index],
        name: trimmedName,
        translation: { ...t, name: { ...result, en: trimmedName } },
      };
    }, false);
  }

  async translateAttribute(dimIndex: number, attrIndex: number): Promise<void> {
    const attr = this.dimensions()[dimIndex].attributes[attrIndex];
    const initial = attr.translation?.name ?? { en: attr.name, ar: '' };
    const result = await this.openTranslationModal({ ...initial, en: initial.en || attr.name }, attr.name);
    if (!result) return;
    const trimmedName = normalizeName(result.en);
    this.update((draft) => {
      const attrs = [...draft[dimIndex].attributes];
      const t = attrs[attrIndex].translation ?? emptyTranslation();
      attrs[attrIndex] = {
        ...attrs[attrIndex],
        name: trimmedName,
        translation: { ...t, name: { ...result, en: trimmedName } },
      };
      draft[dimIndex] = { ...draft[dimIndex], attributes: attrs };
    }, false);
  }

  async openBulkTranslation(): Promise<void> {
    const ref = this.modal.open<BulkTranslationModalComponent, BulkTranslationModalData, Dimension[] | null>(
      BulkTranslationModalComponent,
      { size: 'xl', data: { dimensions: this.dimensions() } },
    );
    const updated = await ref.afterClosed();
    if (!updated) return;
    // Bulk translations only touch names — replace wholesale, no regenerate
    // (barcodes/skus are code-based, unaffected by name changes).
    this.dimensions.set(updated);
  }

  private async openTranslationModal(initial: TranslationLang, label: string): Promise<TranslationLang | null> {
    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang | null>(
      TranslationModalComponent,
      { size: 'md', data: { initial, label } },
    );
    return (await ref.afterClosed()) ?? null;
  }
}
