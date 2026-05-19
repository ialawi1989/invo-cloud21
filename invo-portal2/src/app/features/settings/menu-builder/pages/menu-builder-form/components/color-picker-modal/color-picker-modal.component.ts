import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ColorPickerComponent } from '@shared/components/color-picker/color-picker.component';

import { COLOR_SCHEMES, MenuSectionColor, DEFAULT_COLOR_SCHEME } from '../../../../services/menu-builder.types';

export interface ColorPickerModalData {
  current: MenuSectionColor | null;
}

/**
 * Section / product colour picker.
 *
 * Two ways to pick a colour:
 *   1. Tap a *named* preset from the legacy palette (Razzmatazz, Sky,
 *      Plum, …) — fastest path for a section banner.
 *   2. Use the inline `<input type="color">` controls to pick a
 *      custom start, end, and border colour for a gradient banner.
 *
 * Returns a full `MenuSectionColor` object so the same modal can be
 * reused for both section colours (gradient banner) and per-product
 * border colours (caller squashes start/end into the border value).
 */
@Component({
  selector: 'app-color-picker-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, ColorPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'MENU_BUILDER.COLOR.TITLE' | translate"/>

    <div class="body">
      <div
        class="preview"
        [style.background]="'linear-gradient(to bottom,' + colorStart() + ',' + colorEnd() + ')'"
        [style.border-color]="borderColor()"
      >{{ colorName() }}</div>

      <h5 class="heading">{{ 'MENU_BUILDER.COLOR.PRESETS' | translate }}</h5>
      <div class="grid">
        @for (s of presets; track s.colorName) {
          <button
            type="button"
            class="swatch"
            [class.swatch--active]="colorName() === s.colorName"
            [style.background]="'linear-gradient(to bottom,' + s.colorStart + ',' + s.colorEnd + ')'"
            [style.border-color]="s.borderColor"
            (click)="pickPreset(s)"
            [attr.aria-label]="s.colorName"
          ></button>
        }
      </div>

      <h5 class="heading">{{ 'MENU_BUILDER.COLOR.CUSTOM' | translate }}</h5>
      <!-- Project's custom color picker (HSV panel + hex/RGB inputs).
           CVA value is a #RRGGBB hex; we round-trip via toHex/hexToRgba
           so the modal's signals stay in the legacy rgba(…) shape. -->
      <div class="custom">
        <label class="custom__field">
          <span>{{ 'MENU_BUILDER.COLOR.START' | translate }}</span>
          <app-color-picker
            [ngModel]="toHex(colorStart())"
            (ngModelChange)="onCustom('colorStart', $event)"
            [ngModelOptions]="{ standalone: true }"
            [showSpectrum]="true"
            [showRainbowPresets]="true"
          />
        </label>
        <label class="custom__field">
          <span>{{ 'MENU_BUILDER.COLOR.END' | translate }}</span>
          <app-color-picker
            [ngModel]="toHex(colorEnd())"
            (ngModelChange)="onCustom('colorEnd', $event)"
            [ngModelOptions]="{ standalone: true }"
            [showSpectrum]="true"
            [showRainbowPresets]="true"
          />
        </label>
        <label class="custom__field">
          <span>{{ 'MENU_BUILDER.COLOR.BORDER' | translate }}</span>
          <app-color-picker
            [ngModel]="toHex(borderColor())"
            (ngModelChange)="onCustom('borderColor', $event)"
            [ngModelOptions]="{ standalone: true }"
            [showSpectrum]="true"
            [showRainbowPresets]="true"
          />
        </label>
      </div>
    </div>

    <app-modal-footer>
      <button class="btn-cancel" (click)="ref.dismiss()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button class="btn-confirm" (click)="confirm()">{{ 'COMMON.SAVE' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .body { padding: 14px 24px 4px; display: flex; flex-direction: column; gap: 12px; }
    .preview {
      display: flex; align-items: center; justify-content: center;
      height: 64px; border-radius: 12px;
      border: 3px solid;
      color: #fff; font-weight: 700; font-size: 14px;
      letter-spacing: 0.02em;
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.10);
    }
    .heading { margin: 8px 0 4px; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
    .grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 6px;
    }
    .swatch {
      aspect-ratio: 1 / 1;
      border: 3px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      transition: transform 120ms ease;
      &:hover { transform: scale(1.05); }
      &--active { box-shadow: 0 0 0 3px rgba(50, 172, 193, 0.25); }
    }
    .custom { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .custom__field {
      display: flex; flex-direction: column; gap: 4px;
      font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;
      app-color-picker { display: block; }
    }
    .btn-cancel {
      padding: 9px 20px; background: #f3f4f6; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 13px; cursor: pointer;
      &:hover { background: #e5e7eb; }
    }
    .btn-confirm {
      padding: 9px 24px; background: var(--color-brand-600); color: #fff;
      border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
      &:hover { background: var(--color-brand-700); }
    }
  `]
})
export class ColorPickerModalComponent {
  data = inject<ColorPickerModalData>(MODAL_DATA);
  ref  = inject<ModalRef<MenuSectionColor>>(MODAL_REF);

  presets = COLOR_SCHEMES;

  colorName   = signal<string>('');
  colorStart  = signal<string>('');
  colorEnd    = signal<string>('');
  borderColor = signal<string>('');

  constructor() {
    const c = this.data?.current ?? DEFAULT_COLOR_SCHEME;
    this.colorName.set(c.colorName);
    this.colorStart.set(c.colorStart);
    this.colorEnd.set(c.colorEnd);
    this.borderColor.set(c.borderColor);
  }

  pickPreset(s: MenuSectionColor): void {
    this.colorName.set(s.colorName);
    this.colorStart.set(s.colorStart);
    this.colorEnd.set(s.colorEnd);
    this.borderColor.set(s.borderColor);
  }

  onCustom(key: 'colorStart' | 'colorEnd' | 'borderColor', hex: string): void {
    const rgba = this.hexToRgba(hex);
    if (key === 'colorStart')   this.colorStart.set(rgba);
    if (key === 'colorEnd')     this.colorEnd.set(rgba);
    if (key === 'borderColor')  this.borderColor.set(rgba);
    this.colorName.set('Custom');
  }

  confirm(): void {
    this.ref.close({
      colorName:   this.colorName(),
      colorStart:  this.colorStart(),
      colorEnd:    this.colorEnd(),
      borderColor: this.borderColor(),
    });
  }

  /** Best-effort `rgba(r, g, b, a)` → `#rrggbb` for `<input type=color>`. */
  toHex(rgba: string): string {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgba);
    if (!m) return /^#/.test(rgba) ? rgba : '#000000';
    const [r, g, b] = m.slice(1, 4).map(Number);
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
  }

  hexToRgba(hex: string): string {
    const m = /^#([\da-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 1)`;
  }
}
