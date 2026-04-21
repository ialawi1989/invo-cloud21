import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PrivilegeService } from '../../core/auth/privileges/privilege.service';
import { FeatureService } from '../../core/auth/feature.service';
import { SafeHtmlPipe } from '../../core/pipes/safe-html.pipe';
import { ModalService } from '../../shared/modal/modal.service';
import { withTranslations } from '../../core/i18n/with-translations';

interface SettingItem {
  label:       string;
  description: string;
  link?:       string;
  privilege?:  string;
  feature?:    string;
  popup?:      { component: any; size?: string };
}

interface SettingGroup {
  id:     string;
  title:  string;
  icon:   string;
  color:  string;
  items:  SettingItem[];
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, SafeHtmlPipe],
  template: `
    <div class="settings-page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ 'SETTINGS.TITLE' | translate }}</h1>
          <p class="page-sub">{{ 'SETTINGS.SUBTITLE' | translate }}</p>
        </div>
      </div>

      <!-- Search -->
      <div class="search-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" [placeholder]="'SETTINGS.SEARCH_PLACEHOLDER' | translate"
               class="search-input"
               (input)="onSearch($event)"/>
      </div>

      <!-- Groups grid -->
      <div class="groups-grid">
        @for (group of filteredGroups(); track group.id) {
          @if (group.items.length > 0) {
            <div class="group-card">
              <div class="group-header">
                <div class="group-icon" [style.background]="group.color + '18'">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                       [style.stroke]="group.color" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round"
                       [innerHTML]="group.icon | safeHtml"></svg>
                </div>
                <h3 class="group-title">{{ group.title | translate }}</h3>
              </div>

              <div class="group-items">
                @for (item of group.items; track item.label) {
                  @if (canAccess(item)) {
                    @if (item.link) {
                      <a [routerLink]="item.link" class="setting-item">
                        <div class="item-text">
                          <span class="item-label">{{ item.label | translate }}</span>
                          <span class="item-desc">{{ item.description | translate }}</span>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                             stroke="#cbd5e1" stroke-width="2">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </a>
                    } @else if (item.popup) {
                      <button class="setting-item setting-item--btn" (click)="openPopup(item.popup)">
                        <div class="item-text">
                          <span class="item-label">{{ item.label | translate }}</span>
                          <span class="item-desc">{{ item.description | translate }}</span>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                             stroke="#cbd5e1" stroke-width="2">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </button>
                    }
                  }
                }
              </div>
            </div>
          }
        }
      </div>

    </div>
  `,
  styles: [`
    .settings-page { max-width: 1100px; }

    .page-header { margin-bottom: 20px; }
    .page-title  { font-size: 22px; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
    .page-sub    { font-size: 14px; color: #64748b; margin: 0; }

    .search-bar {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; background: #fff;
      border: 1px solid #e2e8f0; border-radius: 10px;
      margin-bottom: 24px; color: #94a3b8;
    }
    .search-input {
      border: none; outline: none; font-size: 16px;
      color: #1e293b; background: transparent; width: 100%;
      &::placeholder { color: #94a3b8; }
    }

    .groups-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }

    .group-card {
      background: #fff; border-radius: 14px;
      border: 1px solid #e2e8f0; overflow: hidden;
    }
    .group-header {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 18px 12px; border-bottom: 1px solid #f1f5f9;
    }
    .group-icon {
      width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .group-title { font-size: 14px; font-weight: 600; color: #1e293b; margin: 0; }

    .group-items { padding: 4px 0 8px; }
    .setting-item {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 18px; text-decoration: none;
      transition: background .15s; cursor: pointer;
      &:hover { background: #f8fafc; }
      &:hover svg { stroke: #32acc1; }
    }
    .setting-item--btn {
      width: 100%; background: transparent; border: none;
      font-family: inherit; text-align: left;
    }
    .item-text { flex: 1; min-width: 0; }
    .item-label {
      display: block; font-size: 13px; font-weight: 500;
      color: #374151; margin-bottom: 2px;
    }
    .item-desc {
      display: block; font-size: 12px; color: #94a3b8;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
  `]
})
export class SettingsComponent {
  private privilegeService = inject(PrivilegeService);
  private featureService   = inject(FeatureService);
  private modalService     = inject(ModalService);
  private translateSvc     = inject(TranslateService);

  constructor() { withTranslations('settings'); }

  private searchQuery = signal('');

  private allGroups: SettingGroup[] = [
    {
      id: 'company', title: 'SETTINGS.GROUPS.COMPANY', color: '#32acc1',
      icon: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.BUSINESS_SETTINGS',  description: 'SETTINGS.ITEMS.BUSINESS_SETTINGS_DESC',  link: '/settings/business',      privilege: 'companySettingsSecurity.actions.businessSettings.access' },
        { label: 'SETTINGS.ITEMS.ROUNDING_SETTINGS',  description: 'SETTINGS.ITEMS.ROUNDING_SETTINGS_DESC',  link: '/settings/rounding',      privilege: 'companySettingsSecurity.actions.roundingSettings.access' },
        { label: 'SETTINGS.ITEMS.BRANCH_SETTINGS',    description: 'SETTINGS.ITEMS.BRANCH_SETTINGS_DESC',    link: '/settings/branches',      privilege: 'branchSettingsSecurity.access' },
        { label: 'SETTINGS.ITEMS.CUSTOM_FIELDS',      description: 'SETTINGS.ITEMS.CUSTOM_FIELDS_DESC',      link: '/settings/custom-fields', privilege: 'companySettingsSecurity.actions.customFields.access' },
        { label: 'SETTINGS.ITEMS.PREFIX_SETTINGS',    description: 'SETTINGS.ITEMS.PREFIX_SETTINGS_DESC',    link: '/settings/prefix',        privilege: 'prefixSettingsSecurity.actions.view.access' },
      ],
    },
    {
      id: 'products', title: 'SETTINGS.GROUPS.PRODUCTS', color: '#14b8a6',
      icon: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.PRODUCTS_TAB_BUILDER', description: 'SETTINGS.ITEMS.PRODUCTS_TAB_BUILDER_DESC', link: '/settings/tab-builder', privilege: 'tabBuilderSecurity.access' },
      ],
    },
    {
      id: 'pos', title: 'SETTINGS.GROUPS.POS', color: '#6366f1',
      icon: `<rect x="2" y="8" width="20" height="12" rx="2"/><rect x="6" y="12" width="12" height="2" rx="1"/><rect x="6" y="16" width="8" height="1" rx="0.5"/><rect x="7" y="3" width="10" height="3" rx="1"/><circle cx="19" cy="5" r="1"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.POS_OPTIONS',      description: 'SETTINGS.ITEMS.POS_OPTIONS_DESC',      link: '/settings/pos-options',     privilege: 'companySettingsSecurity.actions.businessSettings.access' },
        { label: 'SETTINGS.ITEMS.KITCHEN_SECTION',  description: 'SETTINGS.ITEMS.KITCHEN_SECTION_DESC',  link: '/settings/kitchen',         privilege: 'kitchenSectionSecurity.actions.view.access' },
        { label: 'SETTINGS.ITEMS.TABLE_MANAGEMENT', description: 'SETTINGS.ITEMS.TABLE_MANAGEMENT_DESC', link: '/settings/tables',          privilege: 'tableManagmentSecurity.access' },
        { label: 'SETTINGS.ITEMS.MENU_BUILDER',     description: 'SETTINGS.ITEMS.MENU_BUILDER_DESC',     link: '/settings/menu-builder',    privilege: 'menuBuilderSecurity.actions.view.access' },
        { label: 'SETTINGS.ITEMS.RECEIPT_BUILDER',  description: 'SETTINGS.ITEMS.RECEIPT_BUILDER_DESC',  link: '/settings/receipt-builder', privilege: 'recieptBuilderSecurity.actions.view.access' },
      ],
    },
    {
      id: 'invoice', title: 'SETTINGS.GROUPS.INVOICE', color: '#10b981',
      icon: `<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.INVOICE_BUILDER', description: 'SETTINGS.ITEMS.INVOICE_BUILDER_DESC', link: '/settings/invoice-builder', privilege: 'invoiceBuilderSecurity.access' },
        { label: 'SETTINGS.ITEMS.INVOICE_OPTIONS', description: 'SETTINGS.ITEMS.INVOICE_OPTIONS_DESC', link: '/settings/invoice-options', privilege: 'companySettingsSecurity.actions.invoiceOptions.access' },
      ],
    },
    {
      id: 'estimate', title: 'SETTINGS.GROUPS.ESTIMATE', color: '#10b981',
      icon: `<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.ESTIMATE_BUILDER', description: 'SETTINGS.ITEMS.ESTIMATE_BUILDER_DESC', link: '/settings/estimate-builder', privilege: 'estimateBuilderSecurity.access' },
      ],
    },
    {
      id: 'expense', title: 'SETTINGS.GROUPS.EXPENSE', color: '#f59e0b',
      icon: `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.EXPENSE_BUILDER', description: 'SETTINGS.ITEMS.EXPENSE_BUILDER_DESC', link: '/settings/expense-builder', privilege: 'expenseBuilderSecurity.access' },
      ],
    },
    {
      id: 'purchase', title: 'SETTINGS.GROUPS.PURCHASE', color: '#f59e0b',
      icon: `<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.PURCHASE_ORDER_BUILDER', description: 'SETTINGS.ITEMS.PURCHASE_ORDER_BUILDER_DESC', link: '/settings/purchase-order-builder', privilege: 'purchaseOrderBuilderSecurity.access' },
      ],
    },
    {
      id: 'bill', title: 'SETTINGS.GROUPS.BILL', color: '#8b5cf6',
      icon: `<path d="M4 2v20l3-3 2.5 3L12 19l2.5 3L17 19l3 3V2z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.BILL_BUILDER', description: 'SETTINGS.ITEMS.BILL_BUILDER_DESC', link: '/settings/bill-builder', privilege: 'billBuilderSecurity.access' },
      ],
    },
    {
      id: 'tax', title: 'SETTINGS.GROUPS.TAX', color: '#ef4444',
      icon: `<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 3.9 2.4-7.4L2 9.4h7.6z"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.MANAGE_TAX', description: 'SETTINGS.ITEMS.MANAGE_TAX_DESC', link: '/settings/tax', privilege: 'taxSecurity.actions.view.access' },
      ],
    },
    {
      id: 'pricing', title: 'SETTINGS.GROUPS.PRICING', color: '#f97316',
      icon: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.LABEL_BUILDER',  description: 'SETTINGS.ITEMS.LABEL_BUILDER_DESC',  link: '/settings/label-builder', privilege: 'labelBuilderSecurity.actions.view.access' },
        { label: 'SETTINGS.ITEMS.PRICE_LABEL',    description: 'SETTINGS.ITEMS.PRICE_LABEL_DESC',    link: '/settings/price-label',   privilege: 'priceLabelSecurity.actions.view.access' },
        { label: 'SETTINGS.ITEMS.SURCHARGE',      description: 'SETTINGS.ITEMS.SURCHARGE_DESC',      link: '/settings/surcharge',     privilege: 'surchargeSecurity.actions.view.access' },
      ],
    },
    {
      id: 'shipping', title: 'SETTINGS.GROUPS.SHIPPING', color: '#0ea5e9',
      icon: `<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.COVERED_ADDRESS',  description: 'SETTINGS.ITEMS.COVERED_ADDRESS_DESC',  link: '/settings/covered-address',  privilege: 'coveredAddress.actions.view.access' },
        { label: 'SETTINGS.ITEMS.COVERED_ZONE',     description: 'SETTINGS.ITEMS.COVERED_ZONE_DESC',     link: '/settings/covered-zone',     privilege: 'coveredZone.actions.view.access' },
        { label: 'SETTINGS.ITEMS.SHIPPING',         description: 'SETTINGS.ITEMS.SHIPPING_DESC',         link: '/settings/shipping',         privilege: 'coveredZone.actions.view.access', feature: 'shipping' },
        { label: 'SETTINGS.ITEMS.SHIPPING_OPTIONS', description: 'SETTINGS.ITEMS.SHIPPING_OPTIONS_DESC', link: '/settings/shipping-options', privilege: 'coveredZone.actions.view.access', feature: 'shipping' },
      ],
    },
    {
      id: 'promotion', title: 'SETTINGS.GROUPS.PROMOTION', color: '#ec4899',
      icon: `<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.DISCOUNT', description: 'SETTINGS.ITEMS.DISCOUNT_DESC', link: '/settings/discounts', privilege: 'discountSecurity.actions.view.access', feature: 'promotions' },
      ],
    },
    {
      id: 'other', title: 'SETTINGS.GROUPS.OTHER', color: '#64748b',
      icon: `<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.PAYMENT_METHODS',    description: 'SETTINGS.ITEMS.PAYMENT_METHODS_DESC',    link: '/settings/payment-methods', privilege: 'paymentMethodSecurity.actions.view.access' },
        { label: 'SETTINGS.ITEMS.SERVICE_MANAGEMENT', description: 'SETTINGS.ITEMS.SERVICE_MANAGEMENT_DESC', link: '/settings/services',        privilege: 'serviceSecurity.actions.view.access' },
        { label: 'SETTINGS.ITEMS.IMPORT_FROM_INVO',   description: 'SETTINGS.ITEMS.IMPORT_FROM_INVO_DESC',   privilege: 'companySettingsSecurity.access',
          popup: { component: () => import('./components/import-from-invo/import-from-invo.component').then(m => m.ImportFromInvoComponent), size: 'md' } },
      ],
    },
  ];

  filteredGroups = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.allGroups.map(g => ({
      ...g,
      items: g.items.filter(i => this.canAccess(i))
    }));
    return this.allGroups.map(g => ({
      ...g,
      items: g.items.filter(i =>
        this.canAccess(i) &&
        (this.t(i.label).toLowerCase().includes(q) ||
         this.t(i.description).toLowerCase().includes(q))
      )
    })).filter(g => g.items.length > 0);
  });

  canAccess(item: SettingItem): boolean {
    if (item.feature && !this.featureService.isEnabled(item.feature)) return false;
    if (!item.privilege) return true;
    if (!this.privilegeService.privileges) return true;
    return this.privilegeService.check(item.privilege);
  }

  onSearch(e: Event): void {
    this.searchQuery.set((e.target as HTMLInputElement).value);
  }

  async openPopup(popup: { component: any; size?: string }): Promise<void> {
    const component = typeof popup.component === 'function'
      ? await popup.component()
      : popup.component;
    this.modalService.open(component, { size: (popup.size as any) ?? 'md', closeOnBackdrop: true });
  }

  private t(key: string): string {
    return this.translateSvc.instant(key);
  }
}
