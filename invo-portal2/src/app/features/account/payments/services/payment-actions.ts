import { Injectable, inject } from '@angular/core';

import { PrivilegeService } from '@core/auth/privileges/privilege.service';

/** What the rules read — satisfied by a payment record and by a payments-tab row alike. */
export interface PaymentState {
  reconciled?: boolean;
}

/**
 * Single home of "may this button show for this payment?" — the same privilege + reconciled-lock
 * rules the payment view page applies, reused wherever else a payment can be edited/removed (e.g.
 * the invoice view's "Payments Received" tab), so both surfaces stay in lockstep by construction
 * instead of re-deriving the check ad hoc.
 */
@Injectable({ providedIn: 'root' })
export class PaymentActions {
  private privileges = inject(PrivilegeService);

  get canAddPrivilege() { return this.privileges.check('invoicePaymentsSecurity.actions.add.access'); }
  get canDeletePrivilege() { return this.privileges.check('invoicePaymentsSecurity.actions.delete.access'); }

  /** Edit reuses the "add" privilege, matching legacy/`payment-view` convention. */
  canEdit(p: PaymentState): boolean { return this.canAddPrivilege && !p.reconciled; }
  canRemove(p: PaymentState): boolean { return this.canDeletePrivilege && !p.reconciled; }
}
