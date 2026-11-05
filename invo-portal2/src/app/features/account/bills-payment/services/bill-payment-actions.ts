import { Injectable, inject } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocActionsBase } from '../../services/doc-actions-base';
import { BillsPaymentService } from './bills-payment.service';

/** What the rules read - a payment record, a list row or a bill's payments-tab row. */
export interface BillPaymentState {
  reconciled?: boolean;
}

/**
 * Single home of a bill payment's actions: the privilege + reconciled-lock rules, what the buttons do and
 * the "Actions" menu built from them (see {@link DocActionsBase}). The payment view, list, form and the bill
 * view's Payments tab all use it.
 */
@Injectable({ providedIn: 'root' })
export class BillPaymentActions extends DocActionsBase {
  private payments = inject(BillsPaymentService);

  get canAdd() { return this.can('billingPaymentsSecurity.actions.add.access'); }
  get canPrint() { return this.can('billingPaymentsSecurity.actions.print.access'); }
  get canDeletePrivilege() { return this.can('billingPaymentsSecurity.actions.delete.access'); }

  /** Edit reuses the "add" privilege, like legacy. */
  canEdit(p: BillPaymentState): boolean { return this.canAdd && !p.reconciled; }
  /** Why the payment's state forbids editing (an i18n key), or null. */
  editStateBlock(p: BillPaymentState): string | null {
    return p.reconciled ? 'DOC_FORM.EDIT_BLOCKED.RECONCILED' : null;
  }
  canRemove(p: BillPaymentState): boolean { return this.canDeletePrivilege && !p.reconciled; }

  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('COMMON.DELETE', 'BILLS_PAYMENT.VIEW.CONFIRM_DELETE', true, () => this.payments.deleteBillPayment(id), after, 'BILLS_PAYMENT.VIEW.DELETED');
  }

  menu(p: BillPaymentState, id: string, after: () => void): DropdownMenuBtnItem[] {
    return this.canRemove(p)
      ? [this.item(this.t('COMMON.DELETE'), () => void this.runDelete(id, after), { danger: true })]
      : [];
  }
}
