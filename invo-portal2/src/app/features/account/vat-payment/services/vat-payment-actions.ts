import { Injectable, inject } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocActionsBase } from '../../services/doc-actions-base';
import { VatPaymentService } from './vat-payment.service';

export { statusClass as vatStatusClass } from '@shared/utils/status-tone';

/** What the rules read - a VAT return record or a list row. */
export interface VatPaymentState {
  status?: string;
}

/**
 * Single home of a VAT return's actions (see {@link DocActionsBase}). Only the latest return can change: the list
 * passes `latest` (first row of the first page, as legacy did) and a paid return is closed for edit / delete.
 */
@Injectable({ providedIn: 'root' })
export class VatPaymentActions extends DocActionsBase {
  private vat = inject(VatPaymentService);

  get canAdd() { return this.can('vatPayment.actions.add.access'); }
  get canDeletePrivilege() { return this.can('vatPayment.actions.delete.access'); }

  /** Edit reuses the "add" privilege, like legacy. */
  canEdit(p: VatPaymentState, latest: boolean): boolean { return this.canAdd && latest && p.status !== 'Paid'; }
  canRemove(p: VatPaymentState, latest: boolean): boolean { return this.canDeletePrivilege && latest && p.status !== 'Paid'; }

  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('COMMON.DELETE', 'VAT_PAYMENT.VIEW.CONFIRM_DELETE', true, () => this.vat.deleteVatPayment(id), after, 'VAT_PAYMENT.VIEW.DELETED');
  }

  menu(p: VatPaymentState, id: string, latest: boolean, after: () => void): DropdownMenuBtnItem[] {
    return this.canRemove(p, latest)
      ? [this.item(this.t('COMMON.DELETE'), () => void this.runDelete(id, after), { danger: true })]
      : [];
  }
}
