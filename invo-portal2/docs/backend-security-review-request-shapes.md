# Frontend request-shape report for the backend security review

Read-only audit of the three frontends in this repo: **invo-portal2** (admin app), **website** (public storefront) and **dashboard** (page-builder app). No code was changed. Facts below come from reading the code; where that was not possible the row says "unknown" and why. Nothing was checked against the backend source.

**How this was produced.** Six parallel read-only audits (one per area) were merged here. File and line numbers are the ones the audits recorded. I re-checked a sample against the code (list-page limit clamp at `list-page.component.ts:1894`, `MAX_PAGE_LIMIT = 100` at `list-page.config.ts:60`, the `sort-info` header at `promotions-api.service.ts:55`, feedbacks `sort:{value,direction}` at `feedbacks-list.component.ts:88`, banking `'ASC':'DESC'` at `transactions.component.ts:196`, `SORT_COLUMN` at `sales-by-invoice.service.ts:19`, the three `hr-error.ts` text rules at lines 104/115/125, `/Certificate not ready/i` at `domain-settings.component.ts:238`, `/date\s*range/i` at `report-v2.service.ts:76`, product-movement `fmt()` at `product-movement.component.ts:866-868`). The rest is as reported by the audits and not individually re-read.

**Path shorthand.** `P/` = `invo-portal2/src/app/`, `W/` = `website/src/app/`, `D/` = `dashboard/src/app/`. `LP/` = `P/shared/components/list-page/`.

---

## 0. How the shared list sends a sort (applies to every `<app-list-page>` screen)

- State: `LP/components/list-page.component.ts:1447` `sortBy = signal<{sortValue, sortDirection:'asc'|'desc'} | undefined>`.
- The `sortValue` is the column's `key`, unchanged, for any column with `sortable: true`. No remapping inside the shared list. Each screen's loader decides what goes on the wire.
- Header click or Sort menu (`onColumnSort`, `list-page.component.ts:2499-2526`): new column -> `{key,'asc'}`; same column again -> `'desc'`; third click -> `undefined` (cleared). Direction is always **lowercase** at this layer.
- `sorting.defaultSort` seeds the state (`list-page.component.ts:1742-1745`, also `:1783-1785`). Most screens declare none.
- Page size sent: `limit = Math.min(100, Math.max(1, floor(pageSize)))` (`list-page.component.ts:1894`).
- URL: `?sortBy=<key>&sortDir=<dir>` (`LP/utils/list-helpers.ts:22-28`). A restored sort is now validated (`validateRestoredSort`, `list-helpers.ts:62-78`, applied at `list-page.component.ts:1783` and `:3206`): only a `sortable === true` column key or the screen's `defaultSort.key` is accepted, and only when sorting is enabled; direction is trimmed and lowercased, anything else falls back to the default direction or `'asc'`. A rejected key falls back to the default sort or none. **This validator covers `<app-list-page>` screens only.** Hand-built tables (discount, media, supplier items) and rail menus are not covered.
- The Sort menu lists exactly the `sortable` columns (`list-page.component.ts:2384-2393`).
- Excel exports, calendar/board views re-send the active sort in the same shape.

---

## PART 1: Sort keys

Row columns: screen | method + endpoint | exact sortValue keys | direction | transport | default | cleared / empty | file:line.
All calls are **POST** unless noted. "std" = body `sortBy:{sortValue, sortDirection}`. Directions are lowercase `asc`/`desc` unless stated.
"cleared" values: `{}` = empty object; `omitted` = key absent from the JSON; `null` = JSON null.

### 1A. Account (`P/features/account/`)

| Screen | Endpoint | sortValue keys | Default | Cleared | file:line |
|---|---|---|---|---|---|
| Invoices list | `accounts/getInvoices/` | `invoiceNumber`, `employeeName` | none | `{}` | `invoices/pages/invoices-list/invoices-list.component.ts:98-99, 151`; `invoices.service.ts:36-37` |
| Estimates list | `accounts/getEstimates/` | `estimateNumber`, `employeeName` | none | `{}` | `estimates/pages/estimates-list/estimates-list.component.ts:54-55`; `services/document-list-base.ts:109` |
| Credit notes list | `accounts/getCreditNotes` | `creditNoteNumber`, `employeeName`, `createdAt` | none | `{}` | `credit-notes/pages/credit-notes-list/credit-notes-list.component.ts:49,51,56` |
| Bills list | `accounts/getBillingList` | `billingNumber`, `supplierName`, `total`, `billingDate` | none | `{}` | `bills/pages/bills-list/bills-list.component.ts:54-60` |
| Bill of entry list | `accounts/getBillOfEntryList` | `billingOfEnrtyNumber` (**typo, sent as written**), `total`, `billingOfEntryDate` | none | `{}` | `bill-of-entry/pages/bill-of-entry-list/bill-of-entry-list.component.ts:49,52,54` |
| Expenses list | `accounts/getExpenseList` | `expenseNumber`, `expenseDate`, `total` | none | `{}` | `expenses/pages/expenses-list/expenses-list.component.ts:50-54` |
| Purchase orders list | `accounts/getPurchaseList/` | `purchaseNumber`, `supplierName`, `total`, `purchaseDate` | none | `{}` | `purchase-orders/pages/purchase-orders-list/purchase-orders-list.component.ts:95-102` |
| Supplier credits list | `accounts/getSupplierCreditList/` | `supplierCreditNumber`, `total`, `supplierCreditDate` | none | `{}` | `supplier-credits/pages/supplier-credits-list/supplier-credits-list.component.ts:48-53` |
| Bills payment list | `accounts/getBillingPaymentList` | `paymentDate`, `paidAmount`, `branchName`, `employeeName` | none | `{}` | `bills-payment/pages/bills-payment-list/bills-payment-list.component.ts:74-81, 105` |
| Payments list (success tab) | `accounts/getInvoicePaymentsList` | `paymentDate`, `employeeName`, `paidAmount`, `branchName` | none | `{}` | `payments/pages/payments-list/payments-list.component.ts:116-120, 149-151` |
| Payments list (failed tab) | `accounts/getFailedInvoicePaymentsList` | same four keys | none | `{}` | same file |
| Customers list | `accounts/getCustomerList` | `name`, `type`, `phone`, `email`, `outStandingRecivable` (**typo**) | none | `{}` | `customers/pages/customers-list/customers-list.component.ts:65-69, 88` |
| Suppliers list | `accounts/getSupplierList` | `name`, `phone`, `email`, `outStandingPayable` | none | `{}` | `suppliers/pages/suppliers-list/suppliers-list.component.ts:59-62, 82` |
| Customer segments | `company/getCustomerSegmentList` | `title` | none | **`null`** | `customer-segments/pages/customer-segments-list/customer-segments-list.component.ts:45, 57` |
| Budget list | `accounts/getBudgetList` | `name`, `branchName`, `year`, `periodicity`, `createdAt` | none | **omitted** (comment `:61`: empty `sortBy` breaks the query) | `budget/pages/budget-list/budget-list.component.ts:49-53, 61-66` |
| VAT payment list | `accounts/getVatPaymentList` | `from`, `branchName`, `amountDue`, `status` | none | **omitted** | `vat-payment/pages/vat-payment-list/vat-payment-list.component.ts:78-83, 111` |
| Recurring invoices | `accounts/getRecurringInvoiceList` | `name`, `customerName`, `branchName`, `startDate`, `endDate`, `createdAt` | none | `{}` | `recurring-invoices/pages/recurring-invoices-list/recurring-invoices-list.component.ts:58-65, 93` |
| Recurring bills | `accounts/getRecurringBillList` | `name`, `supplierName`, `branchName`, `startDate`, `endDate`, `createdAt` | none | `{}` | `recurring-bills/.../recurring-bills-list.component.ts:59-66, 94` |
| Recurring expenses | `accounts/getRecurringExpenseList` | `name`, `branchName`, `startDate`, `endDate`, `createdAt` | none | `{}` | `recurring-expenses/.../recurring-expenses-list.component.ts:59-65, 93` |
| Recurring journals | `accounts/getRecurringJournalList` | `name`, `branchName` | none | `{}` | `recurring-journal/pages/recurring-journal-list/recurring-journal-list.component.ts:93,103, 179-185` |
| Manual journals | `accounts/getJournals` | `journalDate`, `createdAt`, `reference`, `branchName`, `employeeName`, `amount`, `status` | **`createdAt` desc** | `{}` | `manual-journals/pages/list/manual-journals-list.component.ts:95, 120-126, 150`; `manual-journals.service.ts:43,56` |
| Refunds list | `accounts/refundList` | none (sorting disabled) | n/a | no sort key | `credit-notes/pages/refunds-list/refunds-list.component.ts:33, 91` |

Re-sends of the list sort: Excel export (`services/document-list-base.ts:161-171`, `invoices-list.component.ts:275-285`, `page:1, limit:999`), board/calendar views (`components/doc-views/doc-view-fetch.ts:14-22`).

**Rail sort menus and other hard-coded sorts (account)**

| Screen | Endpoint | sortValue | Direction | Default | Cleared | file:line |
|---|---|---|---|---|---|---|
| Invoice view rail (and its export) | `accounts/getInvoices/` | `invoiceDateThenTime`, `createdAt`, `invoiceNumber`, `dueDate`, `total` | **UPPERCASE `ASC`/`DESC`** | `invoiceDateThenTime` DESC | cannot be cleared | `invoices/pages/invoice-view/invoice-view.component.ts:99,108,144-158,176-181`; `services/doc-rail-menu.ts:17-35` |
| Estimate view rail (and export) | `accounts/getEstimates/` | `estimateDateThenTime`, `createdAt`, `estimateNumber`, `estimateExpDate`, `total` | UPPERCASE | `estimateDateThenTime` DESC | cannot be cleared | `estimates/pages/estimate-view/estimate-view.component.ts:78,86,108-114,143` |
| Customer dashboard rail | `accounts/getCustomerList` | `name`, `outStandingRecivable`, `phone` | UPPERCASE (string `'key:DIR'` split on `:`) | `name:ASC` | cannot be cleared | `customers/pages/customer-dashboard/customer-dashboard.component.ts:116,251,270-281` |
| Supplier dashboard rail | `accounts/getSupplierList` | `name`, `outStandingPayable`, `createdAt` | UPPERCASE (`'key:DIR'` split) | `name:ASC` | cannot be cleared | `suppliers/pages/supplier-dashboard/supplier-dashboard.component.ts:102,105-116,258` |
| Supplier items table + supplier items card | `accounts/getSupplierItems` | `productName`, `supplierCode`, `minimumOrder`, `cost` | lowercase | `{}` | third click -> `{}` | `supplier-dashboard.component.ts:149,396,412-418`; `supplier-items-card.component.ts:51-54,123,147-152` |
| Recurring invoice / bill / expense view rails | the matching `getRecurring*List` | `name` | **UPPERCASE `'ASC'`** | fixed | n/a | `recurring-invoices/.../recurring-invoice-view.component.ts:202`; `recurring-bills/.../recurring-bill-view.component.ts:201`; `recurring-expenses/.../recurring-expense-view.component.ts:182` |
| Recurring journal view rail | `accounts/getRecurringJournalList` | `name` | lowercase `'asc'` | fixed | n/a | `recurring-journal/.../recurring-journal-view.component.ts:204` |
| Manual journal view rail | `accounts/getJournals` | `createdAt` | lowercase `'desc'` | fixed | n/a | `manual-journals/pages/view/manual-journal-view.component.ts:161` |
| Sales target saved-targets drawer | `salesTarget/list` | `createdAt` or `totalSalesTarget` (UI values `latest`/`target` are **remapped**) | lowercase `'desc'` always | `latest` | cannot be cleared | `sales-target/services/sales-target.service.ts:17, 70-75`; `.../saved-targets-drawer.component.ts:51,64-67,81` |

Account rails, pickers and forms that send **`sortBy: {}`** (no key, no direction): bill-of-entry, bill-payment, bills, credit-note, expense, payment, purchase-order, supplier-credit rails (e.g. `bill-view.component.ts:131`, `credit-note-view.component.ts:78`, `purchase-order-view.component.ts:123`); invoice/estimate `fetchPage` (`invoice-view.component.ts:416`, `estimate-view.component.ts:168`); filter loaders for branches/employees/products (`document-list-base.ts:151-157`); form pickers (`document-form-base.ts:446-447`, `purchase-order-form.component.ts:99`, `bill-form.component.ts:157`, `supplier-credit-form.component.ts:131`, `manual-journal-form.component.ts:264`); `sales-lookups.service.ts:52,66,100` (`params.sortBy ?? {}`). Account calls that send **no sort key at all**: VAT payment rail (`vat-payment-view.component.ts:86`), pick-customers modal (`pick-customers-modal.component.ts:112-114`), `getParentCustomers` (`customer-form-details.component.ts:165-168`), supplier mini-list pickers, refunds list.

### 1B. Products, inventory, promotions, HR and other operational screens

| Screen | Endpoint | sortValue keys | Direction / transport | Default | Cleared | file:line |
|---|---|---|---|---|---|---|
| Products list (root) | `product/getProductList` | `name`, `departmentName`, `categoryName`, `qty`, `defaultPrice`, `type` (all other columns are `sortable:false`, incl. `stockValue`, `createdAt`, custom-field columns) | lower, std | none | `{}` | `products/pages/products-list/products-list.component.ts:297-474`; `products/services/product-list-requests.ts:42-52`; `product-list.service.ts:36` |
| Products list, count | `product/getProductList` + `countOnly` | none (no sortBy/page/limit) | n/a | n/a | key absent | `product-list-requests.ts:55-61` |
| Product children (tree) | `product/productChildsList` | only keys in `CHILD_SORT_KEYS`: `name`, `barcode`, `unitCost`, `defaultPrice`, `type`, `createdAt`, `categoryName`, `departmentName`; reachable from the UI: `name`, `departmentName`, `categoryName`, `defaultPrice`, `type` | lower, std | none | **`undefined` (omitted)**, also for any key not in the allow-list (e.g. `qty`) | `product-list-requests.ts:64-82`; `products-list.component.ts:746-747` |
| Product drawer, children section | `product/productChildsList` | none | n/a | n/a | omitted | `products/components/product-detail-drawer/product-children/product-children.component.ts:204-206` |
| Product drawer, movement | `accounts/reports/productMovementReport` | none | n/a | n/a | absent | `product-movement.component.ts:722-733`; `product-collection.service.ts:140-155` |
| Products translations tab (7 entities) | `product/getProductList`, `getMatrixList`, `getDepartmentList`, `getCategoryList`, `getOptionGroupList`, `getOptionsList`, `getBrandList` | `name`; `title` for option groups (no remap here) | lower, std | none | **omitted** | `products/pages/products-translations/products-translations.component.ts:127-129,228-229`; `bulk-translation.service.ts:38-43,66-68`; `translation-entities.ts:40-45` |
| Matrix list | `product/getMatrixList` | `name`, `barcode`, `defaultPrice` | lower | none | `{}` | `matrix-item/pages/matrix-list/matrix-list.component.ts:99-162,189-190`; `matrix-item.service.ts:49,51` |
| Dimension list | `product/getDimensionList` | `name` | lower | none | `{}` | `dimension-list.component.ts:92-94,142-143` |
| Brands / Categories / Departments / Options / Recipes | `product/getBrandList`, `getCategoryList`, `getDepartmentList`, `getOptionsList`, `getRecipeList` | `name` | lower | none | `{}` | `brands-list.component.ts:76-78`; `categories-list.component.ts:91-93`; `departments-list.component.ts:94-96`; `options-list.component.ts:136-138`; `recipes-list.component.ts:109-111` |
| Option groups list | `product/getOptionGroupList` | UI `name` is **remapped to `title`** (`SORT_COLUMNS = {name:'title'}`) | lower | none | `{}` | `option-groups/option-groups-list.component.ts:45,98-100,126-127` |
| Product collections list | `company/getCollectionList` | `title` | lower | none | `{}` | `products-collections/products-collections-list.component.ts:111-113,157-163` |
| Inventory locations | `product/getInventoryLocationsList` | `name`, `branchName` | lower | none | `{}` | `inventory-locations-list.component.ts:73-86,117-118` |
| Inventory requests | `product/getInventoryRequestList` | `branchName`, `createdAt`, `employeeName`, `status`, `purchaseOrders`, `transferOrders` | lower | none | `{}` | `inventory-request-list.component.ts:76-81,98-99` |
| Products availability | `product/getBranchProductsAvailability/` | none | n/a | n/a | **explicit `null`** (comment `:165`) | `products-availability.component.ts:165-169` |
| Manual adjustment | `accounts/getManualAdjustmentMovementList` | `branchName`, `adjustmentType`, `employeeName`, **`inventoryMovmentDate`** (typo) | lower | none | omitted | `inventory/manual-adjustment/.../manual-adjustment-list.component.ts:61-64`; service `:24,27` |
| Physical count | `product/getphysicalCountList` (lowercase p) | `type`, `status`, `reference`, `branchName`, `createdDate` | lower | none | omitted | `physical-count-list.component.ts:70-74`; service `:49,52` |
| Inventory transfer | `product/getInventoryTransferList` | `type`, `status`, `transferNumber`, `reference`, `reason`, `branchName`, `createdDate` | lower | none | omitted | `transfer-list.component.ts:59-65`; service `:38,41` |
| Price management | `product/getPriceManagementList` | `title`, `fromDate`, `toDate`, `repeat`, `discountName`, `chargeName` | lower | none | omitted (comment: `{}` breaks it) | `price-management-list.component.ts:46-51`; service `:24,26` |
| Accept/reject orders | `accounts/getOnlineInvoices/` | `invoiceNumber`, `employeeName`, `customerName`, `total`, `branchName`, `invoiceDate` | lower | none | omitted | `accept-reject-orders-list.component.ts:61-66`; service `:28,32` |
| Branch payments | `branch/getBranches/` | `name` | lower | none | omitted | `branch-payments-list.component.ts:45,60` |
| Company-group employees | `employee/getCompanyGroupEmployees` | `name` | lower | none | omitted | `company-group-employees-list.component.ts:40,57` |
| Employees list | `employee/getEmployeeList` | `name`, `email` | lower | none | `{}` | `employees-list.component.ts:88-92,103-104` |
| Attendance list | `employee/getAttendanceList` | `employeeName` | lower | none | `{}` | `attendance-list.component.ts:76-79,97-99` |
| Privileges list | `employee/getEmployeePrivilegeList` | `name` | lower | none | `{}` | `privileges-list.component.ts:64,80-81` |
| **Feedbacks** | `company/getFeedbackList` | `createdAt`, `rating`, `customerName`, `customerContact`, `comment` | **`sort:{value, direction}`**, lower | none | **`sort:{value:'', direction:''}`** (always present) | `feedbacks/pages/feedbacks-list/feedbacks-list.component.ts:59-65, 88` |
| **Blog posts (admin)** | `blog/getPostList` | `title`, `publishDate` | **bare string `sortBy` + `sortDir`**, lower | `publishDate` desc | list sends `undefined`; service then fills `'publishDate'`/`'desc'` | `blog/pages/posts-list/posts-list.component.ts:114,191-192,258-259`; `blog/services/blog-http-api.ts:96-112` (defaults `:100-101`); composer `post-composer.component.ts:777` |
| **Promotions: campaigns** | GET `promotions/promotions-campaigns/campaign?A` | `status`, `givenDate`, `startDate`, `endDate` | **`sort-info` request header** = `JSON.stringify({sortValue, sortDirection})` | `givenDate` desc (list) | header **always sent**, fallback `{givenDate,'DESC'}` (UPPERCASE) | `promotions/pages/campaigns/campaigns-list/campaigns-list.component.ts:66,74-79,98-100`; `promotions/services/promotions-api.service.ts:55` |
| Promotions: coupons sets | GET `promotions/promotions-coupons/couponSets?A…` | `status`, `max`, `used`, `expired` | header, lower | none | no header | `coupons-list.component.ts:93-99`; `coupons.service.ts:89,100` |
| Promotions: points | GET `promotions/promotions-points/customer-points` | `status`, `activePoints`, `givenDate`, `activeDate`, `expiryDate` | header | none | header always sent, fallback `{givenDate,'DESC'}` | `points-list.component.ts:91-96,117-119`; `points.service.ts:112-115` |
| Promotions: points statement | GET `…/statement/{phone}` | `actionDate` | header, lower | none | no header | `points-list.component.ts:99-102,130-133` |
| Promotions: vouchers | GET `promotions/promotions-vouchers/customer-vouchers` | `status`, `balance`, `givenDate`, `activeDate`, `expiryDate` | header | none | header always sent, fallback `{givenDate,'DESC'}` | `vouchers-list.component.ts:75-81,95-98`; `vouchers.service.ts:112-127` |
| Promotions: history pages (coupons, points, tiers, vouchers) | `…/history`, `promotions/customer-tiers-history` | `actionDate` | header, lower | none | no header | `*-history.component.ts:61,74-77` |

Promotions header detail: `SortInfo = {sortValue?, sortDirection?: 'ASC'|'DESC'|string}` (`promotions-api.service.ts:17-20`); there is no `toUpperCase` anywhere, so casing comes from the caller (lower from the list, UPPER only in the three fallbacks `campaigns-list.component.ts:100`, `points-list.component.ts:119`, `vouchers-list.component.ts:97`). After the response the service overwrites the caller's `sortInfo` with the server's echoed `sort-info` header (`promotions-api.service.ts:83-90`).

Not sent to the server (client-side only): cheque builder list (`cheque-builder.service.ts:30-35`), service request list (`service-request.service.ts:38-41`), questionnaire stub, blog analytics and taxonomies, employee schedule, website pages list, content-library UI sort, Business Summary widget. Collection auto-rule "Arrange by" (`bestSelling`, `productTitleAsc`, `productTitleDesc`, `highestPrice`, `lowPrice`, `newest`, `oldest`) is **not a sort request**: it is saved as the string `data.sortBy` inside `company/saveCollection` (`products-collections-form.component.ts:168-176, 314-315`).

Lookups, pickers and dropdown loaders in this area send `sortBy: {}` (`product-list.service.ts:154,182,211,239`, `employee.service.ts:91-96`, `inventory-location.service.ts:60-64`, `brand.service.ts:112`, `category.service.ts:141`, `physical-count.service.ts:92`, `inventory-transfer.service.ts:75`, promotions lookups `promotions-lookups.service.ts:26`, and others), or **no `sortBy` key at all** (`pick-option-group-modal.component.ts:108-112`, `pick-option-modal.component.ts:128-133`, `pick-employee-modal.component.ts:112-116`, child-product picker `product-list.service.ts:265-272`, alt-product `alt-product.component.ts:80-85`). Hard-coded sorts: `pick-product-modal.component.ts:189` (`name`/`asc`), `option-picker-modal.component.ts:118` (`name`/`asc`), `employee-view.component.ts:92` (`name`/`asc`).

### 1C. Settings, website, reports, dashboard widgets

| Screen | Endpoint | sortValue keys | Direction / transport | Default | Cleared | file:line |
|---|---|---|---|---|---|---|
| Chart of accounts list | `accounts/getAccounts/` | `name`, `type`, `parentType`, `code` | lower, std | `name` asc | `{}` | `settings/chart-of-accounts/pages/list/chart-of-accounts-list.component.ts:192,255-290,348`; `services/account.service.ts:73` |
| Chart of accounts view rail | `accounts/getAccounts/` | `name` | `asc` | fixed | n/a | `chart-of-accounts-view.component.ts:168` |
| **Banking transactions** | `accounts/getReconcilationsRecords` | **no sortValue sent**; only `filter.sortDirection` | **`'ASC'` or `'DESC'` (UPPER)** | `DESC` | cleared still sends `'DESC'` | `settings/banking-overview/pages/transactions/transactions.component.ts:135,196`; `banking-overview.service.ts:94` |
| Banking file-reconciliation / reconciliation-form | same endpoint | none | literal `'ASC'`, `limit:100000` | n/a | n/a | `file-reconciliation.component.ts:258-260`; `reconciliation-form.component.ts:343-345` |
| Banking reconciliations list | `accounts/getReconcilationList` | none (column `from` marked sortable but sorting disabled) | n/a | n/a | key omitted | `reconciliations.component.ts:164`; `banking-overview.service.ts:154-167` |
| Menu builder list | `product/getMenuList` | `name`, **`startAt`** (UI `hours` remapped), `availableOnline` | lower, std | service fallback `{sortValue:'index', sortDirection:'asc'}` | fallback `index`/`asc` is sent | `settings/menu-builder/pages/menu-builder-list/menu-builder-list.component.ts:86-114`; `menu-builder.service.ts:60-61` |
| Branches / Kitchen sections | `branch/getBranches/`, `product/getKitchenSectionList` | `name` | lower | none | `{}` | `branches-list.component.ts:48,64,73`; `kitchen-sections-list.component.ts:45,60,69` |
| Tax settings | `accounts/getTaxesList` | `name`, `taxPercentage` | lower | none | **omitted** | `tax-settings.component.ts:59-60,75,85`; `tax-settings.service.ts:13,19` |
| Receipt templates | `company/getRecieptTemplates` (sic) | `name`, `templateType` (whitelisted) | lower | none | **`null`** | `receipt-builder-list.component.ts:55-56,72,78-79`; `receipt-builder.service.ts:32` |
| Discount list (hand-built table) | `accounts/getDiscountList` | `name`, `type`, `amount`, `createdAt` | lower; none -> asc -> desc -> none | none | `{}` | `settings/discount/pages/list/discount-list.component.ts:53,58,105-106,234-261`; `discount.service.ts:45` |
| Media manager | `media/getMediaList` | `createdAt`, `name`, `size` | **UPPERCASE `ASC`/`DESC`**, std | `createdAt` DESC, always sent | cannot be cleared | `settings/media/pages/media-manager.component.ts:46-52,157,342-344,408-411`; `media.service.ts:263,269` |
| Content library items | `company/getThemeByType` | none (UI sort is client-side) | **flat `sortBy:''` + `sortDir:'asc'`** always | same | same | `website/content-library/services/content-library.service.ts:86-87` |
| SEO overrides | `seoOverride/list` | none (type is `Record<string,1\|-1>`, never used) | n/a | `{}` | `{}` | `settings/seo/services/seo-overrides.service.ts:88,100` |
| Journal Entries report | `accounts/reports/journalEntriesReports` | `AccountType`, `reference`, `referenceNumber`, `Debit`, `Credit` (capitals as written) | lower, **`filter.sortBy:[{sortValue,sortDirection}]`** | none | key omitted | `reports/business-overview/components/journal-entries/journal-entries.component.ts:30,44-70`; `business-overview.service.ts:65-67,77-82` |
| Sales by Invoice | `accounts/reports/salesByInvoice` | `salesDate`, `invoiceDate`, `invoiceNumber`, `branchName`, `sales`, `discount`, `tax`, `totalSales`; **remap: `sales`->`totalSales`, `totalSales`->`total`** | lower, `filter.sortBy:[…]` | none | not added | `reports/sales/sales-by-invoice/sales-by-invoice.component.ts:19-22`; `sales-by-invoice.service.ts:19,26-28` |
| Sales by Product | `accounts/reports/salesByItemReport` | `categoryName`, `productName`, `qty`, `salesAmount`, `discountTotal`, `taxTotal`, `total` | lower, `filter.sortBy:[…]` | none | not added | `sales-by-product.component.ts:19`; `.service.ts:51-54` |
| Sales by Item Transactions | `accounts/reports/salesByItemTransactions` | `transactionNumber`, `transactionType`, `transactionDate`, `customerName`, `branchName`, `employeeName`, `netQty`, `salesAmount`, `total` | same | none | not added | `sales-by-item-transactions.component.ts:22-23`; `.service.ts:46-53` |
| Sales by Products vs Options | `accounts/reports/salesByMenuProductVsOptions` | `productName`, `lineQty`, `optionName`, `optionPrice`, `qty`, `totalOptionPrice` | same | none | not added | `sales-by-products-vs-options.component.ts:14`; `.service.ts:21-24` |
| Sales by Terminal | `accounts/reports/salesByTerminals` | `terminalName`, `invoiceProdQty`, `invoiceSales`, `creditNoteProdQty`, `creditNoteSales`, `totalSales` | same | none | not added | `sales-by-terminal.component.ts:15-22`; `.service.ts:18-21` |
| Sales by Delivery Area | `accounts/reports/getSalesByDeliveryArea` | `address`, `invoiceSales`, `creditNoteSales`, `totalSales`, `salesAvg` | same | none | not added | `sales-by-delivery-area.component.ts:16-22`; `.service.ts:19-22` |
| Voided Sales | `accounts/reports/voidedSalesReport` | `invoiceNumber`, `invoiceDate`, `voidDate`, `customerName`, `itemsCount`, `voidedQty`, `saleAmount`, `voidAmount`, `employeeName` | same | none | not added | `voided-sales.component.ts:21-22`; `.service.ts:45-47` |
| Generic report-view shell | `accounts/reports/{route}` (+ export routes) | `ReportColumn.key`, **keys come from the backend response** (`defaultNormalize`, `reports/services/reports.service.ts:191-221`) or per-report normalizers; only the 4 employee-earnings reports render here (`reports/models/employee-earnings-reports.ts:137-158`) | lower, `filter.sortBy:[{sortValue, sortDirection ?? 'asc'}]` | none | key omitted | `reports/pages/report-view/report-view.component.ts:331-338,494`; table `report-data-table.component.ts:37-64` |
| **Custom reports v2 + dashboard custom-report widget** | `accounts/reports/v2/run` | dotted keys `[prefix.]Entity.path`; prefixes `sum|count|avg|max|min` and `day|week|month|year|yearmonth|yearmonthday|hour`, e.g. `sum.Invoice.total`; converted to `spec.sort[] = {field?, agg?, datePart?, dir}` | **`dir` lowercase**; builder-internal `mod` is `'ASC'`/`'DESC'` | none | `sort` omitted from the spec | `reports/custom/shared/v2/spec-adapter.ts:53-70,235-256,292`; `report-v2.model.ts:33-34,54-58,89`; `reports/custom/services/report-v2.service.ts:68-70,163-168`; widget `dashboard/widgets/custom-report-widget/custom-report-widget.component.ts:186-213,262` |
| Legacy custom-report path | `accounts/reports/v2/fromLegacy`; `accounts/reports/getCustomizedReport` | `sort:[{id, mod:'ASC'|'DESC'}]`; form field `sort=JSON.stringify(SortRule[])` | UPPERCASE `mod` | none | `''` | `spec-adapter.ts:566`; `custom-reports.service.ts:534,567` (the second has **no caller** found in `features/`) |
| Cashier shifts | `accounts/reports/cashierList` | none | top-level `sortBy:{}` next to `fromDate`, `toDate` | `{}` | `{}` | `reports/employee/cashier-shifts/cashier-shifts.service.ts:36` |
| Reports with no sort of their own | various `accounts/reports/*` | none (aging, general inventory, product movement, flat, sales-by-aggregator/hours/product-vs-service/products-category, account journals, P&L etc.) | n/a | n/a | absent | per component, they only blank `sortBy` in the URL |

Settings/other lookups that send `sortBy:{}` (or the service default `?? {}`): payment methods, surcharge, service management (list sorted by `index` in the browser), plugins, ZATCA/Jofotara tables, price labels, label templates, media picker, discount form lookups, report filter lookups (`branch/getBranches/`, `accounts/getSupplierList`, `accounts/getCustomerList`, `product/getProductsListByType`, `employee/getEmployeeList`). Menu-builder product picker sends **no** `sortBy` key (`menu-builder.service.ts:136-140`). Hard-coded: `label-builder-form.component.ts:705` (`name`/`asc` on `product/getProductList`).

### 1D. Core / shared / assistant / storefront / dashboard app

| Where | Endpoint | Sort sent | file:line |
|---|---|---|---|
| Pick-list modal categories, logs-drawer pickers | `product/getCategoryList`, `branch/getBranches/`, `employee/getEmployeeList` | `sortBy:{}` | `shared/components/pick-list-modal/pick-list.loaders.ts:20`; `shared/components/logs-drawer/logs-drawer.component.ts:159` |
| Logs service, customer picker, tax pickers | `accounts/getLogReport`, `accounts/getCustomerMiniList`, `accounts/getTaxesList` | none | `shared/services/logs.service.ts:56-66`; `customer-picker.component.ts:84-88`; `pick-tax-modal.component.ts:362-366` |
| Assistant tools | `accounts/getInvoices/`, `accounts/getCustomerMiniList`, `accounts/getBranchProducts/` | `sortBy:{}` | `core/ai/assistant/assistant-tools.ts:66,111,131` |
| Branch service | `branch/getBranchConnectionList` | `sortBy:{}` | `core/layout/services/branch.service.ts:42` |
| **Storefront blog list** | `W` POST `…/v1/ecommerce/<subDomain>/blog/getPostList` | `sortBy:{sortValue: query.sort ?? 'date', sortDirection: query.order ?? 'desc'}`; type allows `date|views|title`, callers only send `date`/`desc` | `W/features/blog/services/public-blog-api.service.ts:114-134`; `blog.types.ts:182-183`; `blog-index.component.ts:182-188`; `dynamic-component.component.ts:958-960` |
| Storefront taxonomies | `…/blog/getTaxonomyList` | `sortBy:{sortValue:'name', sortDirection:'asc'}` | `public-blog-api.service.ts:156` |
| Storefront `getCategoryPosts` | `…/blog/getCategoryPosts` | none (the `paging.sort` argument is accepted and dropped) | `public-blog-api.service.ts:162-174` |
| Storefront product endpoints | `website/getListing`, `shop/menu/getCompanyMenu`, `shop/getCategoriesProducts`, `shop/generalSearch`, `getProductByKey`, `shop/getProduct`, `shop/getCompanyCategories`, `orderHistory` | **no sort field at all** | `W/features/product-list/listing.api.ts:84-141`; `W/features/product/product-api.service.ts:119-161`; `W/features/category-list/category.api.ts:38-41`; `W/features/account/account.api.ts:77-80` |
| Page-type setting `sort_By` (builder, storefront) | none | values `default`, `price_asc`, `price_desc`, `name_asc`, `newest` (and a second vocabulary `name`, `priceAsc`, `priceDesc`, `newest`); **stored but never sent to any request** | `D/models/page-types.model.ts:28,351-357`; `W/core/page-types/page-type.service.ts:43` |
| **Dashboard app (`D/`)** | none | no HTTP call sends a sort | grep for `sortBy|sortValue|sortDirection|orderBy|sort:` found nothing |

### 1E. Endpoint-name questions

| Name | Called by anything? | Evidence |
|---|---|---|
| `productListWithCustomeFields` (any casing/typo) | **No** in `invo-portal2`, `website`, `dashboard` | case-insensitive grep for `productListWith`, `customeColumns`, `customColumns` found nothing. The products list uses `product/getProductList`. |
| `getMenuProducts`, `getMenuProducts2` (any path) | **No** | grep found nothing in the three apps. The app's menu endpoint is `product/getMenuItemList`; the storefront menu call is `shop/menu/getCompanyMenu` (body `{branchId, menuId}`, no sort). |
| `getCollectionProducts` | **Defined, no caller** | `P/features/products/services/product-collection.service.ts:38-39` (`POST company/getCollectionProducts`, body passed through), re-exported `products.service.ts:110`. No call site found, so no body is ever built. |

### 1F. Part 1 flags

1. **Display-name / alias keys sent as `sortValue`** (may not be real columns): `employeeName` (invoices, estimates, credit notes, bills payment, payments, manual journals, manual adjustment, accept/reject, attendance), `branchName` (many lists), `supplierName`, `customerName`, `categoryName`, `departmentName`, `discountName`, `chargeName`, `productName`, `outStandingRecivable`, `outStandingPayable`, `periodicity`, `year`, `from`, `availableOnline`, `templateType`, `parentType`, `taxPercentage`, `purchaseOrders`, `transferOrders`, `adjustmentType`.
2. **Typos sent as written:** `billingOfEnrtyNumber`, `outStandingRecivable`, `inventoryMovmentDate`; routes `product/getphysicalCountList`, `product/getNonCatigorizedProductList`, `company/getRecieptTemplates`, `branch/getServicList`.
3. **Computed / synthetic keys:** `invoiceDateThenTime`, `estimateDateThenTime`, `estimateExpDate` (rails only; the grids use `invoiceDate`/`estimateDate`); `totalSalesTarget` (sales target); `startAt` (menu builder remap); `index` (menu builder fallback).
4. **Remaps:** sales target `latest`/`target`; option groups `name`->`title`; menu builder `hours`->`startAt`; Sales by Invoice `sales`->`totalSales` and `totalSales`->`total`; product children allow-list drops other keys.
5. **Keys the UI offers that the backend may not support:** `qty` on the products list (aggregate projection; dropped for children); `stockValue` is deliberately not sortable (comment `products-list.component.ts:388-389`: server answers "Unknown sort column"); `purchaseOrders`/`transferOrders`; `employee` `email`; coupon `max`/`used`/`expired`; feedbacks `comment`.
6. **Direction casing is mixed.** Lowercase: all `<app-list-page>` screens, reports, v2 `dir`. UPPERCASE: invoice/estimate/customer/supplier rails, recurring invoice/bill/expense rails, media manager, banking `filter.sortDirection`, promotions fallbacks (`'DESC'`), legacy custom-report `mod`. The frontend never normalizes on the way out.
7. **"No sort" is sent seven ways:** `{}`; omitted key (budget, VAT payment, tax settings, manual adjustment, physical count, transfer, price management, accept/reject, branch payments, company-group employees, bulk translation, product children); `null` (customer segments, receipt templates, products availability); `undefined` (promotions history pages: header omitted); `''` pairs (content library `sortBy:''`; feedbacks `{value:'',direction:''}`); forced default (blog `publishDate`/`desc`, menu builder `index`/`asc`, media `createdAt`/`DESC`, promotions `givenDate`/`DESC`); direction-only (banking). Code comments say `{}` breaks the budget, price-management, VAT payment and similar queries.
8. **A sort the user clears can come back:** promotions campaigns/points/vouchers resend `givenDate`/`DESC`; banking resends `DESC`; menu builder resends `index`/`asc`. Manual journals (`defaultSort createdAt desc`): by reading the code (not run), a cleared sort is re-applied when the URL state is re-read (`list-page.component.ts:1783-1802`).
9. **Non-standard shapes to allow for:** feedbacks `sort:{value,direction}`; blog admin and content library bare strings (`sortBy` + `sortDir`); promotions header; report `filter.sortBy[]` array, always inside `filter` (journal entries too: `{filter:{…, page, limit, sortBy:[sort]}}`, `business-overview.service.ts:60-82`; only the cashier-shifts report puts `sortBy:{}` at the top level of the body); v2 `spec.sort[]` with dotted source keys; banking `filter.sortDirection` only; customer/supplier rail `'key:DIR'` strings split client-side (bad input gives `sortDirection: undefined`).
10. **Generic report shell:** sorting is client-side; the sort reaches the server only on the next load or export. A `sortValue` in the URL (`report-view.component.ts:314-315`) is forwarded in `filter.sortBy` **without validation** to any report, including `customBody` reports, and the table does not re-seed from it (`report-data-table.component.ts:31-32`).
11. **Unvalidated sort sources:** hand-built tables and rails (discount list restricts the URL codec to its four keys, `discount-list.component.ts:105-106`), media URL params, report URL `sortValue`.
12. **`attendance` service** spreads `...params` after `sortBy` (`employee-attendance.service.ts:25`): a caller passing `sortBy: undefined` would overwrite the `{}` default.

---

## PART 2: Paging

**The shared list clamps to 100** (`list-page.component.ts:1894`, constant `list-page.config.ts:60`). Its page-size dropdown is `pageLimits` or `[15,30,50,100]`, filtered to 1..100 (`list-page.component.ts:2282`), so no `<app-list-page>` screen can offer more than 100. A `?limit=` in the URL is **not** validated against the options (`list-helpers.ts:90-92`) but is still clamped on the request. Tree children use `tree.pageSize ?? 15` (`list-page.component.ts:2148`; products tree sets 15) and `buildChildrenBody` clamps to 100 (`product-list-requests.ts:77`). Per-user list preferences store columns only, not page size (`core/layout/services/list-preferences.service.ts:17-22`).

### 2A. Page-size UIs that offer or accept more than 100

| Screen | Endpoint | Values | file:line |
|---|---|---|---|
| Custom report builder; dashboard custom-report widget | `POST accounts/reports/v2/run` | page-size options `[10,25,50,100,200]`; default 25 (builder), 15 (widget); a saved spec's limit maps to the nearest option else 200 | `reports/custom/components/pagination/pagination.component.ts:25`; `spec-adapter.ts:55,292,534`; `custom-report-widget.component.ts:201,211,277` |
| Notification logs | `GET notification-settings/notification-logs?limit=` | dropdown `[25,50,100,200,500]`, default 50 | `settings/notifications/pages/overview/notification-settings.component.ts:381,454`; `services/notification-logs.service.ts:45,49` |
| Discount, surcharge, service-management, media manager, product recipe, translations lists | various | **`?limit=` from the URL is passed through with no maximum** (`intCodec` is `parseInt(raw) \|\| default`, `shared/services/query-params.service.ts:28-33`); these screens do not use the clamped list-page | `discount-list.component.ts:51,100,209,238`; `surcharge-list.component.ts:38,81,131,149`; `service-management-list.component.ts:44,79,125,153`; `media-manager.component.ts:49,265,339`; `product-recipe.component.ts:58,219,247`; `translation-group.component.ts:108,192,199` |
| Website product listing | `website/getListing`, `shop/generalSearch`, `shop/getCategoriesProducts` | `limit = Number(page.settings['page_limit'] ?? 24)`; the setting is a free numeric input with **no max** (builder select offers 12, 24, 36, 48) | `W/features/product-list/product-list.page.ts:155,192,209`; `listing.api.ts:94,117`; `W/core/page-types/page-type.fallback.ts:33` |
| Website blog widget | `…/blog/getPostList` | `limit: count` from a component setting (default 3), no max found | `W/components/dynamic/dynamic-component.component.ts:950,959` |
| Website blog index/category/search/tag | `…/blog/getPostList`, `getCategoryPosts`, `getTagPosts` | `postsPerPage` (default 12; admin validator caps at 100, the website does not clamp) | `W/features/blog/pages/blog-index.component.ts:185` etc.; `public-blog-api.service.ts:117,170,183` |

### 2B. Fixed or loop limits above 100 (all are > 100 unless noted)

| Where | Endpoint | Limit | file:line |
|---|---|---|---|
| Invoices Excel export | `accounts/getInvoices/` | 999 | `invoices-list.component.ts:284` |
| Doc-list Excel export (bills, bill-of-entry, credit notes, estimates, expenses, POs, supplier credits) | their list endpoints | 999 | `account/services/document-list-base.ts:172` |
| Calendar view of doc lists | their list endpoints | 999 | `doc-calendar-view.component.ts:104` |
| Doc export modal (invoice/estimate view) | `accounts/getInvoices/`, `accounts/getEstimates/` | loops pages at 999 up to 25000 rows | `doc-export-modal.component.ts:41-42,118-119` |
| Invoice-view export | `accounts/getInvoices/` | 999 (scope all) | `invoice-view.component.ts:179` |
| Recurring journal list with a date filter | `accounts/getRecurringJournalList` | 1000, then client-side paging | `recurring-journal-list.component.ts:191` |
| Sales lookups: taxes 999, branches 1000 | `accounts/getTaxesList`, `branch/getBranches/` | 999 / 1000 | `sales-lookups.service.ts:37,100` |
| Manual journal form: branches 200, accounts 999 | `branch/getBranches/`, `accounts/getAccounts/` | 200 / 999 | `manual-journal-form.component.ts:255,264` |
| Recurring journal editor/form/view | `accounts/getAccounts/`, `branch/getBranches/` | 999 | `journal-lines-editor.component.ts:61`; `recurring-journal-form.component.ts:182`; `recurring-journal-view.component.ts:244` |
| Budget form/report, sales-target modal, schedule, option availability, covered address, opening balances, banking pages, menu-builder, payment-method store, receipt-builder form, surcharge form, service-management menu list | `branch/getBranches/`, `product/getMenuList`, `accounts/getPaymentMethodList/`, taxes, etc. | 200 | `budget-form.component.ts:127`; `budget-report.component.ts:98`; `set-target-modal.component.ts:117`; `employee-schedule.component.ts:389`; `option-availability.component.ts:172`; `covered-address.component.ts:312`; `opening-balances.component.ts:234`; `transactions.component.ts:155`; `reconciliations.component.ts:180`; `menu-builder.service.ts:119`; `payment-methods.store.ts:109`; `receipt-builder-form.component.ts:1107`; `surcharge-form.component.ts:130`; `service.service.ts:133` |
| Privileges lists (manage salespersons, privilege form) | `employee/getEmployeePrivilegeList` | 1000 | `manage-salespersons-modal.component.ts:94`; `privilege-form.component.ts:739` |
| Employees pickers: appointments, service team, notifications | `employee/getEmployeeList` | 500 | `print-schedule-modal.component.ts:84`; `appointment-calendar.component.ts:204`; `appointment-form.component.ts:211`; `service-team.component.ts:43`; `notification-settings.component.ts:163` |
| Employee form/leave/payout/tips/inventory request/inventory locations/price management/promotions lookups/tracking map | `branch/getBranches/`, `employee/getEmployeeList`, `accounts/getSurchargeList`, `accounts/getDiscountList`, `branch/getServicList` | 999 or 1000 | `employee-form.component.ts:1033,1044`; `employee-leave.component.ts:435`; `employee-payout-form.component.ts:112`; `employee-tips.component.ts:105`; `inventory-request-form.component.ts:211`; `inventory-locations-form.component.ts:202`; `price-management.service.ts:81,85,89`; `promotions-lookups.service.ts:26,34`; `tracking-map-api.service.ts:30` |
| Attendance summary | `accounts/reports/attendance/absence` | `filter.limit: 500` | `employee-attendance-summary.component.ts:153` |
| Categories list reorder fetch; navigation; shipping; service-management | `product/getCategoryList`; `company/getCollectionList`; `accounts/getTaxesList`; `accounts/getSurchargeList`, `product/getPriceLabelList` | 999 | `categories-list.component.ts:140`; `navigation.service.ts:96`; `shipping.service.ts:229`; `service.service.ts:107,122`; service-management reorder mode 999 (`service-management-list.component.ts:125`) |
| Menu arrange modal, service-management form, payment-method pages, report filter lookups, notifications | `product/getMenuList`, `branch/getBranches/` | 500 | `arrange-menus-modal.component.ts:43`; `service-management-form.component.ts:224`; `payment-method-connect.component.ts:454`; `payment-method-form.component.ts:360`; `bo-report-host.component.ts:208`; `report-view.component.ts:532`; `report-schedule.service.ts:86` |
| Chart-of-accounts import | `accounts/getAccounts/` | 10000 | `chart-of-accounts-list.component.ts:437` |
| Chart-of-accounts tree mode | `accounts/getAccounts/` | asks `setPageSize(999)`, but the list clamp sends 100 | `chart-of-accounts-list.component.ts:126,161` |
| Banking file-reconciliation / reconciliation-form | `accounts/getReconcilationsRecords` (via `getTransactions`) | 100000 | `file-reconciliation.component.ts:260`; `reconciliation-form.component.ts:345` |
| Translations CSV export | the entity list endpoint | 100000 | `translation-group.component.ts:406` |
| Dashboard widgets | `branch/getBranches/`, `employee/getEmployeeList` | 1000 | `admin-overview.component.ts:141`; `attention-alerts.component.ts:92`; `employees-overview.component.ts:71` |
| Employee commission detail and tips detail reports (and their exports) | `accounts/reports/employeeCommissionDetail`, `accounts/reports/tipsDetail` | `{page:1, limit:5000}` | `reports/models/employee-earnings-reports.ts:127,137,152`; `report-view.component.ts:493` |
| Custom report export-all | `accounts/reports/v2/run` | `limit: null` (no `limit` sent; code comment says the old ceiling was 100,000) | `report-builder.component.ts:2951-2963`; `spec-adapter.ts:292-293` |
| Legacy custom report | `accounts/reports/getCustomizedReport` | form field `limit`: `''` if null, else `String(limit \|\| 30)` (up to 200) | `custom-reports.service.ts:549-551,567` |
| Product picker "select all matching" | `product/getProductList` | chunk 200 | `shared/utils/picker-selection.ts:52,145,157` |
| Bulk by-ids walkers (price change, availability) | `product/getBranchsProducts`, `product/getBranchProductsAvailability/` | 500 | `products/utils/bulk-scope.ts:72-76` |
| Product recipe screen | `product/getMenuItemList`, `product/getProductList` | 1000 each | `product-recipe.component.ts:254,267` |
| Physical count "count everything" | `product/getPhysicalCountProducts` | loops up to 50 pages at 200 | `physical-count.service.ts:99-103` |
| Physical count locations | `product/getInventoryLocationsList` | 200 | `physical-count.service.ts:132` |
| Catalog JSON export | `GET product/exportCatalogProducts` | loops pages at 250 | `export-catalog-modal.component.ts:26,135` |
| Print label / bulk print | label-builder list | 200 | `print-label-modal.component.ts:195`; `bulk-print.component.ts:182` |
| Content library browser/picker | `company/getThemeByType` | **`pageSize: 200`** (key is `pageSize`, not `limit`) | `collection-browser-modal.component.ts:184`; `reference-picker.component.ts:305` |
| Alt-product loader | `product/getProductList` | **`pageSize: Math.max(missing.length, 50)`** plus `ids` (no `limit` key) | `alt-product.component.ts:80-85` |
| Website blog taxonomy / comments | `…/blog/getTaxonomyList`, `…/blog/getPostComments` | 200 | `W/features/blog/services/public-blog-api.service.ts:154,213` |

At or under 100 (for completeness): document surcharges 100 (`document-form-base.ts:206`), sales-target dashboard 100, online payment methods default 100, blog composer 100, document templates 100, plugins 99, pending orders 50, expiring batches 8, Shopify import 100 (8 with images), assistant tools clamp 1..8 (`assistant-tools.ts:10,18`), doc board 20, rails 15, product children 15 (clamped at 100).

### 2C. Paged endpoints that send no `limit`

`branch/getServicList` with `{}` (`core/layout/services/service-list.service.ts:47`); `product/getPriceLabelList` `{}` (`price-management.service.ts:77`); `accounts/getSupplierMiniList` `{}` (`suppliers/services/supplier.service.ts:45`); `branch/getBranchConnectionList` (`branch.service.ts:35`); `blog/getTaxonomyList` unpaged variant (`blog-http-api.ts:164-172`); catalog CSV/XLSX export and report PDF/Excel exports (`reports.service.ts:49,81,129,161`, `product-list.service.ts:338-343`); generic catalog reports other than the two 5000-row ones; non-paged flat reports. Several services default the limit when the caller omits it (15, 20, 30, 50, 99 or 100), e.g. `branch-settings.service.ts:68`, `employee.service.ts:28`, `account.service.ts:71`, `blog-http-api.ts:99`. What the backend does when `limit` is absent is **unknown**.

### 2D. Part 2 flags

1. About 35 fixed call sites send 200 to 1000 (branches, employees, accounts, taxes, surcharges, privileges, services, price labels); exports send 999, 250, 5000; banking, translations export 100000; chart-of-accounts import 10000.
2. `pageSize` is used as the page-size field (not `limit`) by `company/getThemeByType` and the alt-product loader. A cap that only reads `limit` will not see them.
3. Page-size dropdowns above 100: custom report builder and widget (200), notification logs (200, 500).
4. URL `?limit=` unvalidated and unclamped on discount, surcharge, service-management, media, product recipe and translations screens.
5. Storefront `page_limit` and the blog widget `count` have no frontend maximum.
6. `app-list-page` page-info math uses the unclamped `pageSize` (`list-page.component.ts:2272`), so a restored `?limit=500` shows paging for 500 while 100 rows are requested.

---

## PART 3: Date filters

**There is no central date formatter and no date library** (no moment, dayjs, date-fns or `Intl.DateTimeFormat` senders). Almost every call site builds the string from local date parts. A `Date` placed in a request body is serialized by JSON as UTC ISO with `Z`. The two HTTP interceptors do not touch dates. `D/` sends no dates. The website only sends `reservationDate` (below).

### 3A. Shared list date filters

| Component | Stored value | file:line |
|---|---|---|
| list filter bar and filter modal `date-range` (`keyFrom`/`keyTo`) | `'yyyy-MM-dd'` local parts; cleared -> key removed (bar) or `''` then dropped (modal) | `LP/components/list-filter-bar/list-filter-bar.component.ts:345-352,442-446`; `LP/components/filter-modal.component.ts:223-227,339` |
| `date-preset` | one string: `all`, `last7`, `last14`, `last30`, or `custom:<from>..<to>` (comma-free because the URL codec splits commas); `all` stores `undefined` | `list-filter-bar.component.ts:44-45,384-391`; `filter-modal.component.ts:234-240,273-275` |
| Only screen using `date-preset`: Blog posts | `dateFrom`/`dateTo` `'yyyy-MM-dd'` local; `lastN` = today minus (N-1) through today; empties dropped | `blog/pages/posts-list/posts-list.component.ts:235-249`; `blog-http-api.ts:102,108-109` |
| URL state | `filter_<key>=value`; value with a comma becomes an array, else `JSON.parse` then raw string; **no format validation** | `LP/utils/list-helpers.ts:31-46,105-124` |
| Auto date window on search | invoices, payments, credit notes, estimates: when a search is committed and no date filter is set, the list silently adds `fromDate` = today minus 3 months and `toDate` = today (`'yyyy-MM-dd'`) | `list-page.component.ts:2462-2483`; `list-page.types.ts:272`; `invoices-list.component.ts:86`, `payments-list.component.ts:79`, `credit-notes-list.component.ts:72`, `estimates-list.component.ts:85` |

### 3B. Per-screen date parameters

| Screen | Endpoint | Param | Exact format | Formatter | file:line |
|---|---|---|---|---|---|
| Doc lists via `buildBody` | the doc list endpoints | `filter.fromDate`, `filter.toDate` | `'yyyy-MM-dd'`; empty -> `null`; **a string input is just `slice(0,10)`, not validated** | `ymdOf` | `account/services/document-list-base.ts:20-26,96-112` |
| Invoices / payments / bills payment / VAT payment / manual journals | `accounts/getInvoices/`, `accounts/getInvoicePaymentsList`, `accounts/getBillingPaymentList`, `accounts/getVatPaymentList`, `accounts/getJournals` | same | `'yyyy-MM-dd'` or `null` | local `ymd` / `toYmd` copies | `invoices-list.component.ts:38-44,156-157`; `payments-list.component.ts:35-41,150`; `bills-payment-list.component.ts:23-29,106`; `vat-payment-list.component.ts:25-31,108`; `manual-journals-list.component.ts:38-43,154-155` |
| Bills, expenses, POs, supplier credits, bill-of-entry lists | their list endpoints | `fromDate/toDate` declared | request builders **not read** (likely the base) | n/a | `bills-list.component.ts:72`; `expenses-list.component.ts:62`; `purchase-orders-list.component.ts:109`; `supplier-credits-list.component.ts:60`; `bill-of-entry-list.component.ts:61` |
| Recurring invoices / recurring journal | `accounts/getRecurringInvoiceList`, `accounts/getRecurringJournalList` | `fromDate/toDate` | `'yyyy-MM-dd'`; comments disagree on whether the backend reads them | `ymdOf`, `toYmd` | `recurring-invoices-list.component.ts:94` (vs `recurring-invoices.service.ts:16`); `recurring-journal-list.component.ts:177-178`; `recurring-journal.model.ts:165` |
| Inventory: manual adjustment, physical count, transfer lists | `accounts/getManualAdjustmentMovementList`, `product/getphysicalCountList`, `product/getInventoryTransferList` | `filter.fromDate/toDate` | `'yyyy-MM-dd'`; **built via `new Date('yyyy-MM-dd')` (UTC midnight) then local parts** | local `ymd` | `manual-adjustment-list.component.ts:19-23,82`; `physical-count-list.component.ts:22-26,99`; `transfer-list.component.ts:19-23,94` |
| Calendar view of doc lists | the list endpoint | `fromDate`, `toDate` | `'yyyy-MM-dd'`; `toDate` = last visible day **+1** (workaround for `date <= toDate` against a timestamp) | `iso()` | `doc-calendar-view.component.ts:95-111`; `doc-views/doc-view-fetch.ts:24-25` |
| Doc export modal | list endpoint | `filter.fromDate/toDate` | `'yyyy-MM-dd'` | `ymd` | `doc-export-modal.component.ts:44,116` |
| Customer statement; supplier/party overview | `accounts/customerStatement`, `accounts/reports/export[Pdf]/customerstatment`; `getSupplierOverView`/`getCustomerOverView` | `from`,`to`; `interval:{from,to}` | `'yyyy-MM-dd'` (party peek: last 6 months) | `ymd` | `customer-dashboard.component.ts:441-449`; `supplier-dashboard.component.ts:338`; `party-quick-peek.component.ts:74,96-101`; supplier statement params not read (unknown) |
| VAT reports | `accounts/reports/getSalesVatReport`, `getPurchaseVatReport` | `filter.fromDate/toDate` | strings passed as given | none | `vat-payment.service.ts:64-65` |
| Chart of accounts: account journals | `accounts/reports/accountJournal` | `filter.fromDate/toDate` | `'yyyy-MM-dd'` or `null` | `ymd` | `chart-of-accounts-view.component.ts:29-33,203-212` |
| Banking | `accounts/getReconcilationsRecords`; `saveReconciliation` (`from`,`to`) | `filter.fromDate/toDate` | `'yyyy-MM-dd'` or `null` | `toIsoDate`, `toDateInput` | `transactions.component.ts:176-194`; `reconciliation-form.component.ts:338-345,435-445,517-523`; `banking-overview.service.ts:92-93,242-244,259` |
| Media manager | `media/getMediaList` | top-level `dateFrom`, `dateTo` | `'yyyy-MM-dd'`; cleared -> `null`; **restored from URL `from`/`to` unvalidated** | `formatDate` | `media-manager.component.ts:193-198,271-277,337-352` |
| **Logs drawer** | `accounts/getLogReport` | **`date_from`, `date_to` (snake_case)** | `'yyyy-MM-dd'`; cleared -> **`''`** | `toWireDate` | `shared/components/logs-drawer/logs-drawer.component.ts:266-270`; `shared/services/logs.service.ts:61-65` |
| Blog analytics / comments; store analytics | `GET blog/getReport?from=&to=`; `blog/getCommentList`; `company/getSiteAnalytics` | `from`,`to`; `dateFrom`,`dateTo` | `'yyyy-MM-dd'`; omitted if unset | `isoDate` | `blog/pages/analytics/analytics.component.ts:243-257`; `blog-http-api.ts:223-236,337-342`; `site-analytics.component.ts:106-107,156` |
| **Product movement (drawer)** | `accounts/reports/productMovementReport` | `filter.fromDate/toDate` | **`'YYYY-M-D'` NOT zero-padded** (e.g. `2026-1-5`); default last 30 days | `fmt()` | `products/components/product-detail-drawer/product-movement.component.ts:722-731,860-868` |
| Employee attendance / sales summary | `accounts/reports/attendance/*`, `accounts/reports/salesByEmployee` | `filter.fromDate/toDate`; `interval:{from,to}` | `'yyyy-MM-dd'` | `ymd` | `employee-attendance-summary.component.ts:28,146-155`; `employee-sales-summary.component.ts:17,83-85` |
| Employee schedule / holidays / pool tips / leave check | `employee/getEmployeesSchedule`, `employee/getScheduleHolidays`, pool tips, leave check | `from`,`to`; `fromDate`,`toDate`,`distributionDate`; `startDate`,`endDate` (query string, `encodeURIComponent`) | `'yyyy-MM-dd'` | `iso`, `ymd` | `employee-schedule.component.ts:414,453-456`; `employee-tips.component.ts:27,64-65,140,165-166`; `employee-leave.service.ts:502-503` |
| **Appointments** | `appointments/getAppointments`, `loadEmployeeSchedule`, `printEmployeeSchedule`, `saveAppointment`, `updateAppointmentTask` | `from`,`to`,`date`,`serviceDate`,`dateTime` | **full ISO with `Z`** (`Date.toISOString()`); `from` = local midnight, `to` = start of next day | `toIso` | `appointments.service.ts:41-45,96-111`; `appointment-form.component.ts:565,583`; `appointment-calendar.component.ts:215-223,334,415` |
| Dashboard widgets | `dashboard/*`, `accounts/getDashboardSummary`, `getPaymentsFlow`, `getIncomeExpenseSummary`, `dashboard/refundsVoids`, `dashboard/salesByDay`, `groups/dashboard/companiesSales` | `interval:{from,to}`; `filter.fromDate/toDate` | `'yyyy-MM-dd'` local | `iso()` / `toIso` | `dashboard/services/dashboard.service.ts:29-33,70,121,133-134,144,168,187,229,384`; `dashboard.component.ts:213-214,574-575,796-830`; `companies-overview.service.ts:41-67,81-87` |
| Sales target | `salesTarget/*` | `dateFrom`,`dateTo` | `'yyyy-MM-dd'` | `ymd` | `sales-target-calc.ts:22-35`; `set-target-modal.component.ts:197-203` |
| **Price management** | `product/savePriceManagement`, `validatePriceManagementDate` | `fromDate`,`toDate` | **`Date` object -> JSON UTC ISO `Z`** | none | `price-management.service.ts:53,60-63`; `price-management-form.component.ts:210` |
| Promotions | `promotions/promotions-campaigns` (+ overlap GET) | `startDate`,`endDate` | `'yyyy-MM-dd'`; overlap check puts them **unencoded in the query string** | `ymd` | `campaign-form.component.ts:68-75,384-385`; `campaigns.service.ts:24-26` |
| Promotions points/vouchers/coupons | `promotions/promotions-points`, `-vouchers`, `-coupons` | `activeDate`,`expiryDate` | `Date` **with current clock time** -> UTC ISO `Z` | `withCurrentTime` | `promotions-utils.ts:18-25`; `points-form.component.ts:200-201`; `voucher-form.component.ts:215-216`; `coupon-set-details.component.ts:217-218` |
| Discounts | `accounts/saveDiscount` | `startDate`,`expireDate` | `'yyyy-MM-dd'` or `null`; **new-discount default is `new Date().toISOString()`** | `toDateOnlyString` | `discount-form.component.ts:628-629,670-681`; `discount.service.ts:260` |
| Inventory forms | manual adjustment, physical count, transfer saves | `inventoryMovmentDate`, `createdDate`, `calculatedDate`, `closedDate` | full ISO `Z` | `.toISOString()` | `manual-adjustment.service.ts:94`; `physical-count.service.ts:183-185`; `inventory-transfer.service.ts:118` |
| Other saves | blog composer; access approval; recurring schedules; report schedule | `scheduledDate`, `publishDate`; `grantedUntil`; `startDate`,`endDate`; `startDate` | full ISO `Z`; full ISO `Z`; `'yyyy-MM-dd'`; `'yyyy-MM-dd'` | `.toISOString()`, `ymd` | `post-composer.component.ts:649,1397-1429`; `approve-access-modal.component.ts:124`; `recurring-schedule-card.component.ts:189-203`; `report-schedule-modal.component.ts:64,202` |
| Recurring-journal default start | save | `startDate` | `new Date().toISOString().slice(0,10)` (**UTC date**) | n/a | `recurring-journal.model.ts:148` |
| **Document dates (forms)** | `accounts/saveInvoice`, estimates, payments, credit notes, refunds | `invoiceDate`, `estimateDate`, `paymentDate`, `creditNoteDate`, `refundDate`, `refundedDate` | `Date` objects posted unchanged -> **UTC ISO `Z` with time** (derived from code: no conversion exists; not exercised live). Same forms' `dueDate`, `estimateExpDate`, PO `dueDate` are `'yyyy-MM-dd'`. | none | `invoice.model.ts:52`; `invoice-payment.model.ts:15,137`; `credit-note.model.ts:141`; `estimate.model.ts:16`; `invoices.service.ts:68-73`; `invoice-form.component.ts:275,292,307`; `payment-form.component.ts:286`; `estimate-form.component.ts:107,130`; `purchase-order-form.component.ts:237` |
| Other document dates | expenses; bill payments; manual journals; VAT payment line | `expenseDate`; `paymentDate`; `journalDate`; `paymentDate` | **`'yyyy-MM-dd HH:mm'` local**; `'yyyy-MM-dd'`; `'yyyy-MM-dd'`; `'yyyy-MM-dd'` | local formatters | `expenses.service.ts:8-13,83`; `bill-payment-form.component.ts:290`; `manual-journals.types.ts:129-135`; `pay-vat-payment-modal.component.ts:142` |
| Bills, POs, supplier credits, bill of entry | their save endpoints | `billingDate`,`dueDate`; `purchaseDate`,`dueDate`; `supplierCreditDate`; `billingOfEntryDate` | passed through as the model holds them (`Date \| string`); exact shape **unknown** (form setters not read) | none | `bills.service.ts:105-106`; `purchase-orders.service.ts:91-92`; `supplier-credits.service.ts:118`; `bill-of-entry.service.ts:99` |
| **Storefront booking** | `W` POST `…/reservation/saveReservation` | `reservationDate` | `new Date(\`${date}T${time \|\| '00:00'}\`)` (local) -> JSON UTC ISO `Z` | none | `W/features/booking/booking.api.ts:93-107` |

### 3C. Reports

| Screen | Endpoint | Param | Format | file:line |
|---|---|---|---|---|
| Generic report view | `accounts/reports/<route>`; exports `…/export/<path>`, `…/exportPdf/<path>` | `filter.fromDate`, `filter.toDate` | `'yyyy-MM-dd'` local from `resolvePreset`; `custom` keeps the URL/state strings; **URL `fromDate`/`toDate` forwarded without a format check** | `reports/pages/report-view/report-view.component.ts:278-286,388-402`; `report-period.util.ts:4-9,40-72`; `reports.service.ts:46-50,77-78` |
| Month-only logic | same | | uses `toISOString().slice(0,10)` (**UTC "today"**) | `report-view.component.ts:393`; `report-filter-bar.component.ts:250-263` |
| Business Overview | `accounts/reports/<dataRoute>` | `fromDate`+`toDate`; "as of": `date`, `toDate`, `allowAsOf:true`; `page:1` | `'yyyy-MM-dd'`; **URL values validated with `/^\d{4}-\d{2}-\d{2}$/`** and fall back to defaults | `reports/business-overview/shared/bo-filter.ts:51-81,102-121` |
| Per-report overrides | `accounts/reports/*` | `fromDate/toDate` (+ `branches` comma string); customer aging `fromDate = toDate`; daily closing `filter.date = range.to`; monthly `filter.date = fromDate` | `'yyyy-MM-dd'` or `null` | `customer-aging.component.ts:95`; `daily-closing.component.ts:92`; `report-view.component.ts:445-449,462`; `flat-report.component.ts:246,256`; `vat-report.component.ts:78`; `general-inventory.component.ts:101` |
| Cashier shifts | `accounts/reports/cashierList` | `fromDate`,`toDate` | strings as held, no re-formatting | `cashier-shifts.service.ts:36` |
| Period comparison | same | `fromDate` rewritten to `YYYY-01-01` (Year) or `YYYY-MM-01` (Month) of `toDate` | strings | `report-view.component.ts:479-492` |
| Empty handling | | `clean()` removes `null`, `undefined`, `''` | | `reports.service.ts:170-180` |
| Report presets | | `today`, `yesterday`, `thisWeek` (Sun-Sat), `previousWeek`, `thisMonth`, `lastMonth`, `thisQuarter`, `previousQuarter`, `thisYear`, `previousYear`, `yearToDate`, `last7`, `last30`, `custom` | all `'yyyy-MM-dd'` local, no times. Dashboard and custom-report view mode have **separate** preset implementations (`dashboard.component.ts:230-244,796-830`; `view-mode.component.ts:72-81,322-346`). | `report-period.util.ts:40-72` |
| **Custom reports v2** | `accounts/reports/v2/run` | `spec.dateRange={field,from,to}`; date rules `{op:'between', value:[start,end]}` | `'yyyy-MM-dd'`; `toDay()` keeps `YYYY-MM-DD`, otherwise `new Date(s)` then local parts, **unparseable returned unchanged** | `report-v2.service.ts:58-70,164`; `spec-adapter.ts:96-132,141-146,281` |
| Builder UI storing a date rule | same | | **UTC midnight / `T23:59:59.999Z`** strings (`new Date(val+'T00:00:00.000Z').toISOString()`), then read back as local by `toDay` | `view-mode.component.ts:147-187`; `shelves-panel.component.ts:264-302` |

### 3D. Part 3 flags

1. **Three date shapes reach the same backend:** `'yyyy-MM-dd'`; full UTC ISO with `Z` (document dates, appointments, price management, promotions, inventory movement/count/transfer, discount default); and `'yyyy-MM-dd HH:mm'` (expense). Some documents mix them (invoice: `invoiceDate` ISO `Z`, `dueDate` date-only).
2. **Product movement sends non-zero-padded `YYYY-M-D`** (`product-movement.component.ts:866-868`), the only place found.
3. **`ymdOf`/`ymd` forward arbitrary strings** (`slice(0,10)`), and report-view, media manager and `filter_*` URL values are not format-validated. Business Overview and the assistant (`assistant-tools.ts:13,20,69`) do validate.
4. **Possible one-day shift west of UTC** (derived from code, not run): inventory list `ymd` helpers (`new Date('yyyy-MM-dd')`), and the custom-report builder's UTC boundaries read back as local by `toDay`.
5. **UTC "today"** in month-only report logic and recurring-journal default start; everything else is local.
6. **"Empty" is encoded five ways:** `null` (most lists), `''` (logs `date_from`/`date_to`), key omitted (reports, blog, bar filters), `undefined` (store analytics), `null` field (media).
7. **Inclusive end date:** the calendar view asks for one extra day; list filters send the same-day `toDate`. Whether the backend treats a date-only `toDate` as end-of-day inclusive is unknown.
8. **Unencoded query values:** campaigns overlap check (`campaigns.service.ts:24-26`).
9. **Search side effect:** a silent 3-month `fromDate`/`toDate` is added on four doc lists (see 3A).
10. A stale type comment (`list-page.types.ts:197-201`) says `date-preset` custom is an object `{from,to}`; the code uses `custom:from..to`.

---

## PART 4: Search

### 4A. Search inputs whose text reaches a backend

| Screen | Endpoint | Param | Client-side handling | file:line |
|---|---|---|---|---|
| **Every `<app-list-page>` search box** | each screen's own endpoint | `searchTerm` | Enter / button submit, no per-keystroke fetch. **No trim, no lowercase.** Optional `minLength` (shorter non-empty terms silently ignored). `'' -> undefined`. Whitespace-only terms are sent as `" "`. Written to the URL as `?search=`. `SearchConfig.debounceMs` (400) is declared by many lists but not read by the search path. The list also sends `columns` (visible, non-`noApi` column keys) with the term. | `LP/components/list-page.component.ts:1895,1904,2430-2451`; `list-page.types.ts:262-266`; `list-helpers.ts:20` |
| Doc lists | doc list endpoints | `searchTerm` | `params.searchTerm \|\| ''` | `document-list-base.ts:108` |
| Products list / children / pickers | `product/getProductList`; `product/getChildProductList`; `product/getProductTags`, `getDepartmentList`, `getCategoryList`, `getBrandList`, `accounts/getTaxesList` | `searchTerm` | `\|\| ''` | `product-list-requests.ts:46,57,78`; `product-list.service.ts:125,153,181,210,238,268` |
| `app-search-dropdown` (hundreds of pickers) | host's `loadFn` | host maps `search` | **250 ms debounce**, `distinctUntilChanged`; raw, untrimmed text goes to `loadFn` (local filter trims) | `shared/components/dropdown/search-dropdown.component.ts:233-236,312-323,453` |
| Customer picker | `accounts/getCustomerMiniList` | `searchTerm` | via the dropdown | `shared/components/customer-picker/customer-picker.component.ts:81-87` |
| Document line item search | `accounts/getBranchProducts/` | `searchTerm` | **350 ms debounce** | `doc-lines-table.component.ts:234-242`; `sales-lookups.service.ts:57-73` |
| Barcode scan on a line | `accounts/getBranchProductByBarcode/` | `searchTerm` (the barcode) | `trim()`, empty ignored | `doc-lines-table.component.ts:244-253,666-667`; `sales-lookups.service.ts:76-80` |
| Bulk barcode import | `product/searchByBarcodes` | `barcodes[]` | de-duplicated, `trim()` | `doc-lines-table.component.ts:607-640`; `sales-lookups.service.ts:82-86` |
| Media manager | `media/getMediaList` | `searchTerm` | 350 ms debounce, no trim | `media-manager.component.ts:287-299,340` |
| Banking | `accounts/getReconcilationsRecords`, `getReconcilationList`; `getReconcilationByTransactionNumber` | `searchTerm`; `transactionNumbers[]` | `?? ''`; `trim()`, de-dupe, 1000 per chunk | `banking-overview.service.ts:101-107,116-135,155-158` |
| Supplier dashboard items | `accounts/getSupplierItems` | `searchTerm` | `trim()` + 300 ms | `supplier-dashboard.component.ts:258,396-397,403` |
| Translations list | entity list endpoints | `searchTerm` | `trim()` | `settings/translations/services/api-translation.service.ts:68-77` |
| Promotions points / vouchers | GET `…/customer-points`, `…/customer-vouchers` | `?searchCriteria=` | `trim()` check then `encodeURIComponent` | `points.service.ts:114`; `vouchers.service.ts:121-122` |
| Blog posts / comments (admin) | `blog/getPostList`, `blog/getCommentList` | `search` | dropped if empty | `posts-list.component.ts:257`; `blog-http-api.ts:107,231` |
| **Assistant tools** | `accounts/getInvoices/`, `accounts/getCustomerMiniList`, `accounts/getBranchProducts/` | `searchTerm` | `trim()` + truncated to 80 chars; `status` list capped at 6; dates must match `^\d{4}-\d{2}-\d{2}$`; `limit` clamped 1..8 | `core/ai/assistant/assistant-tools.ts:19-20,63-72,111,131` |
| Custom report filter values | `accounts/reports/v2/run` | rule `value` | text operators `equal`, `notEqual`, `contains`, `beginsWith`, `endsWith`, `isEmpty`, `isNotEmpty`; sent as typed | `reports/custom/shared/models/custom-report.model.ts:869-898`; `spec-adapter.ts:107-132` |
| **Website: blog search** | `W` POST `…/blog/getPostList` | `searchTerm` | header/page submit `trim()`; the `q` URL param is passed raw | `W/features/blog/components/blog-header.component.ts:88-92`; `W/features/blog/pages/search.component.ts:126-134,155-158`; `public-blog-api.service.ts:114-118` |
| **Website: storefront** | `…/shop/generalSearch`, `…/website/getListing` | `searchTerm` | none; `product-list.page.ts:192,209` pass **no** term (`''`). Slug lookups: `slug.replace(/-+/g,' ').trim()`, `limit 20`. Where a live storefront search box exists is **unknown**. | `W/features/product-list/listing.api.ts:91-97,137`; `W/features/product/product-api.service.ts:138-146`; `W/services/generateMetaTags.service.ts:122-129` |
| No backend call (client-side only) | n/a | n/a | top-bar global search (in-memory index), tracking-map driver search | `core/layout/services/global-search.service.ts:87-124`; `tracking-map.service.ts:78-89` |
| Dashboard app | none | none | no search values sent | n/a |

### 4B. Escaping / stripping

**None.** No call site strips or escapes `%`, `_`, `\`, `'`, `"`, `;`, `*` or regex characters before sending. Transformations found: `trim()` in a handful of places, lowercasing (client-side filters only), truncation to 80 characters (assistant), `encodeURIComponent` on GET query values (promotions `searchCriteria`, leave dates, website blog `?q=` SEO URL). The only character stripping on a search is a client-side phone match (`tracking-map.service.ts:83`). A code comment (`custom-report.model.ts:873`) says `beginsWith` is the backend's "LIKE 'val%'"; whether `%`/`_` in the user value is escaped server-side is unknown.

### 4C. UI text promising wildcard or regex behaviour

**None found** in any English `en.json` (global and feature) or in templates, for: wildcard, regex, regular expression, exact match/phrase, boolean search, operators, "use quotes", "starts with", "contains", and the symbols `*`, `%`, `AND`, `OR`, `NOT`. The only hits are custom-report filter-operator labels (`reports/i18n/en.json:1653-1663`: Contains, Starts With, Ends With) and unrelated product wording (allergen text, `products/i18n/en.json:1206,1263,1266`). Search placeholders only list the fields searched (e.g. `bills/i18n/en.json:5`, `products/i18n/en.json:533`, `suppliers/i18n/en.json:8`). **Limitation:** Arabic strings were checked for the symbol patterns only, not for equivalent wording.

### 4D. Part 4 flags

1. The raw term goes in a JSON POST body from hundreds of call sites with no central sanitizer.
2. List-page search is not trimmed, so `" abc "` and `"abc"` are different requests and URLs.
3. Four doc lists add a 3-month date window when a search is committed.
4. The search-dropdown forwards untrimmed text to `loadFn`.
5. `columns` is sent with every list-page request (visible, non-`noApi` columns), and a code comment (`list-page.component.ts:1898-1903`) says it stops "the backend's matcher" dropping hits on non-existent fields. Server behaviour is unknown.
6. URL `?search=` and `filter_*` are user-editable and applied without format checks; only the sort is validated.
7. Website blog search passes the `q` query param straight into `searchTerm`.

---

## PART 5: Ids and columns

### 5A. Parent-customer picker (`accounts/getParentCustomers`)

Service `P/features/account/customers/services/customers.service.ts:32`; caller `customer-form-details.component.ts:164-176`:

```ts
const params: any = { page: p.page, limit: p.pageSize, searchTerm: p.search };
if (this.customerData.parentId) params.customerId = this.customerData.parentId;   // :166
if (this.customerData.id)       params.id         = this.customerData.id;         // :167
```

| Field | Sent when | Value / source | Empty or non-uuid? |
|---|---|---|---|
| `page`, `limit`, `searchTerm` | always | dropdown page and size; user search text (`''` when empty) | `searchTerm` is free text |
| `customerId` | only if truthy | `customerData.parentId` (currently selected parent; a server id from `getCustomer`, from this endpoint's option value, or from the quick-create result `res.customerId`, `:404`) | never sent as `''`, `null` or `undefined` (truthy guard; model default `parentId = ''`, `customer.model.ts:81`). No format check. |
| `id` | only if truthy | `customerData.id` (the customer being edited, to exclude itself) | model default `null` (`customer.model.ts:4`), so a new customer omits it. Route params `'new'`, `'0'`, empty are mapped to a blank `new Customer()` and `getCustomer` is not called (`customer-form.component.ts:57-60`). When editing it is whatever the server returned. How `Customer.ParseJson` fills it: **unknown** (file not read). |

No `sortBy`, `filter` or `branchId` is sent. There is no UUID check on this path. When editing, the raw route param goes into the URL `accounts/getCustomer/<id>` (`customers.service.ts:36-38`) unvalidated. The only UUID tests in the repo are `reports/custom/services/report-v2.service.ts:42-45` (`isSpecId`), `W/features/product/product-api.service.ts:47,108`, `W/services/generateMetaTags.service.ts:24,33,197`, `W/server.ts:250,271`.

### 5B. `productListWithCustomeFields` and `columns`

The string does not exist in any of the three apps. The Products list sends `columns` to `product/getProductList`:

- `buildRootListBody` and `buildCountBody` send `columns: input.columns` (`product-list-requests.ts:49,59`). `list-page` builds it with `ColumnHelper.getApiColumnKeys` (keeps `visible !== false && noApi !== true`, maps to `col.key`; gallery mode appends `galleryView.imageKey`) (`list-page.component.ts:1086-1090,1904`; `list-helpers.ts:182-186`).
- Fixed names that can be sent when visible: `name`, `barcode`, `SKU`, `UOM`, `departmentName`, `categoryName`, `brandName`, `qty`, `stockValue`, `unitCost`, `defaultPrice`, `taxName`, `weight`, `createdAt`, `updatedDate`, `type`. `image` is `noApi` and never sent (except as a gallery image key). (`products-list.component.ts:297-480`.)
- **Custom-field columns:** `loadCustomFieldsFn` adds one column per custom field with `key: cf.key`, `visible:false`, `isCustomField:true` (`products-list.component.ts:227-241`). They are sent only when the user makes them visible. `cf.key` comes from `GET company/getCustomizationByKey/product/customFields`, as `f.abbr || f.name || f.key || f.fieldName`, deleted fields skipped, **no client-side sanitising or validation on read** (`product-list.service.ts:284-299`). In the current manager UI `abbr` is sanitised on input (lower-case, spaces to `_`, only `[a-z0-9_]`, max 40; `custom-fields-manager.component.ts:156-157,227-251,604-613`); data saved by older tools: unknown.
- Other `getProductList` bodies with `columns`: pick-product modal sends `['name','translation','image','barcode','SKU','UOM','unitCost','defaultPrice','type','category','categoryId','tags']` (`pick-product-modal.component.ts:197`; note `image`, `category`, `translation` differ from the list's names); translations tab sends `['id','name','type','translation']` (`products-translations.component.ts`) and `columns: null` at `:335`.

### 5C. Other id-like parameters

No id below is UUID-validated in the frontend. The only normalisation is the `'new'` / `'0'` / empty check on some route params.

| Call | Param | Source | Can it be empty / non-uuid? | file:line |
|---|---|---|---|---|
| `accounts/getCustomer/<id>` and supplier form | id | route param | `'new'`, `'0'`, empty caught (create mode); **any other string is sent** | `customer-form.component.ts:57-60`; `supplier-form.component.ts:54-55` |
| Customer / supplier dashboards | `customerId` / `supplierId` | route `id ?? ''` | `''` possible; request goes out before the "no id" navigation | `customer-dashboard.component.ts:207-209`; `supplier-dashboard.component.ts:234-236` |
| Doc forms (invoice, bill, estimate, expense…) | id in `accounts/get<Doc>/<id>` | route `id` | `'0'`, `'new'`, empty caught; others pass | `account/services/document-form-base.ts:198-215`; e.g. `invoices.service.ts:46`, `bills.service.ts:42` |
| Doc view pages | id | `paramMap.get('id') ?? ''` | `''` possible | `account/services/document-view-base.ts:195` |
| Invoice payment page and invoice actions | `getInvoiceBalance/<id>`, `saveOpenInvoice/<id>`, `deleteInvoice/<id>` … | `paramMap.get('id') ?? ''`, row ids | `''` possible | `invoice-payment.component.ts:80`; `invoices.service.ts:46,66,85-100` |
| `accounts/getBill/<billId>` | billId | route | null not checked | `bill-payment-form.component.ts:93,126` |
| Recurring `getRecurring{Bill,Expense,Invoice,Journal}ById/<id>` and overview | id | route `id ?? ''` | `''` possible (journal form treats `''`/`'new'` as new) | `recurring-*-view.component.ts:182/163/183/185`; `recurring-journal-form.component.ts:185-186` |
| Product form `getProduct(id)` / `cloneProduct(id)` | id | route `id ?? 'new'` | `'new'`, `'0'` caught; any other string goes through | `product-form.component.ts:245-250,271-286` |
| Employee tabs (assets, benefits, disciplinary, documents, EOS, leave, payroll, performance, attendance) | employeeId | `route.parent?.snapshot.paramMap.get('id') ?? route.snapshot.paramMap.get('id') ?? ''` | `''` possible (e.g. `employee/getBenefits/`); tab children have no guard; whether the router blocks tabs for `'new'` is unknown | `employee-benefits.component.ts:67-70`; `employee-asset.service.ts:102,116`; `employee-benefit.service.ts:148`; `employee-leave.service.ts:280,332,349,402` |
| Employee payouts | employeeId / payoutId | route `id`; payout form maps `''`,`'0'`,`'new'` to `null` | form guarded, others not | `employee-payout.service.ts:17,22,29`; `employee-payout-form.component.ts:107-108` |
| Budget view/report | id | route `id!` | `''` or missing possible | `budget-report.component.ts:66`; `budget.service.ts:42,51` |
| Manual journal form | id | `paramMap.get('id') \|\| 'new'` | guarded | `manual-journal-form.component.ts:203` |
| Banking pages | accountId / reconciliationId | route `\|\| ''`, `id \|\| '0'` | `''`/`'0'` possible; services not read | `reconciliation-form.component.ts:218-219` |
| Settings forms (brand, category, department, option, option group, recipe, branch, kitchen section, price label, discount, surcharge, payment method, service, chart of accounts) | id | route `id` | `'new'`, `'0'`, empty caught per form; **tax form only checks `!id`** (`'new'` is not special-cased) | `brand-form.component.ts:131-132`; `branch-form.component.ts:226-229`; `tax-form.component.ts:57-58` |
| Promotions detail pages | id | `paramMap.get('id') ?? ''` | `''` possible | `promotions/pages/*` |
| `accounts/getBranchProducts/` | `branchId`, `customerId` | doc's branch; `params.customerId ?? null` | `branchId` can be `''` if the doc's branch is blank | `sales-lookups.service.ts:58-72` |
| `accounts/getBranchProductByBarcode/`, `searchByBarcodes` | `branchId`; `supplierId:null`, `branchId:null` | doc | `branchId` can be blank; barcodes are free text | `sales-lookups.service.ts:77-86` |
| `product/getProductSerials/<branchId>/<id>`, `getProductBatches/…` | both in the URL path | doc line | `branchId` may be `''` giving a `//` path | `sales-lookups.service.ts:91-97` |
| `accounts/getMiniPaymentMethodList/` | `branchId`, `paymentMethodId?` | | `branchId` may be `null` | `sales-lookups.service.ts:104-111` |
| `accounts/getPaymentMethodBalance/<pmId>[/<branchId>]`, `getSupplierBills/<supplierId>[/<branchId>]` | path ids | form | branch added only if truthy; the other id unguarded | `bill-payment-form.component.ts:233`; `bills-payment.service.ts:48` |
| `accounts/getSupplierPayableByBranch/<branchId>/<supplierId>` | both | form; branch filter `'all'` exists but is used for client-side filtering (`payment-form.component.ts:107,145`), not traced into this call | whether any caller passes `''`: unknown | `bills-payment.service.ts:52` |
| **`accounts/getCustomerBranchReceivable/<branchId>/<customerId>`** | both | `getCustomerBranchReceivable = (customerId, branchId = '')` | **default `''` yields `…Receivable//<customerId>`**; argument order differs from URL order | `payments/services/payments.service.ts:65-66` |
| `accounts/customerInvoices/<customerId>`, `getInvoicesForCreditNote/<branchId>/<customerId>` | ids | doc | unguarded | `payments.service.ts:63`; `credit-notes.service.ts:55` |
| `accounts/getCustomerOverView` | `customerId`, `branchId:null`, `filterType:'all'` | | `'all'` is `filterType`, not an id | `party-quick-peek.component.ts:80`; `customer-dashboard.component.ts:332` |
| Supplier dashboard | `branchId` | signal initial `'all'`; `branchParam()` maps `'all'` to `null` before sending | `'all'` is not sent | `supplier-dashboard.component.ts:142,318,363,445-446` |
| Opening balances; employee schedule | `branchId` | `this.branchId() ?? ''` | `''` possible | `opening-balances.component.ts:306,355,431`; `employee-schedule.component.ts:600,646,676,695,731` |
| **`company/validateName`** | `id`, `branchId` | `id: params.id ?? ''`, `branchId: params.branchId ?? ''` | **`''` sent for a new record** (customer/supplier probes pass `null` when new) | `products/services/product-crud.service.ts:332-340`; `customer-validators.ts:30-38`; `supplier-form.builder.ts:13` |
| **`product/validateBarcode`** | `productId` | `params.productId ?? ''` | **`''` for a new product**; whether the validator's `getProductId` returns `'new'`, `null` or `''` is unknown | `product-crud.service.ts:347-354`; `product-validators.ts:57-77` |
| Manual / stock adjustment bodies | `branchId`, `employeeId`, `id`, `referenceId` | | **literal `''` for ids on create** | `product-crud.service.ts:260-323` |
| New-record save bodies | `id`, `branchId`, `employeeId`, `invoiceId`, `productId`, `accountId` | model defaults | **can carry `''`** (serialiser not inspected) | `invoice.model.ts:40,44,750-783`; `refunds.service.ts:31-33`; `employee-form.component.ts:354`; `inventory-request-form.component.ts:60` |
| Children / list filters | `id` / `departments`, `categories`, `brands`, `type`, `tags` | row id; filter state | filter arrays drop `''`/null (`toStringArray`) | `product-list-requests.ts:30-40,68-83` |
| Document / manual-journal list filters | `productId`, `employeeId` | | `|| null` | `invoices-list.component.ts:159`; `document-list-base.ts:104`; `manual-journals-list.component.ts:153` |
| Website product key | `getProductByKey` | `UUID_RE.test(key) ? key : resolveSlug(key)` | non-uuid is deliberate (slug resolution) | `W/features/product/product-api.service.ts:47,108` |
| Website cart/checkout | `sessionId`, `branchId` | session from backend, `branchId` from request | not examined further | `W/features/checkout/checkout.api.ts:160-172` |

---

## PART 6: Error handling that depends on backend error text

The backend now returns "An unexpected error occurred" instead of raw database messages. Where the code **matches text** it will take the wrong branch; where it **displays text** the user sees the generic message.

### 6A. Central machinery

| file:line | Behaviour | Depends on text? |
|---|---|---|
| `P/core/http/api.service.ts:195-250` (`call`, `extractErrors`) | On `res.success === false`, picks `res.msg`, else `res.message`, else string `res.data`, else `res.data.error`, else `res.data.errors[]` (`error`/`message`/`field`/`row`), else `'API error'`; throws `ApiErrorException`. **`ApiError.type` values (`validation`/`business`/`server`/`auth`) are declared (`:17-21`) but never assigned; always `'general'`.** | display only |
| `P/core/http/error.service.ts:36-60` | Error modal shows the message verbatim; for a plain object `.message \|\| .msg \|\| JSON.stringify(error)` | display only |
| `P/core/interceptors/auth.interceptor.ts:96-135,153-202`; `auth.service.ts:41-44,413,498` | 401 refresh/retry and session-expired flow is **status-based**; no message text read | no |

### 6B. Code that matches or parses server text (will break)

| file:line | What it matches | Effect if the text becomes generic |
|---|---|---|
| `P/features/domain-settings/pages/domain-settings/domain-settings.component.ts:231-243` (match at `:238`) | `/Certificate not ready/i.test(res.message)` | the "certificate not ready" UI and `startPolling()` no longer run; the user sees the generic text |
| `P/features/reports/custom/services/report-v2.service.ts:76-81` | `/date\s*range/i.test(err.message)` on a `ReportApiError` from `/v2/run`; if matched and the spec has a date "between" filter it moves it into `dateRange` and **retries once** | the silent retry stops; the run fails with the generic message. `ReportApiError.code` (`REPORT_INVALID`, `REPORT_TIMEOUT`, `REPORT_FAILED`) comes from `response.error.code` (`:175,178`), so it survives only if the backend keeps `error.code` |
| `P/features/employees/hr-error.ts:104,115,125` (`describeError`, `messageOf` reads `error.error.msg \|\| .message \|\| error.msg \|\| error.message`) | `lower.startsWith('not permitted')`; `lower.includes('storage is not configured') \|\| lower.includes('bucket')`; `lower.includes('file is required')`. The file says HR refuses with HTTP 200 + `success:false` and shows "Asset tag is already assigned to …" verbatim | all three hint branches are lost (permission hint, storage hint, upload hint); everything falls to `EMPLOYEES.HR.ERR.FAILED` with generic detail. Status rules (404, 413, 401/403, 0) still work, but a 200 refusal has no status. Pinned by `hr-error.spec.ts:22,59,100` |
| `P/features/reports/custom/components/report-builder/report-builder.component.html:411`, `.ts:1449-1453` | `runErrorCode === 'REPORT_TIMEOUT'` shows a special state; `runError = err.message` shown verbatim | code-driven; survives only if `error.code` is kept |
| `P/features/reports/custom/components/ask-ai-panel/ask-ai-panel.component.ts:199` | `err.code === 'AI_UNAVAILABLE' && err.details` | needs `error.code` and `details` kept |
| `P/core/ai/ai.service.ts:134-140,190-223` | `code = body.data.code`, `message = body.msg \|\| body.message`; SSE `event: error` frame `{code,message}`; `429` + `AI_UNAVAILABLE` -> `AI_RATE_LIMITED`; codes mapped to i18n keys (`ai.types.ts:68`, `blog-ai.service.ts:73`) | code-driven; needs `data.code` kept |
| `P/features/settings/shipping/services/shipping.service.ts:90-94`; `shipping.component.ts:480-495` | structured `res.data[]` of `{zone,type,name,rowIndex,message}` marks each rate row with `v.message`; `res.msg` is the fallback | per-row text becomes generic; rows are still marked via `rowIndex` |
| `P/features/account/suppliers/components/supplier-items-card/supplier-items-card.component.ts:203` | `res.errors.map(e => '#'+e.row+': '+e.reason)` | reason text becomes generic; structure still used |
| `W/features/blog/components/comments/comment-section.component.ts:213-224` | `error.error.code` / `error.code` (`RATE_LIMITED`, `UNAUTHORIZED`, `COMMENTS_DISABLED`, `DEPTH_EXCEEDED`, `FORBIDDEN`) plus status 429/401/403; fallback `error.error.message` verbatim | code/status paths unaffected if kept; fallback text generic |
| `W/features/blog/services/public-blog-api.service.ts:81-100` | wraps non-2xx bodies carrying `e.error.msg` into `Error(msg)` with `.status`/`.code`; for 200 + `success:false` throws `Error(msg)` with `status = 0` | the pages' 404 branches (`post/tag/author/category.component.ts` `e?.status === 404`) do not run for a `success:false` 200 (existing behaviour, not text-dependent) |
| `P/features/products/pages/product-form/product-form.component.ts:621-634` | on `!res.success` shows `res.msg \|\| res.message \|\| string data` (comment names "Product Name Already used"). **If the request throws (non-2xx), the `catch` only `console.error`s and re-enables the form: no user message.** | generic text instead of the specific one; silent failure on throw |
| `P/features/login/login.component.ts:121-124,203-205,221-223,238-240` | `data.msg \|\| 'Login failed'`, `err?.error?.msg \|\| 'An error occurred'`, `'Invalid OTP'`, `'Failed to send reset email'` | wrong-password / bad-OTP / locked-account messages become generic if the auth endpoints are also genericised (unknown) |
| `P/core/layout/components/topbar/disconnect-branch-modal.component.ts:129`; `connect-branch-modal.component.ts:109` | `err?.error?.message ?? err?.message ?? 'Incorrect password…'` / `'Connection failed. Check the token.'` | the fallback is used only when both are empty, so the user may not learn the password was wrong |
| `P/features/settings/menu-builder/store/menu-builder.store.ts:332`; `menu-builder-form.component.ts:325` | `serverErrors = { _general: res.message \|\| '' }` then toast; spec `menu-builder.store.spec.ts:310` expects "Menu Name Already used" | generic text |
| `P/features/account/customer-segments/pages/customer-segment-form/customer-segment-form.component.ts:286-292` | `toast.error(..., err?.message)`; comment: backend rejects with "Title already used" / "Slug already used" | generic text |
| `P/features/account/recurring-journal/services/recurring-journal.service.ts:106-111` (list `:265`, view `:281`) | message surfaced via `ErrorService.handleError`; comment: backend blocks "cannot delete Recurring Journal with child Journals" | generic text instead of the reason |
| `P/features/employees/pages/employee-schedule/employee-schedule.component.ts:713` | `String(res?.msg ?? res?.message ?? '').replace(/^Error:\s*/, '')` into a toast | generic text, no logic dependency |
| `P/features/employees/pages/privilege-form/privilege-form.component.ts:946` | `e?.status === 403` shows `SYSTEM_ROLE_LOCKED`; otherwise `toast.error('COMMON.SAVE_FAILED', e?.message)` | status-based part unaffected; other errors generic |
| `P/features/promotions/services/promotions-api.service.ts:38-47`; `P/features/settings/media/pages/media-manager.component.ts:604` | toast with `error.error.message \|\| error.error \|\| error.message` + request path; media `result.error?.error?.message \|\| result.message \|\| 'Could not attach the image'` | generic text |
| `P/core/ai/assistant/assistant.service.ts:124,133` | `String(e?.error?.msg ?? e?.message ?? 'The lookup failed').slice(0,200)` is fed back to the model | the model is told the generic text |
| `W/features/cart/cart.api.ts:197-206`; `checkout.api.ts:186-201`; `booking.api.ts:113-119`; `generateMetaTags.service.ts:84-93` | display `msg`; cart/checkout also join `e.error.errors[].msg` into one string | shoppers see the generic text |

Specs that document verbatim reliance: `hr-error.spec.ts`, `menu-builder.store.spec.ts:310`, `privilege-form.system-role.spec.ts:96` (mocks `{status:403, message:'System role cannot be modified'}`).

### 6C. Places that show server text verbatim (representative, not line-by-line)

A broad grep for `.msg` / `.message` / `error.error.msg` over `invo-portal2/src` (non-spec) found about 624 lines, about 315 of which feed toasts, error signals or `showError`. The patterns are uniform:

- **Pattern A: `toast.error('…', typeof res === 'string' ? res : (res?.msg ?? ''))` and catch variant `e?.error?.msg ?? e?.message ?? ''`.** Account: `bills/components/apply-credit-to-bill-modal:127,129`; `bills-payment/pages/bill-payment-form:391,396`; `budget/pages/budget-form:154,242`; `components/customer-address-field:119`; `components/send-document-modal:144`; `credit-notes/components/apply-credit-to-invoices-modal:133`; `credit-notes/pages/credit-note-refund-form:164`; `customers/components/customer-quick-create-modal:81`; `customers/pages/customer-form:92`; `invoices/components/apply-credit-modal:135`; `invoices/components/invoice-link-modal:132`; `invoices/pages/invoice-payment:174`; `payments/pages/payment-form:418`; `purchase-orders/pages/auto-purchase-order-form:230`; `services/doc-actions-base.ts:44`; `services/document-form-base.ts:420,591`; `supplier-credits/components/apply-credit-to-bills-modal:130`; `supplier-credits/pages/supplier-credit-refund-form:182`; `suppliers/components/supplier-items-card:210,225`; `suppliers/components/supplier-quick-create-modal:74`; `suppliers/pages/supplier-form:92`; `vat-payment/components/pay-vat-payment-modal:151`; `vat-payment/pages/vat-payment-form:169`. Others: accept-reject-orders list `:137,142`; branch-payments list `:75`; feedback-settings-modal `:67`; manual-adjustment form `:227` and list `:109`; physical-count form `:340` and list `:131`; transfer form `:348`; price-management form `:236`; inventory-request convert/form/list/purchase-order-view; service-request `:93,91`; `core/ai/employee-ai-override:105`.
- **Pattern B: services that `throw new Error(res?.msg || '<fallback>')` and callers show `err.message`.** `features/employees/services/*` (asset, benefit, disciplinary, document, eos, file, leave, payroll, performance, gosi, holiday-calendar, payroll-run), `core/layout/services/employee-options.service.ts:178`, `sales-target.service.ts:82`, `companies-overview.service.ts:45,69`, `company-group-employees.service.ts:26`, `product-list.service.ts:31`, `bulk-tags-modal.component.ts:140`, `report-schedule.service.ts:108,114`, `tax-settings.service.ts:28,42`. The "Could not …" fallbacks show only when `msg` is empty.
- **Pattern C: error signals and banners.** `login`, `disconnect-branch-modal`, `connect-branch-modal`, `media-manager:604`, `settings/shipping:490-495`, website blog pages (`author`, `blog-index`, `category`, `post`, `search`, `tag`), website cart/checkout/booking pages.
- **Pattern D: `ErrorService.handleError` / `showError` callers.** `manual-journal-form:401`; `recurring-journal` form `:328`, list `:265`, view `:281`; `appointment` popover `:214` and form `:622,641,668`; `bulk-image:272`; `employee-services:140,152,191,240`; `price-change:145,196,370`; `products-availability:135`; `product-form:625`.

### 6D. Behaviour confirmed **not** to depend on text

401 / session-expired flow (status only); customer/supplier/product uniqueness probes use only `res.success` through `company/validateName` and `product/validateBarcode` (`customer-validators.ts:37`, `product-validators.ts:75`, `product-crud.service.ts:339,354`) **but** thrown HTTP errors there are swallowed with `catchError(() => of(null))`, so if the backend now throws a generic error for a duplicate instead of returning `{success:false}`, a duplicate would look valid (whether it returns or throws is unknown). `campaign-form` / `coupon-set-form` compare against client-created strings, not server text. `D/` has no interceptors and no error-text handling (grep for `msg`, `.message`, `errors`; not read in full).

---

## UNKNOWNS

- **No backend source was read.** Which `sortValue` keys, direction casings, `sort-info` header values, date formats and ids each endpoint accepts is unknown. Every "may not support" statement is unverified.
- Whether the backend is case-sensitive about `asc`/`desc` vs `ASC`/`DESC` (both are sent today).
- Whether `sortBy: null` is accepted on `product/getBranchProductsAvailability/` (a code comment says `{}` yields a column named "undefined").
- Whether `blog/getPostList` accepts `views` as `sortBy` (the type allows it; the UI never sends it).
- What `company/saveCollection` does with `data.sortBy` (`bestSelling`, …); the code only saves it.
- The backend maximum number of v2 `spec.sort` entries (the builder allows several, no cap in code).
- Whether the backend cap of 100 applies to every endpoint above or only to the `limit` body field (other mechanisms: `pageSize`, the `page-info` header on promotions, form-encoded `limit` on `getCustomizedReport`, GET query strings on `notification-logs` and `exportCatalogProducts`); what happens when `limit` is absent; whether `limit: null` on v2 export-all is now rejected.
- The exact route behind the banking `getTransactions` limit-100000 call (`accounts/getReconcilationsRecords` is a different call at `banking-overview.service.ts:102`); the exact path of the discount list (`product/getDiscountList` was not re-verified; the discount service shows `accounts/getDiscountList`).
- Which date shape the bills, bill-of-entry, PO, supplier-credit and expense **list** requests send (builders not read), the credit-notes list endpoint name, and the form setter shapes for bill/PO/supplier-credit dates; supplier statement date params.
- Whether the backend accepts non-padded `YYYY-M-D` (product movement), full ISO `Z` for `invoiceDate`/`paymentDate`, and `'yyyy-MM-dd HH:mm'` (expense); whether a date-only `toDate` is inclusive of that day.
- Whether the custom-report builder's UTC/local mismatch shifts days in practice (derived from code).
- Server-side escaping of `%`, `_`, `\` and quotes in `searchTerm` and in the `contains`/`beginsWith`/`endsWith` operators.
- Where a live storefront search box exists and what it sends (the listing client supports `search`; the product-list page never supplies it).
- Arabic UI strings were not searched for wildcard/operator wording.
- How `Customer.ParseJson` assigns `id` and `parentId`; whether the barcode validator's `getProductId` returns `'new'`, `null` or `''`; whether the router blocks employee HR tabs for `'new'`; what the banking-overview services do with `'0'`/`''`; whether any caller passes `''` or `'all'` into `getSupplierPayableByBranch` or `getInvoicesForCreditNote`.
- Whether the backend's generic error replaces only `msg`/`message` or also removes `error.code`, `data.code`, `data.errors[]` and `data[].message` (used by reports, AI, shipping, website comments); whether auth endpoints (`login`, `checkOTP`, `setNewPassword`, `resetPassword`) will also return the generic text; whether HR validation failures (HTTP 200) keep their specific text.
- The exact count of verbatim-display sites (the ~315/624 figures come from broad greps).
- `assign-tax-modal.component.ts:516` endpoint getter and the assistant chat relay endpoint were not traced; `customize-columns-modal.component.ts` (modified in the working tree) was not read end to end for sortability effects; spec files were not read for defaults.
- `D/` was only grepped for the relevant patterns, not read in full.

---

## FLAGS (collected)

**Needs a backend decision or fix.**
1. Keys the UI sends that look like display names or aliases rather than columns (Part 1F item 1), plus the three typo keys and four typo routes.
2. `qty` sortable on the products root list (dropped for children); `stockValue` explicitly not sortable because the server answers "Unknown sort column".
3. Direction casing: lowercase and UPPERCASE both reach the same endpoint families (promotions header, rails vs lists, media, banking).
4. "No sort" arrives as `{}`, omitted, `null`, `''`/empty-pair, direction-only, or a forced default; code comments say `{}` breaks several queries.
5. Non-standard sort shapes: `sort:{value,direction}` (feedbacks), bare `sortBy` + `sortDir` (blog admin, content library), `sort-info` header (promotions), `filter.sortBy[]` (reports), `spec.sort[]` with dotted keys (custom reports v2), `filter.sortDirection` only (banking).
6. Limits above 100: about 35 fixed 200–1000 loaders, exports at 999/250/5000, 100000 (banking, translations CSV), 10000 (chart-of-accounts import), page-size UIs at 200/500, unclamped URL `?limit=` on six screens, `pageSize` used instead of `limit` on `company/getThemeByType` and the alt-product loader, storefront `page_limit` and blog `count` without a maximum, recurring-journal list at 1000.
7. Date shapes: `'yyyy-MM-dd'`, UTC ISO `Z`, `'yyyy-MM-dd HH:mm'`; non-padded `YYYY-M-D` (product movement); snake_case `date_from`/`date_to` with `''` (logs); unvalidated URL date strings (report view, media, `filter_*`).
8. Search text is sent raw from hundreds of sites with no escaping; the list-page search is untrimmed; `columns` accompanies every list search.
9. Ids: `''` is sent in several bodies (`company/validateName` `id`/`branchId`, `product/validateBarcode` `productId`, stock/adjustment bodies, new-record models) and in URL paths (`getCustomerBranchReceivable` default `branchId = ''`, route-derived `''`); `'new'` is special-cased inconsistently (tax form).
10. Error text: `/Certificate not ready/i`, `/date\s*range/i`, three `hr-error.ts` text rules, and about 300 verbatim-display sites. Also `product-form` shows nothing when the save request throws, and the validators swallow thrown errors as "valid".

**Frontend-side observations (not backend issues).**
11. `ApiError.type` is declared but never set; the "grouped validation/business/auth modal" described in project notes is not backed by `extractErrors`.
12. The generic report view forwards a URL `sortValue` to every report without validating it.
13. `ListParams.sortBy` (`shared/models/common.models.ts:13-14`) is an unused bare-string shape; the list-page README example shows a different, older shape.
14. Page-type `sort_By` values (two vocabularies) are stored but never sent anywhere.
15. `getCustomizedReport` and `getCollectionProducts` have no callers found; `productListWithCustomeFields`, `getMenuProducts`, `getMenuProducts2` do not exist in the frontend.
