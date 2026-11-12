import { railKind } from '@shared/utils/status-tone';
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ParamDef, QueryParamsService } from '@shared/services/query-params.service';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import { PurchaseOrder, PurchaseOrderLine } from '../../../models/purchase-order.model';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../services/document-view-base';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import type { DocRailFilterOption } from '../../../components/doc-rail-filter/doc-rail-filter.component';
import { SuppliersService } from '../../../suppliers/services/suppliers.service';
import { PurchaseOrdersService } from '../../services/purchase-orders.service';
import { PurchaseOrderActions } from '../../services/purchase-order-actions';
import { purchaseOrderToRenderData } from '../../services/purchase-order-render-data';
import { PartyPeekChipsComponent } from '../../../components/party-peek-chips/party-peek-chips.component';


/** `rstatus` — the rail's status filter, persisted like `rpage`/`rq` are in {@link DocumentViewBase}. */
const RAIL_STATUS_PARAM: ParamDef<string | null> = {
  key: 'rstatus',
  codec: { encode: v => v || null, decode: r => r || null },
};

/**
 * Purchase orders -> view (`/account/purchase-order/view/:id`). Legacy `PurchaseOrderViewComponent`: the order
 * rendered through the default purchase-order template, plus print / PDF / share, edit, export lines, convert
 * to bill and delete. Button rules come from the shared {@link PurchaseOrderActions}.
 */
@Component({
  selector: 'app-purchase-order-view',
  standalone: true,
  imports: [PartyPeekChipsComponent, CommonModule, TranslateModule, DocViewShellComponent],
  providers: [MycurrencyPipe],
  templateUrl: './purchase-order-view.component.html',
  // See invoice-view.component.ts - `display: contents` keeps the fixed-height chain from
  // `.main-content.no-padding` down to `app-doc-view-shell` intact.
  styles: [':host { display: contents; }'],
})
export class PurchaseOrderViewComponent extends DocumentViewBase {
  private orders = inject(PurchaseOrdersService);
  private suppliers = inject(SuppliersService);
  private currency = inject(MycurrencyPipe);
  private queryParams = inject(QueryParamsService);
  readonly actions = inject(PurchaseOrderActions);

  readonly cfg: DocViewConfig = {
    features: ['account/purchase-orders'],
    routeBase: '/account/purchase-order',
    templateType: 'purchase-order',
    zoomKey: 'purchaseOrderZoomLevel',
    numberField: 'purchaseNumber',
    whatsappType: 'PO',
    filePrefix: 'purchase-order',
    partyFields: ['supplierName'],
    titleKey: 'PURCHASE_ORDERS.FORM.PURCHASE_ORDER',
    dashboardCrumbKey: 'PURCHASE_ORDERS.DASHBOARD',
    listCrumbKey: 'PURCHASE_ORDERS.LIST.PURCHASE_ORDER_LIST',
    viewCrumbKey: 'PURCHASE_ORDERS.VIEW.VIEW_PURCHASE_ORDER',
  };

  protected svc: DocViewService = {
    get: id => this.load1(id),
    pdf: id => this.orders.viewPurchaseOrderPdf(id),
    sendEmail: (payload, id) => this.orders.sendPurchaseOrderEmail({ ...payload, purchaseOrderId: id }),
  };

  /** The order plus its supplier's phone / address, which the document paper prints but the order record doesn't carry. */
  private async load1(id: string): Promise<PurchaseOrder> {
    const po = await this.orders.getPurchaseOrder(id);
    if (po.id && po.supplierId) {
      try {
        const s = await this.suppliers.getSupplier(po.supplierId);
        po.supplierPhone = s.phone;
        po.supplierAddress = s.address;
        po.supplierEmail = po.supplierEmail || s.email;
      } catch { /* the paper simply leaves the supplier contact lines empty */ }
    }
    return po;
  }

  protected toRenderData(po: PurchaseOrder): DocumentRenderData { return purchaseOrderToRenderData(po); }

  protected override recipient(po: PurchaseOrder) { return { emails: po.supplierEmail ? [po.supplierEmail] : [], phone: po.supplierPhone }; }

  protected override exportRows(po: PurchaseOrder): Record<string, any>[] {
    return (po.lines as PurchaseOrderLine[]).map(l => ({
      ProductName: l.selectedItem?.name || l.note || '',
      Barcode: l.barcode || l.selectedItem?.barcode || '',
      Quantity: l.qty || 0,
      UnitCost: l.unitCost || 0,
      SIC: l.SIC || '',
    }));
  }

  railStatus = signal<string | null>(null);
  /** Real statuses of a purchase order (how much of it has been converted to bills). */
  readonly railStatusOptions: { value: string; key: string }[] = [
    { value: 'Not Converted', key: 'STATUS_NOT_CONVERTED' },
    { value: 'Partially Converted', key: 'STATUS_PARTIALLY_CONVERTED' },
    { value: 'Fully Converted', key: 'STATUS_FULLY_CONVERTED' },
  ];

  /** Status filter behind the rail's title (re-fetches page 1 on change). Favorites save to `EmployeeOptions`. */
  railFilterOptions(): DocRailFilterOption[] {
    return [
      { value: null, label: this.t('PURCHASE_ORDERS.LIST.ALL_PURCHASE_ORDERS') },
      ...this.railStatusOptions.map(o => ({ value: o.value, label: this.t('PURCHASE_ORDERS.LIST.' + o.key) })),
    ];
  }
  onRailFilterPick(status: string | null): void {
    this.railStatus.set(status);
    this.queryParams.writeOne(RAIL_STATUS_PARAM, status);
    void this.loadRail(1);
  }

  protected override async onInit(): Promise<void> {
    this.railStatus.set(this.queryParams.read({ status: RAIL_STATUS_PARAM }).status);
    this.initRail(
      (term, page) => this.orders.getPurchaseList({ page, limit: this.railPageSize, searchTerm: term, sortBy: {}, filter: { status: this.railStatus() ? [this.railStatus()] : [] } })
        .then(d => ({ list: d?.list ?? [], pageCount: d?.pageCount ?? 1 })),
      (r: any) => this.mapRailItem(r),
    );
  }

  private mapRailItem(r: any): DocRailItem {
    return {
      id: r.id,
      primary: r.supplierName,
      amountLabel: this.currency.transform(r.total),
      sub: `${r.purchaseNumber} · ${new Date(r.purchaseDate).toLocaleDateString()}`,
      statusText: r.status || undefined,
      statusKind: railKind(r.status),
    };
  }

  actionItems(po: PurchaseOrder): DropdownMenuBtnItem[] { return this.actions.menu(po, this.id, () => this.goToList()); }
}
