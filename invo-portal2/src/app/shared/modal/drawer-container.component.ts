import {
  Component, Input, OnInit, OnDestroy,
  ViewChild, ViewContainerRef, Injector, Type,
  ChangeDetectionStrategy, HostBinding, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalRef } from './modal.service';

@Component({
  selector: 'app-drawer-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="drawer-panel" [class.drawer-panel--rtl]="isRtl">
      @if (closeable) {
        <button class="drawer-close" (click)="modalRef.dismiss()" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6"  y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      }
      <ng-container #outlet></ng-container>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      width: 100%;
    }

    .drawer-panel {
      height: 100vh;
      background: #fff;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow-y: auto;
      overflow-x: hidden;
      /* LTR: flush to right edge, rounded on left only */
      box-shadow: -4px 0 24px rgba(0,0,0,.12);
      border-radius: 16px 0 0 16px;
    }

    /* RTL: flush to left edge, rounded on right only */
    .drawer-panel--rtl {
      box-shadow: 4px 0 24px rgba(0,0,0,.12);
      border-radius: 0 16px 16px 0;
    }

    .drawer-close {
      position: absolute;
      top: 14px; right: 14px;
      width: 30px; height: 30px;
      display: flex; align-items: center; justify-content: center;
      background: #f3f4f6; border: none; border-radius: 8px;
      color: #6b7280; cursor: pointer; z-index: 10;
      transition: background .15s, color .15s;
      &:hover { background: #e5e7eb; color: #111827; }
    }

    .drawer-panel--rtl .drawer-close {
      right: auto;
      left: 14px;
    }

    /* ── Mobile: bottom sheet ──────────────────────────────── */
    @media (max-width: 991px) {
      :host {
        height: auto !important;
        width: 100% !important;
        max-height: 85vh;
      }

      .drawer-panel {
        height: auto !important;
        max-height: 85vh;
        width: 100% !important;
        border-radius: 20px 20px 0 0 !important;
        box-shadow: 0 -4px 24px rgba(0,0,0,.15) !important;
        overflow-y: auto;
      }

      /* Drag handle */
      .drawer-panel::before {
        content: '';
        display: block;
        width: 40px; height: 4px;
        background: #d1d5db;
        border-radius: 2px;
        margin: 12px auto 4px;
        flex-shrink: 0;
      }

      .drawer-close {
        top: 20px; right: 16px;
      }
      .drawer-panel--rtl .drawer-close {
        right: auto; left: 16px;
      }
    }
  `],
})
export class DrawerContainerComponent implements OnInit {
  @Input() closeable        = true;
  @Input() modalRef!:        ModalRef;
  @Input() contentComponent!: Type<any>;
  @Input() contentInjector!:  Injector;
  @Input() isRtl            = false;

  @ViewChild('outlet', { read: ViewContainerRef, static: true })
  outlet!: ViewContainerRef;

  ngOnInit(): void {
    this.outlet.createComponent(this.contentComponent, {
      injector: this.contentInjector,
    });
  }
}
