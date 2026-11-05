import { Injectable, inject } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocActionsBase } from '../../services/doc-actions-base';
import { TransactionLockService } from '../../services/transaction-lock.service';
import { ApplyCreditToBillsData, ApplyCreditToBillsModalComponent } from '../components/apply-credit-to-bills-modal/apply-credit-to-bills-modal.component';
import { SupplierCreditsService } from './supplier-credits.service';

/** What the rules read - satisfied by a view's record and by a list row (which carries fewer fields). */
export interface SupplierCreditState {
  supplierCreditDate?: any;
  refundedAmount?: number;
  refundDue?: number;
  supplierCreditNumber?: string;
  supplierId?: string | null;
}

/**
 * Single home of a supplier credit's actions: the period-lock / privilege / usage rules, what the buttons do
 * and the "Actions" menu built from them (see {@link DocActionsBase}). Call {@link refresh} once when a screen
 * opens so the accounting-period lock is known. A list row doesn't carry `refundedAmount` / `refundDue`, so
 * (like legacy) only the privilege-only rules apply there.
 */
@Injectable({ providedIn: 'root' })
export class SupplierCreditActions extends DocActionsBase {
  private lock = inject(TransactionLockService);
  private credits = inject(SupplierCreditsService);

  private lockInfo: any = null;
  async refresh(branchId: string | null = null): Promise<void> { this.lockInfo = await this.lock.transactionsDate(branchId); }

  get canAdd() { return this.can('supplierCredit.actions.add.access'); }
  get canPrint() { return this.can('supplierCredit.actions.print.access'); }

  private unlocked(c: SupplierCreditState): boolean { return !!c.supplierCreditDate && this.lock.isEditable(this.lockInfo, c.supplierCreditDate); }

  edit(_c: SupplierCreditState): boolean { return this.canAdd; }
  refund(c: SupplierCreditState): boolean { return (c.refundDue ?? 0) > 0 && this.can('supplierCredit.actions.refund.access'); }
  applyCredit(c: SupplierCreditState): boolean { return (c.refundDue ?? 0) > 0 && this.can('supplierCredit.actions.applyCredit.access'); }
  delete(c: SupplierCreditState): boolean {
    return this.unlocked(c) && this.can('supplierCredit.actions.delete.access') && c.refundedAmount === 0;
  }

  // ── what the buttons do ────────────────────────────────────────────
  goRefund(id: string): void { void this.router.navigate(['/account/supplier-credit/refund', id]); }

  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('COMMON.DELETE', 'SUPPLIER_CREDITS.VIEW.CONFIRM_DELETE', true, () => this.credits.deleteSupplierCredit(id), after);
  }

  async runApplyCredit(id: string, c: SupplierCreditState, after: () => void): Promise<void> {
    const ok = await this.modal.open<ApplyCreditToBillsModalComponent, ApplyCreditToBillsData, boolean>(ApplyCreditToBillsModalComponent, {
      size: 'lg',
      data: { creditId: id, creditNumber: c.supplierCreditNumber ?? '', supplierId: c.supplierId ?? '', refundDue: c.refundDue ?? 0 },
    }).afterClosed();
    if (ok) after();
  }

  /** The "Actions" menu of a saved supplier credit - Refund, Apply Credits, Delete - only what the rules allow. */
  menu(c: SupplierCreditState, id: string, afterDelete: () => void, afterApply: () => void = afterDelete): DropdownMenuBtnItem[] {
    const t = this.t;
    const items: DropdownMenuBtnItem[] = [];
    if (this.refund(c)) items.push(this.item(t('SUPPLIER_CREDITS.ACTIONS.REFUND'), () => this.goRefund(id)));
    if (this.applyCredit(c)) items.push(this.item(t('SUPPLIER_CREDITS.ACTIONS.APPLY_CREDITS'), () => void this.runApplyCredit(id, c, afterApply)));
    if (this.delete(c)) items.push(this.item(t('COMMON.DELETE'), () => void this.runDelete(id, afterDelete), { danger: true, separator: items.length > 0 }));
    return items;
  }
}
