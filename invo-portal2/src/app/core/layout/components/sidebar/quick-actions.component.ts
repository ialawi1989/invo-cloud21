import {
  Component, Output, EventEmitter, HostListener, ElementRef, inject, computed, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SafeHtmlPipe } from '../../../../core/pipes/safe-html.pipe';
import { LanguageService } from '../../../../core/i18n/language.service';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PrivilegeService } from '../../../auth/privileges/privilege.service';
import { FeatureService } from '../../../auth/feature.service';

interface QuickAction {
  label: string;        // kept for search filtering (English)
  labelKey: string;     // translation key
  description: string;  // kept for search filtering (English)
  icon: string;
  link: string;
  queryParams?: Record<string, string>;
  permission?: string;
  feature?: string;
}

interface QuickCategory {
  title: string;        // kept for category filter matching
  titleKey: string;     // translation key
  subtitleKey: string;  // translation key
  actions: QuickAction[];
}

const ALL_CATEGORIES: QuickCategory[] = [
  {
    title: 'Sales',
    titleKey: 'QUICK_ACTIONS.CATEGORIES.SALES',
    subtitleKey: 'QUICK_ACTIONS.CATEGORIES.SALES_SUB',
    actions: [
      {
        label: 'New Invoice',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_INVOICE',
        description: 'Create and send an invoice to get paid.',
        icon: 'invoice',
        link: '/account/invoices',
        queryParams: { action: 'create' },
        permission: 'invoiceSecurity.actions.add.access',
      },
      {
        label: 'New Estimate',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_ESTIMATE',
        description: 'Send a price estimate before the job.',
        icon: 'estimate',
        link: '/account/estimate',
        queryParams: { action: 'create' },
        permission: 'estimateSecurity.actions.add.access',
      },
      {
        label: 'New Credit Note',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_CREDIT_NOTE',
        description: 'Issue a credit note for a refund.',
        icon: 'credit',
        link: '/account/credit-notes',
        queryParams: { action: 'create' },
        permission: 'creditNoteSecurity.actions.add.access',
      },
      {
        label: 'New Customer',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_CUSTOMER',
        description: 'Add a new customer to your contacts.',
        icon: 'customer',
        link: '/account/customers',
        queryParams: { action: 'create' },
        permission: 'customerSecurity.actions.add.access',
      },
      {
        label: 'New Recurring Invoice',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_RECURRING_INVOICE',
        description: 'Set up automatic recurring billing.',
        icon: 'recurring',
        link: '/account/recurring-invoice',
        queryParams: { action: 'create' },
        permission: 'recurringInvoiceSecurity.actions.add.access',
      },
    ],
  },
  {
    title: 'Purchase',
    titleKey: 'QUICK_ACTIONS.CATEGORIES.PURCHASE',
    subtitleKey: 'QUICK_ACTIONS.CATEGORIES.PURCHASE_SUB',
    actions: [
      {
        label: 'New Purchase Order',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_PURCHASE_ORDER',
        description: 'Send a purchase order to your supplier.',
        icon: 'purchase',
        link: '/account/purchase-order',
        queryParams: { action: 'create' },
        permission: 'purchaseOrderSecurity.actions.add.access',
      },
      {
        label: 'New Bill',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_BILL',
        description: 'Record a bill from a supplier.',
        icon: 'bill',
        link: '/account/bills',
        queryParams: { action: 'create' },
        permission: 'billingSecurity.actions.add.access',
      },
      {
        label: 'New Expense',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_EXPENSE',
        description: 'Log a business expense.',
        icon: 'expense',
        link: '/account/expense',
        queryParams: { action: 'create' },
        permission: 'expenseSecurity.actions.add.access',
      },
      {
        label: 'New Supplier',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_SUPPLIER',
        description: 'Add a new supplier to your contacts.',
        icon: 'supplier',
        link: '/account/suppliers',
        queryParams: { action: 'create' },
        permission: 'supplierSecurity.actions.add.access',
      },
      {
        label: 'New Supplier Credit',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_SUPPLIER_CREDIT',
        description: 'Record a credit from a supplier.',
        icon: 'credit',
        link: '/account/supplier-credit',
        queryParams: { action: 'create' },
        permission: 'supplierCredit.actions.add.access',
      },
    ],
  },
  {
    title: 'Products & Inventory',
    titleKey: 'QUICK_ACTIONS.CATEGORIES.PRODUCTS',
    subtitleKey: 'QUICK_ACTIONS.CATEGORIES.PRODUCTS_SUB',
    actions: [
      {
        label: 'New Product',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_PRODUCT',
        description: 'Add a new product to your catalog.',
        icon: 'product',
        link: '/products',
        queryParams: { action: 'create' },
        permission: 'productSecurity.actions.add.access',
      },
      {
        label: 'New Category',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_CATEGORY',
        description: 'Create a product category.',
        icon: 'category',
        link: '/products/category',
        queryParams: { action: 'create' },
        permission: 'categorySecurity.actions.add.access',
      },
      {
        label: 'New Brand',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_BRAND',
        description: 'Add a new brand.',
        icon: 'brand',
        link: '/products/brands',
        queryParams: { action: 'create' },
        permission: 'brandSecurity.actions.add.access',
      },
      {
        label: 'Price Change',
        labelKey: 'QUICK_ACTIONS.ACTIONS.PRICE_CHANGE',
        description: 'Apply bulk price changes to products.',
        icon: 'price',
        link: '/products/priceChange',
        queryParams: { action: 'create' },
        permission: 'priceChangeSecurity.actions.add.access',
      },
      {
        label: 'Manual Adjustment',
        labelKey: 'QUICK_ACTIONS.ACTIONS.MANUAL_ADJUSTMENT',
        description: 'Adjust inventory stock levels.',
        icon: 'adjustment',
        link: '/manual-adjustment',
        queryParams: { action: 'create' },
        permission: 'manualAdjustmentSecurity.actions.add.access',
      },
      {
        label: 'Inventory Transfer',
        labelKey: 'QUICK_ACTIONS.ACTIONS.INVENTORY_TRANSFER',
        description: 'Transfer stock between locations.',
        icon: 'transfer',
        link: '/inventory/transfer',
        queryParams: { action: 'create' },
        permission: 'inventoryTransferSecurity.actions.add.access',
      },
    ],
  },
  {
    title: 'Accounting',
    titleKey: 'QUICK_ACTIONS.CATEGORIES.ACCOUNTING',
    subtitleKey: 'QUICK_ACTIONS.CATEGORIES.ACCOUNTING_SUB',
    actions: [
      {
        label: 'New Journal Entry',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_JOURNAL',
        description: 'Create a manual journal entry.',
        icon: 'journal',
        link: '/account/journal',
        queryParams: { action: 'create' },
        permission: 'manualJournalSecurity.actions.add.access',
      },
      {
        label: 'New Budget',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_BUDGET',
        description: 'Set a budget for a period.',
        icon: 'budget',
        link: '/account/budget',
        queryParams: { action: 'create' },
        permission: 'budgetSecurity.actions.add.access',
      },
      {
        label: 'New Account',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_ACCOUNT',
        description: 'Add a chart of accounts entry.',
        icon: 'account',
        link: '/account/accounts',
        queryParams: { action: 'create' },
        permission: 'accountSecurity.actions.add.access',
      },
    ],
  },
  {
    title: 'HR',
    titleKey: 'QUICK_ACTIONS.CATEGORIES.HR',
    subtitleKey: 'QUICK_ACTIONS.CATEGORIES.HR_SUB',
    actions: [
      {
        label: 'New Employee',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_EMPLOYEE',
        description: 'Add a new employee to your team.',
        icon: 'employee',
        link: '/employees',
        queryParams: { action: 'create' },
        permission: 'employeeSecurity.actions.add.access',
      },
      {
        label: 'New Schedule',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_SCHEDULE',
        description: 'Create a work schedule.',
        icon: 'schedule',
        link: '/employeeSchedule',
        queryParams: { action: 'create' },
        permission: 'employeeScheduleSecurity.actions.add.access',
      },
    ],
  },
  {
    title: 'Promotions',
    titleKey: 'QUICK_ACTIONS.CATEGORIES.PROMOTIONS',
    subtitleKey: 'QUICK_ACTIONS.CATEGORIES.PROMOTIONS_SUB',
    actions: [
      {
        label: 'New Campaign',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_CAMPAIGN',
        description: 'Create a discount campaign.',
        icon: 'promotion',
        link: '/promotions/campaigns',
        queryParams: { action: 'create' },
        permission: 'campaignsSecurity.access',
        feature: 'promotions',
      },
      {
        label: 'New Coupon',
        labelKey: 'QUICK_ACTIONS.ACTIONS.NEW_COUPON',
        description: 'Generate discount coupons.',
        icon: 'coupon',
        link: '/promotions/coupons',
        queryParams: { action: 'create' },
        permission: 'couponsSecurity.access',
        feature: 'promotions',
      },
    ],
  },
];

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, SafeHtmlPipe],
  template: `
    <div class="qa-backdrop" (click)="close.emit()"></div>

    <div class="qa-panel" [class.rtl]="langService.isRtl()">
      <!-- Header -->
      <div class="qa-header">
        <div>
          <h2 class="qa-title">{{ 'QUICK_ACTIONS.TITLE' | translate }}</h2>
          <p class="qa-subtitle">{{ 'QUICK_ACTIONS.SUBTITLE' | translate }}</p>
        </div>
        <button class="qa-close" (click)="close.emit()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Search + filter -->
      <div class="qa-search-bar">
        <div class="qa-search-row-top">
          <span class="qa-search-label">{{ 'QUICK_ACTIONS.SEARCH_LABEL' | translate }}</span>
          <div class="qa-cat-select" (click)="toggleCat($event)">
            <span class="qa-cat-label">{{ selectedCatKey() ? (selectedCatKey() | translate) : ('QUICK_ACTIONS.CATEGORY_ALL' | translate) }}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                 [style.transform]="catOpen() ? 'rotate(180deg)' : 'rotate(0deg)'">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            @if (catOpen()) {
              <div class="cat-dropdown" (click)="$event.stopPropagation()">
                <div class="cat-option" [class.selected]="selectedCat() === ''"
                     (click)="selectCat('')">{{ 'QUICK_ACTIONS.CATEGORY_ALL' | translate }}</div>
                @for (c of ALL_CATEGORIES; track c.title) {
                  <div class="cat-option" [class.selected]="selectedCat() === c.title"
                       (click)="selectCat(c.title)">{{ c.titleKey | translate }}</div>
                }
              </div>
            }
          </div>
        </div>
        <div class="qa-search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input [ngModel]="query()" (ngModelChange)="query.set($event)" [placeholder]="'QUICK_ACTIONS.SEARCH_PLACEHOLDER' | translate"
                 autofocus />
        </div>
      </div>

      <!-- Results -->
      <div class="qa-body">
        @if (visibleCategories().length === 0) {
          <div class="qa-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p>{{ 'QUICK_ACTIONS.NO_RESULTS' | translate }} "<strong>{{ query() }}</strong>"</p>
          </div>
        }

        @for (cat of visibleCategories(); track cat.title) {
          <div class="qa-category">
            <h3 class="qa-cat-title">{{ cat.titleKey | translate }}</h3>
            <p class="qa-cat-subtitle">{{ cat.subtitleKey | translate }}</p>

            <div class="qa-actions-list">
              @for (action of cat.actions; track action.label) {
                <a class="qa-action-row"
                   [routerLink]="action.link"
                   [queryParams]="action.queryParams"
                   (click)="close.emit()">
                  <span class="qa-action-icon" [innerHTML]="getIcon(action.icon) | safeHtml"></span>
                  <span class="qa-action-label">{{ action.labelKey | translate }}</span>
                  <span class="qa-action-plus">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </span>
                </a>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    /* Backdrop */
    .qa-backdrop {
      position: fixed; inset: 0; z-index: 1199;
      background: rgba(0,0,0,.35);
    }

    /* Panel */
    .qa-panel {
      position: fixed; top: 56px; left: 0;
      width: 380px; height: calc(100vh - 56px); max-height: none;
      background: #fff;
      display: flex; flex-direction: column;
      z-index: 1200;
      box-shadow: 4px 0 24px rgba(0,0,0,.14);
      animation: slideRight .18s ease;
    }
    @keyframes slideRight {
      from { transform: translateX(-16px); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }

    /* Header */
    .qa-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 20px 20px 14px;
      border-bottom: 1px solid #f0f2f5;
      flex-shrink: 0;
    }
    .qa-title { font-size: 16px; font-weight: 700; color: #1a1f2e; margin: 0 0 3px; }
    .qa-subtitle { font-size: 12px; color: #74788d; margin: 0; }
    .qa-close {
      width: 28px; height: 28px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; cursor: pointer;
      color: #9ca3af; border-radius: 6px; transition: all .12s;
    }
    .qa-close:hover { background: #f4f5f7; color: #1a1f2e; }

    /* Search bar */
    .qa-search-bar {
      display: flex; flex-direction: column; gap: 8px;
      padding: 10px 16px 12px; border-bottom: 1px solid #f0f2f5;
      flex-shrink: 0;
    }
    .qa-search-row-top {
      display: flex; align-items: center; justify-content: space-between;
    }
    .qa-search-label { font-size: 12px; color: #74788d; }
    .qa-search-box {
      display: flex; align-items: center; gap: 8px;
      border: 1.5px solid #e0e4ee; border-radius: 6px; padding: 9px 12px;
      transition: border-color .15s;
      svg { color: #9ca3af; flex-shrink: 0; }
      input {
        flex: 1; border: none; outline: none;
        font-size: 16px; color: #1a1f2e; background: transparent;
        width: 100%;
        &::placeholder { color: #b0b8c1; }
      }
    }
    .qa-search-box:focus-within { border-color: #556ee6; }
    .qa-cat-select {
      position: relative; display: flex; align-items: center; gap: 4px;
      cursor: pointer; user-select: none; white-space: nowrap;
    }
    .qa-cat-label { font-size: 12px; color: #556ee6; font-weight: 500; }
    .qa-cat-select > svg { color: #556ee6; transition: transform .15s; flex-shrink: 0; }

    .cat-dropdown {
      position: absolute; top: calc(100% + 6px); right: 0;
      background: #fff; border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,.16);
      border: 1px solid #e8eaed;
      min-width: 190px; z-index: 200;
      overflow: hidden;
      animation: dropIn .12s ease;
    }
    @keyframes dropIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .cat-option {
      padding: 10px 16px; font-size: 13px; color: #2a3042;
      cursor: pointer; transition: background .1s;
    }
    .cat-option:hover { background: #f4f6ff; }
    .cat-option.selected {
      background: #556ee6; color: #fff; font-weight: 600;
    }
    .cat-option.selected:hover { background: #4a5fd4; }

    /* Body */
    .qa-body {
      flex: 1; overflow-y: auto; padding: 8px 0 16px;
      scrollbar-width: thin; scrollbar-color: #e0e4ee transparent;
    }

    .qa-empty {
      display: flex; flex-direction: column; align-items: center;
      gap: 10px; padding: 40px 20px;
      color: #9ca3af; font-size: 13px; text-align: center;
      strong { color: #495057; }
    }

    /* Category */
    .qa-category { padding: 16px 0 4px; }
    .qa-cat-title {
      font-size: 13px; font-weight: 700; color: #1a1f2e;
      margin: 0 0 2px; padding: 0 16px;
    }
    .qa-cat-subtitle {
      font-size: 11px; color: #74788d; margin: 0 0 10px; padding: 0 16px;
    }

    /* Action rows */
    .qa-actions-list { display: flex; flex-direction: column; }
    .qa-action-row {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 16px;
      border: 1px solid transparent;
      text-decoration: none; color: #1a1f2e;
      transition: all .12s; cursor: pointer;
      border-radius: 0;
      &:hover {
        background: #f4f6ff;
        border-color: #e4e8ff;
      }
      &:hover .qa-action-plus {
        border-color: #556ee6;
        color: #556ee6;
      }
      &:not(:last-child) { border-bottom: 1px solid #f4f5f7; }
    }

    .qa-action-icon {
      width: 36px; height: 36px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: #f4f5f7; border-radius: 8px; color: #556ee6;
      svg { width: 18px; height: 18px; }
    }

    .qa-action-label {
      flex: 1; font-size: 13.5px; font-weight: 500; color: #2a3042;
    }

    .qa-action-plus {
      width: 26px; height: 26px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      border: 1px solid #d1d5db; border-radius: 50%;
      color: #9ca3af; transition: all .12s;
    }

    /* ── RTL ── */
    .qa-panel.rtl {
      left: auto; right: 0;
      direction: rtl; text-align: right;
      animation: slideLeft .18s ease;
    }
    .qa-panel.rtl .qa-header    { flex-direction: row-reverse; }
    .qa-panel.rtl .qa-title     { text-align: right; }
    .qa-panel.rtl .qa-subtitle  { text-align: right; }
    .qa-panel.rtl .qa-close     { order: -1; }
    .qa-panel.rtl .qa-search-row  { flex-direction: row-reverse; }
    .qa-panel.rtl .qa-search-box  { flex-direction: row-reverse; }
    .qa-panel.rtl .qa-cat-select  { flex-direction: row-reverse; }
    .qa-panel.rtl .qa-action-row  { flex-direction: row-reverse; }
    .qa-panel.rtl .qa-action-icon { order: 1; }
    .qa-panel.rtl .qa-action-label{ order: 0; text-align: right; }
    .qa-panel.rtl .qa-action-plus { order: -1; }
    .qa-panel.rtl .qa-cat-title,
    .qa-panel.rtl .qa-cat-subtitle{ text-align: right; }
    @keyframes slideLeft {
      from { transform: translateX(16px); opacity: 0; }
      to   { transform: translateX(0); opacity: 1; }
    }

    @media (max-width: 991px) {
      .qa-panel {
        width: 100vw !important;
        height: calc(100vh - 56px) !important;
        left: 0 !important;
        right: 0 !important;
      }
    }
    @media (max-width: 576px) {
      .qa-panel { width: 100vw; height: calc(100vh - 56px); }
    }
  `]
})
export class QuickActionsComponent {
  @Output() close = new EventEmitter<void>();

  private privilegeService = inject(PrivilegeService);
  private featureService = inject(FeatureService);
  langService = inject(LanguageService);

  readonly ALL_CATEGORIES = ALL_CATEGORIES;

  query = signal('');
  catOpen = signal(false);
  selectedCat = signal('');
  selectedCatKey = signal('');

  visibleCategories = computed(() => {
    const lq = this.query().toLowerCase().trim();
    const cat = this.selectedCat();
    return ALL_CATEGORIES
      .filter(c => !cat || c.title === cat)
      .map(c => ({
        ...c,
        actions: c.actions.filter(a =>
          this.canShow(a) &&
          (!lq || a.label.toLowerCase().includes(lq) || a.description.toLowerCase().includes(lq))
        ),
      }))
      .filter(c => c.actions.length > 0);
  });

  onSearch(): void { }

  private elRef = inject(ElementRef);

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!this.elRef.nativeElement.querySelector('.qa-cat-select')?.contains(e.target as Node)) {
      this.catOpen.set(false);
    }
  }

  toggleCat(e: MouseEvent): void {
    e.stopPropagation();
    this.catOpen.set(!this.catOpen());
  }

  selectCat(cat: string): void {
    this.selectedCat.set(cat);
    const found = ALL_CATEGORIES.find(c => c.title === cat);
    this.selectedCatKey.set(found ? found.titleKey : '');
    this.catOpen.set(false);
  }

  private canShow(action: QuickAction): boolean {
    // If privileges haven't loaded yet, show all (hide nothing)
    if (action.feature && !this.featureService.isEnabled(action.feature)) return false;
    if (action.permission) {
      const priv = this.privilegeService.privileges;
      if (priv && !this.privilegeService.check(action.permission)) return false;
    }
    return true;
  }

  getIcon(name: string): string {
    const icons: Record<string, string> = {
      invoice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      estimate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="9" y1="17" x2="8" y2="17"/></svg>`,
      credit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
      customer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      recurring: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
      purchase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
      bill: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>`,
      expense: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      supplier: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
      product: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
      category: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
      brand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
      price: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      adjustment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
      transfer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
      journal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
      budget: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
      account: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>`,
      employee: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      schedule: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      promotion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
      coupon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    };
    return icons[name] ?? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>`;
  }
}
