import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { ColorPickerComponent } from '@shared/components/color-picker/color-picker.component';

import {
  AttributePreset,
  Dimension,
  DimensionAttribute,
  colorForCode,
  emptyAttribute,
  emptyTranslation,
  getPresetsForDimension,
} from '../../services/matrix-item.types';

export interface AddAttributeModalData {
  dimension: Dimension;
}

/**
 * Resolve a CSS colour name (e.g. "crimson", "dark slate blue") to a hex
 * string using the browser's own parser. The canvas 2D context normalises
 * any valid CSS colour to `#rrggbb`; an *invalid* name leaves `fillStyle`
 * at the baseline we seed first, which we treat as "no match". Ported from
 * the legacy add-attribute modal so colour names keep auto-detecting.
 */
function colorNameToHex(name: string): string {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#000000';
  ctx.fillStyle = name.toLowerCase().replace(/\s+/g, '');
  return ctx.fillStyle;
}

/**
 * Add-attribute modal
 * ───────────────────
 * Edits a dimension's attribute list. Seeds from `data.dimension.attributes`,
 * offers preset chips for known dimension types (colour/size/material), and a
 * custom add-row (name + code + optional colour swatch). Closes with the FULL
 * updated attributes array, or `null` on cancel.
 */
@Component({
  selector: 'app-add-attribute-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    ColorPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './add-attribute-modal.component.html',
  styleUrl: './add-attribute-modal.component.scss',
})
export class AddAttributeModalComponent {
  private modalRef = inject<ModalRef<DimensionAttribute[] | null>>(MODAL_REF);
  private data = inject<AddAttributeModalData>(MODAL_DATA);

  readonly dimension = this.data.dimension;

  /** Working copy of the attribute list — cloned so a cancel leaves the
   *  caller's dimension untouched. */
  attrs = signal<DimensionAttribute[]>(
    (this.dimension.attributes ?? []).map((a) => ({ ...a })),
  );

  // ── Custom add-row state ──────────────────────────────────────────
  newName = signal<string>('');
  newCode = signal<string>('');
  newValue = signal<string>('#000000');
  /** True once the user hand-edits the code, so colour dimensions stop
   *  auto-deriving it from the name. */
  private codeTouched = signal<boolean>(false);

  readonly isColorDimension = computed<boolean>(() => {
    const key = (this.dimension.type || this.dimension.name || '').toLowerCase();
    return key.includes('color');
  });

  /** Preset chips for this dimension type, minus the ones already added
   *  (matched by code or name, case-insensitive). */
  readonly availablePresets = computed<AttributePreset[]>(() => {
    const presets = getPresetsForDimension(this.dimension.type || this.dimension.name);
    return presets.filter((p) => !this.isAdded(p.code, p.name));
  });

  private isAdded(code: string, name: string): boolean {
    const c = (code || '').toLowerCase();
    const n = (name || '').toLowerCase();
    return this.attrs().some(
      (a) => a.code.toLowerCase() === c || a.name.toLowerCase() === n,
    );
  }

  constructor() {
    withTranslations('products/matrix-item');
  }

  // ── Custom-row field handlers ─────────────────────────────────────
  onNameInput(v: string): void {
    this.newName.set(v);
    if (!this.isColorDimension()) return;
    // Colour dims: derive a 3-char code + detect the swatch from the name,
    // unless the user has taken over the code manually.
    if (!this.codeTouched()) {
      this.newCode.set(v.replace(/\s+/g, '').substring(0, 3).toUpperCase());
    }
    const trimmed = v.trim();
    if (trimmed) {
      const hex = colorNameToHex(trimmed);
      if (hex && hex !== '#000000') this.newValue.set(hex);
    }
  }

  onCodeInput(v: string): void {
    this.codeTouched.set(true);
    this.newCode.set(v);
  }

  // ── Validation ────────────────────────────────────────────────────
  readonly nameError = computed<string | null>(() => {
    const n = this.newName().trim();
    if (!n) return null; // empty is not an *error* yet — just disables Add
    const dup = this.attrs().some((a) => a.name.toLowerCase() === n.toLowerCase());
    return dup ? 'MATRIX.ATTRIBUTE.NAME_DUPLICATE' : null;
  });

  readonly codeError = computed<string | null>(() => {
    const c = this.newCode().trim();
    if (!c) return null;
    const dup = this.attrs().some((a) => a.code.toLowerCase() === c.toLowerCase());
    return dup ? 'MATRIX.ATTRIBUTE.CODE_DUPLICATE' : null;
  });

  readonly canAdd = computed<boolean>(() => {
    const name = this.newName().trim();
    const code = this.newCode().trim();
    if (!name || !code) return false;
    if (this.nameError() || this.codeError()) return false;
    if (this.isColorDimension() && !this.newValue()) return false;
    return true;
  });

  /** New rows are always removable; a persisted attribute (has `id`, not
   *  new) stays — matches the legacy guard so saved variants aren't
   *  silently dropped from here. Exception: a code-less attribute is invalid
   *  (the backend rejects it) so it's always removable, letting the user clean
   *  up bad leftovers brought in by a picked saved dimension. */
  canRemove(attr: DimensionAttribute): boolean {
    if (!String(attr.code ?? '').trim()) return true;
    return !attr.id || attr.isNew;
  }

  // ── Mutations ─────────────────────────────────────────────────────
  addCustom(): void {
    if (!this.canAdd()) return;
    const name = this.newName().trim();
    const code = this.newCode().trim();
    const attr = emptyAttribute();
    attr.name = name;
    attr.code = code;
    attr.value = this.isColorDimension()
      ? this.newValue()
      : colorForCode(code) || attr.value;
    attr.translation = emptyTranslation();
    attr.translation.name.en = name;

    // Adopt a saved preset's id/name/code when the custom entry matches one
    // in the dimension's catalog, so we reuse the persisted row.
    const preset = (this.dimension.presetAttributes ?? []).find(
      (p) =>
        p.code?.toLowerCase() === code.toLowerCase() ||
        p.name?.toLowerCase() === name.toLowerCase(),
    );
    if (preset?.id) {
      attr.id = preset.id;
      attr.name = preset.name;
      attr.code = preset.code;
    }

    this.attrs.update((list) => [...list, attr]);
    this.resetRow();
  }

  addPreset(preset: AttributePreset): void {
    if (this.isAdded(preset.code, preset.name)) return;
    const attr = emptyAttribute();
    attr.name = preset.name;
    attr.code = preset.code;
    attr.value = preset.value;
    attr.isNew = true;
    attr.translation = emptyTranslation();
    attr.translation.name.en = preset.name;
    this.attrs.update((list) => [...list, attr]);
  }

  removeAttr(index: number): void {
    this.attrs.update((list) => list.filter((_, i) => i !== index));
  }

  private resetRow(): void {
    this.newName.set('');
    this.newCode.set('');
    this.newValue.set('#000000');
    this.codeTouched.set(false);
  }

  // ── Preset swatch check (chips + rows) ────────────────────────────
  isHex(v: string | null | undefined): boolean {
    return !!v && v.startsWith('#');
  }

  // ── Close ─────────────────────────────────────────────────────────
  save(): void {
    this.modalRef.close(this.attrs());
  }

  cancel(): void {
    this.modalRef.close(null);
  }
}
