import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { MODAL_DATA } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { BranchConnectionService, BranchConnection } from '../../services/branch.service';

@Component({
  selector: 'app-disconnect-branch-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dm">
      <!-- Warning icon -->
      <div class="dm-icon-wrap">
        <div class="dm-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
      </div>

      <!-- Message -->
      <p class="dm-msg">
        Do you want to disconnect the terminal?<br>
        Please enter your password below.
      </p>

      <!-- Password input -->
      <div class="dm-input-wrap">
        <input class="dm-input"
               type="password"
               [(ngModel)]="password"
               placeholder="Enter your password"
               [class.dm-input--err]="submitted() && !password.trim()"
               (keydown.enter)="confirm()" />
        @if (submitted() && !password.trim()) {
          <svg class="dm-input-err-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        }
      </div>
      @if (submitted() && !password.trim()) {
        <p class="dm-err">This value is required</p>
      }
      @if (error()) {
        <p class="dm-err">{{ error() }}</p>
      }

      <!-- Actions -->
      <div class="dm-footer">
        <button class="dm-btn dm-btn--cancel" (click)="ref.dismiss()">Cancel</button>
        <button class="dm-btn dm-btn--confirm" (click)="confirm()" [disabled]="loading()">
          @if (loading()) { <span class="dm-spin"></span> }
          @else { Confirm }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dm { padding: 28px 24px 24px; min-width: 320px; text-align: center; }

    .dm-icon-wrap { display: flex; justify-content: center; margin-bottom: 16px; }
    .dm-icon {
      width: 68px; height: 68px; border-radius: 50%;
      background: #fffbeb; border: 2px solid #fef3c7;
      display: flex; align-items: center; justify-content: center;
    }
    .dm-msg {
      font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 20px;
    }

    .dm-input-wrap { position: relative; margin-bottom: 4px; }
    .dm-input {
      width: 100%; height: 44px; padding: 0 38px 0 14px; box-sizing: border-box;
      border: 1.5px solid #e5e7eb; border-radius: 8px;
      font-size: 16px; font-family: inherit; color: #111827; outline: none;
      text-align: center;
      &:focus { border-color: #32acc1; }
      &::placeholder { color: #9ca3af; }
    }
    .dm-input--err { border-color: #ef4444 !important; }
    .dm-input-err-icon {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    }
    .dm-err { font-size: 12px; color: #ef4444; margin: 4px 0 16px; }

    .dm-footer { display: flex; gap: 10px; margin-top: 8px; }
    .dm-btn {
      flex: 1; height: 42px; border-radius: 8px; font-size: 14px; font-weight: 500;
      cursor: pointer; border: none; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      transition: all .15s;
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .dm-btn--cancel  { background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; &:hover:not(:disabled) { background: #fee2e2; } }
    .dm-btn--confirm { background: #32acc1; color: #fff; &:hover:not(:disabled) { background: #2b95a8; } }

    .dm-spin {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
      animation: spin .6s linear infinite; display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class DisconnectBranchModalComponent {
  ref  = inject<ModalRef>(MODAL_REF);
  data = inject<{ branch: BranchConnection }>(MODAL_DATA);
  private svc = inject(BranchConnectionService) as BranchConnectionService;

  password  = '';
  submitted = signal(false);
  loading   = signal(false);
  error     = signal('');

  async confirm(): Promise<void> {
    this.submitted.set(true);
    if (!this.password.trim()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.svc.disconnectWithPassword(this.data.branch.id, this.password);
      this.ref.close({ disconnected: true });
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Incorrect password. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
