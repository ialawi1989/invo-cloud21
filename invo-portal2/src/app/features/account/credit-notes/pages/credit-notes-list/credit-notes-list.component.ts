import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { DocumentListBase, DocListMeta } from '../../../services/document-list-base';
import { CreditNotesService } from '../../services/credit-notes.service';
import { CreditNoteActions } from '../../services/credit-note-actions';

/**
 * Credit notes → list. Legacy `CreditNotesComponent`: same columns, server-side search / sort / paging and
 * the same filter payload (`sources`, `branches`, dates). Row actions follow the shared
 * {@link CreditNoteActions}: View outside, the rest in the "⋯" menu.
 */
@Component({
  selector: 'app-credit-notes-list',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe],
  templateUrl: './credit-notes-list.component.html',
})
export class CreditNotesListComponent extends DocumentListBase implements OnInit {
  private service = inject(CreditNotesService);
  readonly actions = inject(CreditNoteActions);

  readonly meta: DocListMeta = {
    features: ['account/credit-notes'],
    logsSource: 'CreditNotes',
    sheet: 'Credit Notes',
    filePrefix: 'credit-notes',
    dateKeys: ['creditNoteDate', 'createdAt'],
    hasStatus: false,
    listTitleKey: 'CREDIT_NOTES.LIST.CREDIT_NOTES_LIST',
    dashboardCrumbKey: 'CREDIT_NOTES.DASHBOARD',
  };

  protected fetch = (body: any) => this.service.getCreditNoteList(body);

  async ngOnInit(): Promise<void> {
    await Promise.all([this.initBase(), this.actions.refresh()]);
    const t = this.t;
    const L = 'CREDIT_NOTES.LIST.';

    this.columns = [
      { key: 'creditNoteNumber', label: t(L + 'CREDIT_NOTE_NUMBER'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'invoiceNumber', label: t(L + 'INVOICE_NUMBER'), customTemplate: true, visible: true, order: 1 },
      { key: 'employeeName', label: t(L + 'EMPLOYEE_NAME'), sortable: true, visible: true, order: 2 },
      { key: 'customerName', label: t(L + 'CUSTOMER_NAME'), visible: true, order: 3 },
      { key: 'total', label: t(L + 'TOTAL'), customTemplate: true, align: 'end', visible: true, order: 4 },
      { key: 'branchName', label: t(L + 'BRANCH_NAME'), visible: true, order: 5 },
      { key: 'creditNoteDate', label: t(L + 'ISSUE_DATE'), customTemplate: true, visible: true, order: 6 },
      { key: 'createdAt', label: t('CREDIT_NOTES.CREATED_DATE'), sortable: true, customTemplate: true, visible: true, order: 7 },
    ];

    this.filters = [
      { type: 'checkbox-group', key: 'sources', label: t('CREDIT_NOTES.FILTERS.SOURCE'), options: ['POS', 'Cloud'].map(v => ({ value: v, label: v })) },
      { type: 'dropdown', key: 'branches', label: t('CREDIT_NOTES.FILTERS.BRANCH'), multiple: true, loadFn: p => this.loadBranches(p) },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('CREDIT_NOTES.FILTERS.DATE') },
    ];

    this.moreItems = [
      { label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false },
      { label: t('CREDIT_NOTES.ACTIONS.EXPORT_EXCEL'), click: () => void this.exportExcel(), disabled: false, danger: false },
    ];

    this.searchConfig.placeholder = t('CREDIT_NOTES.SEARCH_PLACEHOLDER');
    // Legacy: a search with no date filter looks at the last 3 months only (shown as a removable filter).
    this.searchConfig.defaultDateRange = { keyFrom: 'fromDate', keyTo: 'toDate' };
    this.emptyState = { title: t('CREDIT_NOTES.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t(this.meta.dashboardCrumbKey), routerLink: '/dashboard' },
      { label: t(this.meta.listTitleKey) },
    ];
  }

  /** Everything beyond View lives in the "⋯" menu — items and rules come from the shared actions. */
  rowMenu(r: any): DropdownMenuBtnItem[] { return this.actions.menu(r, r.id, () => this.listPage?.refresh?.()); }

  /** Credit note usage badge: fully / partly refunded-or-applied (legacy list badges). */
  usage(r: any): 'full' | 'partial' | null {
    const used = (r.refundedAmount ?? 0) + (r.appliedAmount ?? 0);
    if (used <= 0) return null;
    return (r.remainingCredit ?? 0) > 0 ? 'partial' : 'full';
  }

  add(): void { void this.router.navigate(['/account/credit-notes', 'new']); }
  view(r: any): void { void this.router.navigate(['/account/credit-notes/view', r.id]); }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }
}
