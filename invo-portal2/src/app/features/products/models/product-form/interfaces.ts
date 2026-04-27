// Nested array-item shapes used by the Product class.
// Kept loose on purpose — enriched per phase as sub-components are ported.

export interface BranchProduct {
  id?: any;
  branchId?: string;
  branchName?: string;
  price: number | null;
  buyDownPrice: number | null;
  buyDownQty: number | null;
  priceBoundriesFrom: number | null | '';
  priceBoundriesTo: number | null | '';
  selectedPricingType: '' | 'buyDownPrice' | 'priceBoundary' | 'priceByQty' | string;
  has_different_price?: boolean;
  priceByQty?: Array<{ qty: number | null; price: number | null }>;
  serials?: Array<{ unitCost: number | null; [k: string]: any }>;
  batches?: Array<{ prodDate: any; expireDate: any; onHand: number | null; [k: string]: any }>;
  [key: string]: any;
}

export interface KitBuilderItem {
  /** The PICKED product's id — backend's required field, named `productId`
   *  to mirror the saved payload (don't rename to `id`; the API rejects). */
  productId?: string;
  name?: string;
  qty: number | null;
  unitCost: number;
  UOM?: string;
  [key: string]: any;
}

export interface PackageItem {
  /** Picked product's id — backend's required field, named `productId` to
   *  mirror the legacy save payload (don't rename to `id`; the API rejects). */
  productId?: string;
  name?: string;
  qty: number | null;
  defaultPrice?: number;
  [key: string]: any;
}

export interface EmployeePrice {
  employeeId?: string;
  employeeName?: string;
  price: number | null;
  serviceTime: number | null;
  [key: string]: any;
}

export interface SupplierItem {
  supplierId?: string;
  supplierName?: string;
  supplierCode?: string;
  cost: number;
  minimumOrder: number;
  [key: string]: any;
}

export interface SelectionItem {
  id?: string;
  name?: string;
  noOfSelection: number;
  items: Array<{ defaultPrice: number; [k: string]: any }>;
  [key: string]: any;
}

export interface ProductRecipe {
  recipeId: string | null;
  inventoryId: string;
  name: string;
  UOM: string;
  unitCost: number;
  usages: number;
  [key: string]: any;
}

export interface ProductMedia {
  id: string;
  defaultUrl: string;
  thumbnailUrl?: string;
  [key: string]: any;
}

export interface CustomFieldValue {
  id: string;
  value: any;
  [key: string]: any;
}

export interface Tax {
  id: string;
  taxType?: 'flat' | 'stacked' | string;
  taxPercentage: number;
  taxes: Array<{ name: string; taxPercentage: number }>;
  [key: string]: any;
}
