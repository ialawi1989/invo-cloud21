import { Injectable, inject } from '@angular/core';

import { PrivilegeService } from '@core/auth/privileges/privilege.service';

/** What the rules read — satisfied by a list row and by the `Estimate` model alike. */
export interface EstimateState {
  invoiceId?: string | null;
  source?: string;
}

/**
 * Single home of "may this button show for this estimate?": the privilege and conversion rules
 * that the list row actions, the view toolbar and the form all apply. An estimate has no status —
 * once an invoice is linked (`invoiceId`) it can be neither converted again nor deleted.
 */
@Injectable({ providedIn: 'root' })
export class EstimateActions {
  private privileges = inject(PrivilegeService);
  private can = (p: string) => this.privileges.check(p);

  get canAdd() { return this.can('estimateSecurity.actions.add.access'); }
  get canPrint() { return this.can('estimateSecurity.actions.print.access'); }
  get canAdjustPrice() { return this.canAdd; }

  private converted(e: EstimateState): boolean { return !!e.invoiceId; }

  edit(_e: EstimateState): boolean { return this.canAdd; }
  clone(_e: EstimateState): boolean { return this.canAdd; }
  convert(e: EstimateState): boolean {
    return !this.converted(e) && this.can('estimateSecurity.actions.convert.access') && this.can('invoiceSecurity.actions.add.access');
  }
  delete(e: EstimateState): boolean {
    return !this.converted(e) && this.can('estimateSecurity.actions.delete.access') && e.source !== 'Online' && e.source !== 'POS';
  }
}
