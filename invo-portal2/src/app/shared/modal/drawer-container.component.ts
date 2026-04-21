import {
  Component, Input, OnInit,
  ViewChild, ViewContainerRef, Injector, Type, ElementRef,
  ChangeDetectionStrategy, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalRef } from './modal.service';

@Component({
  selector: 'app-drawer-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="drawer-panel" [class.drawer-panel--rtl]="isRtl" #panel>
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

      <!-- Resize handle (opt-in via [resizable]).
           Desktop: a thin vertical strip on the drawer's inner edge (LTR: left,
           RTL: right) that resizes WIDTH.
           Mobile (bottom sheet): a horizontal strip at the top that resizes
           HEIGHT. The CSS-drawn grabber bar doubles as the affordance. -->
      @if (!isMobile() && canResizeWidth) {
        <div
          class="drawer-resize-handle drawer-resize-handle--edge"
          [class.drawer-resize-handle--rtl]="isRtl"
          (mousedown)="startResize($event, 'width')"
          (touchstart)="startResize($event, 'width')"
          aria-label="Resize drawer width"
          role="separator">
        </div>
      }
      @if (isMobile() && canResizeHeight) {
        <div
          class="drawer-resize-handle drawer-resize-handle--top"
          (mousedown)="startResize($event, 'height')"
          (touchstart)="startResize($event, 'height')"
          aria-label="Resize drawer height"
          role="separator">
        </div>
      }
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

    /* ── Resize handle (opt-in) ─────────────────────────────── */
    .drawer-resize-handle {
      position: absolute;
      z-index: 20;
      background: transparent;
      transition: background .15s;
    }
    .drawer-resize-handle:hover,
    .drawer-resize-handle:active {
      background: rgba(85, 110, 230, .18);
    }

    /* Desktop: vertical strip on the inner edge (resizes width) */
    .drawer-resize-handle--edge {
      top: 0; bottom: 0;
      left: 0;          /* LTR: handle sits on the left edge (inner side) */
      width: 6px;
      cursor: col-resize;
    }
    .drawer-resize-handle--edge.drawer-resize-handle--rtl {
      left: auto;
      right: 0;         /* RTL: inner edge is the right side */
    }

    /* Mobile: horizontal strip at the top (resizes height). Sits above the
       drawer's built-in ::before grabber visually — the grabber remains the
       affordance; this transparent band is what captures the drag. */
    .drawer-resize-handle--top {
      top: 0; left: 0; right: 0;
      height: 24px;
      cursor: row-resize;
      touch-action: none;
    }

    /* ── Mobile: bottom sheet ──────────────────────────────── */
    @media (max-width: 991px) {
      :host {
        /* iOS Safari: 100vh extends UNDER the URL bar / home indicator, so
           the header slips behind the address bar and the footer behind the
           bottom toolbar. Use 100dvh (dynamic viewport height) which tracks
           the actual visible area, with a 100vh fallback for older browsers.
           Leave a 25px gap above so the rounded top edge stays away from
           the status bar / notch. */
        height: calc(100vh - 25px);
        height: calc(100dvh - 25px);
        width: 100% !important;
        max-height: calc(100vh - 25px);
        max-height: calc(100dvh - 25px);
      }

      .drawer-panel {
        /* Fixed height so the panel doesn't resize when the active tab's
           content changes. Inner scrolling lives in the content's own body.
           No !important — the optional drag-to-resize handle sets inline
           styles that should be allowed to override this default. */
        height: calc(100vh - 25px);
        height: calc(100dvh - 25px);
        max-height: calc(100vh - 25px);
        max-height: calc(100dvh - 25px);
        width: 100% !important;
        border-radius: 20px 20px 0 0 !important;
        box-shadow: 0 -4px 24px rgba(0,0,0,.15) !important;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        /* Respect the iPhone home-indicator strip — keep the footer above
           it so Apply / Cancel are always tappable. */
        padding-bottom: env(safe-area-inset-bottom, 0px);
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
  /**
   * Whether to show an inner-edge drag handle the user can grab to resize
   * the drawer. Defaults to `false` so existing drawers are unaffected.
   */
  /** Master toggle for both axes. Individual axes can still be overridden
   *  via `resizableWidth` / `resizableHeight` below. */
  @Input() resizable        = false;
  /** Desktop resize (vertical handle on inner edge). Defaults to `resizable`. */
  @Input() resizableWidth?: boolean;
  /** Mobile bottom-sheet resize (top grabber). Defaults to `resizable`. */
  @Input() resizableHeight?: boolean;
  /** Minimum/maximum widths when resizing on desktop (px). */
  @Input() minWidth         = 280;
  @Input() maxWidth?:       number;
  /** Minimum/maximum heights when resizing on mobile bottom sheet (px). */
  @Input() minHeight        = 200;
  @Input() maxHeight?:      number;

  /** Effective per-axis flags (fall back to the master `resizable`). */
  get canResizeWidth():  boolean { return this.resizableWidth  ?? this.resizable; }
  get canResizeHeight(): boolean { return this.resizableHeight ?? this.resizable; }

  @ViewChild('outlet', { read: ViewContainerRef, static: true })
  outlet!: ViewContainerRef;

  private host = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    this.outlet.createComponent(this.contentComponent, {
      injector: this.contentInjector,
    });
  }

  isMobile(): boolean {
    return window.innerWidth <= 991;
  }

  // ─── Resize ───────────────────────────────────────────────────────────────
  // The overlay pane hosts this component — resizing means mutating the
  // overlay pane's inline width (desktop) or height (mobile bottom sheet).
  startResize(event: MouseEvent | TouchEvent, axis: 'width' | 'height'): void {
    event.preventDefault();
    const pane = this.getOverlayPane();
    if (!pane) return;

    if (axis === 'width') {
      const startX = this.getClientX(event);
      const startWidth = pane.getBoundingClientRect().width;
      const maxW = this.maxWidth ?? Math.min(window.innerWidth - 40, 1200);

      const onMove = (e: MouseEvent | TouchEvent) => {
        const x = this.getClientX(e);
        // LTR: drawer grows leftward → delta is start - current.
        // RTL: drawer grows rightward → delta is current - start.
        const delta = this.isRtl ? x - startX : startX - x;
        const next = Math.max(this.minWidth, Math.min(maxW, startWidth + delta));
        pane.style.width = `${next}px`;
      };
      this.attachMoveListeners(onMove, 'col-resize');
      return;
    }

    // axis === 'height' — bottom-sheet resize. Drawer grows upward, so as
    // the pointer moves up (y decreases) the height should increase.
    const startY = this.getClientY(event);
    const paneEl = pane;
    const innerHost = this.host.nativeElement;
    const panel = innerHost.querySelector('.drawer-panel') as HTMLElement | null;
    const startHeight = (panel ?? paneEl).getBoundingClientRect().height;
    const maxH = this.maxHeight ?? Math.min(window.innerHeight - 20, 1000);

    const onMove = (e: MouseEvent | TouchEvent) => {
      const y = this.getClientY(e);
      const delta = startY - y;
      const next = Math.max(this.minHeight, Math.min(maxH, startHeight + delta));
      // The bottom-sheet layout anchors the overlay pane to the bottom, so
      // setting height alone grows it upward as expected. Lift the mobile
      // CSS cap (85vh `max-height`) while the user is driving the size.
      paneEl.style.height = `${next}px`;
      paneEl.style.maxHeight = `${next}px`;
      if (panel) {
        panel.style.height = `${next}px`;
        panel.style.maxHeight = `${next}px`;
      }
    };
    this.attachMoveListeners(onMove, 'row-resize');
  }

  /** Shared mouse/touch drag wiring. */
  private attachMoveListeners(
    onMove: (e: MouseEvent | TouchEvent) => void,
    cursor: 'col-resize' | 'row-resize',
  ): void {
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = cursor;
  }

  private getClientX(e: MouseEvent | TouchEvent): number {
    return 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
  }
  private getClientY(e: MouseEvent | TouchEvent): number {
    return 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
  }

  private getOverlayPane(): HTMLElement | null {
    let el: HTMLElement | null = this.host.nativeElement;
    while (el && !el.classList.contains('cdk-overlay-pane')) {
      el = el.parentElement;
    }
    return el;
  }
}
