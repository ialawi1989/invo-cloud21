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
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import { DocJournalRow } from '../../../components/doc-journal-tab/doc-journal-tab.component';
import { DocAdditionalDetailsComponent } from '../../../components/doc-additional-details/doc-additional-details.component';
import { DocAdditionalDetailsConfig, DocPaymentRow } from '../../../components/doc-additional-details/doc-additional-details.types';
import { DocAttachmentsComponent, DocAttachment } from '../../../components/doc-attachments/doc-attachments.component';
import { MediaService } from '../../../../settings/media/services/media.service';
import { InvoicesService } from '../../services/invoices.service';
import { InvoiceActions } from '../../services/invoice-actions';
import { PaymentsService } from '../../../payments/services/payments.service';
import { PaymentActions } from '../../../payments/services/payment-actions';
import { invoiceToRenderData } from '../../services/invoice-render-data';
import { ApplyCreditModalComponent, ApplyCreditData } from '../../components/apply-credit-modal/apply-credit-modal.component';
import { InvoicePreferencesDrawerComponent } from '../../../components/invoice-preferences-drawer/invoice-preferences-drawer.component';

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
  imports: [CommonModule, TranslateModule, MycurrencyPipe, DocViewShellComponent, DocAdditionalDetailsComponent, DocAttachmentsComponent, DropdownMenuBtnComponent],
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
  private media = inject(MediaService);
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
  attachmentsCollapsed = signal(true);
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

  /** "+" caret: only offers documents that actually exist as routes/features. */
  addMenuItems(): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [];
    if (this.router.config.some(r => (r.path ?? '').startsWith('account/recurring-invoice'))) {
      items.push({ label: this.t('INVOICES.FORM.MAKE_RECURRING'), click: () => void this.router.navigate(['/account/recurring-invoice', 'new']), disabled: false, danger: false });
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

  // Icon paths lifted from the reference toolbar so the rail "⋯" menu matches it exactly.
  private static readonly ICONS = {
    viewBox16: '0 0 16 16',
    sortBy: 'M8.04 5.82c-.14.14-.32.21-.5.21s-.36-.07-.5-.21L4.81 3.59v8.42c0 .39-.31.7-.7.7s-.7-.31-.7-.7V3.57L1.18 5.8c-.27.27-.72.27-.99 0s-.27-.72 0-.99l3.43-3.42c.26-.26.73-.26.99 0l3.43 3.43c.27.27.27.72 0 .99zm7.75 4.38a.706.706 0 00-.99 0l-2.22 2.22V3.6c0-.39-.31-.7-.7-.7s-.7.31-.7.7v8.83l-2.24-2.24c-.27-.27-.72-.27-.99 0s-.27.72 0 .99l3.43 3.43c.13.13.31.21.5.21s.36-.07.5-.21l3.41-3.42c.27-.27.27-.72 0-.99z',
    import: 'M15.96 9.19v3.19c0 1.65-1.35 3-3 3H3.04c-1.65 0-3-1.34-3-3V9.19c0-.39.31-.7.7-.7s.7.31.7.7v3.19c0 .88.72 1.6 1.6 1.6h9.92c.88 0 1.6-.72 1.6-1.6V9.19c0-.39.31-.7.7-.7s.7.31.7.7zm-8.57.21l.29.26H8c.22 0 .43-.09.59-.24l2.84-2.84c.27-.27.27-.72 0-.99s-.72-.27-.99 0L8.71 7.33V1.32c0-.39-.31-.7-.7-.7s-.7.31-.7.7v6.01L5.58 5.59c-.27-.27-.72-.27-.99 0s-.27.72 0 .99L7.41 9.4z',
    export: 'M4.57 4.68a.706.706 0 010-.99L7.41.85c.16-.16.39-.27.6-.24h.29l.29.26 2.83 2.83c.27.27.27.72 0 .99s-.72.27-.99 0L8.69 2.95v6.02c0 .39-.31.7-.7.7s-.7-.31-.7-.7V2.94L5.55 4.68c-.14.14-.32.21-.5.21s-.36-.07-.5-.21zm10.7 3.82c-.39 0-.7.31-.7.7v3.2c0 .88-.72 1.6-1.6 1.6H3.03c-.88 0-1.6-.72-1.6-1.6V9.2c0-.39-.31-.7-.7-.7s-.7.31-.7.7v3.2c0 1.66 1.35 3 3 3h9.94c1.66 0 3-1.35 3-3V9.2c0-.39-.31-.7-.7-.7z',
    preferences: 'M15.38 9.78a2.72 2.72 0 01-.37-3.2c.09-.16.21-.32.34-.46.17-.19.22-.46.14-.7-.34-1-.88-1.91-1.59-2.71a.703.703 0 00-.67-.22c-1.17.26-2.36-.25-2.95-1.28a3.04 3.04 0 01-.23-.52.704.704 0 00-.53-.47 8.09 8.09 0 00-3.14.02c-.25.05-.45.23-.53.48A2.7 2.7 0 012.7 2.58a.695.695 0 00-.67.22C1.33 3.61.81 4.52.48 5.53a.7.7 0 00.15.69c.81.88.96 2.17.37 3.2-.09.16-.21.32-.34.46-.17.19-.22.46-.14.7.35 1 .88 1.91 1.59 2.71.17.19.43.27.67.22 1.17-.26 2.36.25 2.95 1.28.09.16.17.33.23.52.08.24.28.42.53.47.51.1 1.02.15 1.51.15.54 0 1.09-.06 1.62-.17.25-.05.45-.23.53-.48.41-1.33 1.74-2.16 3.15-1.86.25.05.51-.03.67-.22.7-.81 1.22-1.72 1.55-2.73a.7.7 0 00-.15-.69zm-2.22 2.21c-1.82-.19-3.5.83-4.2 2.47-.6.09-1.21.1-1.83.01-.06-.13-.12-.26-.19-.38a4.103 4.103 0 00-4.04-2.02c-.39-.48-.7-1.01-.93-1.58.08-.12.16-.24.23-.36.83-1.43.71-3.2-.27-4.51.23-.57.53-1.11.91-1.59 1.82.19 3.5-.83 4.2-2.47.61-.09 1.22-.1 1.83-.01.06.13.12.26.19.38a4.103 4.103 0 004.04 2.02c.39.48.7 1.01.93 1.58-.08.12-.16.23-.23.36a4.09 4.09 0 00.27 4.51 6.43 6.43 0 01-.91 1.59zM8 5.33c-1.47 0-2.67 1.2-2.67 2.67s1.2 2.67 2.67 2.67 2.67-1.2 2.67-2.67S9.47 5.33 8 5.33zm0 3.94c-.7 0-1.27-.57-1.27-1.27S7.3 6.73 8 6.73 9.27 7.3 9.27 8 8.7 9.27 8 9.27z',
    fields: 'M11.81 14.36c0 .39-.31.7-.7.7H7.79c-.39 0-.7-.31-.7-.7s.31-.7.7-.7h.96V2.34h-.96c-.39 0-.7-.31-.7-.7s.31-.7.7-.7h3.32c.39 0 .7.31.7.7s-.31.7-.7.7h-.96v11.32h.96c.39 0 .7.31.7.7zm1.46-11.32h-1.26c-.39 0-.7.31-.7.7s.31.7.7.7h1.26c.71 0 1.29.58 1.29 1.29v4.58c0 .71-.58 1.29-1.29 1.29h-1.26c-.39 0-.7.31-.7.7s.31.7.7.7h1.26c1.48 0 2.69-1.21 2.69-2.69V5.73c0-1.48-1.21-2.69-2.69-2.69zm-5.53 9.25c0-.39-.31-.7-.7-.7H2.73c-.71 0-1.29-.58-1.29-1.29V5.72c0-.71.58-1.29 1.29-1.29h4.31c.39 0 .7-.31.7-.7s-.31-.7-.7-.7H2.73a2.712 2.712 0 00-2.69 2.7v4.58C.04 11.79 1.25 13 2.73 13h4.31c.39 0 .7-.31.7-.7z',
    onlinePayments: 'M14.4.97H6.74c-.87 0-1.58.71-1.58 1.58v5.12c0 .87.71 1.58 1.58 1.58h7.66c.87 0 1.58-.71 1.58-1.58V2.55c0-.87-.71-1.58-1.58-1.58zm-7.66 1.4h7.66c.1 0 .18.08.18.18v.93H6.56v-.93c0-.1.08-.18.18-.18zm7.66 5.48H6.74a.18.18 0 01-.18-.18V4.89h8.03v2.78c0 .1-.08.18-.18.18zm.84 2.58c.27.28.27.72 0 .99-.51.5-1.22.79-1.94.79H8.67c.02.07.04.13.04.2v1.21H11c.39 0 .7.31.7.7s-.31.7-.7.7H5.02c-.39 0-.7-.31-.7-.7s.31-.7.7-.7h2.29v-1.21c0-.07.02-.14.04-.2H2.71C1.23 12.22.02 11.07.02 9.66v-6C.02 2.18 1.23.97 2.71.97h.7c.39 0 .7.31.7.7s-.31.7-.7.7h-.7c-.71 0-1.29.58-1.29 1.29v6c0 .64.58 1.15 1.29 1.15h10.58c.36 0 .71-.14.96-.39.28-.27.72-.27.99 0z',
    refresh: 'M2.69 9.24c.09.38-.14.75-.52.84-.05.01-.11.02-.16.02-.32 0-.6-.22-.68-.54a6.835 6.835 0 011.48-6.08A6.787 6.787 0 017.5 1.12c1.4-.11 2.8.25 4 .97L11.23.88c-.08-.38.15-.75.53-.84.37-.08.75.15.84.53l.64 2.84c.1.43-.17.86-.6.95L9.8 5c-.05.01-.1.02-.16.02-.32 0-.61-.22-.68-.55-.08-.38.15-.75.53-.84l1.37-.31c-.97-.6-2.11-.9-3.26-.81-3 .22-5.27 2.84-5.05 5.85.02.29.07.59.13.87zm12.15-1.82c-.03-.33-.08-.68-.16-1.01a.697.697 0 00-.84-.52c-.38.09-.61.46-.52.84.06.27.1.54.13.81.12 1.45-.34 2.87-1.28 3.98s-2.27 1.79-3.72 1.91c-1.1.09-2.18-.17-3.13-.71l1.29-.23a.7.7 0 00.57-.81.706.706 0 00-.81-.57l-2.88.5c-.42.08-.71.49-.64.92l.5 2.87c.06.34.35.58.69.58.04 0 .08 0 .12-.01a.7.7 0 00.57-.81l-.23-1.3c1.06.63 2.26.98 3.5.98.18 0 .37 0 .56-.02 1.83-.15 3.49-1 4.67-2.39a6.8 6.8 0 001.61-5z',
    resetWidth: 'M14.97 8.55c0 3.84-3.13 6.97-6.97 6.97s-6.97-3.13-6.97-6.97c0-.35.03-.7.08-1.04.06-.38.42-.64.8-.59.38.06.65.41.59.8a5.578 5.578 0 005.51 6.4c3.07 0 5.57-2.5 5.57-5.57s-2.5-5.57-5.57-5.57c-1.05 0-2.07.31-2.95.86l1.44.32c.38.08.61.46.53.84-.07.33-.36.55-.68.55-.05 0-.1 0-.15-.02l-2.89-.65c-.43-.1-.7-.53-.6-.95l.66-2.9c.08-.38.46-.62.84-.53.38.08.61.46.53.84l-.28 1.24c1.08-.64 2.31-1 3.57-1 3.85 0 6.97 3.13 6.97 6.97z',
  };

  private sortByMenu(): DropdownMenuBtnItem {
    const cur = this.railSort();
    return {
      label: this.t('INVOICES.VIEW.SORT_BY'), click: () => {}, disabled: false, danger: false,
      iconPath: InvoiceViewComponent.ICONS.sortBy, iconViewBox: InvoiceViewComponent.ICONS.viewBox16,
      children: this.SORT_FIELDS.map(f => ({
        label: this.t(f.labelKey), checked: cur.value === f.value, disabled: false, danger: false,
        trailing: cur.value === f.value ? (cur.direction === 'ASC' ? 'up' as const : 'down' as const) : undefined,
        click: () => {
          this.railSort.set({ value: f.value, direction: cur.value === f.value && cur.direction === 'DESC' ? 'ASC' : 'DESC' });
          void this.loadRail(1);
        },
      })),
    };
  }

  private exportMenu(): DropdownMenuBtnItem {
    const t = this.t;
    return {
      label: t('DOC_VIEW.EXPORT'), click: () => {}, disabled: false, danger: false,
      iconPath: InvoiceViewComponent.ICONS.export, iconViewBox: InvoiceViewComponent.ICONS.viewBox16,
      children: [
        { label: t('INVOICES.VIEW.EXPORT_INVOICES'), click: () => void this.exportInvoices('all'), disabled: false, danger: false },
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
    const I = InvoiceViewComponent.ICONS;
    return [
      this.sortByMenu(),
      { label: t('INVOICES.VIEW.IMPORT_INVOICES'), click: () => this.toast.info?.('INVOICES.VIEW.IMPORT_NOT_AVAILABLE'), disabled: false, danger: false, iconPath: I.import, iconViewBox: I.viewBox16 },
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
    return {
      tabs: this.actions.canViewJournals ? ['journal', 'payments', 'logs', 'productMovement', 'voided'] : ['payments', 'logs', 'productMovement', 'voided'],
      journalHeading: this.t('INVOICES.FORM.INVOICE'),
      loadJournal: () => this.loadJournal(this.id),
      payments: () => this.mapPayments(this.doc()?.invoicePayments ?? []),
      onPaymentClick: (p: DocPaymentRow) => void this.router.navigate(['/account/payments/view', p.id]),
      onPaymentAttachment: (p: DocPaymentRow) => this.openPaymentAttachment(p),
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

  private openPaymentAttachment(p: DocPaymentRow): void {
    const a = p.attachment;
    const url = typeof a === 'string' ? a : Array.isArray(a) ? (a[0]?.mediaUrl ?? a[0]?.url) : a?.mediaUrl ?? a?.url;
    if (url) window.open(url, '_blank', 'noopener');
  }

  /**
   * The view page persists immediately (unlike the form, which defers to its own Save) — matching
   * legacy's `autoUpload` + immediate-save behaviour. Add and remove use legacy's own two distinct
   * endpoints (not one "resend the whole list" call for both): add overwrites the whole column
   * server-side (needs the full desired list), remove is a real per-item server-side filter.
   *
   * Calls are queued through one chain (never run concurrently): an add immediately followed by a
   * remove (or vice versa) would otherwise race — a later call's failure-rollback could restore a
   * snapshot captured before an EARLIER call's own change, silently wiping it out even though that
   * earlier call had already succeeded.
   */
  private attachmentsQueue: Promise<void> = Promise.resolve();

  onAttachmentsAdded(list: DocAttachment[]): void {
    this.attachmentsQueue = this.attachmentsQueue.then(() => this.persistAdd(list));
  }
  onAttachmentRemoved(a: DocAttachment): void {
    this.attachmentsQueue = this.attachmentsQueue.then(() => this.persistRemove(a));
  }

  private async persistAdd(list: DocAttachment[]): Promise<void> {
    const inv = this.doc();
    if (!inv) return;
    const previous = inv.attachment;
    inv.attachment = list;
    this.doc.set({ ...inv } as Invoice);
    try {
      const ok = await this.media.appendAttachment({ type: 'invoice', id: this.id, attachment: list.map(a => ({ id: a.id })) });
      if (!ok) throw new Error();
    } catch {
      inv.attachment = previous;
      this.doc.set({ ...inv } as Invoice);
      this.toast.error('COMMON.SAVE_FAILED');
    }
  }

  private async persistRemove(a: DocAttachment): Promise<void> {
    const inv = this.doc();
    if (!inv) return;
    const previous = inv.attachment;
    inv.attachment = (previous ?? []).filter((x: DocAttachment) => x.id !== a.id);
    this.doc.set({ ...inv } as Invoice);
    try {
      const ok = await this.media.deleteAttachment({ type: 'invoice', id: this.id, mediaId: a.id });
      if (!ok) throw new Error();
    } catch {
      inv.attachment = previous;
      this.doc.set({ ...inv } as Invoice);
      this.toast.error('COMMON.DELETE_FAILED');
    }
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

private static readonly STATUS_KIND: Record<string, DocRailItem['statusKind']> = {
    Draft: 'draft', Open: 'open', Paid: 'paid', 'Partially Paid': 'partial',
    Closed: 'paid', Void: 'void', writeOff: 'void', merged: 'neutral',
  };

  /** Row of the record rail: customer + total, invoice # + issue date, a status pill, and an "overdue" line — like the legacy list. */
  private mapRailItem(r: any): DocRailItem {
    const overdue = r.status === 'Open' && r.dueDate && new Date(r.dueDate) < new Date(new Date().toDateString());
    const days = overdue ? Math.floor((Date.now() - new Date(r.dueDate).getTime()) / 86_400_000) : 0;
    return {
      id: r.id,
      primary: r.customerName,
      amountLabel: this.currency.transform(r.total),
      sub: `${r.invoiceNumber} · ${new Date(r.invoiceDate).toLocaleDateString()}`,
      statusText: r.status ? this.t('INVOICES.STATUS.' + r.status) : undefined,
      statusKind: InvoiceViewComponent.STATUS_KIND[r.status] ?? 'neutral',
      badgeText: overdue ? this.t('INVOICES.LIST.OVERDUE_BY').replace('{{days}}', String(days)) : undefined,
      badgeKind: overdue ? 'warn' : undefined,
    };
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
    if (this.actions.creditNote(i)) items.push({ label: t('INVOICES.LIST.CREATE_CREDIT_NOTE'), click: () => this.createCreditNote(), disabled: false, danger: false });
    if (this.actions.clone(i)) items.push({ label: t('INVOICES.VIEW.CLONE'), click: () => this.clone(), disabled: false, danger: false });
    if (this.actions.open(i)) items.push({ label: t('INVOICES.VIEW.OPEN_INVOICE'), click: () => void this.openInvoice(), disabled: false, danger: false });
    if (this.actions.canViewJournals && !this.isMerged(i)) items.push({ label: t('INVOICES.VIEW.VIEW_JOURNAL'), click: () => this.scrollToJournal(), disabled: false, danger: false });
    if (this.actions.delete(i)) items.push({ label: t('COMMON.DELETE'), click: () => void this.remove(), disabled: false, danger: true });
    items.push({ label: t('INVOICES.VIEW.INVOICE_PREFERENCES'), click: () => this.openInvoicePreferences(), disabled: false, danger: false, separator: true });
    return items;
  }

  /** The "Record Payment" split button: recording a payment, and Write Off underneath it. */
  recordPaymentMenu(i: Invoice): DropdownMenuBtnItem[] {
    const t = this.t;
    const items: DropdownMenuBtnItem[] = [{ label: t('INVOICES.VIEW.RECORD_PAYMENT'), click: () => this.pay(), disabled: false, danger: false }];
    if (this.actions.writeOff(i)) items.push({ label: t('INVOICES.ACTIONS.WRITE_OFF'), click: () => void this.writeOff(), disabled: false, danger: false });
    return items;
  }

  // ── navigation ─────────────────────────────────────────────────────
  pay(): void { void this.router.navigate(['/account/invoices/payment', this.id]); }
  createCreditNote(): void { void this.router.navigate(['/account/credit-notes/new/forInvoice', this.id]); }
  goToInvoice(id: string): void { void this.router.navigate(['/account/invoices/view', id], { queryParamsHandling: 'preserve' }); }

  // ── actions ────────────────────────────────────────────────────────
  async openInvoice(): Promise<void> {
    await this.run(() => this.invoices.openInvoice(this.doc()!.id), () => this.goToList());
  }

  async writeOff(): Promise<void> {
    if (!(await this.confirm(this.t('INVOICES.ACTIONS.WRITE_OFF'), this.t('INVOICES.ACTIONS.CONFIRM_WRITE_OFF')))) return;
    await this.run(() => this.invoices.WriteOffInvoice(this.id), () => this.goToList());
  }

  async remove(): Promise<void> {
    if (!(await this.confirm(this.t('COMMON.DELETE'), this.t('INVOICES.VIEW.CONFIRM_DELETE'), true))) return;
    await this.run(() => this.invoices.DeleteInv(this.doc()!.id), () => this.goToList());
  }

  /** "Make Recurring": hands this invoice to the recurring-invoice form, which reads it from session storage (same handoff as the invoice form's own button). */
  makeRecurring(): void {
    const exists = this.router.config.some(r => (r.path ?? '').startsWith('account/recurring-invoice'));
    if (!exists) {
      this.toast.info?.('INVOICES.FORM.RECURRING_SOON');
      return;
    }
    try { sessionStorage.setItem('recurringFromInvoice', JSON.stringify(this.doc())); } catch { /* storage unavailable */ }
    void this.router.navigate(['/account/recurring-invoice', 'new'], { queryParams: { fromInvoice: 'yes' } });
  }

  /** "View Journal": the "Additional Details" section sits under the paper on this same page — scroll to it (its own scroll-into-view / tab-click lazy load takes it from there). */
  scrollToJournal(): void {
    document.getElementById('invoice-additional-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private async loadJournal(invoiceId: string): Promise<DocJournalRow[]> {
    const j = await this.invoices.getInvoiceJournal(invoiceId);
    const rows: DocJournalRow[] = j?.defaultJournals ?? [];
    // Legacy's own sort (`additional-details.component.ts`): descending by debit — kept verbatim
    // (not rewritten to a "cleaner" numeric compare) so the row order matches exactly, ties included.
    rows.sort((a, b) => ((a.debit ?? 0) < (b.debit ?? 0) ? 1 : -1));
    return rows;
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
