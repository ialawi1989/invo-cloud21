import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { ApiService } from '@core/http/api.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import { Expense } from '../../../models/expense.model';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../services/document-view-base';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import { DocAdditionalDetailsComponent } from '../../../components/doc-additional-details/doc-additional-details.component';
import { DocAdditionalDetailsConfig, DocJournalResult } from '../../../components/doc-additional-details/doc-additional-details.types';
import { DocJournalRow } from '../../../components/doc-journal-tab/doc-journal-tab.component';
import { DocViewAttachmentsComponent } from '../../../components/doc-view-attachments/doc-view-attachments.component';
import { PartyPeekChipsComponent } from '../../../components/party-peek-chips/party-peek-chips.component';
import { ExpensesService } from '../../services/expenses.service';
import { ExpenseActions } from '../../services/expense-actions';
import { expenseToRenderData } from '../../services/expense-render-data';

/**
 * Expenses -> view (`/account/expense/view/:id`). Legacy `ExpenseViewComponent`: the expense rendered through the
 * default expense template, print / PDF / share / export, edit and the shared Actions menu (clone, delete - none
 * for a reconciled expense), attachments and the Additional Details (journal, logs). Button rules come from the
 * shared {@link ExpenseActions}.
 */
@Component({
  selector: 'app-expense-view',
  standalone: true,
  imports: [PartyPeekChipsComponent, CommonModule, TranslateModule, DocViewShellComponent, DocAdditionalDetailsComponent, DocViewAttachmentsComponent],
  providers: [MycurrencyPipe],
  templateUrl: './expense-view.component.html',
  styles: [':host { display: contents; }'],
})
export class ExpenseViewComponent extends DocumentViewBase {
  private expenses = inject(ExpensesService);
  private api = inject(ApiService);
  private currency = inject(MycurrencyPipe);
  readonly actions = inject(ExpenseActions);

  readonly cfg: DocViewConfig = {
    features: ['account/expenses'],
    routeBase: '/account/expense',
    templateType: 'expense',
    zoomKey: 'expenseZoomLevel',
    numberField: 'expenseNumber',
    whatsappType: 'expense',
    filePrefix: 'expense',
    titleKey: 'EXPENSES.FORM.EXPENSE',
    dashboardCrumbKey: 'EXPENSES.DASHBOARD',
    listCrumbKey: 'EXPENSES.LIST.EXPENSE_LIST',
    viewCrumbKey: 'EXPENSES.VIEW.VIEW_EXPENSE',
  };

  protected svc: DocViewService = {
    get: async id => { const e = await this.expenses.getExpense(id); e.calculateTotal(); return e; },
    pdf: id => this.expenses.viewExpensePdf(id),
    sendEmail: (payload, id) => this.expenses.sendExpenseEmail({ ...payload, expenseId: id }),
  };

  protected toRenderData(e: Expense): DocumentRenderData { return expenseToRenderData(e); }
  protected override recipient(e: Expense) { return { emails: e.supplierEmail ? [e.supplierEmail] : [], phone: '' }; }

  protected override exportRows(e: Expense): Record<string, any>[] {
    return e.liveLines.map(l => ({ Account: l.accountName || '', Amount: l.amount || 0, Tax: l.taxTotal || 0, Total: l.total || 0, Note: l.note || '' }));
  }

  protected override async onInit(): Promise<void> {
    await this.actions.refresh();
    this.initRail(
      (term, page) => this.expenses.getExpenseList({ page, limit: this.railPageSize, searchTerm: term, sortBy: {}, filter: {} })
        .then(d => ({ list: d?.list ?? [], pageCount: d?.pageCount ?? 1 })),
      (r: any) => this.mapRailItem(r),
    );
  }

  private mapRailItem(r: any): DocRailItem {
    return {
      id: r.id,
      primary: r.supplierName || r.customerName || r.employeeName || '',
      amountLabel: this.currency.transform(r.total),
      sub: `${r.expenseNumber} · ${new Date(r.expenseDate).toLocaleDateString()}`,
    };
  }

  protected override async afterLoad(e: Expense): Promise<void> { await this.actions.refresh(e.branchId); }

  actionItems(e: Expense): DropdownMenuBtnItem[] { return this.actions.menu(e, this.id, () => this.goToList()); }

  additionalDetails(): DocAdditionalDetailsConfig {
    return {
      tabs: ['journal', 'logs'],
      journalHeading: this.t('EXPENSES.FORM.EXPENSE'),
      loadJournal: () => this.loadJournal(this.id),
      logsSourceTable: 'Expenses',
      logsSourceId: this.id,
    };
  }

  /** The expense's journal (`accounts/getJournal/:id`), highest debit first like legacy. */
  private async loadJournal(id: string): Promise<DocJournalResult> {
    const rows: DocJournalRow[] = (await this.api.request<any>(this.api.get('accounts/getJournal/' + id)))?.data ?? [];
    rows.sort((a, b) => ((a.debit ?? 0) < (b.debit ?? 0) ? 1 : -1));
    return { rows, extras: [] };
  }
}
