import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

/**
 * Sentinel marker we push into history.state when a modal is opened, so we can
 * recognize "our" entry on popstate and not confuse it with a real navigation.
 */
const MODAL_HISTORY_MARKER = '__ngbModalOpen__';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private readonly isBrowser: boolean;

  /** Stack of currently-open modals, in open order (last = top-most). */
  private openModals: NgbModalRef[] = [];

  /** Bound reference so we can add/remove the same listener. */
  private readonly popStateHandler = (event: PopStateEvent) => this.onPopState(event);

  /**
   * Counter of pending programmatic history.* calls. We use a counter (not a
   * boolean) because dismissing one modal can synchronously trigger another
   * history operation before the first popstate has flushed, and the same
   * modal type may legitimately be opened/closed many times.
   */
  private suppressDepth = 0;

  constructor(
    private modalService: NgbModal,
    @Inject(PLATFORM_ID) platformId: any,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Install the popstate listener ONCE for the lifetime of the service.
    //
    // Previously the listener was attached on first open and removed when the
    // stack drained. That had a subtle race: untrackModal() calls
    // history.back() to clean up its sentinel, then immediately removes the
    // listener. The suppressed popstate event arrives *after* removal, so
    // suppressDepth is never decremented. Next time you open a modal and
    // press back, onPopState sees suppressDepth > 0 and returns early —
    // the modal stays open. (This is the "second back doesn't close it" bug.)
    //
    // Keeping the listener installed for the service's lifetime fixes it:
    // every history.back() we issue is observed, and suppressDepth always
    // balances out. The listener is cheap when no modals are open
    // (it just returns immediately).
    if (this.isBrowser) {
      window.addEventListener('popstate', this.popStateHandler);
    }
  }

  open(component: any, options?: any): NgbModalRef {
    const modalRef: NgbModalRef = this.modalService.open(component, options);
    this.trackModal(modalRef);
    return modalRef;
  }

  openWithData(component: any, data: any, options?: any): NgbModalRef {
    const modalRef: NgbModalRef = this.modalService.open(component, options);

    if (modalRef.componentInstance && modalRef.componentInstance.loadData) {
      modalRef.componentInstance.loadData(data);
    }

    this.trackModal(modalRef);
    return modalRef;
  }

  close(modalRef: NgbModalRef): void {
    if (modalRef) {
      modalRef.close();
    }
  }

  dismiss(modalRef: NgbModalRef): void {
    if (modalRef) {
      modalRef.dismiss();
    }
  }

  /** True when any modal opened via this service is currently visible. */
  hasOpenModals(): boolean {
    return this.openModals.length > 0;
  }

  /** Dismiss all currently-tracked modals (top-most first). */
  dismissAll(reason: any = 'dismiss-all'): void {
    const copy = [...this.openModals].reverse();
    for (const ref of copy) {
      try {
        ref.dismiss(reason);
      } catch {
        // ignore
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private trackModal(modalRef: NgbModalRef): void {
    if (!this.isBrowser) {
      // Don't touch window/history during SSR.
      return;
    }

    // Defensive: don't track the same ref twice (would unbalance the
    // sentinel stack vs the modal stack).
    if (this.openModals.indexOf(modalRef) !== -1) {
      return;
    }

    this.openModals.push(modalRef);

    // One sentinel per modal — every back press peels off one layer.
    this.pushHistoryState();

    // Whichever way the modal is dismissed (X, ESC, backdrop, programmatic
    // .close()/.dismiss(), or our own popstate handler), keep our stack in sync.
    const cleanup = () => this.untrackModal(modalRef);
    modalRef.result.then(cleanup, cleanup);
  }

  private untrackModal(modalRef: NgbModalRef): void {
    const idx = this.openModals.indexOf(modalRef);
    if (idx === -1) return;
    this.openModals.splice(idx, 1);

    if (!this.isBrowser) return;

    // If this modal was closed by something OTHER than the back button
    // (e.g. user clicked the X, ESC, backdrop, or programmatic .close()),
    // we still have one of our sentinel history entries sitting on the
    // stack. Pop it so the URL/history stays clean.
    //
    // Sentinels are interchangeable: the one we pop may technically have
    // belonged to a different modal, but after this back() the count of
    // sentinels equals the count of remaining open modals — which is the
    // invariant we care about.
    if (history.state && history.state[MODAL_HISTORY_MARKER]) {
      this.suppressDepth++;
      try {
        history.back();
      } catch {
        // history.back can fail in some sandboxed environments — undo the
        // suppression so we don't desync the counter.
        this.suppressDepth = Math.max(0, this.suppressDepth - 1);
      }
      // popstate fires async; onPopState will decrement the counter.
    }

    // Belt-and-braces: if the stack just drained, force-reset the counter.
    // The lifetime listener should already have absorbed any suppressed
    // events, but if anything ever skewed (e.g. a sandbox that swallowed
    // a history event), this keeps the next open/back cycle clean.
    if (this.openModals.length === 0) {
      this.suppressDepth = 0;
    }
  }

  private onPopState(_event: PopStateEvent): void {
    // If this popstate was caused by our own history.back() cleanup, ignore it.
    if (this.suppressDepth > 0) {
      this.suppressDepth--;
      return;
    }
    if (this.openModals.length === 0) return;

    // Dismiss the top-most modal instead of navigating away.
    const top = this.openModals[this.openModals.length - 1];

    // Re-push our sentinel BEFORE dismissing, so that the cleanup history.back()
    // in untrackModal has something to pop.
    this.pushHistoryState();

    try {
      top.dismiss('back-button');
    } catch {
      // Swallow — the modal may have already been disposed.
    }
  }

  private pushHistoryState(): void {
    // Note: pushState does NOT fire popstate, so no suppression needed here.
    try {
      const state = { ...(history.state || {}), [MODAL_HISTORY_MARKER]: true };
      history.pushState(state, '', window.location.href);
    } catch {
      // pushState can throw under SecurityError in unusual sandboxes —
      // fail silently rather than break modal opening.
    }
  }
}