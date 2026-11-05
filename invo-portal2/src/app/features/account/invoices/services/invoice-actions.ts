import { Injectable, inject } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocActionsBase } from '../../services/doc-actions-base';
import { InvoicesService } from './invoices.service';
import { TransactionLockService } from '../../services/transaction-lock.service';

/** What the rules read — satisfied by a list row and by the `Invoice` model alike. */
export interface InvoiceState {
  status: string;
  invoiceDate: any;
  isFullyRefunded?: boolean;
  balance?: number;
  employeeId?: string;
}

/**
 * Single home of "may this button show for this invoice?": the period lock, status and
 * privilege rules that the list row actions, the view toolbar and the form all apply. Change a
 * rule here and every screen follows. It also owns what the buttons *do* (clone, credit note, write
 * off, delete) and the "Actions" menu built from them, so the form, view and list never re-implement them. Call {@link refresh} once when a screen opens so the
 * accounting-period lock is known.
 */
@Injectable({ providedIn: 'root' })
export class InvoiceActions extends DocActionsBase {
  private lock = inject(TransactionLockService);
  private auth = inject(AuthService);
  private invoices = inject(InvoicesService);

  private lockInfo: any = null;
  async refresh(branchId: string | null = null): Promise<void> { this.lockInfo = await this.lock.transactionsDate(branchId); }

  get canAdd() { return this.can('invoiceSecurity.actions.add.access'); }
  get canPrint() { return this.can('invoiceSecurity.actions.print.access'); }
  get canPayPrivilege() { return this.can('invoicePaymentsSecurity.actions.add.access'); }
  get canCreditNotePrivilege() { return this.can('creditNoteSecurity.actions.add.access'); }
  get canOpenPrivilege() { return this.can('invoiceSecurity.actions.openInvoice.access'); }
  get canWriteOffPrivilege() { return this.can('invoiceSecurity.actions.writeOff.access'); }
  get canDeletePrivilege() { return this.can('invoiceSecurity.actions.delete.access'); }
  get canAdjustPrice() { return this.can('invoiceSecurity.actions.adjPrice.access'); }
  get canViewJournals() { return this.can('invoiceSecurity.actions.viewJournals.access'); }
  get canPrintDeliveryNote() { return this.can('invoiceSecurity.actions.printDeliveryNote.access'); }
  get canVoidItem() { return this.can('invoiceSecurity.actions.voidItem.access'); }

  isFinal(i: InvoiceState): boolean { return !!i.isFullyRefunded || ['Void', 'writeOff', 'Closed'].includes(i.status); }
  private unlocked(i: InvoiceState): boolean { return i.invoiceDate != null && this.lock.isEditable(this.lockInfo, i.invoiceDate); }

  edit(i: InvoiceState): boolean { return this.canAdd && this.unlocked(i) && !this.isFinal(i); }
  /**
   * Why an invoice's STATE forbids editing (refunded / void / written off /
   * closed / period locked), as an i18n key; null when the state allows it.
   * Permissions are not part of this — see `editBlockedReason`.
   */
  editStateBlock(i: InvoiceState): string | null {
    const p = 'INVOICES.LIST.EDIT_BLOCKED.';
    if (i.isFullyRefunded) return p + 'REFUNDED';
    if (i.status === 'Void') return p + 'VOID';
    if (i.status === 'writeOff') return p + 'WRITTEN_OFF';
    if (i.status === 'Closed') return p + 'CLOSED';
    if (!this.unlocked(i)) return p + 'PERIOD_LOCKED';
    return null;
  }

  /**
   * Why Edit is unavailable, as an i18n key, or null when it is available.
   * Mirrors `edit()` rule for rule so the explanation can never disagree with
   * the button.
   */
  editBlockedReason(i: InvoiceState): string | null {
    if (this.edit(i)) return null;
    if (!this.canAdd) return 'INVOICES.LIST.EDIT_BLOCKED.NO_PERMISSION';
    return this.editStateBlock(i) ?? 'INVOICES.LIST.EDIT_BLOCKED.PERIOD_LOCKED';
  }

  pay(i: InvoiceState): boolean { return this.canPayPrivilege && i.status !== 'Paid' && i.status !== 'Draft' && !this.isFinal(i); }
  clone(i: InvoiceState): boolean { return this.canAdd && !i.isFullyRefunded && i.status !== 'Void' && i.status !== 'Closed'; }
  open(i: InvoiceState): boolean { return this.canOpenPrivilege && i.status === 'Draft'; }
  creditNote(i: InvoiceState): boolean { return this.canCreditNotePrivilege && !this.isFinal(i) && i.status !== 'Draft'; }
  writeOff(i: InvoiceState): boolean { return this.canWriteOffPrivilege && (i.status === 'Open' || i.status === 'Partially Paid'); }
  delete(i: InvoiceState): boolean { return this.canDeletePrivilege && this.unlocked(i) && i.status !== 'Closed' && i.status !== 'Paid'; }
  applyCredit(i: InvoiceState, customerCredit: number): boolean {
    return customerCredit > 0 && !['Closed', 'writeOff', 'Void'].includes(i.status) && (i.balance ?? 0) > 0;
  }
  // ── what the buttons do ────────────────────────────────────────────
  goClone(id: string): void { this.goCloneOf('/account/invoices', id); }
  goCreditNote(id: string): void { void this.router.navigate(['/account/credit-notes/new/forInvoice', id]); }
  goPay(id: string): void { void this.router.navigate(['/account/invoices/payment', id]); }

  runOpen(id: string, after: () => void): Promise<void> { return this.exec(() => this.invoices.openInvoice(id), after); }
  runWriteOff(id: string, after: () => void): Promise<void> {
    return this.confirmRun('INVOICES.ACTIONS.WRITE_OFF', 'INVOICES.ACTIONS.CONFIRM_WRITE_OFF', false, () => this.invoices.WriteOffInvoice(id), after);
  }
  runDelete(id: string, after: () => void): Promise<void> {
    return this.confirmRun('COMMON.DELETE', 'INVOICES.VIEW.CONFIRM_DELETE', true, () => this.invoices.DeleteInv(id), after);
  }

  /**
   * The "Actions" menu of a saved invoice — the legacy order and rules (Clone, Open Invoice, Create Credit Note,
   * Write Off, Delete), only what the rules allow. The form and the view both render this; screen-specific
   * extras (Make Recurring, View Journal, Preferences) are added by the screen around it.
   */
  menu(i: InvoiceState, id: string, after: () => void): DropdownMenuBtnItem[] {
    const t = this.t;
    const items: DropdownMenuBtnItem[] = [];
    if (this.clone(i)) items.push(this.item(t('INVOICES.VIEW.CLONE'), () => this.goClone(id)));
    if (this.open(i)) items.push(this.item(t('INVOICES.VIEW.OPEN_INVOICE'), () => void this.runOpen(id, after)));
    if (this.creditNote(i)) items.push(this.item(t('INVOICES.LIST.CREATE_CREDIT_NOTE'), () => this.goCreditNote(id)));
    if (this.writeOff(i)) items.push(this.item(t('INVOICES.ACTIONS.WRITE_OFF'), () => void this.runWriteOff(id, after)));
    if (this.delete(i)) items.push(this.item(t('COMMON.DELETE'), () => void this.runDelete(id, after), { danger: true, separator: true }));
    return items;
  }

  /** The form: editing someone else's invoice needs the edit privilege. */
  openForEdit(i: InvoiceState, cloned: boolean): boolean {
    return cloned || i.employeeId == this.auth.currentEmployee?.id || this.can('invoiceSecurity.actions.edit.access');
  }
}
