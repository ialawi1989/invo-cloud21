import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { SegmentedToggleComponent } from '@shared/components/segmented-toggle/segmented-toggle.component';

import { Bill } from '../../../models/bill.model';
import { DocFormConfig, DocFormService, ymd } from '../../../services/document-form-base';
import { DocLinesConfig } from '../../../components/doc-lines-table/doc-lines.types';
import { DocLinesTableComponent } from '../../../components/doc-lines-table/doc-lines-table.component';
import { DocFormShellComponent } from '../../../components/doc-form-shell/doc-form-shell.component';
import { DocSupplierSectionComponent, SupplierMini } from '../../../components/doc-supplier-section/doc-supplier-section.component';
import { RecurringScheduleCardComponent } from '../../../components/recurring-schedule-card/recurring-schedule-card.component';
import { BillTotalsComponent } from '../../../bills/components/bill-totals/bill-totals.component';
import { BillFormComponent } from '../../../bills/pages/bill-form/bill-form.component';
import { RecurringBill } from '../../models/recurring-bill.model';
import { RecurringBillsService } from '../../services/recurring-bills.service';
import { RECURRING_BILL_RULES, RECURRING_TERMS, RecurringBillActions } from '../../services/recurring-bill-schedule';

/**
 * Recurring Bills -> create / edit page (`/account/recurring-bill/:id`, `new` / `0` = create). Legacy
 * `RecurringBillFormComponent`: the bill template (`transactionDetails`) is edited with the bill form's own
 * logic - supplier, branch, payment term, payable account, lines, discount - and the shared schedule card
 * (profile name, start / end, repeat rule) wraps it; both are saved in one `saveRecurringBill` call.
 *
 * Same rules as legacy: batch / serialized products can't repeat, and supplier + branch are frozen once the
 * schedule generated a bill. The bill's own number, dates and attachments don't exist here - each generated
 * bill gets them on the server.
 */
@Component({
  selector: 'app-recurring-bill-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule,
    DocFormShellComponent, DocSupplierSectionComponent, SearchDropdownComponent, SegmentedToggleComponent,
    DocLinesTableComponent, BillTotalsComponent, RecurringScheduleCardComponent,
  ],
  templateUrl: './recurring-bill-form.component.html',
  styles: [`.rf-advanced { margin-top: 12px; background: none; border: 0; padding: 0; cursor: pointer; }`],
})
export class RecurringBillFormComponent extends BillFormComponent {
  private service = inject(RecurringBillsService);
  private recActions = inject(RecurringBillActions);

  override readonly cfg: DocFormConfig = {
    features: ['account/bills', 'account/purchase-orders', 'account/recurring-bills', 'account/recurring-invoices'],
    routeBase: '/account/recurring-bill',
    viewRoute: '/account/recurring-bill/view',
    numberField: 'billingNumber',
    dateField: 'billingDate',
    numberModule: 'bill',
    numberNameKey: 'RECURRING_BILLS.FORM.RECURRING_BILL',
    numberModeKey: 'invo_recurring_bill_number_mode',
    rules: RECURRING_BILL_RULES,
    privilegeRoot: 'recurringBillSecurity',
    whatsappType: 'bills',
    pdfName: 'recurring-bill.pdf',
    titleKey: 'RECURRING_BILLS.FORM.RECURRING_BILL',
    newCrumbKey: 'RECURRING_BILLS.FORM.NEW',
    editCrumbKey: 'RECURRING_BILLS.FORM.EDIT',
    listCrumbKey: 'RECURRING_BILLS.LIST.TITLE',
    dashboardCrumbKey: 'RECURRING_BILLS.DASHBOARD',
    hasStatus: false,
    primaryKind: 'list',
    menuKinds: [],
  };

  /** The schedule header wrapping the bill template (`doc`). */
  rec = new RecurringBill();

  protected override svc: DocFormService = {
    get: async id => {
      const r = await this.service.getById(id);
      if (!r) {
        this.toast.error('COMMON.OPS', this.lang.instant('RECURRING_BILLS.FORM.NOT_FOUND'));
        void this.router.navigate([this.cfg.routeBase]);
        return new Bill();
      }
      this.rec = r;
      return r.transactionDetails;
    },
    // A recurring profile has no number of its own; each generated bill gets one on the server.
    getNumber: async () => '',
    save: d => this.service.save(this.payload(d as Bill)),
    pdf: async () => null,
    sendEmail: async () => null,
  };

  /** Batch / serialized products can't repeat (typeahead, scan, bulk and import skip them). */
  protected override makeLinesConfig(): DocLinesConfig {
    return {
      ...super.makeLinesConfig(),
      excludeTypes: ['serialized', 'batch'],
      bulkExcludeTypes: ['serialized', 'batch'],
      splitEditor: undefined,
      splitSummary: undefined,
    };
  }

  /** Supplier + branch are frozen once a bill was generated (the backend keeps the stored ones anyway). */
  get frozen(): boolean { return this.rec.hasBills; }
  override get branchLocked(): boolean { return this.frozen; }

  protected override async afterInit(isNew: boolean): Promise<void> {
    // Only the payment terms the backend turns into a due date for each generated bill.
    this.terms = this.terms.filter(t => RECURRING_TERMS.some(x => x.value === t.value));
    await super.afterInit(isNew);
    const d = this.bill;
    if (isNew && !this.rec.startDate) this.rec.startDate = ymd(new Date());
    if (!d.paymentTerm || !this.terms.some(x => x.value === d.paymentTerm)) d.paymentTerm = 'net7';
    if (this.rec.endTerm === 'by' && !this.rec.endDate) this.rec.endDate = this.rec.startDate;
  }

  override async onSupplier(s: SupplierMini | undefined): Promise<void> {
    if (this.frozen) return;
    await super.onSupplier(s);
    // A supplier brings its own payment term (only the ones a recurring bill offers).
    if (s) this.bill.paymentTerm = this.terms.some(x => x.value === s.paymentTerm) ? s.paymentTerm : 'net7';
  }

  /** "Actions" dropdown of a saved profile - items and rules come from the shared {@link RecurringBillActions}. */
  override actionsMenu(): DropdownMenuBtnItem[] {
    if (this.formStatus !== 'edit' || !this.rec.id) return [];
    return this.recActions.menu(this.rec, this.rec.id, () => { this.dirty = false; this.form.markAsPristine(); this.afterSaveRoute(); });
  }

  // ── validation ─────────────────────────────────────────────────────
  get nameInvalid(): boolean { return !this.rec.name?.trim(); }
  private get headerIssues(): string[] {
    const out: string[] = [];
    if (this.nameInvalid) out.push('RECURRING_BILLS.REQUIRED.NAME');
    if (!this.rec.startDate) out.push('RECURRING_BILLS.REQUIRED.START_DATE');
    if (this.rec.endTerm === 'by' && !this.rec.endDate) out.push('RECURRING_BILLS.REQUIRED.END_DATE');
    return out;
  }
  override get missing(): string[] { return [...this.headerIssues, ...super.missing]; }
  override get missingDraft(): string[] { return this.missing; }

  protected override blockSave(): string | null {
    const r = this.rec;
    if (r.endTerm === 'by' && r.endDate && r.endDate < r.startDate) return this.lang.instant('RECURRING_BILLS.FORM.END_BEFORE_START');
    return null;
  }

  // ── save ───────────────────────────────────────────────────────────
  /** The `saveRecurringBill` body: schedule header + the bill template. */
  private payload(d: Bill): any {
    const r = this.rec;
    return {
      id: r.id ?? '',
      name: r.name.trim(),
      type: r.type,
      branchId: d.branchId,
      supplierId: d.supplierId,
      startDate: r.startDate,
      endTerm: r.endTerm,
      endDate: r.endTerm === 'by' ? r.endDate : null,
      repeatData: { periodicity: r.repeatData.periodicity, periodQty: Number(r.repeatData.periodQty) || 1, on: Number(r.repeatData.on) || 1 },
      billCreatedBefore: r.billCreatedBefore ?? 0,
      transactionDetails: this.bills.toPayload(d),
    };
  }
}
