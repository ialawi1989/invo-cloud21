import { Component, HostBinding, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MycurrencyPipe, MynumberPipe } from '../../../../core/pipes';
import { ProductsService, PurchaseHistoryPage, PurchaseHistoryRow } from '../../services/products.service';
import { getTransactionRoute } from '../../../../shared/utils/linked-types';
import { VisibleDirective } from '../../../../shared/directives/visible.directive';
import { SupplierService, SupplierMini } from '../../../suppliers';
import { SearchDropdownComponent } from '../../../../shared/components/dropdown';

/**
 * Paginated purchase-history table for the Purchase History tab.
 * Self-loads via IntersectionObserver (VisibleDirective host directive).
 */
@Component({
  selector: 'app-purchase-history',
  standalone: true,
  imports: [CommonModule, TranslateModule, DatePipe, MycurrencyPipe, MynumberPipe, SearchDropdownComponent],
  hostDirectives: [VisibleDirective],
  template: `
    <div class="filter-bar">
      <app-search-dropdown
        class="supplier-dropdown"
        [loadFn]="loadSuppliers"
        [displayWith]="supplierLabel"
        [compareWith]="supplierEquals"
        [value]="selectedSupplier()"
        (valueChange)="onSupplierChange($any($event))"
        [placeholder]="'PRODUCTS.PURCHASE.ALL_SUPPLIERS' | translate"
        [searchPlaceholder]="'PRODUCTS.PURCHASE.SEARCH_SUPPLIERS' | translate"
        [noResultsText]="'PRODUCTS.PURCHASE.NO_SUPPLIERS' | translate"
        [clearable]="true">
      </app-search-dropdown>
    </div>

    <div class="card">
      <div class="card-head">
        <span>
          {{ 'PRODUCTS.PURCHASE.TITLE' | translate }}
          @if (selectedSupplierName()) {
            <span class="title-supplier">— {{ selectedSupplierName() }}</span>
          }
        </span>

        @if (!loading() && page() && page()!.list.length) {
          <div class="pager">
            <button type="button" class="btn" [disabled]="pageNum() <= 1" (click)="prev()">
              {{ 'PRODUCTS.SALES.PREV' | translate }}
            </button>
            <span class="pager-num">{{ pageNum() }} / {{ page()!.pageCount || 1 }}</span>
            <button type="button" class="btn" [disabled]="pageNum() >= (page()!.pageCount || 1)" (click)="next()">
              {{ 'PRODUCTS.SALES.NEXT' | translate }}
            </button>
          </div>
        }
      </div>

      <div class="card-body">
        @if (loading() || !hasLoaded) {
          @for (i of [1,2,3,4,5]; track i) {
            <div class="row-skel">
              <div class="skeleton w-20"></div>
              <div class="skeleton w-15"></div>
              <div class="skeleton w-15"></div>
              <div class="skeleton w-10"></div>
              <div class="skeleton w-15"></div>
              <div class="skeleton w-15"></div>
              <div class="skeleton w-15"></div>
            </div>
          }
        } @else if (!page() || !page()!.list.length) {
          <div class="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M7 14l4-4 4 4 5-5"/>
            </svg>
            <p>{{ 'PRODUCTS.PURCHASE.NO_DATA' | translate }}</p>
          </div>
        } @else {
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th class="start">{{ 'PRODUCTS.PURCHASE.SUPPLIER'    | translate }}</th>
                  <th class="start">{{ 'PRODUCTS.PURCHASE.BILL_NUMBER' | translate }}</th>
                  <th class="start">{{ 'PRODUCTS.PURCHASE.DATE'        | translate }}</th>
                  <th class="end">{{   'PRODUCTS.SALES.QTY'            | translate }}</th>
                  <th class="end">{{   'PRODUCTS.PURCHASE.UNIT_COST'   | translate }}</th>
                  <th class="end">{{   'PRODUCTS.SALES.TAX'            | translate }}</th>
                  <th class="end">{{   'PRODUCTS.SALES.TOTAL'          | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of page()!.list; track $index) {
                  <tr>
                    <td>{{ row.supplierName || '—' }}</td>
                    <td class="nowrap">
                      @if (linkFor(row)) {
                        <a [href]="linkFor(row)" target="_blank" rel="noopener" class="link">
                          {{ row.billingNumber || '—' }}
                        </a>
                      } @else {
                        <span>{{ row.billingNumber || '—' }}</span>
                      }
                    </td>
                    <td class="mono nowrap">{{ row.billingDate | date:'dd/MM/yyyy' }}</td>
                    <td class="end mono">{{ row.qty       | mynumber }}</td>
                    <td class="end mono">{{ row.unitCost  | mynumber }}</td>
                    <td class="end mono">{{ row.taxTotal  | mycurrency }}</td>
                    <td class="end mono">{{ row.total     | mycurrency }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 320px; }
    :host(.loaded) { min-height: 0; }

    .filter-bar {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      margin-bottom: 12px;
    }
    .supplier-dropdown { display: inline-block; min-width: 240px; max-width: 320px; }
    @media (max-width: 600px) {
      .supplier-dropdown { display: block; min-width: 0; max-width: none; width: 100%; }
    }

    .title-supplier { font-weight: 500; color: #64748b; margin-inline-start: 4px; }

    .card { background:#fff; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; }
    .card-head {
      display:flex; align-items:center; justify-content:space-between; gap:16px;
      padding:10px 14px; background:#f8fafc; border-bottom:1px solid #e2e8f0;
      font-size:13px; font-weight:600; color:#0f172a;
    }
    .card-body { padding:0; }

    .pager { display:inline-flex; align-items:center; gap:8px; }
    .pager-num {
      padding:2px 10px; border-radius:999px;
      background:#e0f2f7; color:#0e7490;
      font-size:12px; font-weight:600; font-variant-numeric:tabular-nums;
    }
    .btn {
      padding:5px 10px; border-radius:6px;
      border:1px solid #e2e8f0; background:#fff;
      font-size:12px; font-weight:600; color:#475569;
      cursor:pointer; transition: background .12s, border-color .12s;
    }
    .btn:hover:not(:disabled) { background:#f8fafc; }
    .btn:disabled { opacity:.45; cursor:not-allowed; }

    .tbl-wrap { width:100%; overflow-x:auto; }
    .tbl { width:100%; border-collapse:separate; border-spacing:0; font-size:13px; }
    .tbl thead th {
      background:#f8fafc; color:#64748b;
      font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.04em;
      padding:10px 14px; border-bottom:1px solid #e2e8f0; white-space:nowrap;
    }
    .tbl tbody td { padding:10px 14px; border-bottom:1px solid #f1f5f9; color:#0f172a; }
    .tbl tbody tr:last-child td { border-bottom:none; }
    .tbl tbody tr:hover { background:#f8fafc; }
    .start { text-align:start; }
    .end   { text-align:end; }
    .mono  { font-variant-numeric:tabular-nums; }
    .nowrap { white-space:nowrap; }

    .link { color:#0e7490; font-weight:500; text-decoration:none; }
    .link:hover { text-decoration:underline; }

    .empty {
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      gap:8px; padding:48px 20px; color:#94a3b8;
    }
    .empty svg { opacity:.5; }
    .empty p { margin:0; font-size:13px; }

    .row-skel { display:grid; grid-template-columns: repeat(7, 1fr); gap:10px; padding:14px; border-bottom:1px solid #f1f5f9; }
    .row-skel:last-child { border-bottom:none; }
    @keyframes skel-shimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
    .skeleton {
      height:12px;
      background: linear-gradient(90deg,#e2e8f0 0%,#f1f5f9 50%,#e2e8f0 100%);
      background-size:200% 100%;
      animation: skel-shimmer 1.4s ease-in-out infinite;
      border-radius:6px;
    }
    .w-10 { width:40%; }
    .w-15 { width:60%; }
    .w-20 { width:80%; }
  `],
})
export class PurchaseHistoryComponent implements OnInit {
  @Input() productId: string | null = null;
  @Input() pageLimit = 15;

  private svc = inject(ProductsService);
  private visibility = inject(VisibleDirective);
  private supplierSvc = inject(SupplierService);

  hasLoaded = false;
  @HostBinding('class.loaded') get loadedClass() { return this.hasLoaded; }
  loading = signal(false);
  pageNum = signal(1);
  page    = signal<PurchaseHistoryPage | null>(null);

  // ─── Supplier filter ─────────────────────────────────────────
  selectedSupplier = signal<SupplierMini | null>(null);
  selectedSupplierName = computed(() => this.selectedSupplier()?.name ?? '');

  /** Display + equality helpers passed to `app-search-dropdown`. */
  supplierLabel  = (s: SupplierMini) => s.name;
  supplierEquals = (a: SupplierMini, b: SupplierMini) => a?.id === b?.id;

  /**
   * Server-backed page loader for the supplier dropdown. The dropdown calls
   * this on open, on every (debounced) search keystroke, and again whenever
   * the user scrolls past the loaded list. Bound as an arrow so `this` stays
   * the component when the dropdown invokes it.
   */
  loadSuppliers = async (params: { page: number; pageSize: number; search: string }) => {
    return this.supplierSvc.getMiniListPage({
      page:   params.page,
      limit:  params.pageSize,
      search: params.search,
    });
  };

  onSupplierChange(s: SupplierMini | null): void {
    this.selectedSupplier.set(s);
    this.pageNum.set(1);
    void this.load();
  }

  ngOnInit(): void {
    this.visibility.visible.subscribe(() => {
      if (!this.hasLoaded) this.load();
    });
  }

  async prev(): Promise<void> {
    if (this.pageNum() > 1) {
      this.pageNum.update(n => n - 1);
      await this.load();
    }
  }

  async next(): Promise<void> {
    const total = this.page()?.pageCount ?? 1;
    if (this.pageNum() < total) {
      this.pageNum.update(n => n + 1);
      await this.load();
    }
  }

  linkFor(row: PurchaseHistoryRow): string | null {
    if (!row.billId) return null;
    return getTransactionRoute('Billing', row.billId);
  }

  private async load(): Promise<void> {
    if (!this.productId) return;
    this.loading.set(true);
    try {
      const filter: any = { productId: this.productId };
      const supplier = this.selectedSupplier();
      if (supplier?.id) filter.supplierId = supplier.id;

      const data = await this.svc.getProductPurchaseHistory({
        page: this.pageNum(),
        limit: this.pageLimit,
        filter,
      });
      this.page.set(data);
    } catch (e) {
      console.error('[purchase-history] load failed', e);
    } finally {
      this.loading.set(false);
      this.hasLoaded = true;
    }
  }
}
