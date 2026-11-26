// Single source of truth for the Settings landing tiles. Consumed by the Settings page
// and by the top-bar global search, so a new tile is searchable the moment it is added.

export interface SettingItem {
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

export interface SettingGroup {
  id:     string;
  /** i18n key of the heading this group is listed under in the settings menu (SETTINGS.SECTIONS.*). */
  section?: string;
  title:  string;
  icon:   string;
  color:  string;
  items:  SettingItem[];
}

export const SETTINGS_GROUPS: SettingGroup[] = [
  {
    id: 'company', section: 'SETTINGS.SECTIONS.BUSINESS_SETUP', title: 'SETTINGS.GROUPS.COMPANY', color: '#32acc1',
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
      { label: 'SETTINGS.ITEMS.COMMISSION_SETTINGS', description: 'SETTINGS.ITEMS.COMMISSION_SETTINGS_DESC', link: '/settings/commission-settings', privilege: 'companySettingsSecurity.actions.businessSettings.access',
        i18nPrefix: 'COMMISSION_SETTINGS' },
    ],
  },
  {
    id: 'products', section: 'SETTINGS.SECTIONS.BUSINESS_SETUP', title: 'SETTINGS.GROUPS.PRODUCTS', color: '#14b8a6',
    icon: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>`,
    items: [
      { label: 'SETTINGS.ITEMS.PRODUCTS_TAB_BUILDER', description: 'SETTINGS.ITEMS.PRODUCTS_TAB_BUILDER_DESC', link: '/settings/tab-builder', privilege: 'tabBuilderSecurity.access',
        i18nPrefix: 'SETTINGS.TAB_BUILDER' },
    ],
  },
  {
    id: 'media', section: 'SETTINGS.SECTIONS.BUSINESS_SETUP', title: 'SETTINGS.GROUPS.MEDIA', color: '#a855f7',
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
    id: 'siteSeo', section: 'SETTINGS.SECTIONS.BUSINESS_SETUP', title: 'SETTINGS.GROUPS.SITE_SEO', color: '#3b82f6',
    icon: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
    items: [
      { label: 'SETTINGS.ITEMS.SEO_SETTINGS', description: 'SETTINGS.ITEMS.SEO_SETTINGS_DESC', link: '/settings/seo', privilege: 'companySettingsSecurity.actions.businessSettings.access',
        i18nPrefix: 'SEO' },
      { label: 'SETTINGS.ITEMS.TRANSLATIONS', description: 'SETTINGS.ITEMS.TRANSLATIONS_DESC', link: '/settings/translations',
        i18nPrefix: 'TRANSLATIONS' },
    ],
  },
  {
    id: 'pos', section: 'SETTINGS.SECTIONS.SALES_POS', title: 'SETTINGS.GROUPS.POS', color: '#6366f1',
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
    id: 'invoice', section: 'SETTINGS.SECTIONS.SALES_POS', title: 'SETTINGS.GROUPS.INVOICE', color: '#10b981',
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
    id: 'estimate', section: 'SETTINGS.SECTIONS.SALES_POS', title: 'SETTINGS.GROUPS.ESTIMATE', color: '#10b981',
    icon: `<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`,
    items: [
      { label: 'SETTINGS.ITEMS.ESTIMATE_BUILDER', description: 'SETTINGS.ITEMS.ESTIMATE_BUILDER_DESC', link: '/settings/document-builder', queryParams: { type: 'estimate' }, privilege: 'estimateBuilderSecurity.access',
        i18nPrefix: 'DOCUMENT_BUILDER' },
      { label: 'SETTINGS.ITEMS.ESTIMATE_OPTIONS', description: 'SETTINGS.ITEMS.ESTIMATE_OPTIONS_DESC', link: '/settings/estimate-options', privilege: 'companySettingsSecurity.actions.estimateOptions.access',
        i18nPrefix: 'SETTINGS.ESTIMATE' },
    ],
  },
  {
    id: 'expense', section: 'SETTINGS.SECTIONS.PURCHASING_FINANCE', title: 'SETTINGS.GROUPS.EXPENSE', color: '#f59e0b',
    icon: `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
    items: [
      { label: 'SETTINGS.ITEMS.EXPENSE_BUILDER', description: 'SETTINGS.ITEMS.EXPENSE_BUILDER_DESC', link: '/settings/document-builder', queryParams: { type: 'expense' }, privilege: 'expenseBuilderSecurity.access',
        i18nPrefix: 'DOCUMENT_BUILDER' },
    ],
  },
  {
    id: 'purchase', section: 'SETTINGS.SECTIONS.PURCHASING_FINANCE', title: 'SETTINGS.GROUPS.PURCHASE', color: '#f59e0b',
    icon: `<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>`,
    items: [
      { label: 'SETTINGS.ITEMS.PURCHASE_ORDER_BUILDER', description: 'SETTINGS.ITEMS.PURCHASE_ORDER_BUILDER_DESC', link: '/settings/document-builder', queryParams: { type: 'purchase-order' }, privilege: 'purchaseOrderBuilderSecurity.access',
        i18nPrefix: 'DOCUMENT_BUILDER' },
    ],
  },
  {
    id: 'bill', section: 'SETTINGS.SECTIONS.PURCHASING_FINANCE', title: 'SETTINGS.GROUPS.BILL', color: '#8b5cf6',
    icon: `<path d="M4 2v20l3-3 2.5 3L12 19l2.5 3L17 19l3 3V2z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/>`,
    items: [
      { label: 'SETTINGS.ITEMS.BILL_BUILDER', description: 'SETTINGS.ITEMS.BILL_BUILDER_DESC', link: '/settings/document-builder', queryParams: { type: 'bill' }, privilege: 'billBuilderSecurity.access',
        i18nPrefix: 'DOCUMENT_BUILDER' },
      { label: 'SETTINGS.ITEMS.SUPPLIER_CREDIT_BUILDER', description: 'SETTINGS.ITEMS.SUPPLIER_CREDIT_BUILDER_DESC', link: '/settings/document-builder', queryParams: { type: 'supplier-credit' }, privilege: 'billBuilderSecurity.access',
        i18nPrefix: 'DOCUMENT_BUILDER' },
    ],
  },
  {
    id: 'tax', section: 'SETTINGS.SECTIONS.PURCHASING_FINANCE', title: 'SETTINGS.GROUPS.TAX', color: '#ef4444',
    icon: `<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 3.9 2.4-7.4L2 9.4h7.6z"/>`,
    items: [
      { label: 'SETTINGS.ITEMS.MANAGE_TAX', description: 'SETTINGS.ITEMS.MANAGE_TAX_DESC', link: '/settings/tax', privilege: 'taxSecurity.actions.view.access',
        i18nPrefix: 'SETTINGS.TAX' },
      { label: 'SETTINGS.ITEMS.TAX_DETAILS', description: 'SETTINGS.ITEMS.TAX_DETAILS_DESC', link: '/settings/tax-details', privilege: 'companySettingsSecurity.actions.businessSettings.access',
        i18nPrefix: 'SETTINGS.BUSINESS' },
    ],
  },
  {
    id: 'pricing', section: 'SETTINGS.SECTIONS.SALES_POS', title: 'SETTINGS.GROUPS.PRICING', color: '#f97316',
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
    id: 'shipping', section: 'SETTINGS.SECTIONS.OPERATIONS', title: 'SETTINGS.GROUPS.SHIPPING', color: '#0ea5e9',
    icon: `<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>`,
    items: [
      // Four separate pages, as in the legacy app.
      { label: 'SETTINGS.ITEMS.COVERED_ADDRESS', description: 'SETTINGS.ITEMS.COVERED_ADDRESS_DESC', link: '/settings/covered-address', privilege: 'coveredAddress.actions.view.access',
        i18nPrefix: 'COVERED_ADDRESS' },
      { label: 'SETTINGS.ITEMS.COVERED_ZONE', description: 'SETTINGS.ITEMS.COVERED_ZONE_DESC', link: '/settings/covered-zone', privilege: 'coveredZone.actions.view.access',
        i18nPrefix: 'COVERED_ZONE' },
      { label: 'SETTINGS.ITEMS.SHIPPING', description: 'SETTINGS.ITEMS.SHIPPING_DESC', link: '/settings/shipping', privilege: 'shippingSecurity.actions.view.access',
        i18nPrefix: 'SHIPPING' },
      { label: 'SETTINGS.ITEMS.SHIPPING_OPTIONS', description: 'SETTINGS.ITEMS.SHIPPING_OPTIONS_DESC', link: '/settings/shipping-options', privilege: 'shippingSecurity.actions.view.access',
        i18nPrefix: 'SHIPPING_OPTIONS' },
    ],
  },
  {
    // Discounts were the sole child of the Promotion card, so that card
    // showed a single row — and because the tile was gated on the
    // `promotions` plan feature it vanished outright for any company
    // without it, taking Discount with it. Own card, ungated: discounting
    // is core POS functionality, and the legacy panel treated it that way
    // too — the Discount entry there carried no featureFlag and was
    // reachable on every plan, gated only by `discountSecurity`. The
    // Promotion card comes back when coupons/points/tiers are ported.
    id: 'discount', section: 'SETTINGS.SECTIONS.SALES_POS', title: 'SETTINGS.GROUPS.DISCOUNT', color: '#f43f5e',
    icon: `<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>`,
    items: [
      { label: 'SETTINGS.ITEMS.DISCOUNT', description: 'SETTINGS.ITEMS.DISCOUNT_DESC', link: '/settings/discounts', privilege: 'discountSecurity.actions.view.access',
        i18nPrefix: 'DISCOUNT' },
    ],
  },
  {
    // Genuine promotions tiles live here; Discount does not, because it is
    // core POS and has its own card above. Vouchers is the first one ported —
    // coupons, points, customer tiers and campaigns have no route and no
    // privilege definition in this project yet, so there is nothing to link
    // to and a tile would be a dead link.
    //
    // Privilege-gated, deliberately NOT feature-gated. The admin grid writes
    // `promotions.vouchers`, but 167 of 168 companies still carry only the
    // legacy bare `promotions` key, so feature-gating this today would hide
    // it for almost everyone — the same silent disappearance the bare-key
    // mismatch caused. Mirrors the deliberate choice at
    // promotions.routes.ts:29. Add `feature: PROMOTIONS_VOUCHERS` once the
    // backfill in docs/tickets/promotions-feature-key-mismatch.md has run.
    id: 'promotion', section: 'SETTINGS.SECTIONS.SALES_POS', title: 'SETTINGS.GROUPS.PROMOTION', color: '#ec4899',
    icon: `<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>`,
    items: [
      { label: 'SETTINGS.ITEMS.GIFT_VOUCHERS', description: 'SETTINGS.ITEMS.GIFT_VOUCHERS_DESC', link: '/promotions/promotions-vouchers', privilege: 'PromotionalVoucherPrivileges.access',
        i18nPrefix: 'PROMOTIONS_VOUCHERS' },
      { label: 'SETTINGS.ITEMS.CUSTOMER_TIERS', description: 'SETTINGS.ITEMS.CUSTOMER_TIERS_DESC', link: '/promotions/customer-tiers', privilege: 'customerTiersPrivileges.access',
        i18nPrefix: 'CUSTOMER_TIERS' },
      { label: 'SETTINGS.ITEMS.PROMOTIONAL_POINTS', description: 'SETTINGS.ITEMS.PROMOTIONAL_POINTS_DESC', link: '/promotions/promotional-points', privilege: 'PromotionalPointsPrivileges.access',
        i18nPrefix: 'PROMOTIONS_POINTS' },
      { label: 'SETTINGS.ITEMS.COUPONS', description: 'SETTINGS.ITEMS.COUPONS_DESC', link: '/promotions/coupons', privilege: 'couponsPrivileges.access',
        i18nPrefix: 'COUPONS' },
      { label: 'SETTINGS.ITEMS.CAMPAIGNS', description: 'SETTINGS.ITEMS.CAMPAIGNS_DESC', link: '/promotions/campaigns', privilege: 'CampaignsPrivileges.access',
        i18nPrefix: 'CAMPAIGNS' },
    ],
  },
  {
    id: 'other', section: 'SETTINGS.SECTIONS.OPERATIONS', title: 'SETTINGS.GROUPS.OTHER', color: '#64748b',
    icon: `<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>`,
    items: [
      { label: 'SETTINGS.ITEMS.PAYMENT_METHODS',    description: 'SETTINGS.ITEMS.PAYMENT_METHODS_DESC',    link: '/settings/payment-methods', privilege: 'paymentMethodSecurity.actions.view.access',
        i18nPrefix: 'PAYMENT_METHODS' },
      { label: 'SETTINGS.ITEMS.SERVICE_MANAGEMENT', description: 'SETTINGS.ITEMS.SERVICE_MANAGEMENT_DESC', link: '/settings/service-management', privilege: 'serviceSecurity.actions.view.access',
        i18nPrefix: 'SERVICE_MANAGEMENT' },
      { label: 'SETTINGS.ITEMS.PLUGINS', description: 'SETTINGS.ITEMS.PLUGINS_DESC', link: '/settings/plugins', privilege: 'pluginsSecurity.actions.view.access',
        i18nPrefix: 'PLUGINS' },
      { label: 'SETTINGS.ITEMS.NOTIFICATIONS', description: 'SETTINGS.ITEMS.NOTIFICATIONS_DESC', link: '/settings/notifications', privilege: 'notificationSettingsSecurity.actions.view.access',
        i18nPrefix: 'NOTIFICATIONS_SETTINGS' },
      { label: 'SETTINGS.ITEMS.IMPORT_FROM_INVO',   description: 'SETTINGS.ITEMS.IMPORT_FROM_INVO_DESC',   privilege: 'companySettingsSecurity.access',
        i18nPrefix: 'SETTINGS.IMPORT_FROM_INVO',
        popup: { component: () => import('./components/import-from-invo/import-from-invo.component').then(m => m.ImportFromInvoComponent), size: 'md' } },
    ],
  },
];
