import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import { SupplierCredit, SupplierCreditLine } from '../../../models/supplier-credit.model';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../services/document-view-base';
import { buildExtraJournals } from '../../../services/doc-journal-extras';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import { DocAdditionalDetailsComponent } from '../../../components/doc-additional-details/doc-additional-details.component';
import { DocAdditionalDetailsConfig, DocJournalResult } from '../../../components/doc-additional-details/doc-additional-details.types';
import { DocJournalRow } from '../../../components/doc-journal-tab/doc-journal-tab.component';
import { DocViewAttachmentsComponent } from '../../../components/doc-view-attachments/doc-view-attachments.component';
import { SuppliersService } from '../../../suppliers/services/suppliers.service';
import { SupplierCreditsService } from '../../services/supplier-credits.service';
import { SupplierCreditActions } from '../../services/supplier-credit-actions';
import { supplierCreditToRenderData } from '../../services/supplier-credit-render-data';
import { PartyPeekChipsComponent } from '../../../components/party-peek-chips/party-peek-chips.component';

/**
 * Supplier credits -> view (`/account/supplier-credit/view/:id`). Legacy `SupplierCreditViewComponent`: the
 * credit rendered through the default supplier-credit template, print / PDF / share / export, edit, the shared
 * Actions menu (refund, apply credits, delete), attachments and the Additional Details (journal incl. applied
 * credits and refunds, logs). Button rules come from the shared {@link SupplierCreditActions}.
 */
@Component({
  selector: 'app-supplier-credit-view',
  standalone: true,
  imports: [PartyPeekChipsComponent, CommonModule, TranslateModule, DocViewShellComponent, DocAdditionalDetailsComponent, DocViewAttachmentsComponent],
  providers: [MycurrencyPipe],
  templateUrl: './supplier-credit-view.component.html',
  styles: [':host { display: contents; }'],
})
export class SupplierCreditViewComponent extends DocumentViewBase {
  private credits = inject(SupplierCreditsService);
  private suppliers = inject(SuppliersService);
  private currency = inject(MycurrencyPipe);
  readonly actions = inject(SupplierCreditActions);

  readonly cfg: DocViewConfig = {
    features: ['account/supplier-credits'],
    routeBase: '/account/supplier-credit',
    templateType: 'supplier-credit',
    zoomKey: 'supplierCreditZoomLevel',
    numberField: 'supplierCreditNumber',
    whatsappType: 'supplierCreditNote',
    filePrefix: 'supplier-credit',
    partyFields: ['supplierName'],
    titleKey: 'SUPPLIER_CREDITS.FORM.SUPPLIER_CREDIT',
    dashboardCrumbKey: 'SUPPLIER_CREDITS.DASHBOARD',
    listCrumbKey: 'SUPPLIER_CREDITS.LIST.CREDITS_LIST',
    viewCrumbKey: 'SUPPLIER_CREDITS.VIEW.VIEW_SUPPLIER_CREDIT',
  };

  protected svc: DocViewService = {
    get: id => this.load1(id),
    pdf: id => this.credits.viewSupplierCreditPdf(id),
    sendEmail: (payload, id) => this.credits.sendSupplierCreditEmail({ ...payload, supplierCreditId: id }),
  };

  /** The credit plus its supplier's phone / address, which the document paper prints but the record doesn't carry. */
  private async load1(id: string): Promise<SupplierCredit> {
    const c = await this.credits.getSupplierCredit(id);
    if (c.id && c.supplierId) {
      try {
        const s = await this.suppliers.getSupplier(c.supplierId);
        c.supplierPhone = s.phone;
        c.supplierAddress = s.address;
        c.supplierVatNumber = c.supplierVatNumber || s.vatNumber;
        c.supplierEmail = c.supplierEmail || s.email;
      } catch { /* the paper simply leaves the supplier contact lines empty */ }
    }
    c.calculateTotal();
    return c;
  }

  protected toRenderData(c: SupplierCredit): DocumentRenderData { return supplierCreditToRenderData(c); }
  protected override recipient(c: SupplierCredit) { return { emails: c.supplierEmail ? [c.supplierEmail] : [], phone: c.supplierPhone }; }

  protected override exportRows(c: SupplierCredit): Record<string, any>[] {
    return (c.lines as SupplierCreditLine[]).map(l => ({
      ProductName: l.selectedItem?.name || l.note || '',
      Barcode: l.barcode || l.selectedItem?.barcode || '',
      Quantity: l.qty || 0,
      UnitCost: l.unitCost || 0,
    }));
  }

  protected override async onInit(): Promise<void> {
    await this.actions.refresh();
    this.initRail(
      (term, page) => this.credits.getCreditList({ page, limit: this.railPageSize, searchTerm: term, sortBy: {}, filter: {} })
        .then(d => ({ list: d?.list ?? [], pageCount: d?.pageCount ?? 1 })),
      (r: any) => this.mapRailItem(r),
    );
  }

  private mapRailItem(r: any): DocRailItem {
    return {
      id: r.id,
      primary: r.supplierName,
      amountLabel: this.currency.transform(r.total),
      sub: `${r.supplierCreditNumber} · ${new Date(r.supplierCreditDate).toLocaleDateString()}`,
    };
  }

  protected override async afterLoad(c: SupplierCredit): Promise<void> { await this.actions.refresh(c.branchId); }

  actionItems(c: SupplierCredit): DropdownMenuBtnItem[] { return this.actions.menu(c, this.id, () => this.goToList(), () => void this.load()); }

  additionalDetails(): DocAdditionalDetailsConfig {
    return {
      tabs: ['journal', 'logs'],
      journalHeading: this.t('SUPPLIER_CREDITS.FORM.SUPPLIER_CREDIT'),
      loadJournal: () => this.loadJournal(this.id),
      logsSourceTable: 'SupplierCredits',
      logsSourceId: this.id,
    };
  }

  private async loadJournal(id: string): Promise<DocJournalResult> {
    const j: any = await this.credits.getSupplierCreditJournal(id);
    const rows: DocJournalRow[] = j?.defaultJournals ?? [];
    rows.sort((a, b) => ((a.debit ?? 0) < (b.debit ?? 0) ? 1 : -1));
    return { rows, extras: buildExtraJournals('supplierCredit', j?.extraJournals, (k, p) => this.lang.instant(k, p)) };
  }
}
