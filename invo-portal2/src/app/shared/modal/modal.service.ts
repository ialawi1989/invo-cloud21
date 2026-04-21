import {
  Injectable, inject, Injector, Type, ComponentRef, StaticProvider,
} from '@angular/core';
import { Overlay, OverlayRef, OverlayConfig } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ModalContainerComponent } from './modal-container.component';
import { DrawerContainerComponent } from './drawer-container.component';
import { MODAL_DATA, MODAL_REF } from './modal.tokens';

export interface ModalConfig<D = any> {
  data?:            D;
  size?:            'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';
  closeable?:       boolean;
  closeOnBackdrop?: boolean;
  panelClass?:      string | string[];
  /** Open as a side drawer instead of a centered modal */
  drawer?:          boolean;
  /** Drawer width, default 340px */
  drawerWidth?:     string;
  /** Allow the user to resize the drawer. Only has effect when `drawer: true`.
   *  Master toggle for both axes — can be overridden per axis via
   *  `drawerResizableWidth` (desktop) and `drawerResizableHeight` (mobile). */
  drawerResizable?: boolean;
  /** Desktop-only resize override. Defaults to `drawerResizable`. */
  drawerResizableWidth?:  boolean;
  /** Mobile-only resize override. Defaults to `drawerResizable`. */
  drawerResizableHeight?: boolean;
  /** Minimum drawer width while resizing, in px (default 280). */
  drawerMinWidth?:  number;
  /** Maximum drawer width while resizing, in px (default: min(viewport - 40, 1200)). */
  drawerMaxWidth?:  number;
  /** Extra providers to inject into the modal component */
  providers?:       StaticProvider[];
}

export class ModalRef<R = any> {
  private _result: R | undefined;
  private _closing = false;

  constructor(private overlayRef: OverlayRef) {}

  close(result?: R): void {
    this._result = result;
    this._animateOut();
  }

  /** Set the result without closing — useful in ngOnDestroy to pass data back when dismissed via backdrop. */
  setResult(result: R): void {
    this._result = result;
  }

  dismiss(): void {
    this._animateOut();
  }

  get result(): R | undefined { return this._result; }

  afterClosed(): Promise<R | undefined> {
    return new Promise(resolve => {
      this.overlayRef.detachments().subscribe(() => resolve(this._result));
    });
  }

  /**
   * Plays the `modal-out` CSS animation on the overlay pane, then disposes.
   * If the pane can't be found or the animation doesn't fire within 300ms,
   * it falls back to an instant dispose.
   */
  private _animateOut(): void {
    if (this._closing) return;
    this._closing = true;

    const pane = this.overlayRef.overlayElement;
    if (!pane) {
      this.overlayRef.dispose();
      return;
    }

    // Add the closing class that triggers the CSS exit animation.
    pane.classList.add('modal-closing');

    // Also fade the backdrop.
    const backdrop = this.overlayRef.backdropElement;
    if (backdrop) {
      backdrop.style.transition = 'opacity 0.2s ease';
      backdrop.style.opacity = '0';
    }

    // Wait for the animation to end, then dispose.
    const onDone = () => {
      pane.removeEventListener('animationend', onDone);
      clearTimeout(fallback);
      this.overlayRef.dispose();
    };

    pane.addEventListener('animationend', onDone, { once: true });

    // Fallback in case animationend doesn't fire (detached element, etc.)
    const fallback = setTimeout(onDone, 300);
  }
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  private overlay  = inject(Overlay);
  private injector = inject(Injector);

  /**
   * All currently-open modals. Tracked so the browser back button can close
   * them all at once instead of navigating back through the app.
   */
  private openModals: ModalRef<any>[] = [];
  /**
   * Whether we've already pushed a sentinel history entry for the current
   * "modal session". We only push once per session (on the first open) so a
   * single browser-back press pops all stacked modals together.
   */
  private historyPushed = false;
  /**
   * Whether we're currently dismissing modals because the user pressed back.
   * Prevents the normal close path from pushing/popping history again.
   */
  private dismissingFromPopstate = false;

  constructor() {
    // Single global listener — on back, dismiss every open modal.
    window.addEventListener('popstate', () => {
      if (this.openModals.length === 0) return;
      this.dismissingFromPopstate = true;
      // Snapshot so dismissals mutating the array during iteration are safe.
      const snapshot = [...this.openModals];
      this.openModals = [];
      this.historyPushed = false;
      snapshot.forEach(m => m.dismiss());
      this.dismissingFromPopstate = false;
    });
  }

  open<C, D = any, R = any>(
    component: Type<C>,
    config: ModalConfig<D> = {},
  ): ModalRef<R> {
    const {
      size            = 'md',
      closeable       = true,
      closeOnBackdrop = true,
      data,
      panelClass,
      drawer          = false,
      drawerWidth     = '340px',
      drawerResizable = false,
      drawerResizableWidth,
      drawerResizableHeight,
      drawerMinWidth,
      drawerMaxWidth,
    } = config;

    const isRtl = document.documentElement.dir === 'rtl' ||
                  document.body.dir === 'rtl';

    const overlayRef = this.overlay.create(
      drawer
        ? this.buildDrawerConfig(drawerWidth, isRtl, panelClass)
        : this.buildModalConfig(size, panelClass)
    );

    const modalRef = new ModalRef<R>(overlayRef);

    // Track for back-button handling. Push a single sentinel history entry
    // on the first modal open — subsequent opens don't push again, so one
    // back press closes the entire stack.
    this.openModals.push(modalRef);
    if (!this.historyPushed) {
      history.pushState({ invoModal: true }, '');
      this.historyPushed = true;
    }

    overlayRef.detachments().subscribe(() => {
      const idx = this.openModals.indexOf(modalRef);
      if (idx >= 0) this.openModals.splice(idx, 1);
      if (this.openModals.length === 0 && this.historyPushed && !this.dismissingFromPopstate) {
        this.historyPushed = false;
        // IMPORTANT: defer to a macrotask.
        //
        // Subscriptions to `detachments()` fire in subscription order, so
        // this cleanup runs BEFORE the consumer's `afterClosed().then(...)`
        // handler. If that handler calls `router.navigate(...)` (e.g. the
        // filter modal's Apply path calls `applyFilters` → `syncStateToUrl`),
        // the router hasn't pushed its new history entry yet — so a sync
        // `history.back()` here would rewind to the sentinel before the
        // new URL ever lands, and Angular Router's popstate listener would
        // then navigate back to the original URL. That's the "address bar
        // flashes and reverts" bug.
        //
        // By deferring with setTimeout(0) we let the afterClosed handler run
        // and the router complete its pushState. Then we re-check whether
        // the top of the history stack is still our sentinel — if yes,
        // nothing else navigated and it's safe to consume it; if no, an
        // app-initiated navigation pushed a new entry and we leave history
        // alone.
        setTimeout(() => {
          if (history.state && history.state.invoModal) {
            history.back();
          }
        }, 0);
      }
    });

    if (closeOnBackdrop) overlayRef.backdropClick().subscribe(() => modalRef.dismiss());
    overlayRef.keydownEvents().subscribe(e => {
      if (e.key === 'Escape' && closeable) modalRef.dismiss();
    });

    const contentInjector = Injector.create({
      parent: this.injector,
      providers: [
        { provide: MODAL_REF,  useValue: modalRef },
        { provide: MODAL_DATA, useValue: data ?? null },
        ...(config.providers ?? []),
      ],
    });

    if (drawer) {
      const portal = new ComponentPortal(DrawerContainerComponent, null, this.injector);
      const ref: ComponentRef<DrawerContainerComponent> = overlayRef.attach(portal);
      ref.instance.closeable         = closeable;
      ref.instance.modalRef          = modalRef;
      ref.instance.contentComponent  = component as Type<any>;
      ref.instance.contentInjector   = contentInjector;
      ref.instance.isRtl             = isRtl;
      ref.instance.resizable         = drawerResizable;
      if (drawerResizableWidth  !== undefined) ref.instance.resizableWidth  = drawerResizableWidth;
      if (drawerResizableHeight !== undefined) ref.instance.resizableHeight = drawerResizableHeight;
      if (drawerMinWidth !== undefined) ref.instance.minWidth = drawerMinWidth;
      if (drawerMaxWidth !== undefined) ref.instance.maxWidth = drawerMaxWidth;
      ref.changeDetectorRef.detectChanges();
    } else {
      const portal = new ComponentPortal(ModalContainerComponent, null, this.injector);
      const ref: ComponentRef<ModalContainerComponent> = overlayRef.attach(portal);
      ref.instance.closeable         = closeable;
      ref.instance.size              = size ?? 'md';
      ref.instance.modalRef          = modalRef;
      ref.instance.contentComponent  = component as Type<any>;
      ref.instance.contentInjector   = contentInjector;
      ref.changeDetectorRef.detectChanges();
    }

    return modalRef;
  }

  // ─── Centered modal config ────────────────────────────────────────────────
  private buildModalConfig(
    size?:       ModalConfig['size'],
    panelClass?: string | string[],
  ): OverlayConfig {
    const widthMap: Record<string, string> = {
      sm: '400px', md: '560px', lg: '720px', xl: '1100px', fullscreen: '100vw',
    };
    return new OverlayConfig({
      hasBackdrop:      true,
      backdropClass:    'invo-modal-backdrop',
      panelClass:       [
        'invo-modal-panel',
        ...(Array.isArray(panelClass) ? panelClass : panelClass ? [panelClass] : []),
      ],
      scrollStrategy:   this.overlay.scrollStrategies.block(),
      positionStrategy: this.overlay.position().global()
        .centerHorizontally().centerVertically(),
      width:    widthMap[size ?? 'md'],
      maxWidth: 'calc(100vw - 48px)',
      height:   size === 'fullscreen' ? 'calc(100vh - 48px)' : size === 'xl' ? 'min(680px, calc(100vh - 48px))' : undefined,
      maxHeight: 'calc(100vh - 48px)',
    });
  }

  // ─── Drawer (slide from right / left in RTL) config ───────────────────────
  private buildDrawerConfig(
    width:      string,
    isRtl:      boolean,
    panelClass?: string | string[],
  ): OverlayConfig {
    const isMobile = window.innerWidth <= 991;
    const position = this.overlay.position().global();

    if (isMobile) {
      // Bottom sheet on mobile
      position.bottom('0').left('0').right('0');
    } else {
      isRtl
        ? position.left('0').top('0').bottom('0')
        : position.right('0').top('0').bottom('0');
    }

    return new OverlayConfig({
      hasBackdrop:      true,
      backdropClass:    'invo-modal-backdrop',
      panelClass:       [
        'invo-drawer-panel',
        isMobile ? 'invo-drawer-panel--bottom' :
          (isRtl ? 'invo-drawer-panel--rtl' : 'invo-drawer-panel--ltr'),
        ...(Array.isArray(panelClass) ? panelClass : panelClass ? [panelClass] : []),
      ],
      scrollStrategy:   this.overlay.scrollStrategies.block(),
      positionStrategy: position,
      width:  isMobile ? '100%' : width,
      maxWidth: '100%',
      height: isMobile ? 'auto' : '100vh',
    });
  }
}
