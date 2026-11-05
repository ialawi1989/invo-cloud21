import { Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import '../../transfer-i18n';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../../account/services/document-view-base';
import { DocViewShellComponent } from '../../../../account/components/doc-view-shell/doc-view-shell.component';
import { DocViewSkeletonComponent } from '../../../../account/components/doc-view-skeleton/doc-view-skeleton.component';
import { DocAdditionalDetailsComponent } from '../../../../account/components/doc-additional-details/doc-additional-details.component';
import { DocAdditionalDetailsConfig, DocJournalResult } from '../../../../account/components/doc-additional-details/doc-additional-details.types';
import { DocJournalRow } from '../../../../account/components/doc-journal-tab/doc-journal-tab.component';
import { InventoryTransferService } from '../../services/inventory-transfer.service';
import { InventoryTransfer } from '../../models/inventory-transfer.model';
import { TransferPaperComponent } from '../../components/transfer-paper/transfer-paper.component';

/**
 * Inventory transfers -> view (`/inventory/transfer/view/:id`). Legacy `InventoryTransferViewComponent`: the transfer
 * document with print, edit (until confirmed) and, once the transfer moved stock, its journal. It has no document
 * template or server PDF, so the paper is `<app-transfer-paper>` and "Print" is the browser's own print of it.
 */
@Component({
  selector: 'app-transfer-view',
  standalone: true,
  imports: [CommonModule, TranslateModule, DocViewShellComponent, DocViewSkeletonComponent, DocAdditionalDetailsComponent, TransferPaperComponent],
  providers: [DatePipe],
  templateUrl: './transfer-view.component.html',
  host: { style: 'display: contents' },
})
export class TransferViewComponent extends DocumentViewBase {
  private transfers = inject(InventoryTransferService);
  private datePipe = inject(DatePipe);
  private privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check('inventoryTransferSecurity.actions.add.access');

  readonly cfg: DocViewConfig = {
    features: ['inventory/transfer'],
    routeBase: '/inventory/transfer',
    zoomKey: 'inventoryTransferZoomLevel',
    numberField: 'transferNumber',
    whatsappType: 'inventoryTransfer',
    filePrefix: 'inventory-transfer',
    titleKey: 'INVENTORY_TRANSFER.TRANSFER',
    dashboardCrumbKey: 'INVENTORY_TRANSFER.DASHBOARD',
    listCrumbKey: 'INVENTORY_TRANSFER.TITLE',
    viewCrumbKey: 'INVENTORY_TRANSFER.VIEW_TRANSFER',
  };

  protected svc: DocViewService = {
    get: async id => {
      const t = await this.transfers.getById(id);
      if (!t) throw new Error(this.t('INVENTORY_TRANSFER.NOT_FOUND'));
      return t;
    },
    pdf: async () => null,
    sendEmail: async () => null,
  };

  /** Never drawn - the transfer paper is the document. */
  protected toRenderData(_t: InventoryTransfer): DocumentRenderData { return {} as DocumentRenderData; }

  protected override async onInit(): Promise<void> {
    this.initRail(
      (term, page) => this.transfers.getList({ page, limit: this.railPageSize, searchTerm: term })
        .then(d => ({ list: d.list, pageCount: d.pageCount })),
      (r: any) => this.mapRailItem(r),
    );
  }

  private mapRailItem(r: any): DocRailItem {
    return {
      id: r.id,
      primary: String(r.transferNumber ?? ''),
      amountLabel: this.t('INVENTORY_TRANSFER.TYPE.' + r.type),
      sub: this.datePipe.transform(r.createdDate, 'dd/MM/yyyy') ?? '',
      statusText: this.t('INVENTORY_TRANSFER.STATUS.' + r.status),
      statusKind: r.status === 'Confirmed' ? 'paid' : 'open',
      data: r,
    };
  }

  /** Print the paper itself (the shared print rules show only `app-transfer-paper`). */
  override printItems(): DropdownMenuBtnItem[] { return []; }
  override shareItems(): DropdownMenuBtnItem[] { return []; }
  override exportItems(): DropdownMenuBtnItem[] { return []; }

  print(): void { window.print(); }

  /** A confirmed transfer has moved stock and can't be edited. */
  get canEdit(): boolean { const t: InventoryTransfer | null = this.doc(); return !!t && this.canAdd && t.status !== 'Confirmed'; }

  override edit(): void {
    const t: InventoryTransfer | null = this.doc();
    if (t) void this.router.navigate(['/inventory/transfer', t.type === 'Transfer In' ? 'in' : 'out', t.id]);
  }
  override add(): void { void this.router.navigate(['/inventory/transfer/new/in']); }

  /** Branch heading of the main journal when the transfer posted in several. */
  private journalBranch = '';

  additionalDetails(): DocAdditionalDetailsConfig {
    const t: InventoryTransfer | null = this.doc();
    // Stock only moves (and the journal only exists) once the transfer was confirmed.
    return {
      tabs: t && t.status !== 'Open' ? ['journal', 'logs'] : ['logs'],
      journalHeading: this.journalBranch || this.t('INVENTORY_TRANSFER.TRANSFER'),
      loadJournal: () => this.loadJournal(),
      logsSourceTable: 'InventoryTransfers',
      logsSourceId: this.id,
    };
  }

  private async loadJournal(): Promise<DocJournalResult> {
    const blocks = await this.transfers.getJournal(this.id);
    // One entry per branch (a transfer out posts in both): the first is the journal itself, the others headed extras.
    this.journalBranch = blocks.length > 1 ? blocks[0].branchName : '';
    return {
      rows: (blocks[0]?.journals ?? []) as DocJournalRow[],
      extras: blocks.slice(1).map(b => ({ heading: b.branchName, rows: b.journals as DocJournalRow[] })),
    };
  }
}
