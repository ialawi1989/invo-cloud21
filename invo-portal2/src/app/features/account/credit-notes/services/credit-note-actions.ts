import { Injectable, inject } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocActionsBase } from '../../services/doc-actions-base';
import { TransactionLockService } from '../../services/transaction-lock.service';
import {
  ApplyCreditToInvoicesData, ApplyCreditToInvoicesModalComponent,
} from '../components/apply-credit-to-invoices-modal/apply-credit-to-invoices-modal.component';
import { CreditNotesService } from './credit-notes.service';

/** What the rules read — satisfied by a list row and by the `CreditNote` model alike. */
export interface CreditNoteState {
  creditNoteDate: any;
  refundedAmount?: number;
  appliedAmount?: number;
  remainingCredit?: number;
  creditNoteNumber?: string;
  customerId?: string | null;
}

/**
 * Single home of a credit note's actions: the period-lock / privilege / usage rules, what the buttons do,
 * and the "Actions" menu built from them (see {@link DocActionsBase}) — the list row, the view page and the
 * form all use it. Call {@link refresh} once when a screen opens so the accounting-period lock is known.
 */
@Injectable({ providedIn: 'root' })
export class CreditNoteActions extends DocActionsBase {
  private lock = inject(TransactionLockService);
  private notes = inject(CreditNotesService);

  private lockInfo: any = null;
  async refresh(branchId: string | null = null): Promise<void> { this.lockInfo = await this.lock.transactionsDate(branchId); }

  get canAdd() { return this.can('creditNoteSecurity.actions.add.access'); }
  get canPrint() { return this.can('creditNoteSecurity.actions.print.access'); }
  get canDeletePrivilege() { return this.can('creditNoteSecurity.actions.delete.access'); }
  get canRefundPrivilege() { return this.can('creditNoteSecurity.actions.refund.access'); }
  get canApplyPrivilege() { return this.can('creditNoteSecurity.actions.applyCredit.access'); }

  private unlocked(n: CreditNoteState): boolean { return n.creditNoteDate != null && this.lock.isEditable(this.lockInfo, n.creditNoteDate); }
  /** A credit note that was refunded or applied (even partly) can no longer be deleted. */
  private used(n: CreditNoteState): boolean { return (n.refundedAmount ?? 0) + (n.appliedAmount ?? 0) > 0; }

  delete(n: CreditNoteState): boolean { return this.canDeletePrivilege && this.unlocked(n) && !this.used(n); }
  refund(n: CreditNoteState): boolean { return this.canRefundPrivilege && (n.remainingCredit ?? 0) > 0; }
  applyCredit(n: CreditNoteState): boolean { return this.canApplyPrivilege && (n.remainingCredit ?? 0) > 0; }

  // ── what the buttons do ────────────────────────────────────────────
  goRefund(id: string): void { void this.router.navigate(['/account/credit-notes/refund', id]); }

  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('COMMON.DELETE', 'CREDIT_NOTES.VIEW.CONFIRM_DELETE', true, () => this.notes.deleteCreditNote(id), after);
  }

  async runApplyCredit(id: string, n: CreditNoteState, after: () => void): Promise<void> {
    const ok = await this.modal.open<ApplyCreditToInvoicesModalComponent, ApplyCreditToInvoicesData, boolean>(ApplyCreditToInvoicesModalComponent, {
      size: 'lg',
      data: { creditNoteId: id, creditNoteNumber: n.creditNoteNumber ?? '', customerId: n.customerId ?? '', remaining: n.remainingCredit ?? 0 },
    }).afterClosed();
    if (ok) after();
  }

  /** The "Actions" menu of a saved credit note — Refund, Apply Credits, Delete — only what the rules allow. */
  menu(n: CreditNoteState, id: string, afterDelete: () => void, afterApply: () => void = afterDelete): DropdownMenuBtnItem[] {
    const t = this.t;
    const items: DropdownMenuBtnItem[] = [];
    if (this.refund(n)) items.push(this.item(t('CREDIT_NOTES.ACTIONS.REFUND'), () => this.goRefund(id)));
    if (this.applyCredit(n)) items.push(this.item(t('CREDIT_NOTES.ACTIONS.APPLY_CREDITS'), () => void this.runApplyCredit(id, n, afterApply)));
    if (this.delete(n)) items.push(this.item(t('COMMON.DELETE'), () => void this.runDelete(id, afterDelete), { danger: true, separator: true }));
    return items;
  }
}
