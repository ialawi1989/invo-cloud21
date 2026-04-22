import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MODAL_DATA, MODAL_REF, ModalRef } from '@shared/modal';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { RichEditorComponent } from '@shared/components/rich-editor/rich-editor.component';

export interface TranslationModalData {
  title: string;
  value: { en: string; ar: string };
  /** When true, render each language with the shared RichEditor. Default: false (plain text input). */
  rich?: boolean;
}

/**
 * Side-by-side translation editor. Uses a language tab strip so editors
 * stay in context while switching between English and Arabic — no need to
 * scroll through two full stacked editors when content is long. When
 * `data.rich` is true, each language renders in the shared `RichEditor`
 * (full WYSIWYG + HTML toggle); otherwise a plain text input is used.
 */
@Component({
  selector: 'app-translation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, RichEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="data.title" />

    <div class="tm-body">
      <!-- Language tabs -->
      <div class="tm-tabs" role="tablist">
        <button type="button" role="tab"
                class="tm-tab"
                [class.tm-tab--active]="lang() === 'en'"
                (click)="lang.set('en')">
          English
        </button>
        <button type="button" role="tab"
                class="tm-tab"
                [class.tm-tab--active]="lang() === 'ar'"
                (click)="lang.set('ar')">
          العربية
        </button>
      </div>

      <!-- Editor — one instance, value swapped by active language. -->
      @if (data.rich) {
        <app-rich-editor
          [ngModel]="activeValue()"
          (ngModelChange)="onChange($event)"
          [placeholder]="lang() === 'ar' ? 'العربية' : 'English'"
          height="220px"
        />
      } @else {
        <input
          type="text"
          class="tm-input"
          [attr.dir]="lang() === 'ar' ? 'rtl' : 'ltr'"
          [ngModel]="activeValue()"
          (ngModelChange)="onChange($event)"
          [placeholder]="lang() === 'ar' ? 'العربية' : 'English'"
        />
      }
    </div>

    <div class="tm-footer">
      <button type="button" class="tm-btn tm-btn--ghost" (click)="modalRef.dismiss()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button type="button" class="tm-btn tm-btn--primary" (click)="save()">
        {{ 'COMMON.SAVE' | translate }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .tm-body { padding: 16px 24px 8px; display: flex; flex-direction: column; gap: 12px; }

    .tm-tabs {
      display: inline-flex;
      padding: 3px;
      background: #f1f5f9;
      border-radius: 8px;
      align-self: flex-start;
    }
    .tm-tab {
      padding: 6px 14px;
      border: none;
      background: transparent;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: background .12s, color .12s;

      &:hover { color: #334155; }
      &--active {
        background: #fff;
        color: #0f172a;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
      }
    }

    .tm-input {
      width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 14px; outline: none;
      transition: border-color .15s;
    }
    .tm-input:focus { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.15); }

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
  lang = signal<'en' | 'ar'>('en');

  activeValue = computed<string>(() => this.lang() === 'ar' ? this.ar() : this.en());

  onChange(v: string): void {
    if (this.lang() === 'ar') this.ar.set(v ?? '');
    else                      this.en.set(v ?? '');
  }

  save(): void {
    this.modalRef.close({ en: this.en(), ar: this.ar() });
  }
}
