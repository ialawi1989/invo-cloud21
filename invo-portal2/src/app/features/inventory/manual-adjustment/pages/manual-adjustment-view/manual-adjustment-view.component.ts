import { Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import '../../manual-adjustment-i18n';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../../account/services/document-view-base';
import { DocViewShellComponent } from '../../../../account/components/doc-view-shell/doc-view-shell.component';
import { DocViewSkeletonComponent } from '../../../../account/components/doc-view-skeleton/doc-view-skeleton.component';
import { DocAdditionalDetailsComponent } from '../../../../account/components/doc-additional-details/doc-additional-details.component';
import { DocAdditionalDetailsConfig, DocJournalResult } from '../../../../account/components/doc-additional-details/doc-additional-details.types';
import { DocJournalRow } from '../../../../account/components/doc-journal-tab/doc-journal-tab.component';
import { ManualAdjustment, isUnitCost } from '../../models/manual-adjustment.model';
import { ManualAdjustmentService } from '../../services/manual-adjustment.service';
import { ManualAdjustmentPaperComponent } from '../../components/manual-adjustment-paper/manual-adjustment-paper.component';

/**
 * Manual adjustments -> view (`/manual-adjustment/view/:id`). Legacy `ManualAdjustmentViewComponent`: the adjustment document
 * with the record rail, print, edit (on-hand adjustments only) and the journal it posted. It has no document template or
 * server PDF, so the paper is `<app-manual-adjustment-paper>` and "Print" is the browser's own print of it.
 */
@Component({
  selector: 'app-manual-adjustment-view',
  standalone: true,
  imports: [CommonModule, TranslateModule, DocViewShellComponent, DocViewSkeletonComponent, DocAdditionalDetailsComponent, ManualAdjustmentPaperComponent],
  providers: [DatePipe],
  templateUrl: './manual-adjustment-view.component.html',
  host: { style: 'display: contents' },
})
export class ManualAdjustmentViewComponent extends DocumentViewBase {
  private adjustments = inject(ManualAdjustmentService);
  private datePipe = inject(DatePipe);
  private privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check('manualAdjustmentSecurity.actions.add.access');

  readonly cfg: DocViewConfig = {
    features: ['inventory/manual-adjustment'],
    routeBase: '/manual-adjustment',
    zoomKey: 'manualAdjustmentZoomLevel',
    numberField: 'id',
    whatsappType: 'manualAdjustment',
    filePrefix: 'manual-adjustment',
    titleKey: 'MANUAL_ADJUSTMENT.ADJUSTMENT',
    dashboardCrumbKey: 'MANUAL_ADJUSTMENT.DASHBOARD',
    listCrumbKey: 'MANUAL_ADJUSTMENT.TITLE',
    viewCrumbKey: 'MANUAL_ADJUSTMENT.VIEW_ADJUSTMENT',
  };

  protected svc: DocViewService = {
    get: async id => {
      const a = await this.adjustments.getById(id);
      if (!a) throw new Error(this.t('MANUAL_ADJUSTMENT.NOT_FOUND'));
      return a;
    },
    pdf: async () => null,
    sendEmail: async () => null,
  };

  /** Never drawn - the adjustment paper is the document. */
  protected toRenderData(_a: ManualAdjustment): DocumentRenderData { return {} as DocumentRenderData; }

  protected override async onInit(): Promise<void> {
    this.initRail(
      (term, page) => this.adjustments.getList({ page, limit: this.railPageSize, searchTerm: term })
        .then(d => ({ list: d.list, pageCount: d.pageCount })),
      (r: any) => this.mapRailItem(r),
    );
  }

  private mapRailItem(r: any): DocRailItem {
    return {
      id: r.id,
      primary: String(r.branchName ?? ''),
      amountLabel: this.t('MANUAL_ADJUSTMENT.TYPE.' + (r.adjustmentType ?? 'onHand adjustment')),
      sub: this.datePipe.transform(r.inventoryMovmentDate, 'dd/MM/yyyy') ?? '',
      data: r,
    };
  }

  /** Print the paper itself (the shared print rules show only the paper component). */
  override printItems(): DropdownMenuBtnItem[] { return []; }
  override shareItems(): DropdownMenuBtnItem[] { return []; }
  override exportItems(): DropdownMenuBtnItem[] { return []; }

  print(): void { window.print(); }

  /** A unit-cost adjustment re-valued the stock and can't be edited once saved. */
  get canEdit(): boolean { const a: ManualAdjustment | null = this.doc(); return !!a && this.canAdd && !isUnitCost(a.adjustmentType); }

  override edit(): void {
    const a: ManualAdjustment | null = this.doc();
    if (a) void this.router.navigate(['/manual-adjustment', a.id]);
  }
  override add(): void { void this.router.navigate(['/manual-adjustment/new']); }

  additionalDetails(): DocAdditionalDetailsConfig {
    return {
      tabs: ['journal'],
      journalHeading: this.t('MANUAL_ADJUSTMENT.ADJUSTMENT'),
      loadJournal: () => this.loadJournal(),
    };
  }

  private async loadJournal(): Promise<DocJournalResult> {
    const rows = await this.adjustments.getJournal(this.id);
    return { rows: rows as DocJournalRow[], extras: [] };
  }
}
