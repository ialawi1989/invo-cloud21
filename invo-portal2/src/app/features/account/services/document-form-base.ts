import { ChangeDetectorRef, Directive, OnInit, ViewChild, inject } from '@angular/core';
import { Location } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { AuthService } from '@core/auth/auth.service';
import { CompanyService } from '@core/auth/company.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { ApiService } from '@core/http/api.service';
import { downloadPdf } from '@core/utils/pdf-download';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ToastService } from '@shared/components/toast/toast.service';
import type { CustomerMini } from '@shared/components/customer-picker/customer-picker.component';
import { ModalService } from '@shared/modal/modal.service';

import type { PrefixModule } from '../../settings/services/prefix-settings.service';
import { Invoice } from '../models/invoice.model';
import { CustomerAddress } from '../customers/models/customer.model';
import { CustomersService } from '../customers/services/customers.service';
import { CustomerAdvancedSearchModalComponent } from '../customers/components/customer-advanced-search-modal/customer-advanced-search-modal.component';
import { CustomerQuickCreateModalComponent } from '../customers/components/customer-quick-create-modal/customer-quick-create-modal.component';
import { DocLinesConfig } from '../components/doc-lines-table/doc-lines.types';
import { DocLinesTableComponent } from '../components/doc-lines-table/doc-lines-table.component';
import { DocAttachment } from '../components/doc-attachments/doc-attachments.component';
import { DocumentNumberData, DocumentNumberModalComponent, DocumentNumberResult, NumberMode } from '../components/document-number-modal/document-number-modal.component';
import { ManageSalespersonsModalComponent, SalespersonRow } from '../components/manage-salespersons-modal/manage-salespersons-modal.component';
import { SendDocumentData, SendDocumentModalComponent } from '../components/send-document-modal/send-document-modal.component';
import { DocumentLineEditor } from './document-line-editor';
import { documentIssues, missingRequired, RequiredRule, SaveMode } from './document-validation';
import { SalesLookupsService } from './sales-lookups.service';
import { TransactionLockService } from './transaction-lock.service';

/** What a sales-document form needs from its API service. */
export interface DocFormService {
  get(id: string): Promise<any>;
  getNumber(): Promise<string>;
  save(doc: any): Promise<any>;
  pdf(id: string): Promise<any>;
  sendEmail(payload: any, id: string): Promise<any>;
}

export type AfterSave = 'list' | 'print' | 'share' | 'later' | 'send';

/** Per-document settings of a form built on {@link DocumentFormBase}. */
export interface DocFormConfig {
  /** i18n feature namespaces to load (the document's own; the shared ones are always loaded). */
  features: string[];
  /** List route, e.g. `/account/invoices`. */
  routeBase: string;
  /** Route of the read-only view, e.g. `/account/invoices/view`. */
  viewRoute: string;
  /** Property holding the document number (`invoiceNumber`, `estimateNumber`). */
  numberField: string;
  /** Property holding the document date (`invoiceDate`, `estimateDate`). */
  dateField: string;
  /** `document-number-modal` module + i18n name key + localStorage key of the auto/manual choice. */
  numberModule: PrefixModule;
  numberNameKey: string;
  numberModeKey: string;
  rules: RequiredRule[];
  /** Privilege root, e.g. `invoiceSecurity`. */
  privilegeRoot: string;
  whatsappType: string;
  pdfName: string;
  /** i18n keys: page title (new / edit), list crumb, dashboard crumb. */
  titleKey: string;
  newCrumbKey: string;
  editCrumbKey: string;
  listCrumbKey: string;
  dashboardCrumbKey: string;
  /** The document has Draft / Open statuses (invoices) or none (estimates). */
  hasStatus: boolean;
  /** Which action the big Save button performs, and what the caret menu offers. */
  primaryKind: AfterSave;
  menuKinds: AfterSave[];
}

const SAVE_LABEL: Record<AfterSave, string> = {
  list: 'DOC_FORM.SAVE', send: 'DOC_FORM.SAVE_AND_SEND', print: 'DOC_FORM.SAVE_PRINT', share: 'DOC_FORM.SAVE_SHARE', later: 'DOC_FORM.SAVE_LATER',
};

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/**
 * Everything the sales-document forms (invoice, estimate, credit note, …) have in common: loading
 * (new / edit / clone), lookups, the line editor + validation, customer / address / branch /
 * salesperson handling, number preferences, attachments, the save pipeline (validate → save →
 * send / print / share → back to the list) and cancel / view. A concrete form only supplies its
 * config, its API service, a factory for the empty document, its line-table config and whatever
 * fields are specific to it (terms + due date, expiry date, …).
 *
 * Templates use `<app-doc-form-shell>` + `<app-doc-party-section>` + `<app-doc-lines-table>` +
 * `<app-doc-totals>`, so the pages of every document look and behave the same.
 */
@Directive()
export abstract class DocumentFormBase implements OnInit, CanLeaveComponent {
  protected route = inject(ActivatedRoute);
  protected router = inject(Router);
  protected location = inject(Location);
  protected lang = inject(LanguageService);
  protected toast = inject(ToastService);
  protected cdr = inject(ChangeDetectorRef);
  protected api = inject(ApiService);
  protected auth = inject(AuthService);
  protected company = inject(CompanyService);
  protected privileges = inject(PrivilegeService);
  protected customersService = inject(CustomersService);
  protected lookups = inject(SalesLookupsService);
  protected lock = inject(TransactionLockService);
  protected modal = inject(ModalService);

  abstract readonly cfg: DocFormConfig;
  protected abstract svc: DocFormService;
  protected abstract newDoc(): Invoice;
  protected abstract makeLinesConfig(): DocLinesConfig;

  doc: Invoice | null = null;
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
  customerAddress = '';
  minDate: Date | null = null;
  submitting = false;
  advancedOpen = false;

  protected loadedStatus = '';
  protected dirty = false;
  protected listParams: Record<string, any> = {};
  protected canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  protected lockInfo: any = null;
  protected accounts: any[] = [];
  /** A new document already filled from another one (estimate → invoice): skip the brand-new defaults. */
  protected prefilled = false;

  // ── hooks for the concrete form ────────────────────────────────────
  /** Extra defaults of a brand-new document (before its number is fetched). */
  protected initNew(_doc: Invoice): Promise<void> | void {}
  /** Whether the current user may open this loaded document for editing. */
  protected canOpen(_doc: Invoice, _cloned: boolean): boolean { return true; }
  /** Adjustments after a document was loaded (edit / clone) — clone resets already applied. */
  protected prepareLoaded(_doc: Invoice, _cloned: boolean): void {}
  /** Runs once the editor exists and the document is fully set up. */
  protected afterInit(_isNew: boolean): Promise<void> | void {}
  /** Extra save-blocking check; return the toast text to block the save. */
  protected blockSave(_doc: Invoice, _status: 'Open' | 'Draft'): string | null { return null; }
  /** Route the form returns to after a successful save. */
  protected afterSaveRoute(): void { void this.router.navigate([this.cfg.routeBase], { queryParams: this.listParams }); }

  async ngOnInit(): Promise<void> {
    this.readNumberMode();
    await Promise.all([
      ...this.cfg.features.map(f => this.lang.loadFeature(f)),
      this.lang.loadFeature('account/components/doc-lines-table'),
      this.lang.loadFeature('account/customers'),
    ]);
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
    this.accounts = accounts;
    this.surcharges = surcharges;
    this.branches = branches;

    if (!isNew) {
      const d = await this.svc.get(id!);
      if (!(await this.load(d, cloned))) return;
    } else {
      const d = this.newDoc();
      const customerId = q['customerId'];
      if (customerId) {
        d.customerId = customerId;
        await this.selectCustomerById(d, customerId);
      }
      await this.initNew(d);
      (d as any)[this.cfg.numberField] = await this.svc.getNumber();
      this.doc = d;
    }

    const d = this.doc!;
    this.editor = new DocumentLineEditor(d, taxes, accounts);
    this.linesConfig = this.makeLinesConfig();

    if (isNew && !this.prefilled) {
      d.isInclusiveTax = !!this.company.settings()?.isInclusiveTax;
      if (this.branches.length) d.branchId = this.branches[0].id;
      const first = d.lines[0];
      if (first) {
        first.taxId = this.editor.defaultTax?.id ?? null;
        first.accountId = accounts[0]?.id ?? '';
        (first as any).tempId = 'tmp-first';
        this.editor.onChangeTax(first);
      }
    } else {
      d.lines.forEach((l, i) => { l.index = i; if (!l.accountId) l.accountId = accounts[0]?.id ?? ''; });
      if (!d.lines.length || d.lines[d.lines.length - 1].itemDetailsTemp) this.editor.addLine();
    }

    d.calculateTotal();
    this.lockInfo = await this.lock.transactionsDate(d.branchId);
    this.minDate = this.lockDate();
    await this.afterInit(isNew);

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t(this.cfg.dashboardCrumbKey), routerLink: '/dashboard' },
      { label: t(this.cfg.listCrumbKey), routerLink: this.cfg.routeBase },
      { label: t(this.formStatus === 'new' ? this.cfg.newCrumbKey : this.cfg.editCrumbKey) },
    ];
    this.cdr.detectChanges();
  }

  protected lockDate(): Date | null {
    const d = this.lockInfo?.vatPaymentDate ?? this.lockInfo?.openingBalanceDate;
    return d ? new Date(String(d).split('T')[0]) : null;
  }

  /** Applies edit / clone rules to a loaded document. Returns false when the user may not edit it. */
  private async load(d: Invoice, cloned: boolean): Promise<boolean> {
    this.loadedStatus = d.status || '';
    if (d.customerAddress == null) d.customerAddress = new CustomerAddress();
    this.customerAddress = d.customerAddress.title;

    if (!cloned && !this.canOpen(d, cloned)) {
      this.toast.error('COMMON.OPS', this.lang.instant('DOC_FORM.FORBIDDEN'));
      this.cancel();
      return false;
    }

    d.calculateTotal();
    this.prepareLoaded(d, cloned);

    if (cloned) {
      (d as any)[this.cfg.numberField] = await this.svc.getNumber();
      d.id = null;
      d.attachment = [];
      (d as any)[this.cfg.dateField] = new Date();
      d.lines.forEach(l => (l.id = null));
    }

    this.doc = d;
    if (d.customerId) {
      this.customerValue = { id: d.customerId, name: d.customerName, displayName: d.customerName, phone: '', email: '' };
      this.addresses = this.parseAddresses(await this.customersService.customerAddresses(d.customerId));
    }
    return true;
  }

  // ── guard / getters ────────────────────────────────────────────────
  hasUnsavedChanges(): boolean { return !this.submitting && (this.dirty || this.form.dirty); }
  markDirty(): void { this.dirty = true; this.cdr.markForCheck(); }

  get mode(): SaveMode { return this.formStatus === 'edit' ? 'edit' : 'create'; }
  private linesValid(): boolean { return this.table?.isValid() ?? false; }
  private issues(mode: SaveMode): string[] {
    return this.doc ? documentIssues(this.doc, this.cfg.rules, mode, this.linesValid(), this.table?.firstIssue() ?? undefined) : [];
  }
  get missing(): string[] { return this.issues(this.mode); }
  get missingDraft(): string[] { return this.issues('draft'); }
  /** Inline error text for a header field (only after a failed save attempt). */
  fieldError(field: string): string {
    if (!this.showErrors || !this.doc) return '';
    return missingRequired(this.doc, this.cfg.rules, this.mode)[field] ? this.lang.instant('DOC_LINES.ERR_REQUIRED') : '';
  }
  get canOfferDraft(): boolean {
    return this.cfg.hasStatus && (this.formStatus !== 'edit' || this.loadedStatus === '' || this.loadedStatus === 'Draft');
  }
  get dateLocked(): boolean { return false; }
  get branchLocked(): boolean {
    const d = this.doc!;
    return (this.formStatus === 'edit' && d.source != 'Cloud') || d.lines.some(l => l.batch != '' && l.serial != '');
  }
  get docDate(): Date { return this.cachedDate((this.doc as any)[this.cfg.dateField]); }
  /** Sum of the quantities of the real (non-blank, non-voided) lines — shown in the footer. */
  get totalQuantity(): number {
    return (this.doc?.lines ?? [])
      .filter(l => (l.productId || l.note) && !l.isVoided)
      .reduce((s, l) => s + (Number(l.qty) || 0), 0);
  }

  // Memoised so the date-picker input keeps the same Date instance between change-detection passes.
  private dateCache = new Map<string, Date>();
  protected cachedDate(raw: any): Date {
    const key = raw instanceof Date ? raw.getTime().toString() : String(raw);
    let d = this.dateCache.get(key);
    if (!d) { d = new Date(raw); this.dateCache.set(key, d); }
    return d;
  }

  // ── customer / address ─────────────────────────────────────────────
  protected parseAddresses(raw: any[]): CustomerAddress[] {
    return (raw ?? []).map(r => { const a = new CustomerAddress(); a.ParseJson(r); return a; });
  }

  protected async selectCustomerById(d: Invoice, customerId: string): Promise<void> {
    const c: any = await this.customersService.getCustomer(customerId);
    if (c) {
      d.customerName = c.name;
      this.customerValue = { id: c.id, name: c.name, displayName: c.name, phone: c.phone ?? '', email: c.email ?? '' };
    }
    await this.loadAddresses(d, customerId);
  }

  async advancedCustomerSearch(): Promise<void> {
    const c = await this.modal.open<CustomerAdvancedSearchModalComponent, void, CustomerMini | null>(
      CustomerAdvancedSearchModalComponent, { size: 'lg' },
    ).afterClosed();
    if (c) await this.onCustomer(c);
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

  /** Called when the customer changes; forms with customer-driven defaults (payment term) extend it. */
  async onCustomer(c: CustomerMini | undefined): Promise<void> {
    const d = this.doc!;
    this.customerValue = c ?? null;
    d.customerId = c?.id ?? null;
    d.customerName = c?.name ?? '';
    if (c) await this.loadAddresses(d, c.id);
    else { this.addresses = []; this.setAddress(''); }
    this.markDirty();
  }

  protected async loadAddresses(d: Invoice, customerId: string): Promise<void> {
    this.addresses = this.parseAddresses(await this.customersService.customerAddresses(customerId));
    const def = this.addresses.find(a => a.isDefault) ?? this.addresses[0];
    this.setAddress(def?.title ?? '');
  }

  setAddress(title: string): void {
    this.customerAddress = title;
    this.doc!.customerAddress = this.addresses.find(a => a.title == title) ?? new CustomerAddress();
    this.markDirty();
  }

  // ── branch / salesperson ───────────────────────────────────────────
  branchOf = () => this.branches.find(b => b.id == this.doc?.branchId) ?? null;
  branchLabel = (b: any) => b?.name ?? '';
  byId = (a: any, b: any) => a?.id === b?.id;

  async onBranch(b: any): Promise<void> {
    const d = this.doc!;
    d.branchId = b?.id ?? '';
    d.lines.forEach(l => { l.serial = ''; l.batch = ''; });
    this.lockInfo = await this.lock.transactionsDate(d.branchId);
    this.minDate = this.lockDate();
    this.markDirty();
  }

  employeeValue: any = null;
  loadEmployees = async (p: { page: number; pageSize: number; search: string }) => {
    const res = await this.api.request<any>(this.api.post('employee/getEmployeeList', {
      page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {}, employeeId: this.doc?.salesEmployeeId || null, salesPersonsOnly: true,
    }));
    const list = res?.data?.list ?? [];
    return { items: list, hasMore: p.page < (res?.data?.pageCount ?? 1) };
  };

  /** "Manage Salespersons" in the dropdown footer: the flagged employees in a dialog; picking one selects it. */
  async manageSalespersons(): Promise<void> {
    const picked = await this.modal.open<ManageSalespersonsModalComponent, void, SalespersonRow | null>(
      ManageSalespersonsModalComponent, { size: 'lg' },
    ).afterClosed();
    if (picked) this.onEmployee(picked);
  }

  onEmployee(e: any): void {
    this.doc!.salesEmployeeId = e?.id ?? '';
    this.employeeValue = e ?? null;
    this.markDirty();
  }

  // ── document number preferences (auto-generate vs manual) ──────────
  numberMode: NumberMode = 'auto';
  protected readNumberMode(): void {
    try { this.numberMode = localStorage.getItem(this.cfg.numberModeKey) === 'manual' ? 'manual' : 'auto'; } catch { this.numberMode = 'auto'; }
  }

  async openNumberPrefs(): Promise<void> {
    const res = await this.modal.open<DocumentNumberModalComponent, DocumentNumberData, DocumentNumberResult | null>(DocumentNumberModalComponent, {
      size: 'md',
      data: { module: this.cfg.numberModule, nameKey: this.cfg.numberNameKey, mode: this.numberMode },
    }).afterClosed();
    if (!res) return;
    this.numberMode = res.mode;
    try { localStorage.setItem(this.cfg.numberModeKey, res.mode); } catch { /* storage unavailable */ }
    if (this.formStatus !== 'edit') {
      (this.doc as any)[this.cfg.numberField] = res.mode === 'manual' ? '' : await this.svc.getNumber();
      this.markDirty();
    }
    this.cdr.markForCheck();
  }

  onAttachments(list: DocAttachment[]): void {
    this.doc!.attachment = list;
    this.markDirty();
  }

  // ── save ───────────────────────────────────────────────────────────
  get saveLabelKey(): string { return SAVE_LABEL[this.cfg.primaryKind]; }

  /** Saving never downgrades a status the server already assigned (Paid / Partially Paid / …). */
  protected resolveStatus(requested: string): string {
    if (!this.cfg.hasStatus) return this.loadedStatus;
    if (requested === 'Draft') return 'Draft';
    const cur = this.loadedStatus;
    if (this.formStatus === 'edit' && cur && cur !== 'Draft' && cur !== 'Open') return cur;
    return requested;
  }

  savePrimary(): void { void this.save('Open', this.cfg.primaryKind); }
  saveDraft(): void { void this.save('Draft'); }

  /** Extra save actions (the caret of the Save button). */
  saveMenu(): DropdownMenuBtnItem[] {
    return this.cfg.menuKinds.map(kind => ({
      label: this.lang.instant(SAVE_LABEL[kind]), click: () => void this.save('Open', kind), disabled: this.submitting, danger: false,
    }));
  }

  private async afterSave(kind: AfterSave, id: string | null): Promise<void> {
    if (id && kind === 'send') await this.openSend(id);
    if (id && kind === 'print') {
      const pdf = await this.svc.pdf(id);
      if (pdf) this.printPdf(pdf);
    } else if (id && kind === 'share') {
      const pdf = await this.svc.pdf(id);
      if (pdf) await this.sharePdf(pdf);
    }
    this.afterSaveRoute();
  }

  /** Send dialog after "Save and Send": customer email pre-filled, WhatsApp when the customer has a phone. */
  private async openSend(id: string): Promise<void> {
    const d = this.doc!;
    let email = d.customerEmail || '';
    let phone = d.customerPhone || d.customerContact || '';
    if (d.customerId && (!email || !phone)) {
      try {
        const c: any = await this.customersService.getCustomer(d.customerId);
        email = email || c?.email || '';
        phone = phone || c?.phone || c?.mobile || '';
      } catch { /* the modal lets the user type the address */ }
    }
    await this.modal.open<SendDocumentModalComponent, SendDocumentData, boolean>(SendDocumentModalComponent, {
      size: 'md',
      data: {
        emails: email ? [email] : [],
        sendEmail: payload => this.svc.sendEmail(payload, id),
        whatsapp: { type: this.cfg.whatsappType, id, phone },
      },
    }).afterClosed();
  }

  private pdfBytes(base64: string): Uint8Array {
    const bytes = atob(String(base64).replace('data:application/pdf;base64,', ''));
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return arr;
  }

  private printPdf(base64: string): void {
    const url = URL.createObjectURL(new Blob([this.pdfBytes(base64) as BlobPart], { type: 'application/pdf' }));
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><body style="margin:0"><iframe id="pdf" src="${url}" style="width:100%;height:100vh;border:none"></iframe><script>document.getElementById('pdf').onload=function(){this.contentWindow.focus();this.contentWindow.print();}<\/script></body></html>`);
    w.document.close();
  }

  private async sharePdf(base64: string): Promise<void> {
    const file = new File([this.pdfBytes(base64) as BlobPart], this.cfg.pdfName, { type: 'application/pdf' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: this.cfg.pdfName });
    else downloadPdf(base64);
  }

  protected async save(status: 'Open' | 'Draft', after: AfterSave = 'list'): Promise<void> {
    const d = this.doc!;
    if (this.submitting) return;

    d.lines = d.lines.filter(l => l.note != '' || l.productId != '');

    const blocked = this.blockSave(d, status);
    if (blocked) { this.toast.error('COMMON.OPS', blocked); return; }

    const issues = status === 'Draft' ? this.missingDraft : this.missing;
    if (issues.length) {
      this.showErrors = true;
      this.toast.error('COMMON.OPS', issues.map(k => this.lang.instant(k)).join(', '));
      this.editor?.addLine();
      return;
    }

    if (this.cfg.hasStatus) d.status = this.resolveStatus(status);
    d.customerAddress = (this.addresses.find(a => a.title == this.customerAddress) as CustomerAddress) ?? new CustomerAddress();

    this.submitting = true;
    try {
      const res: any = await this.svc.save(d);
      if (res?.success) {
        this.dirty = false;
        this.form.markAsPristine();
        this.toast.success('COMMON.SAVED_OK');
        await this.afterSave(after, d.id || res?.data?.id || res?.data?.estimate?.id || null);
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
    else void this.router.navigate([this.cfg.routeBase], { queryParams: this.listParams });
  }

  view(): void {
    this.dirty = false;
    this.form.markAsPristine();
    void this.router.navigate([this.cfg.viewRoute, this.route.snapshot.paramMap.get('id')], { queryParams: this.listParams });
  }
}
