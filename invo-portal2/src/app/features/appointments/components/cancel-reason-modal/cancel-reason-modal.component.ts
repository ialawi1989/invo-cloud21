import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

export interface CancelReasonResult {
  confirmed: boolean;
  reason?: string;
}

@Component({
  selector: 'app-cancel-reason-modal',
  standalone: true,
  imports: [FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="'APPOINTMENTS.FORM.CANCEL_REASON_TITLE' | translate" />

    <div class="body">
      <label>{{ 'APPOINTMENTS.FORM.CANCEL_REASON_LABEL' | translate }}</label>
      <textarea
        rows="3"
        [(ngModel)]="reason"
        [placeholder]="'APPOINTMENTS.FORM.CANCEL_REASON_PLACEHOLDER' | translate"
      ></textarea>
    </div>

    <app-modal-footer>
      <button class="btn-cancel" (click)="ref.close({ confirmed: false })">
        {{ 'APPOINTMENTS.FORM.KEEP' | translate }}
      </button>
      <button class="btn-confirm" (click)="ref.close({ confirmed: true, reason: reason() })">
        {{ 'APPOINTMENTS.FORM.CONFIRM_CANCEL' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .body { padding: 20px 24px; display: flex; flex-direction: column; gap: 8px; }
    label { font-size: 13px; font-weight: 600; color: #374151; }
    textarea {
      width: 100%; resize: vertical; padding: 10px 12px;
      border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-family: inherit;
      &:focus { outline: none; border-color: #32acc1; }
    }
    .btn-cancel {
      padding: 9px 20px; background: #f3f4f6; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 13px; cursor: pointer;
      &:hover { background: #e5e7eb; }
    }
    .btn-confirm {
      padding: 9px 24px; background: #ef4444; color: #fff;
      border: none; border-radius: 8px; font-size: 13px;
      font-weight: 600; cursor: pointer;
      &:hover { background: #dc2626; }
    }
  `],
})
export class CancelReasonModalComponent {
  data = inject(MODAL_DATA, { optional: true });
  ref = inject<ModalRef<CancelReasonResult>>(MODAL_REF);

  reason = signal('');
}
