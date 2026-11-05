import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { CustomerPickerComponent } from '@shared/components/customer-picker/customer-picker.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { EntityCustomFieldsComponent } from '../../../../settings/components/entity-custom-fields/entity-custom-fields.component';

import { Invoice, InvoiceLine } from '../../../models/invoice.model';
import { Expense, ExpenseLine } from '../../../models/expense.model';
import { DocFormConfig, DocFormService, DocumentFormBase } from '../../../services/document-form-base';
import { DocumentLineEditor } from '../../../services/document-line-editor';
import { DocLinesConfig } from '../../../components/doc-lines-table/doc-lines.types';
import { DocAttachmentsCardComponent } from '../../../components/doc-attachments-card/doc-attachments-card.component';
import { DocFormShellComponent } from '../../../components/doc-form-shell/doc-form-shell.component';
import { DocSupplierSectionComponent, SupplierMini } from '../../../components/doc-supplier-section/doc-supplier-section.component';
import { SuppliersService } from '../../../suppliers/services/suppliers.service';
import { SupplierQuickCreateModalComponent } from '../../../suppliers/components/supplier-quick-create-modal/supplier-quick-create-modal.component';
import { ExpenseLinesComponent } from '../../components/expense-lines/expense-lines.component';
import { ExpenseActions } from '../../services/expense-actions';
import { ExpensesService } from '../../services/expenses.service';
import { EXPENSE_RULES } from '../../services/expense-validation';

/** Line rules of an expense: a blank row has no account yet (the user picks one), everything else is the shared editor's. */
class ExpenseLineEditor extends DocumentLineEditor {
  protected override newLine(): InvoiceLine { return new ExpenseLine(); }
  /** A row is empty while it has neither an account nor an amount (the shared table gates "Add Row" on it). */
  override get lastLineIsEmpty(): boolean {
    const last = this.doc.lines[this.doc.lines.length - 1] as ExpenseLine | undefined;
    return !!last && !last.accountId && !(last.amount > 0);
  }
  override addLine(): InvoiceLine {
    const line = super.addLine();
    line.accountId = '';
    return line;
  }
}

/**
 * Expenses -> create / edit / clone page (`/account/expense/:id`, `0` / `new` = new). Built on the shared
 * document-form base (legacy `ExpenseFormComponent`): number, date and time, the payment method the money
 * left through, an optional supplier and an optional customer it is billable to, and the lines - an expense
 * account, an amount, a tax and a note each. The total must be above zero; a reconciled expense can't be opened.
 */
@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, MycurrencyPipe,
    DocFormShellComponent, DocSupplierSectionComponent, SearchDropdownComponent, DatePickerComponent, CustomerPickerComponent,
    SegmentedToggleComponent, DocAttachmentsCardComponent, EntityCustomFieldsComponent, ExpenseLinesComponent,
  ],
  templateUrl: './expense-form.component.html',
})
export class ExpenseFormComponent extends DocumentFormBase {
  protected expenses = inject(ExpensesService);
  protected suppliers = inject(SuppliersService);
  protected actions = inject(ExpenseActions);

  readonly cfg: DocFormConfig = {
    features: ['account/expenses'],
    routeBase: '/account/expense',
    viewRoute: '/account/expense/view',
    numberField: 'expenseNumber',
    dateField: 'expenseDate',
    numberModule: 'expense',
    numberNameKey: 'EXPENSES.FORM.EXPENSE',
    numberModeKey: 'invo_expense_number_mode',
    rules: EXPENSE_RULES,
    privilegeRoot: 'expenseSecurity',
    whatsappType: 'expense',
    pdfName: 'expense.pdf',
    titleKey: 'EXPENSES.FORM.EXPENSE',
    newCrumbKey: 'EXPENSES.FORM.NEW_EXPENSE',
    editCrumbKey: 'EXPENSES.FORM.EDIT_EXPENSE',
    listCrumbKey: 'EXPENSES.LIST.EXPENSE_LIST',
    dashboardCrumbKey: 'EXPENSES.DASHBOARD',
    hasStatus: false,
    primaryKind: 'list',
    menuKinds: ['send'],
  };

  protected svc: DocFormService = {
    get: id => this.expenses.getExpense(id),
    getNumber: () => this.expenses.getExpenseNumber(),
    save: d => this.expenses.saveExpense(d as Expense),
    pdf: id => this.expenses.viewExpensePdf(id),
    sendEmail: (payload, id) => this.expenses.sendExpenseEmail({ ...payload, expenseId: id }),
  };

  supplierValue: SupplierMini | null = null;
  paymentMethods: any[] = [];
  readonly taxTypes: SegmentedToggleOption[] = [
    { value: 'exclusive', label: 'DOC_FORM.EXCLUSIVE_TAX' },
    { value: 'inclusive', label: 'DOC_FORM.INCLUSIVE_TAX' },
  ];

  get exp(): Expense { return this.doc as Expense; }
  get liveLines(): ExpenseLine[] { return this.exp.liveLines; }

  protected newDoc(): Invoice { return new Expense(); }
  protected override loadAccounts(): Promise<any[]> { return this.expenses.getExpenseAccounts(); }
  protected override makeEditor(d: Invoice, taxes: any[], accounts: any[]): DocumentLineEditor { return new ExpenseLineEditor(d, taxes, accounts); }
  /** The lines are drawn by this form itself (no products), not by the shared table. */
  protected makeLinesConfig(): DocLinesConfig { return { columns: [], itemSearch: async () => ({ list: [], hasNext: false }) }; }
  protected override linesAreValid(): boolean {
    const lines = this.liveLines.filter(l => !!l.accountId || l.amount > 0);
    return lines.length > 0 && lines.every(l => !!l.accountId && l.amount > 0 && !(l.taxes ?? []).some(t => t.taxPercentage == null || !t.taxId));
  }
  protected override restoreTrailingLine(): void { /* the user adds lines with the button */ }
  override get branchLocked(): boolean { return false; }

  /** A customer's addresses mean nothing on an expense. */
  protected override async loadAddresses(): Promise<void> { /* no address */ }

  // ── lifecycle ──────────────────────────────────────────────────────
  protected override async initNew(d: Invoice): Promise<void> {
    const supplierId = this.route.snapshot.queryParams['supplierId'];
    if (supplierId) (d as Expense).supplierId = supplierId;
  }

  protected override async afterInit(isNew: boolean): Promise<void> {
    const e = this.exp;
    this.editor!.deleteMode = true;
    if (isNew) e.lines.forEach(l => (l.accountId = ''));
    else e.lines.forEach(l => ((l as any).isNew = false));

    if (e.supplierId) {
      this.supplierValue = { id: e.supplierId, name: e.supplierName ?? '' };
      try {
        const s = await this.suppliers.getSupplier(e.supplierId);
        this.supplierValue = { id: s.id, name: s.name, phone: s.phone, email: s.email };
        e.supplierName = s.name;
      } catch { /* the name already on the record is enough */ }
    }
    if (e.customerId) this.customerValue = { id: e.customerId, name: e.customerName, displayName: e.customerName, phone: '', email: '' };

    await this.loadMethods();
    e.calculateTotal();
  }

  protected override async sendRecipient(): Promise<{ emails: string[]; phone: string }> {
    const e = this.exp;
    let email = e.supplierEmail || '';
    let phone = this.supplierValue?.phone || '';
    if (e.supplierId && (!email || !phone)) {
      try {
        const s = await this.suppliers.getSupplier(e.supplierId);
        email = email || s.email;
        phone = phone || s.phone;
      } catch { /* the modal lets the user type the address */ }
    }
    return { emails: email ? [email] : [], phone };
  }

  // ── payment method ─────────────────────────────────────────────────
  /** Changing the method of a saved expense is its own privilege (creating is unaffected). */
  get methodLocked(): boolean {
    return this.formStatus === 'edit' && !this.privileges.check('paymentMethodSecurity.actions.changePaymentMethod.access');
  }
  private async loadMethods(): Promise<void> {
    const e = this.exp;
    this.paymentMethods = await this.lookups.getMiniPaymentMethods(e.branchId, e.paymentMethodId || null);
    if (this.paymentMethods.length && this.formStatus !== 'edit' && !e.paymentMethodId) this.applyMethod(this.paymentMethods[0]);
  }
  private applyMethod(m: any): void {
    this.exp.paymentMethodId = m?.id ?? '';
    this.exp.paymentMethodName = m?.name ?? '';
  }
  methodOf = () => this.paymentMethods.find(m => m.id === this.exp.paymentMethodId) ?? null;
  methodLabel = (m: any) => m?.name ?? '';
  onMethod(m: any): void { this.applyMethod(m); this.markDirty(); }

  override async onBranch(b: any): Promise<void> {
    await super.onBranch(b);
    this.exp.paymentMethodId = '';
    await this.loadMethods();
  }

  // ── supplier / customer ────────────────────────────────────────────
  async onSupplier(s: SupplierMini | undefined): Promise<void> {
    const e = this.exp;
    this.supplierValue = s ?? null;
    e.supplierId = s?.id ?? null;
    e.supplierName = s?.name ?? '';
    e.supplierEmail = s?.email ?? '';
    this.markDirty();
  }

  async createSupplier(): Promise<void> {
    const res = await this.modal.open<SupplierQuickCreateModalComponent, void, { supplierId: string; supplierName: string } | null>(
      SupplierQuickCreateModalComponent, { size: 'lg' },
    ).afterClosed();
    if (!res?.supplierId) return;
    const s = await this.suppliers.getSupplier(res.supplierId);
    await this.onSupplier({ id: s.id, name: s.name, phone: s.phone, email: s.email });
  }

  // ── tax type / date ────────────────────────────────────────────────
  get taxType(): string { return this.exp.isInclusiveTax ? 'inclusive' : 'exclusive'; }
  onTaxType(v: string): void { this.exp.isInclusiveTax = v === 'inclusive'; this.exp.calculateTotal(); this.markDirty(); }

  onExpenseDate(v: any): void { if (v instanceof Date) { this.exp.expenseDate = v; this.markDirty(); } }

  protected override blockSave(): string | null {
    return this.exp.total > 0 ? null : this.lang.instant('EXPENSES.FORM.TOTAL_ABOVE_ZERO');
  }

  actionsMenu(): DropdownMenuBtnItem[] {
    const d = this.exp;
    if (this.formStatus !== 'edit' || !d?.id) return [];
    return this.actions.menu(d, d.id, () => { this.dirty = false; this.form.markAsPristine(); this.afterSaveRoute(); });
  }
}
