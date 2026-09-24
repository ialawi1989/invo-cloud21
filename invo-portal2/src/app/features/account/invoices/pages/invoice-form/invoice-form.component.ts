import { ChangeDetectorRef, Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { AuthService } from '@core/auth/auth.service';
import { CompanyService } from '@core/auth/company.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { ApiService } from '@core/http/api.service';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { CustomerPickerComponent, CustomerMini } from '@shared/components/customer-picker/customer-picker.component';

import { Invoice } from '../../../models/invoice.model';
import { CustomerAddress } from '../../../customers/models/customer.model';
import { CustomersService } from '../../../customers/services/customers.service';
import { SalesLookupsService } from '../../../services/sales-lookups.service';
import { TransactionLockService } from '../../../services/transaction-lock.service';
import { InvoicesService } from '../../services/invoices.service';
import { DocumentLineEditor } from '../../../services/document-line-editor';
import { documentIssues, missingRequired, SaveMode } from '../../../services/document-validation';
import { INVOICE_RULES } from '../../services/invoice-validation';
import { invoiceLinesConfig } from '../../services/invoice-lines.config';
import { DocLinesConfig } from '../../../components/doc-lines-table/doc-lines.types';
import { DocLinesTableComponent } from '../../../components/doc-lines-table/doc-lines-table.component';
import { DocAttachment, DocAttachmentsComponent } from '../../../components/doc-attachments/doc-attachments.component';
import { InvoiceTotalsComponent } from '../../components/invoice-totals/invoice-totals.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { downloadPdf } from '@core/utils/pdf-download';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ModalService } from '@shared/modal/modal.service';
import { SendDocumentData, SendDocumentModalComponent } from '../../../components/send-document-modal/send-document-modal.component';
import { CustomerQuickCreateModalComponent } from '../../../customers/components/customer-quick-create-modal/customer-quick-create-modal.component';
import {
  DocumentNumberData, DocumentNumberModalComponent, DocumentNumberResult, NumberMode,
} from '../../../components/document-number-modal/document-number-modal.component';
import { EntityCustomFieldsComponent } from '../../../../settings/components/entity-custom-fields/entity-custom-fields.component';

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

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dayDiff = (a: Date, b: Date) => Math.abs(Math.round((new Date(ymd(b)).getTime() - new Date(ymd(a)).getTime()) / 86_400_000));

/**
 * Invoices → create / edit / clone page (`/account/invoices/new`, `/:id`, `?cloned=yes`).
 * Legacy `InvoiceFormComponent`: same fields, payment-term / due-date logic, delivery address
 * rule, required-field gating, status handling on save and the same `accounts/saveInvoice` call.
 */
@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, BreadcrumbsComponent,
    FormStickyFooterComponent, SearchDropdownComponent, DatePickerComponent, CustomerPickerComponent,
    DocLinesTableComponent, DocAttachmentsComponent, InvoiceTotalsComponent, DropdownMenuBtnComponent, MycurrencyPipe, EntityCustomFieldsComponent,
  ],
  templateUrl: './invoice-form.component.html',
  styleUrl: './invoice-form.component.scss',
})
export class InvoiceFormComponent implements OnInit, CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private company = inject(CompanyService);
  private privileges = inject(PrivilegeService);
  private invoices = inject(InvoicesService);
  private customersService = inject(CustomersService);
  private lookups = inject(SalesLookupsService);
  private lock = inject(TransactionLockService);
  private modal = inject(ModalService);

  readonly canAdjustPrice = this.privileges.check('invoiceSecurity.actions.adjPrice.access');
  readonly canVoidItem = this.privileges.check('invoiceSecurity.actions.voidItem.access');
  private readonly canEditOthers = this.privileges.check('invoiceSecurity.actions.edit.access');

  invoice: Invoice | null = null;
  editor: DocumentLineEditor | null = null;
  linesConfig!: DocLinesConfig;
  @ViewChild(DocLinesTableComponent) table?: DocLinesTableComponent;
  /** Inline field errors appear after the first failed save attempt. */
  showErrors = false;
  /** Hosts the custom-field controls and tracks dirtiness for the unsaved-changes guard. */
  form = new FormGroup({});
  formStatus: 'new' | 'edit' | 'clone' = 'new';
  breadcrumbs: BreadcrumbItem[] = [];
  surcharges: any[] = [];
  branches: any[] = [];
  addresses: CustomerAddress[] = [];
  customerValue: CustomerMini | null = null;
  selectedTerm = 'net7';
  helperKey = '';
  helperParams: Record<string, any> | undefined;
  minDate: Date | null = null;
  submitting = false;
  private loadedStatus = '';
  private dirty = false;
  private listParams: Record<string, any> = {};
  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;

  readonly terms = TERMS;
  customerAddress = '';

  async ngOnInit(): Promise<void> {
    await Promise.all([this.lang.loadFeature('account/invoices'), this.lang.loadFeature('account/components/doc-lines-table')]);
    const q = this.route.snapshot.queryParams;
    for (const k of ['pageNum', 'pageLimit', 'searchTerm', 'filterBySource', 'filterByBranch', 'filterByStatus', 'fromDate', 'toDate']) {
      if (q[k]) this.listParams[k] = q[k];
    }

    const id = this.route.snapshot.paramMap.get('id');
    const isNew = !id || id === '0' || id === 'new';
    const cloned = q['cloned'] === 'yes';
    this.formStatus = isNew ? 'new' : cloned ? 'clone' : 'edit';

    const [taxes, accounts, surcharges, branches] = await Promise.all([
      this.lookups.getTaxes(),
      this.lookups.getSalesAccounts(),
      this.lookups.getSurcharges({ page: 1, limit: 100 }),
      this.lookups.getBranches(),
    ]);
    this.surcharges = surcharges;
    this.branches = branches;

    if (!isNew) {
      const inv = await this.invoices.getInvoice(id!);
      if (!(await this.load(inv, cloned))) return;
    } else {
      const inv = new Invoice();
      const customerId = q['customerId'];
      if (customerId) {
        inv.customerId = customerId;
        await this.selectCustomerById(inv, customerId);
      }
      inv.dueDate = ymd(addDays(new Date(), 7));
      inv.invoiceNumber = await this.invoices.getInvoiceNumber();
      this.invoice = inv;
    }

    const inv = this.invoice!;
    this.editor = new DocumentLineEditor(inv, taxes, accounts);
    this.linesConfig = invoiceLinesConfig(() => this.invoice!, this.lookups, {
      canAdjustPrice: () => this.canAdjustPrice, canVoid: () => this.canVoidItem,
    });

    if (isNew) {
      inv.isInclusiveTax = this.companyInclusiveTax();
      if (this.branches.length) inv.branchId = this.branches[0].id;
      const first = inv.lines[0];
      if (first) {
        first.taxId = this.editor.defaultTax?.id ?? null;
        first.accountId = accounts[0]?.id ?? '';
        (first as any).tempId = `tmp-first`;
        this.editor.onChangeTax(first);
      }
    } else {
      inv.lines.forEach((l, i) => { l.index = i; if (!l.accountId) l.accountId = accounts[0]?.id ?? ''; });
      if (!inv.lines.length || inv.lines[inv.lines.length - 1].itemDetailsTemp) this.editor.addLine();
    }

    inv.calculateTotal();
    this.lockInfo = await this.lock.transactionsDate(inv.branchId);
    this.minDate = this.lockDate();

    if (this.formStatus === 'new') { inv.paymentTerm = 'net7'; this.onTerm('net7'); }
    else { this.selectedTerm = inv.paymentTerm ?? 'custome'; this.onTerm(this.selectedTerm, true); }

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('INVOICES.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('INVOICES.LIST.INVOICES_LIST'), routerLink: '/account/invoices' },
      { label: t(this.formStatus === 'new' ? 'INVOICES.FORM.NEW_INVOICE' : 'INVOICES.FORM.EDIT_INVOICE') },
    ];
    this.cdr.detectChanges();
  }

  private lockInfo: any = null;
  private lockDate(): Date | null {
    const d = this.lockInfo?.vatPaymentDate ?? this.lockInfo?.openingBalanceDate;
    return d ? new Date(String(d).split('T')[0]) : null;
  }

  private companyInclusiveTax(): boolean {
    return !!this.company.settings()?.isInclusiveTax;
  }

  /** Applies edit / clone rules to a loaded invoice. Returns false when the user may not edit it. */
  private async load(inv: Invoice, cloned: boolean): Promise<boolean> {
    this.loadedStatus = inv.status || '';
    if (inv.customerAddress == null) inv.customerAddress = new CustomerAddress();
    this.customerAddress = inv.customerAddress.title;

    if (!cloned && inv.employeeId != this.auth.currentEmployee?.id && !this.canEditOthers) {
      this.toast.error('COMMON.OPS', this.lang.instant('INVOICES.FORM.FORBIDDEN'));
      this.cancel();
      return false;
    }

    inv.calculateTotal();
    inv.dueDate = inv.dueDate == null ? inv.invoiceDate : inv.dueDate;

    if (cloned) {
      inv.invoiceNumber = await this.invoices.getInvoiceNumber();
      inv.id = null;
      inv.attachment = [];
      inv.invoiceDate = new Date();
      inv.lines.forEach(l => (l.id = null));
    }

    this.invoice = inv;
    if (inv.customerId) {
      this.customerValue = { id: inv.customerId, name: inv.customerName, displayName: inv.customerName, phone: '', email: '' };
      this.addresses = this.parseAddresses(await this.customersService.customerAddresses(inv.customerId));
    }
    return true;
  }

  // ── guard / getters ────────────────────────────────────────────────
  hasUnsavedChanges(): boolean { return !this.submitting && (this.dirty || this.form.dirty); }
  markDirty(): void { this.dirty = true; this.cdr.markForCheck(); }

  get isDelivery(): boolean { return (this.invoice?.serviceName || '').toLowerCase() === 'delivery'; }
  get mode(): SaveMode { return this.formStatus === 'edit' ? 'edit' : 'create'; }
  private linesValid(): boolean { return this.table?.isValid() ?? false; }
  get missing(): string[] { return this.invoice ? documentIssues(this.invoice, INVOICE_RULES, this.mode, this.linesValid()) : []; }
  get missingDraft(): string[] { return this.invoice ? documentIssues(this.invoice, INVOICE_RULES, 'draft', this.linesValid()) : []; }
  /** Inline error text for a header field (only after a failed save attempt). */
  fieldError(field: string): string {
    if (!this.showErrors || !this.invoice) return '';
    const key = missingRequired(this.invoice, INVOICE_RULES, this.mode)[field];
    return key ? this.lang.instant('DOC_LINES.ERR_REQUIRED') : '';
  }
  get canOfferDraft(): boolean { return this.formStatus !== 'edit' || this.loadedStatus === '' || this.loadedStatus === 'Draft'; }
  get saveDisabled(): boolean { return this.submitting; }
  get saveDraftDisabled(): boolean { return this.submitting; }
  get dateLocked(): boolean {
    return (this.invoice?.status === 'Paid' || this.invoice?.status === 'Partially Paid') && this.formStatus !== 'clone';
  }
  get branchLocked(): boolean {
    const inv = this.invoice!;
    return (this.formStatus === 'edit' && inv.source != 'Cloud') || inv.lines.some(l => l.batch != '' && l.serial != '');
  }
  missingTooltip(list: string[]): string {
    return list.map(k => this.lang.instant(k)).join('\n');
  }

  // ── customer / address ─────────────────────────────────────────────
  private parseAddresses(raw: any[]): CustomerAddress[] {
    return (raw ?? []).map(r => { const a = new CustomerAddress(); a.ParseJson(r); return a; });
  }

  private async selectCustomerById(inv: Invoice, customerId: string): Promise<void> {
    const c: any = await this.customersService.getCustomer(customerId);
    if (c) {
      inv.customerName = c.name;
      this.customerValue = { id: c.id, name: c.name, displayName: c.name, phone: c.phone ?? '', email: c.email ?? '' };
    }
    await this.loadAddresses(inv, customerId);
  }

  /** "New Customer" in the picker: create in a modal, then select the new customer. */
  async createCustomer(): Promise<void> {
    const res = await this.modal.open<CustomerQuickCreateModalComponent, void, { customerId: string; customerName: string } | null>(
      CustomerQuickCreateModalComponent, { size: 'lg' },
    ).afterClosed();
    if (!res?.customerId) return;
    const c: any = await this.customersService.getCustomer(res.customerId);
    await this.onCustomer({
      id: c.id, name: c.name, phone: c.phone ?? '', email: c.email ?? '', paymentTerm: c.paymentTerm,
      displayName: c.saluation ? `${c.saluation} ${c.name}` : c.name,
    });
  }

  async onCustomer(c: CustomerMini | undefined): Promise<void> {
    const inv = this.invoice!;
    this.customerValue = c ?? null;
    inv.customerId = c?.id ?? null;
    inv.customerName = c?.name ?? '';
    if (c) {
      inv.paymentTerm = c.paymentTerm ?? 'net7';
      this.onTerm(inv.paymentTerm!);
      await this.loadAddresses(inv, c.id);
    } else {
      this.addresses = [];
      this.setAddress('');
    }
    this.applyDeliveryGuard();
    this.markDirty();
  }

  private async loadAddresses(inv: Invoice, customerId: string): Promise<void> {
    this.addresses = this.parseAddresses(await this.customersService.customerAddresses(customerId));
    const def = this.addresses.find(a => a.isDefault) ?? this.addresses[0];
    this.setAddress(def?.title ?? '');
  }

  setAddress(title: string): void {
    const inv = this.invoice!;
    this.customerAddress = title;
    inv.customerAddress = this.addresses.find(a => a.title == title) ?? new CustomerAddress();
    this.markDirty();
  }
  addressOf = () => this.addresses.find(a => a.title == this.customerAddress) ?? null;
  addressLabel = (a: CustomerAddress) => a?.title ?? '';
  byTitle = (a: CustomerAddress, b: CustomerAddress) => a?.title === b?.title;

  advancedOpen = false;
  private applyDeliveryGuard(): void {
    if (this.isDelivery && !this.customerAddress) this.advancedOpen = true;
  }

  // ── branch / employee ──────────────────────────────────────────────
  branchOf = () => this.branches.find(b => b.id == this.invoice?.branchId) ?? null;
  branchLabel = (b: any) => b?.name ?? '';
  byId = (a: any, b: any) => a?.id === b?.id;

  async onBranch(b: any): Promise<void> {
    const inv = this.invoice!;
    inv.branchId = b?.id ?? '';
    inv.lines.forEach(l => { l.serial = ''; l.batch = ''; });
    this.lockInfo = await this.lock.transactionsDate(inv.branchId);
    this.minDate = this.lockDate();
    this.markDirty();
  }

  employeeValue: any = null;
  loadEmployees = async (p: { page: number; pageSize: number; search: string }) => {
    const res = await this.api.request<any>(this.api.post('employee/getEmployeeList', {
      page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {}, employeeId: this.invoice?.salesEmployeeId || null,
    }));
    const list = res?.data?.list ?? [];
    return { items: list, hasMore: p.page < (res?.data?.pageCount ?? 1) };
  };
  onEmployee(e: any): void {
    this.invoice!.salesEmployeeId = e?.id ?? '';
    this.employeeValue = e ?? null;
    this.markDirty();
  }

  // ── dates / terms ──────────────────────────────────────────────────
  termOf = () => TERMS.find(t => t.value === (this.invoice?.paymentTerm ?? this.selectedTerm)) ?? null;
  termLabel = (t: Term) => t?.label ?? '';
  byValue = (a: Term, b: Term) => a?.value === b?.value;

  // Memoised so the date-picker input keeps the same Date instance between change-detection passes.
  private dateCache = new Map<string, Date>();
  private cachedDate(raw: any): Date {
    const key = raw instanceof Date ? raw.getTime().toString() : String(raw);
    let d = this.dateCache.get(key);
    if (!d) { d = new Date(raw); this.dateCache.set(key, d); }
    return d;
  }
  get invoiceDate(): Date { return this.cachedDate(this.invoice!.invoiceDate); }
  get dueDate(): Date { return this.cachedDate(this.invoice!.dueDate); }

  onInvoiceDate(v: any): void {
    const inv = this.invoice!;
    if (!(v instanceof Date)) return;
    inv.invoiceDate = v;
    if (ymd(v) > String(inv.dueDate).slice(0, 10)) inv.dueDate = ymd(v);
    this.onTerm(inv.paymentTerm ?? 'custome');
    this.markDirty();
  }

  onTermPick(t: Term | null): void {
    this.invoice!.paymentTerm = t?.value ?? 'custome';
    this.onTerm(this.invoice!.paymentTerm);
    this.markDirty();
  }

  /** Recomputes the due date for a term (unless `skipDue`) and the helper text under it. */
  onTerm(term: string, skipDue = false): void {
    const inv = this.invoice;
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
    const inv = this.invoice!;
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

  // ── save ───────────────────────────────────────────────────────────
  /** Saving never downgrades a status the server already assigned (Paid / Partially Paid / …). */
  private resolveStatus(requested: string): string {
    if (requested === 'Draft') return 'Draft';
    const cur = this.loadedStatus;
    if (this.formStatus === 'edit' && cur && cur !== 'Draft' && cur !== 'Open') return cur;
    return requested;
  }

  saveOpen(): void { void this.save('Open', 'send'); }
  saveDraft(): void { void this.save('Draft'); }

  /** Extra save actions (the caret of the Save button). */
  saveMenu(): DropdownMenuBtnItem[] {
    const t = (k: string) => this.lang.instant(k);
    return [
      { label: t('COMMON.SAVE'), click: () => void this.save('Open'), disabled: this.submitting, danger: false },
      { label: t('INVOICES.FORM.SAVE_PRINT'), click: () => void this.save('Open', 'print'), disabled: this.submitting, danger: false },
      { label: t('INVOICES.FORM.SAVE_SHARE'), click: () => void this.save('Open', 'share'), disabled: this.submitting, danger: false },
      { label: t('INVOICES.FORM.SAVE_LATER'), click: () => void this.save('Open', 'later'), disabled: this.submitting, danger: false },
    ];
  }

  // ── invoice number preferences (auto-generate vs manual) ───────────
  private readonly modeKey = 'invo_invoice_number_mode';
  numberMode: NumberMode = ((): NumberMode => {
    try { return localStorage.getItem(this.modeKey) === 'manual' ? 'manual' : 'auto'; } catch { return 'auto'; }
  })();

  async openNumberPrefs(): Promise<void> {
    const res = await this.modal.open<DocumentNumberModalComponent, DocumentNumberData, DocumentNumberResult | null>(DocumentNumberModalComponent, {
      size: 'md',
      data: { module: 'invoice', nameKey: 'INVOICES.FORM.INVOICE', mode: this.numberMode },
    }).afterClosed();
    if (!res) return;
    this.numberMode = res.mode;
    try { localStorage.setItem(this.modeKey, res.mode); } catch { /* storage unavailable */ }
    if (this.formStatus !== 'edit') {
      this.invoice!.invoiceNumber = res.mode === 'manual' ? '' : await this.invoices.getInvoiceNumber();
      this.markDirty();
    }
    this.cdr.markForCheck();
  }

  /** Sum of the quantities of the real (non-blank, non-voided) lines — shown in the footer. */
  get totalQuantity(): number {
    return (this.invoice?.lines ?? [])
      .filter(l => (l.productId || l.note) && !l.isVoided)
      .reduce((s, l) => s + (Number(l.qty) || 0), 0);
  }

  /**
   * "Make Recurring": hands the current form to the recurring-invoice form, which reads it from
   * session storage. Only navigates once that screen exists in the router.
   */
  makeRecurring(): void {
    const exists = this.router.config.some(r => (r.path ?? '').startsWith('account/recurring-invoice'));
    if (!exists) {
      this.toast.info?.('INVOICES.FORM.RECURRING_SOON');
      return;
    }
    try { sessionStorage.setItem('recurringFromInvoice', JSON.stringify(this.invoice)); } catch { /* storage unavailable */ }
    this.dirty = false;
    void this.router.navigate(['/account/recurring-invoice', 'new'], { queryParams: { fromInvoice: 'yes' } });
  }

  onAttachments(list: DocAttachment[]): void {
    this.invoice!.attachment = list;
    this.markDirty();
  }

  private async afterSave(kind: 'list' | 'print' | 'share' | 'later' | 'send', id: string | null): Promise<void> {
    if (id && kind === 'send') await this.openSend(id);
    if (id && kind === 'print') {
      const pdf = await this.invoices.viewInvoicePdf(id);
      if (pdf) this.printPdf(pdf);
    } else if (id && kind === 'share') {
      const pdf = await this.invoices.viewInvoicePdf(id);
      if (pdf) await this.sharePdf(pdf);
    }
    void this.router.navigate(['/account/invoices'], { queryParams: this.listParams });
  }

  /** Send dialog after "Save and Send": customer email pre-filled, WhatsApp when the customer has a phone. */
  private async openSend(id: string): Promise<void> {
    const inv = this.invoice!;
    let email = inv.customerEmail || '';
    let phone = inv.customerPhone || inv.customerContact || '';
    if (inv.customerId && (!email || !phone)) {
      try {
        const c: any = await this.customersService.getCustomer(inv.customerId);
        email = email || c?.email || '';
        phone = phone || c?.phone || c?.mobile || '';
      } catch { /* the modal lets the user type the address */ }
    }
    await this.modal.open<SendDocumentModalComponent, SendDocumentData, boolean>(SendDocumentModalComponent, {
      size: 'md',
      data: {
        emails: email ? [email] : [],
        sendEmail: payload => this.invoices.sendInvoiceEmail({ ...payload, invoiceId: id }),
        whatsapp: { type: 'invoice', id, phone },
      },
    }).afterClosed();
  }

  private printPdf(base64: string): void {
    const bytes = atob(String(base64).replace('data:application/pdf;base64,', ''));
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><body style="margin:0"><iframe id="pdf" src="${url}" style="width:100%;height:100vh;border:none"></iframe><script>document.getElementById('pdf').onload=function(){this.contentWindow.focus();this.contentWindow.print();}<\/script></body></html>`);
    w.document.close();
  }

  private async sharePdf(base64: string): Promise<void> {
    const bytes = atob(String(base64).replace('data:application/pdf;base64,', ''));
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const file = new File([arr], 'invoice.pdf', { type: 'application/pdf' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Invoice' });
    else downloadPdf(base64);
  }

  private async save(status: 'Open' | 'Draft', after: 'list' | 'print' | 'share' | 'later' | 'send' = 'list'): Promise<void> {
    const inv = this.invoice!;
    if (this.submitting) return;

    inv.lines = inv.lines.filter(l => l.note != '' || l.productId != '');

    if (this.isDelivery && !this.customerAddress) {
      this.advancedOpen = true;
      this.toast.error('COMMON.OPS', this.lang.instant('INVOICES.FORM.DELIVERY_ADDRESS_REQUIRED'));
      return;
    }
    const issues = status === 'Draft' ? this.missingDraft : this.missing;
    if (issues.length) {
      this.showErrors = true;
      this.toast.error('COMMON.OPS', issues.map(k => this.lang.instant(k)).join(', '));
      this.editor?.addLine();
      return;
    }

    inv.status = this.resolveStatus(status);
    inv.customerAddress = (this.addresses.find(a => a.title == this.customerAddress) as CustomerAddress) ?? new CustomerAddress();

    this.submitting = true;
    try {
      const res: any = await this.invoices.saveInvoice(inv);
      if (res?.success) {
        this.dirty = false;
        this.form.markAsPristine();
        this.toast.success('COMMON.SAVED_OK');
        await this.afterSave(after, inv.id || res?.data?.id || null);
      } else {
        this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
        // Lines were filtered for the request; restore the trailing empty row.
        this.editor?.addLine();
      }
    } finally {
      this.submitting = false;
      this.cdr.markForCheck();
    }
  }

  cancel(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigate(['/account/invoices'], { queryParams: this.listParams });
  }

  view(): void {
    this.dirty = false;
    this.form.markAsPristine();
    void this.router.navigate(['/account/invoices/view', this.route.snapshot.paramMap.get('id')], { queryParams: this.listParams });
  }
}
