export interface MenuItem {
  id:        number;
  label:     string;
  icon?:     string;
  link?:     string;
  isTitle?:  boolean;
  badge?:    { variant: 'primary' | 'success' | 'danger' | 'warning'; text: string };
  subItems?: MenuItem[];
  expanded?: boolean;
  feature?:  string;
  privilege?: string;
}

export const MENU_ITEMS: MenuItem[] = [

  // ── Main ─────────────────────────────────────────────────────────────────
  { id: 1, label: 'MAIN', isTitle: true },
  {
    id: 2, label: 'Dashboard', icon: 'dashboard', link: '/dashboard',
    privilege: 'dashboardSecurity.access',
  },

  // ── Products ─────────────────────────────────────────────────────────────
  { id: 10, label: 'PRODUCTS', isTitle: true },
  {
    id: 11, label: 'Products', icon: 'product',
    privilege: 'productSecurity.actions.view',
    subItems: [
      { id: 111, label: 'Product List',           link: '/products',                        privilege: 'productSecurity.actions.view' },
      { id: 112, label: 'Matrix Items',            link: '/matrix-item',                     privilege: 'matrixItemSecurity.actions.view' },
      { id: 113, label: 'Categories',              link: '/products/category',               privilege: 'categorySecurity.actions.view' },
      { id: 114, label: 'Brands',                  link: '/products/brands',                 privilege: 'brandSecurity.actions.view' },
      { id: 115, label: 'Departments',             link: '/products/department',             privilege: 'departmentSecurity.actions.view' },
      { id: 116, label: 'Dimensions',              link: '/products/dimension',              privilege: 'dimensionSecurity.actions.view' },
      { id: 117, label: 'Option Groups',           link: '/products/optionGroup',            privilege: 'optionGroupSecurity.actions.view' },
      { id: 118, label: 'Options',                 link: '/products/option',                 privilege: 'optionSecurity.actions.view' },
      { id: 119, label: 'Recipes',                 link: '/products/recipe',                 privilege: 'recipeSecurity.actions.view' },
      { id: 1110, label: 'Product Recipes',        link: '/products/productRecipe',          privilege: 'productRecipeSecurity.actions.view' },
      { id: 1111, label: 'Price Change',           link: '/products/priceChange',            privilege: 'priceChangeSecurity.actions.view' },
      { id: 1112, label: 'Products Availability',  link: '/products/products-availability',  privilege: 'productsAvailabilitySecurity.actions.view' },
      { id: 1113, label: 'Collections',            link: '/products/products-collections',   privilege: 'productsCollectionsSecurity.actions.view' },
      { id: 1114, label: 'Label Print',            link: '/products/label-print',            privilege: 'productSecurity.actions.view' },
      { id: 1115, label: 'Translation',            link: '/products/translation',            privilege: 'productSecurity.actions.view' },
    ],
  },
  {
    id: 12, label: 'Inventory', icon: 'inventory',
    privilege: 'inventoryTransferSecurity.actions.view',
    subItems: [
      { id: 121, label: 'Physical Counts',    link: '/inventory/physical-counts',    privilege: 'inventoryPhysicalCountsSecurity.actions.view' },
      { id: 122, label: 'Transfers',          link: '/inventory/transfer',           privilege: 'inventoryTransferSecurity.actions.view' },
      { id: 123, label: 'Locations',          link: '/products/inventory-locations', privilege: 'inventoryLocationsSecurity.actions.view' },
      { id: 124, label: 'Manual Adjustment',  link: '/manual-adjustment',            privilege: 'manualAdjustmentSecurity.actions.view' },
      { id: 125, label: 'Inventory Request',  link: '/products/inventory-request',   privilege: 'productSecurity.actions.view' },
    ],
  },

  // ── Sales ─────────────────────────────────────────────────────────────────
  { id: 20, label: 'SALES', isTitle: true },
  {
    id: 21, label: 'Customers', icon: 'people',
    privilege: 'customerSecurity.actions.view',
    subItems: [
      { id: 211, label: 'Customer List',    link: '/account/customers',         privilege: 'customerSecurity.actions.view' },
      { id: 212, label: 'Segments',         link: '/account/customer-segments', privilege: 'customerSegmentsSecurity.actions.view' },
    ],
  },
  {
    id: 22, label: 'Sales', icon: 'invoice',
    subItems: [
      { id: 221, label: 'Estimates',           link: '/account/estimate',          privilege: 'estimateSecurity.actions.view' },
      { id: 222, label: 'Invoices',            link: '/account/invoices',          privilege: 'invoiceSecurity.actions.view' },
      { id: 223, label: 'Recurring Invoices',  link: '/account/recurring-invoice', privilege: 'recurringInvoiceSecurity.actions.view' },
      { id: 224, label: 'Payments',            link: '/account/payments',          privilege: 'invoicePaymentsSecurity.actions.view' },
      { id: 225, label: 'Credit Notes',        link: '/account/credit-notes',      privilege: 'creditNoteSecurity.actions.view' },
    ],
  },
  {
    id: 23, label: 'Sales Target', icon: 'target', link: '/sales-target',
    privilege: 'salesTargetSecurity.actions.view',
  },

  // ── Purchase ─────────────────────────────────────────────────────────────
  { id: 30, label: 'PURCHASE', isTitle: true },
  {
    id: 31, label: 'Suppliers', icon: 'supplier', link: '/account/suppliers',
    privilege: 'supplierSecurity.actions.view',
  },
  {
    id: 32, label: 'Purchase', icon: 'purchase',
    subItems: [
      { id: 321, label: 'Purchase Orders',     link: '/account/purchase-order',    privilege: 'purchaseOrderSecurity.actions.view' },
      { id: 322, label: 'Bills',               link: '/account/bills',             privilege: 'billingSecurity.actions.view' },
      { id: 323, label: 'Bill of Entry',       link: '/account/bill-of-entry',     privilege: 'billOfEntrySecurity.actions.view' },
      { id: 324, label: 'Recurring Bills',     link: '/account/recurring-bill',    privilege: 'recurringBillSecurity.actions.view' },
      { id: 325, label: 'Bill Payments',       link: '/account/bills-payment',     privilege: 'billingPaymentsSecurity.actions.view' },
      { id: 326, label: 'Expenses',            link: '/account/expense',           privilege: 'expenseSecurity.actions.view' },
      { id: 327, label: 'Recurring Expenses',  link: '/account/recurring-expense', privilege: 'recurringExpenseSecurity.actions.view' },
      { id: 328, label: 'Supplier Credit',     link: '/account/supplier-credit',   privilege: 'supplierCredit.actions.view' },
    ],
  },

  // ── Accounting ────────────────────────────────────────────────────────────
  { id: 40, label: 'ACCOUNTING', isTitle: true },
  {
    id: 41, label: 'Accounts', icon: 'account',
    subItems: [
      { id: 411, label: 'Chart of Accounts',   link: '/account/accounts',          privilege: 'accountSecurity.actions.view' },
      { id: 412, label: 'Opening Balances',    link: '/account/opening-balances',  privilege: 'openingBalances.actions.view' },
      { id: 413, label: 'Manual Journals',     link: '/account/journal',           privilege: 'manualJournalSecurity.actions.view' },
      { id: 414, label: 'Recurring Journals',  link: '/account/recurring-journal', privilege: 'recurringJournalSecurity.actions.view' },
      { id: 415, label: 'Budget',              link: '/account/budget',            privilege: 'budgetSecurity.actions.view' },
      { id: 416, label: 'Banking Overview',    link: '/account/banking-overview',  privilege: 'bankingOverview.actions.view' },
      { id: 417, label: 'Reconciliation',      link: '/account/reconciliation',    privilege: 'reconciliationSecurity.actions.view' },
      { id: 418, label: 'VAT Payment',         link: '/account/vat-payment',       privilege: 'vatPayment.actions.view' },
    ],
  },
  {
    id: 42, label: 'Reports', icon: 'bar_chart', link: '/cloud-reports',
    privilege: 'reportsSecurity.actions.view',
  },

  // ── HR ────────────────────────────────────────────────────────────────────
  { id: 50, label: 'HR', isTitle: true },
  {
    id: 51, label: 'Employees', icon: 'employee',
    subItems: [
      { id: 511, label: 'Employee List',   link: '/employees',            privilege: 'employeeSecurity.actions.view' },
      { id: 512, label: 'Privileges',      link: '/employee-privileges',  privilege: 'privilegeSecurity.actions.view' },
      { id: 513, label: 'Schedule',        link: '/employeeSchedule',     privilege: 'employeeScheduleSecurity.actions.view' },
      { id: 514, label: 'Attendance',      link: '/employeeAttendence',   privilege: 'employeeAttendenceSecurity.actions.view' },
    ],
  },

  // ── Online ────────────────────────────────────────────────────────────────
  { id: 60, label: 'ONLINE', isTitle: true },
  {
    id: 61, label: 'Website', icon: 'web',
    subItems: [
      { id: 611, label: 'Page Builder',      link: '/page-builder',       privilege: 'websiteBuilderSecurity.actions.view' },
      { id: 612, label: 'Navigation',        link: '/navigation-list',    privilege: 'websiteBuilderSecurity.actions.view' },
      { id: 613, label: 'Website Settings',  link: '/website-settings',   privilege: 'websiteSettingsSecurity.actions.view' },
      { id: 614, label: 'Domain Settings',   link: '/domain-settings',    privilege: 'DomainSettingsSecurity.actions.view' },
      { id: 615, label: 'Paging System',     link: '/paging',             privilege: 'pagingSecurity.actions.view' },
    ],
  },
  {
    id: 62, label: 'Promotions', icon: 'promotion', link: '/promotions',
    feature: 'promotions', privilege: 'discountSecurity.actions.view',
  },
  {
    id: 63, label: 'Media', icon: 'media', link: '/media',
    privilege: 'mediaSecurity.actions.view',
  },
  {
    id: 64, label: 'Plugins', icon: 'plugin', link: '/plugins',
    privilege: 'pluginsSecurity.actions.view',
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  { id: 70, label: 'SETTINGS', isTitle: true },
  {
    id: 71, label: 'Settings', icon: 'settings', link: '/settings',
    privilege: 'companySettingsSecurity.access',
  },
];
