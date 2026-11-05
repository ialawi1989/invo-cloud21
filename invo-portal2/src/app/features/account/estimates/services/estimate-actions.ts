import { Injectable, inject } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocActionsBase } from '../../services/doc-actions-base';
import { EstimatesService } from './estimates.service';

/** What the rules read — satisfied by a list row and by the `Estimate` model alike. */
export interface EstimateState {
  invoiceId?: string | null;
  source?: string;
}

/**
 * Single home of an estimate's actions: the rules ("may this button show?"), what the buttons do, and
 * the "Actions" menu built from them — the list row, the view toolbar and the form all use it (see
 * {@link DocActionsBase}). An estimate has no status — once an invoice is linked (`invoiceId`) it can be
 * neither converted again nor deleted.
 */
@Injectable({ providedIn: 'root' })
export class EstimateActions extends DocActionsBase {
  private estimates = inject(EstimatesService);

  get canAdd() { return this.can('estimateSecurity.actions.add.access'); }
  get canPrint() { return this.can('estimateSecurity.actions.print.access'); }
  get canDeletePrivilege() { return this.can('estimateSecurity.actions.delete.access'); }
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

  // ── what the buttons do ────────────────────────────────────────────
  goClone(id: string): void { this.goCloneOf('/account/estimate', id); }
  goConvert(id: string): void { void this.router.navigate(['/account/invoices/convertFromEstimate', id]); }
  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('COMMON.DELETE', 'ESTIMATES.VIEW.CONFIRM_DELETE', true, () => this.estimates.deleteEstimate(id), after);
  }

  /** The "Actions" menu of a saved estimate: Clone, Convert to Invoice, Delete — only what the rules allow. */
  menu(e: EstimateState, id: string, after: () => void): DropdownMenuBtnItem[] {
    const t = this.t;
    const items: DropdownMenuBtnItem[] = [];
    if (this.clone(e)) items.push(this.item(t('ESTIMATES.ACTIONS.CLONE'), () => this.goClone(id)));
    if (this.convert(e)) items.push(this.item(t('ESTIMATES.ACTIONS.CONVERT_TO_INVOICE'), () => this.goConvert(id)));
    if (this.delete(e)) items.push(this.item(t('COMMON.DELETE'), () => void this.runDelete(id, after), { danger: true, separator: true }));
    return items;
  }
}
