import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';

import { ReceiptBuilderService } from '../../../services/receipt-builder.service';

export interface RenameTemplateModalData {
  /** Server id of the template to rename. Required. */
  id: string;
  /** Current name — pre-fills the input. */
  currentName: string;
}

/**
 * Renames a receipt-builder template without leaving the list page.
 *
 * Why a modal instead of inline edit-on-row:
 *   The full template (with `recieptTemplate[]`) is what `save()` expects
 *   — the list endpoint only returns a summary. So we fetch the full
 *   template here, swap the name, and round-trip through `save()`. A
 *   modal also gives the user an obvious cancel path; an accidental
 *   blur on an inline editor would silently rename.
 */
@Component({
  selector: 'app-rename-template-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'RECEIPT_BUILDER.RENAME.TITLE' | translate" />

    <div class="body">
      <label for="rt-name" class="lbl">{{ 'RECEIPT_BUILDER.NAME' | translate }}</label>
      <input
        id="rt-name"
        type="text"
        class="input"
        [class.input--invalid]="error()"
        [ngModel]="name()"
        (ngModelChange)="name.set($event); error.set('')"
        [disabled]="busy()"
        [placeholder]="'RECEIPT_BUILDER.NAME_PLACEHOLDER' | translate"
        autofocus
      />

      @if (error()) {
        <p class="err">{{ error() }}</p>
      }
    </div>

    <app-modal-footer>
      <button type="button" class="btn-cancel" (click)="ref.dismiss()" [disabled]="busy()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button type="button" class="btn-confirm" (click)="save()" [disabled]="busy() || !canSave()">
        @if (busy()) {
          <span class="spinner"></span>
        }
        {{ 'COMMON.SAVE' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .body  { padding: 20px 24px; }
    .lbl   {
      display: block;
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }

    .input {
      width: 100%;
      padding: 9px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
      font: inherit;
      font-size: 14px;
      color: #0f172a;
      transition: border-color 120ms ease, box-shadow 120ms ease;

      &:focus {
        outline: none;
        border-color: var(--color-brand-500);
        box-shadow: 0 0 0 3px rgba(50, 172, 193, 0.12);
      }
      &--invalid { border-color: #ef4444; }
    }

    .err { margin: 8px 0 0; font-size: 12px; color: #b91c1c; }

    .btn-cancel {
      padding: 9px 20px; background: #f3f4f6; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 13px; cursor: pointer;
      &:hover:not(:disabled) { background: #e5e7eb; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .btn-confirm {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 9px 24px; background: #32acc1; color: #fff;
      border: none; border-radius: 8px; font-size: 13px;
      font-weight: 600; cursor: pointer;
      &:hover:not(:disabled) { background: #2b95a8; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .spinner {
      width: 14px; height: 14px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      animation: rt-spin .8s linear infinite;
    }
    @keyframes rt-spin { to { transform: rotate(360deg); } }
  `],
})
export class RenameTemplateModalComponent {
  private service = inject(ReceiptBuilderService);

  data = inject<RenameTemplateModalData>(MODAL_DATA);
  ref  = inject<ModalRef<{ id: string; name: string } | undefined>>(MODAL_REF);

  name  = signal<string>(this.data.currentName ?? '');
  busy  = signal<boolean>(false);
  error = signal<string>('');

  canSave(): boolean {
    const next = this.name().trim();
    return next.length > 0 && next !== (this.data.currentName ?? '').trim();
  }

  async save(): Promise<void> {
    const next = this.name().trim();
    if (!next) {
      this.error.set('Name is required');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      // Fetch the full template (the list endpoint only returns a
      // summary, but `save()` round-trips the entire `recieptTemplate`
      // payload). Swap the name, persist, then close with the new name
      // so the parent list can refresh in place.
      const full = await this.service.getById(this.data.id);
      if (!full) {
        this.error.set('Template not found');
        this.busy.set(false);
        return;
      }
      const result = await this.service.save({ ...full, name: next });
      if (!result.success) {
        this.error.set('Save failed');
        this.busy.set(false);
        return;
      }
      this.ref.close({ id: this.data.id, name: next });
    } catch (err) {
      console.error('Rename failed', err);
      this.error.set('Save failed');
      this.busy.set(false);
    }
  }
}
