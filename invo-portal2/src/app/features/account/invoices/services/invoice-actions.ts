import { Injectable, inject } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
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
 * rule here and every screen follows. Call {@link refresh} once when a screen opens so the
 * accounting-period lock is known.
 */
@Injectable({ providedIn: 'root' })
export class InvoiceActions {
  private privileges = inject(PrivilegeService);
  private lock = inject(TransactionLockService);
  private auth = inject(AuthService);

  private lockInfo: any = null;
  async refresh(branchId: string | null = null): Promise<void> { this.lockInfo = await this.lock.transactionsDate(branchId); }

  private can = (p: string) => this.privileges.check(p);
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
  pay(i: InvoiceState): boolean { return this.canPayPrivilege && i.status !== 'Paid' && i.status !== 'Draft' && !this.isFinal(i); }
  clone(i: InvoiceState): boolean { return this.canAdd && !i.isFullyRefunded && i.status !== 'Void' && i.status !== 'Closed'; }
  open(i: InvoiceState): boolean { return this.canOpenPrivilege && i.status === 'Draft'; }
  creditNote(i: InvoiceState): boolean { return this.canCreditNotePrivilege && !this.isFinal(i) && i.status !== 'Draft'; }
  writeOff(i: InvoiceState): boolean { return this.canWriteOffPrivilege && (i.status === 'Open' || i.status === 'Partially Paid'); }
  delete(i: InvoiceState): boolean { return this.canDeletePrivilege && this.unlocked(i) && i.status !== 'Closed' && i.status !== 'Paid'; }
  applyCredit(i: InvoiceState, customerCredit: number): boolean {
    return customerCredit > 0 && !['Closed', 'writeOff', 'Void'].includes(i.status) && (i.balance ?? 0) > 0;
  }
  /** The form: editing someone else's invoice needs the edit privilege. */
  openForEdit(i: InvoiceState, cloned: boolean): boolean {
    return cloned || i.employeeId == this.auth.currentEmployee?.id || this.can('invoiceSecurity.actions.edit.access');
  }
}
