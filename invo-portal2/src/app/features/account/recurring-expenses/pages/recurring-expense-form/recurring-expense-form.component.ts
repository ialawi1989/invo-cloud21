import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { CustomerPickerComponent } from '@shared/components/customer-picker/customer-picker.component';
import { SegmentedToggleComponent } from '@shared/components/segmented-toggle/segmented-toggle.component';

import { Expense } from '../../../models/expense.model';
import { DocFormConfig, DocFormService, ymd } from '../../../services/document-form-base';
import { DocFormShellComponent } from '../../../components/doc-form-shell/doc-form-shell.component';
import { DocSupplierSectionComponent } from '../../../components/doc-supplier-section/doc-supplier-section.component';
import { RecurringScheduleCardComponent } from '../../../components/recurring-schedule-card/recurring-schedule-card.component';
import { ExpenseLinesComponent } from '../../../expenses/components/expense-lines/expense-lines.component';
import { ExpenseFormComponent } from '../../../expenses/pages/expense-form/expense-form.component';
import { RecurringExpense } from '../../models/recurring-expense.model';
import { RecurringExpensesService } from '../../services/recurring-expenses.service';
import { RECURRING_EXPENSE_RULES, RecurringExpenseActions } from '../../services/recurring-expense-schedule';

/**
 * Recurring Expenses -> create / edit page (`/account/recurring-expense/:id`, `new` / `0` = create). Legacy
 * `RecurringExpenseFormComponent`: the expense template (`transactionDetails`) is edited with the expense form's
 * own logic - supplier, billable customer, branch, payment method, lines - and the shared schedule card (profile
 * name, start / end, repeat rule) wraps it; both are saved in one `saveRecurringExpense` call. Branch and
 * payment method are frozen once the schedule generated an expense. Each generated expense gets its own number
 * and date on the server.
 */
@Component({
  selector: 'app-recurring-expense-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule,
    DocFormShellComponent, DocSupplierSectionComponent, SearchDropdownComponent, CustomerPickerComponent, SegmentedToggleComponent,
    ExpenseLinesComponent, RecurringScheduleCardComponent,
  ],
  templateUrl: './recurring-expense-form.component.html',
})
export class RecurringExpenseFormComponent extends ExpenseFormComponent {
  private service = inject(RecurringExpensesService);
  private recActions = inject(RecurringExpenseActions);

  override readonly cfg: DocFormConfig = {
    features: ['account/expenses', 'account/recurring-expenses', 'account/recurring-invoices'],
    routeBase: '/account/recurring-expense',
    viewRoute: '/account/recurring-expense/view',
    numberField: 'expenseNumber',
    dateField: 'expenseDate',
    numberModule: 'expense',
    numberNameKey: 'RECURRING_EXPENSES.FORM.RECURRING_EXPENSE',
    numberModeKey: 'invo_recurring_expense_number_mode',
    rules: RECURRING_EXPENSE_RULES,
    privilegeRoot: 'recurringExpenseSecurity',
    whatsappType: 'expense',
    pdfName: 'recurring-expense.pdf',
    titleKey: 'RECURRING_EXPENSES.FORM.RECURRING_EXPENSE',
    newCrumbKey: 'RECURRING_EXPENSES.FORM.NEW',
    editCrumbKey: 'RECURRING_EXPENSES.FORM.EDIT',
    listCrumbKey: 'RECURRING_EXPENSES.LIST.TITLE',
    dashboardCrumbKey: 'RECURRING_EXPENSES.DASHBOARD',
    hasStatus: false,
    primaryKind: 'list',
    menuKinds: [],
  };

  /** The schedule header wrapping the expense template (`doc`). */
  rec = new RecurringExpense();

  protected override svc: DocFormService = {
    get: async id => {
      const r = await this.service.getById(id);
      if (!r) {
        this.toast.error('COMMON.OPS', this.lang.instant('RECURRING_EXPENSES.FORM.NOT_FOUND'));
        void this.router.navigate([this.cfg.routeBase]);
        return new Expense();
      }
      this.rec = r;
      // The header carries the payment method / customer / supplier the template is made with.
      const t = r.transactionDetails;
      if (r.paymentMethodId) t.paymentMethodId = r.paymentMethodId;
      if (r.supplierId) t.supplierId = r.supplierId;
      if (r.customerId) t.customerId = r.customerId;
      if (r.customerName) t.customerName = r.customerName;
      if (r.supplierName) t.supplierName = r.supplierName;
      return t;
    },
    // A recurring profile has no number of its own; each generated expense gets one on the server.
    getNumber: async () => '',
    save: d => this.service.save(this.payload(d as Expense)),
    pdf: async () => null,
    sendEmail: async () => null,
  };

  /** Branch and payment method are frozen once an expense was generated (the backend keeps the stored ones anyway). */
  get frozen(): boolean { return this.rec.hasExpenses; }
  override get branchLocked(): boolean { return this.frozen; }
  override get methodLocked(): boolean { return this.frozen; }

  protected override async afterInit(isNew: boolean): Promise<void> {
    await super.afterInit(isNew);
    if (isNew && !this.rec.startDate) this.rec.startDate = ymd(new Date());
    if (this.rec.endTerm === 'by' && !this.rec.endDate) this.rec.endDate = this.rec.startDate;
  }

  /** "Actions" dropdown of a saved profile - items and rules come from the shared {@link RecurringExpenseActions}. */
  override actionsMenu(): DropdownMenuBtnItem[] {
    if (this.formStatus !== 'edit' || !this.rec.id) return [];
    return this.recActions.menu(this.rec, this.rec.id, () => { this.dirty = false; this.form.markAsPristine(); this.afterSaveRoute(); });
  }

  // ── validation ─────────────────────────────────────────────────────
  get nameInvalid(): boolean { return !this.rec.name?.trim(); }
  private get headerIssues(): string[] {
    const out: string[] = [];
    if (this.nameInvalid) out.push('RECURRING_EXPENSES.REQUIRED.NAME');
    if (!this.rec.startDate) out.push('RECURRING_EXPENSES.REQUIRED.START_DATE');
    if (this.rec.endTerm === 'by' && !this.rec.endDate) out.push('RECURRING_EXPENSES.REQUIRED.END_DATE');
    return out;
  }
  override get missing(): string[] { return [...this.headerIssues, ...super.missing]; }
  override get missingDraft(): string[] { return this.missing; }

  protected override blockSave(): string | null {
    const r = this.rec;
    if (r.endTerm === 'by' && r.endDate && r.endDate < r.startDate) return this.lang.instant('RECURRING_EXPENSES.FORM.END_BEFORE_START');
    return super.blockSave();
  }

  // ── save ───────────────────────────────────────────────────────────
  /** The `saveRecurringExpense` body: schedule header + the expense template. */
  private payload(d: Expense): any {
    const r = this.rec;
    return {
      id: r.id ?? '',
      name: r.name.trim(),
      type: r.type,
      branchId: d.branchId,
      supplierId: d.supplierId || null,
      customerId: d.customerId || null,
      paymentMethodId: d.paymentMethodId || null,
      startDate: r.startDate,
      endTerm: r.endTerm,
      endDate: r.endTerm === 'by' ? r.endDate : null,
      repeatData: { periodicity: r.repeatData.periodicity, periodQty: Number(r.repeatData.periodQty) || 1, on: Number(r.repeatData.on) || 1 },
      expenseCreatedBefore: r.expenseCreatedBefore ?? 0,
      transactionDetails: this.expenses.toPayload(d),
    };
  }
}
