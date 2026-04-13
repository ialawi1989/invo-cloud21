import {
  Component, Input, OnInit, ViewChild, ViewContainerRef,
  InjectionToken, Injector, Type, ChangeDetectionStrategy, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalRef } from './modal.service';
import { MODAL_DATA, MODAL_REF } from './modal.tokens';

export { MODAL_DATA, MODAL_REF };

@Component({
  selector: 'app-modal-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-panel" [class]="'modal-panel--' + size" role="dialog" aria-modal="true">
      @if (closeable) {
        <button class="modal-close" (click)="modalRef.dismiss()" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      }
      <ng-container #outlet></ng-container>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: inherit; }
    .modal-panel {
      background: #fff; border-radius: 16px; position: relative;
      overflow: hidden; display: flex; flex-direction: column;
      width: 100%; height: inherit; max-height: calc(100vh - 48px);
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.06),
        0 8px 24px rgba(0, 0, 0, 0.14),
        0 24px 56px rgba(0, 0, 0, 0.12);
    }
    .modal-close {
      position: absolute; top: 14px; right: 14px;
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      background: #f3f4f6; border: none; border-radius: 8px;
      color: #6b7280; cursor: pointer; z-index: 10;
      transition: background .15s, color .15s;
    }
    .modal-close:hover { background: #e5e7eb; color: #111827; }
  `],
})
export class ModalContainerComponent implements OnInit {
  @Input() closeable        = true;
  @Input() size: string     = 'md';
  @Input() modalRef!:        ModalRef;
  @Input() contentComponent!: Type<any>;
  @Input() contentInjector!: Injector;   // ← passed from ModalService

  @ViewChild('outlet', { read: ViewContainerRef, static: true })
  outlet!: ViewContainerRef;

  ngOnInit(): void {
    // Pass the child injector so MODAL_DATA and MODAL_REF resolve correctly
    this.outlet.createComponent(this.contentComponent, {
      injector: this.contentInjector,
    });
  }
}
