import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalRef } from '../../shared/modal/modal.service';
import { MODAL_REF } from '../../shared/modal/modal.tokens';

/**
 * Replaces the native browser `alert()` for the "Your session has expired"
 * notification. Single OK button — no header close, no backdrop dismiss
 * (the modal is opened with `closeable: false, closeOnBackdrop: false`).
 */
@Component({
  selector: 'app-session-expired-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wrap">
      <div class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="28" height="28">
          <circle cx="12" cy="12" r="9"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2"/>
        </svg>
      </div>

      <h2 class="title">Session expired</h2>
      <p   class="msg">Your session has expired. Please log in again to continue.</p>

      <button type="button" class="ok" (click)="ref.close()" autofocus>
        OK
      </button>
    </div>
  `,
  styles: [`
    .wrap {
      display: flex; flex-direction: column; align-items: center;
      gap: 12px; padding: 28px 28px 24px; text-align: center;
    }
    .icon {
      width: 56px; height: 56px; border-radius: 50%;
      background: #fef3c7; color: #b45309;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 4px;
    }
    .title {
      margin: 0; font-size: 17px; font-weight: 600; color: #0f172a;
    }
    .msg {
      margin: 0; font-size: 14px; color: #475569; line-height: 1.5;
      max-width: 320px;
    }
    .ok {
      margin-top: 8px;
      padding: 10px 28px; border: none; border-radius: 8px;
      background: #32acc1; color: #fff;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: background .12s;
      min-width: 120px;
    }
    .ok:hover  { background: #2890a3; }
    .ok:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(50, 172, 193, .25);
    }
  `],
})
export class SessionExpiredModalComponent {
  ref = inject<ModalRef<void>>(MODAL_REF);
}
