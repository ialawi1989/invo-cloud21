import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { DatePipe } from '@angular/common';
import { MycurrencyPipe, MynumberPipe } from '../../../../core/pipes';
import { environment } from '../../../../../environments/environment';
import { PrivilegeService } from '../../../../core/auth/privileges/privilege.service';
import { ProductsService, BranchSummary, ProductActivity } from '../../services/products.service';
import { getTransactionRoute } from '../../../../shared/utils/linked-types';
import { SalesStatsComponent }           from './sales-widgets/sales-stats.component';
import { SalesLast30DaysComponent }      from './sales-widgets/sales-last-30-days.component';
import { SalesLast12MonthComponent }     from './sales-widgets/sales-last-12-month.component';
import { SalesByServiceComponent }       from './sales-widgets/sales-by-service.component';
import { SalesTransactionsComponent }    from './sales-widgets/sales-transactions.component';
import { PurchaseHistoryComponent }      from './purchase-history.component';
import { ProductMovementComponent }      from './product-movement.component';

export interface ProductDetailDrawerData {
  productId: string;
  /** Whether the clicked row was an expanded child (matrix variant). */
  isChild?: boolean;
  /** The raw row that was clicked, if the caller wants to hand over more
   *  context than just an id (name/barcode/etc). */
  row?: any;
}

interface TabOption {
  slug:    'productOverview' | 'purchaseHistory' | 'productMovement' | 'productSales';
  name:    string;
  visible: boolean;
}

/**
 * Product details drawer — tabbed layout mirroring the legacy sidenav:
 *   1. Overview  (Basic info + Branch Stock)     ← implemented
 *   2. Purchase History                          ← placeholder
 *   3. Product Movement                          ← placeholder
 *   4. Sales                                     ← placeholder
 *
 * Content for tabs 2–4 is staged to be ported incrementally once the
 * corresponding backend endpoints are confirmed. The shell + Overview tab
 * is fully wired to `ProductsService` and the existing stock-availability
 * endpoint (same as the Qty modal).
 */
@Component({
  selector: 'app-product-detail-drawer',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, DatePipe, MycurrencyPipe, MynumberPipe,
    SalesStatsComponent, SalesLast30DaysComponent, SalesLast12MonthComponent,
    SalesByServiceComponent, SalesTransactionsComponent,
    PurchaseHistoryComponent, ProductMovementComponent,
  ],
  template: `
    @if (loading()) {
      <!-- ═══ Top-level skeleton (product GET in flight) ═══ -->
      <div class="drawer-head">
        <div class="skeleton skeleton--thumb"></div>
        <div class="head-text" style="flex: 1;">
          <div class="skeleton skeleton--line w-60"></div>
          <div class="skeleton skeleton--chip mt"></div>
        </div>
        <div class="skeleton skeleton--btn"></div>
      </div>
      <nav class="tabs">
        <div class="skeleton skeleton--tab"></div>
        <div class="skeleton skeleton--tab"></div>
        <div class="skeleton skeleton--tab"></div>
        <div class="skeleton skeleton--tab"></div>
      </nav>
      <div class="drawer-body">
        <div class="skeleton skeleton--line w-40 mb"></div>
        <div class="grid-2">
          <div class="card">
            <div class="card-head">
              <div class="skeleton skeleton--line w-30"></div>
            </div>
            <div class="card-body">
              @for (i of [1,2,3,4,5,6]; track i) {
                <div class="info-row">
                  <div class="skeleton skeleton--line w-40"></div>
                  <div class="skeleton skeleton--line w-50"></div>
                </div>
              }
            </div>
          </div>
          <div class="card">
            <div class="card-head">
              <div class="skeleton skeleton--line w-40"></div>
            </div>
            <div class="card-body activity-body">
              <div class="skeleton skeleton--line w-60"></div>
              <div class="skeleton skeleton--line w-90 mt"></div>
              <div class="skeleton skeleton--line w-45 mt"></div>
              <div class="skeleton skeleton--line w-75 mt"></div>
            </div>
          </div>
        </div>
      </div>
    } @else if (error()) {
      <div class="state state--error">{{ error() }}</div>
    } @else if (product()) {
      <!-- ═══ Header ═══ -->
      <div class="drawer-head">
        <div class="thumb">
          @if (productImage() && !imgError()) {
            <img class="thumb-img"
              [src]="productImage()"
              [alt]="product().name"
              (error)="imgError.set(true)" />
          } @else {
            <svg class="thumb-fallback" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M12.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
              <path fill-rule="evenodd" d="M9.018 3.5h1.964c.813 0 1.469 0 2 .043.546.045 1.026.14 1.47.366a3.75 3.75 0 0 1 1.64 1.639c.226.444.32.924.365 1.47.043.531.043 1.187.043 2v1.964c0 .813 0 1.469-.043 2-.045.546-.14 1.026-.366 1.47a3.75 3.75 0 0 1-1.639 1.64c-.444.226-.924.32-1.47.365-.531.043-1.187.043-2 .043h-1.964c-.813 0-1.469 0-2-.043-.546-.045-1.026-.14-1.47-.366a3.75 3.75 0 0 1-1.64-1.639c-.226-.444-.32-.924-.365-1.47-.043-.531-.043-1.187-.043-2v-1.964c0-.813 0-1.469.043-2 .045-.546.14-1.026.366-1.47a3.75 3.75 0 0 1 1.639-1.64c.444-.226.924-.32 1.47-.365.531-.043 1.187-.043 2-.043Z"/>
            </svg>
          }
        </div>
        <div class="head-text">
          <h3 class="head-title">{{ product().name }}</h3>
          <span class="type-badge">{{ product().type }}</span>
        </div>
        <button type="button" class="btn btn--ghost" (click)="onEdit()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          {{ 'COMMON.ACTIONS.EDIT' | translate }}
        </button>
      </div>

      <!-- ═══ Tabs ═══ -->
      @if (visibleTabs().length > 1) {
        <nav class="tabs" role="tablist">
          @for (tab of visibleTabs(); track tab.slug) {
            <button type="button"
              class="tab"
              role="tab"
              [class.tab--active]="selectedTab() === tab.slug"
              [attr.aria-selected]="selectedTab() === tab.slug"
              (click)="selectedTab.set(tab.slug)">
              {{ tab.name | translate }}
            </button>
          }
        </nav>
      }

      <!-- ═══ Body ═══ -->
      <div class="drawer-body">
        @switch (selectedTab()) {
          @case ('productOverview') {
            <!-- Overview: Basic info + Branch Stock -->
            <h4 class="section-title">Product details</h4>

            <div class="grid-2">
              <!-- Basic Info -->
              <div class="card">
                <div class="card-head">Basic Info</div>
                <dl class="card-body info">
                  @for (item of basicInfoRows(); track item.label) {
                    <div class="info-row">
                      <dt>{{ item.label }}</dt>
                      <dd>{{ item.value }}</dd>
                    </div>
                  }
                </dl>
              </div>

              <!-- Product Activity (Last PO / Bill / Sold / Supplier) -->
              <div class="card">
                <div class="card-head">Product Activity</div>
                <div class="card-body">
                  @if (activityLoading()) {
                    <!-- Activity skeleton — 4 info rows -->
                    @for (i of [1,2,3,4]; track i) {
                      <div class="info-row">
                        <div class="skeleton skeleton--line w-30"></div>
                        <div class="skeleton skeleton--line w-60"></div>
                      </div>
                    }
                  } @else if (!activity()) {
                    <div class="state state--muted">No activity data.</div>
                  } @else {
                    <dl class="info">
                      <!-- Last PO -->
                      <div class="info-row">
                        <dt>Last PO</dt>
                        <dd>
                          @if (act()['Last PO']) {
                            @if (getLink('purchase order', act()['purchaseId'])) {
                              <a [href]="getLink('purchase order', act()['purchaseId'])"
                                target="_blank" rel="noopener" class="link">
                                {{ act()['Last PO'] }}
                              </a>
                            } @else {
                              <span class="link--plain">{{ act()['Last PO'] }}</span>
                            }
                            @if (act()['Last PO Date']) {
                              <span class="muted">({{ act()['Last PO Date'] | date:'MMMM d' }})</span>
                            }
                            @if (act()['Last PO Qty'] != null) {
                              <span class="qty-badge">Qty: {{ act()['Last PO Qty'] }}</span>
                            }
                          } @else {
                            <span class="muted">No purchase order data</span>
                          }
                        </dd>
                      </div>

                      <!-- Last Bill -->
                      <div class="info-row">
                        <dt>Last Bill</dt>
                        <dd>
                          @if (act()['Last Bill']) {
                            @if (getLink('Billing', act()['billId'])) {
                              <a [href]="getLink('Billing', act()['billId'])"
                                target="_blank" rel="noopener" class="link">
                                {{ act()['Last Bill'] }}
                              </a>
                            } @else {
                              <span class="link--plain">{{ act()['Last Bill'] }}</span>
                            }
                            @if (act()['Last Bill Date']) {
                              <span class="muted">({{ act()['Last Bill Date'] | date:'MMMM d' }})</span>
                            }
                            @if (act()['Last Bill Qty'] != null) {
                              <span class="qty-badge">Qty: {{ act()['Last Bill Qty'] }}</span>
                            }
                          } @else {
                            <span class="muted">No Bill data</span>
                          }
                        </dd>
                      </div>

                      <!-- Last Sold -->
                      <div class="info-row">
                        <dt>Last Sold</dt>
                        <dd>
                          @if (act()['Last Sold']) {
                            @if (getLink('Invoice', act()['invoiceId'])) {
                              <a [href]="getLink('Invoice', act()['invoiceId'])"
                                target="_blank" rel="noopener" class="link">
                                {{ act()['Last Sold'] }}
                              </a>
                            } @else {
                              <span class="link--plain">{{ act()['Last Sold'] }}</span>
                            }
                            @if (act()['Last Sold Date']) {
                              <span class="muted">({{ act()['Last Sold Date'] | date:'MMMM d' }})</span>
                            }
                            @if (act()['Last Sold Qty'] != null) {
                              <span class="qty-badge">Qty: {{ act()['Last Sold Qty'] }}</span>
                            }
                          } @else {
                            <span class="muted">No Sold data</span>
                          }
                        </dd>
                      </div>

                      <!-- Last Supplier -->
                      <div class="info-row">
                        <dt>Last Supplier</dt>
                        <dd>
                          @if (act()['Last Supplier']) {
                            <span class="supplier-name">{{ act()['Last Supplier'] }}</span>
                          } @else {
                            <span class="muted">—</span>
                          }
                        </dd>
                      </div>
                    </dl>
                  }
                </div>
              </div>
            </div>

            <!-- Branch Stock -->
            @if (showBranchStock()) {
              <div class="card">
                <div class="card-head">Branch Stock</div>
                <div class="card-body tbl-wrap">
                  @if (stockLoading()) {
                    <div class="state">Loading stock…</div>
                  } @else if (!branchSummary().length) {
                    <div class="state state--muted">No branch stock data available</div>
                  } @else {
                    <table class="tbl">
                      <thead>
                        <tr>
                          <th class="start">Branch</th>
                          <th class="end">On hand</th>
                          @if (canViewStockValue) {
                            <th class="end">Stock value</th>
                          }
                          <th class="end">Reorder level</th>
                          <th class="end">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (s of branchSummary(); track s.branchId || s.id || s.branch) {
                          <tr>
                            <td>{{ s.branch }}</td>
                            <td class="end mono">{{ s.onHand | mynumber }}</td>
                            @if (canViewStockValue) {
                              <td class="end mono">{{ s.stockValue | mycurrency }}</td>
                            }
                            <td class="end mono">{{ ($any(s).reorderLevel ?? 0) | mynumber }}</td>
                            <td class="end">
                              <span class="status-pill"
                                [class.status-pill--danger]="$any(s).status === 'Out of Stock'"
                                [class.status-pill--warn]="$any(s).status === 'Low Stock'"
                                [class.status-pill--ok]="$any(s).status === 'In Stock'">
                                {{ $any(s).status || '—' }}
                              </span>
                            </td>
                          </tr>
                        }
                      </tbody>
                      <tfoot>
                        <tr>
                          <th class="start">Total</th>
                          <th class="end mono">{{ totalOnHand() | mynumber }}</th>
                          @if (canViewStockValue) {
                            <th class="end mono">{{ totalStockValue() | mycurrency }}</th>
                          }
                          <th class="end mono">{{ totalReorderLevel() | mynumber }}</th>
                          <th class="end">
                            <span class="status-pill"
                              [class.status-pill--danger]="overallStatus() === 'Out Of Stock'"
                              [class.status-pill--warn]="overallStatus() === 'Low Stock'"
                              [class.status-pill--ok]="overallStatus() === 'Normal'">
                              {{ overallStatus() }}
                            </span>
                          </th>
                        </tr>
                      </tfoot>
                    </table>
                  }
                </div>
              </div>
            }
          }
          @case ('purchaseHistory') {
            <app-purchase-history [productId]="product().id"></app-purchase-history>
          }
          @case ('productMovement') {
            <app-product-movement [productId]="product().id"></app-product-movement>
          }
          @case ('productSales') {
            <div class="sales-stack">
              <!-- Each widget self-loads via IntersectionObserver (VisibleDirective
                   applied as a host directive). Skeletons reserve real height so
                   widgets below the fold stay below the fold until scrolled to. -->
              <app-sales-stats         [productId]="product().id"></app-sales-stats>
              <app-sales-transactions  [productId]="product().id"></app-sales-transactions>
              <app-sales-last-30-days  [productId]="product().id"></app-sales-last-30-days>
              <app-sales-last-12-month [productId]="product().id"></app-sales-last-12-month>
              <app-sales-by-service    [productId]="product().id"></app-sales-by-service>
            </div>
          }
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      height: 100%;
      min-height: 0;
      background: #f8fafc;
    }

    .state {
      padding: 40px 24px;
      text-align: center;
      color: #475569;
      font-size: 14px;
    }
    .state--error  { color: #b91c1c; }
    .state--muted  { color: #94a3b8; font-size: 13px; }

    /* ── Header ────────────────────────────────────────────── */
    .drawer-head {
      display: flex; align-items: center; gap: 14px;
      padding: 18px 64px 18px 24px;     /* right pad leaves room for drawer close X */
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
    }
    .thumb {
      width: 56px; height: 56px; border-radius: 12px;
      background: #f1f5f9; color: #94a3b8;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden; flex-shrink: 0;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, .06);
    }
    .thumb-img { width: 100%; height: 100%; object-fit: cover; }
    .thumb-fallback { width: 28px; height: 28px; }

    .head-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
    .head-title {
      margin: 0;
      font-size: 18px; font-weight: 600; color: #0f172a;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .type-badge {
      align-self: flex-start;
      padding: 2px 10px; border-radius: 999px;
      background: #e0f2f7; color: #0e7490;
      font-size: 11px; font-weight: 600; text-transform: capitalize;
    }

    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 8px;
      font-size: 13px; font-weight: 600;
      border: 1px solid #e2e8f0; background: #fff; color: #0f172a;
      cursor: pointer; transition: all .15s;
      white-space: nowrap;
    }
    .btn:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
      box-shadow: 0 1px 3px rgba(0, 0, 0, .06);
    }
    .btn svg { color: #64748b; }

    /* ── Tabs ──────────────────────────────────────────────── */
    .tabs {
      display: flex; gap: 4px;
      padding: 0 24px;
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      /* Only scroll when content truly overflows; hide the visible scrollbar
         so the tab strip reads as a clean, flat bar at full width. */
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none;          /* Firefox */
    }
    .tabs::-webkit-scrollbar { display: none; }  /* Chromium/Safari */
    .tab {
      position: relative;
      padding: 10px 14px;
      border: none; background: transparent;
      font-size: 13px; font-weight: 600; color: #64748b;
      cursor: pointer; white-space: nowrap;
      transition: color .12s;
    }
    .tab:hover { color: #0f172a; }
    .tab--active { color: #0e7490; }
    .tab--active::after {
      content: '';
      position: absolute; left: 10px; right: 10px; bottom: -1px;
      height: 2px; background: #32acc1; border-radius: 2px;
    }

    /* ── Body ──────────────────────────────────────────────── */
    .drawer-body {
      flex: 1; min-height: 0;
      overflow-y: auto;
      padding: 20px 24px;
    }

    .section-title {
      margin: 0 0 14px;
      font-size: 16px; font-weight: 600; color: #0f172a;
    }

    /* Stack of sales widgets */
    .sales-stack { display: flex; flex-direction: column; gap: 16px; }


    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }

    /* ── Mobile (≤ 600px): tighten paddings, shrink header ────── */
    @media (max-width: 600px) {
      .drawer-head {
        padding: 14px 56px 14px 16px;
        gap: 10px;
      }
      .thumb { width: 48px; height: 48px; }
      .head-title { font-size: 16px; }

      /* Tabs: keep the strip scrollable but with a fade-out hint on the
         trailing edge so the user can see there's more to scroll. */
      .tabs {
        padding: 0 8px;
        position: relative;
        -webkit-overflow-scrolling: touch;
        scroll-snap-type: x proximity;
        mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
        -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
      }
      .tab {
        padding: 10px 10px;
        font-size: 12px;
        scroll-snap-align: start;
      }

      .drawer-body { padding: 14px 14px; }
      .section-title { font-size: 14px; }
      .card-body { padding: 10px 12px; }

      /* Status pill: keep on a single line so it doesn't wrap to "Out of \n Stock". */
      .status-pill { white-space: nowrap; }

      /* Branch-stock table: a touch tighter on phones. */
      .tbl thead th { padding: 8px 10px; font-size: 10px; }
      .tbl tbody td,
      .tbl tfoot th  { padding: 8px 10px; font-size: 12px; }

      /* Info rows: stack label/value on very narrow screens. */
      .info-row { flex-wrap: wrap; gap: 4px; }
      .info-row dd { max-width: 100%; text-align: start; }
    }

    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .card-head {
      padding: 10px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px; font-weight: 600; color: #0f172a;
    }
    .card-body { padding: 12px 14px; }
    .card-body.tbl-wrap { padding: 0; }

    /* Basic info definition-list */
    .info       { display: flex; flex-direction: column; gap: 0; margin: 0; }
    .info-row   {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 8px 2px; gap: 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .info-row:last-child { border-bottom: none; }
    .info-row dt {
      margin: 0; color: #64748b; font-size: 12px; font-weight: 500;
    }
    .info-row dd {
      margin: 0; color: #0f172a; font-size: 13px; font-weight: 500;
      text-align: end; max-width: 60%;
      overflow-wrap: anywhere;
    }

    /* Branch stock table */
    .tbl { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
    .tbl thead th {
      background: #f8fafc; color: #64748b;
      font-weight: 600; font-size: 11px;
      text-transform: uppercase; letter-spacing: .04em;
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
    }
    .tbl tbody td {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #0f172a;
    }
    .tbl tbody tr:last-child td { border-bottom: none; }
    .tbl tbody tr:hover { background: #f8fafc; }
    .tbl tfoot th {
      padding: 10px 14px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      color: #0f172a; font-weight: 700; font-size: 13px;
      text-transform: none; letter-spacing: 0;
    }
    .start { text-align: start; }
    .end   { text-align: end; }
    .mono  { font-variant-numeric: tabular-nums; }

    .status-pill {
      display: inline-flex; padding: 2px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 600;
      background: #f1f5f9; color: #64748b;
    }
    .status-pill--ok     { background: #dcfce7; color: #15803d; }
    .status-pill--warn   { background: #fef9c3; color: #854d0e; }
    .status-pill--danger { background: #fee2e2; color: #b91c1c; }

    /* Activity rows — links, badges, muted */
    .link         { color: #0e7490; font-weight: 500; text-decoration: none; }
    .link:hover   { text-decoration: underline; }
    .link--plain  { color: #0f172a; font-weight: 500; }
    .muted        { color: #94a3b8; font-size: 12px; margin-inline-start: 6px; }
    .qty-badge {
      display: inline-flex; margin-inline-start: 6px;
      padding: 2px 8px; border-radius: 999px;
      background: #e0f2f7; color: #0e7490;
      font-size: 11px; font-weight: 600;
    }
    .supplier-name { color: #0e7490; font-weight: 500; }

    /* ── Skeletons ─────────────────────────────────────────── */
    @keyframes skeleton-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }
    .skeleton {
      display: inline-block;
      background: linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%);
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.4s ease-in-out infinite;
      border-radius: 6px;
    }
    /* line height approximates a line of 13-15px text */
    .skeleton--line  { height: 12px; width: 100%; }
    .skeleton--chip  { height: 18px; width: 60px; border-radius: 999px; }
    .skeleton--btn   { height: 32px; width: 72px; border-radius: 8px; }
    .skeleton--thumb { width: 56px; height: 56px; border-radius: 12px; flex-shrink: 0; }
    .skeleton--tab   { height: 18px; width: 110px; margin: 11px 6px; border-radius: 4px; }

    .w-30 { width: 30% !important; }
    .w-40 { width: 40% !important; }
    .w-45 { width: 45% !important; }
    .w-50 { width: 50% !important; }
    .w-60 { width: 60% !important; }
    .w-75 { width: 75% !important; }
    .w-90 { width: 90% !important; }
    .mt   { margin-top: 10px; display: block; }
    .mb   { margin-bottom: 14px; display: block; }

    /* ── RTL adjustments ───────────────────────────────────── */
    :host-context([dir="rtl"]) .drawer-head,
    :host-context([dir="rtl"]) .tabs { direction: rtl; }
    :host-context([dir="rtl"]) .head-title,
    :host-context([dir="rtl"]) .type-badge,
    :host-context([dir="rtl"]) .section-title { text-align: right; }
    :host-context([dir="rtl"]) .start { text-align: right; }
    :host-context([dir="rtl"]) .end   { text-align: left; }
    :host-context([dir="rtl"]) .info-row dd { text-align: left; }
  `],
})
export class ProductDetailDrawerComponent implements OnInit {
  data = inject<ProductDetailDrawerData>(MODAL_DATA);
  ref  = inject<ModalRef>(MODAL_REF);
  private svc    = inject(ProductsService);
  private privs  = inject(PrivilegeService);
  private router = inject(Router);

  // ─── Primary state ─────────────────────────────────────────
  loading  = signal(true);
  error    = signal<string | null>(null);
  product  = signal<any | null>(null);
  imgError = signal(false);

  // Tabs
  tabs: TabOption[] = [
    { slug: 'productOverview', name: 'PRODUCTS.DRAWER.TABS.OVERVIEW', visible: true },
    { slug: 'purchaseHistory', name: 'PRODUCTS.DRAWER.TABS.PURCHASE', visible: true },
    { slug: 'productMovement', name: 'PRODUCTS.DRAWER.TABS.MOVEMENT', visible: true },
    { slug: 'productSales',    name: 'PRODUCTS.DRAWER.TABS.SALES',    visible: true },
  ];
  visibleTabs = computed(() => this.tabs.filter(t => t.visible));
  selectedTab = signal<TabOption['slug']>('productOverview');

  // ─── Branch stock (Overview tab) ───────────────────────────
  stockLoading   = signal(false);
  branchSummary  = signal<BranchSummary[]>([]);

  // ─── Recent activity (Overview tab) ────────────────────────
  activityLoading = signal(false);
  activity        = signal<ProductActivity | null>(null);

  /** Typed-as-`any` view of the activity record so template bracket-access
   *  (`act()['Last PO']` …) doesn't trip the strict index-signature check. */
  act = computed<any>(() => this.activity());

  /** Wraps the linked-types helper so the template can call it inline. */
  getLink(type: string, id: string | null | undefined): string | null {
    if (!id) return null;
    return getTransactionRoute(type, id);
  }
  totalOnHand       = computed(() => this.branchSummary().reduce((s, r) => s + Number(r.onHand     ?? 0), 0));
  totalStockValue   = computed(() => this.branchSummary().reduce((s, r) => s + Number(r.stockValue ?? 0), 0));
  totalReorderLevel = computed(() => this.branchSummary().reduce((s, r) => s + Number((r as any).reorderLevel ?? 0), 0));

  overallStatus = computed(() => {
    const rows = this.branchSummary();
    if (!rows.length) return '';
    const total = this.totalOnHand();
    if (total === 0) return 'Out Of Stock';
    // Below sum of reorder levels → low
    if (total < this.totalReorderLevel()) return 'Low Stock';
    return 'Normal';
  });

  get canViewStockValue(): boolean {
    return this.privs.check('productSecurity.actions.viewStockValue.access');
  }

  showBranchStock = computed(() => {
    const p = this.product();
    if (!p) return false;
    return ['inventory', 'batch', 'serialized', 'kit'].includes(p.type);
  });

  /** Resolve the product image from whichever field the backend provides. */
  productImage = computed(() => {
    const p = this.product();
    if (!p) return null;
    const url = p.mediaUrl;
    if (!url || typeof url !== 'string' || url.trim() === '') return null;
    // The API may return localhost URLs that aren't reachable from the
    // browser when the app runs against a remote backend. Replace
    // localhost with the actual backend host so images resolve correctly.
    try {
      const backendOrigin = new URL(environment.backendUrl).origin;
      const imgUrl = new URL(url);
      if (imgUrl.hostname === 'localhost' || imgUrl.hostname === '127.0.0.1') {
        imgUrl.host = new URL(environment.backendUrl).host;
        return imgUrl.toString();
      }
    } catch { /* URL parsing failed — return as-is */ }
    return url;
  });

  // ─── Basic info rows (computed from product signal) ────────
  basicInfoRows = computed(() => {
    const p = this.product();
    if (!p) return [];
    const rows: { label: string; value: string }[] = [];
    const push = (label: string, value: any) => {
      if (value !== '' && value !== null && value !== undefined) {
        rows.push({ label, value: String(value) });
      }
    };
    push('Name',        p.name);
    push('Type',        p.type);
    push('UOM',         p.UOM);
    push('Barcode',     p.barcode);
    push('SKU',         p.sku);
    push('Brand',       p.brandName);
    push('Department',  p.departmentName);
    push('Category',    p.categoryName);
    // Price left to caller-side formatting via `mycurrency` if needed; for
    // the basic-info strip we include it as the pre-formatted default price.
    if (p.defaultPrice !== undefined && p.defaultPrice !== null) {
      push('Price', p.defaultPrice);
    }
    push('Description', p.description?.trim?.() ?? p.description);
    return rows;
  });

  // ─── Lifecycle ─────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    try {
      const p = await this.svc.getProduct(this.data.productId);
      if (!p) {
        this.error.set('Product not found.');
        this.loading.set(false);
        return;
      }
      this.product.set(p);
      this.loading.set(false);

      // Fire branch-stock + activity loads in parallel. They're independent
      // and the header/basic-info block is already on screen.
      if (['inventory', 'batch', 'serialized', 'kit'].includes(p.type)) {
        this.loadBranchStock(p.id);
      }
      this.loadActivity(p.id);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load product.');
      this.loading.set(false);
    }
  }

  private async loadBranchStock(productId: string): Promise<void> {
    this.stockLoading.set(true);
    try {
      const rows = await this.svc.getProductAvailability(productId);
      this.branchSummary.set(rows);
    } catch (e) {
      console.error('[product-detail-drawer] branch stock failed', e);
    } finally {
      this.stockLoading.set(false);
    }
  }

  private async loadActivity(productId: string): Promise<void> {
    this.activityLoading.set(true);
    try {
      const data = await this.svc.getProductActivity(productId);
      this.activity.set(data);
    } catch (e) {
      console.error('[product-detail-drawer] activity failed', e);
    } finally {
      this.activityLoading.set(false);
    }
  }

  onEdit(): void {
    const p = this.product();
    if (!p) return;
    // Close the drawer first so the user lands on the edit route cleanly.
    this.ref.dismiss();
    this.router.navigate(['/products/form', p.id], { queryParams: { type: p.type } });
  }
}

