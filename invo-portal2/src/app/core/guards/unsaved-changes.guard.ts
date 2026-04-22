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
 * Reusable CanDeactivate guard. Attach on any route whose component exposes
 * `hasUnsavedChanges()`. Uses the shared `ConfirmModalComponent` so the
 * prompt matches the rest of the app (instead of the native browser
 * confirm, which looks foreign and can't be styled).
 */
export const unsavedChangesGuard: CanDeactivateFn<CanLeaveComponent> = async (component) => {
  if (!component || typeof component.hasUnsavedChanges !== 'function') return true;
  if (!component.hasUnsavedChanges()) return true;

  const translate = inject(TranslateService);
  const modal = inject(ModalService);
  const ref = modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
    ConfirmModalComponent,
    {
      size: 'sm',
      data: {
        title:   translate.instant('COMMON.UNSAVED_TITLE'),
        message: translate.instant('COMMON.UNSAVED_HINT'),
        confirm: translate.instant('COMMON.LEAVE'),
        danger:  true,
      },
    },
  );
  return !!(await ref.afterClosed());
};
