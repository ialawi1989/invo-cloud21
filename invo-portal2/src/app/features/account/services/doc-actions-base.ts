import { inject } from '@angular/core';
import { Router } from '@angular/router';

import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { LanguageService } from '@core/i18n/language.service';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

/**
 * The one technique every sales / purchase document follows for its row, view and form actions.
 * A document's `XxxActions` service extends this and holds, in one place:
 *  - the **rules** (`clone(x)`, `delete(x)`… — privilege / status / lock — "may this show?"),
 *  - the **runners** (`runDelete(id, after)`… — confirm → server call → toast → `after`),
 *  - the **menu** (`menu(x, id, after)`) built only from the two above.
 * Lists, view pages and forms render `menu()` (adding screen-only extras around it), so an option
 * can never exist, or be allowed, on one screen and not another.
 */
export abstract class DocActionsBase {
  protected privileges = inject(PrivilegeService);
  protected router = inject(Router);
  protected modal = inject(ModalService);
  protected toast = inject(ToastService);
  protected lang = inject(LanguageService);

  protected can = (p: string) => this.privileges.check(p);
  protected t = (k: string) => this.lang.instant(k);

  protected item(label: string, click: () => void, opts: { danger?: boolean; separator?: boolean } = {}): DropdownMenuBtnItem {
    return { label, click, disabled: false, danger: !!opts.danger, ...(opts.separator ? { separator: true } : {}) };
  }

  /** Opens the form of `routeBase` as a copy of document `id`. */
  protected goCloneOf(routeBase: string, id: string): void {
    void this.router.navigate([routeBase, id], { queryParams: { cloned: 'yes' } });
  }

  /** Server call → toast → `after`. A refusal (`success: false`) or an error is toasted and `after` is skipped. */
  protected async exec(task: () => Promise<any>, after: () => void, successKey = 'COMMON.SAVED_OK'): Promise<void> {
    try {
      const res: any = await task();
      if (res?.success === false) {
        this.toast.error('COMMON.OPS', typeof res.msg === 'string' ? res.msg : '');
        return;
      }
      this.toast.success(successKey);
      after();
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    }
  }

  /** Same as {@link exec}, behind a confirmation dialog (nothing happens when it is dismissed). */
  protected async confirmRun(
    titleKey: string, messageKey: string, danger: boolean,
    task: () => Promise<any>, after: () => void, successKey = 'COMMON.SAVED_OK',
  ): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm', data: { title: this.t(titleKey), message: this.t(messageKey), danger },
    }).afterClosed();
    if (ok) await this.exec(task, after, successKey);
  }
}
