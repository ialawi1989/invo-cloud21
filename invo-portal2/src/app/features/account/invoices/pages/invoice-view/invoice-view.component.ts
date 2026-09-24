import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import * as XLSX from 'xlsx';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { downloadPdf } from '@core/utils/pdf-download';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentPaperComponent } from '@shared/components/document-paper/document-paper.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { SendDocumentData, SendDocumentModalComponent } from '../../../components/send-document-modal/send-document-modal.component';
import { DocumentBuilderService } from '../../../../settings/document-builder/services/document-builder.service';
import type { DocumentTemplate } from '../../../../settings/document-builder/services/document-template.types';
import { Invoice } from '../../../models/invoice.model';
import { CustomersService } from '../../../customers/services/customers.service';
import { TransactionLockService } from '../../../services/transaction-lock.service';
import { InvoicesService } from '../../services/invoices.service';
import { invoiceToRenderData } from '../../services/invoice-render-data';
import { ApplyCreditModalComponent, ApplyCreditData } from '../../components/apply-credit-modal/apply-credit-modal.component';

/**
 * Invoices → view (`/account/invoices/view/:id`). Legacy `InvoiceViewComponent`: the invoice
 * rendered through the default document template, plus print / PDF / share, edit, pay, clone,
 * open (draft), credit note, write-off, delete and "apply available credit".
 */
@Component({
  selector: 'app-invoice-view',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, TranslateModule, MycurrencyPipe, BreadcrumbsComponent,
    DropdownMenuBtnComponent, DocumentPaperComponent,
  ],
  templateUrl: './invoice-view.component.html',
  styleUrl: './invoice-view.component.scss',
})
export class InvoiceViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private privileges = inject(PrivilegeService);
  private invoices = inject(InvoicesService);
  private customers = inject(CustomersService);
  private builder = inject(DocumentBuilderService);
  private lock = inject(TransactionLockService);

  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  private readonly zoomKey = 'invoiceZoomLevel';

  invoice = signal<Invoice | null>(null);
  template = signal<DocumentTemplate | null>(null);
  customerCredit = signal<number>(0);
  loading = signal(true);
  zoom = signal(this.savedZoom());
  breadcrumbs: BreadcrumbItem[] = [];
  private lockInfo: any = null;

  renderData = computed<DocumentRenderData | null>(() => {
    const inv = this.invoice();
    return inv ? invoiceToRenderData(inv) : null;
  });

  private can = (p: string) => this.privileges.check(p);
  get canPrint() { return this.can('invoiceSecurity.actions.print.access'); }
  get canAdd() { return this.can('invoiceSecurity.actions.add.access'); }
  get canPay() { return this.can('invoicePaymentsSecurity.actions.add.access'); }
  get canCreditNote() { return this.can('creditNoteSecurity.actions.add.access'); }
  get canOpen() { return this.can('invoiceSecurity.actions.openInvoice.access'); }
  get canWriteOff() { return this.can('invoiceSecurity.actions.writeOff.access'); }
  get canDelete() { return this.can('invoiceSecurity.actions.delete.access'); }

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/invoices');
    this.lockInfo = await this.lock.transactionsDate();
    this.template.set(await this.builder.getDefault('invoice'));
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('INVOICES.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('INVOICES.LIST.INVOICES_LIST'), routerLink: '/account/invoices' },
      { label: t('INVOICES.VIEW.VIEW_INVOICE') },
    ];
    this.route.paramMap.subscribe(() => void this.load());
  }

  get id(): string { return this.route.snapshot.paramMap.get('id') ?? ''; }

  async load(): Promise<void> {
    this.loading.set(true);
    const inv = await this.invoices.getInvoice(this.id);
    if (!inv?.id) {
      void this.router.navigate(['/account/invoices'], { queryParamsHandling: 'preserve' });
      return;
    }
    this.invoice.set(inv);
    if (inv.customerId) {
      const c: any = await this.customers.getCustomerCredit(inv.customerId);
      this.customerCredit.set(Number(c?.credit) || 0);
    } else {
      this.customerCredit.set(0);
    }
    this.loading.set(false);
  }

  // ── status rules (legacy template conditions) ──────────────────────
  private isFinal(i: Invoice) { return i.isFullyRefunded || ['Void', 'writeOff', 'Closed'].includes(i.status); }
  isMerged(i: Invoice) { return !!i.mergeWith; }
  showEdit(i: Invoice) { return this.canAdd && this.lock.isEditable(this.lockInfo, i.invoiceDate) && !this.isFinal(i); }
  showPay(i: Invoice) { return this.canPay && i.status !== 'Paid' && i.status !== 'Draft' && !this.isFinal(i); }
  showClone(i: Invoice) { return this.canAdd && !i.isFullyRefunded && i.status !== 'Void' && i.status !== 'Closed'; }
  showOpen(i: Invoice) { return this.canOpen && i.status === 'Draft'; }
  showCreditNote(i: Invoice) { return this.canCreditNote && !this.isFinal(i) && i.status !== 'Draft'; }
  showWriteOff(i: Invoice) { return this.canWriteOff && (i.status === 'Open' || i.status === 'Partially Paid'); }
  showDelete(i: Invoice) {
    return this.canDelete && this.lock.isEditable(this.lockInfo, i.invoiceDate) && i.status !== 'Closed' && i.status !== 'Paid';
  }
  showApplyCredit(i: Invoice) {
    return this.customerCredit() > 0 && !['Closed', 'writeOff', 'Void'].includes(i.status) && i.balance > 0;
  }

  actionItems(i: Invoice): DropdownMenuBtnItem[] {
    const t = (k: string) => this.lang.instant(k);
    const items: DropdownMenuBtnItem[] = [];
    if (this.showClone(i)) items.push({ label: t('INVOICES.VIEW.CLONE'), click: () => this.clone(), disabled: false, danger: false });
    if (this.showOpen(i)) items.push({ label: t('INVOICES.VIEW.OPEN_INVOICE'), click: () => void this.openInvoice(), disabled: false, danger: false });
    if (this.showCreditNote(i)) items.push({ label: t('INVOICES.LIST.CREATE_CREDIT_NOTE'), click: () => this.createCreditNote(), disabled: false, danger: false });
    if (this.showWriteOff(i)) items.push({ label: t('INVOICES.ACTIONS.WRITE_OFF'), click: () => void this.writeOff(), disabled: false, danger: false });
    if (this.showDelete(i)) items.push({ label: t('COMMON.DELETE'), click: () => void this.remove(), disabled: false, danger: true });
    return items;
  }

  printItems(): DropdownMenuBtnItem[] {
    const t = (k: string) => this.lang.instant(k);
    return [
      { label: t('INVOICES.VIEW.PRINT'), click: () => void this.printPdf(), disabled: false, danger: false },
      { label: 'PDF', click: () => void this.savePdf(), disabled: false, danger: false },
    ];
  }

  exportItems(): DropdownMenuBtnItem[] {
    const t = (k: string) => this.lang.instant(k);
    return [
      { label: t('INVOICES.VIEW.EXPORT_CSV'), click: () => this.exportLines('csv'), disabled: false, danger: false },
      { label: t('INVOICES.VIEW.EXPORT_XLSX'), click: () => this.exportLines('xlsx'), disabled: false, danger: false },
    ];
  }

  shareItems(): DropdownMenuBtnItem[] {
    return [
      { label: this.lang.instant('INVOICES.VIEW.EMAIL_WHATSAPP'), click: () => void this.send(), disabled: false, danger: false },
      { label: 'PDF', click: () => void this.sharePdf(), disabled: false, danger: false },
    ];
  }

  // ── navigation ─────────────────────────────────────────────────────
  back(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigate(['/account/invoices']);
  }
  edit(): void { void this.router.navigate(['/account/invoices', this.id]); }
  clone(): void { void this.router.navigate(['/account/invoices', this.id], { queryParams: { cloned: 'yes' } }); }
  pay(): void { void this.router.navigate(['/account/invoices/payment', this.id]); }
  createCreditNote(): void { void this.router.navigate(['/account/credit-notes/new/forInvoice', this.id]); }
  goToInvoice(id: string): void { void this.router.navigate(['/account/invoices/view', id], { queryParamsHandling: 'preserve' }); }

  // ── actions ────────────────────────────────────────────────────────
  private async confirm(title: string, message: string, danger = false): Promise<boolean> {
    return !!(await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm', data: { title, message, danger },
    }).afterClosed());
  }

  private async run(task: () => Promise<any>, after: () => void): Promise<void> {
    try {
      await task();
      this.toast.success('COMMON.SAVED_OK');
      after();
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    }
  }

  async openInvoice(): Promise<void> {
    await this.run(() => this.invoices.openInvoice(this.invoice()!.id), () => void this.router.navigate(['/account/invoices']));
  }

  async writeOff(): Promise<void> {
    if (!(await this.confirm(this.lang.instant('INVOICES.ACTIONS.WRITE_OFF'), this.lang.instant('INVOICES.ACTIONS.CONFIRM_WRITE_OFF')))) return;
    await this.run(() => this.invoices.WriteOffInvoice(this.id), () => void this.router.navigate(['/account/invoices']));
  }

  async remove(): Promise<void> {
    if (!(await this.confirm(this.lang.instant('COMMON.DELETE'), this.lang.instant('INVOICES.VIEW.CONFIRM_DELETE'), true))) return;
    await this.run(() => this.invoices.DeleteInv(this.invoice()!.id), () => void this.router.navigate(['/account/invoices']));
  }

  async applyCredit(): Promise<void> {
    const inv = this.invoice()!;
    const ok = await this.modal.open<ApplyCreditModalComponent, ApplyCreditData, boolean>(ApplyCreditModalComponent, {
      size: 'lg',
      data: { invoiceId: inv.id!, invoiceNumber: inv.invoiceNumber, customerId: inv.customerId!, balance: inv.balance },
    }).afterClosed();
    if (ok) await this.load();
  }

  async send(): Promise<void> {
    const inv = this.invoice()!;
    await this.modal.open<SendDocumentModalComponent, SendDocumentData, boolean>(SendDocumentModalComponent, {
      size: 'md',
      data: {
        emails: inv.customerEmail ? [inv.customerEmail] : [],
        sendEmail: payload => this.invoices.sendInvoiceEmail({ ...payload, invoiceId: inv.id }),
        whatsapp: { type: 'invoice', id: inv.id!, phone: inv.customerPhone || inv.customerContact },
      },
    }).afterClosed();
  }

  // ── PDF / print / export ───────────────────────────────────────────
  async savePdf(): Promise<void> {
    const res = await this.invoices.viewInvoicePdf(this.id);
    if (res) downloadPdf(res, `invoice-${this.invoice()?.invoiceNumber ?? ''}.pdf`);
  }

  /** Legacy "print": the PDF opened in a new tab that prints itself once loaded. */
  async printPdf(): Promise<void> {
    const base64 = await this.invoices.viewInvoicePdf(this.id);
    if (!base64) return;
    const bytes = atob(String(base64).replace('data:application/pdf;base64,', ''));
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<html><body style="margin:0"><iframe id="pdf" src="${url}" style="width:100%;height:100vh;border:none"></iframe>` +
      `<script>document.getElementById('pdf').onload=function(){this.contentWindow.focus();this.contentWindow.print();}<\/script></body></html>`,
    );
    w.document.close();
  }

  async sharePdf(): Promise<void> {
    const res = await this.invoices.viewInvoicePdf(this.id);
    if (!res) return;
    const bytes = atob(String(res).replace('data:application/pdf;base64,', ''));
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const file = new File([arr], 'document.pdf', { type: 'application/pdf' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Share PDF' });
    } else {
      downloadPdf(res);
    }
  }

  exportLines(type: 'csv' | 'xlsx'): void {
    const inv = this.invoice();
    if (!inv?.lines?.length) {
      this.toast.error('COMMON.OPS', this.lang.instant('INVOICES.VIEW.NO_DATA'));
      return;
    }
    const rows = inv.lines.map((l: any) => ({
      ProductName: l.selectedItem?.name || l.note || '',
      Barcode: l.barcode || l.selectedItem?.barcode || '',
      Quantity: l.qty || 0,
      Price: l.price || 0,
      DiscountTotal: l.discountAmount || 0,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Lines');
    XLSX.writeFile(wb, `invoice-lines-${inv.invoiceNumber || 'export'}.${type}`, { bookType: type });
  }

  // ── zoom (persisted like legacy) ───────────────────────────────────
  private savedZoom(): number {
    try {
      const v = Number(localStorage.getItem(this.zoomKey));
      return v >= 40 && v <= 150 ? v : 100;
    } catch { return 100; }
  }
  setZoom(v: number): void {
    this.zoom.set(v);
    try { localStorage.setItem(this.zoomKey, String(v)); } catch { /* storage unavailable */ }
  }
}
