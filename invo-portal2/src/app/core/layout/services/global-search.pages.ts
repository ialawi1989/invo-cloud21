/**
 * What the global search may look inside, per sidebar page.
 *
 * The sidebar only knows a page's *name*. To find text that lives *inside* a page ("tax", "credit
 * limit", "recurrence"), the search folds in the translation sub-tree that page renders from. Add a
 * line here when a page's own namespace is worth searching; pages absent from the map are still found
 * by name. Prefer the narrowest prefix: a namespace shared by several pages (EMPLOYEES, PRODUCTS,
 * BLOG) must be split per page or every page in it would match every query.
 */
export const PAGE_SEARCH_PREFIXES: Record<string, string[]> = {
  // Sales / purchase documents
  '/account/customers':            ['CUSTOMERS'],
  '/account/customer-segments':    ['CUSTOMER_SEGMENTS'],
  '/account/estimate':             ['ESTIMATES'],
  '/account/invoices':             ['INVOICES'],
  '/account/recurring-invoice':    ['RECURRING_INVOICES'],
  '/account/payments':             ['PAYMENTS'],
  '/account/credit-notes':         ['CREDIT_NOTES'],
  '/account/credit-notes/refunds': ['CREDIT_NOTES'],
  '/account/sales-target-dashboard': ['SALES_TARGET'],
  '/account/suppliers':            ['SUPPLIERS'],
  '/account/purchase-order':       ['PURCHASE_ORDERS'],
  '/account/bills':                ['BILLS'],
  '/account/bill-of-entry':        ['BILL_OF_ENTRY'],
  '/account/recurring-bill':       ['RECURRING_BILLS'],
  '/account/bills-payment':        ['BILLS_PAYMENT'],
  '/account/expense':              ['EXPENSES'],
  '/account/recurring-expense':    ['RECURRING_EXPENSES'],
  '/account/supplier-credit':      ['SUPPLIER_CREDITS'],
  // Accounting
  '/account/chart-of-accounts':    ['CHART_OF_ACCOUNTS'],
  '/account/opening-balances':     ['OPENING_BALANCES'],
  '/account/manual-journals':      ['MANUAL_JOURNALS'],
  '/account/recurring-journal':    ['RECURRING_JOURNAL'],
  '/account/budget':               ['BUDGET'],
  '/account/banking-overview':     ['BANKING_OVERVIEW'],
  '/account/vat-payment':          ['VAT_PAYMENT'],
  // Products & inventory
  '/products/list':                ['PRODUCTS.FORM', 'PRODUCTS.PRODUCT_SHEET', 'PRODUCTS.ADVANCED_OPTIONS', 'PRODUCTS.PRICING', 'PRODUCTS.STOCK'],
  '/products/category':            ['PRODUCTS.CATEGORIES'],
  '/products/brands':              ['PRODUCTS.BRANDS'],
  '/products/department':          ['PRODUCTS.DEPARTMENTS'],
  '/products/option-group':        ['PRODUCTS.OPTION_GROUPS'],
  '/products/option':              ['PRODUCTS.OPTIONS'],
  '/products/recipe':              ['PRODUCTS.RECIPES'],
  '/products/product-recipe':      ['PRODUCTS.PRODUCT_RECIPE'],
  '/products-collections':         ['PRODUCTS.COLLECTIONS'],
  '/matrix-item':                  ['MATRIX'],
  '/dimensions':                   ['DIMENSIONS'],
  '/inventory/physical-counts':    ['PHYSICAL_COUNT'],
  '/inventory/transfer':           ['INVENTORY_TRANSFER'],
  '/inventory/locations':          ['PRODUCTS.INVENTORY_LOCATIONS'],
  '/inventory/request':            ['PRODUCTS.INVENTORY_REQUEST'],
  '/manual-adjustment':            ['MANUAL_ADJUSTMENT'],
  // HR
  '/employees':                    ['EMPLOYEES.FORM', 'EMPLOYEES.FIELDS', 'EMPLOYEES.INVITE', 'EMPLOYEES.LEAVE', 'EMPLOYEES.PAYROLL', 'EMPLOYEES.BENEFITS', 'EMPLOYEES.GOSI'],
  '/employees/privileges':         ['EMPLOYEES.PRIVILEGES'],
  '/employees/access-requests':    ['EMPLOYEES.ACCESS_REQUESTS'],
  '/employees/schedule':           ['EMPLOYEES.SCHEDULE'],
  '/employees/attendance':         ['EMPLOYEES.ATTENDANCE'],
  '/employees/payroll-run':        ['EMPLOYEES.PAYROLL_RUN'],
  '/employees/payouts':            ['EMPLOYEE_PAYOUT'],
  '/employees/tips':               ['TIPS'],
  // Online
  '/navigation-list':              ['NAV'],
  '/website-settings':             ['WEBSITE'],
  '/domain-settings':              ['DOMAIN_SETTINGS'],
  '/promotions/promotions-vouchers': ['PROMOTIONS'],
  '/promotions/campaigns':         ['PROMOTIONS'],
  '/promotions/coupons':           ['PROMOTIONS'],
  '/promotions/customer-tiers':    ['PROMOTIONS'],
  '/promotions/promotional-points': ['PROMOTIONS'],
  '/blog/posts':                   ['BLOG.LIST', 'BLOG.COMPOSER'],
  '/blog/categories':              ['BLOG.TAXONOMIES'],
  '/blog/comments':                ['BLOG.COMMENTS', 'BLOG.MODERATION'],
  '/blog/analytics':               ['BLOG.ANALYTICS'],
  '/blog/settings':                ['BLOG.SETTINGS'],
  // Other
  '/dashboard':                    ['DASHBOARD'],
  '/analytics':                    ['ANALYTICS'],
  '/appointments':                 ['APPOINTMENTS'],
  '/feedbacks':                    ['FEEDBACKS'],
  '/tracking-map':                 ['TRACKING_MAP'],
};

/**
 * Translation root key → the lazy feature file that defines it
 * (`i18n/features/<feature>/i18n/<lang>.json`). The search loads these on demand so it can read text
 * from pages the user has not visited yet.
 */
export const I18N_FEATURE_BY_ROOT: Record<string, string> = {
  CUSTOMERS: 'account/customers', CUSTOMER_SEGMENTS: 'account/customer-segments',
  ESTIMATES: 'account/estimates', INVOICES: 'account/invoices', RECURRING_INVOICES: 'account/recurring-invoices',
  PAYMENTS: 'account/payments', CREDIT_NOTES: 'account/credit-notes', SALES_TARGET: 'account/sales-target',
  SUPPLIERS: 'account/suppliers', PURCHASE_ORDERS: 'account/purchase-orders', BILLS: 'account/bills',
  BILL_OF_ENTRY: 'account/bill-of-entry', RECURRING_BILLS: 'account/recurring-bills',
  BILLS_PAYMENT: 'account/bills-payment', EXPENSES: 'account/expenses',
  RECURRING_EXPENSES: 'account/recurring-expenses', SUPPLIER_CREDITS: 'account/supplier-credits',
  CHART_OF_ACCOUNTS: 'settings/chart-of-accounts', OPENING_BALANCES: 'settings/opening-balances',
  MANUAL_JOURNALS: 'account/manual-journals', RECURRING_JOURNAL: 'account/recurring-journal',
  BUDGET: 'account/budget', BANKING_OVERVIEW: 'settings/banking-overview', VAT_PAYMENT: 'account/vat-payment',
  PRODUCTS: 'products', TAB_BUILDER: 'products', MATRIX: 'products/matrix-item', DIMENSIONS: 'products/matrix-item',
  PHYSICAL_COUNT: 'inventory/physical-count', INVENTORY_TRANSFER: 'inventory/transfer',
  MANUAL_ADJUSTMENT: 'inventory/manual-adjustment',
  EMPLOYEES: 'employees', EMPLOYEE_PAYOUT: 'employees', TIPS: 'employees', COMMISSION_SETTINGS: 'employees',
  NAV: 'website/navigation', WEBSITE: 'website/page-types', DOMAIN_SETTINGS: 'domain-settings',
  PROMOTIONS: 'promotions', BLOG: 'blog',
  REPORTS: 'reports',
  DASHBOARD: 'dashboard', ANALYTICS: 'analytics', APPOINTMENTS: 'appointments', FEEDBACKS: 'feedbacks',
  TRACKING_MAP: 'tracking-map',
  // Settings tiles whose i18nPrefix lives outside the base `settings` feature
  PLUGINS: 'settings/plugins', NOTIFICATIONS_SETTINGS: 'settings/notifications',
  SERVICE_MANAGEMENT: 'settings/service-management', SEO: 'settings/seo', TRANSLATIONS: 'settings/translations',
  PAYMENT_METHODS: 'settings/payment-methods', SHIPPING: 'settings/shipping', SURCHARGE: 'settings/surcharge',
  DISCOUNT: 'settings/discount', DOCUMENT_BUILDER: 'settings/document-builder',
  RECEIPT_BUILDER: 'settings/receipt-builder', LABEL_BUILDER: 'settings/label-builder',
  PRICE_LABEL: 'settings/price-label', MENU_BUILDER: 'settings/menu-builder',
  COVERED_ZONE: 'settings/covered-zone', COVERED_ADDRESS: 'settings/covered-address', SHIPPING_OPTIONS: 'settings/shipping-options',
};

/** Sub-trees that hold messages, not labels; walking them only adds noise to the in-page corpus. */
export const NOISE_KEY = /^(ERR|ERRORS?|TOASTS?|VALIDATION|CONFIRM\w*|MESSAGES?|MSG|TOUR)$/i;

/** A routable page that has no sidebar item and no Settings tile (reached from buttons inside other pages). */
export interface ExtraPage {
  /** i18n key, with the English text used until the key exists. */
  title: [key: string, fallback: string];
  /** Breadcrumb trail, same key/fallback pairs. */
  trail: [key: string, fallback: string][];
  link: string;
  icon: string;
  /** Plain privilege path, checked like the sidebar's `requiredPermission`. */
  permission?: string;
  /** HR grant, checked like the sidebar's `requiredHrGrant`. */
  hrGrant?: { group: string; action: string };
}

const PRODUCTS: [string, string] = ['MENU.PRODUCTS', 'Products'];
const EMPLOYEES: [string, string] = ['MENU.EMPLOYEES', 'Employees'];
const REPORTS: [string, string] = ['MENU.REPORTS', 'Reports'];

export const EXTRA_PAGES: ExtraPage[] = [
  { title: ['MENU.SUB.PRICE_CHANGE', 'Price Change'], trail: [PRODUCTS], link: '/products/price-change', icon: 'product', permission: 'priceChangeSecurity.actions.view.access' },
  { title: ['MENU.SUB.TRANSLATION', 'Translation'], trail: [PRODUCTS], link: '/products/translation', icon: 'product', permission: 'productSecurity.actions.translation.access' },
  { title: ['MENU.SUB.PRODUCTS_AVAILABILITY', 'Products Availability'], trail: [PRODUCTS], link: '/products/products-availability', icon: 'product', permission: 'productsAvailabilitySecurity.actions.view.access' },
  { title: ['MENU.SUB.BULK_IMAGE', 'Bulk Image'], trail: [PRODUCTS], link: '/products/bulk-image', icon: 'product', permission: 'productSecurity.actions.bulkImage.access' },
  { title: ['MENU.SUB.BULK_PRINT', 'Bulk Print Barcodes'], trail: [PRODUCTS], link: '/products/bulk-print', icon: 'product', permission: 'productSecurity.actions.printBarcode.access' },
  { title: ['MENU.SUB.IMPORT_EXPORT', 'Import / Export Products'], trail: [PRODUCTS], link: '/products/import-export', icon: 'product', permission: 'productSecurity.actions.importExport.access' },
  { title: ['MENU.SUB.EMPLOYEE_SERVICES', 'Employee Services'], trail: [PRODUCTS], link: '/products/employee-services', icon: 'product', permission: 'productSecurity.actions.view.access' },
  { title: ['MENU.SUB.SERVICE_TEAM', 'Service Team'], trail: [EMPLOYEES], link: '/employees/service-team', icon: 'employee', permission: 'salonSecurity.actions.serviceTeam.access' },
  { title: ['MENU.SUB.HOLIDAY_CALENDARS', 'Holiday Calendars'], trail: [EMPLOYEES], link: '/employees/holiday-calendars', icon: 'employee', permission: 'employeeLeaveSecurity.actions.view' },
  { title: ['MENU.SUB.LEAVE_TYPES', 'Leave Types'], trail: [EMPLOYEES], link: '/employees/leave-types', icon: 'employee', hrGrant: { group: 'employeeLeaveSecurity', action: 'edit' } },
  { title: ['MENU.SUB.GOSI_SETTINGS', 'GOSI Settings'], trail: [EMPLOYEES], link: '/employees/gosi-settings', icon: 'employee', hrGrant: { group: 'employeeGosiSecurity', action: 'view' } },
  { title: ['MENU.SUB.CUSTOM_REPORTS', 'Custom Reports'], trail: [REPORTS], link: '/reports/custom', icon: 'bar_chart', permission: 'reportsSecurity.actions.view.access' },
  { title: ['MENU.SUB.MCP_TOKENS', 'MCP Tokens'], trail: [REPORTS, ['MENU.SUB.CUSTOM_REPORTS', 'Custom Reports']], link: '/reports/custom/mcp-tokens', icon: 'bar_chart', permission: 'reportsSecurity.actions.view.access' },
  { title: ['MENU.SUB.PRICE_MANAGEMENT', 'Price Management'], trail: [], link: '/price-management', icon: 'product' },
  { title: ['MENU.SUB.BRANCH_PAYMENTS', 'Branch Payments'], trail: [], link: '/branch-payments', icon: 'account' },
  { title: ['MENU.SUB.COMMENT_RULES', 'Comment Rules'], trail: [['MENU.SUB.BLOG', 'Blog'], ['MENU.SUB.BLOG_COMMENTS', 'Comments']], link: '/blog/comments/rules', icon: 'blog' },
];
