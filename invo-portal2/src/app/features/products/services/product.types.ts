// ─── Shared types for all product sub-services ──────────────────────────────

export interface ProductListParams {
  page: number;
  limit: number;
  searchTerm: string;
  sortBy: { sortValue?: string; sortDirection?: 'asc' | 'desc' };
  filter: { types?: string[]; departments?: string[]; categories?: string[]; tags?: string[] };
  columns?: string[];
}

export interface ProductListResponse {
  list: any[];
  count: number;
  pageCount: number;
}

export interface DropdownPage {
  items: { label: string; value: string }[];
  hasMore: boolean;
}

// ─── Stock / Kit ─────────────────────────────────────────────────────────────

export interface BranchSummary {
  branch:      string;
  branchId?:   string;
  id?:         string;
  onHand:      number;
  stockValue?: number;
}

export interface KitBuilderUsage {
  productName: string;
  UOM?:        string;
  onHand:      number;
  qty:         number;
  unitCost:    number;
}

export interface KitMaxQtyResponse {
  success: boolean;
  data:    { maximumQty: number; kitBuilderUsages: KitBuilderUsage[] };
  message: string;
}

export interface KitActionResponse {
  success: boolean;
  data:    { onHand?: number; [k: string]: any };
  message: string;
}

// ─── Activity ────────────────────────────────────────────────────────────────

export interface ProductActivity {
  [key: string]: string | number | null | undefined;

  'Last PO'?:         string | null;
  'Last PO Date'?:    string | null;
  'Last PO Qty'?:     number | null;
  'purchaseId'?:      string | null;

  'Last Bill'?:       string | null;
  'Last Bill Date'?:  string | null;
  'Last Bill Qty'?:   number | null;
  'billId'?:          string | null;

  'Last Sold'?:       string | null;
  'Last Sold Date'?:  string | null;
  'Last Sold Qty'?:   number | null;
  'invoiceId'?:       string | null;

  'Last Supplier'?:   string | null;
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export interface SalesByServiceRow {
  serviceName:     string;
  net_units:       number;
  net_units_pct:   number;
  net_revenue:     number;
  net_revenue_pct: number;
}

export interface Last12MonthRow {
  month_label:    string;
  sales_amount:   number | string;
  return_amount:  number | string;
  net_amount:     number | string;
}

export interface SalesByDayRow {
  day:                    string;
  sales_qty:              number;
  sales_amount_with_tax:  number | string;
  return_qty:             number;
  return_amount_with_tax: number | string;
  net_qty:                number;
  net_amount:             number | string;
}

export interface ProductSalesStats {
  sales_figure:              number;
  sales_figure_change_pct:   number | null;
  total_sales:               number;
  total_sales_change_pct:    number | null;
  units_sold:                number;
  units_sold_change_pct:     number | null;
}

export interface ProductSalesRow {
  createdAt:          string;
  transactionId?:     string;
  transactionNumber?: string;
  transactionType?:   string;
  branchName?:        string;
  customerName?:      string;
  type?:              string;
  qty?:               number;
  price?:             number;
  subTotal?:          number;
  taxTotal?:          number;
  total?:             number;
}

export interface ProductSalesPage {
  list:    ProductSalesRow[];
  hasNext: boolean;
  count:   number;
}

// ─── Purchase History ────────────────────────────────────────────────────────

export interface PurchaseHistoryRow {
  supplierName?: string;
  supplierId?:   string;
  billingNumber?: string;
  billId?:        string;
  billingDate?:   string;
  qty?:           number;
  unitCost?:      number;
  taxTotal?:      number;
  total?:         number;
}

export interface PurchaseHistoryPage {
  list:      PurchaseHistoryRow[];
  pageCount: number;
  count:     number;
}

// ─── Product Movement ────────────────────────────────────────────────────────

export interface ProductMovementRow {
  type?:            string;
  transactionId?:   string;
  branchName?:      string;
  createdAt?:       string;
  qtyUsage?:        number;
  qtyBalance?:      number;
  cost?:            number;
  costBalance?:     number;
  unitCost?:        number;
}

export interface ProductMovementPage {
  records:   ProductMovementRow[];
  pageCount: number;
  count:     number;
}
