import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalRef } from '../modal.service'
import { MODAL_DATA, MODAL_REF } from '../modal.tokens';
import { ModalHeaderComponent } from '../modal-header.component';
import { ModalFooterComponent } from '../modal-footer.component';

export interface ConfirmModalData {
  title:    string;
  message:  string;
  /** Optional callout rendered below the message (e.g. a warning about side-effects). */
  note?:    string;
  confirm?: string;  // button label, default 'Confirm'
  cancel?:  string;  // cancel button label, default 'Cancel'
  danger?:  boolean; // red confirm button
}

/**
 * Generic confirm dialog.
 * Usage:
 *   const ref = modalService.open(ConfirmModalComponent, {
 *     data: { title: 'Delete invoice', message: 'This cannot be undone.', danger: true }
 *   });
 *   const confirmed = await ref.afterClosed();  // true | undefined
 */
@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="data.title" />

    <div class="body">
      <p class="message">{{ data.message }}</p>
      @if (data.note) {
        <div class="note" [class.note--danger]="data.danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{{ data.note }}</span>
        </div>
      }
    </div>

    <app-modal-footer>
      <button class="btn-cancel" (click)="ref.dismiss()">{{ data.cancel ?? 'Cancel' }}</button>
      <button
        class="btn-confirm"
        [class.btn-confirm--danger]="data.danger"
        (click)="ref.close(true)">
        {{ data.confirm ?? 'Confirm' }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .body    { padding: 20px 24px; }
    .message { font-size: 14px; color: var(--ui-text-3); margin: 0; line-height: 1.6; }

    .note {
      display: flex; align-items: flex-start; gap: 8px;
      margin-top: 14px; padding: 10px 12px;
      background: var(--ui-amber-soft); border: 1px solid var(--ui-x-fcd34d);
      border-radius: 8px;
      font-size: 13px; color: var(--ui-amber-text); line-height: 1.5;
    }
    .note svg { flex-shrink: 0; margin-top: 1px; }
    .note--danger {
      background: var(--ui-red-soft); border-color: var(--ui-red-soft-2); color: var(--ui-red-text);
    }

    .btn-cancel {
      padding: 9px 20px; background: var(--ui-surface-2); border: 1px solid var(--ui-line);
      border-radius: 8px; font-size: 13px; cursor: pointer;
      &:hover { background: var(--ui-line); }
    }
    .btn-confirm {
      padding: 9px 24px; background: #32acc1; color: #fff;
      border: none; border-radius: 8px; font-size: 13px;
      font-weight: 600; cursor: pointer;
      &:hover { background: #2b95a8; }
    }
    .btn-confirm--danger {
      background: #ef4444;
      &:hover { background: #dc2626; }
    }
  `]
})
export class ConfirmModalComponent {
  data = inject<ConfirmModalData>(MODAL_DATA);
  ref  = inject<ModalRef<boolean>>(MODAL_REF);
}
