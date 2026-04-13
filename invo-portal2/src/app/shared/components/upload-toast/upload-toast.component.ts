import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Overlay, OverlayRef, OverlayModule } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { UploadToastService } from './upload-toast.service';
import { SpinnerComponent } from '../spinner';

/**
 * Internal component rendered inside the CDK overlay.
 */
@Component({
  selector: 'app-upload-toast-panel',
  standalone: true,
  imports: [CommonModule, SpinnerComponent],
  template: `
    @if (svc.visible()) {
      <div class="toast">
        <div class="toast-header" [class.done]="svc.isAllDone">
          <span class="toast-title">{{ svc.headerLabel }}</span>
          <div class="toast-actions">
            <button class="toast-btn" (click)="svc.toggleExpand()" [title]="svc.expanded() ? 'Collapse' : 'Expand'">
              <svg [class]="'icon ' + (svc.expanded() ? '' : 'rotate-180')" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            <button class="toast-btn" (click)="svc.dismiss()" title="Close">
              <svg class="icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        @if (svc.expanded()) {
          <div class="toast-body">
            @for (item of svc.items(); track item.id) {
              <div class="toast-item">
                <div class="item-row">
                  @if (item.status === 'uploading') {
                    <app-spinner size="xs" class="text-brand" />
                  } @else if (item.status === 'completed') {
                    <svg class="icon-status done" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7"/>
                    </svg>
                  } @else {
                    <svg class="icon-status fail" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                    </svg>
                  }
                  <div class="item-info">
                    <span class="item-name">{{ item.name }}</span>
                    <span class="item-size">{{ item.size }}</span>
                  </div>
                  <span class="item-status">
                    {{ item.status === 'uploading' ? item.progress + '%' : item.status === 'completed' ? 'Done' : 'Failed' }}
                  </span>
                </div>
                @if (item.status === 'uploading' || item.status === 'completed') {
                  <div class="progress-track">
                    <div [class]="'progress-bar ' + (item.status === 'completed' ? 'progress-bar--done' : '')" [style.width.%]="item.progress"></div>
                  </div>
                }
              </div>
            }
            @if (svc.isAllDone) {
              <button class="clear-btn" (click)="svc.clearCompleted()">Clear Completed</button>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .toast {
      width: 380px; max-width: calc(100vw - 48px);
      background: #fff; border-radius: 12px; overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,.15), 0 0 0 1px rgba(0,0,0,.06);
      font-family: inherit;
    }
    .toast-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; background: #1e293b; color: #fff;
    }
    .toast-header.done { background: var(--color-brand-700, #207484); }
    .toast-title { font-size: 14px; font-weight: 600; }
    .toast-actions { display: flex; gap: 4px; }
    .toast-btn {
      width: 28px; height: 28px; border: none; background: rgba(255,255,255,.15);
      border-radius: 6px; display: flex; align-items: center; justify-content: center;
      color: #fff; cursor: pointer;
    }
    .toast-btn:hover { background: rgba(255,255,255,.25); }
    .icon { width: 16px; height: 16px; }
    .rotate-180 { transform: rotate(180deg); }
    .icon-status { width: 20px; height: 20px; flex-shrink: 0; }
    .icon-status.done { color: #10b981; }
    .icon-status.fail { color: #ef4444; }
    .text-brand { color: var(--color-brand-500, #32acc1); }
    .toast-body { max-height: 240px; overflow-y: auto; }
    .toast-item { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; }
    .toast-item:last-child { border-bottom: none; }
    .item-row { display: flex; align-items: center; gap: 10px; }
    .item-info { flex: 1; min-width: 0; }
    .item-name {
      font-size: 13px; font-weight: 500; color: #0f172a;
      display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .item-size { font-size: 11px; color: #94a3b8; }
    .item-status { font-size: 12px; color: #64748b; flex-shrink: 0; }
    .progress-track { height: 4px; background: #e2e8f0; border-radius: 2px; margin-top: 8px; overflow: hidden; }
    .progress-bar { height: 100%; background: var(--color-brand-500, #32acc1); border-radius: 2px; transition: width .3s ease; }
    .progress-bar--done { background: #10b981; }
    .clear-btn {
      display: block; width: 100%; padding: 10px; border: none;
      background: #f8fafc; color: var(--color-brand-600, #2691a4); font-size: 13px;
      font-weight: 500; cursor: pointer; font-family: inherit;
      border-top: 1px solid #e2e8f0;
    }
    .clear-btn:hover { background: #f1f5f9; }
  `],
})
export class UploadToastPanelComponent {
  svc = inject(UploadToastService);
}

/**
 * UploadToastComponent
 * ────────────────────
 * Host component that creates a CDK overlay for the toast panel.
 * The overlay renders at the `cdk-overlay-container` level (a direct child
 * of `<body>`), so it's guaranteed to be above any modal or popup.
 *
 * Usage: drop `<app-upload-toast />` once in your root component (app.ts).
 */
@Component({
  selector: 'app-upload-toast',
  standalone: true,
  imports: [OverlayModule],
  template: '',
})
export class UploadToastComponent implements OnInit, OnDestroy {
  private overlay    = inject(Overlay);
  private overlayRef: OverlayRef | null = null;

  ngOnInit(): void {
    this.overlayRef = this.overlay.create({
      hasBackdrop: false,
      positionStrategy: this.overlay.position()
        .global()
        .bottom('24px')
        .left('24px'),
      panelClass: 'upload-toast-pane',
    });

    const portal = new ComponentPortal(UploadToastPanelComponent);
    this.overlayRef.attach(portal);
  }

  ngOnDestroy(): void {
    this.overlayRef?.dispose();
  }
}
