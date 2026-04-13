import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { MODAL_DATA } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { BranchConnectionService, BranchConnection } from '../../services/branch.service';

@Component({
  selector: 'app-connect-branch-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cm">
      <div class="cm-header">
        <h3 class="cm-title">Connect to branch</h3>
        <button class="cm-close" (click)="ref.dismiss()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="cm-body">
        <p class="cm-branch-name">{{ data.branch.name }}</p>
        <label class="cm-label">Type the token</label>
        <input class="cm-input" [(ngModel)]="token"
               placeholder="Type the token"
               [class.cm-input--err]="submitted() && !token.trim()"
               (keydown.enter)="confirm()" />
        @if (submitted() && !token.trim()) {
          <p class="cm-err">Token is required</p>
        }
        @if (error()) {
          <p class="cm-err">{{ error() }}</p>
        }
      </div>

      <div class="cm-footer">
        <button class="cm-btn cm-btn--cancel" (click)="ref.dismiss()">Cancel</button>
        <button class="cm-btn cm-btn--confirm" (click)="confirm()" [disabled]="loading()">
          @if (loading()) { <span class="cm-spin"></span> }
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Connect
        </button>
      </div>
    </div>
  `,
  styles: [`
    .cm { padding: 24px; min-width: 320px; }
    .cm-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .cm-title { font-size: 16px; font-weight: 600; color: #111827; margin: 0; }
    .cm-close {
      width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; border-radius: 6px; color: #9ca3af; cursor: pointer;
      &:hover { background: #f4f5f7; color: #374151; }
    }
    .cm-branch-name { font-size: 13px; color: #6b7280; margin: 0 0 14px; }
    .cm-label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 8px; }
    .cm-input {
      width: 100%; height: 42px; padding: 0 12px; box-sizing: border-box;
      border: 1.5px solid #e5e7eb; border-radius: 8px;
      font-size: 16px; font-family: inherit; color: #111827; outline: none;
      &:focus { border-color: #32acc1; }
      &::placeholder { color: #9ca3af; }
    }
    .cm-input--err { border-color: #ef4444 !important; }
    .cm-err { font-size: 12px; color: #ef4444; margin: 6px 0 0; }
    .cm-footer { display: flex; gap: 10px; margin-top: 20px; }
    .cm-btn {
      flex: 1; height: 40px; border-radius: 8px; font-size: 14px; font-weight: 500;
      cursor: pointer; border: none; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      transition: all .15s;
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .cm-btn--cancel { background: #f4f5f7; color: #374151; &:hover:not(:disabled) { background: #e9ecef; } }
    .cm-btn--confirm { background: #32acc1; color: #fff; &:hover:not(:disabled) { background: #2b95a8; } }
    .cm-spin {
      width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;
      border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
      animation: spin .6s linear infinite; display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ConnectBranchModalComponent {
  ref  = inject<ModalRef>(MODAL_REF);
  data = inject<{ branch: BranchConnection }>(MODAL_DATA);
  private svc = inject(BranchConnectionService) as BranchConnectionService;

  token     = '';
  submitted = signal(false);
  loading   = signal(false);
  error     = signal('');

  async confirm(): Promise<void> {
    this.submitted.set(true);
    if (!this.token.trim()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.svc.connect(this.data.branch.id, this.token.trim());
      this.ref.close({ connected: true });
    } catch (err: any) {
      this.error.set(err?.message ?? 'Connection failed. Check the token.');
    } finally {
      this.loading.set(false);
    }
  }
}
