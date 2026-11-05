import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ParamDef, QueryParamsService } from '@shared/services/query-params.service';
import type { DocRailFilterOption } from '../../../components/doc-rail-filter/doc-rail-filter.component';
import * as XLSX from 'xlsx';

import { downloadPdf, printPdf } from '@core/utils/pdf-download';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { MappedImportWizardComponent } from '@shared/components/mapped-import-wizard/mapped-import-wizard.component';
import { MappedImportConfig, MappedImportPreview } from '@shared/components/mapped-import-wizard/mapped-import.types';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import { Estimate } from '../../../models/estimate.model';
import { DocRailBulkAction, DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../services/document-view-base';
import { DOC_RAIL_ICONS, docSortMenu } from '../../../services/doc-rail-menu';
import { DocExportModalComponent, DocExportData } from '../../../components/doc-export-modal/doc-export-modal.component';
import { SendDocumentData, SendDocumentModalComponent } from '../../../components/send-document-modal/send-document-modal.component';
import { DocViewSkeletonComponent } from '../../../components/doc-view-skeleton/doc-view-skeleton.component';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import { EstimatesService } from '../../services/estimates.service';
import { EstimateActions } from '../../services/estimate-actions';
import { estimateToRenderData } from '../../services/estimate-render-data';
import { buildEstimateImportConfig } from '../../services/estimate-import.config';
import { PartyPeekChipsComponent } from '../../../components/party-peek-chips/party-peek-chips.component';

/** `rstatus` — the rail's status filter, persisted the same way `rpage`/`rq` are in {@link DocumentViewBase}. */
const RAIL_STATUS_PARAM: ParamDef<string | null> = {
  key: 'rstatus',
  codec: { encode: v => v || null, decode: r => r || null },
};

/**
 * Estimates → view (`/account/estimate/view/:id`). Legacy `EstimateViewComponent`: the estimate
 * rendered through the default estimate template, plus print / PDF / share, edit, clone, convert
 * to invoice and delete. Button rules come from the shared {@link EstimateActions}.
 */
@Component({
  selector: 'app-estimate-view',
  standalone: true,
  imports: [PartyPeekChipsComponent, CommonModule, TranslateModule, DocViewShellComponent, DocViewSkeletonComponent],
  providers: [MycurrencyPipe],
  templateUrl: './estimate-view.component.html',
  // See invoice-view.component.ts — `display: contents` keeps the fixed-height chain from
  // `.main-content.no-padding` down to `app-doc-view-shell` intact.
  styles: [':host { display: contents; }'],
})
export class EstimateViewComponent extends DocumentViewBase {
  private estimates = inject(EstimatesService);
  private currency = inject(MycurrencyPipe);
  private queryParams = inject(QueryParamsService);
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

  railStatus = signal<string | null>(null);
  railSort = signal<{ value: string; direction: 'ASC' | 'DESC' }>({ value: 'estimateDateThenTime', direction: 'DESC' });

  protected toRenderData(e: Estimate): DocumentRenderData { return estimateToRenderData(e); }
  protected override async onInit(): Promise<void> {
    this.railStatus.set(this.queryParams.read({ status: RAIL_STATUS_PARAM }).status);
    this.initRail(
      (term, page) => this.estimates.getEstimateList({
        page, limit: this.railPageSize, searchTerm: term,
        sortBy: { sortValue: this.railSort().value, sortDirection: this.railSort().direction },
        filter: { status: this.railStatus() ? [this.railStatus()] : [] },
      }).then(d => ({ list: d?.list ?? [], pageCount: d?.pageCount ?? 1 })),
      (r: any) => this.mapRailItem(r),
    );
  }

  /** Status filter behind the rail's title (re-fetches page 1 on change). */
  readonly railStatusOptions = ['Open', 'Converted'];
  railFilterOptions(): DocRailFilterOption[] {
    return [
      { value: null, label: this.t('ESTIMATES.LIST.ALL_ESTIMATES') },
      ...this.railStatusOptions.map(s => ({ value: s, label: this.t('ESTIMATES.STATUS.' + s) })),
    ];
  }
  onRailFilterPick(status: string | null): void {
    this.railStatus.set(status);
    this.queryParams.writeOne(RAIL_STATUS_PARAM, status);
    void this.loadRail(1);
  }

  /** Fields the backend can sort estimates by (`estimate.repo.ts` `columnMap`). */
  private readonly SORT_FIELDS: { value: string; labelKey: string }[] = [
    { value: 'estimateDateThenTime', labelKey: 'ESTIMATES.LIST.ISSUE_DATE' },
    { value: 'createdAt', labelKey: 'ESTIMATES.CREATED_DATE' },
    { value: 'estimateNumber', labelKey: 'ESTIMATES.LIST.ESTIMATE_NUMBER' },
    { value: 'estimateExpDate', labelKey: 'ESTIMATES.LIST.EXPIRY_DATE' },
    { value: 'total', labelKey: 'ESTIMATES.LIST.TOTAL' },
  ];

  /** Rail "⋯": Sort by / Import / Export (dialog or the current rail page) / Refresh — same entries and icons as the invoices rail. */
  railMoreItems(): DropdownMenuBtnItem[] {
    const t = this.t;
    const I = DOC_RAIL_ICONS;
    return [
      docSortMenu({
        label: t('ESTIMATES.VIEW.SORT_BY'),
        fields: this.SORT_FIELDS.map(f => ({ value: f.value, label: t(f.labelKey) })),
        current: this.railSort(),
        pick: sort => { this.railSort.set(sort); void this.loadRail(1); },
      }),
      { label: t('ESTIMATES.VIEW.IMPORT_ESTIMATES'), click: () => void this.openImport(), disabled: false, danger: false, iconPath: I.import, iconViewBox: I.viewBox16 },
      {
        label: t('DOC_VIEW.EXPORT'), click: () => {}, disabled: false, danger: false, iconPath: I.export, iconViewBox: I.viewBox16,
        children: [
          { label: t('ESTIMATES.VIEW.EXPORT_ESTIMATES'), click: () => this.openExport(), disabled: false, danger: false },
          { label: t('ESTIMATES.VIEW.EXPORT_CURRENT_VIEW'), click: () => void this.exportCurrentView(), disabled: false, danger: false },
        ],
      },
      { label: t('COMMON.REFRESH'), click: () => void this.loadRail(this.railPage()), disabled: false, danger: false, separator: true, iconPath: I.refresh, iconViewBox: I.viewBox16 },
    ];
  }

  /** "Export Current View": just the estimates on the rail's current page, as an Excel file. */
  async exportCurrentView(): Promise<void> {
    const data = await this.estimates.getEstimateList({
      page: this.railPage(), limit: this.railPageSize, searchTerm: '',
      sortBy: { sortValue: this.railSort().value, sortDirection: this.railSort().direction },
      filter: { status: this.railStatus() ? [this.railStatus()] : [] },
    });
    const t = this.t;
    const rows = (data?.list ?? []).map((r: any) => ({
      [t('ESTIMATES.LIST.ESTIMATE_NUMBER')]: r.estimateNumber,
      [t('ESTIMATES.LIST.CUSTOMER_NAME')]: r.customerName,
      [t('ESTIMATES.LIST.TOTAL')]: r.total,
      [t('ESTIMATES.LIST.ISSUE_DATE')]: String(r.estimateDate ?? '').slice(0, 10),
      [t('ESTIMATES.LIST.EXPIRY_DATE')]: String(r.estimateExpDate ?? '').slice(0, 10),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Estimates');
    XLSX.writeFile(wb, `estimates-page-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /** "Export Estimates" — the date range / format dialog shared with the invoices. */
  openExport(): void {
    this.modal.open<DocExportModalComponent, DocExportData, boolean>(DocExportModalComponent, {
      size: 'md',
      data: {
        moduleLabel: this.t('ESTIMATES.RECORDS'),
        statuses: this.railStatusOptions.map(s => ({ value: s, label: this.t('ESTIMATES.STATUS.' + s) })),
        status: this.railStatus(),
        fileStem: 'estimates',
        fetchPage: (filter, page, limit) => this.estimates.getEstimateList({ page, limit, searchTerm: '', sortBy: {}, filter }),
        toRow: (r, { pii, amount }) => {
          const t = (k: string) => this.t(k);
          const row: Record<string, string | number> = {
            [t('ESTIMATES.LIST.ESTIMATE_NUMBER')]: r.estimateNumber ?? '',
            [t('ESTIMATES.LIST.ISSUE_DATE')]: String(r.estimateDate ?? '').slice(0, 10),
            [t('ESTIMATES.LIST.EXPIRY_DATE')]: String(r.estimateExpDate ?? '').slice(0, 10),
            [t('ESTIMATES.LIST.REF')]: r.refrenceNumber ?? '',
            [t('ESTIMATES.LIST.INVOICE_NUMBER')]: r.invoiceNumber ?? '',
            [t('ESTIMATES.LIST.TOTAL')]: amount(r.total),
          };
          if (pii) {
            row[t('ESTIMATES.LIST.CUSTOMER_NAME')] = r.customerName ?? '';
            row[t('ESTIMATES.LIST.CUSTOMER_PHONE')] = r.customerContact ?? '';
          }
          return row;
        },
      },
    });
  }

  /** Bulk "Import Estimates" — the Configure → Map Fields → Preview wizard; refreshes the rail once something was imported. */
  async openImport(): Promise<void> {
    const config = buildEstimateImportConfig({ service: this.estimates, branchId: this.doc()?.branchId ?? '' });
    const res = await this.modal.open<MappedImportWizardComponent, MappedImportConfig, MappedImportPreview | undefined>(
      MappedImportWizardComponent, { size: 'lg', data: config, closeOnBackdrop: false },
    ).afterClosed();
    if (res?.imported) void this.loadRail(1);
  }

  /** Actions on the ticked rail rows: merged PDF, one email for all, print, delete (only with the privilege, skipping converted / POS / online estimates). */
  railBulkActions(): DocRailBulkAction[] {
    const t = this.t;
    const out: DocRailBulkAction[] = [
      { id: 'pdf', label: t('ESTIMATES.ACTIONS.EXPORT_MERGED_PDF'), run: (items) => this.bulkPdf(items, false) },
      { id: 'email', label: t('ESTIMATES.ACTIONS.SEND_EMAIL'), run: (items) => this.bulkEmail(items) },
    ];
    if (this.actions.canPrint) out.push({ id: 'print', label: t('COMMON.PRINT'), run: (items) => this.bulkPdf(items, true) });
    if (this.actions.canDeletePrivilege) out.push({ id: 'delete', label: t('COMMON.DELETE'), danger: true, separator: true, run: (items) => this.bulkDelete(items) });
    return out;
  }

  private async bulkPdf(items: DocRailItem[], print: boolean): Promise<void> {
    const pdf = await this.estimates.viewMergedEstimatesPdf(items.map((i) => i.id));
    if (!pdf) { this.toast.error('COMMON.OPS', ''); return; }
    if (!print) { downloadPdf(pdf, 'estimates.pdf'); return; }
    printPdf(pdf);
  }

  /** One email request for the ticked estimates (recipient typed manually — they may span customers). */
  private async bulkEmail(items: DocRailItem[]): Promise<void> {
    await this.modal.open<SendDocumentModalComponent, SendDocumentData, boolean>(SendDocumentModalComponent, {
      size: 'md',
      data: { emails: [], sendEmail: (payload) => this.estimates.sendEstimateEmail({ ...payload, estimateIds: items.map((i) => i.id) }) },
    }).afterClosed();
  }

  private async bulkDelete(items: DocRailItem[]): Promise<void> {
    const deletable = items.filter((i) => i.data && this.actions.delete(i.data));
    if (!deletable.length) { this.toast.error('COMMON.OPS', this.t('ESTIMATES.ACTIONS.BULK_DELETE_NONE')); return; }
    const skipped = items.length - deletable.length;
    const message = this.t('ESTIMATES.ACTIONS.BULK_DELETE_CONFIRM').replace('{{count}}', String(deletable.length))
      + (skipped ? ' ' + this.t('ESTIMATES.ACTIONS.BULK_DELETE_SKIPPED').replace('{{count}}', String(skipped)) : '');
    if (!(await this.confirm(this.t('COMMON.DELETE'), message, true))) return;
    let done = 0;
    for (const i of deletable) {
      try { await this.estimates.deleteEstimate(i.id); done++; } catch { /* reported in the summary below */ }
    }
    if (done) this.toast.success(this.t('ESTIMATES.ACTIONS.BULK_DELETED').replace('{{count}}', String(done)));
    if (done < deletable.length) this.toast.error('COMMON.OPS', this.t('ESTIMATES.ACTIONS.BULK_DELETE_FAILED').replace('{{count}}', String(deletable.length - done)));
    if (deletable.some((i) => i.id === this.id)) { this.goToList(); return; }
    void this.loadRail(this.railPage());
  }

  private mapRailItem(r: any): DocRailItem {
    return {
      id: r.id,
      primary: r.customerName,
      amountLabel: this.currency.transform(r.total),
      sub: `${r.estimateNumber} · ${new Date(r.estimateDate).toLocaleDateString()}`,
      data: r,
      badgeText: r.invoiceId ? this.t('ESTIMATES.LIST.CONVERTED') : undefined,
      badgeKind: r.invoiceId ? 'neutral' : undefined,
    };
  }

  actionItems(e: Estimate): DropdownMenuBtnItem[] { return this.actions.menu(e, this.id, () => this.goToList()); }

  goToInvoice(id: string): void { void this.router.navigate(['/account/invoices/view', id]); }
}
