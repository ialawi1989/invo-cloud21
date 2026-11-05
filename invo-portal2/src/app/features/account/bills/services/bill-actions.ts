import { Injectable, inject } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocActionsBase } from '../../services/doc-actions-base';
import { TransactionLockService } from '../../services/transaction-lock.service';
import { BillsService } from './bills.service';

/** What the rules read - satisfied by a list row and by the `Bill` model alike. */
export interface BillState {
  status?: string;
  total?: number;
  billingDate?: any;
  billOfEntryId?: string | null;
  allowBillOfEntry?: boolean;
  purchaseOrderId?: string | null;
}

/**
 * Single home of a bill's actions: the period-lock / privilege / status rules, what the buttons do and the
 * "Actions" menu built from them (see {@link DocActionsBase}) - the list row, the view page and the form all
 * use it. Call {@link refresh} once when a screen opens so the accounting-period lock is known.
 */
@Injectable({ providedIn: 'root' })
export class BillActions extends DocActionsBase {
  private lock = inject(TransactionLockService);
  private bills = inject(BillsService);

  private lockInfo: any = null;
  async refresh(branchId: string | null = null): Promise<void> {
    this.lockInfo = await this.lock.transactionsDate(branchId);
    // The "why can't I edit" explanations live in the shared document-form bundle.
    await this.lang.loadFeature('account/components/doc-lines-table');
  }

  get canAdd() { return this.can('billingSecurity.actions.add.access'); }
  get canPrint() { return this.can('billingSecurity.actions.print.access'); }

  private unlocked(b: BillState): boolean { return !!b.billingDate && this.lock.isEditable(this.lockInfo, b.billingDate); }
  private issued(b: BillState): boolean { return b.status !== 'Closed' && b.status !== 'Draft' && b.total !== 0; }

  edit(b: BillState): boolean { return this.canAdd && this.unlocked(b) && !b.billOfEntryId && b.status !== 'Closed'; }
  /** Why the bill's state forbids editing (an i18n key), or null. Permissions are not part of this. */
  /** Why Edit is unavailable (an i18n key), or null when it is available. Mirrors `edit()`. */
  editBlockedReason(b: BillState): string | null {
    if (this.edit(b)) return null;
    if (!this.canAdd) return 'DOC_FORM.EDIT_BLOCKED.NO_PERMISSION';
    return this.editStateBlock(b) ?? 'DOC_FORM.EDIT_BLOCKED.PERIOD_LOCKED';
  }
  editStateBlock(b: BillState): string | null {
    if (b.billOfEntryId) return 'DOC_FORM.EDIT_BLOCKED.HAS_BILL_OF_ENTRY';
    if (b.status === 'Closed') return 'DOC_FORM.EDIT_BLOCKED.CLOSED';
    if (!this.unlocked(b)) return 'DOC_FORM.EDIT_BLOCKED.PERIOD_LOCKED';
    return null;
  }
  pay(b: BillState): boolean { return b.status !== 'Paid' && this.issued(b) && this.can('billingPaymentsSecurity.actions.add.access'); }
  clone(_b: BillState): boolean { return this.can('billingSecurity.actions.clone.access'); }
  open(b: BillState): boolean { return b.status === 'Draft'; }
  showPurchaseOrder(b: BillState): boolean { return !!b.purchaseOrderId && this.can('purchaseOrderSecurity.actions.view.access'); }
  createSupplierCredit(b: BillState): boolean { return this.issued(b) && this.can('supplierCredit.actions.add.access'); }
  createBillOfEntry(b: BillState): boolean { return !!b.allowBillOfEntry && this.issued(b) && this.can('billOfEntrySecurity.actions.add.access'); }
  delete(b: BillState): boolean {
    return (b.status === 'Draft' || b.status === 'Open') && this.can('billingSecurity.actions.delete.access') && this.unlocked(b) && !b.billOfEntryId;
  }

  // ── what the buttons do ────────────────────────────────────────────
  goClone(id: string): void { this.goCloneOf('/account/bills', id); }
  goPay(id: string): void { void this.router.navigate(['/account/bills/pay', id]); }
  goPurchaseOrder(b: BillState): void { void this.router.navigate(['/account/purchase-order/view', b.purchaseOrderId]); }
  goSupplierCredit(id: string): void { void this.router.navigate(['/account/supplier-credit', '0', 'forBill', id]); }
  goBillOfEntry(id: string): void { void this.router.navigate(['/account/bill-of-entry', '0', id]); }

  runOpen(id: string, after: () => void): Promise<void> {
    return this.confirmRun('BILLS.ACTIONS.OPEN_BILL', 'BILLS.VIEW.CONFIRM_OPEN', false, () => this.bills.openBill(id), after);
  }
  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('COMMON.DELETE', 'BILLS.VIEW.CONFIRM_DELETE', true, () => this.bills.deleteBill(id), after);
  }

  /** The "Actions" menu of a saved bill, in legacy order - only what the rules allow. */
  menu(b: BillState, id: string, afterOpen: () => void, afterDelete: () => void = afterOpen): DropdownMenuBtnItem[] {
    const t = this.t;
    const items: DropdownMenuBtnItem[] = [];
    if (this.showPurchaseOrder(b)) items.push(this.item(t('BILLS.ACTIONS.SHOW_PURCHASE_ORDER'), () => this.goPurchaseOrder(b)));
    if (this.clone(b)) items.push(this.item(t('BILLS.ACTIONS.CLONE'), () => this.goClone(id)));
    if (this.open(b)) items.push(this.item(t('BILLS.ACTIONS.OPEN_BILL'), () => void this.runOpen(id, afterOpen)));
    if (this.createSupplierCredit(b)) items.push(this.item(t('BILLS.ACTIONS.CREATE_SUPPLIER_CREDIT'), () => this.goSupplierCredit(id)));
    if (this.createBillOfEntry(b)) items.push(this.item(t('BILLS.ACTIONS.CREATE_BILL_OF_ENTRY'), () => this.goBillOfEntry(id)));
    if (this.delete(b)) items.push(this.item(t('COMMON.DELETE'), () => void this.runDelete(id, afterDelete), { danger: true, separator: items.length > 0 }));
    return items;
  }
}
