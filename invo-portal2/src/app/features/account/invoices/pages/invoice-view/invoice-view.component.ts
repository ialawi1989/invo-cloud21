import { railKind } from '@shared/utils/status-tone';
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ParamDef, QueryParamsService } from '@shared/services/query-params.service';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import type { DocRailFilterOption } from '../../../components/doc-rail-filter/doc-rail-filter.component';
import * as XLSX from 'xlsx';

import { Invoice } from '../../../models/invoice.model';
import { CustomersService } from '../../../customers/services/customers.service';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../services/document-view-base';
import { DocViewSkeletonComponent } from '../../../components/doc-view-skeleton/doc-view-skeleton.component';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import { DocJournalRow } from '../../../components/doc-journal-tab/doc-journal-tab.component';
import { CreditNotesService } from '../../../credit-notes/services/credit-notes.service';
import { buildExtraJournals } from '../../../services/doc-journal-extras';
import { DocAdditionalDetailsComponent } from '../../../components/doc-additional-details/doc-additional-details.component';
import { DocAdditionalDetailsConfig, DocJournalResult, DocPaymentRow } from '../../../components/doc-additional-details/doc-additional-details.types';
import { DocViewAttachmentsComponent } from '../../../components/doc-view-attachments/doc-view-attachments.component';
import { InvoicesService } from '../../services/invoices.service';
import { InvoiceActions } from '../../services/invoice-actions';
import { PaymentsService } from '../../../payments/services/payments.service';
import { PaymentActions } from '../../../payments/services/payment-actions';
import { invoiceToRenderData } from '../../services/invoice-render-data';
import { ApplyCreditModalComponent, ApplyCreditData } from '../../components/apply-credit-modal/apply-credit-modal.component';
import { MappedImportWizardComponent } from '@shared/components/mapped-import-wizard/mapped-import-wizard.component';
import { MappedImportConfig, MappedImportPreview } from '@shared/components/mapped-import-wizard/mapped-import.types';
import { DocExportModalComponent, DocExportData } from '../../../components/doc-export-modal/doc-export-modal.component';
import { DOC_RAIL_ICONS, docSortMenu } from '../../../services/doc-rail-menu';
import { SendDocumentData, SendDocumentModalComponent } from '../../../components/send-document-modal/send-document-modal.component';
import { downloadPdf, printPdf } from '@core/utils/pdf-download';
import { DocRailBulkAction } from '../../../services/document-view-base';
import { buildInvoiceImportConfig } from '../../services/invoice-import.config';
import { InvoiceLinkModalComponent, InvoiceLinkModalData } from '../../components/invoice-link-modal/invoice-link-modal.component';
import { InvoicePreferencesDrawerComponent } from '../../../components/invoice-preferences-drawer/invoice-preferences-drawer.component';
import { PartyPeekChipsComponent } from '../../../components/party-peek-chips/party-peek-chips.component';

/** `rstatus` — the rail's status filter, persisted the same way `rpage`/`rq` are in {@link DocumentViewBase}. */
const RAIL_STATUS_PARAM: ParamDef<string | null> = {
  key: 'rstatus',
  codec: { encode: v => v || null, decode: r => r || null },
};

/**
 * Invoices → view (`/account/invoices/view/:id`). Legacy `InvoiceViewComponent`: the invoice
 * rendered through the default document template, plus print / PDF / share, edit, pay, clone,
 * open (draft), credit note, write-off, delete and "apply available credit". Button rules come
 * from the shared {@link InvoiceActions}.
 */
@Component({
  selector: 'app-invoice-view',
  standalone: true,
  imports: [PartyPeekChipsComponent, CommonModule, TranslateModule, MycurrencyPipe, DocViewShellComponent, DocViewSkeletonComponent, DocAdditionalDetailsComponent, DocViewAttachmentsComponent, DropdownMenuBtnComponent],
  providers: [MycurrencyPipe],
  templateUrl: './invoice-view.component.html',
  // `display: contents` takes this element out of the box tree so `app-doc-view-shell` becomes the
  // effective direct flex child of `.main-content.no-padding` — otherwise the (unstyled, default
  // `inline`) host breaks the fixed-height chain the shell needs to scroll internally.
  styles: [':host { display: contents; }'],
})
export class InvoiceViewComponent extends DocumentViewBase {
  private invoices = inject(InvoicesService);
  private customers = inject(CustomersService);
  private currency = inject(MycurrencyPipe);
  private queryParams = inject(QueryParamsService);
  private paymentsSvc = inject(PaymentsService);
  private creditNotesSvc = inject(CreditNotesService);
  readonly actions = inject(InvoiceActions);
  readonly paymentActions = inject(PaymentActions);

  readonly cfg: DocViewConfig = {
    features: ['account/invoices', 'account/payments'],
    routeBase: '/account/invoices',
    templateType: 'invoice',
    zoomKey: 'invoiceZoomLevel',
    numberField: 'invoiceNumber',
    whatsappType: 'invoice',
    filePrefix: 'invoice',
    partyFields: ['customerName'],
    titleKey: 'INVOICES.FORM.INVOICE',
    dashboardCrumbKey: 'INVOICES.DASHBOARD',
    listCrumbKey: 'INVOICES.LIST.INVOICES_LIST',
    viewCrumbKey: 'INVOICES.VIEW.VIEW_INVOICE',
  };

  protected svc: DocViewService = {
    get: id => this.invoices.getInvoice(id),
    pdf: id => this.invoices.viewInvoicePdf(id),
    sendEmail: (payload, id) => this.invoices.sendInvoiceEmail({ ...payload, invoiceId: id }),
  };

  customerCredit = signal<number>(0);
  /** Collapsed by default, like legacy's Attachments card. */
  railStatus = signal<string | null>(null);
  railSort = signal<{ value: string; direction: 'ASC' | 'DESC' }>({ value: 'invoiceDateThenTime', direction: 'DESC' });

  protected toRenderData(d: Invoice): DocumentRenderData { return invoiceToRenderData(d); }
  protected override async onInit(): Promise<void> {
    await this.actions.refresh();
    this.railStatus.set(this.queryParams.read({ status: RAIL_STATUS_PARAM }).status);
    this.initRail(
      (term, page) => this.invoices.getInvoiceList({
        page, limit: this.railPageSize, searchTerm: term,
        sortBy: { sortValue: this.railSort().value, sortDirection: this.railSort().direction },
        filter: { status: this.railStatus() ? [this.railStatus()] : [] },
      }).then(d => ({ list: d?.list ?? [], pageCount: d?.pageCount ?? 1 })),
      (r: any) => this.mapRailItem(r),
    );
  }

  /** Status filter behind the rail's title (all real invoice statuses; re-fetches page 1 on change). Favorites save to `EmployeeOptions`. */
  readonly railStatusOptions = ['Draft', 'Open', 'Partially Paid', 'Paid', 'Closed', 'Void', 'writeOff'];
  railFilterOptions(): DocRailFilterOption[] {
    return [
      { value: null, label: this.t('INVOICES.LIST.ALL_INVOICES') },
      ...this.railStatusOptions.map(s => ({ value: s, label: this.t('INVOICES.STATUS.' + s) })),
    ];
  }
  onRailFilterPick(status: string | null): void {
    this.railStatus.set(status);
    this.queryParams.writeOne(RAIL_STATUS_PARAM, status);
    void this.loadRail(1);
  }

  /** "+" caret: the documents that can be started from here (the route's own privilege guard applies). */
  addMenuItems(): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [];
    if (this.actions.canAdd) {
      items.push({ label: this.t('INVOICES.FORM.NEW_INVOICE'), click: () => this.add(), disabled: false, danger: false });
      // Divider after "New Invoice" separates it from the other document types.
      items.push({ label: this.t('INVOICES.FORM.NEW_RECURRING_INVOICE'), click: () => void this.router.navigate(['/account/recurring-invoice', 'new']), disabled: false, danger: false, separator: true });
    }
    if (this.actions.canCreditNotePrivilege) {
      items.push({ label: this.t('INVOICES.FORM.NEW_CREDIT_NOTE'), click: () => void this.router.navigate(['/account/credit-notes', 'new']), disabled: false, danger: false });
    }
    return items;
  }

  /** Fields the backend can actually sort invoices by (`invoice.repo.ts` `columnMap`) — a real field list, not the reference's full one (no `lastModified`/`customerName`/`balanceDue` columns exist to sort on). */
  private readonly SORT_FIELDS: { value: string; labelKey: string }[] = [
    { value: 'invoiceDateThenTime', labelKey: 'INVOICES.LIST.ISSUE_DATE' },
    { value: 'createdAt', labelKey: 'INVOICES.CREATED_DATE' },
    { value: 'invoiceNumber', labelKey: 'INVOICES.LIST.INVOICE_NUMBER' },
    { value: 'dueDate', labelKey: 'INVOICES.LIST.DUE_DATE' },
    { value: 'total', labelKey: 'INVOICES.LIST.TOTAL' },
  ];

  private sortByMenu(): DropdownMenuBtnItem {
    return docSortMenu({
      label: this.t('INVOICES.VIEW.SORT_BY'),
      fields: this.SORT_FIELDS.map(f => ({ value: f.value, label: this.t(f.labelKey) })),
      current: this.railSort(),
      pick: sort => { this.railSort.set(sort); void this.loadRail(1); },
    });
  }

  private exportMenu(): DropdownMenuBtnItem {
    const t = this.t;
    return {
      label: t('DOC_VIEW.EXPORT'), click: () => {}, disabled: false, danger: false,
      iconPath: DOC_RAIL_ICONS.export, iconViewBox: DOC_RAIL_ICONS.viewBox16,
      children: [
        { label: t('INVOICES.VIEW.EXPORT_INVOICES'), click: () => void this.openExport(), disabled: false, danger: false },
        { label: t('INVOICES.VIEW.EXPORT_CURRENT_VIEW'), click: () => void this.exportInvoices('page'), disabled: false, danger: false },
      ],
    };
  }

  /** "Export Invoices" (every row matching the current status filter) vs "Export Current View" (just this rail page). */
  async exportInvoices(scope: 'all' | 'page'): Promise<void> {
    const filter = { status: this.railStatus() ? [this.railStatus()] : [] };
    const sortBy = { sortValue: this.railSort().value, sortDirection: this.railSort().direction };
    const data = await this.invoices.getInvoiceList({
      page: scope === 'all' ? 1 : this.railPage(),
      limit: scope === 'all' ? 999 : this.railPageSize,
      searchTerm: '', sortBy, filter,
    });
    const rows = (data?.list ?? []).map((r: any) => ({
      [this.t('INVOICES.LIST.INVOICE_NUMBER')]: r.invoiceNumber,
      [this.t('INVOICES.LIST.CUSTOMER_NAME')]: r.customerName,
      [this.t('INVOICES.LIST.TOTAL')]: r.total,
      [this.t('INVOICES.LIST.STATUS')]: r.status,
      [this.t('INVOICES.LIST.ISSUE_DATE')]: String(r.invoiceDate ?? '').slice(0, 10),
      [this.t('INVOICES.LIST.DUE_DATE')]: String(r.dueDate ?? '').slice(0, 10),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Invoices');
    XLSX.writeFile(wb, `invoices-${scope}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /**
   * Rail "⋯", icons matching the reference exactly. Sort by / Export / Online Payments / Refresh
   * are real and backend-backed. "Import Invoices" has no bulk-import endpoint yet (only
   * single-line CSV import into an open invoice's line table exists) so it tells the user rather
   * than pretending. No "Reset Column Width" here — this rail is a card list with nothing to
   * resize; that action lives on the invoices LIST page instead, where columns are real
   * (`ListPageComponent.resetColumnWidths()`).
   */
  railMoreItems(): DropdownMenuBtnItem[] {
    const t = this.t;
    const I = DOC_RAIL_ICONS;
    return [
      this.sortByMenu(),
      { label: t('INVOICES.VIEW.IMPORT_INVOICES'), click: () => void this.openImport(), disabled: false, danger: false, iconPath: I.import, iconViewBox: I.viewBox16 },
      this.exportMenu(),
      { label: t('INVOICES.VIEW.INVOICE_PREFERENCES'), click: () => this.openInvoicePreferences(), disabled: false, danger: false, separator: true, iconPath: I.preferences, iconViewBox: I.viewBox16 },
      { label: t('INVOICES.PREFS.MANAGE_FIELDS'), click: () => window.open('/settings/custom-fields/invoice', '_blank', 'noopener'), disabled: false, danger: false, iconPath: I.fields, iconViewBox: I.viewBox16 },
      { label: t('INVOICES.VIEW.ONLINE_PAYMENTS'), click: () => window.open('/settings/payment-methods', '_blank', 'noopener'), disabled: false, danger: false, iconPath: I.onlinePayments, iconViewBox: I.viewBox16 },
      { label: t('COMMON.REFRESH'), click: () => void this.loadRail(this.railPage()), disabled: false, danger: false, separator: true, iconPath: I.refresh, iconViewBox: I.viewBox16 },
    ];
  }
  /**
   * "Additional Details" tabs — shared, generic component (`DocAdditionalDetailsComponent`); this
   * config is the only invoice-specific part. Rebuilt whenever the invoice reloads so `payments()`
   * reads the current `invoicePayments`.
   */
  additionalDetails(): DocAdditionalDetailsConfig {
    const hasLines = !!this.doc()?.lines?.length;
    return {
      tabs: [
        ...(this.actions.canViewJournals ? ['journal' as const] : []),
        'payments', 'logs', 'productMovement', 'voided',
        ...(hasLines ? ['lines' as const] : []),
      ],
      lines: () => (this.doc()?.lines ?? []).map((l: any) => ({
        date: l.lineCreatedAt || l.createdAt || null,
        employeeName: l.employeeName ?? '',
        qty: l.qty,
        itemName: l.selectedItem?.name || l.productName || l.note || '',
      })),
      journalHeading: this.t('INVOICES.FORM.INVOICE'),
      loadJournal: () => this.loadJournal(this.id),
      payments: () => this.mapPayments(this.doc()?.invoicePayments ?? []),
      onPaymentClick: (p: DocPaymentRow) => void this.router.navigate(['/account/payments/view', p.id]),
      onPaymentAttachment: (p: DocPaymentRow, a?: any) => void this.openPaymentAttachment(p, a),
      onPaymentEdit: (p: DocPaymentRow) => void this.router.navigate(['/account/payments', p.id]),
      onPaymentDelete: (p: DocPaymentRow) => void this.deletePayment(p),
      canEditPayment: (p: DocPaymentRow) => this.paymentActions.canEdit(p),
      canDeletePayment: (p: DocPaymentRow) => this.paymentActions.canRemove(p),
      logsSourceTable: 'Invoices',
      logsSourceId: this.id,
      loadMovement: () => this.invoices.getInvoiceMovementDetails(this.id),
    };
  }

  private mapPayments(list: any[]): DocPaymentRow[] {
    return list.map(p => ({
      id: p.id, date: p.createdAt, methodName: p.paymentMethodName ?? '', status: p.status ?? 'SUCCESS',
      amount: Number(p.amount) || 0, referenceNumber: p.referenceNumber ?? '', attachment: p.attachment,
      reconciled: !!p.reconciled,
    }));
  }

  /** Opens a payment's attachment from its stored URL; when the row carries none, resolves it from the payment record. */
  private async openPaymentAttachment(p: DocPaymentRow, picked?: any): Promise<void> {
    const a = picked ?? (Array.isArray(p.attachment) ? p.attachment[0] : p.attachment);
    if (!a) return;
    let url: string = typeof a === 'string' ? a : a.mediaUrl || a.url?.defaultUrl || '';
    if (!url) {
      // The invoice's payment rows only carry `defaultUrl`; documents (PDF/Office) are stored under `downloadUrl`,
      // which the payment's own record resolves — so read the attachment from there.
      try {
        const full: any = await this.paymentsSvc.getInvoicePayment(p.id);
        const list: any[] = Array.isArray(full?.attachment) ? full.attachment : [];
        const hit = list.find(x => x?.id === a.id) ?? list[0];
        url = hit?.mediaUrl || hit?.url?.defaultUrl || '';
      } catch { /* nothing to open */ }
    }
    if (url) window.open(url, '_blank', 'noopener');
    else this.toast.error('COMMON.OPS', this.t('DOC_VIEW.NO_PREVIEW'));
  }

  private async deletePayment(p: DocPaymentRow): Promise<void> {
    const ok = await this.confirm(this.t('COMMON.DELETE'), this.t('PAYMENTS.VIEW.CONFIRM_DELETE'), true);
    if (!ok) return;
    try {
      await this.paymentsSvc.DeleteInvPay(p.id);
      this.toast.success('PAYMENTS.VIEW.DELETED');
      await this.load();
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    }
  }

  protected override async afterLoad(inv: Invoice): Promise<void> {
    if (inv.customerId) {
      const c: any = await this.customers.getCustomerCredit(inv.customerId);
      this.customerCredit.set(Number(c?.credit) || 0);
    } else {
      this.customerCredit.set(0);
    }
  }

  /** Row of the record rail: customer + total, invoice # + issue date, a status pill, and an "overdue" line — like the legacy list. */
  private mapRailItem(r: any): DocRailItem {
    const overdue = r.status === 'Open' && r.dueDate && new Date(r.dueDate) < new Date(new Date().toDateString());
    const days = overdue ? Math.floor((Date.now() - new Date(r.dueDate).getTime()) / 86_400_000) : 0;
    return {
      id: r.id,
      primary: r.customerName,
      amountLabel: this.currency.transform(r.total),
      sub: `${r.invoiceNumber} · ${new Date(r.invoiceDate).toLocaleDateString()}`,
      data: r,
      statusText: r.status ? this.t('INVOICES.STATUS.' + r.status) : undefined,
      statusKind: railKind(r.status),
      badgeText: overdue ? this.t('INVOICES.LIST.OVERDUE_BY').replace('{{days}}', String(days)) : undefined,
      badgeKind: overdue ? 'warn' : undefined,
    };
  }

  /** Legacy Share menu: Email/WhatsApp, Send for Signature, Create Invoice Link, then PDF. */
  override shareItems(): DropdownMenuBtnItem[] {
    const items = super.shareItems();
    const pdf = items.pop();
    items.push(
      { label: this.t('INVOICES.VIEW.SEND_FOR_SIGNATURE'), click: () => this.openLinkModal('signature'), disabled: false, danger: false },
      { label: this.t('INVOICES.VIEW.CREATE_LINK'), click: () => this.openLinkModal('link'), disabled: false, danger: false },
    );
    if (pdf) items.push(pdf);
    return items;
  }

  private openLinkModal(mode: 'link' | 'signature'): void {
    const inv = this.doc();
    if (!inv?.id) return;
    this.modal.open<InvoiceLinkModalComponent, InvoiceLinkModalData, void>(InvoiceLinkModalComponent, {
      size: 'md', data: { mode, invoiceId: inv.id, customerEmail: inv.customerEmail || '' },
    });
  }

  /** Adds "Print Delivery Note" to the shared Print/PDF menu (legacy `InvoiceViewComponent.print('deliveryNote')`). */
  override printItems(): DropdownMenuBtnItem[] {
    const items = super.printItems();
    if (this.actions.canPrintDeliveryNote) {
      items.push({ label: this.t('INVOICES.VIEW.PRINT_DELIVERY_NOTE'), click: () => this.printDeliveryNote(), disabled: false, danger: false });
    }
    return items;
  }

  /** A delivery note needs a real customer on the invoice — same guard as legacy. */
  printDeliveryNote(): void {
    const inv = this.doc();
    if (!inv || !inv.customerName || inv.customerName === 'WalkIn Customer') {
      this.toast.error('COMMON.OPS', this.t('INVOICES.VIEW.DELIVERY_NOTE_NEEDS_CUSTOMER'));
      return;
    }
    window.open(`${window.location.origin}/print/delivery-note/${this.id}?autoPrint=true`, '_blank');
  }

  isMerged(i: Invoice) { return !!i.mergeWith; }
  showApplyCredit(i: Invoice) { return this.actions.applyCredit(i, this.customerCredit()); }
  isOverdue(i: Invoice): boolean {
    return i.status === 'Open' && !!i.dueDate && new Date(i.dueDate) < new Date(new Date().toDateString());
  }

  actionItems(i: Invoice): DropdownMenuBtnItem[] {
    const t = this.t;
    const items: DropdownMenuBtnItem[] = [];
    if (!this.isMerged(i)) items.push({ label: t('INVOICES.FORM.MAKE_RECURRING'), click: () => this.makeRecurring(), disabled: false, danger: false });
    const core = this.actions.menu(i, this.id, () => this.goToList());
    const del = core.filter(x => x.danger);
    items.push(...core.filter(x => !x.danger));
    if (this.actions.canViewJournals && !this.isMerged(i)) items.push({ label: t('INVOICES.VIEW.VIEW_JOURNAL'), click: () => this.scrollToJournal(), disabled: false, danger: false });
    items.push(...del);
    items.push({ label: t('INVOICES.VIEW.INVOICE_PREFERENCES'), click: () => this.openInvoicePreferences(), disabled: false, danger: false, separator: true });
    return items;
  }

  openInvoice(): Promise<void> { return this.actions.runOpen(this.doc()!.id, () => this.goToList()); }

  // ── navigation ─────────────────────────────────────────────────────
  pay(): void { void this.router.navigate(['/account/invoices/payment', this.id]); }
  goToInvoice(id: string): void { void this.router.navigate(['/account/invoices/view', id], { queryParamsHandling: 'preserve' }); }

  // ── actions ────────────────────────────────────────────────────────
  /** "Make Recurring": hands this invoice to the recurring-invoice form, which reads it from session storage (same handoff as the invoice form's own button). */
  makeRecurring(): void {
    try { sessionStorage.setItem('recurringFromInvoice', JSON.stringify(this.doc())); } catch { /* storage unavailable */ }
    void this.router.navigate(['/account/recurring-invoice', 'new'], { queryParams: { fromInvoice: 'yes', invoiceId: this.doc()?.id || null } });
  }

  /** "View Journal": the "Additional Details" section sits under the paper on this same page — scroll to it (its own scroll-into-view / tab-click lazy load takes it from there). */
  scrollToJournal(): void {
    document.getElementById('invoice-additional-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private async loadJournal(invoiceId: string): Promise<DocJournalResult> {
    const j = await this.invoices.getInvoiceJournal(invoiceId);
    const rows: DocJournalRow[] = j?.defaultJournals ?? [];
    // Legacy's own sort (`additional-details.component.ts`): descending by debit — kept verbatim
    // (not rewritten to a "cleaner" numeric compare) so the row order matches exactly, ties included.
    rows.sort((a, b) => ((a.debit ?? 0) < (b.debit ?? 0) ? 1 : -1));
    const extras = buildExtraJournals('invoice', j?.extraJournals, (k, p) => this.lang.instant(k, p), id => void this.deleteAppliedCredit(id));
    return { rows, extras };
  }

  /** Takes a credit that was applied to this invoice back (legacy: confirm, delete, reload the page). */
  private async deleteAppliedCredit(appliedCreditId: string): Promise<void> {
    if (!(await this.confirm(this.t('COMMON.DELETE'), this.t('INVOICES.VIEW.CONFIRM_DELETE_APPLIED_CREDIT'), true))) return;
    await this.run(() => this.creditNotesSvc.deleteAppliedCredit(appliedCreditId), () => void this.load());
  }

  /** "Export Invoices" — the status / date-range / format dialog ("Export Current View" below still dumps just the rail page). */
  openExport(): void {
    this.modal.open<DocExportModalComponent, DocExportData, boolean>(DocExportModalComponent, {
      size: 'md',
      data: {
        moduleLabel: this.t('INVOICES.RECORDS'),
        statuses: this.railStatusOptions.map(s => ({ value: s, label: this.t('INVOICES.STATUS.' + s) })),
        status: this.railStatus(),
        fileStem: 'invoices',
        fetchPage: (filter, page, limit) => this.invoices.getInvoiceList({ page, limit, searchTerm: '', sortBy: {}, filter }),
        toRow: (r, { pii, amount }) => {
          const t = (k: string) => this.t(k);
          const row: Record<string, string | number> = {
            [t('INVOICES.LIST.INVOICE_NUMBER')]: r.invoiceNumber ?? '',
            [t('INVOICES.LIST.ISSUE_DATE')]: String(r.invoiceDate ?? '').slice(0, 10),
            [t('INVOICES.LIST.DUE_DATE')]: String(r.dueDate ?? '').slice(0, 10),
            [t('INVOICES.LIST.STATUS')]: r.status ?? '',
            [t('INVOICES.LIST.REF')]: r.refrenceNumber ?? '',
            [t('INVOICES.LIST.TOTAL')]: amount(r.total),
          };
          if (pii) {
            row[t('INVOICES.LIST.CUSTOMER_NAME')] = r.customerName ?? '';
            row[t('INVOICES.LIST.CUSTOMER_PHONE')] = r.customerContact ?? '';
          }
          return row;
        },
      },
    });
  }

  /**
   * Actions on the ticked rail rows: merged PDF, one email for all, print, delete. Delete is offered only with the delete
   * privilege and skips invoices the single-invoice rules refuse (Paid / Closed).
   */
  railBulkActions(): DocRailBulkAction[] {
    const t = this.t;
    const out: DocRailBulkAction[] = [
      { id: 'pdf', label: t('INVOICES.ACTIONS.EXPORT_MERGED_PDF'), run: (items) => this.bulkPdf(items, false) },
      { id: 'email', label: t('INVOICES.ACTIONS.SEND_EMAIL'), run: (items) => this.bulkEmail(items) },
    ];
    if (this.actions.canPrint) out.push({ id: 'print', label: t('COMMON.PRINT'), run: (items) => this.bulkPdf(items, true) });
    if (this.actions.canDeletePrivilege) out.push({ id: 'delete', label: t('COMMON.DELETE'), danger: true, separator: true, run: (items) => this.bulkDelete(items) });
    return out;
  }

  private async bulkPdf(items: DocRailItem[], print: boolean): Promise<void> {
    const pdf = await this.invoices.viewMergedInvoicesPdf(items.map((i) => i.id));
    if (!pdf) { this.toast.error('COMMON.OPS', ''); return; }
    if (!print) { downloadPdf(pdf, 'invoices.pdf'); return; }
    printPdf(pdf);
  }

  /** One email request for the ticked invoices (recipient typed manually — they may span customers). */
  private async bulkEmail(items: DocRailItem[]): Promise<void> {
    await this.modal.open<SendDocumentModalComponent, SendDocumentData, boolean>(SendDocumentModalComponent, {
      size: 'md',
      data: { emails: [], sendEmail: (payload) => this.invoices.sendInvoiceEmail({ ...payload, invoiceIds: items.map((i) => i.id) }) },
    }).afterClosed();
  }

  private async bulkDelete(items: DocRailItem[]): Promise<void> {
    const deletable = items.filter((i) => i.data && this.actions.delete(i.data));
    if (!deletable.length) { this.toast.error('COMMON.OPS', this.t('INVOICES.ACTIONS.BULK_DELETE_NONE')); return; }
    const skipped = items.length - deletable.length;
    const message = this.t('INVOICES.ACTIONS.BULK_DELETE_CONFIRM').replace('{{count}}', String(deletable.length))
      + (skipped ? ' ' + this.t('INVOICES.ACTIONS.BULK_DELETE_SKIPPED').replace('{{count}}', String(skipped)) : '');
    if (!(await this.confirm(this.t('COMMON.DELETE'), message, true))) return;
    let done = 0;
    for (const i of deletable) {
      try { await this.invoices.DeleteInv(i.id); done++; } catch { /* reported in the summary below */ }
    }
    if (done) this.toast.success(this.t('INVOICES.ACTIONS.BULK_DELETED').replace('{{count}}', String(done)));
    if (done < deletable.length) this.toast.error('COMMON.OPS', this.t('INVOICES.ACTIONS.BULK_DELETE_FAILED').replace('{{count}}', String(deletable.length - done)));
    if (deletable.some((i) => i.id === this.id)) { this.goToList(); return; }
    void this.loadRail(this.railPage());
  }

  /** Bulk "Import Invoices" — the Configure → Map Fields → Preview wizard; refreshes the rail once something was imported. */
  async openImport(): Promise<void> {
    const config = buildInvoiceImportConfig({ service: this.invoices, branchId: this.doc()?.branchId ?? '' });
    const res = await this.modal.open<MappedImportWizardComponent, MappedImportConfig, MappedImportPreview | undefined>(
      MappedImportWizardComponent, { size: 'lg', data: config, closeOnBackdrop: false },
    ).afterClosed();
    if (res?.imported) void this.loadRail(1);
  }

  /** "Invoice Preferences": a quick-access drawer (Preferences + Fields) so the open invoice isn't lost; "All Preferences" inside it opens the full settings page. */
  openInvoicePreferences(): void {
    this.modal.open<InvoicePreferencesDrawerComponent, void, void>(InvoicePreferencesDrawerComponent, {
      drawer: true, drawerWidth: '480px', drawerResizable: true,
    });
  }

  async applyCredit(): Promise<void> {
    const inv = this.doc()!;
    const ok = await this.modal.open<ApplyCreditModalComponent, ApplyCreditData, boolean>(ApplyCreditModalComponent, {
      size: 'lg',
      data: { invoiceId: inv.id!, invoiceNumber: inv.invoiceNumber, customerId: inv.customerId!, balance: inv.balance },
    }).afterClosed();
    if (ok) await this.load();
  }
}
