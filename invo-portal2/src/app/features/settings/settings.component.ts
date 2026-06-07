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
  /** Optional query params merged onto the routerLink. Used to deep-
   *  link into a generic page filtered by context (e.g. all the
   *  document-builder tiles share the same route, distinguished by
   *  `?type=invoice|estimate|…`). */
  queryParams?: Record<string, string>;
  privilege?:  string;
  feature?:    string;
  popup?:      { component: any; size?: string };
  /** i18n namespace prefix for this tile's destination. The settings
   *  search walks every translation under this prefix and folds it
   *  into the matcher's corpus — so any phrase visible inside the
   *  destination page (card subtitles, field hints, etc.) surfaces
   *  the tile without us having to hand-curate keyword lists.
   *
   *  Example: `i18nPrefix: 'SETTINGS.BUSINESS'` means typing "how
   *  your business appears" matches Business Settings, because the
   *  Identity card's `SETTINGS.BUSINESS.IDENTITY_DESC` translation
   *  contains that phrase. */
  i18nPrefix?: string;
}

interface SettingGroup {
  id:     string;
  title:  string;
  icon:   string;
  color:  string;
  items:  SettingItem[];
}

/**
 * Bounded Levenshtein distance — returns `-1` as soon as the cost
 * exceeds `budget`, which lets the caller skip the inner allocation
 * for obviously-too-different word pairs. Used by the settings
 * search "Did you mean …" suggestion; an unbounded variant would
 * be wasteful when we already know we'll reject anything > N edits.
 */
function levenshtein(a: string, b: string, budget: number): number {
  if (Math.abs(a.length - b.length) > budget) return -1;
  if (a === b) return 0;
  const m = a.length, n = b.length;
  // Two-row buffer is enough — classic space-optimised LD.
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // deletion
        curr[j - 1] + 1,    // insertion
        prev[j - 1] + cost, // substitution
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    // Early exit — if every cell in this row already exceeds the
    // budget, no later row can drop back below it.
    if (rowMin > budget) return -1;
    [prev, curr] = [curr, prev];
  }
  return prev[n] <= budget ? prev[n] : -1;
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
        <svg class="search-bar__icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" [placeholder]="'SETTINGS.SEARCH_PLACEHOLDER' | translate"
               class="search-input"
               [value]="searchValue()"
               (input)="onSearch($event)"/>
        @if (searchValue()) {
          <button type="button" class="search-bar__clear"
                  (click)="clearSearch()"
                  [attr.aria-label]="'COMMON.CLEAR' | translate">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6"  y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        }
      </div>

      <!-- Did-you-mean hint — rendered only when the typed query
           returned no results AND we found a similar word in the
           settings corpus within a small edit-distance budget. -->
      @if (searchSuggestion(); as s) {
        <p class="search-hint">
          <span class="search-hint__prefix">{{ 'SETTINGS.SEARCH_DID_YOU_MEAN' | translate }}</span>
          <button type="button" class="search-hint__link" (click)="applySearchSuggestion()">{{ s }}</button><span class="search-hint__q">?</span>
        </p>
      }

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
                      <a [routerLink]="item.link" [queryParams]="item.queryParams ?? null" class="setting-item">
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
      margin-bottom: 8px; color: #94a3b8;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .search-bar:focus-within {
      border-color: var(--color-brand-400, #7dd3fc);
      box-shadow: 0 0 0 3px rgba(50, 172, 193, 0.12);
    }
    .search-bar__icon { flex-shrink: 0; }
    .search-bar__clear {
      flex-shrink: 0;
      appearance: none;
      background: transparent;
      border: 0;
      padding: 4px;
      border-radius: 6px;
      color: #94a3b8;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 120ms ease, color 120ms ease;
    }
    .search-bar__clear:hover { background: #f1f5f9; color: #0f172a; }

    .search-input {
      border: none; outline: none; font-size: 16px;
      color: #1e293b; background: transparent; width: 100%;
      &::placeholder { color: #94a3b8; }
    }

    /* "Did you mean …" — gray prefix + bold italic brand-coloured
       suggestion link. Matches the second design reference. */
    .search-hint {
      margin: 0 0 24px;
      font-size: 14px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    .search-hint__prefix { color: #64748b; }
    .search-hint__q      { color: #64748b; }
    .search-hint__link {
      appearance: none;
      background: transparent;
      border: 0;
      padding: 0;
      font: inherit;
      font-style: italic;
      font-weight: 700;
      color: var(--color-brand-700, #0e7490);
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 3px;
      text-decoration-thickness: 1.5px;
      transition: color 120ms ease;
    }
    .search-hint__link:hover { color: var(--color-brand-800, #155e75); }

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
  /** Public read-only view bound to the search input's `[value]`, so
   *  accepting a "Did you mean …" suggestion updates the visible
   *  text without manually round-tripping through the DOM. */
  readonly searchValue = this.searchQuery.asReadonly();

  private allGroups: SettingGroup[] = [
    {
      id: 'company', title: 'SETTINGS.GROUPS.COMPANY', color: '#32acc1',
      icon: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
      items: [
        // Business Settings now folds in identity + locale + currency +
        // rounding + tax in one page, so the standalone "Rounding Settings"
        // link is dropped — rounding lives under Locale & Currency there.
        { label: 'SETTINGS.ITEMS.BUSINESS_SETTINGS',  description: 'SETTINGS.ITEMS.BUSINESS_SETTINGS_DESC',  link: '/settings/business',      privilege: 'companySettingsSecurity.actions.businessSettings.access',
          i18nPrefix: 'SETTINGS.BUSINESS' },
        { label: 'SETTINGS.ITEMS.BRANCH_SETTINGS',    description: 'SETTINGS.ITEMS.BRANCH_SETTINGS_DESC',    link: '/settings/branches',      privilege: 'branchSettingsSecurity.access',
          i18nPrefix: 'SETTINGS.BRANCHES' },
        { label: 'SETTINGS.ITEMS.CUSTOM_FIELDS',      description: 'SETTINGS.ITEMS.CUSTOM_FIELDS_DESC',      link: '/settings/custom-fields', privilege: 'companySettingsSecurity.actions.customFields.access',
          i18nPrefix: 'SETTINGS.CUSTOM_FIELDS' },
        { label: 'SETTINGS.ITEMS.PREFIX_SETTINGS',    description: 'SETTINGS.ITEMS.PREFIX_SETTINGS_DESC',    link: '/settings/prefix',        privilege: 'prefixSettingsSecurity.actions.view.access',
          i18nPrefix: 'SETTINGS.PREFIX' },
      ],
    },
    {
      id: 'products', title: 'SETTINGS.GROUPS.PRODUCTS', color: '#14b8a6',
      icon: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.PRODUCTS_TAB_BUILDER', description: 'SETTINGS.ITEMS.PRODUCTS_TAB_BUILDER_DESC', link: '/settings/tab-builder', privilege: 'tabBuilderSecurity.access',
          i18nPrefix: 'SETTINGS.TAB_BUILDER' },
      ],
    },
    {
      id: 'media', title: 'SETTINGS.GROUPS.MEDIA', color: '#a855f7',
      icon: `<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.MEDIA_MANAGER', description: 'SETTINGS.ITEMS.MEDIA_MANAGER_DESC', link: '/settings/media', privilege: 'mediaSettingsSecurity.actions.view.access',
          i18nPrefix: 'MEDIA' },
        { label: 'SETTINGS.ITEMS.IMAGE_DISPLAY', description: 'SETTINGS.ITEMS.IMAGE_DISPLAY_DESC', link: '/settings/image-display', privilege: 'mediaSettingsSecurity.actions.view.access',
          i18nPrefix: 'SETTINGS.IMAGE_DISPLAY' },
      ],
    },
    {
      // Site, Domain & SEO — the website-facing IA. Customer-facing
      // surface settings live here (SEO meta tags now; later: domain,
      // custom DNS, social-link footer, robots.txt, sitemap toggles).
      id: 'siteSeo', title: 'SETTINGS.GROUPS.SITE_SEO', color: '#3b82f6',
      icon: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.SEO_SETTINGS', description: 'SETTINGS.ITEMS.SEO_SETTINGS_DESC', link: '/settings/seo', privilege: 'companySettingsSecurity.actions.businessSettings.access',
          i18nPrefix: 'SEO' },
      ],
    },
    {
      id: 'pos', title: 'SETTINGS.GROUPS.POS', color: '#6366f1',
      icon: `<rect x="2" y="8" width="20" height="12" rx="2"/><rect x="6" y="12" width="12" height="2" rx="1"/><rect x="6" y="16" width="8" height="1" rx="0.5"/><rect x="7" y="3" width="10" height="3" rx="1"/><circle cx="19" cy="5" r="1"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.POS_OPTIONS',      description: 'SETTINGS.ITEMS.POS_OPTIONS_DESC',      link: '/settings/pos-options',     privilege: 'companySettingsSecurity.actions.businessSettings.access',
          i18nPrefix: 'SETTINGS.POS_OPTIONS' },
        { label: 'SETTINGS.ITEMS.KITCHEN_SECTION',  description: 'SETTINGS.ITEMS.KITCHEN_SECTION_DESC',  link: '/settings/kitchen',         privilege: 'kitchenSectionSecurity.actions.view.access',
          i18nPrefix: 'SETTINGS.KITCHEN' },
        { label: 'SETTINGS.ITEMS.TABLE_MANAGEMENT', description: 'SETTINGS.ITEMS.TABLE_MANAGEMENT_DESC', link: '/settings/tables',          privilege: 'tableManagmentSecurity.access',
          i18nPrefix: 'SETTINGS.TABLES' },
        { label: 'SETTINGS.ITEMS.MENU_BUILDER',     description: 'SETTINGS.ITEMS.MENU_BUILDER_DESC',     link: '/settings/menu-builder',    privilege: 'menuBuilderSecurity.actions.view.access',
          i18nPrefix: 'MENU_BUILDER' },
        { label: 'SETTINGS.ITEMS.RECEIPT_BUILDER',  description: 'SETTINGS.ITEMS.RECEIPT_BUILDER_DESC',  link: '/settings/receipt-builder', privilege: 'recieptBuilderSecurity.actions.view.access',
          i18nPrefix: 'RECEIPT_BUILDER' },
        { label: 'SETTINGS.ITEMS.LABEL_BUILDER',    description: 'SETTINGS.ITEMS.LABEL_BUILDER_DESC',    link: '/settings/label-builder',   privilege: 'labelBuilderSecurity.actions.view.access',
          i18nPrefix: 'LABEL_BUILDER' },
        { label: 'SETTINGS.ITEMS.PRICE_LABEL',      description: 'SETTINGS.ITEMS.PRICE_LABEL_DESC',      link: '/settings/price-label',     privilege: 'priceLabelSecurity.actions.view.access',
          i18nPrefix: 'PRICE_LABEL' },
      ],
    },
    {
      id: 'invoice', title: 'SETTINGS.GROUPS.INVOICE', color: '#10b981',
      icon: `<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
      items: [
        // All entity-builder tiles route into the unified document-builder
        // filtered by ?type — the builder itself shows tabs for every doc
        // type so the user can switch within the same surface.
        { label: 'SETTINGS.ITEMS.INVOICE_BUILDER', description: 'SETTINGS.ITEMS.INVOICE_BUILDER_DESC', link: '/settings/document-builder', queryParams: { type: 'invoice' }, privilege: 'invoiceBuilderSecurity.access',
          i18nPrefix: 'DOCUMENT_BUILDER' },
        { label: 'SETTINGS.ITEMS.CREDIT_NOTE_BUILDER', description: 'SETTINGS.ITEMS.CREDIT_NOTE_BUILDER_DESC', link: '/settings/document-builder', queryParams: { type: 'credit-note' }, privilege: 'invoiceBuilderSecurity.access',
          i18nPrefix: 'DOCUMENT_BUILDER' },
        { label: 'SETTINGS.ITEMS.INVOICE_OPTIONS', description: 'SETTINGS.ITEMS.INVOICE_OPTIONS_DESC', link: '/settings/invoice-options', privilege: 'companySettingsSecurity.actions.invoiceOptions.access',
          i18nPrefix: 'SETTINGS.INVOICE' },
      ],
    },
    {
      id: 'estimate', title: 'SETTINGS.GROUPS.ESTIMATE', color: '#10b981',
      icon: `<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.ESTIMATE_BUILDER', description: 'SETTINGS.ITEMS.ESTIMATE_BUILDER_DESC', link: '/settings/document-builder', queryParams: { type: 'estimate' }, privilege: 'estimateBuilderSecurity.access',
          i18nPrefix: 'DOCUMENT_BUILDER' },
      ],
    },
    {
      id: 'expense', title: 'SETTINGS.GROUPS.EXPENSE', color: '#f59e0b',
      icon: `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.EXPENSE_BUILDER', description: 'SETTINGS.ITEMS.EXPENSE_BUILDER_DESC', link: '/settings/document-builder', queryParams: { type: 'expense' }, privilege: 'expenseBuilderSecurity.access',
          i18nPrefix: 'DOCUMENT_BUILDER' },
      ],
    },
    {
      id: 'purchase', title: 'SETTINGS.GROUPS.PURCHASE', color: '#f59e0b',
      icon: `<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.PURCHASE_ORDER_BUILDER', description: 'SETTINGS.ITEMS.PURCHASE_ORDER_BUILDER_DESC', link: '/settings/document-builder', queryParams: { type: 'purchase-order' }, privilege: 'purchaseOrderBuilderSecurity.access',
          i18nPrefix: 'DOCUMENT_BUILDER' },
      ],
    },
    {
      id: 'bill', title: 'SETTINGS.GROUPS.BILL', color: '#8b5cf6',
      icon: `<path d="M4 2v20l3-3 2.5 3L12 19l2.5 3L17 19l3 3V2z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.BILL_BUILDER', description: 'SETTINGS.ITEMS.BILL_BUILDER_DESC', link: '/settings/document-builder', queryParams: { type: 'bill' }, privilege: 'billBuilderSecurity.access',
          i18nPrefix: 'DOCUMENT_BUILDER' },
        { label: 'SETTINGS.ITEMS.SUPPLIER_CREDIT_BUILDER', description: 'SETTINGS.ITEMS.SUPPLIER_CREDIT_BUILDER_DESC', link: '/settings/document-builder', queryParams: { type: 'supplier-credit' }, privilege: 'billBuilderSecurity.access',
          i18nPrefix: 'DOCUMENT_BUILDER' },
      ],
    },
    {
      id: 'tax', title: 'SETTINGS.GROUPS.TAX', color: '#ef4444',
      icon: `<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 3.9 2.4-7.4L2 9.4h7.6z"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.MANAGE_TAX', description: 'SETTINGS.ITEMS.MANAGE_TAX_DESC', link: '/settings/tax', privilege: 'taxSecurity.actions.view.access',
          i18nPrefix: 'SETTINGS.TAX' },
      ],
    },
    {
      id: 'pricing', title: 'SETTINGS.GROUPS.PRICING', color: '#f97316',
      icon: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.LABEL_BUILDER',  description: 'SETTINGS.ITEMS.LABEL_BUILDER_DESC',  link: '/settings/label-builder', privilege: 'labelBuilderSecurity.actions.view.access',
          i18nPrefix: 'LABEL_BUILDER' },
        { label: 'SETTINGS.ITEMS.PRICE_LABEL',    description: 'SETTINGS.ITEMS.PRICE_LABEL_DESC',    link: '/settings/price-label',   privilege: 'priceLabelSecurity.actions.view.access',
          i18nPrefix: 'PRICE_LABEL' },
        { label: 'SETTINGS.ITEMS.SURCHARGE',      description: 'SETTINGS.ITEMS.SURCHARGE_DESC',      link: '/settings/surcharge',     privilege: 'surchargeSecurity.actions.view.access',
          i18nPrefix: 'SURCHARGE' },
      ],
    },
    {
      id: 'shipping', title: 'SETTINGS.GROUPS.SHIPPING', color: '#0ea5e9',
      icon: `<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>`,
      items: [
        // Single hub page — picks between shipping (country zones),
        // delivery-by-address, and delivery-by-radius, then embeds
        // the matching editor. Supersedes the four separate tiles
        // (Covered Address, Covered Zone, Shipping, Shipping Options).
        { label: 'SETTINGS.ITEMS.SHIPPING_DELIVERY', description: 'SETTINGS.ITEMS.SHIPPING_DELIVERY_DESC', link: '/settings/shipping-delivery', privilege: 'coveredAddress.actions.view.access',
          i18nPrefix: 'SHIPPING_DELIVERY' },
      ],
    },
    {
      id: 'promotion', title: 'SETTINGS.GROUPS.PROMOTION', color: '#ec4899',
      icon: `<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.DISCOUNT', description: 'SETTINGS.ITEMS.DISCOUNT_DESC', link: '/settings/discounts', privilege: 'discountSecurity.actions.view.access', feature: 'promotions',
          i18nPrefix: 'DISCOUNT' },
      ],
    },
    {
      id: 'other', title: 'SETTINGS.GROUPS.OTHER', color: '#64748b',
      icon: `<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>`,
      items: [
        { label: 'SETTINGS.ITEMS.PAYMENT_METHODS',    description: 'SETTINGS.ITEMS.PAYMENT_METHODS_DESC',    link: '/settings/payment-methods', privilege: 'paymentMethodSecurity.actions.view.access',
          i18nPrefix: 'PAYMENT_METHODS' },
        { label: 'SETTINGS.ITEMS.SERVICE_MANAGEMENT', description: 'SETTINGS.ITEMS.SERVICE_MANAGEMENT_DESC', link: '/settings/service-management', privilege: 'serviceSecurity.actions.view.access',
          i18nPrefix: 'SERVICE_MANAGEMENT' },
        { label: 'SETTINGS.ITEMS.PLUGINS', description: 'SETTINGS.ITEMS.PLUGINS_DESC', link: '/settings/plugins', privilege: 'pluginsSecurity.actions.view.access',
          i18nPrefix: 'PLUGINS' },
        { label: 'SETTINGS.ITEMS.IMPORT_FROM_INVO',   description: 'SETTINGS.ITEMS.IMPORT_FROM_INVO_DESC',   privilege: 'companySettingsSecurity.access',
          i18nPrefix: 'SETTINGS.IMPORT_FROM_INVO',
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
        this.canAccess(i) && this.matchesItem(i, q)
      )
    })).filter(g => g.items.length > 0);
  });

  /** Build the search corpus for a tile — visible label/description
   *  plus any extra `searchKeys` translated and folded into a single
   *  lowercase haystack. Splitting the check into its own helper
   *  keeps the `filteredGroups` body readable while the corpus grows
   *  with more pages.
   *
   *  Token-AND semantics: every whitespace-separated word in the
   *  query must appear *somewhere* in the corpus. That lets a search
   *  like "branch name" match a tile whose title is "Branch Settings"
   *  and whose searchKey contains "Branch name", even though neither
   *  text contains the exact phrase. */
  private matchesItem(item: SettingItem, q: string): boolean {
    if (!q) return true;
    const corpus = this.itemCorpus(item);
    for (const tok of q.split(/\s+/)) {
      if (tok && !corpus.includes(tok)) return false;
    }
    return true;
  }

  /** Concatenate the tile's translated label + description + every
   *  leaf translation under `i18nPrefix` into one lowercase string.
   *  Built lazily per call — the i18n dictionary is in-memory so
   *  walking a sub-tree is cheap. */
  private itemCorpus(item: SettingItem): string {
    const parts: string[] = [
      this.t(item.label),
      this.t(item.description),
    ];
    if (item.i18nPrefix) {
      this.collectLeaves(this.lookupTree(item.i18nPrefix), parts);
    }
    return parts.join(' ').toLowerCase();
  }

  /** Resolve a dot-separated i18n prefix to the nested object that
   *  holds its sub-keys. Returns `null` when the path doesn't exist
   *  in the current language (e.g. feature namespace not yet loaded). */
  private lookupTree(prefix: string): unknown {
    const lang = this.translateSvc.currentLang ?? this.translateSvc.getFallbackLang();
    const dict = (this.translateSvc as any).store?.translations?.[lang ?? ''];
    if (!dict || typeof dict !== 'object') return null;
    let node: unknown = dict;
    for (const seg of prefix.split('.')) {
      if (node && typeof node === 'object' && seg in (node as Record<string, unknown>)) {
        node = (node as Record<string, unknown>)[seg];
      } else {
        return null;
      }
    }
    return node;
  }

  /** Recursively push every string leaf of `node` into `out`. */
  private collectLeaves(node: unknown, out: string[]): void {
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (node && typeof node === 'object') {
      for (const v of Object.values(node as Record<string, unknown>)) {
        this.collectLeaves(v, out);
      }
    }
  }

  /** "Did you mean …" suggestion shown when the search returns zero
   *  results. Walks every tile's corpus (label + description +
   *  searchKeys), tokenises into individual words, and picks the
   *  closest word to each typed token by Levenshtein distance.
   *  Returns `null` when nothing close enough is found so the
   *  template can hide the suggestion entirely. */
  searchSuggestion = computed<string | null>(() => {
    const q = this.searchQuery().trim();
    if (!q || this.filteredGroups().some(g => g.items.length > 0)) return null;

    // Build the corpus of unique words from every accessible tile.
    // Source: each tile's `itemCorpus` (label + description + every
    // leaf string under `i18nPrefix`) — same haystack the matcher
    // uses, so suggestions can only ever be words that would
    // actually surface a real tile.
    const corpus = new Set<string>();
    for (const g of this.allGroups) {
      for (const i of g.items) {
        if (!this.canAccess(i)) continue;
        for (const w of this.itemCorpus(i).split(/\s+/)) {
          const clean = w.replace(/[^a-z0-9؀-ۿ]/gi, '');
          if (clean.length >= 3) corpus.add(clean);
        }
      }
    }

    // For each typed word, find the closest corpus word within a small
    // edit-distance budget. Threshold scales with word length so short
    // tokens get tighter matching (no point suggesting "bus" for "set").
    const out: string[] = [];
    let changed = false;
    for (const w of q.split(/\s+/)) {
      const lower = w.toLowerCase();
      if (lower.length < 3 || corpus.has(lower)) {
        out.push(w);
        continue;
      }
      const budget = Math.max(1, Math.floor(lower.length / 4));
      let best: { word: string; dist: number } | null = null;
      for (const c of corpus) {
        // Skip words wildly different in length — cheap pre-filter.
        if (Math.abs(c.length - lower.length) > budget) continue;
        const d = levenshtein(lower, c, budget);
        if (d < 0) continue;
        if (!best || d < best.dist) best = { word: c, dist: d };
        if (best.dist === 0) break;
      }
      if (best && best.dist > 0 && best.dist <= budget) {
        out.push(best.word);
        changed = true;
      } else {
        out.push(w);
      }
    }
    return changed ? out.join(' ') : null;
  });

  /** Accept the current "Did you mean …" suggestion. */
  applySearchSuggestion(): void {
    const s = this.searchSuggestion();
    if (s) this.searchQuery.set(s);
  }

  canAccess(item: SettingItem): boolean {
    if (item.feature && !this.featureService.isEnabled(item.feature)) return false;
    if (!item.privilege) return true;
    if (!this.privilegeService.privileges) return true;
    return this.privilegeService.check(item.privilege);
  }

  onSearch(e: Event): void {
    this.searchQuery.set((e.target as HTMLInputElement).value);
  }

  /** Wipe the search input. The `[value]` binding on the input is
   *  signal-driven, so resetting `searchQuery` immediately empties
   *  the DOM field too. */
  clearSearch(): void {
    this.searchQuery.set('');
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
