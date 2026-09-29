import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import { Estimate } from '../../../models/estimate.model';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../services/document-view-base';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import { EstimatesService } from '../../services/estimates.service';
import { EstimateActions } from '../../services/estimate-actions';
import { estimateToRenderData } from '../../services/estimate-render-data';

/**
 * Estimates → view (`/account/estimate/view/:id`). Legacy `EstimateViewComponent`: the estimate
 * rendered through the default estimate template, plus print / PDF / share, edit, clone, convert
 * to invoice and delete. Button rules come from the shared {@link EstimateActions}.
 */
@Component({
  selector: 'app-estimate-view',
  standalone: true,
  imports: [CommonModule, TranslateModule, DocViewShellComponent],
  providers: [MycurrencyPipe],
  templateUrl: './estimate-view.component.html',
  // See invoice-view.component.ts — `display: contents` keeps the fixed-height chain from
  // `.main-content.no-padding` down to `app-doc-view-shell` intact.
  styles: [':host { display: contents; }'],
})
export class EstimateViewComponent extends DocumentViewBase {
  private estimates = inject(EstimatesService);
  private currency = inject(MycurrencyPipe);
  readonly actions = inject(EstimateActions);

  readonly cfg: DocViewConfig = {
    features: ['account/estimates'],
    routeBase: '/account/estimate',
    templateType: 'estimate',
    zoomKey: 'estimateZoomLevel',
    numberField: 'estimateNumber',
    whatsappType: 'estimate',
    filePrefix: 'estimate',
    titleKey: 'ESTIMATES.FORM.ESTIMATE',
    dashboardCrumbKey: 'ESTIMATES.DASHBOARD',
    listCrumbKey: 'ESTIMATES.LIST.ESTIMATES_LIST',
    viewCrumbKey: 'ESTIMATES.VIEW.VIEW_ESTIMATE',
  };

  protected svc: DocViewService = {
    get: id => this.estimates.getEstimate(id),
    pdf: id => this.estimates.viewEstimatePdf(id),
    sendEmail: (payload, id) => this.estimates.sendEstimateEmail({ ...payload, estimateId: id }),
  };

  protected toRenderData(e: Estimate): DocumentRenderData { return estimateToRenderData(e); }
  protected override async onInit(): Promise<void> {
    this.initRail(
      (term, page) => this.estimates.getEstimateList({ page, limit: this.railPageSize, searchTerm: term, sortBy: {}, filter: {} })
        .then(d => ({ list: d?.list ?? [], pageCount: d?.pageCount ?? 1 })),
      (r: any) => this.mapRailItem(r),
    );
  }

  private mapRailItem(r: any): DocRailItem {
    return {
      id: r.id,
      primary: r.customerName,
      amountLabel: this.currency.transform(r.total),
      sub: `${r.estimateNumber} · ${new Date(r.estimateDate).toLocaleDateString()}`,
      badgeText: r.invoiceId ? this.t('ESTIMATES.LIST.CONVERTED') : undefined,
      badgeKind: r.invoiceId ? 'neutral' : undefined,
    };
  }

  actionItems(e: Estimate): DropdownMenuBtnItem[] {
    const t = this.t;
    const items: DropdownMenuBtnItem[] = [];
    if (this.actions.clone(e)) items.push({ label: t('ESTIMATES.ACTIONS.CLONE'), click: () => this.clone(), disabled: false, danger: false });
    if (this.actions.convert(e)) items.push({ label: t('ESTIMATES.ACTIONS.CONVERT_TO_INVOICE'), click: () => this.convert(), disabled: false, danger: false });
    if (this.actions.delete(e)) items.push({ label: t('COMMON.DELETE'), click: () => void this.remove(), disabled: false, danger: true });
    return items;
  }

  convert(): void { void this.router.navigate(['/account/invoices/convertFromEstimate', this.id]); }
  goToInvoice(id: string): void { void this.router.navigate(['/account/invoices/view', id]); }

  async remove(): Promise<void> {
    if (!(await this.confirm(this.t('COMMON.DELETE'), this.t('ESTIMATES.VIEW.CONFIRM_DELETE'), true))) return;
    await this.run(() => this.estimates.deleteEstimate(this.doc()!.id), () => this.goToList());
  }
}
