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
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { InvoiceLine } from '../../models/invoice.model';
import { DocumentLike, DocumentLineEditor } from '../../services/document-line-editor';
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
    QtyInputComponent, DragDropModule, DropdownMenuBtnComponent,
  ],
  templateUrl: './doc-lines-table.component.html',
  styleUrl: './doc-lines-table.component.scss',
})
export class DocLinesTableComponent {
  private modal = inject(ModalService);
  private lang = inject(LanguageService);

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
  private isBlankLine(l: InvoiceLine): boolean { return blank(l.productId) && blank(l.note); }

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
    for (const k of this.config().validate?.(line) ?? []) e['item'] = k;
    return e;
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
  results = signal<any[]>([]);
  searching = signal(false);
  private timer: any;
  private seq = 0;

  private async search(term: string): Promise<void> {
    if (this.config().itemsDisabled?.()) return;
    const id = ++this.seq;
    this.searching.set(true);
    try {
      const list = await this.config().itemSearch(term);
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
    this.editor().moveLine(ev.previousIndex, ev.currentIndex);
    this.touch();
  }

  trackLine = (i: number, l: InvoiceLine): any => l.id || (l as any).tempId || i;

  // ── additional-info strip, row menu ────────────────────────────────
  infoOpen = signal<Set<InvoiceLine>>(new Set());
  isInfoOpen = (l: InvoiceLine) => this.infoOpen().has(l);
  toggleInfo(l: InvoiceLine): void {
    this.infoOpen.update(s => { const n = new Set(s); n.has(l) ? n.delete(l) : n.add(l); return n; });
  }
  allInfoOpen = computed(() => {
    const lines = this.doc().lines;
    return lines.length > 0 && lines.every(l => this.infoOpen().has(l));
  });
  toggleAllInfo(): void { this.infoOpen.set(this.allInfoOpen() ? new Set() : new Set(this.doc().lines)); }

  private t = (k: string) => this.lang.instant(k);

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

  // ── add items in bulk ──────────────────────────────────────────────
  async addItemsInBulk(at: number | null = null): Promise<void> {
    const cfg = this.config();
    const picks = await this.modal.open<DocBulkItemsModalComponent, BulkItemsData, BulkPick[] | null>(DocBulkItemsModalComponent, {
      size: 'xl',
      data: { search: cfg.itemSearch, barcodeLookup: cfg.barcodeLookup, excludeTypes: cfg.excludeTypes },
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
