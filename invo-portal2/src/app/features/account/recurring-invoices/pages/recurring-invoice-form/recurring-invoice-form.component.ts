import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import type { CustomerMini } from '@shared/components/customer-picker/customer-picker.component';

import { Invoice } from '../../../models/invoice.model';
import { DocFormConfig, DocFormService, DocumentFormBase, ymd } from '../../../services/document-form-base';
import { salesLinesConfig } from '../../../services/sales-lines.config';
import { DocLinesConfig } from '../../../components/doc-lines-table/doc-lines.types';
import { DocLinesTableComponent } from '../../../components/doc-lines-table/doc-lines-table.component';
import { DocFormShellComponent } from '../../../components/doc-form-shell/doc-form-shell.component';
import { RecurringScheduleCardComponent } from '../../../components/recurring-schedule-card/recurring-schedule-card.component';
import { DocPartySectionComponent } from '../../../components/doc-party-section/doc-party-section.component';
import { DocTotalsComponent } from '../../../components/doc-totals/doc-totals.component';

import { RecurringInvoice } from '../../models/recurring-invoice.model';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { InvoicesService } from '../../../invoices/services/invoices.service';
import { RecurringInvoicesService } from '../../services/recurring-invoices.service';
import { RECURRING_INVOICE_RULES, RECURRING_TERMS, RecurringInvoiceActions } from '../../services/recurring-invoice-schedule';

interface Choice<T = string> { value: T; label: string; }

/** Key under which "Make Recurring" (invoice form / invoice view) hands the invoice over. */
const HANDOFF_KEY = 'recurringFromInvoice';

/**
 * Recurring Invoices → create / edit page (`/account/recurring-invoice/:id`, `new` / `0` = create,
 * `?fromInvoice=yes` = pre-filled from the invoice that was open when "Make Recurring" was pressed).
 * Built on the shared document-form base: the invoice template (`transactionDetails`) is the
 * document the base edits; this class adds the schedule header (profile name, start / end, repeat)
 * that wraps it, and saves both in one `saveRecurringInvoice` call.
 *
 * Same rules as legacy: batch / serialized products can't repeat (typeahead, scan, bulk and import
 * all skip them), and customer + branch are frozen once the schedule generated an invoice.
 */
@Component({
  selector: 'app-recurring-invoice-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule,
    DocFormShellComponent, DocPartySectionComponent, SearchDropdownComponent, RecurringScheduleCardComponent,
    DocLinesTableComponent, DocTotalsComponent, ToggleComponent,
  ],
  templateUrl: './recurring-invoice-form.component.html',
  styleUrl: './recurring-invoice-form.component.scss',
})
export class RecurringInvoiceFormComponent extends DocumentFormBase {
  private service = inject(RecurringInvoicesService);
  private invoicesService = inject(InvoicesService);
  private actions = inject(RecurringInvoiceActions);

  readonly cfg: DocFormConfig = {
    features: ['account/recurring-invoices'],
    routeBase: '/account/recurring-invoice',
    viewRoute: '/account/recurring-invoice/view',
    numberField: 'invoiceNumber',
    dateField: 'invoiceDate',
    numberModule: 'invoice',
    numberNameKey: 'RECURRING_INVOICES.FORM.RECURRING_INVOICE',
    numberModeKey: 'invo_recurring_invoice_number_mode',
    rules: RECURRING_INVOICE_RULES,
    privilegeRoot: 'recurringInvoiceSecurity',
    whatsappType: 'invoice',
    pdfName: 'recurring-invoice.pdf',
    titleKey: 'RECURRING_INVOICES.FORM.RECURRING_INVOICE',
    newCrumbKey: 'RECURRING_INVOICES.FORM.NEW',
    editCrumbKey: 'RECURRING_INVOICES.FORM.EDIT',
    listCrumbKey: 'RECURRING_INVOICES.LIST.TITLE',
    dashboardCrumbKey: 'RECURRING_INVOICES.DASHBOARD',
    hasStatus: false,
    primaryKind: 'list',
    menuKinds: [],
  };

  /** The schedule header wrapping the invoice template (`doc`). */
  rec = new RecurringInvoice();

  protected svc: DocFormService = {
    get: async id => {
      const r = await this.service.getById(id);
      if (!r) {
        this.toast.error('COMMON.OPS', this.lang.instant('RECURRING_INVOICES.FORM.NOT_FOUND'));
        void this.router.navigate([this.cfg.routeBase]);
        return new Invoice();
      }
      this.rec = r;
      return r.transactionDetails;
    },
    // A recurring profile has no number of its own; each generated invoice gets one on the server.
    getNumber: async () => '',
    save: d => this.service.save(this.payload(d)),
    pdf: async () => null,
    sendEmail: async () => null,
  };

  protected newDoc(): Invoice { return new Invoice(); }
  protected makeLinesConfig(): DocLinesConfig {
    return {
      ...salesLinesConfig(() => this.doc!, this.lookups, {
        canAdjustPrice: () => this.actions.canAdd,
        barcodeType: 'invoice',
        canRemove: () => true,
      }),
      // Every line of the template stays editable, and batch / serialized products can't repeat.
      canEditProduct: () => true,
      isLocked: () => false,
      excludeTypes: ['serialized', 'batch'],
      serialsLookup: undefined,
      batchesLookup: undefined,
    };
  }

  // ── option lists (built once the translations are loaded) ──────────
  terms: Choice[] = RECURRING_TERMS;
  receivableAccounts: any[] = [];

  /** "Actions" dropdown of a saved profile — items and rules come from the shared {@link RecurringInvoiceActions}. */
  actionsMenu(): DropdownMenuBtnItem[] {
    if (this.formStatus !== 'edit' || !this.rec.id) return [];
    return this.actions.menu(this.rec, this.rec.id, () => { this.dirty = false; this.form.markAsPristine(); this.afterSaveRoute(); });
  }

  // ── base hooks ─────────────────────────────────────────────────────
  protected override async initNew(d: Invoice): Promise<void> {
    if (this.route.snapshot.queryParams['fromInvoice'] === 'yes') await this.fillFromInvoice(d);
  }

  /**
   * "Make Recurring": the invoice that was open is read from session storage (written by the invoice
   * form / view) and becomes the template. Identity, status, payments and dates are dropped; serial /
   * batch lines are left out because a recurring profile can't hold them. The storage entry is kept
   * (it survives a refresh); when it is gone, a saved invoice is reloaded from the `invoiceId` in the URL.
   */
  private async fillFromInvoice(d: Invoice): Promise<void> {
    let raw: any = null;
    try {
      const txt = sessionStorage.getItem(HANDOFF_KEY);
      raw = txt ? JSON.parse(txt) : null;
    } catch { /* storage unavailable / bad JSON → fall back to the invoice id */ }
    const invoiceId = this.route.snapshot.queryParams['invoiceId'];
    if (invoiceId && (!raw || (raw.id && raw.id !== invoiceId))) {
      try { raw = JSON.parse(JSON.stringify(await this.invoicesService.getInvoice(invoiceId))); } catch { /* not found → empty profile */ }
    }
    if (!raw) return;

    this.prefilled = true;
    const keep = { ...raw };
    for (const k of [
      'id', 'invoiceNumber', 'status', 'attachment', 'createdAt', 'invoiceDate', 'dueDate', 'payments', 'invoicePayments',
      'recurringInvoiceId', 'estimateId', 'appliedCredit', 'source', 'onlineData',
    ]) delete keep[k];
    d.ParseJson(keep);
    d.id = null;
    d.status = '';
    d.invoiceDate = new Date();

    const before = d.lines.length;
    d.lines = d.lines.filter(l => {
      const type = (l as any).selectedItem?.type;
      const bad = type === 'serialized' || type === 'batch' || !!l.serial || !!l.batch || l.isVoided || l.isReturned;
      return !bad;
    });
    d.lines.forEach(l => { l.id = null; l.invoiceId = ''; });
    const skipped = before - d.lines.length;
    if (skipped > 0) this.toast.info?.(this.lang.instant('RECURRING_INVOICES.FORM.SKIPPED_LINES', { count: skipped }));

    if (d.customerId) {
      this.customerValue = { id: d.customerId, name: d.customerName, displayName: d.customerName, phone: '', email: '' };
      this.addresses = this.parseAddresses(await this.customersService.customerAddresses(d.customerId));
      const def = this.addresses.find(a => a.isDefault) ?? this.addresses[0];
      this.customerAddress = def?.title ?? '';
    }
  }

  protected override async afterInit(isNew: boolean): Promise<void> {
    const d = this.doc!;
    if (isNew) {
      if (!this.rec.startDate) this.rec.startDate = ymd(new Date());
      if (!d.paymentTerm) d.paymentTerm = 'net7';
    } else if (!d.paymentTerm || !this.terms.some(x => x.value === d.paymentTerm)) {
      d.paymentTerm = 'net7';
    }
    if (this.rec.endTerm === 'by' && !this.rec.endDate) this.rec.endDate = this.rec.startDate;

    this.receivableAccounts = await this.service.getReceivableAccounts();
  }

  /** Customer + branch are frozen once an invoice was generated (the backend keeps the stored ones anyway). */
  get frozen(): boolean { return this.rec.hasInvoices; }
  override get branchLocked(): boolean { return this.frozen; }

  override async onCustomer(c: CustomerMini | undefined): Promise<void> {
    if (this.frozen) return;
    await super.onCustomer(c);
    // Legacy: a customer brings its own payment term (only the ones a recurring invoice offers).
    const term = c?.paymentTerm;
    if (c) this.doc!.paymentTerm = this.terms.some(x => x.value === term) ? term : 'net7';
  }

  // ── header ─────────────────────────────────────────────────────────
  choice = <T>(list: Choice<T>[], value: T) => list.find(x => x.value === value) ?? null;
  choiceLabel = (c: Choice<any>) => c?.label ?? '';
  sameChoice = (a: Choice<any>, b: Choice<any>) => a?.value === b?.value;

  // ── invoice template ───────────────────────────────────────────────
  termOf = () => this.terms.find(t => t.value === this.doc?.paymentTerm) ?? null;
  onTermPick(t: Choice | null): void { this.doc!.paymentTerm = t?.value ?? 'net7'; this.markDirty(); }

  receivableOf = () => this.receivableAccounts.find(a => a.id === this.doc?.receivableAccountId) ?? null;
  receivableLabel = (a: any) => (a ? (a.code ? `${a.name} (${a.code})` : a.name) : '');
  onReceivable(a: any): void { this.doc!.receivableAccountId = a?.id ?? ''; this.markDirty(); }

  // ── validation ─────────────────────────────────────────────────────
  get nameInvalid(): boolean { return !this.rec.name?.trim(); }
  private get headerIssues(): string[] {
    const out: string[] = [];
    if (this.nameInvalid) out.push('RECURRING_INVOICES.REQUIRED.NAME');
    if (!this.rec.startDate) out.push('RECURRING_INVOICES.REQUIRED.START_DATE');
    if (this.rec.endTerm === 'by' && !this.rec.endDate) out.push('RECURRING_INVOICES.REQUIRED.END_DATE');
    return out;
  }
  override get missing(): string[] { return [...this.headerIssues, ...super.missing]; }
  override get missingDraft(): string[] { return this.missing; }

  protected override blockSave(): string | null {
    const r = this.rec;
    if (r.endTerm === 'by' && r.endDate && r.endDate < r.startDate) return this.lang.instant('RECURRING_INVOICES.FORM.END_BEFORE_START');
    return null;
  }

  // ── save ───────────────────────────────────────────────────────────
  /** The `saveRecurringInvoice` body: schedule header + the invoice template. */
  private payload(d: Invoice): any {
    const r = this.rec;
    return {
      id: r.id ?? '',
      name: r.name.trim(),
      type: r.type,
      branchId: d.branchId,
      customerId: d.customerId,
      startDate: r.startDate,
      endTerm: r.endTerm,
      endDate: r.endTerm === 'by' ? r.endDate : null,
      repeatData: { periodicity: r.repeatData.periodicity, periodQty: Number(r.repeatData.periodQty) || 1, on: Number(r.repeatData.on) || 1 },
      invoiceCreatedBefore: r.invoiceCreatedBefore ?? 0,
      sendInvoice: !!r.sendInvoice,
      transactionDetails: d,
    };
  }
}
