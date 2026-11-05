import { Injectable, inject } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { DocActionsBase } from '../../services/doc-actions-base';
import { PurchaseConvertModalComponent } from '../components/purchase-convert-modal/purchase-convert-modal.component';
import { PurchaseOrdersService } from './purchase-orders.service';

/** What the rules read - satisfied by a list row and by the `PurchaseOrder` model alike. */
export interface PurchaseOrderState {
  dueDate?: any;
  isBill?: boolean;
  status?: string;
}

/**
 * Single home of a purchase order's actions: the rules ("may this button show?"), what the buttons do,
 * and the "Actions" menu built from them - the list row, the view toolbar and the form all use it (see
 * {@link DocActionsBase}). An expired order can't be converted; one a bill was made from can't be deleted.
 */
@Injectable({ providedIn: 'root' })
export class PurchaseOrderActions extends DocActionsBase {
  private orders = inject(PurchaseOrdersService);

  get canAdd() { return this.can('purchaseOrderSecurity.actions.add.access'); }
  get canPrint() { return this.can('purchaseOrderSecurity.actions.print.access'); }
  get canAuto() { return this.can('purchaseOrderSecurity.actions.auto.access'); }

  private expired(p: PurchaseOrderState): boolean { return !!p.dueDate && new Date(p.dueDate).getTime() <= Date.now(); }

  edit(_p: PurchaseOrderState): boolean { return this.canAdd; }
  convert(p: PurchaseOrderState): boolean { return !this.expired(p) && this.can('purchaseOrderSecurity.actions.convert.access'); }
  delete(p: PurchaseOrderState): boolean { return !p.isBill && this.can('purchaseOrderSecurity.actions.delete.access'); }

  // ── what the buttons do ────────────────────────────────────────────
  /**
   * Convert to bill. A partly converted order asks whether to bill the full or only the remaining
   * quantities; a fully converted one asks for confirmation first (legacy dialogs).
   */
  async goConvert(id: string, p: PurchaseOrderState): Promise<void> {
    const status = (p.status ?? '').toLowerCase();
    const go = (partial = false) => void this.router.navigate(['/account/bills/convert-from-purchase', id], partial ? { queryParams: { usePartialQty: true } } : undefined);

    if (status === 'partially converted') {
      const choice = await this.modal.open<PurchaseConvertModalComponent, void, 'full' | 'partial' | null>(PurchaseConvertModalComponent, { size: 'sm' }).afterClosed();
      if (choice) go(choice === 'partial');
    } else if (status === 'fully converted') {
      const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        size: 'sm',
        data: { title: this.t('PURCHASE_ORDERS.CONVERT.ALREADY_FULL_TITLE'), message: this.t('PURCHASE_ORDERS.CONVERT.ALREADY_FULL_TEXT') },
      }).afterClosed();
      if (ok) go();
    } else {
      go();
    }
  }

  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('COMMON.DELETE', 'PURCHASE_ORDERS.VIEW.CONFIRM_DELETE', true, () => this.orders.deletePurchaseOrder(id), after);
  }

  /** The "Actions" menu of a saved purchase order: Convert to Bill, Delete - only what the rules allow. */
  menu(p: PurchaseOrderState, id: string, after: () => void): DropdownMenuBtnItem[] {
    const t = this.t;
    const items: DropdownMenuBtnItem[] = [];
    if (this.convert(p)) items.push(this.item(t('PURCHASE_ORDERS.ACTIONS.CONVERT_TO_BILL'), () => void this.goConvert(id, p)));
    if (this.delete(p)) items.push(this.item(t('COMMON.DELETE'), () => void this.runDelete(id, after), { danger: true, separator: items.length > 0 }));
    return items;
  }
}
