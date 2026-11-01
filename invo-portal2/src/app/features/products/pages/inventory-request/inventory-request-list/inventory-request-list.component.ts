import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import { ListQueryParams, MobileCardConfig, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';

import { SalesLookupsService } from '../../../../account/services/sales-lookups.service';
import { InventoryRequest, InventoryRequestService } from '../../../services/inventory-request.service';
import { ExportRequestsModalComponent, ExportRequestsData } from '../export-requests-modal/export-requests-modal.component';

/**
 * Inventory requests → list (`/inventory/request`). Ported from InvoCloudFront2's
 * `inventory-request.component`: Branch / Created at / Employee / Status / Purchase Orders /
 * Transfer Orders columns, server-side search + sort + paging (URL-synced by the shared
 * `<app-list-page>`), and the same row actions (View, Edit + Delete while not Converted,
 * Export, and a "⋯" menu with Convert to Purchase Order / Convert to Inventory Transfer Out).
 */
@Component({
  selector: 'app-inventory-request-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, TranslateModule, ListPageComponent, ListCellTemplateDirective,
    ListRowActionsDirective, DropdownMenuBtnComponent,
  ],
  templateUrl: './inventory-request-list.component.html',
  styleUrl: './inventory-request-list.component.scss',
})
export class InventoryRequestListComponent implements OnInit {
  private service = inject(InventoryRequestService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private lookups = inject(SalesLookupsService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  readonly canAdd = this.privileges.check('productSecurity.actions.requestInventoryAdd.access');
  readonly canConvertPo = this.privileges.check('purchaseOrderSecurity.actions.convert.access');

  /** Convert-to-Transfer-Out is only offered when the company has more than one branch (legacy). */
  private branchCount = signal(0);

  columns: TableColumn[] = [];
  breadcrumbs = [
    { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
    { label: '', routerLink: '/inventory/request' },
  ];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('products');
    const t = (k: string) => this.lang.instant('PRODUCTS.INVENTORY_REQUEST.' + k);
    this.columns = [
      { key: 'branchName', label: t('COL_BRANCH'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'createdAt', label: t('COL_CREATED_AT'), sortable: true, customTemplate: true, visible: true, order: 1 },
      { key: 'employeeName', label: t('COL_EMPLOYEE'), sortable: true, visible: true, order: 2 },
      { key: 'status', label: t('COL_STATUS'), sortable: true, customTemplate: true, visible: true, order: 3 },
      { key: 'purchaseOrders', label: t('COL_PURCHASE_ORDERS'), sortable: true, customTemplate: true, visible: true, order: 4 },
      { key: 'transferOrders', label: t('COL_TRANSFER_ORDERS'), sortable: true, customTemplate: true, visible: true, order: 5 },
    ];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
      { label: t('TITLE'), routerLink: '/inventory/request' },
    ];
    this.searchConfig.placeholder = t('SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('EMPTY'), message: '' };
    void this.lookups.getBranches().then((b) => this.branchCount.set(b.length)).catch(() => undefined);
  }

  load = async (params: ListQueryParams) => {
    const data = await this.service.getList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy
        ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
        : {},
    });
    return { list: data.list, count: data.count, pageCount: data.pageCount };
  };

  isConverted = (r: InventoryRequest) => r.status === 'Converted';

  statusClass(status: string): string {
    switch (status) {
      case 'Converted': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Open': return 'bg-sky-50 text-sky-700 border-sky-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  }

  rowMenu(r: InventoryRequest): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [];
    if (this.isConverted(r)) return items;
    const t = (k: string) => this.lang.instant('PRODUCTS.INVENTORY_REQUEST.' + k);
    if (r.hasSupplier && this.canConvertPo) {
      items.push({ label: t('CONVERT_TO_PO'), click: () => this.convertToPo(r), disabled: false, danger: false });
    }
    if (r.branchName !== '' && this.branchCount() > 1) {
      items.push({ label: t('CONVERT_TO_ITO'), click: () => this.convertToIto(r), disabled: false, danger: false });
    }
    return items;
  }

  add(): void { void this.router.navigate(['/inventory/request', 'new']); }
  view(r: InventoryRequest): void { void this.router.navigate(['/inventory/request', r.id, 'view']); }
  edit(r: InventoryRequest): void { void this.router.navigate(['/inventory/request', r.id]); }
  convertToPo(r: InventoryRequest): void { void this.router.navigate(['/inventory/request/convert-to-purchase-order', r.id]); }
  convertToIto(r: InventoryRequest): void {
    void this.router.navigate(['/inventory/transfer/Transfer Out/convert-from-inventory-request', r.id]);
  }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }

  export(r: InventoryRequest): void {
    this.modal.open<ExportRequestsModalComponent, ExportRequestsData, void>(ExportRequestsModalComponent, {
      size: 'sm',
      data: { id: r.id },
    });
  }

  async remove(r: InventoryRequest): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.lang.instant('COMMON.DELETE'),
        message: this.lang.instant('PRODUCTS.INVENTORY_REQUEST.CONFIRM_DELETE'),
        danger: true,
      },
    }).afterClosed();
    if (!ok) return;
    try {
      const res = await this.service.delete(r.id);
      if (res?.success) {
        this.toast.success('COMMON.DELETED_OK');
        this.listPage?.refresh();
      } else {
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' ? res.msg : '');
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    }
  }
}
