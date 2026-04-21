import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '../../modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '../../modal/modal.tokens';
import { ModalHeaderComponent } from '../../modal/modal-header.component';
import { ModalFooterComponent } from '../../modal/modal-footer.component';
import { TabType } from './tab-builder.types';
import { TabTypeIconComponent } from './tab-type-icon.component';

export interface AddTabResult {
  name: string;
  type: TabType;
}

interface AddTabData {
  existingAbbrs: string[];
}

@Component({
  selector: 'app-add-tab-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, TabTypeIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'TAB_BUILDER.ADD_TEMPLATE' | translate"/>

    <div class="modal-body">
      <label class="field">
        <span class="field__label">{{ 'TAB_BUILDER.TEMPLATE_NAME' | translate }}</span>
        <input
          type="text"
          class="field__input"
          [(ngModel)]="name"
          (ngModelChange)="onNameChange($event)"
          [placeholder]="'TAB_BUILDER.TEMPLATE_NAME_PLACEHOLDER' | translate"
          autofocus
        />
        @if (nameError()) {
          <span class="field__error">{{ nameError() | translate }}</span>
        }
      </label>

      <div class="field">
        <span class="field__label">{{ 'TAB_BUILDER.TAB_TYPE' | translate }}</span>
        <div class="types">
          @for (opt of TYPE_OPTIONS; track opt.value) {
            <button
              type="button"
              class="type-card"
              [class.type-card--selected]="type() === opt.value"
              (click)="type.set(opt.value)"
            >
              <app-tab-type-icon [type]="opt.value" [size]="18"/>
              <div class="type-card__body">
                <p class="type-card__label">{{ opt.labelKey | translate }}</p>
                <p class="type-card__desc">{{ opt.descKey | translate }}</p>
              </div>
            </button>
          }
        </div>
      </div>
    </div>

    <app-modal-footer>
      <button type="button" class="btn btn-ghost" (click)="cancel()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        [disabled]="!canCreate()"
        (click)="confirm()"
      >
        {{ 'TAB_BUILDER.CREATE_TEMPLATE' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .modal-body  { padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }
    .field       { display: flex; flex-direction: column; gap: 6px; }
    .field__label{ font-size: 12px; font-weight: 600; color: #374151; }
    .field__input{
      padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
      font-size: 14px; outline: none;
      &:focus { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.15); }
    }
    .field__error{ font-size: 12px; color: #dc2626; }

    .types       { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .type-card {
      padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
      background: #fff; text-align: start; cursor: pointer;
      display: flex; align-items: flex-start; gap: 10px;
      transition: border-color .12s, background .12s;
      color: #475569;
      &:hover  { border-color: #cbd5e1; }
    }
    .type-card--selected{ border-color: #32acc1; background: #f0fafc; color: #0f172a; }
    .type-card__body { flex: 1; min-width: 0; }
    .type-card__label{ font-size: 13px; font-weight: 600; margin: 0; }
    .type-card__desc { font-size: 11px; color: #64748b; margin: 2px 0 0; }

    .btn {
      padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer;
      font-size: 14px; font-weight: 500;
    }
    .btn-ghost   { background: transparent; color: #475569; &:hover { background: #f1f5f9; } }
    .btn-primary { background: #32acc1; color: #fff;
      &:disabled { opacity: .5; cursor: not-allowed; }
      &:not(:disabled):hover { background: #2a93a6; }
    }
  `],
})
export class AddTabModalComponent {
  private modalRef = inject<ModalRef<AddTabResult>>(MODAL_REF);
  private data     = inject<AddTabData>(MODAL_DATA);

  readonly TYPE_OPTIONS: { value: TabType; labelKey: string; descKey: string }[] = [
    { value: 'specs',    labelKey: 'TAB_BUILDER.TYPES.SPECS',    descKey: 'TAB_BUILDER.TYPES.SPECS_DESC' },
    { value: 'vehicle',  labelKey: 'TAB_BUILDER.TYPES.VEHICLE',  descKey: 'TAB_BUILDER.TYPES.VEHICLE_DESC' },
    { value: 'table',    labelKey: 'TAB_BUILDER.TYPES.TABLE',    descKey: 'TAB_BUILDER.TYPES.TABLE_DESC' },
    { value: 'richtext', labelKey: 'TAB_BUILDER.TYPES.RICHTEXT', descKey: 'TAB_BUILDER.TYPES.RICHTEXT_DESC' },
    { value: 'faq',      labelKey: 'TAB_BUILDER.TYPES.FAQ',      descKey: 'TAB_BUILDER.TYPES.FAQ_DESC' },
    { value: 'review',   labelKey: 'TAB_BUILDER.TYPES.REVIEW',   descKey: 'TAB_BUILDER.TYPES.REVIEW_DESC' },
    { value: 'custom',   labelKey: 'TAB_BUILDER.TYPES.CUSTOM',   descKey: 'TAB_BUILDER.TYPES.CUSTOM_DESC' },
  ];

  name      = signal('');
  type      = signal<TabType>('specs');
  nameError = signal<string>('');

  canCreate(): boolean {
    return !this.nameError() && !!this.name().trim();
  }

  onNameChange(v: string): void {
    const slug = (v ?? '').toLowerCase().trim().replace(/\s+/g, '_');
    if (!slug) { this.nameError.set(''); return; }
    const existing = this.data?.existingAbbrs ?? [];
    this.nameError.set(existing.includes(slug) ? 'TAB_BUILDER.ERR_DUPLICATE_NAME' : '');
  }

  cancel(): void { this.modalRef.dismiss(); }
  confirm(): void {
    if (!this.canCreate()) return;
    this.modalRef.close({ name: this.name().trim(), type: this.type() });
  }
}
