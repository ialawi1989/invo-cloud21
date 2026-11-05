import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { AiDraftService } from '@core/ai/assistant/ai-draft.service';
import { appendDraftLines } from '../../services/ai-draft-apply';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import type { CustomerMini } from '@shared/components/customer-picker/customer-picker.component';
import { EntityCustomFieldsComponent } from '../../../../settings/components/entity-custom-fields/entity-custom-fields.component';

import { Invoice, InvoiceLine } from '../../../models/invoice.model';
import { InvoicesService } from '../../services/invoices.service';
import { EstimatesService } from '../../../estimates/services/estimates.service';
import { CustomFieldsService } from '../../../../settings/services/custom-fields.service';
import { InvoiceActions } from '../../services/invoice-actions';
import { DocFormConfig, DocFormService, DocumentFormBase, addDays, ymd } from '../../../services/document-form-base';
import { INVOICE_RULES } from '../../services/invoice-validation';
import { invoiceLinesConfig } from '../../services/invoice-lines.config';
import { DocLinesConfig } from '../../../components/doc-lines-table/doc-lines.types';
import { DocLinesTableComponent } from '../../../components/doc-lines-table/doc-lines-table.component';
import { DocAttachmentsCardComponent } from '../../../components/doc-attachments-card/doc-attachments-card.component';
import { DocFormShellComponent } from '../../../components/doc-form-shell/doc-form-shell.component';
import { DocPartySectionComponent } from '../../../components/doc-party-section/doc-party-section.component';
import { DocTotalsComponent } from '../../../components/doc-totals/doc-totals.component';
import { WastePopupComponent, WastePopupData, WastePopupResult } from '../../components/waste-popup/waste-popup.component';

interface Term { value: string; label: string; days?: number; }

const TERMS: Term[] = [
  { value: 'net7', label: 'Net 7', days: 7 },
  { value: 'net10', label: 'Net 10', days: 10 },
  { value: 'net15', label: 'Net 15', days: 15 },
  { value: 'net30', label: 'Net 30', days: 30 },
  { value: 'net60', label: 'Net 60', days: 60 },
  { value: 'net90', label: 'Net 90', days: 90 },
  { value: 'endOfTheMonth', label: 'End of the month' },
  { value: 'onReceiptDue', label: 'On Receipt Due' },
  { value: 'custome', label: 'Custom' },
];

const dayDiff = (a: Date, b: Date) => Math.abs(Math.round((new Date(ymd(b)).getTime() - new Date(ymd(a)).getTime()) / 86_400_000));

/**
 * Invoices → create / edit / clone page (`/account/invoices/new`, `/:id`, `?cloned=yes`).
 * Built on the shared document-form base: this class only adds what is specific to invoices —
 * payment term + due date, the Delivery address rule, the salesperson, "Make Recurring".
 */
@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule,
    DocFormShellComponent, DocPartySectionComponent, SearchDropdownComponent, DatePickerComponent,
    DocLinesTableComponent, DocAttachmentsCardComponent, DocTotalsComponent, EntityCustomFieldsComponent,
  ],
  templateUrl: './invoice-form.component.html',
})
export class InvoiceFormComponent extends DocumentFormBase {
  private invoices = inject(InvoicesService);
  private aiDrafts = inject(AiDraftService);

  private estimatesApi = inject(EstimatesService);
  private customFieldDefs = inject(CustomFieldsService);

  /** `/account/invoices/convertFromEstimate/:estimateId` — a new invoice pre-filled from an estimate. */
  get estimateId(): string | null { return this.route.snapshot.paramMap.get('estimateId'); }
  get isConvert(): boolean { return !!this.estimateId; }

  get cfg(): DocFormConfig { return this.isConvert ? { ...this.baseCfg, primaryKind: 'list', menuKinds: ['print', 'share'] } : this.baseCfg; }

  private readonly baseCfg: DocFormConfig = {
    features: ['account/invoices'],
    routeBase: '/account/invoices',
    viewRoute: '/account/invoices/view',
    numberField: 'invoiceNumber',
    dateField: 'invoiceDate',
    numberModule: 'invoice',
    numberNameKey: 'INVOICES.FORM.INVOICE',
    numberModeKey: 'invo_invoice_number_mode',
    rules: INVOICE_RULES,
    privilegeRoot: 'invoiceSecurity',
    whatsappType: 'invoice',
    pdfName: 'invoice.pdf',
    titleKey: 'INVOICES.FORM.INVOICE',
    newCrumbKey: 'INVOICES.FORM.NEW_INVOICE',
    editCrumbKey: 'INVOICES.FORM.EDIT_INVOICE',
    listCrumbKey: 'INVOICES.LIST.INVOICES_LIST',
    dashboardCrumbKey: 'INVOICES.DASHBOARD',
    hasStatus: true,
    primaryKind: 'send',
    menuKinds: ['list', 'print', 'share', 'later'],
  };

  protected svc: DocFormService = {
    get: id => this.invoices.getInvoice(id),
    getNumber: () => this.invoices.getInvoiceNumber(),
    save: d => (this.isConvert ? this.invoices.convertToInvoice(this.estimateId!, d) : this.invoices.saveInvoice(d)),
    pdf: id => this.invoices.viewInvoicePdf(id),
    sendEmail: (payload, id) => this.invoices.sendInvoiceEmail({ ...payload, invoiceId: id }),
  };

  private actions = inject(InvoiceActions);

  readonly terms = TERMS;
  selectedTerm = 'net7';
  helperKey = '';
  helperParams: Record<string, any> | undefined;

  protected newDoc(): Invoice { return new Invoice(); }
  protected makeLinesConfig(): DocLinesConfig {
    return invoiceLinesConfig(() => this.doc!, this.lookups, {
      canAdjustPrice: () => this.actions.canAdjustPrice,
      canVoid: () => this.actions.canVoidItem,
      afterVoid: line => this.askWaste(line),
    });
  }

  /** Company option "waste": after a saved line is removed, ask whether it was wasted (and why, when a reason is required). */
  private async askWaste(line: InvoiceLine): Promise<void> {
    const opts = (this.company.settings()?.invoiceOptions ?? {}) as { enableWaste?: boolean; enableVoidReason?: boolean };
    if (!opts.enableWaste) return;
    const res = await this.modal.open<WastePopupComponent, WastePopupData, WastePopupResult | null>(WastePopupComponent, {
      size: 'md',
      data: { enableVoidReason: !!opts.enableVoidReason, voidReason: line.voidReason },
    }).afterClosed();
    if (!res) return;
    line.waste = res.isWaste;
    line.voidReason = res.wasteReason;
    this.markDirty();
  }

  get inv(): Invoice { return this.doc!; }
  get surchargeList(): any[] { return this.surcharges; }

  // ── base hooks ─────────────────────────────────────────────────────
  protected override async initNew(d: Invoice): Promise<void> {
    d.dueDate = ymd(addDays(new Date(), 7));
    if (this.isConvert) await this.fillFromEstimate(d);
  }

  /** Copies the estimate into the new invoice (customer, branch, lines, charges, notes, custom fields mapped by slug). */
  private async fillFromEstimate(d: Invoice): Promise<void> {
    const raw: any = await this.estimatesApi.getEstimateRaw(this.estimateId!);
    if (!raw) return;
    this.prefilled = true;
    const keep = { ...raw };
    for (const k of ['id', 'invoiceNumber', 'invoiceId', 'status', 'attachment', 'customFields', 'branchCustomFields', 'createdAt']) delete keep[k];
    d.ParseJson(keep);
    d.id = null;
    d.status = '';
    d.invoiceDate = new Date();
    d.dueDate = ymd(addDays(new Date(), 7));
    d.lines.forEach(l => { l.id = null; (l as any).invoiceId = ''; });
    d.customFields = await this.mapCustomFields(raw.customFields ?? {});
    if (d.customerId) {
      this.customerValue = { id: d.customerId, name: d.customerName, displayName: d.customerName, phone: '', email: '' };
      this.addresses = this.parseAddresses(await this.customersService.customerAddresses(d.customerId));
      const def = this.addresses.find(a => a.isDefault) ?? this.addresses[0];
      this.customerAddress = def?.title ?? '';
    }
  }

  /** Estimate custom-field values re-keyed to the invoice fields that share the same slug. */
  private async mapCustomFields(values: Record<string, any>): Promise<Record<string, any>> {
    const [from, to] = await Promise.all([this.customFieldDefs.getByType('estimate'), this.customFieldDefs.getByType('invoice')]);
    const out: Record<string, any> = {};
    for (const f of from) {
      const target = to.find(t => t.abbr && t.abbr === f.abbr && !t.isDeleted);
      if (target && values[f.id] != null) out[target.id] = values[f.id];
    }
    return out;
  }

  /** "Actions" dropdown of a saved invoice — items and behaviour come from the shared {@link InvoiceActions}. */
  actionsMenu(): DropdownMenuBtnItem[] {
    const d = this.doc;
    if (this.formStatus !== 'edit' || !d?.id) return [];
    return this.actions.menu(d, d.id, () => { this.dirty = false; this.form.markAsPristine(); this.afterSaveRoute(); });
  }

  protected override afterSaveRoute(): void {
    if (this.isConvert) void this.router.navigate(['/account/estimate']);
    else super.afterSaveRoute();
  }
  protected override canOpen(d: Invoice, cloned: boolean): boolean {
    return this.actions.openForEdit(d, cloned);
  }
  protected override prepareLoaded(d: Invoice): void { d.dueDate = d.dueDate == null ? d.invoiceDate : d.dueDate; }
  protected override async afterInit(): Promise<void> {
    await this.actions.refresh(this.inv.branchId || null); // the period lock decides whether Delete shows, as on the view / list
    const d = this.inv;
    if (this.formStatus === 'new') { d.paymentTerm = 'net7'; this.onTerm('net7'); }
    else { this.selectedTerm = d.paymentTerm ?? 'custome'; this.onTerm(this.selectedTerm, true); }
    if (this.formStatus === 'new' && this.route.snapshot.queryParamMap.get('aiDraft')) await this.applyAssistantDraft();
  }

  /**
   * Opened from the dashboard assistant: fills the new invoice with the products it prepared. Products are looked up
   * again here, with this invoice's branch and customer, so prices follow the normal pricing rules; the lines are added
   * through the same editor as "Add items in bulk". Nothing is saved: the user reviews the form and saves as usual.
   */
  private async applyAssistantDraft(): Promise<void> {
    const draft = this.aiDrafts.takeInvoice();
    if (!draft || !this.editor) return;
    const picks: { product: any; qty: number }[] = [];
    const missing: string[] = [];
    for (const l of draft.lines) {
      const cached = this.aiDrafts.products.get(l.productId);
      const fresh = cached?.name
        ? (await this.linesConfig.itemSearch(cached.name, { tags: [], page: 1 }))?.list?.find((p: any) => p.id === l.productId)
        : null;
      const product = fresh ?? cached;
      if (product) picks.push({ product, qty: l.qty });
      else missing.push(l.productId);
    }
    appendDraftLines(this.inv, this.editor, picks);
    if (draft.note) this.inv.note = draft.note;
    if (missing.length) this.toast.warning(this.lang.instant('ASSISTANT.DRAFT_MISSING'), missing.join(', '));
    this.markDirty();
  }
  protected override blockSave(): string | null {
    if (this.isDelivery && !this.customerAddress) {
      this.advancedOpen = true;
      return this.lang.instant('INVOICES.FORM.DELIVERY_ADDRESS_REQUIRED');
    }
    return null;
  }

  get isDelivery(): boolean { return (this.doc?.serviceName || '').toLowerCase() === 'delivery'; }
  override get dateLocked(): boolean {
    return (this.doc?.status === 'Paid' || this.doc?.status === 'Partially Paid') && this.formStatus !== 'clone';
  }

  override async onCustomer(c: CustomerMini | undefined): Promise<void> {
    await super.onCustomer(c);
    if (c) {
      this.inv.paymentTerm = c.paymentTerm ?? 'net7';
      this.onTerm(this.inv.paymentTerm!);
    }
    if (this.isDelivery && !this.customerAddress) this.advancedOpen = true;
  }

  // ── dates / terms ──────────────────────────────────────────────────
  termOf = () => TERMS.find(t => t.value === (this.inv?.paymentTerm ?? this.selectedTerm)) ?? null;
  termLabel = (t: Term) => t?.label ?? '';
  byValue = (a: Term, b: Term) => a?.value === b?.value;

  get invoiceDate(): Date { return this.cachedDate(this.inv.invoiceDate); }
  get dueDate(): Date { return this.cachedDate(this.inv.dueDate); }

  onInvoiceDate(v: any): void {
    const inv = this.inv;
    if (!(v instanceof Date)) return;
    inv.invoiceDate = v;
    if (ymd(v) > String(inv.dueDate).slice(0, 10)) inv.dueDate = ymd(v);
    this.onTerm(inv.paymentTerm ?? 'custome');
    this.markDirty();
  }

  onTermPick(t: Term | null): void {
    this.inv.paymentTerm = t?.value ?? 'custome';
    this.onTerm(this.inv.paymentTerm);
    this.markDirty();
  }

  /** Recomputes the due date for a term (unless `skipDue`) and the helper text under it. */
  onTerm(term: string, skipDue = false): void {
    const inv = this.doc;
    if (!inv?.invoiceDate) return;
    const base = new Date(inv.invoiceDate);
    const set = (d: Date) => { if (!skipDue) inv.dueDate = ymd(d); };
    const days = TERMS.find(t => t.value === term)?.days;

    if (days) { set(addDays(base, days)); this.helper('INVOICES.FORM.PAYMENT_DUE_IN_DAYS', { days }); }
    else if (term === 'endOfTheMonth') { set(new Date(base.getFullYear(), base.getMonth() + 1, 0)); this.helper('INVOICES.FORM.PAYMENT_DUE_END_OF_MONTH'); }
    else if (term === 'onReceiptDue') { set(base); this.helper('INVOICES.FORM.PAYMENT_DUE_ON_RECEIPT'); }
    else this.helper('INVOICES.FORM.PAYMENT_DUE_CUSTOM');
    this.selectedTerm = term;
  }

  private helper(key: string, params?: Record<string, any>): void { this.helperKey = key; this.helperParams = params; }

  onDueDate(v: any): void {
    const inv = this.inv;
    if (!(v instanceof Date)) return;
    inv.dueDate = ymd(v);
    const base = new Date(inv.invoiceDate);
    const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    let term = 'custome';
    if (ymd(v) === ymd(last)) term = 'endOfTheMonth';
    else if (ymd(v) === ymd(base)) term = 'onReceiptDue';
    else {
      const hit = TERMS.find(t => t.days === dayDiff(base, v));
      if (hit) term = hit.value;
    }
    inv.paymentTerm = term;
    this.selectedTerm = term;
    this.helper(term === 'custome' ? 'INVOICES.FORM.PAYMENT_DUE_CUSTOM' : this.helperKey, this.helperParams);
    this.markDirty();
  }

  /**
   * "Make Recurring": hands the current form to the recurring-invoice form
   * (`/account/recurring-invoice/new?fromInvoice=yes`), which reads it from session storage.
   */
  makeRecurring(): void {
    try { sessionStorage.setItem('recurringFromInvoice', JSON.stringify(this.doc)); } catch { /* storage unavailable */ }
    this.dirty = false;
    void this.router.navigate(['/account/recurring-invoice', 'new'], { queryParams: { fromInvoice: 'yes', invoiceId: (this.doc as any)?.id || null } });
  }
}
