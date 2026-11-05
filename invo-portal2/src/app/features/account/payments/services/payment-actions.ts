import { Injectable, inject } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocActionsBase } from '../../services/doc-actions-base';
import { PaymentsService } from './payments.service';

/** What the rules read — satisfied by a payment record and by a payments-tab row alike. */
export interface PaymentState {
  reconciled?: boolean;
}

/**
 * Single home of a payment's actions: the privilege + reconciled-lock rules, what the buttons do, and the
 * "Actions" menu built from them (see {@link DocActionsBase}). The payment view, list, form and the
 * invoice view's "Payments Received" tab all use it, so they stay in lockstep by construction.
 */
@Injectable({ providedIn: 'root' })
export class PaymentActions extends DocActionsBase {
  private payments = inject(PaymentsService);

  get canAddPrivilege() { return this.can('invoicePaymentsSecurity.actions.add.access'); }
  get canPrint() { return this.can('invoicePaymentsSecurity.actions.print.access'); }
  get canDeletePrivilege() { return this.can('invoicePaymentsSecurity.actions.delete.access'); }

  /** Edit reuses the "add" privilege, matching legacy/`payment-view` convention. */
  canEdit(p: PaymentState): boolean { return this.canAddPrivilege && !p.reconciled; }
  /** Why the payment's state forbids editing (an i18n key), or null. */
  editStateBlock(p: PaymentState): string | null {
    return p.reconciled ? 'DOC_FORM.EDIT_BLOCKED.RECONCILED' : null;
  }
  canRemove(p: PaymentState): boolean { return this.canDeletePrivilege && !p.reconciled; }

  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('COMMON.DELETE', 'PAYMENTS.VIEW.CONFIRM_DELETE', true, () => this.payments.DeleteInvPay(id), after, 'PAYMENTS.VIEW.DELETED');
  }

  /** The "Actions" menu of a saved payment — only what the rules allow. */
  menu(p: PaymentState, id: string, after: () => void): DropdownMenuBtnItem[] {
    return this.canRemove(p)
      ? [this.item(this.t('COMMON.DELETE'), () => void this.runDelete(id, after), { danger: true })]
      : [];
  }
}
