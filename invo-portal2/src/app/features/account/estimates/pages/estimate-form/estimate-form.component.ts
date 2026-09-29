import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { EntityCustomFieldsComponent } from '../../../../settings/components/entity-custom-fields/entity-custom-fields.component';

import { Estimate } from '../../../models/estimate.model';
import { Invoice } from '../../../models/invoice.model';
import { EstimateActions } from '../../services/estimate-actions';
import { EstimatesService } from '../../services/estimates.service';
import { ESTIMATE_RULES } from '../../services/estimate-validation';
import { DocFormConfig, DocFormService, DocumentFormBase, ymd } from '../../../services/document-form-base';
import { salesLinesConfig } from '../../../services/sales-lines.config';
import { DocLinesConfig } from '../../../components/doc-lines-table/doc-lines.types';
import { DocLinesTableComponent } from '../../../components/doc-lines-table/doc-lines-table.component';
import { DocAttachmentsComponent } from '../../../components/doc-attachments/doc-attachments.component';
import { DocFormShellComponent } from '../../../components/doc-form-shell/doc-form-shell.component';
import { DocPartySectionComponent } from '../../../components/doc-party-section/doc-party-section.component';
import { DocTotalsComponent } from '../../../components/doc-totals/doc-totals.component';

/**
 * Estimates → create / edit / clone page (`/account/estimate/:id`, `0` = new, `?cloned=yes`).
 * Built on the shared document-form base: what is specific here is the expiry date and the
 * absence of statuses (no draft, no void — saved lines are deleted instead).
 */
@Component({
  selector: 'app-estimate-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink, TranslateModule,
    DocFormShellComponent, DocPartySectionComponent, SearchDropdownComponent, DatePickerComponent,
    DocLinesTableComponent, DocAttachmentsComponent, DocTotalsComponent, EntityCustomFieldsComponent,
  ],
  templateUrl: './estimate-form.component.html',
})
export class EstimateFormComponent extends DocumentFormBase {
  private estimates = inject(EstimatesService);

  readonly cfg: DocFormConfig = {
    features: ['account/estimates'],
    routeBase: '/account/estimate',
    viewRoute: '/account/estimate/view',
    numberField: 'estimateNumber',
    dateField: 'estimateDate',
    numberModule: 'estimate',
    numberNameKey: 'ESTIMATES.FORM.ESTIMATE',
    numberModeKey: 'invo_estimate_number_mode',
    rules: ESTIMATE_RULES,
    privilegeRoot: 'estimateSecurity',
    whatsappType: 'estimate',
    pdfName: 'estimate.pdf',
    titleKey: 'ESTIMATES.FORM.ESTIMATE',
    newCrumbKey: 'ESTIMATES.FORM.NEW_ESTIMATE',
    editCrumbKey: 'ESTIMATES.FORM.EDIT_ESTIMATE',
    listCrumbKey: 'ESTIMATES.LIST.ESTIMATES_LIST',
    dashboardCrumbKey: 'ESTIMATES.DASHBOARD',
    hasStatus: false,
    primaryKind: 'list',
    menuKinds: ['send'],
  };

  protected svc: DocFormService = {
    get: id => this.estimates.getEstimate(id),
    getNumber: () => this.estimates.getEstimateNumber(),
    save: d => this.estimates.saveEstimate(d),
    pdf: id => this.estimates.viewEstimatePdf(id),
    sendEmail: (payload, id) => this.estimates.sendEstimateEmail({ ...payload, estimateId: id }),
  };

  private actions = inject(EstimateActions);

  protected newDoc(): Estimate { return new Estimate(); }
  protected makeLinesConfig(): DocLinesConfig {
    return salesLinesConfig(() => this.doc!, this.lookups, {
      canAdjustPrice: () => this.actions.canAdjustPrice,
      barcodeType: 'estimate',
      canRemove: line => (line as any).source !== 'POS' && this.doc?.source !== 'POS',
    });
  }

  get est(): Estimate { return this.doc as Estimate; }

  protected override afterInit(): void {
    this.editor!.deleteMode = true;
    if (this.formStatus === 'clone') {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      this.est.estimateExpDate = ymd(d);
    }
  }

  protected override prepareLoaded(d: Invoice): void {
    const e = d as Estimate;
    if (!e.estimateExpDate) e.estimateExpDate = e.estimateDate;
  }

  // ── dates ──────────────────────────────────────────────────────────
  get estimateDate(): Date { return this.cachedDate(this.est.estimateDate); }
  get expiryDate(): Date { return this.cachedDate(this.est.estimateExpDate); }
  get expiryBeforeDate(): boolean { return ymd(this.expiryDate) < ymd(this.estimateDate); }

  onEstimateDate(v: any): void {
    if (!(v instanceof Date)) return;
    this.est.estimateDate = v;
    if (ymd(v) > String(this.est.estimateExpDate).slice(0, 10)) this.est.estimateExpDate = ymd(v);
    this.markDirty();
  }

  onExpiryDate(v: any): void {
    if (!(v instanceof Date)) return;
    this.est.estimateExpDate = ymd(v);
    this.markDirty();
  }

  protected override blockSave(): string | null {
    return this.expiryBeforeDate ? this.lang.instant('ESTIMATES.FORM.EXPIRY_BEFORE_DATE') : null;
  }
}
