import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { statusClass } from '@shared/utils/status-tone';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { DocumentListBase, DocListMeta } from '../../../services/document-list-base';
import { PurchaseOrdersService } from '../../services/purchase-orders.service';
import { PurchaseOrderActions } from '../../services/purchase-order-actions';

/** Status pill colours (the server sets `Not Converted` / `Partially Converted` / `Fully Converted`). */
/**
 * Purchase orders -> list. Legacy `PurchaseOrderComponent`: same columns, server-side search / sort / paging
 * and the same filter payload (branches, dates). Row actions follow the shared {@link PurchaseOrderActions}
 * rules: View + Edit outside, Convert to Bill / Delete in the "⋯" menu.
 */
@Component({
  selector: 'app-purchase-orders-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe],
  templateUrl: './purchase-orders-list.component.html',
})
export class PurchaseOrdersListComponent extends DocumentListBase implements OnInit {
  private service = inject(PurchaseOrdersService);
  readonly actions = inject(PurchaseOrderActions);

  readonly meta: DocListMeta = {
    features: ['account/purchase-orders'],
    logsSource: 'PurchaseOrders',
    sheet: 'Purchase Orders',
    filePrefix: 'purchase-orders',
    dateKeys: ['purchaseDate', 'dueDate', 'createdAt'],
    hasStatus: false,
    listTitleKey: 'PURCHASE_ORDERS.LIST.PURCHASE_ORDER_LIST',
    dashboardCrumbKey: 'PURCHASE_ORDERS.DASHBOARD',
  };

  protected fetch = (body: any) => this.service.getPurchaseList(body);

  async ngOnInit(): Promise<void> {
    await this.initBase();
    const t = this.t;
    const L = 'PURCHASE_ORDERS.LIST.';

    this.columns = [
      { key: 'purchaseNumber', label: t(L + 'PURCHASE_NUMBER'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'supplierName', label: t(L + 'SUPPLIER_NAME'), sortable: true, visible: true, order: 1 },
      { key: 'employeeName', label: t(L + 'EMPLOYEE_NAME'), visible: true, order: 2 },
      { key: 'total', label: t(L + 'TOTAL'), customTemplate: true, sortable: true, align: 'end', visible: true, order: 3 },
      { key: 'status', label: t(L + 'STATUS'), customTemplate: true, visible: true, order: 4 },
      { key: 'billingNumber', label: t(L + 'BILL_NUMBER'), customTemplate: true, visible: true, order: 5 },
      { key: 'branchName', label: t(L + 'BRANCH_NAME'), visible: true, order: 6 },
      { key: 'purchaseDate', label: t(L + 'ISSUE_DATE'), customTemplate: true, sortable: true, visible: true, order: 7 },
      { key: 'dueDate', label: t(L + 'EXPIRY_DATE'), customTemplate: true, visible: true, order: 8 },
      { key: 'createdAt', label: t('PURCHASE_ORDERS.CREATED_DATE'), customTemplate: true, visible: false, order: 9 },
    ];

    this.filters = [
      { type: 'dropdown', key: 'branches', label: t('PURCHASE_ORDERS.FILTERS.BRANCH'), multiple: true, loadFn: p => this.loadBranches(p) },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('PURCHASE_ORDERS.FILTERS.DATE') },
    ];

    this.moreItems = [
      ...(this.actions.canAuto ? [{ label: t('PURCHASE_ORDERS.ACTIONS.AUTO_PURCHASE_ORDER'), click: () => this.auto(), disabled: false, danger: false }] : []),
      { label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false },
      { label: t('PURCHASE_ORDERS.ACTIONS.EXPORT_EXCEL'), click: () => void this.exportExcel(), disabled: false, danger: false },
    ];

    this.searchConfig.placeholder = t('PURCHASE_ORDERS.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('PURCHASE_ORDERS.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t(this.meta.dashboardCrumbKey), routerLink: '/dashboard' },
      { label: t(this.meta.listTitleKey) },
    ];
  }

  statusClass = statusClass;
  /** The backend returns the bills made from the order as `[{ id, billNumber }]`. */
  bills(r: any): { id: string; billNumber: string }[] { return Array.isArray(r.billingNumber) ? r.billingNumber : []; }

  /** Secondary row actions live in the "⋯" menu (View + Edit stay outside). */
  rowMenu(r: any): DropdownMenuBtnItem[] { return this.actions.menu(r, r.id, () => this.listPage?.refresh?.()); }

  add(): void { void this.router.navigate(['/account/purchase-order', 'new']); }
  auto(): void { void this.router.navigate(['/account/purchase-order/auto-po', 'new']); }
  view(r: any): void { void this.router.navigate(['/account/purchase-order/view', r.id]); }
  edit(r: any): void { void this.router.navigate(['/account/purchase-order', r.id]); }
  openBill(id: string): void { void this.router.navigate(['/account/bills/view', id]); }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }
}
