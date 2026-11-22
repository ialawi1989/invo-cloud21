import { AfterViewInit, Component, ElementRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { DatePipe } from '@angular/common';
import { MycurrencyPipe, MynumberPipe } from '../../../../core/pipes';
import { environment } from '../../../../../environments/environment';
import { PrivilegeService } from '../../../../core/auth/privileges/privilege.service';
import { ProductsService, BranchSummary, ProductActivity } from '../../services/products.service';
import { getTransactionRoute } from '../../../../shared/utils/linked-types';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';
import { productTypeKey } from '../../utils/product-labels';
import { ProductChildrenComponent } from './product-children/product-children.component';
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
  /** Previous / Next navigation over the products currently loaded in the list. */
  nav?: ProductDrawerNav;
}

/** What the list hands the drawer so it can step through the rows the list is showing, without closing. */
export interface ProductDrawerNav {
  /** The rows currently visible in the list, in list order. Read inside a computed, so it stays current. */
  rows: () => any[];
  /** The drawer moved to another product: the list highlights that row and scrolls it into view. */
  activated: (row: any) => void;
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
    TitleCasePipe, TooltipDirective, ProductChildrenComponent,
  ],
  providers: [MycurrencyPipe],
  host: { tabindex: '-1' },
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
            <svg class="thumb-fallback" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="9" cy="9" r="1.5"/>
              <path d="m21 15-5-5L5 21"/>
            </svg>
          }
        </div>
        <div class="head-text">
          <h3 class="head-title">{{ product().name | titlecase }}</h3>
          <span class="type-badge">{{ typeLabel() }}</span>
        </div>
        @if (data.nav) {
          <!-- Previous / Next: vertical chevrons follow LIST order (top to bottom) in both directions, so they never
               flip under RTL; the pair's own order flows with the header's direction. -->
          <div class="nav-btns" role="group" [attr.aria-label]="'PRODUCTS.DRAWER.NAVIGATE' | translate">
            <button type="button" class="icon-btn"
              [disabled]="!hasPrev()"
              [appTooltip]="'PRODUCTS.DRAWER.PREVIOUS' | translate"
              [attr.aria-label]="'PRODUCTS.DRAWER.PREVIOUS' | translate"
              aria-keyshortcuts="Alt+ArrowUp"
              (click)="go(-1)">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>
            </button>
            <button type="button" class="icon-btn"
              [disabled]="!hasNext()"
              [appTooltip]="'PRODUCTS.DRAWER.NEXT' | translate"
              [attr.aria-label]="'PRODUCTS.DRAWER.NEXT' | translate"
              aria-keyshortcuts="Alt+ArrowDown"
              (click)="go(1)">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
            </button>
          </div>
        }
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
      @if (navError()) {
        <div class="nav-error" role="alert">
          <span>{{ navError() }}</span>
          <button type="button" class="link-btn" (click)="retryNav()">{{ 'COMMON.LP_RETRY' | translate }}</button>
        </div>
      }
      <div class="drawer-body" [class.drawer-body--busy]="switching()" [attr.aria-busy]="switching()">
        @for (pid of [product().id]; track pid) {
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

            <!-- Units / Variants: children of a parent product or a matrix. Loaded lazily; never summed into the numbers above. -->
            @if (hasChildren()) {
              <app-product-children
                [parentId]="product().id"
                [parentType]="product().type"
                (opened)="openChild($event)" />
            }

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
        }
      </div>
    }
  `,
  styles: [`
    :host {
      outline: none;
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      height: 100%;
      min-height: 0;
      background: var(--ui-surface-1);
    }

    .state {
      padding: 40px 24px;
      text-align: center;
      color: var(--ui-text-4);
      font-size: 14px;
    }
    .state--error  { color: var(--ui-red-text); }
    .state--muted  { color: var(--ui-faint); font-size: 13px; }

    /* ── Header ────────────────────────────────────────────── */
    .drawer-head {
      display: flex; align-items: center; gap: 14px;
      padding: 18px 64px 18px 24px;     /* right pad leaves room for drawer close X */
      background: var(--ui-surface);
      border-bottom: 1px solid var(--ui-line);
    }
    .thumb {
      width: 56px; height: 56px; border-radius: 12px;
      background: var(--ui-surface-2); color: var(--ui-faint);
      display: flex; align-items: center; justify-content: center;
      overflow: hidden; flex-shrink: 0;
      border: 1px solid var(--ui-line);
      box-shadow: 0 1px 3px rgba(0, 0, 0, .06);
    }
    .thumb-img { width: 100%; height: 100%; object-fit: cover; }
    .thumb-fallback { width: 28px; height: 28px; }

    .head-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
    .head-title {
      margin: 0;
      font-size: 18px; font-weight: 600; color: var(--ui-text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .type-badge {
      align-self: flex-start;
      padding: 2px 10px; border-radius: 999px;
      background: var(--ui-x-e0f2f7); color: var(--ui-brand-text);
      font-size: 11px; font-weight: 600; text-transform: capitalize;
    }

    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 8px;
      font-size: 13px; font-weight: 600;
      border: 1px solid var(--ui-line); background: var(--ui-surface); color: var(--ui-text);
      cursor: pointer; transition: all .15s;
      white-space: nowrap;
    }
    .btn:hover {
      background: var(--ui-surface-1);
      border-color: var(--ui-line-strong);
      box-shadow: 0 1px 3px rgba(0, 0, 0, .06);
    }
    .btn svg { color: var(--ui-muted); }

    .nav-btns { display: inline-flex; gap: 4px; flex-shrink: 0; }
    .icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; padding: 0; border-radius: 8px;
      border: 1px solid var(--ui-line); background: var(--ui-surface); color: var(--ui-muted);
      cursor: pointer; transition: background .15s, color .15s, border-color .15s;
    }
    .icon-btn:hover:not(:disabled) { background: var(--ui-surface-1); color: var(--ui-text); border-color: var(--ui-line-strong); }
    .icon-btn:focus-visible { outline: 2px solid var(--ui-brand-text); outline-offset: 1px; }
    .icon-btn:disabled { opacity: .45; cursor: default; }

    .nav-error {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 8px 24px; font-size: 13px; color: var(--ui-red-text); background: var(--ui-red-soft);
    }
    .link-btn { border: 0; background: transparent; color: var(--ui-brand-text); font-weight: 600; cursor: pointer; text-decoration: underline; font-size: 13px; }
    .drawer-body--busy { opacity: .55; pointer-events: none; transition: opacity .12s; }

    /* ── Tabs ──────────────────────────────────────────────── */
    .tabs {
      display: flex; gap: 4px;
      padding: 0 24px;
      background: var(--ui-surface);
      border-bottom: 1px solid var(--ui-line);
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
      font-size: 13px; font-weight: 600; color: var(--ui-muted);
      cursor: pointer; white-space: nowrap;
      transition: color .12s;
    }
    .tab:hover { color: var(--ui-text); }
    .tab--active { color: var(--ui-brand-text); }
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
      font-size: 16px; font-weight: 600; color: var(--ui-text);
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
      background: var(--ui-surface);
      border: 1px solid var(--ui-line);
      border-radius: 10px;
      overflow: hidden;
    }
    .card-head {
      padding: 10px 14px;
      background: var(--ui-surface-1);
      border-bottom: 1px solid var(--ui-line);
      font-size: 13px; font-weight: 600; color: var(--ui-text);
    }
    .card-body { padding: 12px 14px; }
    .card-body.tbl-wrap { padding: 0; }

    /* Basic info definition-list */
    .info       { display: flex; flex-direction: column; gap: 0; margin: 0; }
    .info-row   {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 8px 2px; gap: 12px;
      border-bottom: 1px solid var(--ui-surface-2);
    }
    .info-row:last-child { border-bottom: none; }
    .info-row dt {
      margin: 0; color: var(--ui-muted); font-size: 12px; font-weight: 500;
    }
    .info-row dd {
      margin: 0; color: var(--ui-text); font-size: 13px; font-weight: 500;
      text-align: end; max-width: 60%;
      overflow-wrap: anywhere;
    }

    /* Branch stock table */
    .tbl { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
    .tbl thead th {
      background: var(--ui-surface-1); color: var(--ui-muted);
      font-weight: 600; font-size: 11px;
      text-transform: uppercase; letter-spacing: .04em;
      padding: 10px 14px;
      border-bottom: 1px solid var(--ui-line);
    }
    .tbl tbody td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--ui-surface-2);
      color: var(--ui-text);
    }
    .tbl tbody tr:last-child td { border-bottom: none; }
    .tbl tbody tr:hover { background: var(--ui-surface-1); }
    .tbl tfoot th {
      padding: 10px 14px;
      background: var(--ui-surface-1);
      border-top: 1px solid var(--ui-line);
      color: var(--ui-text); font-weight: 700; font-size: 13px;
      text-transform: none; letter-spacing: 0;
    }
    .start { text-align: start; }
    .end   { text-align: end; }
    .mono  { font-variant-numeric: tabular-nums; }

    .status-pill {
      display: inline-flex; padding: 2px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 600;
      background: var(--ui-surface-2); color: var(--ui-muted);
    }
    .status-pill--ok     { background: var(--ui-green-soft); color: var(--ui-green-text); }
    .status-pill--warn   { background: var(--ui-x-fef9c3); color: var(--ui-t-854d0e); }
    .status-pill--danger { background: var(--ui-red-soft); color: var(--ui-red-text); }

    /* Activity rows — links, badges, muted */
    .link         { color: var(--ui-brand-text); font-weight: 500; text-decoration: none; }
    .link:hover   { text-decoration: underline; }
    .link--plain  { color: var(--ui-text); font-weight: 500; }
    .muted        { color: var(--ui-faint); font-size: 12px; margin-inline-start: 6px; }
    .qty-badge {
      display: inline-flex; margin-inline-start: 6px;
      padding: 2px 8px; border-radius: 999px;
      background: var(--ui-x-e0f2f7); color: var(--ui-brand-text);
      font-size: 11px; font-weight: 600;
    }
    .supplier-name { color: var(--ui-brand-text); font-weight: 500; }

    /* ── Skeletons ─────────────────────────────────────────── */
    @keyframes skeleton-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }
    .skeleton {
      display: inline-block;
      background: linear-gradient(90deg, var(--ui-line) 0%, var(--ui-surface-2) 50%, var(--ui-line) 100%);
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
export class ProductDetailDrawerComponent implements OnInit, AfterViewInit {
  data = inject<ProductDetailDrawerData>(MODAL_DATA);
  ref  = inject<ModalRef>(MODAL_REF);
  private svc    = inject(ProductsService);
  private privs  = inject(PrivilegeService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private pricePipe = inject(MycurrencyPipe);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private titleCase = new TitleCasePipe();

  /** The product on screen. Starts as the clicked one and moves with Previous / Next or a child row. */
  currentId  = signal<string>(this.data.productId);
  /** The list row for the current product (it carries `isParent`, which the single-product GET does not). */
  currentRow = signal<any | null>(this.data.row ?? null);
  /** True while another product loads after the first one (the old content stays, dimmed). */
  switching  = signal(false);
  navError   = signal<string | null>(null);
  private loadSeq = 0;

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
    push('Name',        typeof p.name === 'string' ? this.titleCase.transform(p.name) : p.name);   // same casing as the list
    push('Type',        p.type ? this.typeLabelOf(p.type) : p.type);
    push('UOM',         p.UOM);
    push('Barcode',     p.barcode);
    push('SKU',         p.sku);
    push('Brand',       p.brandName);
    push('Department',  p.departmentName);
    push('Category',    p.categoryName);
    // Money goes through `mycurrency` like the list's money columns (company symbol + decimals, e.g. "BHD 10.000").
    if (p.defaultPrice !== undefined && p.defaultPrice !== null) {
      push('Price', this.pricePipe.transform(p.defaultPrice));
    }
    push('Description', p.description?.trim?.() ?? p.description);
    return rows;
  });

  // ─── Children (Units / Variants) ───────────────────────────
  /** A parent product (the list row's `isParent`) or a matrix owns children. Own stock is never summed with theirs. */
  hasChildren = computed(() => {
    const p = this.product();
    if (!p) return false;
    return p.type === 'matrix' || this.currentRow()?.isParent === true;
  });

  /** Same capitalised, translated label the list's type chip shows. */
  typeLabel = computed(() => {
    const t = this.product()?.type;
    return t ? this.typeLabelOf(t) : '';
  });
  private typeLabelOf(type: string): string {
    const key = 'PRODUCTS.TYPES.' + productTypeKey(type);
    const v = this.translate.instant(key);
    return v === key ? type : v;
  }

  // ─── Previous / Next over the list's loaded rows ────────────
  private navRows  = computed<any[]>(() => this.data.nav?.rows() ?? []);
  private navIndex = computed(() => {
    const id = this.currentId();
    return this.navRows().findIndex(r => (r?.id ?? r?._id) === id);
  });
  hasPrev = computed(() => this.navIndex() > 0);
  hasNext = computed(() => { const i = this.navIndex(); return i >= 0 && i < this.navRows().length - 1; });

  /** Step to the previous (-1) or next (+1) product in the list, without closing the drawer. */
  go(delta: -1 | 1): void {
    const i = this.navIndex();
    const row = i < 0 ? undefined : this.navRows()[i + delta];
    const id = row?.id ?? row?._id;
    if (!id) return;
    this.show(id, row);
    // The button just used may now be disabled (end of the loaded page): keep keyboard focus inside the drawer.
    setTimeout(() => {
      const a = document.activeElement as HTMLElement | null;
      if (!a || a === document.body || (a as HTMLButtonElement).disabled) this.host.nativeElement.focus({ preventScroll: true });
    });
  }

  /** A child row in the Units / Variants section: opens in this drawer like any product. */
  openChild(row: any): void {
    const id = row?.id ?? row?._id;
    if (id) this.show(id, row);
  }

  retryNav(): void { void this.fetch(this.currentId(), false); }

  private show(id: string, row: any): void {
    this.currentId.set(id);
    this.currentRow.set(row ?? null);
    this.navError.set(null);
    this.data.nav?.activated(row);
    void this.fetch(id, false);
  }

  /** Alt+ArrowUp / Alt+ArrowDown while the drawer has focus. Not while typing in a field (Alt+Arrow moves the caret on macOS). */
  @HostListener('keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (!this.data.nav || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    this.go(e.key === 'ArrowUp' ? -1 : 1);
  }

  // ─── Lifecycle ─────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await this.fetch(this.data.productId, true);
  }

  ngAfterViewInit(): void {
    // Give the drawer focus so Alt+Arrow works straight away (only when it has Previous / Next to offer).
    if (this.data.nav) this.host.nativeElement.focus({ preventScroll: true });
  }

  /** Loads one product and its stock + activity. Only the newest request may write state (rapid Previous / Next). */
  private async fetch(id: string, initial: boolean): Promise<void> {
    const seq = ++this.loadSeq;
    if (!initial) this.switching.set(true);
    try {
      const p = await this.svc.getProduct(id);
      if (seq !== this.loadSeq) return;
      if (!p) throw new Error('Product not found.');

      // Nothing from the previous product may linger under the new one.
      this.branchSummary.set([]);
      this.activity.set(null);
      this.imgError.set(false);
      this.product.set(p);
      this.loading.set(false);
      this.switching.set(false);

      // Fire branch-stock + activity loads in parallel. They're independent
      // and the header/basic-info block is already on screen.
      if (['inventory', 'batch', 'serialized', 'kit'].includes(p.type)) {
        this.loadBranchStock(p.id);
      }
      this.loadActivity(p.id);
    } catch (e: any) {
      if (seq !== this.loadSeq) return;
      if (initial) {
        this.error.set(e?.message ?? 'Failed to load product.');
        this.loading.set(false);
      } else {
        this.navError.set(e?.message ?? 'Failed to load product.');
        this.switching.set(false);
      }
    }
  }

  private async loadBranchStock(productId: string): Promise<void> {
    this.stockLoading.set(true);
    try {
      const rows = await this.svc.getProductAvailability(productId);
      if (this.product()?.id === productId) this.branchSummary.set(rows);
    } catch (e) {
      console.error('[product-detail-drawer] branch stock failed', e);
    } finally {
      if (this.product()?.id === productId) this.stockLoading.set(false);
    }
  }

  private async loadActivity(productId: string): Promise<void> {
    this.activityLoading.set(true);
    try {
      const data = await this.svc.getProductActivity(productId);
      if (this.product()?.id === productId) this.activity.set(data);
    } catch (e) {
      console.error('[product-detail-drawer] activity failed', e);
    } finally {
      if (this.product()?.id === productId) this.activityLoading.set(false);
    }
  }

  onEdit(): void {
    const p = this.product();
    if (!p) return;
    // Close the drawer first so the user lands on the edit route cleanly.
    this.ref.dismiss();
    if (p.type === 'matrix' && !(p as any).parentId && !(p as any).parent_id) {
      this.router.navigate(['/matrix-item', p.id]);
      return;
    }
    this.router.navigate(['/products/form', p.type || 'inventory', p.id]);
  }
}

