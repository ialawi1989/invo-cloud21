import { Directive, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import * as XLSX from 'xlsx';

import { IntCodec, ParamDef, QueryParamsService, StringCodec } from '@shared/services/query-params.service';

import { LanguageService } from '@core/i18n/language.service';
import { LayoutService } from '@core/layout/services/layout.service';
import { downloadPdf } from '@core/utils/pdf-download';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { DocumentBuilderService } from '../../settings/document-builder/services/document-builder.service';
import type { DocumentTemplate, DocumentType } from '../../settings/document-builder/services/document-template.types';
import type { ReportTemplate } from '../../settings/document-builder/report-engine/core/types/template.types';
import { BindingEngine } from '../../settings/document-builder/report-engine/core/binding/binding-engine';
import { PaginationEngine } from '../../settings/document-builder/report-engine/core/layout/pagination';
import { HtmlRenderer } from '../../settings/document-builder/report-engine/renderers/html/html-renderer';
import { toReportData, CompanyLike } from '../../settings/document-builder/report-engine/utils/report-data';
import { CompanyService } from '@core/auth/company.service';
import { SendDocumentData, SendDocumentModalComponent } from '../components/send-document-modal/send-document-modal.component';

/** URL query-param keys for the record rail's own state (page + search) — shared by every document
 *  view so reloading, bookmarking, or navigating between rail rows never silently drops it. */
const RAIL_PARAMS = {
  page: { key: 'rpage', codec: IntCodec } as ParamDef<number>,
  term: { key: 'rq', codec: StringCodec } as ParamDef<string>,
};

/** One row of the left "record rail" (Zoho-style list beside the open document). */
export interface DocRailItem {
  id: string;
  primary: string;
  amountLabel: string;
  sub: string;
  /** A warning line under the row (e.g. "Overdue by N days") — legacy list styling. */
  badgeText?: string;
  badgeKind?: 'warn' | 'neutral';
  /** The document's status as a small colored pill, inline with `sub` (e.g. "Open", "Paid", "Draft"). */
  statusText?: string;
  statusKind?: 'draft' | 'open' | 'paid' | 'partial' | 'void' | 'neutral';
  /** The raw record, so bulk actions can apply their own rules (e.g. which statuses may be deleted). */
  data?: any;
}

/** An action on the rail's ticked records ("Export merged PDF", "Delete"…). The shell clears the ticks once `run` settles. */
export interface DocRailBulkAction {
  id: string;
  /** Already translated. */
  label: string;
  danger?: boolean;
  separator?: boolean;
  run: (items: DocRailItem[]) => void | Promise<void>;
}

/** What a sales-document view needs from its API service. */
export interface DocViewService {
  get(id: string): Promise<any>;
  pdf(id: string): Promise<any>;
  sendEmail(payload: any, id: string): Promise<any>;
}

/** Per-document settings of a view built on {@link DocumentViewBase}. */
export interface DocViewConfig {
  features: string[];
  /** List route (`/account/estimate`); the form lives at `<routeBase>/:id`. */
  routeBase: string;
  /** The document's default template; leave out for a document drawn by its own component (a payment's receipt). */
  templateType?: DocumentType;
  zoomKey: string;
  /** Property holding the document number, used in the title and file names. */
  numberField: string;
  whatsappType: string;
  /** File-name prefix of the PDF / exported lines. */
  filePrefix: string;
  titleKey: string;
  dashboardCrumbKey: string;
  listCrumbKey: string;
  viewCrumbKey: string;
}

/**
 * Everything the document view pages (invoice, estimate, credit note, …) share: loading the
 * document + its default document template, the zoom (persisted like legacy), the Print / PDF /
 * Share / Export menus, send by email / WhatsApp, and confirm-and-run helpers for the actions.
 * A concrete view supplies its config, service, the render-data mapper and its own action buttons
 * (whose visibility comes from the entity's shared action rules).
 */
@Directive()
export abstract class DocumentViewBase implements OnInit, OnDestroy {
  protected route = inject(ActivatedRoute);
  protected router = inject(Router);
  protected location = inject(Location);
  protected lang = inject(LanguageService);
  protected toast = inject(ToastService);
  protected modal = inject(ModalService);
  protected builder = inject(DocumentBuilderService);
  private layout = inject(LayoutService);
  private company = inject(CompanyService);
  private qp = inject(QueryParamsService);

  abstract readonly cfg: DocViewConfig;
  protected abstract svc: DocViewService;
  protected abstract toRenderData(doc: any): DocumentRenderData;
  /** Runs after the document loaded (extra lookups such as the customer credit). */
  protected afterLoad(_doc: any): Promise<void> | void {}
  /** Runs once when the page opens (lock info, …). */
  protected onInit(): Promise<void> | void {}

  protected canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;

  doc = signal<any | null>(null);
  template = signal<DocumentTemplate | null>(null);
  loading = signal(true);
  zoom = signal(100);
  breadcrumbs: BreadcrumbItem[] = [];

  // ── record rail (left list beside the open document, page by page) ──
  readonly railPageSize = 15;
  railItems = signal<DocRailItem[]>([]);
  railLoading = signal(false);
  railPage = signal(1);
  railPageCount = signal(1);
  railTitleKey = 'DOC_VIEW.ALL_RECORDS';
  /** Current rail search term — public (not just a private field) so the shell can show it in the
   *  search box and clear it, and so it round-trips through the URL like a list page's search does. */
  railTerm = signal('');
  private railSeq = 0;
  private railSearch$ = new Subject<string>();
  /** Supplied by the concrete view: fetch a page + map rows into rail items. */
  protected railFetch?: (search: string, page: number) => Promise<{ list: any[]; pageCount: number }>;
  protected railMap?: (row: any) => DocRailItem;

  /** Reads `rpage`/`rq` off the URL (same `QueryParamsService` convention list pages use) so a
   *  reload, bookmark, or browser back/forward on this page restores the rail exactly as left. */
  protected initRail(fetch: (search: string, page: number) => Promise<{ list: any[]; pageCount: number }>, map: (row: any) => DocRailItem): void {
    this.railFetch = fetch;
    this.railMap = map;
    this.railSearch$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(term => {
      this.railTerm.set(term);
      void this.loadRail(1);
    });
    const initial = this.qp.read(RAIL_PARAMS);
    this.railTerm.set(initial.term);
    void this.loadRail(initial.page);
  }

  async loadRail(page: number): Promise<void> {
    if (!this.railFetch || !this.railMap) return;
    const id = ++this.railSeq;
    this.railLoading.set(true);
    try {
      const res = await this.railFetch(this.railTerm(), page);
      if (id !== this.railSeq) return;
      this.railItems.set(res.list.map(this.railMap));
      this.railPage.set(page);
      this.railPageCount.set(Math.max(1, res.pageCount || 1));
      this.qp.write(RAIL_PARAMS, { page, term: this.railTerm() });
    } finally {
      if (id === this.railSeq) this.railLoading.set(false);
    }
  }

  railPrev(): void { if (this.railPage() > 1) void this.loadRail(this.railPage() - 1); }
  railNext(): void { if (this.railPage() < this.railPageCount()) void this.loadRail(this.railPage() + 1); }

  onRailSearch(term: string): void { this.railSearch$.next(term); }
  isRailSelected = (item: DocRailItem) => item.id === this.id;

  /** The free-designer (report-engine) design to draw, when the default template is in `designer` mode and has one; else null (classic paper). */
  reportDesign = computed<ReportTemplate | null>(() => {
    const t = this.template();
    return t?.renderMode === 'designer' && t.reportDesign?.sections?.length ? t.reportDesign : null;
  });
  /** The raw record adapted for the report engine's bindings (company identity, flattened addresses, …). */
  reportData = computed<Record<string, unknown> | null>(() => {
    const d = this.doc();
    return d ? toReportData(d, this.company.currentCompany() as CompanyLike | null, this.lang.current()) : null;
  });

  renderData = computed<DocumentRenderData | null>(() => {
    const d = this.doc();
    return d ? this.toRenderData(d) : null;
  });

  protected t = (k: string) => this.lang.instant(k);
  get id(): string { return this.route.snapshot.paramMap.get('id') ?? ''; }
  get title(): string { return `${this.t(this.cfg.titleKey)} ${this.doc()?.[this.cfg.numberField] ?? ''}`; }

  async ngOnInit(): Promise<void> {
    // Edge-to-edge like Zoho's document view (rail + toolbar span the full width) — the app shell's
    // usual `.main-content` padding would otherwise show as a gap around the rail/toolbar.
    this.layout.setNoPadding(true);
    await Promise.all([...this.cfg.features, 'account/components/doc-lines-table'].map(f => this.lang.loadFeature(f)));
    await this.onInit();
    const saved = this.savedZoom();
    this.zoomChosen.set(saved != null);
    this.zoom.set(saved ?? 100);
    if (this.cfg.templateType) this.template.set(await this.builder.getDefault(this.cfg.templateType));
    this.breadcrumbs = [
      { label: this.t(this.cfg.dashboardCrumbKey), routerLink: '/dashboard' },
      { label: this.t(this.cfg.listCrumbKey), routerLink: this.cfg.routeBase },
      { label: this.t(this.cfg.viewCrumbKey) },
    ];
    this.route.paramMap.subscribe(() => void this.load());
  }

  ngOnDestroy(): void {
    this.layout.setNoPadding(false);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    const d = await this.svc.get(this.id);
    if (!d?.id) {
      void this.router.navigate([this.cfg.routeBase], { queryParamsHandling: 'preserve' });
      return;
    }
    this.doc.set(d);
    await this.afterLoad(d);
    this.loading.set(false);
  }

  // ── navigation ─────────────────────────────────────────────────────
  back(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigate([this.cfg.routeBase]);
  }
  edit(): void { void this.router.navigate([this.cfg.routeBase, this.id]); }
  add(): void { void this.router.navigate([this.cfg.routeBase, 'new']); }
  railGoTo(item: DocRailItem): void { void this.router.navigate([this.cfg.routeBase, 'view', item.id], { queryParamsHandling: 'preserve' }); }
  clone(): void { void this.router.navigate([this.cfg.routeBase, this.id], { queryParams: { cloned: 'yes' } }); }
  goToList(): void { void this.router.navigate([this.cfg.routeBase]); }

  // ── confirm / run ──────────────────────────────────────────────────
  protected async confirm(title: string, message: string, danger = false): Promise<boolean> {
    return !!(await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm', data: { title, message, danger },
    }).afterClosed());
  }

  protected async run(task: () => Promise<any>, after: () => void): Promise<void> {
    try {
      await task();
      this.toast.success('COMMON.SAVED_OK');
      after();
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    }
  }

  // ── menus ──────────────────────────────────────────────────────────
  private item = (label: string, click: () => void): DropdownMenuBtnItem => ({ label, click, disabled: false, danger: false });

  printItems(): DropdownMenuBtnItem[] {
    return [this.item(this.t('DOC_VIEW.PRINT'), () => void this.printPdf()), this.item('PDF', () => void this.savePdf())];
  }
  shareItems(): DropdownMenuBtnItem[] {
    return [this.item(this.t('DOC_VIEW.EMAIL_WHATSAPP'), () => void this.send()), this.item('PDF', () => void this.sharePdf())];
  }
  exportItems(): DropdownMenuBtnItem[] {
    return [this.item(this.t('DOC_VIEW.EXPORT_CSV'), () => this.exportLines('csv')), this.item(this.t('DOC_VIEW.EXPORT_XLSX'), () => this.exportLines('xlsx'))];
  }

  // ── send / PDF / print / export ────────────────────────────────────
  /** Who the send dialog offers by default - the customer (purchase documents override with the supplier). */
  protected recipient(d: any): { emails: string[]; phone: string } {
    return { emails: d.customerEmail ? [d.customerEmail] : [], phone: d.customerPhone || d.customerContact };
  }
  /** Rows of "Export lines" (CSV / XLSX). */
  protected exportRows(d: any): Record<string, any>[] {
    return d.lines.map((l: any) => ({
      ProductName: l.selectedItem?.name || l.note || '',
      Barcode: l.barcode || l.selectedItem?.barcode || '',
      Quantity: l.qty || 0,
      Price: l.price || 0,
      DiscountTotal: l.discountAmount || 0,
    }));
  }

  async send(): Promise<void> {
    const d = this.doc()!;
    const to = this.recipient(d);
    await this.modal.open<SendDocumentModalComponent, SendDocumentData, boolean>(SendDocumentModalComponent, {
      size: 'md',
      data: {
        emails: to.emails,
        sendEmail: payload => this.svc.sendEmail(payload, d.id),
        whatsapp: { type: this.cfg.whatsappType, id: d.id, phone: to.phone },
      },
    }).afterClosed();
  }

  async savePdf(): Promise<void> {
    const res = await this.svc.pdf(this.id);
    if (res) downloadPdf(res, `${this.cfg.filePrefix}-${this.doc()?.[this.cfg.numberField] ?? ''}.pdf`);
  }

  /** Legacy "print": the PDF opened in a new tab that prints itself once loaded. */
  async printPdf(): Promise<void> {
    const design = this.reportDesign();
    if (design) { await this.printDesigner(design); return; }
    const base64 = await this.svc.pdf(this.id);
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

  /** Designer-mode print (legacy prints the designer when `renderMode` is `designer`): the design is rendered client-side to a standalone
   *  HTML document and printed from a new tab, once its images (logo) have loaded. */
  private async printDesigner(design: ReportTemplate): Promise<void> {
    const w = window.open('', '_blank'); // opened before any await so the click's user gesture still counts
    if (!w) return;
    const engine = new BindingEngine();
    const html = new HtmlRenderer(engine, new PaginationEngine(engine)).render({ template: design, data: this.reportData() ?? {}, locale: design.locale });
    w.document.write(html);
    w.document.close();
    const imgs = Array.from(w.document.images).filter(i => !i.complete);
    await Promise.race([
      Promise.all(imgs.map(i => new Promise<void>(r => { i.addEventListener('load', () => r()); i.addEventListener('error', () => r()); }))),
      new Promise<void>(r => setTimeout(r, 5000)),
    ]);
    w.focus();
    w.print();
  }

  async sharePdf(): Promise<void> {
    const res = await this.svc.pdf(this.id);
    if (!res) return;
    const bytes = atob(String(res).replace('data:application/pdf;base64,', ''));
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const file = new File([arr], 'document.pdf', { type: 'application/pdf' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Share PDF' });
    else downloadPdf(res);
  }

  exportLines(type: 'csv' | 'xlsx'): void {
    const d = this.doc();
    if (!d?.lines?.length) {
      this.toast.error('COMMON.OPS', this.t('DOC_VIEW.NO_DATA'));
      return;
    }
    const rows = this.exportRows(d);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Lines');
    XLSX.writeFile(wb, `${this.cfg.filePrefix}-lines-${d[this.cfg.numberField] || 'export'}.${type}`, { bookType: type });
  }

  // ── zoom (persisted like legacy) ───────────────────────────────────
  /** The user's saved zoom (25–300, the viewer bar's range), or null when they never picked one — then the paper auto-fits (legacy `onAutoZoomCalculated`). */
  private savedZoom(): number | null {
    try {
      const raw = localStorage.getItem(this.cfg.zoomKey);
      if (raw == null) return null;
      const v = Number(raw);
      return v >= 25 && v <= 300 ? v : null;
    } catch { return null; }
  }
  /** True once the user has chosen a zoom (now or in an earlier session) — auto-fit then stays out of the way. */
  zoomChosen = signal(false);
  /** Auto-fit result from the shell: applied for this view only, never persisted as a preference. */
  onAutoZoom(v: number): void { if (!this.zoomChosen()) this.zoom.set(v); }
  setZoom(v: number): void {
    this.zoomChosen.set(true);
    this.zoom.set(v);
    try { localStorage.setItem(this.cfg.zoomKey, String(v)); } catch { /* storage unavailable */ }
  }
}
