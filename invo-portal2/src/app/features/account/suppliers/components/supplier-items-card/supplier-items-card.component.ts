import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MathUtils } from '@core/math/math-helpers';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { Supplier, SupplierItem } from '../../models/supplier.model';
import { SuppliersService } from '../../services/suppliers.service';
import { PickSupplierProductsData, PickSupplierProductsModalComponent } from '../pick-supplier-products-modal/pick-supplier-products-modal.component';
import { SupplierImportResult, SupplierItemsImportModalComponent } from '../supplier-items-import-modal/supplier-items-import-modal.component';

interface Row extends SupplierItem { selected?: boolean }

/**
 * "Supplier items" card of the supplier form (edit mode — legacy `supplierData.id != ''`): the products the
 * supplier sells, paged / searched / sorted on the server (`accounts/getSupplierItems`), with the supplier's
 * own code, minimum order and unit cost editable per row. Edited rows travel with the form's Save
 * (`supplierData.supplierItems`, `modified`); adding (pick products / import file) and deleting items are
 * immediate calls, like legacy. Selection survives paging.
 */
@Component({
  selector: 'app-supplier-items-card',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <section class="si">
      <div class="si__head">
        <h2 class="si__title">{{ 'SUPPLIERS.LIST.SUPPLIER_ITEMS' | translate }}</h2>
        <div class="si__tools">
          <button type="button" class="si__btn" (click)="importFile()">{{ 'SUPPLIERS.ITEMS.IMPORT' | translate }}</button>
          <button type="button" class="si__btn" (click)="pickProducts()">＋ {{ 'SUPPLIERS.ITEMS.ADD_ITEMS' | translate }}</button>
        </div>
      </div>

      <div class="si__bar">
        <input class="si__search" type="text" [ngModel]="search" (ngModelChange)="onSearch($event)" [ngModelOptions]="{ standalone: true }" [placeholder]="'COMMON.SEARCH' | translate"/>
        @if (selected().size) {
          <button type="button" class="si__btn si__btn--danger" (click)="deleteSelected()">{{ 'COMMON.DELETE' | translate }} ({{ selected().size }})</button>
        }
      </div>

      <div class="si__wrap">
        <table class="si__table">
          <thead>
            <tr>
              <th class="si__chk"><input type="checkbox" [checked]="allOnPage()" (change)="toggleAll()"/></th>
              <th class="si__sort" (click)="sort('productName')">{{ 'SUPPLIERS.ITEMS.PRODUCT' | translate }}{{ arrow('productName') }}</th>
              <th class="si__sort" (click)="sort('supplierCode')">{{ 'SUPPLIERS.ITEMS.SUPPLIER_CODE' | translate }}{{ arrow('supplierCode') }}</th>
              <th class="si__sort end" (click)="sort('minimumOrder')">{{ 'SUPPLIERS.ITEMS.MINIMUM_ORDER' | translate }}{{ arrow('minimumOrder') }}</th>
              <th class="si__sort end" (click)="sort('cost')">{{ 'SUPPLIERS.ITEMS.UNIT_COST' | translate }}{{ arrow('cost') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.productId) {
              <tr [class.is-selected]="selected().has(r.productId)">
                <td class="si__chk"><input type="checkbox" [checked]="selected().has(r.productId)" (change)="toggle(r)"/></td>
                <td>{{ r.productName }}<small class="si__sub">{{ r.barcode }}</small></td>
                <td><input class="si__input" type="text" [ngModel]="r.supplierCode" (ngModelChange)="edit(r, 'supplierCode', $event)" [ngModelOptions]="{ standalone: true }"/></td>
                <td class="end"><input class="si__input si__input--num" type="number" min="0" [ngModel]="r.minimumOrder" (ngModelChange)="edit(r, 'minimumOrder', $event)" [ngModelOptions]="{ standalone: true }"/></td>
                <td class="end"><input class="si__input si__input--num" type="number" min="0" [ngModel]="r.cost" (ngModelChange)="edit(r, 'cost', $event)" [ngModelOptions]="{ standalone: true }"/></td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="si__empty">{{ 'SUPPLIERS.ITEMS.NO_ITEMS' | translate }}</td></tr>
            }
          </tbody>
        </table>
      </div>

      <div class="si__pager">
        <select class="si__limit" [ngModel]="limit" (ngModelChange)="onLimit($event)" [ngModelOptions]="{ standalone: true }">
          @for (n of [10, 25, 50, 100]; track n) { <option [value]="n">{{ n }}</option> }
        </select>
        <button type="button" class="si__btn" [disabled]="page <= 1" (click)="go(page - 1)">‹</button>
        <span>{{ page }} / {{ pageCount() }}</span>
        <button type="button" class="si__btn" [disabled]="page >= pageCount()" (click)="go(page + 1)">›</button>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .si { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; padding: 18px 20px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 14px; }
    .si__head, .si__bar, .si__pager { display: flex; align-items: center; gap: 10px; justify-content: space-between; }
    .si__tools { display: flex; gap: 8px; }
    .si__title { margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; }
    .si__btn { padding: 7px 14px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-size: 13px; font-weight: 600; cursor: pointer; }
    .si__btn:disabled { opacity: .5; cursor: not-allowed; }
    .si__btn--danger { border-color: #fecaca; color: #dc2626; }
    .si__search { flex: 1; max-width: 320px; border: 1px solid #d0d5dd; border-radius: 8px; padding: 8px 12px; font: inherit; }
    .si__wrap { overflow-x: auto; border: 1px solid #e4e7ec; border-radius: 10px; }
    .si__table { width: 100%; min-width: 640px; border-collapse: collapse; font-size: 13.5px; }
    .si__table th { text-align: start; background: #f8f9fc; color: #64748b; font-size: 12px; text-transform: uppercase; padding: 10px 12px; }
    .si__table td { padding: 8px 12px; border-top: 1px solid #f1f5f9; }
    .si__table .end { text-align: end; } .si__chk { width: 36px; } .si__sort { cursor: pointer; user-select: none; }
    .is-selected { background: #e6f4f6; }
    .si__sub { display: block; color: #94a3b8; font-size: 12px; }
    .si__input { width: 100%; border: 1px solid #d0d5dd; border-radius: 6px; padding: 7px 10px; font: inherit; }
    .si__input--num { width: 120px; text-align: end; }
    .si__empty { text-align: center; color: #94a3b8; padding: 22px; }
    .si__pager { justify-content: flex-end; color: #475569; font-size: 13px; }
    .si__limit { border: 1px solid #d0d5dd; border-radius: 8px; padding: 6px 8px; font: inherit; }
  `],
})
export class SupplierItemsCardComponent implements OnInit {
  private suppliers = inject(SuppliersService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  @Input({ required: true }) supplier!: Supplier;
  @Input({ required: true }) form!: FormGroup;

  rows = signal<Row[]>([]);
  pageCount = signal(1);
  /** Picked rows across pages, by product id. */
  selected = signal<Map<string, Row>>(new Map());

  page = 1;
  limit = 10;
  search = '';
  sortBy: { sortValue?: string; sortDirection?: string } = {};

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    const res = await this.suppliers.getSupplierItems({
      page: this.page, limit: this.limit, searchTerm: this.search, sortBy: this.sortBy, supplierId: this.supplier.id,
    });
    const list: Row[] = (res?.list ?? []).map((i: any) => { const x = new SupplierItem(); x.ParseJson(i); return x as Row; });
    // Overlay the edits not saved yet (kept in the supplier model, which the form's Save sends).
    for (const row of list) {
      const pending = this.supplier.supplierItems.find(i => i.productId === row.productId);
      if (pending) { row.supplierCode = pending.supplierCode; row.minimumOrder = pending.minimumOrder; row.cost = pending.cost; }
    }
    this.rows.set(list);
    this.pageCount.set(res?.pageCount ?? 1);
  }

  // ── paging / search / sort ─────────────────────────────────────────
  private timer: any;
  onSearch(v: string): void { this.search = v; this.page = 1; clearTimeout(this.timer); this.timer = setTimeout(() => void this.load(), 400); }
  onLimit(v: any): void { this.limit = +v; this.page = 1; void this.load(); }
  go(p: number): void { this.page = p; void this.load(); }
  /** asc → desc → none (legacy). */
  sort(col: string): void {
    const cur = this.sortBy;
    if (cur.sortValue !== col || !cur.sortDirection) this.sortBy = { sortValue: col, sortDirection: 'asc' };
    else if (cur.sortDirection === 'asc') this.sortBy = { sortValue: col, sortDirection: 'desc' };
    else this.sortBy = {};
    void this.load();
  }
  arrow(col: string): string { return this.sortBy.sortValue === col ? (this.sortBy.sortDirection === 'asc' ? ' ↑' : ' ↓') : ''; }

  // ── selection ──────────────────────────────────────────────────────
  allOnPage = () => this.rows().length > 0 && this.rows().every(r => this.selected().has(r.productId));
  toggle(r: Row): void {
    this.selected.update(m => { const n = new Map(m); n.has(r.productId) ? n.delete(r.productId) : n.set(r.productId, r); return n; });
  }
  toggleAll(): void {
    const all = this.allOnPage();
    this.selected.update(m => { const n = new Map(m); this.rows().forEach(r => (all ? n.delete(r.productId) : n.set(r.productId, r))); return n; });
  }

  // ── inline edits (saved with the form) ─────────────────────────────
  edit(r: Row, field: 'supplierCode' | 'minimumOrder' | 'cost', value: any): void {
    (r as any)[field] = field === 'supplierCode' ? value : MathUtils.setToMinValueIfItsUnder(Number(value) || 0, 0);
    let pending = this.supplier.supplierItems.find(i => i.productId === r.productId);
    if (!pending) { pending = Object.assign(new SupplierItem(), r); this.supplier.supplierItems.push(pending); }
    pending.supplierCode = r.supplierCode;
    pending.minimumOrder = r.minimumOrder;
    pending.cost = r.cost;
    pending.modified = true;
    this.selected.update(m => new Map(m).set(r.productId, r));
    this.form.markAsDirty();
  }

  // ── add / import / delete (immediate, like legacy) ─────────────────
  async pickProducts(): Promise<void> {
    const products = await this.modal.open<PickSupplierProductsModalComponent, PickSupplierProductsData, any[] | null>(
      PickSupplierProductsModalComponent, { size: 'lg', data: { supplierId: this.supplier.id } },
    ).afterClosed();
    if (products?.length) await this.addItems(products.map(p => Object.assign(new SupplierItem(), { productId: p.id, productName: p.name })));
  }

  async importFile(): Promise<void> {
    const res = await this.modal.open<SupplierItemsImportModalComponent, void, SupplierImportResult | null>(SupplierItemsImportModalComponent, { size: 'md' }).afterClosed();
    if (!res) return;
    const items: SupplierItem[] = [];
    const notFound: string[] = [];
    for (const line of res.lines) {
      const found = await this.suppliers.getPurchaseProductByBarcode({ searchTerm: line.barcode });
      const product = found?.data;
      if (product?.id) {
        items.push(Object.assign(new SupplierItem(), {
          barcode: line.barcode, supplierCode: line.SIC, minimumOrder: line.minimumOrder, cost: line.unitCost,
          id: product.id, productId: product.id, productName: product.name,
        }));
      } else notFound.push(line.barcode);
    }
    if (items.length) await this.addItems(items);
    const problems = [...res.errors.map(e => `#${e.row}: ${e.reason}`), ...notFound.map(b => `${b}: not found`)];
    if (problems.length) this.toast.error('COMMON.OPS', problems.join(' · '));
  }

  private async addItems(items: SupplierItem[]): Promise<void> {
    const res: any = await this.suppliers.addSupplierItems({ supplierId: this.supplier.id, items });
    if (res?.success) { this.selected.set(new Map()); await this.load(); }
    else this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
  }

  async deleteSelected(): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm', data: { title: 'COMMON.DELETE', message: 'SUPPLIERS.ITEMS.CONFIRM_DELETE', danger: true },
    }).afterClosed();
    if (!ok) return;
    const productIds = [...this.selected().keys()];
    const res: any = await this.suppliers.deleteSupplierItem({ supplierId: this.supplier.id, productIds });
    if (res?.success) {
      this.supplier.supplierItems = this.supplier.supplierItems.filter(i => !productIds.includes(i.productId));
      this.selected.set(new Map());
      await this.load();
    } else {
      this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
    }
  }
}
