import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';

/**
 * Any route-component that wants the unsaved-changes prompt implements this
 * interface. The guard reads `hasUnsavedChanges()` and, when it returns
 * true, shows a confirm before allowing navigation.
 *
 * Components with nothing to guard just omit the guard — the check is a
 * no-op for anything that doesn't implement the interface.
 */
export interface CanLeaveComponent {
  /** Return `true` when the form/state is dirty and the user should be prompted. */
  hasUnsavedChanges(): boolean;
}

/**
 * In-flight confirm map keyed by component instance. When the router
 * fires `canDeactivate` twice concurrently for the same component
 * (a known race during browser-back + URL restoration: the router
 * cancels the popstate-driven navigation by calling `history.go(1)`,
 * which re-emits popstate and re-evaluates the guard while the
 * user is still answering the first modal), every concurrent
 * caller awaits the same promise and gets the same answer — so the
 * user only ever sees one modal.
 */
const inFlight = new WeakMap<CanLeaveComponent, Promise<boolean>>();

/**
 * Reusable CanDeactivate guard. Attach on any route whose component exposes
 * `hasUnsavedChanges()`. Uses the shared `ConfirmModalComponent` so the
 * prompt matches the rest of the app (instead of the native browser
 * confirm, which looks foreign and can't be styled).
 */
export const unsavedChangesGuard: CanDeactivateFn<CanLeaveComponent> = (component) => {
  if (!component || typeof component.hasUnsavedChanges !== 'function') return true;
  if (!component.hasUnsavedChanges()) return true;

  // Dedupe concurrent calls — return the promise of any modal
  // already open for this component instead of opening a second.
  const existing = inFlight.get(component);
  if (existing) return existing;

  const translate = inject(TranslateService);
  const modal = inject(ModalService);
  const ref = modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
    ConfirmModalComponent,
    {
      size: 'sm',
      // The modal opens inside the router's active navigation flow. Letting
      // ModalService push/pop its own history sentinel here collides with
      // back-button navigation — the user ends up having to click navigate
      // and confirm twice before the form actually unmounts.
      manageHistory: false,
      data: {
        title:   translate.instant('COMMON.UNSAVED_TITLE'),
        message: translate.instant('COMMON.UNSAVED_HINT'),
        confirm: translate.instant('COMMON.LEAVE'),
        danger:  true,
      },
    },
  );
  const result = ref.afterClosed().then(v => !!v);
  inFlight.set(component, result);
  // Clear the lock once the user has answered — a *future* navigation
  // (after the user did more edits) should still prompt.
  result.finally(() => inFlight.delete(component));
  return result;
};
