import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalRef } from '../modal.service'
import { MODAL_DATA, MODAL_REF } from '../modal.tokens';
import { ModalHeaderComponent } from '../modal-header.component';
import { ModalFooterComponent } from '../modal-footer.component';

export interface ConfirmModalData {
  title:    string;
  message:  string;
  confirm?: string;  // button label, default 'Confirm'
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
    </div>

    <app-modal-footer>
      <button class="btn-cancel" (click)="ref.dismiss()">Cancel</button>
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
    .message { font-size: 14px; color: #374151; margin: 0; line-height: 1.6; }

    .btn-cancel {
      padding: 9px 20px; background: #f3f4f6; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 13px; cursor: pointer;
      &:hover { background: #e5e7eb; }
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
