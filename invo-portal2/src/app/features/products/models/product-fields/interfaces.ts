import { FieldTemplate } from './field-template';

// Ported from InvoCloudFront2 product-form — drives per-type visibility/validation.
// This file holds the shared interfaces only; concrete per-type configs live
// alongside in `./<type>.fields.ts` and are composed by `./index.ts`.

export type { FieldTemplate };

export interface Fields {
  name: FieldTemplate;
  barcode: FieldTemplate;
  SKU: FieldTemplate;
  description: FieldTemplate;
  pricing: PricingFields;
  inventory?: boolean;
  inventoryDetails?: InventoryDetailsFields;
  suppliers: SuppliersFields;
  kitBuilder?: KitBuilderDetails;
  kitDetails?: KitDetails;
  image: boolean;
  department: FieldTemplate;
  category: FieldTemplate;
  brand: FieldTemplate;
  preparationTime: FieldTemplate;
  serviceTime: FieldTemplate;
  orderByWeight: FieldTemplate;
  discountableInPOS: FieldTemplate;
  isTaxable: FieldTemplate;
  maxItemPerTicket: FieldTemplate;
  kitchenName: FieldTemplate;
  tags: FieldTemplate;
  itemMessage: FieldTemplate;
  afterServiceDescription: FieldTemplate;
  warning: FieldTemplate;
  aliasBarcodes: FieldTemplate;
  aliasBarcodesList: FieldTemplate;
  altProduct: FieldTemplate;
  productAttributes?: FieldTemplate;
  nutrition?: nutritionFields;
  priceByTeam?: PriceByTeam;
  branchProduct: branchProductFields;
  packageBuilder?: PackageBuilder;
  menuItemDetails?: boolean;
  recipe?: RecipesDetails;
  menuSelection?: MenuSelection;
  quickOptions?: FieldTemplate;
  defaultOptions?: FieldTemplate;
  optionGroups?: FieldTemplate;
  employeePrices?: FieldTemplate;
  productDeduction?: FieldTemplate;
  measurements?: Measurements;
  customFields: FieldTemplate;
  shippingOptions?: ShippingOptions;
  isPurchaseItem?: FieldTemplate;
  purchaseAccount?: FieldTemplate;
  isSaleItem?: FieldTemplate;
  saleAccount?: FieldTemplate;
}

export interface PricingFields {
  defaultPrice: FieldTemplate;
  compareAtPrice: FieldTemplate;
  profit: FieldTemplate;
  unitCost: FieldTemplate;
  adjustUnitCost?: FieldTemplate;
  tax: FieldTemplate;
  commissionAmount: FieldTemplate;
  priceModel: FieldTemplate;
  discount: FieldTemplate;
}

export interface ShippingOptions {
  isVisible: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  weight: FieldTemplate;
  weightUOM: FieldTemplate;
}

export interface Measurements {
  isVisible: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  minSelect: FieldTemplate;
  shoulder: FieldTemplate;
  sleeve: FieldTemplate;
  armholeGrith: FieldTemplate;
  upperarmGrith: FieldTemplate;
  wristGrith: FieldTemplate;
  frontShoulderToWaist: FieldTemplate;
  bustGrith: FieldTemplate;
  waistGrith: FieldTemplate;
  hipGrith: FieldTemplate;
  acrossShoulder: FieldTemplate;
  thigh: FieldTemplate;
  ankle: FieldTemplate;
  bodyHeight: FieldTemplate;
  napeOfNeckToWaist: FieldTemplate;
  outsteam: FieldTemplate;
  insideLeg: FieldTemplate;
}
export interface RecipesDetails {
  isVisible: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  usages: FieldTemplate;
}
export interface PackageBuilder {
  isVisible: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  productQty: FieldTemplate;
}

export interface PriceByTeam {
  isVisible: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  serviceTime: FieldTemplate;
  price: FieldTemplate;
}

export interface MenuSelection {
  isVisible: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  menuSelectionItems: FieldTemplate;
}

export interface KitDetails {
  isVisible: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  UOM: FieldTemplate;
}

export interface KitBuilderDetails {
  isVisible: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  qty: FieldTemplate;
}

export interface InventoryDetailsFields {
  UOM: FieldTemplate;
  parentItem: FieldTemplate;
  isChildItem: FieldTemplate;
  childQty: FieldTemplate;
}
export interface branchProductFields {
  available: boolean;
  availableOnline: boolean;
  differentPrice: boolean;
  onHand: FieldTemplate;
  price: FieldTemplate;
  pricingType: FieldTemplate;
  buyDownPrice: FieldTemplate;
  buyDownQty: FieldTemplate;
  priceBoundriesFrom: FieldTemplate;
  priceBoundriesTo: FieldTemplate;
  priceByQty: PriceByQtyFields;
  buildBreak: boolean;
  serials: SerialDetailsFields;
  batches: BatchDetailsFields;
  location: FieldTemplate;
  openingBalance?: FieldTemplate;
  openingBalanceCost?: FieldTemplate;
  reorderPoint: FieldTemplate;
  unitCost?: FieldTemplate;
  reorderLevel: FieldTemplate;
}

export interface SerialDetailsFields {
  isVisible: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  unitCost: FieldTemplate;
}

export interface SuppliersFields {
  isVisible: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  code: FieldTemplate;
  minOrder: FieldTemplate;
  unitCost: FieldTemplate;
}

export interface BatchDetailsFields {
  isVisible: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  barcode: FieldTemplate;
  batch: FieldTemplate;
  onHand: FieldTemplate;
  unitCost: FieldTemplate;
  productDate: FieldTemplate;
  expireDate: FieldTemplate;
}

export interface nutritionFields {
  isVisible: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  kcal: FieldTemplate;
  fat: FieldTemplate;
  carb: FieldTemplate;
  protien: FieldTemplate;
}

export interface PriceByQtyFields {
  qty: FieldTemplate;
  price: FieldTemplate;
}
