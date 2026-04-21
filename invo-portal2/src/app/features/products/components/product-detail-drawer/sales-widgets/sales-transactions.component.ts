import { Component, HostBinding, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MynumberPipe } from '../../../../../core/pipes';
import { ProductsService, ProductSalesPage, ProductSalesRow } from '../../../services/products.service';
import { getTransactionRoute } from '../../../../../shared/utils/linked-types';
import { VisibleDirective } from '../../../../../shared/directives/visible.directive';

/**
 * Paginated sales-transactions table for the Sales tab.
 * Uses a cursor-style pager (Prev / Next) since the legacy endpoint returns
 * `{ list, hasNext }` without a total page count.
 */
@Component({
  selector: 'app-sales-transactions',
  standalone: true,
  imports: [CommonModule, TranslateModule, DatePipe, MynumberPipe],
  hostDirectives: [VisibleDirective],
  template: `
    <div class="card">
      <div class="card-head">
        <span>{{ 'PRODUCTS.SALES.TRANSACTIONS' | translate }}</span>

        <!-- Pager lives in the head so the table body stays uncluttered -->
        @if (!loading() && page() && page()!.list.length) {
          <div class="pager">
            <button type="button" class="btn" [disabled]="pageNum() <= 1" (click)="prev()">
              {{ 'PRODUCTS.SALES.PREV' | translate }}
            </button>
            <span class="pager-num">{{ pageNum() }}</span>
            <button type="button" class="btn" [disabled]="!page()!.hasNext" (click)="next()">
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
              <div class="skeleton w-20"></div>
              <div class="skeleton w-10"></div>
              <div class="skeleton w-10"></div>
              <div class="skeleton w-15"></div>
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
            <p>{{ 'PRODUCTS.SALES.NO_TRANSACTIONS' | translate }}</p>
          </div>
        } @else {
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th class="start">{{ 'PRODUCTS.SALES.DATE'               | translate }}</th>
                  <th class="start">{{ 'PRODUCTS.SALES.TRANSACTION_NUMBER' | translate }}</th>
                  <th class="start">{{ 'PRODUCTS.SALES.BRANCH'             | translate }}</th>
                  <th class="start">{{ 'PRODUCTS.SALES.CUSTOMER'           | translate }}</th>
                  <th class="start">{{ 'PRODUCTS.SALES.TYPE'               | translate }}</th>
                  <th class="end">{{   'PRODUCTS.SALES.QTY'                | translate }}</th>
                  <th class="end">{{   'PRODUCTS.SALES.UNIT_PRICE'         | translate }}</th>
                  <th class="end">{{   'PRODUCTS.SALES.SUB_TOTAL'          | translate }}</th>
                  <th class="end">{{   'PRODUCTS.SALES.TAX'                | translate }}</th>
                  <th class="end">{{   'PRODUCTS.SALES.TOTAL'              | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of page()!.list; track $index) {
                  <tr>
                    <td class="mono nowrap">{{ row.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                    <td class="nowrap">
                      @if (linkFor(row)) {
                        <a [href]="linkFor(row)" target="_blank" rel="noopener" class="link">
                          {{ txLabel(row) }}
                        </a>
                      } @else {
                        <span>{{ txLabel(row) }}</span>
                      }
                    </td>
                    <td>{{ row.branchName }}</td>
                    <td>{{ row.customerName }}</td>
                    <td>{{ row.type }}</td>
                    <td class="end mono">{{ row.qty      | mynumber }}</td>
                    <td class="end mono">{{ row.price    | mynumber }}</td>
                    <td class="end mono">{{ row.subTotal | mynumber }}</td>
                    <td class="end mono">{{ row.taxTotal | mynumber }}</td>
                    <td class="end mono">{{ row.total    | mynumber }}</td>
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
      gap:8px;
      padding:48px 20px;
      color:#94a3b8;
    }
    .empty svg { opacity:.5; }
    .empty p { margin:0; font-size:13px; }

    /* Skeleton */
    .row-skel { display:grid; grid-template-columns: repeat(10, 1fr); gap:10px; padding:14px; border-bottom:1px solid #f1f5f9; }
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
export class SalesTransactionsComponent implements OnInit {
  @Input() productId: string | null = null;
  @Input() pageLimit = 15;

  private svc = inject(ProductsService);
  private visibility = inject(VisibleDirective);

  hasLoaded = false;
  @HostBinding('class.loaded') get loadedClass() { return this.hasLoaded; }
  loading  = signal(false);
  pageNum  = signal(1);
  page     = signal<ProductSalesPage | null>(null);

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
    if (this.page()?.hasNext) {
      this.pageNum.update(n => n + 1);
      await this.load();
    }
  }

  linkFor(row: ProductSalesRow): string | null {
    if (!row.transactionType || !row.transactionId) return null;
    return getTransactionRoute(row.transactionType, row.transactionId);
  }

  txLabel(row: ProductSalesRow): string {
    const num = row.transactionNumber;
    // Avoid injecting the translate pipe here — keep the fallback label simple.
    return num && num !== '' ? num : '—';
  }

  private async load(): Promise<void> {
    if (!this.productId) return;
    this.loading.set(true);
    try {
      const data = await this.svc.getProductSales(
        { page: this.pageNum(), limit: this.pageLimit },
        this.productId,
      );
      this.page.set(data);
    } catch (e) {
      console.error('[sales-transactions] load failed', e);
    } finally {
      this.loading.set(false);
      this.hasLoaded = true;
    }
  }
}
