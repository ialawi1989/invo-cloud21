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
  DASHBOARD: 'dashboard', ANALYTICS: 'analytics', APPOINTMENTS: 'appointments', FEEDBACKS: 'feedbacks',
  TRACKING_MAP: 'tracking-map',
  // Settings tiles whose i18nPrefix lives outside the base `settings` feature
  PLUGINS: 'settings/plugins', NOTIFICATIONS_SETTINGS: 'settings/notifications',
  SERVICE_MANAGEMENT: 'settings/service-management', SEO: 'settings/seo', TRANSLATIONS: 'settings/translations',
  PAYMENT_METHODS: 'settings/payment-methods', SHIPPING: 'settings/shipping', SURCHARGE: 'settings/surcharge',
  DISCOUNT: 'settings/discount', DOCUMENT_BUILDER: 'settings/document-builder',
  RECEIPT_BUILDER: 'settings/receipt-builder', LABEL_BUILDER: 'settings/label-builder',
  PRICE_LABEL: 'settings/price-label', MENU_BUILDER: 'settings/menu-builder',
  COVERED_ZONE: 'settings/covered-zone', COVERED_ADDRESS: 'settings/covered-address',
};

/** Sub-trees that hold messages, not labels; walking them only adds noise to the in-page corpus. */
export const NOISE_KEY = /^(ERR|ERRORS?|TOASTS?|VALIDATION|CONFIRM\w*|MESSAGES?|MSG|TOUR)$/i;
