export interface Product {
  id: string;
  name: string;
  type: 'inventory' | 'serialized' | 'batch' | 'kit' | 'service' | 'package' | 'menuItem' | 'menuSelection' | 'tailoring' | 'matrix';
  sku: string;
  barcode: string;
  categoryName?: string;
  departmentName?: string;
  defaultPrice: number;
  unitCost: number;
  inventorySummary?: {
    qtySum: number;
    stockValue: number;
  };
  children?: Product[];
  childrenCount?: number;
  showChild?: boolean;
  pageNum?: number;
  pageLimit?: number;
}
