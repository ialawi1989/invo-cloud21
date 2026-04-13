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
        <div>
          <h2 class="bp-title">Branches</h2>
          @if (branchCount > 0) {
            <span class="bp-badge">{{ branchCount }} connected</span>
          }
        </div>
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
          <div class="bp-row" [class.bp-row--connected]="branch.isConnected">
            <div class="bp-row-info">
              <span class="bp-row-name">{{ branch.name }}</span>
              @if (branch.isConnected && branch.terminalName) {
                <span class="bp-row-terminal">
                  Connected to Terminal Name: {{ branch.terminalName }}
                  @if (branch.terminalType) { · {{ branch.terminalType }} }
                </span>
              }
            </div>

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
    :host { display: block; }
    .bp { width: 320px; min-height: 100%; background: #fff; display: flex; flex-direction: column; }

    .bp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px 14px; border-bottom: 1px solid #f0f2f5; flex-shrink: 0;
    }
    .bp-title { font-size: 16px; font-weight: 600; color: #111827; margin: 0; display: inline; }
    .bp-badge {
      display: inline-block; margin-left: 8px;
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
      background: #e6f7f7; color: #32acc1;
    }

    .bp-list { flex: 1; overflow-y: auto; }
    .bp-state {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 32px 20px; color: #9ca3af; font-size: 13px;
    }
    .bp-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px; gap: 12px; border-bottom: 1px solid #f9fafb;
      &:hover { background: #fafafa; }
    }
    .bp-row-info { flex: 1; min-width: 0; }
    .bp-row-name { display: block; font-size: 14px; font-weight: 500; color: #111827; }
    .bp-row-terminal { display: block; font-size: 12px; color: #32acc1; margin-top: 3px; line-height: 1.4; }

    .bp-btn {
      flex-shrink: 0; height: 34px; padding: 0 14px;
      border-radius: 8px; font-size: 13px; font-weight: 500;
      cursor: pointer; border: none; font-family: inherit;
      display: flex; align-items: center; gap: 6px; transition: all .15s;
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .bp-btn--connect {
      background: #e6f7f7; color: #32acc1; border: 1px solid #b2e4e4;
      &:hover:not(:disabled) { background: #cef0f0; }
    }
    .bp-btn--disconnect {
      background: #fef2f2; color: #ef4444; border: 1px solid #fecaca;
      &:hover:not(:disabled) { background: #fee2e2; }
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
