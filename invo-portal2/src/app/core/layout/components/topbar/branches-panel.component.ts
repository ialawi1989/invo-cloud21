import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef, ModalService } from '../../../../shared/modal/modal.service';
import { BranchConnectionService, BranchConnection } from '../../services/branch.service';
import { ConnectBranchModalComponent } from './connect-branch-modal.component';
import { DisconnectBranchModalComponent } from './disconnect-branch-modal.component';

@Component({
  selector: 'app-branches-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="bp">

      <!-- Header -->
      <div class="bp-header">
        <h2 class="bp-title">Branches</h2>
        @if (branchCount > 0) {
          <span class="bp-badge">{{ branchCount }} connected</span>
        }
      </div>

      <!-- Branch list -->
      <div class="bp-list">
        @if (!branchesLoaded()) {
          <div class="bp-state">
            <span class="spin"></span> Loading branches...
          </div>
        } @else if (branchList().length === 0) {
          <div class="bp-state">No branches found.</div>
        }

        @for (branch of branchList(); track branch.id) {
          <div class="bp-card" [class.bp-card--connected]="branch.isConnected">
            <div class="bp-card-top">
              <span class="bp-card-icon" aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </span>
              <span class="bp-row-name">{{ branch.name }}</span>
              <span class="bp-status" [class.bp-status--on]="branch.isConnected">
                {{ branch.isConnected ? 'Connected' : 'Not connected' }}
              </span>
            </div>

            @if (branch.isConnected && branch.terminalName) {
              <div class="bp-terminal">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                <span class="bp-terminal-label">Terminal</span>
                <span class="bp-terminal-name">
                  {{ branch.terminalName }}@if (branch.terminalType) { · {{ branch.terminalType }} }
                </span>
              </div>
            }

            @if (branch.isConnected) {
              <button class="bp-btn bp-btn--disconnect"
                      (click)="openDisconnect(branch)"
                      [disabled]="busy() === branch.id">
                @if (busy() === branch.id) { <span class="spin spin--sm"></span> }
                @else { Disconnect }
              </button>
            } @else {
              <button class="bp-btn bp-btn--connect"
                      (click)="openConnect(branch)"
                      [disabled]="busy() === branch.id">
                @if (busy() === branch.id) { <span class="spin spin--sm"></span> }
                @else { Connect }
              </button>
            }
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .bp { width: 340px; min-height: 100%; height: 100%; background: #fff; display: flex; flex-direction: column; }

    /* The drawer's close button sits in the top corner, so the header keeps clear of it. */
    .bp-header {
      display: flex; align-items: center; gap: 10px;
      padding: 18px 60px 14px 20px; border-bottom: 1px solid #f0f2f5; flex-shrink: 0;
    }
    .bp-title { font-size: 17px; font-weight: 800; color: #0f172a; margin: 0; }
    .bp-badge {
      font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px;
      background: #e6f7f7; color: #1e8c9f;
    }

    .bp-list {
      flex: 1; overflow-y: auto; padding: 12px 14px 24px; background: #fafbfc;
      display: flex; flex-direction: column; gap: 12px;
    }
    .bp-state {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 32px 20px; color: #94a3b8; font-size: 13px;
    }

    .bp-card {
      display: flex; flex-direction: column; gap: 10px; padding: 14px;
      background: #fff; border: 1px solid #e8ecf1; border-radius: 14px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
    }
    .bp-card-top { display: flex; align-items: center; gap: 10px; }
    .bp-card-icon {
      flex: none; width: 34px; height: 34px; border-radius: 10px;
      background: #f1f5f9; color: #94a3b8; display: flex; align-items: center; justify-content: center;
    }
    .bp-card--connected .bp-card-icon { background: #eef7f8; color: #2691a4; }
    .bp-row-name { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bp-status {
      flex: none; font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px;
      background: #f1f5f9; color: #64748b;
    }
    .bp-status--on { background: #dcfce7; color: #15803d; }

    .bp-terminal {
      display: flex; align-items: flex-start; gap: 7px; padding: 10px 12px;
      background: #f8fafc; border-radius: 10px; font-size: 12.5px; color: #64748b; line-height: 1.4;
      svg { flex: none; margin-top: 2px; color: #94a3b8; }
    }
    .bp-terminal-label { flex: none; color: #94a3b8; }
    .bp-terminal-name { min-width: 0; color: #1e293b; font-weight: 600; overflow-wrap: anywhere; }

    .bp-btn {
      width: 100%; height: 36px; border-radius: 9px; font-size: 13px; font-weight: 700;
      cursor: pointer; border: 1px solid transparent; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 6px; transition: all .15s;
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .bp-btn--connect {
      background: #1e8c9f; color: #fff;
      &:hover:not(:disabled) { background: #187789; }
      .spin { border-color: rgba(255,255,255,.3); border-top-color: #fff; }
    }
    .bp-btn--disconnect {
      background: #fff; color: #dc2626; border-color: #fecaca;
      &:hover:not(:disabled) { background: #fef2f2; }
    }

    .spin {
      display: inline-block; border-radius: 50%; flex-shrink: 0;
      width: 14px; height: 14px;
      border: 2px solid rgba(50,172,193,.2); border-top-color: #32acc1;
      animation: spin .6s linear infinite;
    }
    .spin--sm { width: 12px; height: 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 991px) { .bp { width: 100%; } }
  `]
})
export class BranchesPanelComponent implements OnInit {
  ref       = inject<ModalRef>(MODAL_REF);
  private modalSvc = inject(ModalService);
  private svc      = inject(BranchConnectionService) as BranchConnectionService;

  readonly branchList     = this.svc.branches;
  readonly branchesLoaded = this.svc.loaded;
  get branchCount(): number { return this.svc.connectedCount; }

  busy = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    if (!this.svc.loaded()) await this.svc.load();
  }

  openConnect(branch: BranchConnection): void {
    const ref = this.modalSvc.open(ConnectBranchModalComponent, {
      size: 'sm', closeOnBackdrop: true,
      data: { branch }
    });
  }

  openDisconnect(branch: BranchConnection): void {
    const ref = this.modalSvc.open(DisconnectBranchModalComponent, {
      size: 'sm', closeOnBackdrop: true,
      data: { branch }
    });
    ref.afterClosed().then((result: any) => {
      if (result?.disconnected) {
        this.svc.branches.update(bs => bs.map(b =>
          b.id === branch.id ? { ...b, terminalId: null, terminalName: null, terminalType: null, isConnected: false } : b
        ));
      }
    });
  }
}
