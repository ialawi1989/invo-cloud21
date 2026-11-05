import { Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import { BillOfEntry, BillOfEntryLine } from '../../../models/bill-of-entry.model';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../services/document-view-base';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import { DocViewSkeletonComponent } from '../../../components/doc-view-skeleton/doc-view-skeleton.component';
import { DocAdditionalDetailsComponent } from '../../../components/doc-additional-details/doc-additional-details.component';
import { DocAdditionalDetailsConfig, DocJournalResult } from '../../../components/doc-additional-details/doc-additional-details.types';
import { DocJournalRow } from '../../../components/doc-journal-tab/doc-journal-tab.component';
import { DocViewAttachmentsComponent } from '../../../components/doc-view-attachments/doc-view-attachments.component';
import { SuppliersService } from '../../../suppliers/services/suppliers.service';
import { BillOfEntryPaperComponent } from '../../components/bill-of-entry-paper/bill-of-entry-paper.component';
import { BillOfEntryActions } from '../../services/bill-of-entry-actions';
import { BillOfEntryService } from '../../services/bill-of-entry.service';
import { PartyPeekChipsComponent } from '../../../components/party-peek-chips/party-peek-chips.component';

/**
 * Bill of entry -> view (`/account/bill-of-entry/view/:id`). Legacy `BillOfEntryViewComponent`, laid out like the
 * other document views (record rail, toolbar, the document, Logs). It has no designer template, so the paper is
 * replaced by `<app-bill-of-entry-paper>`. Button rules come from the shared {@link BillOfEntryActions}.
 */
@Component({
  selector: 'app-bill-of-entry-view',
  standalone: true,
  imports: [PartyPeekChipsComponent, CommonModule, TranslateModule, DocViewShellComponent, DocViewSkeletonComponent, DocAdditionalDetailsComponent, DocViewAttachmentsComponent, BillOfEntryPaperComponent],
  providers: [MycurrencyPipe, DatePipe],
  templateUrl: './bill-of-entry-view.component.html',
  styleUrl: './bill-of-entry-view.component.scss',
  // See invoice-view.component.ts - `display: contents` keeps the fixed-height chain intact.
  host: { style: 'display: contents' },
})
export class BillOfEntryViewComponent extends DocumentViewBase {
  private entries = inject(BillOfEntryService);
  private suppliers = inject(SuppliersService);
  private currency = inject(MycurrencyPipe);
  private datePipe = inject(DatePipe);
  readonly actions = inject(BillOfEntryActions);

  readonly cfg: DocViewConfig = {
    features: ['account/bill-of-entry'],
    routeBase: '/account/bill-of-entry',
    zoomKey: 'billOfEntryZoomLevel',
    numberField: 'billingOfEnrtyNumber',
    whatsappType: 'BillOfEntry',
    filePrefix: 'bill-of-entry',
    titleKey: 'BILL_OF_ENTRY.FORM.BILL_OF_ENTRY',
    dashboardCrumbKey: 'BILL_OF_ENTRY.DASHBOARD',
    listCrumbKey: 'BILL_OF_ENTRY.LIST.BILL_OF_ENTRY_LIST',
    viewCrumbKey: 'BILL_OF_ENTRY.VIEW.VIEW_BILL_OF_ENTRY',
  };

  protected svc: DocViewService = {
    get: id => this.entries.getBillOfEntry(id),
    pdf: id => this.entries.viewBillOfEntryPdf(id),
    sendEmail: (payload, id) => this.entries.sendBillOfEntryEmail({ ...payload, billOfEntryId: id }),
  };

  private supplierPhone = '';

  /** Never drawn - the paper component is the document. */
  protected toRenderData(_b: BillOfEntry): DocumentRenderData { return {} as DocumentRenderData; }

  protected override async onInit(): Promise<void> {
    this.initRail(
      (term, page) => this.entries.getBillOfEntryList({ page, limit: this.railPageSize, searchTerm: term, sortBy: {}, filter: {} })
        .then(d => ({ list: d?.list ?? [], pageCount: d?.pageCount ?? 1 })),
      (r: any) => this.mapRailItem(r),
    );
  }

  protected override async afterLoad(b: BillOfEntry): Promise<void> {
    b.calculateTotal();
    await this.actions.refresh(b.branchId);
    this.supplierPhone = '';
    if (b.supplierId) {
      try { this.supplierPhone = (await this.suppliers.getSupplier(b.supplierId)).phone; } catch { /* the send dialog lets the user type it */ }
    }
  }

  private mapRailItem(r: any): DocRailItem {
    return {
      id: r.id,
      primary: r.supplierName,
      amountLabel: this.currency.transform(r.total),
      sub: `${r.billingOfEnrtyNumber} · ${this.datePipe.transform(r.billingOfEntryDate, 'dd/MM/yyyy')}`,
      data: r,
    };
  }

  protected override recipient(b: BillOfEntry) { return { emails: b.supplierEmail ? [b.supplierEmail] : [], phone: this.supplierPhone }; }

  protected override exportRows(b: BillOfEntry): Record<string, any>[] {
    return (b.lines as BillOfEntryLine[]).filter(l => !l.isDeleted).map(l => ({
      ProductName: l.selectedItem?.name || l.productName || l.note || '',
      AssessableValue: l.assessableValue || 0,
      CustomDuty: l.customDuty || 0,
      Total: l.total || 0,
      Tax: l.taxTotal || 0,
    }));
  }

  actionItems(b: BillOfEntry): DropdownMenuBtnItem[] { return this.actions.menu(b, this.id, () => this.goToList()); }

  /** "Additional Details" under the paper - the entry's Logs. */
  additionalDetails(): DocAdditionalDetailsConfig {
    return {
      tabs: ['journal', 'logs'],
      journalHeading: this.t('BILL_OF_ENTRY.FORM.BILL_OF_ENTRY'),
      loadJournal: () => this.loadJournal(),
      logsSourceTable: 'BillOfEntries',
      logsSourceId: this.id,
    };
  }

  /** The entry's journal, highest debit first like legacy. */
  private async loadJournal(): Promise<DocJournalResult> {
    const rows: DocJournalRow[] = (await this.entries.getJournal(this.id)) ?? [];
    rows.sort((a, b) => ((a.debit ?? 0) < (b.debit ?? 0) ? 1 : -1));
    return { rows, extras: [] };
  }
}
