import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

import { TranslationLang } from '../../services/covered-address.types';

export interface TranslationModalData {
  /** Title shown at the top of the modal — usually "Edit City
   *  translation" or "Edit Governorate translation". */
  title: string;
  /** Current value (en + ar). The modal owns its own draft so
   *  cancel doesn't mutate the caller. */
  value: TranslationLang;
}

/**
 * Two-field translation editor — English + Arabic — for a single
 * address row's display name. Returns the new `{ en, ar }` pair
 * via `afterClosed()` (or `undefined` on cancel).
 */
@Component({
  selector: 'app-translation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="data.title"/>

    <div class="tm__body">
      <label class="tm__field">
        <span>{{ 'COMMON.TEXT_IN_ENGLISH' | translate }}</span>
        <input class="tm__input" type="text" [ngModel]="en()" (ngModelChange)="en.set($event)" dir="ltr"/>
      </label>

      <label class="tm__field">
        <span>{{ 'COMMON.TEXT_IN_ARABIC' | translate }}</span>
        <input class="tm__input" type="text" [ngModel]="ar()" (ngModelChange)="ar.set($event)" dir="rtl"/>
      </label>
    </div>

    <app-modal-footer>
      <button type="button" class="btn btn-ghost"   (click)="cancel()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="btn btn-primary" (click)="apply()" [disabled]="!canApply()">
        {{ 'COMMON.APPLY' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .tm__body {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .tm__field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      > span { font-size: 12px; font-weight: 600; color: #475569; }
    }
    .tm__input {
      appearance: none;
      width: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 9px 12px;
      font-size: 13px;
      color: #0f172a;
      background: #fff;
      transition: border-color 100ms ease, box-shadow 100ms ease;
      &:focus {
        outline: 0;
        border-color: var(--color-brand-400, #7dd3fc);
        box-shadow: 0 0 0 2px var(--color-brand-100, #e0f2fe);
      }
    }
  `],
})
export class TranslationModalComponent {
  data = inject<TranslationModalData>(MODAL_DATA);
  private ref = inject<ModalRef<TranslationLang | undefined>>(MODAL_REF);

  en = signal<string>(this.data.value?.en ?? '');
  ar = signal<string>(this.data.value?.ar ?? '');

  canApply = (): boolean => {
    // Require at least one of the two so saving doesn't clear
    // an existing translation by accident.
    return this.en().trim().length > 0 || this.ar().trim().length > 0;
  };

  apply(): void {
    this.ref.close({ en: this.en().trim(), ar: this.ar().trim() });
  }
  cancel(): void { this.ref.dismiss(); }
}
