import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ParamDef, QueryParamsService } from '@shared/services/query-params.service';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import { CreditNote } from '../../../models/credit-note.model';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../services/document-view-base';
import { DocViewAttachmentsComponent } from '../../../components/doc-view-attachments/doc-view-attachments.component';
import { PartyPeekChipsComponent } from '../../../components/party-peek-chips/party-peek-chips.component';
import { DocAdditionalDetailsComponent } from '../../../components/doc-additional-details/doc-additional-details.component';
import { DocAdditionalDetailsConfig, DocJournalResult } from '../../../components/doc-additional-details/doc-additional-details.types';
import { DocJournalRow } from '../../../components/doc-journal-tab/doc-journal-tab.component';
import { buildExtraJournals } from '../../../services/doc-journal-extras';
import { DocViewSkeletonComponent } from '../../../components/doc-view-skeleton/doc-view-skeleton.component';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import type { DocRailFilterOption } from '../../../components/doc-rail-filter/doc-rail-filter.component';
import { CreditNotesService } from '../../services/credit-notes.service';
import { CreditNoteActions } from '../../services/credit-note-actions';
import { creditNoteToRenderData } from '../../services/credit-note-render-data';

/** `rstatus` — the rail's Open / Closed filter, persisted like `rpage`/`rq` are in {@link DocumentViewBase}. */
const RAIL_STATUS_PARAM: ParamDef<string | null> = {
  key: 'rstatus',
  codec: { encode: v => v || null, decode: r => r || null },
};

/**
 * Credit notes → view (`/account/credit-notes/view/:id`). Legacy `CreditNotesViewComponent`: the credit
 * note rendered through the default credit-note template, plus print / PDF / share, apply credits and
 * delete. Button rules come from the shared {@link CreditNoteActions}.
 */
@Component({
  selector: 'app-credit-note-view',
  standalone: true,
  imports: [PartyPeekChipsComponent, CommonModule, TranslateModule, DocViewShellComponent, DocViewSkeletonComponent, DocViewAttachmentsComponent, DocAdditionalDetailsComponent],
  providers: [MycurrencyPipe],
  templateUrl: './credit-note-view.component.html',
  // See invoice-view.component.ts — `display: contents` keeps the fixed-height chain intact.
  styles: [':host { display: contents; }'],
})
export class CreditNoteViewComponent extends DocumentViewBase {
  private notes = inject(CreditNotesService);
  private currency = inject(MycurrencyPipe);
  private queryParams = inject(QueryParamsService);
  readonly actions = inject(CreditNoteActions);

  readonly cfg: DocViewConfig = {
    features: ['account/credit-notes'],
    routeBase: '/account/credit-notes',
    templateType: 'credit-note',
    zoomKey: 'creditNoteZoomLevel',
    numberField: 'creditNoteNumber',
    whatsappType: 'credit-note',
    filePrefix: 'credit-note',
    partyFields: ['customerName'],
    titleKey: 'CREDIT_NOTES.FORM.CREDIT_NOTE',
    dashboardCrumbKey: 'CREDIT_NOTES.DASHBOARD',
    listCrumbKey: 'CREDIT_NOTES.LIST.CREDIT_NOTES_LIST',
    viewCrumbKey: 'CREDIT_NOTES.VIEW.VIEW_CREDIT_NOTE',
  };

  protected svc: DocViewService = {
    get: id => this.notes.getCreditNote(id),
    pdf: id => this.notes.viewCreditNotePdf(id),
    sendEmail: (payload, id) => this.notes.sendCreditNoteEmail({ ...payload, creditNoteId: id }),
  };

  protected toRenderData(c: CreditNote): DocumentRenderData { return creditNoteToRenderData(c); }

  protected override async onInit(): Promise<void> {
    await this.actions.refresh();
    this.railStatus.set(this.queryParams.read({ status: RAIL_STATUS_PARAM }).status);
    this.initRail(
      (term, page) => this.notes.getCreditNoteList({ page, limit: this.railPageSize, searchTerm: term, sortBy: {}, filter: { status: this.railStatus() } })
        .then(d => ({ list: d?.list ?? [], pageCount: d?.pageCount ?? 1 })),
      (r: any) => this.mapRailItem(r),
    );
  }

  railStatus = signal<string | null>(null);
  /** Open = credit left to refund or apply (remaining credit > 0); Closed = nothing left. */
  readonly railStatusOptions = ['Open', 'Closed'];
  railFilterOptions(): DocRailFilterOption[] {
    return [
      { value: null, label: this.t('CREDIT_NOTES.LIST.ALL_CREDIT_NOTES') },
      ...this.railStatusOptions.map(s => ({ value: s, label: this.t('CREDIT_NOTES.LIST.STATUS_' + s.toUpperCase()) })),
    ];
  }
  onRailFilterPick(status: string | null): void {
    this.railStatus.set(status);
    this.queryParams.writeOne(RAIL_STATUS_PARAM, status);
    void this.loadRail(1);
  }

  private mapRailItem(r: any): DocRailItem {
    const used = (r.refundedAmount ?? 0) + (r.appliedAmount ?? 0) > 0;
    return {
      id: r.id,
      primary: r.customerName,
      amountLabel: this.currency.transform(r.total),
      sub: `${r.creditNoteNumber} · ${new Date(r.creditNoteDate).toLocaleDateString()}`,
      badgeText: used ? this.t((r.remainingCredit ?? 0) > 0 ? 'CREDIT_NOTES.LIST.REFUNDED_PARTIALLY' : 'CREDIT_NOTES.LIST.REFUNDED') : undefined,
      badgeKind: used ? 'neutral' : undefined,
    };
  }

  /** "Additional Details" tabs under the paper — Journal (with applied-credit / refund entries) and Logs. */
  additionalDetails(): DocAdditionalDetailsConfig {
    return {
      tabs: ['journal', 'logs'],
      journalHeading: this.t('CREDIT_NOTES.FORM.CREDIT_NOTE'),
      loadJournal: () => this.loadJournal(),
      logsSourceTable: 'CreditNotes',
      logsSourceId: this.id,
    };
  }

  private async loadJournal(): Promise<DocJournalResult> {
    const j = await this.notes.getCreditNoteJournal(this.id);
    const rows: DocJournalRow[] = j?.defaultJournals ?? [];
    rows.sort((a, b) => ((a.debit ?? 0) < (b.debit ?? 0) ? 1 : -1));
    return { rows, extras: buildExtraJournals('creditNote', j?.extraJournals, (k, p) => this.lang.instant(k, p)) };
  }

  /** Apply Credits / Delete — items and rules come from the shared actions (also used by the list and the form). */
  actionItems(c: CreditNote): DropdownMenuBtnItem[] {
    return this.actions.menu(c, this.id, () => this.goToList(), () => void this.load());
  }
}
