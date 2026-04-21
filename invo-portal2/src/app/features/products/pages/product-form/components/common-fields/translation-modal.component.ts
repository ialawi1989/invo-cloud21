import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MODAL_DATA, MODAL_REF, ModalRef } from '@shared/modal';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';

export interface TranslationModalData {
  title: string;
  value: { en: string; ar: string };
}

@Component({
  selector: 'app-translation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="data.title" />
    <div class="tm-body">
      <label class="tm-label">English</label>
      <input
        type="text"
        class="tm-input"
        [ngModel]="en()"
        (ngModelChange)="en.set($event)"
        placeholder="English"
      />
      <label class="tm-label">العربية</label>
      <input
        type="text"
        class="tm-input"
        dir="rtl"
        [ngModel]="ar()"
        (ngModelChange)="ar.set($event)"
        placeholder="العربية"
      />
    </div>
    <div class="tm-footer">
      <button type="button" class="tm-btn tm-btn--ghost" (click)="modalRef.dismiss()">
        {{ 'COMMON.ACTIONS.CANCEL' | translate }}
      </button>
      <button type="button" class="tm-btn tm-btn--primary" (click)="save()">
        {{ 'COMMON.ACTIONS.SAVE' | translate }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .tm-body { padding: 16px 24px 8px; display: flex; flex-direction: column; gap: 8px; }
    .tm-label { font-size: 12px; font-weight: 600; color: #6b7280; margin-top: 8px; }
    .tm-input {
      width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 14px; outline: none;
      transition: border-color .15s;
    }
    .tm-input:focus { border-color: #32acc1; }
    .tm-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 16px 24px 20px; border-top: 1px solid #f1f5f9;
    }
    .tm-btn {
      padding: 8px 16px; border-radius: 8px; font-size: 13px;
      font-weight: 500; cursor: pointer; border: 1px solid transparent;
    }
    .tm-btn--ghost { background: #fff; border-color: #e5e7eb; color: #374151; }
    .tm-btn--primary { background: #32acc1; color: #fff; }
    .tm-btn--primary:hover { background: #2a95a8; }
  `],
})
export class TranslationModalComponent {
  data = inject<TranslationModalData>(MODAL_DATA);
  modalRef = inject<ModalRef<{ en: string; ar: string }>>(MODAL_REF);

  en = signal(this.data.value.en ?? '');
  ar = signal(this.data.value.ar ?? '');

  save(): void {
    this.modalRef.close({ en: this.en(), ar: this.ar() });
  }
}
