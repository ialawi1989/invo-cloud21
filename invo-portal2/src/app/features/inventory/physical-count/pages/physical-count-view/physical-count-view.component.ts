import { Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import '../../physical-count-i18n';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../../account/services/document-view-base';
import { DocViewShellComponent } from '../../../../account/components/doc-view-shell/doc-view-shell.component';
import { DocViewSkeletonComponent } from '../../../../account/components/doc-view-skeleton/doc-view-skeleton.component';
import { DocAdditionalDetailsComponent } from '../../../../account/components/doc-additional-details/doc-additional-details.component';
import { DocAdditionalDetailsConfig, DocJournalResult } from '../../../../account/components/doc-additional-details/doc-additional-details.types';
import { DocJournalRow } from '../../../../account/components/doc-journal-tab/doc-journal-tab.component';
import { PhysicalCount } from '../../models/physical-count.model';
import { PhysicalCountService } from '../../services/physical-count.service';
import { PhysicalCountPaperComponent } from '../../components/physical-count-paper/physical-count-paper.component';
import { typeKey } from '../physical-count-list/physical-count-list.component';

/**
 * Physical counts -> view (`/inventory/physical-counts/view/:id`). Legacy `PhysicalCountViewComponent`: the count document
 * with the record rail, print, edit (until it is closed), delete and the journal a closed count posted. It has no document
 * template or server PDF, so the paper is `<app-physical-count-paper>` and "Print" is the browser's own print of it.
 */
@Component({
  selector: 'app-physical-count-view',
  standalone: true,
  imports: [CommonModule, TranslateModule, DocViewShellComponent, DocViewSkeletonComponent, DocAdditionalDetailsComponent, PhysicalCountPaperComponent],
  providers: [DatePipe],
  templateUrl: './physical-count-view.component.html',
  host: { style: 'display: contents' },
})
export class PhysicalCountViewComponent extends DocumentViewBase {
  private counts = inject(PhysicalCountService);
  private datePipe = inject(DatePipe);
  private privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check('inventoryPhysicalCountsSecurity.actions.add.access');

  readonly cfg: DocViewConfig = {
    features: ['inventory/physical-count'],
    routeBase: '/inventory/physical-counts',
    zoomKey: 'physicalCountZoomLevel',
    numberField: 'reference',
    whatsappType: 'physicalCount',
    filePrefix: 'physical-count',
    titleKey: 'PHYSICAL_COUNT.COUNT',
    dashboardCrumbKey: 'PHYSICAL_COUNT.DASHBOARD',
    listCrumbKey: 'PHYSICAL_COUNT.TITLE',
    viewCrumbKey: 'PHYSICAL_COUNT.VIEW_COUNT',
  };

  protected svc: DocViewService = {
    get: async id => {
      const c = await this.counts.getById(id);
      if (!c) throw new Error(this.t('PHYSICAL_COUNT.NOT_FOUND'));
      return c;
    },
    pdf: async () => null,
    sendEmail: async () => null,
  };

  /** Never drawn - the count paper is the document. */
  protected toRenderData(_c: PhysicalCount): DocumentRenderData { return {} as DocumentRenderData; }

  protected override async onInit(): Promise<void> {
    this.initRail(
      (term, page) => this.counts.getList({ page, limit: this.railPageSize, searchTerm: term })
        .then(d => ({ list: d.list, pageCount: d.pageCount })),
      (r: any) => this.mapRailItem(r),
    );
  }

  private mapRailItem(r: any): DocRailItem {
    const type = this.t('PHYSICAL_COUNT.TYPE.' + typeKey(r.type));
    return {
      id: r.id,
      primary: String(r.reference || r.branchName || ''),
      amountLabel: this.t('PHYSICAL_COUNT.STATUS.' + r.status),
      sub: `${this.datePipe.transform(r.createdDate, 'dd/MM/yyyy') ?? ''} · ${type.startsWith('PHYSICAL_COUNT.') ? r.type : type}`,
      data: r,
    };
  }

  /** Print the paper itself (the shared print rules show only the paper component). */
  override printItems(): DropdownMenuBtnItem[] { return []; }
  override shareItems(): DropdownMenuBtnItem[] { return []; }
  override exportItems(): DropdownMenuBtnItem[] { return []; }

  print(): void { window.print(); }

  /** A closed count has moved stock and can't be edited. */
  get canEdit(): boolean { const c: PhysicalCount | null = this.doc(); return !!c && this.canAdd && c.status !== 'Closed'; }

  override edit(): void { void this.router.navigate(['/inventory/physical-counts/edit', this.id]); }
  override add(): void { void this.router.navigate(['/inventory/physical-counts']); }

  /** Only a closed count posted a journal. */
  additionalDetails(): DocAdditionalDetailsConfig {
    const closed = (this.doc() as PhysicalCount | null)?.status === 'Closed';
    return {
      tabs: closed ? ['journal'] : [],
      journalHeading: this.t('PHYSICAL_COUNT.COUNT'),
      loadJournal: () => this.loadJournal(),
    };
  }

  private async loadJournal(): Promise<DocJournalResult> {
    const rows = await this.counts.getJournal(this.id);
    return { rows: rows as DocJournalRow[], extras: [] };
  }
}
