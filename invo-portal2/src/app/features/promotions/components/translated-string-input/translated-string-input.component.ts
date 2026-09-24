import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ModalService } from '@shared/modal/modal.service';
import { TranslateLinkComponent } from '@shared/components/translate-link/translate-link.component';
import {
  TranslationLang,
  TranslationModalComponent,
  TranslationModalData,
} from '@shared/components/translation-modal/translation-modal.component';

import { TranslatedString } from '../../models/common.model';

/**
 * One text field stored as a per-language map (legacy `TranslatedString`).
 * The input edits the UI-language entry; the "Translation" link opens the
 * shared translation modal for the rest and writes the whole map back —
 * the legacy `[(ngModel)]="x[lang]"` + `loadTranslationModal` pair as one control.
 */
@Component({
  selector: 'app-translated-string-input',
  standalone: true,
  imports: [FormsModule, TranslateModule, TranslateLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tsi">
      @if (label()) {
        <div class="tsi__head">
          <label class="tsi__label">{{ label() | translate }}@if (required()) { <span class="tsi__req">*</span> }</label>
          <app-translate-link (clicked)="openTranslation()"/>
        </div>
      } @else {
        <div class="tsi__head tsi__head--end"><app-translate-link (clicked)="openTranslation()"/></div>
      }
      @if (multiline()) {
        <textarea class="tsi__input" rows="3" [ngModel]="text()" (ngModelChange)="setText($event)"
          [placeholder]="placeholder() ? (placeholder() | translate) : ''"></textarea>
      } @else {
        <input type="text" class="tsi__input" [ngModel]="text()" (ngModelChange)="setText($event)"
          [placeholder]="placeholder() ? (placeholder() | translate) : ''"/>
      }
    </div>
  `,
  styles: [`
    .tsi { display: flex; flex-direction: column; gap: 6px; }
    .tsi__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .tsi__head--end { justify-content: flex-end; }
    .tsi__label { font-size: 13px; font-weight: 600; color: #334155; }
    .tsi__req { color: #dc2626; margin-inline-start: 2px; }
    .tsi__input {
      padding: 9px 12px; border: 1px solid #d0d5dd; border-radius: 8px;
      font-size: 13.5px; color: #0f172a; font-family: inherit; resize: vertical;
    }
    .tsi__input:focus { outline: none; border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38,145,164,.12); }
  `],
})
export class TranslatedStringInputComponent {
  private lang = inject(LanguageService);
  private modal = inject(ModalService);

  value = input<TranslatedString | null | undefined>({});
  label = input<string>('');
  placeholder = input<string>('');
  required = input<boolean>(false);
  multiline = input<boolean>(false);
  valueChange = output<TranslatedString>();

  private code = computed(() => this.lang.current() || 'en');
  text = computed(() => this.value()?.[this.code()] ?? '');

  setText(text: string): void {
    this.valueChange.emit({ ...(this.value() ?? {}), [this.code()]: text });
  }

  async openTranslation(): Promise<void> {
    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang | null>(
      TranslationModalComponent,
      {
        size: 'sm',
        data: { initial: { ...(this.value() ?? {}) }, multiline: this.multiline() },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (result) this.valueChange.emit({ ...result });
  }
}
