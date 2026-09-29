import '../../account-i18n';
import { Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DiscountFieldComponent, DiscountValue } from '@shared/components/discount-field/discount-field.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { QtyInputComponent } from '@shared/components/qty-input';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { evalArithmetic } from '@core/math/expression';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { InvoiceLine } from '../../models/invoice.model';
import { DocumentLike, DocumentLineEditor } from '../../services/document-line-editor';
import { DocItemFilterModalComponent, ItemFilterData } from '../doc-item-filter-modal/doc-item-filter-modal.component';
import { ProductDetailDrawerComponent, ProductDetailDrawerData } from '../../../products/components/product-detail-drawer/product-detail-drawer.component';
import { DocImportLinesModalComponent, ImportLinesResult } from '../doc-import-lines-modal/doc-import-lines-modal.component';
import { BulkUpdateData, BulkUpdateResult, DocBulkUpdateModalComponent } from '../doc-bulk-update-modal/doc-bulk-update-modal.component';
import { BulkItemsData, BulkPick, DocBulkItemsModalComponent } from '../doc-bulk-items-modal/doc-bulk-items-modal.component';
import { DocLineColumn, DocLineErrors, DocLinesConfig, DocLinesContext } from './doc-lines.types';

const blank = (v: any) => v == null || (typeof v === 'string' && v.trim() === '');

/**
 * The line-items table shared by every account document form (invoice, estimate, credit note,
 * bill, PO …). Layout and behaviour are the same everywhere — typeahead item cell, scan bar,
 * bulk update, additional-info strip, row menu, drag reorder, per-line validation — while the
 * columns, item source and rules come from `config`, and the document from `doc` + `editor`.
 * Content projected into the component renders below the table (notes, totals, …).
 */
@Component({
  selector: 'app-doc-lines-table',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, MycurrencyPipe, SearchDropdownComponent, DiscountFieldComponent,
    QtyInputComponent, DragDropModule, TooltipDirective, DropdownMenuBtnComponent,
  ],
  templateUrl: './doc-lines-table.component.html',
  styleUrl: './doc-lines-table.component.scss',
})
export class DocLinesTableComponent {
  private modal = inject(ModalService);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);

  doc = input.required<DocumentLike>();
  editor = input.required<DocumentLineEditor>();
  config = input.required<DocLinesConfig>();
  formStatus = input<string>('new');
  /** Shown as the first header cell. */
  title = input<string>('DOC_LINES.ITEM_TABLE');

  changed = output<void>();
  validityChange = output<boolean>();

  ctx = computed<DocLinesContext>(() => ({
    formStatus: this.formStatus(),
    status: this.doc().status,
    hasScope: !(this.config().itemsDisabled?.() ?? false),
  }));

  columns = computed(() => this.config().columns.filter(c => c.visible?.(this.ctx()) ?? true));
  accountOptions = computed(() => this.editor().accounts);
  taxOptions = computed(() => this.editor().taxes);

  private touch(): void {
    this.changed.emit();
    this.validityChange.emit(this.isValid());
  }

  // ── validation ─────────────────────────────────────────────────────
  /** Blank trailing rows and rows flagged deleted take no part in validation. */
  private isBlankLine(l: InvoiceLine): boolean { return !!(l as any).isDeleted || (blank(l.productId) && blank(l.note)); }
  /** Lines shown in the table (deleted ones stay in the document until it is saved). */
  visibleLines(): InvoiceLine[] { return this.doc().lines.filter(l => !(l as any).isDeleted); }

  /** Column-key → i18n key of what's wrong on this line (blank trailing rows are ignored). */
  errorsFor(line: InvoiceLine): DocLineErrors {
    if (this.isBlankLine(line)) return {};
    const e: DocLineErrors = {};
    for (const c of this.columns()) {
      if (c.type === 'amount' || c.type === 'item') continue;
      const v = (line as any)[this.fieldOf(c)];
      if (c.type === 'qty' && (v == null || isNaN(Number(v)))) e[c.key] = 'DOC_LINES.ERR_REQUIRED';
      else if (c.required && (v == null || v === '' || isNaN(Number(v)))) e[c.key] = 'DOC_LINES.ERR_REQUIRED';
      else if (c.min != null && Number(v) < c.min) e[c.key] = 'DOC_LINES.ERR_MIN';
      if (c.type === 'tax' && (line.taxes ?? []).some(t => t.taxPercentage == null || blank(t.taxId))) e[c.key] = 'DOC_LINES.ERR_TAX';
    }
    if (this.config().accounts && blank(line.accountId)) e['account'] = 'DOC_LINES.ERR_ACCOUNT';
    for (const k of this.config().validate?.(line) ?? []) e['item'] = k;
    return e;
  }

  /** First specific problem on any non-blank line (i18n key), for the save-blocked message. */
  firstIssue(): string | null {
    for (const l of this.doc().lines.filter(x => !this.isBlankLine(x))) {
      const k = Object.values(this.errorsFor(l))[0];
      if (k) return k;
    }
    return null;
  }

  isValid(): boolean {
    const lines = this.doc().lines.filter(l => !this.isBlankLine(l));
    return lines.length > 0 && lines.every(l => Object.keys(this.errorsFor(l)).length === 0);
  }

  // ── column helpers ─────────────────────────────────────────────────
  fieldOf(c: DocLineColumn): string {
    return c.field ?? (c.type === 'qty' ? 'qty' : c.type === 'discount' ? 'discountAmount' : 'price');
  }
  value(line: InvoiceLine, c: DocLineColumn): any { return (line as any)[this.fieldOf(c)]; }
  isLocked(line: InvoiceLine): boolean {
    return line.isVoided || line.isReturned || (line.voidedItems?.length ?? 0) > 0 || (this.config().isLocked?.(line) ?? false);
  }
  cellDisabled(line: InvoiceLine, c: DocLineColumn): boolean {
    return this.isLocked(line) || (c.disabled?.(line, this.ctx()) ?? false);
  }
  canEditProduct(line: InvoiceLine): boolean {
    return this.config().canEditProduct?.(line, this.ctx()) ?? (line.isNew || this.formStatus() === 'clone');
  }

  // ── item cell: free text (note) OR product ─────────────────────────
  activeLine = signal<InvoiceLine | null>(null);
  /** Viewport position of the product panel (it is `fixed` so the table's scroll box can't clip it). */
  panelPos = signal<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 });
  private placePanel(el: HTMLElement | null): void {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const top = below < 280 && r.top > below ? Math.max(8, r.top - 284) : r.bottom + 4;
    this.panelPos.set({ top, left: r.left, width: Math.max(r.width, 320) });
  }
  /** Item filter (tags) applied to every item search of this table. */
  tags = signal<string[]>([]);
  async openFilter(ev: Event): Promise<void> {
    ev.stopPropagation();
    const load = this.config().itemFilterTags;
    if (!load) return;
    const res = await this.modal.open<DocItemFilterModalComponent, ItemFilterData, string[] | null>(DocItemFilterModalComponent, {
      size: 'md', data: { tags: load, selected: this.tags() },
    }).afterClosed();
    if (res) { this.tags.set(res); this.results.set([]); }
  }
  results = signal<any[]>([]);
  searching = signal(false);
  private timer: any;
  private seq = 0;

  private async search(term: string): Promise<void> {
    if (this.config().itemsDisabled?.()) return;
    const id = ++this.seq;
    this.searching.set(true);
    try {
      const list = await this.config().itemSearch(term, { tags: this.tags() });
      const ex = this.config().excludeTypes ?? [];
      if (id === this.seq) this.results.set(list.filter(x => !ex.includes(x.type)));
    } finally {
      if (id === this.seq) this.searching.set(false);
    }
  }

  onItemFocus(line: InvoiceLine, ev?: Event): void {
    this.placePanel(ev?.target as HTMLElement);
    this.activeLine.set(line);
    void this.search(line.selectedItem?.id ? '' : (line.note || ''));
  }

  /** Typing keeps the text as the line note (a valid note-only line) and searches products. */
  onItemInput(line: InvoiceLine, value: string, ev?: Event): void {
    this.placePanel((ev as any)?.target ?? null);
    line.note = value;
    line.itemDetailsTemp = value;
    this.activeLine.set(line);
    this.touch();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.search(value), 350);
  }

  /** Enter = barcode scan on the row: a match becomes the product, otherwise the text stays a note. */
  async onItemEnter(line: InvoiceLine, value: string, ev: Event): Promise<void> {
    ev.preventDefault();
    clearTimeout(this.timer);
    const term = value.trim();
    const lookup = this.config().barcodeLookup;
    if (!term || !lookup || this.config().itemsDisabled?.()) return;
    const product = await lookup(term);
    if (product) this.pickProduct(line, product);
  }

  pickProduct(line: InvoiceLine, product: any): void {
    this.editor().chooseItem(line, product);
    this.activeLine.set(null);
    if (!this.editor().lastLineIsEmpty) this.editor().addLine();
    this.touch();
  }
  clearProduct(line: InvoiceLine): void { this.editor().clearItem(line); this.touch(); }
  onNote(line: InvoiceLine, v: string): void {
    line.note = v;
    if (!line.selectedItem?.id) line.itemDetailsTemp = v;
    this.touch();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  closeOnScroll(): void { this.activeLine.set(null); }

  @HostListener('document:click', ['$event'])
  closePanel(ev: Event): void {
    if (!(ev.target as HTMLElement)?.closest?.('.dl__item')) this.activeLine.set(null);
  }

  // ── other cells ────────────────────────────────────────────────────
  onQty(line: InvoiceLine, c: DocLineColumn, qty: number): void {
    (line as any)[this.fieldOf(c)] = Math.max(qty, line.minQty || 0);
    if (this.fieldOf(c) === 'qty') this.editor().onChangeQty(line, qty);
    this.doc().calculateTotal();
    this.touch();
  }
  /** Rate cell: plain numbers or a small expression like (5+6)*2 — evaluated on blur / Enter. */
  commitMoney(line: InvoiceLine, c: DocLineColumn, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const text = el.value.trim();
    const current = (line as any)[this.fieldOf(c)];
    if (text === String(current ?? '')) return;
    const n = text === '' ? 0 : evalArithmetic(text);
    if (n == null || n < 0) {
      this.toast.error('COMMON.OPS', this.t('DOC_LINES.EXPR_INVALID'));
      el.value = String(current ?? '');
      return;
    }
    const v = Math.round(n * 1e6) / 1e6;
    el.value = String(v);
    this.onMoney(line, c, v);
  }
  onMoney(line: InvoiceLine, c: DocLineColumn, v: any): void {
    (line as any)[this.fieldOf(c)] = v === '' || v == null ? 0 : Number(v);
    this.editor().onChangePrice(line);
    this.touch();
  }
  onDiscount(line: InvoiceLine, d: DiscountValue): void { this.editor().setLineDiscount(line, d); this.touch(); }
  onTax(line: InvoiceLine, taxId: string | null): void {
    line.taxId = taxId || null;
    this.editor().onChangeTax(line);
    this.touch();
  }
  onAccount(line: InvoiceLine, id: string): void { line.accountId = id; this.touch(); }

  byId = (a: any, b: any) => a?.id === b?.id;
  taxLabel = (t: any) => (t ? `${t.name} (${t.taxPercentage}%)` : '');
  accountLabel = (a: any) => a?.name ?? '';
  taxOf = (line: InvoiceLine) => this.editor().taxes.find(t => t.id == line.taxId) ?? null;
  accountOf = (line: InvoiceLine) => this.editor().accounts.find(a => a.id == line.accountId) ?? null;

  // ── add / remove / reorder ─────────────────────────────────────────
  addLine(): void { this.editor().addLine(); this.touch(); }

  private get activeLines(): InvoiceLine[] { return this.doc().lines.filter((l: any) => !l.isDeleted); }
  private get isSingleDraftLine(): boolean {
    if (this.doc().status !== 'Draft') return false;
    return this.doc().lines.filter((l: any) => !l.isDeleted && !l.isVoided && (l.parentId == null || l.parentId === '')).length <= 1;
  }

  canRemove(line: InvoiceLine): boolean {
    const custom = this.config().canRemove;
    if (custom) return custom(line, this.ctx());
    if (line.isVoided) return false;
    if (this.doc().status === 'Open') return true;
    return this.activeLines.length > 1 && !this.isSingleDraftLine && !line.isReturned && !(line.voidedItems?.length);
  }

  async removeLine(line: InvoiceLine): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: { title: this.lang.instant('DOC_LINES.REMOVE_LINE'), message: this.lang.instant('DOC_LINES.CONFIRM_REMOVE_LINE'), danger: true },
    }).afterClosed();
    if (!ok) return;
    this.editor().removeLine(line, this.formStatus());
    this.touch();
  }

  drop(ev: CdkDragDrop<InvoiceLine[]>): void {
    if (ev.previousIndex === ev.currentIndex) return;
    const vis = this.visibleLines();
    const all = this.doc().lines;
    const from = all.indexOf(vis[ev.previousIndex]);
    const to = all.indexOf(vis[ev.currentIndex]);
    if (from < 0 || to < 0) return;
    this.editor().moveLine(from, to);
    this.touch();
  }

  trackLine = (i: number, l: InvoiceLine): any => l.id || (l as any).tempId || i;

  // ── additional-info strip, row menu ────────────────────────────────
  /** Additional info is shown by default; only lines the user collapsed are tracked. */
  infoHidden = signal<Set<InvoiceLine>>(new Set());
  isInfoOpen = (l: InvoiceLine) => !this.infoHidden().has(l);
  toggleInfo(l: InvoiceLine): void {
    this.infoHidden.update(s => { const n = new Set(s); n.has(l) ? n.delete(l) : n.add(l); return n; });
  }
  allInfoOpen = computed(() => this.infoHidden().size === 0);
  toggleAllInfo(): void { this.infoHidden.set(this.allInfoOpen() ? new Set(this.doc().lines) : new Set()); }

  private t = (k: string) => this.lang.instant(k);

  itemMenu(line: InvoiceLine): DropdownMenuBtnItem[] {
    const type = line.selectedItem?.type || 'inventory';
    return [
      { label: this.t('DOC_LINES.EDIT_ITEM'), click: () => { window.open(`/products/form/${type}/${line.productId}`, '_blank', 'noopener'); }, disabled: !line.productId, danger: false },
      { label: this.t('DOC_LINES.VIEW_ITEM_DETAILS'), click: () => this.viewItemDetails(line), disabled: !line.productId, danger: false },
    ];
  }

  rowMenu(line: InvoiceLine): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [];
    if (this.config().accounts) {
      items.push({ label: this.t(this.isInfoOpen(line) ? 'DOC_LINES.HIDE_INFO' : 'DOC_LINES.SHOW_INFO'), click: () => this.toggleInfo(line), disabled: false, danger: false });
    }
    items.push(
      { label: this.t('DOC_LINES.CLONE'), click: () => { this.editor().cloneLine(line); this.touch(); }, disabled: this.isBlankLine(line), danger: false },
      { label: this.t('DOC_LINES.INSERT_ROW'), click: () => { this.editor().insertLineAt(this.doc().lines.indexOf(line)); this.touch(); }, disabled: false, danger: false },
    );
    if (this.config().bulkItems) {
      items.push({ label: this.t('DOC_LINES.INSERT_BULK'), click: () => void this.addItemsInBulk(this.doc().lines.indexOf(line)), disabled: !this.ctx().hasScope, danger: false });
    }
    return items;
  }

  viewItemDetails(line: InvoiceLine): void {
    this.modal.open<ProductDetailDrawerComponent, ProductDetailDrawerData, void>(ProductDetailDrawerComponent, {
      drawer: true, drawerWidth: '905px', drawerResizable: true, drawerMinWidth: 905,
      data: { productId: line.productId, row: { id: line.productId, name: line.productName, type: line.selectedItem?.type } },
    });
  }

  bulkMenu(): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [];
    if (this.config().accounts) {
      items.push({ label: this.t('DOC_LINES.BULK_UPDATE'), click: () => this.bulkMode.set(true), disabled: false, danger: false });
      items.push({ label: this.t(this.allInfoOpen() ? 'DOC_LINES.HIDE_ALL_INFO' : 'DOC_LINES.SHOW_ALL_INFO'), click: () => this.toggleAllInfo(), disabled: false, danger: false });
    }
    return items;
  }

  // ── bulk update (select lines → set account / discount) ────────────
  bulkMode = signal(false);
  selected = signal<Set<InvoiceLine>>(new Set());
  isSelected = (l: InvoiceLine) => this.selected().has(l);
  toggleSelect(l: InvoiceLine): void {
    this.selected.update(s => { const n = new Set(s); n.has(l) ? n.delete(l) : n.add(l); return n; });
  }
  closeBulk(): void { this.bulkMode.set(false); this.selected.set(new Set()); }
  bulkAccount(a: any): void {
    if (!a) return;
    this.selected().forEach(l => { if (l.isNew) l.accountId = a.id; });
    this.touch();
  }
  bulkDiscount(d: DiscountValue): void {
    this.selected().forEach(l => { if (!this.isLocked(l)) this.editor().setLineDiscount(l, d); });
    this.touch();
  }

  async bulkUpdate(mode: 'account' | 'discount'): Promise<void> {
    const res = await this.modal.open<DocBulkUpdateModalComponent, BulkUpdateData, BulkUpdateResult | null>(DocBulkUpdateModalComponent, {
      size: 'md', data: { mode, accounts: this.accountOptions() },
    }).afterClosed();
    if (!res) return;
    if ('account' in res) this.bulkAccount(res.account);
    else this.bulkDiscount(res.discount);
  }

  // ── add items in bulk ──────────────────────────────────────────────
  async addItemsInBulk(at: number | null = null): Promise<void> {
    const cfg = this.config();
    const picks = await this.modal.open<DocBulkItemsModalComponent, BulkItemsData, BulkPick[] | null>(DocBulkItemsModalComponent, {
      size: 'xl',
      data: { search: (t: string, page = 1) => cfg.itemSearch(t, { tags: this.tags(), page }), barcodeLookup: cfg.barcodeLookup, excludeTypes: cfg.excludeTypes },
    }).afterClosed();
    if (!picks?.length) return;

    const doc = this.doc();
    const last = doc.lines[doc.lines.length - 1];
    if (last && this.isBlankLine(last)) doc.lines.pop();
    let pos = at ?? doc.lines.length;
    for (const { product, qty } of picks) {
      const line = this.editor().addLine();
      doc.lines.pop();
      doc.lines.splice(pos++, 0, line);
      this.editor().chooseItem(line, product);
      line.qty = qty;
      line.tempQty = qty;
    }
    doc.lines.forEach((l, i) => (l.index = i));
    if (!this.editor().lastLineIsEmpty) this.editor().addLine();
    doc.calculateTotal();
    this.touch();
  }

  // ── import (CSV / XLSX by barcode) ─────────────────────────────────
  async importLines(): Promise<void> {
    const cfg = this.config();
    if (!cfg.searchByBarcodes) return;
    const res = await this.modal.open<DocImportLinesModalComponent, void, ImportLinesResult | null>(DocImportLinesModalComponent, { size: 'md' }).afterClosed();
    if (!res?.lines.length) return;

    const doc = this.doc();
    const last = doc.lines[doc.lines.length - 1];
    if (last && this.isBlankLine(last)) doc.lines.pop();

    let rows = res.lines;
    if (res.skipDuplicate) {
      const have = new Set(doc.lines.map((l: any) => String(l.barcode || l.selectedItem?.barcode || '').trim()).filter(Boolean));
      rows = rows.filter(r => !have.has(r.barcode));
    }
    if (!rows.length) {
      this.toast.error('COMMON.OPS', this.t(res.skipDuplicate ? 'DOC_IMPORT.ALL_EXIST' : 'DOC_IMPORT.NOTHING'));
      if (!this.editor().lastLineIsEmpty) this.editor().addLine();
      return;
    }

    const found = (await cfg.searchByBarcodes([...new Set(rows.map(r => r.barcode))])) ?? [];
    const byCode = new Map<string, any>(found.filter(p => p?.barcode).map(p => [String(p.barcode).trim(), p]));
    const missing: string[] = [];
    let added = 0;
    for (const r of rows) {
      const p = byCode.get(r.barcode);
      if (!p || (cfg.excludeTypes ?? []).includes(p.type)) { missing.push(r.barcode); continue; }
      const line = this.editor().addLine();
      doc.lines.pop();
      doc.lines.push(line);
      this.editor().chooseItem(line, p);
      (line as any).barcode = p.barcode || r.barcode;
      line.qty = r.qty;
      line.tempQty = r.qty;
      if (r.price != null) line.price = r.price;
      if (!line.accountId && this.editor().accounts.length) line.accountId = this.editor().accounts[0].id;
      if (r.discountTotal > 0) this.editor().setLineDiscount(line, { amount: r.discountTotal, percentage: false });
      added++;
    }
    doc.lines.forEach((l, i) => (l.index = i));
    if (!this.editor().lastLineIsEmpty) this.editor().addLine();
    doc.calculateTotal();
    this.touch();

    if (missing.length) this.toast.warning(this.t('DOC_IMPORT.NOT_FOUND').replace('{{count}}', String(missing.length)), missing.slice(0, 10).join(', ') + (missing.length > 10 ? '…' : ''));
    else this.toast.success(this.t('DOC_IMPORT.DONE').replace('{{count}}', String(added)));
  }

  // ── scan item ──────────────────────────────────────────────────────
  scanOpen = signal(false);
  scanMessage = signal('');
  async onScan(input: HTMLInputElement): Promise<void> {
    const term = input.value.trim();
    const lookup = this.config().barcodeLookup;
    if (!term || !lookup || this.config().itemsDisabled?.()) return;
    const product = await lookup(term);
    const ex = this.config().excludeTypes ?? [];
    if (product && !ex.includes(product.type)) {
      this.editor().addScanned(product);
      this.scanMessage.set('');
      this.touch();
    } else {
      this.scanMessage.set(this.lang.instant('DOC_LINES.SCAN_NOT_FOUND'));
    }
    input.value = '';
    input.focus();
  }
}
