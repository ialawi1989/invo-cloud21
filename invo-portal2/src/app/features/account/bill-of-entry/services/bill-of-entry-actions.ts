import { Injectable, inject } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocActionsBase } from '../../services/doc-actions-base';
import { TransactionLockService } from '../../services/transaction-lock.service';
import { BillOfEntryService } from './bill-of-entry.service';

/** What the rules read - satisfied by a record and by a list row (which carries no status). */
export interface BillOfEntryState {
  billingOfEntryDate?: any;
  status?: string;
}

/**
 * Single home of a bill of entry's actions: the period-lock / privilege / status rules, what the buttons do
 * and the "Actions" menu built from them (see {@link DocActionsBase}). Call {@link refresh} once when a
 * screen opens so the accounting-period lock is known. A list row has no status, so only the privilege and
 * the lock apply there; an opened record can be deleted while it is Draft or Open.
 */
@Injectable({ providedIn: 'root' })
export class BillOfEntryActions extends DocActionsBase {
  private lock = inject(TransactionLockService);
  private entries = inject(BillOfEntryService);

  private lockInfo: any = null;
  async refresh(branchId: string | null = null): Promise<void> {
    this.lockInfo = await this.lock.transactionsDate(branchId);
    // The "why can't I edit" explanations live in the shared document-form bundle.
    await this.lang.loadFeature('account/components/doc-lines-table');
  }

  get canAdd() { return this.can('billOfEntrySecurity.actions.add.access'); }
  /** The bill of entry has no print privilege of its own - legacy used the bill's. */
  get canPrint() { return this.can('billingSecurity.actions.print.access'); }

  private unlocked(b: BillOfEntryState): boolean { return !!b.billingOfEntryDate && this.lock.isEditable(this.lockInfo, b.billingOfEntryDate); }

  edit(b: BillOfEntryState): boolean { return this.canAdd && this.unlocked(b); }
  /** Why the bill of entry's state forbids editing (an i18n key), or null. */
  /** Why Edit is unavailable (an i18n key), or null when it is available. Mirrors `edit()`. */
  editBlockedReason(b: BillOfEntryState): string | null {
    if (this.edit(b)) return null;
    if (!this.canAdd) return 'DOC_FORM.EDIT_BLOCKED.NO_PERMISSION';
    return this.editStateBlock(b) ?? 'DOC_FORM.EDIT_BLOCKED.PERIOD_LOCKED';
  }
  editStateBlock(b: BillOfEntryState): string | null {
    return this.unlocked(b) ? null : 'DOC_FORM.EDIT_BLOCKED.PERIOD_LOCKED';
  }
  delete(b: BillOfEntryState): boolean {
    return this.can('billOfEntrySecurity.actions.delete.access') && this.unlocked(b)
      && (b.status === undefined || b.status === 'Draft' || b.status === 'Open');
  }

  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('COMMON.DELETE', 'BILL_OF_ENTRY.VIEW.CONFIRM_DELETE', true, () => this.entries.deleteBillOfEntry(id), after);
  }

  menu(b: BillOfEntryState, id: string, after: () => void): DropdownMenuBtnItem[] {
    return this.delete(b)
      ? [this.item(this.t('COMMON.DELETE'), () => void this.runDelete(id, after), { danger: true })]
      : [];
  }
}
