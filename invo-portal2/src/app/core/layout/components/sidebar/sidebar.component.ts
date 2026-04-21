import {
  Component, Input, Output, EventEmitter, HostListener,
  inject, OnInit, computed, signal,
  ApplicationRef, createComponent, EnvironmentInjector

} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { SafeHtmlPipe } from '../../../../core/pipes/safe-html.pipe';
import { filter } from 'rxjs';
import { MenuItem } from '../../models/menu.model';
import { PrivilegeService } from '../../../auth/privileges/privilege.service';
import { QuickActionsComponent } from './quick-actions.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ModalService } from '../../../../shared/modal/modal.service';
import { CompanySwitcherComponent } from '../topbar/company-switcher.component';
import { AuthService } from '../../../auth/auth.service';
import { resolveEmployeeName } from '../../../auth/auth.models';
import { FeatureService } from '../../../auth/feature.service';
import { CompanyService } from '../../../auth/company.service';
import { EmployeeOptionsService } from '../../services/employee-options.service';
import { FavoritesService } from '../../services/favorites.service';

/* ── Menu definition (matches original menu.ts structure with icons) ─ */
interface SideMenuItem {
  id: number;
  label: string;
  icon?: string;
  link?: string;
  isTitle?: boolean;
  badge?: { variant: 'primary' | 'success' | 'danger' | 'warning'; text: string };
  subItems?: SideMenuItem[];
  expanded?: boolean;
  requiredPermission?: string;
  feature?: string;
  /** Optional translation key rendered as a subtle heading *above* this
   *  sub-item. Used to visually group a run of related sub-items (e.g. all
   *  bulk-operation pages under Products). Only honoured inside a submenu. */
  section?: string;
}

export const SIDE_MENU: SideMenuItem[] = [
  // ── Dashboard ──────────────────────────────────────────────────────
  {
    id: 2, label: 'MENU.DASHBOARD', icon: 'home',
    link: '/dashboard',
  },
  // ── Products ───────────────────────────────────────────────────────
  // Sub-items grouped by concern. Bulk-operation pages (price change,
  // availability, bulk image, translation, label print) are intentionally
  // NOT listed here — they're reachable from the Products List "More" menu,
  // where they live alongside the selection/filter context needed to use
  // them effectively.
  {
    id: 3, label: 'MENU.PRODUCTS', icon: 'product',
    requiredPermission: '',
    subItems: [
      // — Catalog —
      { id: 31, label: 'MENU.SUB.PRODUCT_LIST', link: '/products', requiredPermission: 'productSecurity.action.view.access' },
      { id: 32, label: 'MENU.SUB.MATRIX_ITEMS', link: '/matrix-item', requiredPermission: 'matrixItemSecurity.action.view.access' },
      { id: 313, label: 'MENU.SUB.COLLECTIONS', link: '/products/products-collections', requiredPermission: 'productsCollectionsSecurity.action.view.access' },

      // — Classifications —
      { id: 34, label: 'MENU.SUB.DEPARTMENTS', link: '/products/department', requiredPermission: 'departmentSecurity.action.view.access' },
      { id: 35, label: 'MENU.SUB.CATEGORIES', link: '/products/category', requiredPermission: 'categorySecurity.action.view.access' },
      { id: 36, label: 'MENU.SUB.BRANDS', link: '/products/brands', requiredPermission: 'brandSecurity.action.view.access' },
      { id: 33, label: 'MENU.SUB.DIMENSIONS', link: '/products/dimension', requiredPermission: 'dimensionSecurity.action.view.access' },

      // — Options & Recipes —
      { id: 37, label: 'MENU.SUB.OPTION_GROUPS', link: '/products/optionGroup', requiredPermission: 'optionGroupSecurity.action.view.access' },
      { id: 38, label: 'MENU.SUB.OPTIONS', link: '/products/option', requiredPermission: 'optionSecurity.action.view.access' },
      { id: 39, label: 'MENU.SUB.RECIPES', link: '/products/recipe', requiredPermission: 'recipeSecurity.action.view.access' },
      { id: 310, label: 'MENU.SUB.PRODUCT_RECIPES', link: '/products/productRecipe', requiredPermission: 'productRecipeSecurity.action.view.access' },
    ],
  },
  // ── Employees ──────────────────────────────────────────────────────
  {
    id: 4, label: 'MENU.EMPLOYEES', icon: 'employee',
    requiredPermission: '',
    subItems: [
      { id: 41, label: 'MENU.SUB.EMPLOYEE_LIST', link: '/employees', requiredPermission: 'employeeSecurity.actions.view.access' },
      { id: 42, label: 'MENU.SUB.PRIVILEGES', link: '/employee-privileges', requiredPermission: 'privilegeSecurity.actions.view.access' },
      { id: 43, label: 'MENU.SUB.SCHEDULE', link: '/employeeSchedule', requiredPermission: 'employeeScheduleSecurity.actions.view.access' },
      { id: 44, label: 'MENU.SUB.ATTENDANCE', link: '/employeeAttendence', requiredPermission: 'employeeAttendenceSecurity.actions.view.access' },
    ],
  },
  // ── Accounts ───────────────────────────────────────────────────────
  {
    id: 6, label: 'MENU.ACCOUNTS', icon: 'account',
    requiredPermission: '',
    subItems: [
      { id: 61, label: 'MENU.SUB.CHART_OF_ACCOUNTS', link: '/account/accounts', requiredPermission: 'accountSecurity.actions.view.access' },
      { id: 62, label: 'MENU.SUB.OPENING_BALANCES', link: '/account/opening-balances', requiredPermission: 'openingBalances.actions.view.access' },
      { id: 63, label: 'MENU.SUB.MANUAL_JOURNALS', link: '/account/journal', requiredPermission: 'manualJournalSecurity.actions.view.access' },
      { id: 64, label: 'MENU.SUB.RECURRING_JOURNALS', link: '/account/recurring-journal', requiredPermission: 'recurringJournalSecurity.actions.view.access' },
      { id: 65, label: 'MENU.SUB.BUDGET', link: '/account/budget', requiredPermission: 'budgetSecurity.actions.view.access' },
      { id: 66, label: 'MENU.SUB.BANKING_OVERVIEW', link: '/account/banking-overview', requiredPermission: 'bankingOverview.actions.view.access' },
      { id: 67, label: 'MENU.SUB.VAT_PAYMENT', link: '/account/vat-payment', requiredPermission: 'vatPayment.actions.view.access' },
    ],
  },
  // ── Sales ──────────────────────────────────────────────────────────
  {
    id: 7, label: 'MENU.SALES', icon: 'invoice',
    requiredPermission: '',
    subItems: [
      { id: 71, label: 'MENU.SUB.CUSTOMERS', link: '/account/customers', requiredPermission: 'customerSecurity.actions.view.access' },
      { id: 72, label: 'MENU.SUB.CUSTOMER_SEGMENTS', link: '/account/customer-segments', requiredPermission: 'customerSegmentsSecurity.actions.view.access' },
      { id: 73, label: 'MENU.SUB.ESTIMATES', link: '/account/estimate', requiredPermission: 'estimateSecurity.actions.view.access' },
      { id: 74, label: 'MENU.SUB.INVOICES', link: '/account/invoices', requiredPermission: 'invoiceSecurity.actions.view.access' },
      { id: 75, label: 'MENU.SUB.RECURRING_INVOICES', link: '/account/recurring-invoice', requiredPermission: 'recurringInvoiceSecurity.actions.view.access' },
      { id: 76, label: 'MENU.SUB.PAYMENTS', link: '/account/payments', requiredPermission: 'invoicePaymentsSecurity.actions.view.access' },
      { id: 77, label: 'MENU.SUB.CREDIT_NOTES', link: '/account/credit-notes', requiredPermission: 'creditNoteSecurity.actions.view.access' },
    ],
  },
  // ── Purchase ───────────────────────────────────────────────────────
  {
    id: 8, label: 'MENU.PURCHASE', icon: 'purchase',
    requiredPermission: '',
    subItems: [
      { id: 81, label: 'MENU.SUB.SUPPLIERS', link: '/account/suppliers', requiredPermission: 'supplierSecurity.actions.view.access' },
      { id: 82, label: 'MENU.SUB.INVENTORY_REQUEST', link: '/products/inventory-request', requiredPermission: 'productSecurity.actions.requestInventory.access' },
      { id: 83, label: 'MENU.SUB.PURCHASE_ORDERS', link: '/account/purchase-order', requiredPermission: 'purchaseOrderSecurity.actions.view.access' },
      { id: 84, label: 'MENU.SUB.BILLS', link: '/account/bills', requiredPermission: 'billingSecurity.actions.view.access' },
      { id: 85, label: 'MENU.SUB.BILL_OF_ENTRY', link: '/account/bill-of-entry', requiredPermission: 'billOfEntrySecurity.actions.view.access' },
      { id: 86, label: 'MENU.SUB.RECURRING_BILLS', link: '/account/recurring-bill', requiredPermission: 'recurringBillSecurity.actions.view.access' },
      { id: 87, label: 'MENU.SUB.BILL_PAYMENTS', link: '/account/bills-payment', requiredPermission: 'billingPaymentsSecurity.actions.view.access' },
      { id: 88, label: 'MENU.SUB.EXPENSES', link: '/account/expense', requiredPermission: 'expenseSecurity.actions.view.access' },
      { id: 89, label: 'MENU.SUB.RECURRING_EXPENSES', link: '/account/recurring-expense', requiredPermission: 'recurringExpenseSecurity.actions.view.access' },
      { id: 810, label: 'MENU.SUB.SUPPLIER_CREDIT', link: '/account/supplier-credit', requiredPermission: 'supplierCredit.actions.view.access' },
    ],
  },
  // ── Promotions ─────────────────────────────────────────────────────
  {
    id: 9, label: 'MENU.PROMOTIONS', icon: 'promotion',
    requiredPermission: '',
    badge: { text: 'BETA', variant: 'danger' },
    subItems: [
      { id: 91, label: 'MENU.SUB.CAMPAIGNS', link: '/promotions/campaigns', requiredPermission: 'campaignsSecurity.access' },
      { id: 92, label: 'MENU.SUB.CUSTOMER_TIERS', link: '/promotions/customer-tiers', requiredPermission: 'customerTiersSecurity.access' },
      { id: 93, label: 'MENU.SUB.POINTS', link: '/promotions/promotional-points', requiredPermission: 'promotionalPointsSecurity.access' },
      { id: 94, label: 'MENU.SUB.COUPONS', link: '/promotions/coupons', requiredPermission: 'couponsSecurity.access' },
    ],
  },
  // ── Inventory ──────────────────────────────────────────────────────
  {
    id: 5, label: 'MENU.INVENTORY', icon: 'inventory',
    requiredPermission: '',
    subItems: [
      { id: 51, label: 'MENU.SUB.PHYSICAL_COUNTS', link: '/inventory/physical-counts', requiredPermission: 'inventoryPhysicalCountsSecurity.actions.view.access' },
      { id: 52, label: 'MENU.SUB.LOCATIONS', link: '/products/inventory-locations', requiredPermission: 'inventoryLocationsSecurity.action.view.access' },
      { id: 53, label: 'MENU.SUB.TRANSFERS', link: '/inventory/transfer', requiredPermission: 'inventoryTransferSecurity.actions.view.access' },
      { id: 54, label: 'MENU.SUB.MANUAL_ADJUSTMENT', link: '/manual-adjustment', requiredPermission: 'manualAdjustmentSecurity.actions.view.access' },
    ],
  },
  // ── Reports ────────────────────────────────────────────────────────
  {
    id: 10, label: 'MENU.REPORTS', icon: 'bar_chart',
    link: '/cloud-reports',
    requiredPermission: 'reportsSecurity.actions.view.access',
  },
  // ── Media ──────────────────────────────────────────────────────────
  {
    id: 11, label: 'MENU.MEDIA', icon: 'media',
    link: '/media',
    requiredPermission: 'mediaSecurity.actions.view.access',
  },
  // ── Plugins ────────────────────────────────────────────────────────
  {
    id: 12, label: 'MENU.PLUGINS', icon: 'plugin',
    link: '/plugins',
    requiredPermission: 'pluginsSecurity.actions.view.access',
  },
  // ── Website Content ────────────────────────────────────────────────
  {
    id: 13, label: 'MENU.WEBSITE_CONTENT', icon: 'web',
    requiredPermission: '',
    subItems: [
      { id: 131, label: 'MENU.SUB.PAGE_BUILDER', link: '/page-builder', requiredPermission: 'websiteBuilderSecurity.actions.view.access' },
      { id: 132, label: 'MENU.SUB.NAVIGATION', link: '/navigation-list', requiredPermission: 'websiteBuilderSecurity.actions.view.access' },
      { id: 136, label: 'Content Library', link: '/website/content-library', requiredPermission: 'websiteBuilderSecurity.actions.view.access' },
      { id: 133, label: 'MENU.SUB.WEBSITE_SETTINGS', link: '/website-settings', requiredPermission: 'websiteSettingsSecurity.actions.view.access' },
      { id: 134, label: 'MENU.SUB.DOMAIN_SETTINGS', link: '/domain-settings', requiredPermission: 'DomainSettingsSecurity.actions.view.access' },
      { id: 135, label: 'MENU.SUB.PAGING_SYSTEM', link: '/paging', requiredPermission: 'pagingSecurity.actions.view.access' },
    ],
  },
];

/* ── IDs that get a divider above them ─────────────────────────────── */
const DIVIDER_IDS = new Set([5, 10, 13]);

interface FavoritePage { label: string; link: string; }

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SafeHtmlPipe, QuickActionsComponent, TranslateModule],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed" [class.mobile-open]="mobileOpen">

      <!-- ══ Company identity ══ -->
      @if (!collapsed) {
        <div class="company-row" (click)="openSwitcher()">
          <div class="company-logo">
            @if (companyLogo()) {
              <img [src]="companyLogo()" class="company-logo-img" alt="logo" />
            } @else {
              <span class="company-logo-initials">{{ companyInitial() }}</span>
            }
          </div>
          <div class="company-info">
            <p class="company-name">{{ companyService.currentCompanyName() || 'My Company' }}</p>
            <p class="company-sub">{{ displayName() }}</p>
          </div>
          <svg class="company-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      } @else {
        <div class="company-row-collapsed" (click)="openSwitcher()" title="{{ companyService.currentCompanyName() }}">
          <div class="company-logo">
            @if (companyLogo()) {
              <img [src]="companyLogo()" class="company-logo-img" alt="logo" />
            } @else {
              <span class="company-logo-initials">{{ companyInitial() }}</span>
            }
          </div>
        </div>
      }

      <!-- ══ Favorites overlay ══ -->
           <!-- ══ Quick Actions ══ -->
      @if (qaOpen && !isMobile()) {
        <app-quick-actions (close)="closeQA()"></app-quick-actions>
      }

      <!-- ══ Main nav ══ -->
      <nav class="nav-scroll">


        <ul class="menu-list">
          @for (item of visibleMenuItems(); track item.id) {
            @if (item.subItems?.length) {
              <!-- parent with submenu -->
              <li class="menu-item" [class.divider]="hasDivider(item.id)">
                <button class="menu-row"
                        [class.active]="isParentActive(item)"
                        [class.open]="item.expanded"
                        (click)="handleParentClick(item, $event)"
                        [title]="collapsed ? item.label : ''">
                  <span class="menu-icon" [innerHTML]="getIcon(item.icon) | safeHtml"></span>
                  @if (!collapsed) {
                    <span class="menu-label">{{ item.label | translate }}</span>
                    @if (item.badge) {
                      <span class="badge badge--{{ item.badge.variant }}">{{ item.badge.text }}</span>
                    }
                    <svg class="menu-arrow" [class.open]="item.expanded"
                         width="14" height="14" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  }
                </button>
                @if (!collapsed && item.expanded) {
                  <ul class="submenu">
                    @for (sub of item.subItems!; track sub.id) {
                      @if (sub.section) {
                        <li class="sub-section">{{ sub.section | translate }}</li>
                      }
                      <li>
                        <a [routerLink]="sub.link"
                           routerLinkActive="active"
                           [routerLinkActiveOptions]="{ exact: false }"
                           class="sub-row"
                           (click)="onSubLinkClick()">{{ sub.label | translate }}</a>
                      </li>
                    }
                  </ul>
                }
              </li>
            } @else {
              <!-- leaf item -->
              <li class="menu-item" [class.divider]="hasDivider(item.id)">
                <a [routerLink]="item.link"
                   routerLinkActive="active"
                   [routerLinkActiveOptions]="{ exact: item.link === '/dashboard' }"
                   class="menu-row"
                   (click)="handleLeafClick(item)"
                   [title]="collapsed ? item.label : ''">
                  <span class="menu-icon" [innerHTML]="getIcon(item.icon) | safeHtml"></span>
                  @if (!collapsed) {
                    <span class="menu-label">{{ item.label | translate }}</span>
                    @if (item.badge) {
                      <span class="badge badge--{{ item.badge.variant }}">{{ item.badge.text }}</span>
                    }
                  }
                </a>
              </li>
            }
          }
        </ul>
      </nav>

      <!-- ══ Footer ══ -->
      @if (!collapsed) {
        <div class="sidebar-footer">
          <a routerLink="/page-builder" class="design-site-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            {{ 'MENU.DESIGN_SITE' | translate }}
          </a>
        </div>
      }

    </aside>

    @if (mobileOpen) {
      <div class="overlay" (click)="closeMobile()"></div>
    }
  `,
  styles: [`
    :host {
      --bg:         #2a3042;
      --bg-hover:   rgba(255,255,255,.055);
      --bg-active:  rgba(50, 172, 193, .10);   /* parent active — subtle brand tint */
      --border:     rgba(255,255,255,.08);
      --text:       #c3cbe4;
      --text-muted: #74788d;
      --text-on:    #f0f2f8;
      --accent:     #32acc1;                   /* brand-500 */
      --w:          240px;
      --w-col:      56px;
    }

    /* Shell */
    aside.sidebar {
      position: fixed; top: 56px; left: 0;
      height: calc(100vh - 56px); width: var(--w);
      background: var(--bg);
      display: flex; flex-direction: column;
      transition: width .25s ease;
      z-index: 1000; overflow: hidden;
    }
    aside.sidebar.collapsed { width: var(--w-col); }

    /* Top bar */

    .qa-pill {
      flex: 1; display: flex; align-items: center; justify-content: space-between;
      padding: 7px 14px;
      background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 20px;
      color: var(--text); font-size: 13px; font-weight: 500;
      cursor: pointer; transition: all .15s; font-family: inherit;
    }
    .qa-pill:hover { background: rgba(255,255,255,.11); color: var(--text-on); }
    .qa-pill svg { color: var(--text-muted); }

    .collapse-btn {
      width: 28px; height: 28px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; border-radius: 6px;
      color: var(--text-muted); cursor: pointer; transition: all .15s;
    }
    .collapse-btn:hover { background: var(--bg-hover); color: var(--text-on); }
    .collapse-btn svg { transition: transform .25s; }

    .icon-btn {
      width: 26px; height: 26px;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; border-radius: 6px;
      color: var(--text-muted); cursor: pointer; flex-shrink: 0; transition: all .15s;
    }
    .icon-btn:hover { background: var(--bg-hover); color: var(--text-on); }

    /* Favorites panel */
    .fav-panel {
      position: absolute; top: 52px; left: 0; right: 0;
      background: var(--bg); border-bottom: 1px solid var(--border);
      z-index: 10; animation: fadeSlide .15s ease;
    }
    @keyframes fadeSlide {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fav-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px 10px;
    }
    .fav-title { font-size: 14px; font-weight: 600; color: var(--text-on); }
    .fav-body { padding: 0 12px 14px; }
    .fav-hint { font-size: 12px; color: var(--text-muted); line-height: 1.55; margin-bottom: 10px; }

    .fav-row {
      display: flex; align-items: center; gap: 8px;
      padding: 6px; border-radius: 7px; transition: background .12s;
    }
    .fav-row:hover { background: var(--bg-hover); }
    .fav-row:hover .fav-remove-btn { opacity: 1; }
    .fav-star-icon { color: var(--text-muted); flex-shrink: 0; }
    .fav-name { flex: 1; color: var(--text); font-size: 13px; text-decoration: none; }
    .fav-name:hover { color: var(--text-on); }
    .fav-remove-btn {
      opacity: 0; background: transparent; border: none;
      color: var(--text-muted); cursor: pointer; padding: 2px;
      display: flex; align-items: center; border-radius: 4px; transition: all .12s;
    }
    .fav-remove-btn:hover { color: var(--text-on); }

    .fav-edit-row { display: flex; align-items: center; gap: 6px; width: 100%; }
    .fav-input {
      flex: 1; background: rgba(255,255,255,.08);
      border: 1px solid var(--accent); border-radius: 6px;
      color: var(--text-on); font-size: 13px; padding: 5px 9px; outline: none;
    }
    .fav-action-btn {
      width: 26px; height: 26px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      border: none; border-radius: 50%; cursor: pointer;
    }
    .fav-action-btn--cancel { background: rgba(255,255,255,.12); color: var(--text-muted); }
    .fav-action-btn--save   { background: var(--accent); color: #fff; }

    .add-page-btn {
      display: flex; align-items: center; gap: 7px;
      width: 100%; padding: 8px 6px;
      background: transparent; border: none; border-radius: 7px;
      color: var(--accent); font-size: 13px; cursor: pointer;
      transition: background .12s; font-family: inherit;
    }
    .add-page-btn:hover { background: rgba(50, 172, 193, .12); }

    .recent-label { font-size: 11px; color: var(--text-muted); margin: 14px 0 8px 4px; }
    .recent-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
    .recent-chip {
      display: flex; align-items: center; gap: 5px;
      padding: 5px 11px; border-radius: 18px;
      border: 1px solid rgba(255,255,255,.14); background: transparent;
      color: var(--text); font-size: 12px; cursor: pointer; font-family: inherit;
      transition: all .12s;
    }
    .recent-chip:hover { border-color: rgba(255,255,255,.3); color: var(--text-on); }
    .recent-chip svg { color: var(--text-muted); flex-shrink: 0; }

    .keep-open-row {
      display: flex; align-items: center; gap: 9px;
      margin-top: 14px; padding: 12px 0 0 4px;
      border-top: 1px solid var(--border);
      font-size: 12px; color: var(--text-muted); cursor: pointer;
    }
    .toggle-wrap {
      width: 32px; height: 18px; border-radius: 9px;
      background: rgba(255,255,255,.18); position: relative;
      flex-shrink: 0; transition: background .2s;
    }
    .toggle-wrap.on { background: var(--accent); }
    .toggle-thumb {
      position: absolute; top: 2px; left: 2px;
      width: 14px; height: 14px; border-radius: 50%;
      background: #fff; transition: transform .2s;
    }
    .toggle-wrap.on .toggle-thumb { transform: translateX(14px); }



    /* Company identity */
    .company-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; margin: 12px 8px 6px;
      border-radius: 8px; cursor: pointer;
      transition: background .12s;
      border: 1px solid rgba(255,255,255,.07);
      background: rgba(255,255,255,.04);
    }
    .company-row:hover { background: rgba(255,255,255,.08); }

    .company-row-collapsed {
      display: flex; justify-content: center;
      padding: 8px 0; margin: 6px 0;
      cursor: pointer;
    }

    .company-logo {
      width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
      overflow: hidden; border: 1px solid rgba(255,255,255,.12);
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,.08);
    }
    .company-logo-img { width: 100%; height: 100%; object-fit: cover; }
    .company-logo-initials {
      font-size: 15px; font-weight: 700; color: var(--text-on);
      text-transform: uppercase;
    }
    .company-info { flex: 1; min-width: 0; }
    .company-name {
      font-size: 13px; font-weight: 600; color: var(--text-on);
      margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .company-sub {
      font-size: 11px; color: var(--text-muted);
      margin: 2px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .company-arrow { color: var(--text-muted); flex-shrink: 0; }



    /* Nav */
    .nav-scroll {
      flex: 1; overflow-y: auto; overflow-x: hidden; padding: 6px 0;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.07) transparent;
    }
    .menu-list { list-style: none; margin: 0; padding: 0; }

    .menu-item.divider { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 4px; }

    /* Menu row (shared by <a> and <button>) */
    .menu-row {
      display: flex; align-items: center; gap: 12px;
      width: 100%; padding: 9px 12px 9px 14px;
      background: transparent; border: none;
      color: var(--text); text-decoration: none;
      font-size: 13.5px; font-family: inherit;
      cursor: pointer; transition: background .12s, color .12s;
      white-space: nowrap; overflow: hidden;
    }
    .menu-row:hover { background: var(--bg-hover); color: var(--text-on); }
    .menu-row.active, .menu-row.open { color: var(--text-on); }
    .menu-row.active { background: var(--bg-active); }

    aside.sidebar.collapsed .menu-row { padding: 10px; justify-content: center; }

    /* Icon: use width/height on the wrapper so SVG inherits via currentColor */
    .menu-icon {
      width: 18px; height: 18px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .menu-icon svg { width: 18px; height: 18px; display: block; }

    .menu-label { flex: 1; text-align: left; }
    .menu-arrow { flex-shrink: 0; color: var(--text-muted); transition: transform .2s; }
    .menu-arrow.open { transform: rotate(90deg); }

    /* Badges */
    .badge { padding: 2px 7px; border-radius: 10px; font-size: 10px; font-weight: 700; }
    .badge--primary { background: rgba(50, 172, 193, .22); color: #7ad3df; }
    .badge--success { background: rgba(52,195,143,.2);  color: #34c38f; }
    .badge--danger  { background: rgba(244,106,106,.2); color: #f46a6a; }
    .badge--warning { background: rgba(241,180,76,.2);  color: #f1b44c; }

    /* Submenu */
    .submenu { list-style: none; margin: 0; padding: 2px 0 4px 0; }
    .sub-row {
      display: block; padding: 8px 14px 8px 44px;
      color: var(--text-muted); font-size: 13px; text-decoration: none;
      transition: all .12s;
    }
    .sub-row:hover { background: var(--bg-hover); color: var(--text-on); }
    /* Sub-item active — stronger brand fill + a left stripe so the
       "current page" reads louder than its parent group. */
    .sub-row.active {
      background: rgba(50, 172, 193, .25);
      color: var(--text-on);
      box-shadow: inset 3px 0 0 var(--accent);
      font-weight: 600;
    }
    /* In RTL the stripe should be on the right edge instead. */
    [dir="rtl"] .sub-row.active { box-shadow: inset -3px 0 0 var(--accent); }

    /* Section heading inside a submenu (e.g. "Bulk operations") */
    .sub-section {
      padding: 10px 14px 4px 20px;
      margin-top: 6px;
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--text-muted);
      opacity: .6;
      border-top: 1px solid var(--border);
    }
    .sub-section + li .sub-row { padding-top: 6px; }

    /* Footer */
    .sidebar-footer { flex-shrink: 0; border-top: 1px solid var(--border); padding: 8px 10px; }
    .design-site-btn {
      display: flex; align-items: center; gap: 9px;
      padding: 9px 14px; border-radius: 8px;
      color: var(--text); text-decoration: none; font-size: 13px; transition: all .12s;
    }
    .design-site-btn:hover { background: var(--bg-hover); color: var(--text-on); }
    .design-site-btn svg { opacity: .7; }


    /* Mobile */
    @media (max-width: 991px) {
      aside.sidebar {
        transform: translateX(-100%);
        transition: transform .25s ease;
        width: 260px !important;
      }
      aside.sidebar.mobile-open { transform: translateX(0) !important; }
      .collapse-btn { display: none; }

      /* Smaller icons on mobile */
      .menu-icon { width: 18px !important; height: 18px !important; }
      .menu-icon svg { width: 16px !important; height: 16px !important; }
    }
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 999; display: none; }
    @media (max-width: 991px) { .overlay { display: block; } }
  `]
})
export class SidebarComponent implements OnInit {
  @Input() collapsed = false;
  @Input() mobileOpen = false;
  @Output() collapsedChange = new EventEmitter<boolean>();
  @Output() mobileOpenChange = new EventEmitter<boolean>();

  private router           = inject(Router);
  private privilegeService = inject(PrivilegeService);
  private featureService   = inject(FeatureService);
  private translateService = inject(TranslateService);
  private optionsService   = inject(EmployeeOptionsService);
  private favsService      = inject(FavoritesService);
  companyService           = inject(CompanyService);
  private authService      = inject(AuthService);
  private modalService     = inject(ModalService);

  displayName    = computed(() => resolveEmployeeName(this.authService.currentEmployee));
  companyInitial = computed(() => (this.companyService.currentCompanyName() || 'C')[0].toUpperCase());
  companyLogo    = computed(() => {
    const s = this.companyService.settings();
    return s?.mediaUrl?.thumbnail ?? s?.mediaUrl?.defaultUrl ?? s?.logo ?? null;
  });

  openSwitcher(): void {
    this.modalService.open(CompanySwitcherComponent, {
      drawer: true, drawerWidth: '300px', closeOnBackdrop: true,
    });
  }

  favOpen     = false;
  qaOpen      = false;
  isMobile    = signal(window.innerWidth <= 991);

  @HostListener('window:resize')
  onResize(): void { this.isMobile.set(window.innerWidth <= 991); }

  private appRef      = inject(ApplicationRef);
  private envInjector = inject(EnvironmentInjector);
  private qaHostEl: HTMLElement | null = null;
  keepFavOpen  = false;
  editingFav: FavoritePage | null = null;

  favorites   = computed(() => this.favsService.favorites());
  recentPages = computed(() =>
    this.favsService.recentPages().filter(r => !this.favsService.isFavorite(r.link))
  );

  visibleMenuItems = computed(() =>
    SIDE_MENU.filter(item => this.canShow(item))
  );

  ngOnInit(): void {
    this.expandActiveParent();
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(e => {
        this.expandActiveParent();
        this.trackRecentPage((e as any).urlAfterRedirects ?? this.router.url);
      });
    this.loadOptions();
  }

  private async loadOptions(): Promise<void> {
    await this.favsService.load();
  }

  private trackRecentPage(url: string): void {
    const flat  = SIDE_MENU.flatMap(m => m.subItems ?? [m]);
    const found = flat.find(i => i.link && url.startsWith(i.link));
    if (!found?.label) return;
    const key        = found.label;
    const translated = this.translateService.instant(key);
    const hasKey     = translated !== key;
    this.favsService.addRecent({
      label: hasKey ? translated : key,
      labelKey: hasKey ? key : undefined,
      link: url,
    });
  }

  private canShow(item: SideMenuItem): boolean {
    if (!item.requiredPermission) return true;
    return this.privilegeService.check(item.requiredPermission);
  }

  private expandActiveParent(): void {
    const url = this.router.url;
    SIDE_MENU.forEach(item => {
      if (item.subItems?.some(sub => sub.link && url.startsWith(sub.link)))
        item.expanded = true;
    });
  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
    if (this.collapsed) { this.favOpen = false; this.closeQA(); }
  }

  closeMobile(): void {
    this.mobileOpen = false;
    this.mobileOpenChange.emit(false);
  }

  toggleFav(): void {
    if (this.collapsed) {
      this.collapsed = false;
      this.collapsedChange.emit(false);
      setTimeout(() => { this.favOpen = true; }, 260);
      return;
    }
    this.favOpen = !this.favOpen;
    if (this.favOpen) this.closeQA();
  }

  toggleQA(): void {
    if (this.qaOpen) { this.closeQA(); }
    else {
      this.qaOpen = true;
      this.favOpen = false;
      if (window.innerWidth <= 991) { this.openQAOnBody(); }
    }
  }

  private openQAOnBody(): void {
    if (this.qaHostEl) return;
    const host = document.createElement('div');
    document.body.appendChild(host);
    this.qaHostEl = host;
    const ref = createComponent(QuickActionsComponent, {
      environmentInjector: this.envInjector,
      hostElement: host,
    });
    ref.instance.close.subscribe(() => this.closeQA());
    this.appRef.attachView(ref.hostView);
  }

  closeQA(): void {
    this.qaOpen = false;
    if (this.qaHostEl) { document.body.removeChild(this.qaHostEl); this.qaHostEl = null; }
  }

  toggleSub(item: SideMenuItem): void { item.expanded = !item.expanded; }

  handleParentClick(item: SideMenuItem, event: MouseEvent): void {
    if (this.collapsed) {
      this.collapsed = false;
      this.collapsedChange.emit(false);
      item.expanded = true;
    } else {
      item.expanded = !item.expanded;
    }

    // When expanding, scroll the parent + its submenu into view so the user
    // can see everything that just appeared (useful for parents near the
    // bottom of the sidebar like "Website Content").
    if (item.expanded) {
      const button = event.currentTarget as HTMLElement | null;
      if (!button) return;
      // Two RAFs: first to let Angular apply the @if change, second to
      // measure after the submenu has laid out.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const li = button.closest('li.menu-item') as HTMLElement | null;
          const container = button.closest('.nav-scroll') as HTMLElement | null;
          if (!li || !container) return;

          const liRect = li.getBoundingClientRect();
          const cRect  = container.getBoundingClientRect();
          const padding = 12;

          // If the li's bottom extends past the container's bottom, scroll
          // down by the overflow amount so the whole submenu is visible.
          if (liRect.bottom > cRect.bottom - padding) {
            const delta = liRect.bottom - cRect.bottom + padding;
            container.scrollBy({ top: delta, behavior: 'smooth' });
          }
        });
      });
    }
  }

  handleLeafClick(item: SideMenuItem): void {
    if (this.collapsed && item.link) {
      this.collapsed = false;
      this.collapsedChange.emit(false);
    }
    // On mobile the menu is an overlay — auto-dismiss on navigation so the
    // user lands directly on the destination page.
    if (this.mobileOpen) this.closeMobile();
  }

  /** Same auto-close behavior for nested sub-item links. */
  onSubLinkClick(): void {
    if (this.mobileOpen) this.closeMobile();
  }

  isParentActive(item: SideMenuItem): boolean {
    const url = this.router.url;
    if (item.link && url.startsWith(item.link)) return true;
    return item.subItems?.some(s => s.link && url.startsWith(s.link)) ?? false;
  }

  hasDivider(id: number): boolean { return DIVIDER_IDS.has(id); }

  addCurrentPage(): void {
    const url   = this.router.url;
    const flat  = SIDE_MENU.flatMap(m => m.subItems ?? [m]);
    const found = flat.find(i => i.link === url);
    const key   = found?.label ?? url.split('/').pop() ?? url;
    const label = this.translateService.instant(key) !== key
      ? this.translateService.instant(key)
      : key;
    this.favsService.addFavorite({ label, link: url });
  }

  addFavFromRecent(r: FavoritePage): void {
    this.favsService.addFavorite(r);
  }

  removeFav(fav: FavoritePage): void {
    this.favsService.removeFavorite(fav.link);
  }

  saveFav(): void {
    if (!this.editingFav) return;
    this.favsService.updateFavorite(this.editingFav.link, this.editingFav.label);
    this.editingFav = null;
  }

  cancelEdit(): void { this.editingFav = null; }

  getIcon(name?: string): string {
    const icons: Record<string, string> = {
      dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
      home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      product: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
      inventory: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      invoice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
      employee: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      account: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      purchase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
      promotion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
      bar_chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
      media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
      plugin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>`,
      web: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    };
    return icons[name ?? ''] ?? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>`;
  }
}
