// Main Product class — ported from InvoCloudFront2/src/app/core/models/product.ts.
// Preserved every field, getter, and method from the source. `afterDecimal`
// (for tax rounding) is a static value here; swap to CompanySettings when
// that service is ported.

import { Translation } from '@core/models/translation';
import { MathUtils } from './math-utils';
import {
  ProductImage,
  Nutrition,
  Measurement,
  ProductAttributes,
  InventorySummary,
  PriceModel,
} from './nested';
import {
  BranchProduct,
  KitBuilderItem,
  PackageItem,
  EmployeePrice,
  SupplierItem,
  SelectionItem,
  ProductRecipe,
  ProductMedia,
  Tax,
} from './interfaces';

export class Product {
  static afterDecimal = 3;

  printBranch: any = '';
  printQty: any;
  id: any = '';

  index = 0;
  brandid = '';
  price = 0;
  name = '';
  UOM = '';
  barcode = '';
  barcodes: any[] = [];
  barcodesArr: any[] = [];
  branchProduct: BranchProduct[] = [];
  branchesUnitCost: any[] | null = null;
  departmentId: string | null = null;
  departmentName: string | null = null;
  categoryId: string | null = null;
  childQty = 1;
  companyId = '';
  categoryName = '';
  createdAt = '';
  defaultImage = '';
  base64Image = '';
  defaultPrice = 0;
  description = '';
  employeePrices: EmployeePrice[] = [];
  kitBuilder: KitBuilderItem[] = [];
  priceModel: PriceModel = new PriceModel();
  optionGroups: any[] = [];
  defaultOptions: any[] = [];
  package: PackageItem[] = [];
  parentId: any = null;
  supplierId: any = '';
  supplierName: any = '';
  parent: any = {};
  productMatrixId: any = '';
  productMedia: ProductMedia[] = [];
  quickOptions: any[] = [];
  recipes: ProductRecipe[] = [];
  selection: SelectionItem[] = [];
  serviceStatus: any;
  serviceTime = 30;
  tags: string[] = [];
  tagsArr: any[] = [];
  taxes: any[] = [];
  translation: Translation = new Translation();
  type = '';
  unitCost: number | null = null;
  maxItemPerTicket = 0;
  warning = '';
  weightUnit = '';
  serial = '';
  batch = '';
  onHand: any = '';
  expireDate: any;
  isTaxable = true;

  customFields: { [id: string]: any } = {};
  weightUnitEnabled = false;
  selectedToPick = false;
  tag = false;
  commissionPercentage = false;
  commissionAmount = 0;
  imageType = '';
  color = '';
  kitchenName = '';
  inventorySummary: InventorySummary = new InventorySummary();
  taxId: any = null;
  taxPercentage: any = 0;
  isChild = false;
  preparationTime = 0;
  mediaId: string | null = null;
  mediaUrl: ProductImage = new ProductImage();
  orderByWeight = false;
  isDiscountable: boolean | null = true;
  nutrition: Nutrition = new Nutrition();
  productAttributes: ProductAttributes[] = [];
  tabBuilder: Record<string, any> = {};
  sku = '';
  alternativeProducts: string[] = [];
  employeeId: any = '';
  suppliers: SupplierItem[] = [];
  comparePriceAt = 0;
  location = '';
  productDeduction: string[] = [];
  threeDModelId = '';
  threeDModel: ProductImage | null = new ProductImage();
  measurements: Measurement = new Measurement();

  isPurchaseItem = true;
  purchaseAccountId: any = null;
  isSaleItem = true;
  isParent = true;
  saleAccountId: any = null;

  // display-only
  showInSearch: any = null;
  disabled = false;
  isChanged = false;
  alternativeProductsTemp: any[] = [];
  tempProductDeduction: any[] = [];
  isDeleted = false;
  isInclusiveTax = false;
  found = false;
  usage = 0;
  pageNum = 1;
  pageLimit = 15;
  showChild = false;
  children: any;
  url = '';
  menuUrl = '';
  shopUrl = '';

  weight = 0;
  weightUOM = 'KG';
  shippingEnabled = false;

  custom: any = {};

  taxAmount = 0;
  taxesDisplay: any[] = [];

  constructor() {
    if (this.isChild) this.onTypeChildQty();
  }

  // ── Name / translation sync ────────────────────────────────────────────────
  setNameWithSync(value: string, lang: 'en' | 'ar') {
    this.name = value;
    if (lang === 'ar') {
      const wasSynced = !this.translation.name.en || this.translation.name.en === this.translation.name.ar;
      this.translation.name.ar = value;
      if (wasSynced) this.translation.name.en = value;
    } else {
      const wasSynced = !this.translation.name.ar || this.translation.name.ar === this.translation.name.en;
      this.translation.name.en = value;
      if (wasSynced) this.translation.name.ar = value;
    }
  }

  setalternativeProductsTemp(products: Product[]) {
    this.alternativeProducts.forEach((element, index) => {
      const product = products.find((f) => f.id == element);
      if (product) {
        this.alternativeProductsTemp.push(product);
        const itemIndex = products.findIndex((f) => f.id == element);
        products.splice(itemIndex, 1);
      } else {
        this.alternativeProducts.splice(index, 1);
      }
    });
  }

  checkIfTagExists(tag: any) {
    return this.tagsArr.filter((f) => f == tag.tag).length > 0;
  }
  handleTagClick(tag: any, event: any) {
    if (!this.checkIfTagExists(tag)) this.tagsArr.push(tag.tag);
    event.stopPropagation();
  }

  // ── Tax calculation ────────────────────────────────────────────────────────
  calculateTaxAmount(taxList: Tax[], defaultPrice: any = null) {
    if (taxList.length > 0) {
      if (this.taxId != '' && this.taxId != null) {
        const foundedTax: any = taxList.find((f) => f.id == this.taxId);
        if (!foundedTax) return;

        let totaltax = 0;
        const taxType = foundedTax.taxType || '';
        const taxes = foundedTax.taxes;

        switch (taxType) {
          case 'flat': {
            const basePrice = this.getBasePrice(
              defaultPrice == null ? this.defaultPrice : defaultPrice,
              foundedTax
            );
            if (taxes && taxes.length > 0) {
              taxes.forEach((element: any) => {
                const taxAmount = MathUtils.multiply(basePrice, element.taxPercentage / 100, Product.afterDecimal);
                this.taxesDisplay.push(`${element.name} (${element.taxPercentage}%):` + taxAmount);
                totaltax += taxAmount;
              });
            }
            break;
          }
          case 'stacked': {
            let total = this.getBasePrice(
              defaultPrice == null ? this.defaultPrice : defaultPrice,
              foundedTax
            );
            if (taxes && taxes.length > 0) {
              taxes.forEach((element: any) => {
                const taxAmount = MathUtils.multiply(total, element.taxPercentage / 100, Product.afterDecimal);
                totaltax += taxAmount;
                total += taxAmount;
                this.taxesDisplay.push(`${element.name} (${element.taxPercentage}%):` + taxAmount);
              });
            }
            break;
          }
          default:
            totaltax = this.isInclusiveTax
              ? MathUtils.division(this.defaultPrice * foundedTax.taxPercentage, 100 + foundedTax.taxPercentage, Product.afterDecimal)
              : MathUtils.multiply(this.defaultPrice, foundedTax.taxPercentage / 100, Product.afterDecimal);
            break;
        }

        this.taxAmount = totaltax;
      } else {
        this.taxAmount = 0;
      }
    }
  }

  getBasePrice(total: number, tax: Tax) {
    let taxesAmount = tax.taxType == 'stacked' ? 1 : 0;

    tax.taxes.forEach((element: any) => {
      if (tax.taxType == 'flat') {
        taxesAmount = MathUtils.add(taxesAmount, element.taxPercentage, Product.afterDecimal);
      } else {
        taxesAmount = MathUtils.multiply(
          taxesAmount,
          MathUtils.division(MathUtils.add(element.taxPercentage, 100, Product.afterDecimal), 100, Product.afterDecimal),
          Product.afterDecimal,
        );
      }
    });

    if (tax.taxType == 'flat') {
      const taxTotaltemp = MathUtils.division(MathUtils.add(100, taxesAmount, Product.afterDecimal), 100, Product.afterDecimal);
      total = MathUtils.division(total, taxTotaltemp, Product.afterDecimal);
    } else if (tax.taxType == 'stacked') {
      total = MathUtils.division(total, taxesAmount, Product.afterDecimal);
    }
    return total;
  }

  // ── Derived / validation getters (all preserved) ───────────────────────────

  get checkImageObject() { return Object.keys(this.mediaUrl).length; }
  get getPriceWithTax() { return this.defaultPrice + this.defaultPrice * (this.taxPercentage / 100); }

  get getTags() {
    const tags: any[] = [];
    this.tagsArr.forEach((e) => tags.push(e.value));
    return tags;
  }

  get getBarcodes() {
    const barcodes: any[] = [];
    this.barcodesArr.forEach((e) => barcodes.push({ barcode: e.value }));
    return barcodes;
  }

  get getProfitValue() {
    if (this.unitCost == null) this.unitCost = 0;
    let price = this.defaultPrice;
    if (this.isInclusiveTax) price -= this.taxAmount;
    return price - this.unitCost;
  }

  get getMarginValue() {
    if (this.defaultPrice == 0) return 0;
    const margin = (this.getProfitValue / this.defaultPrice) * 100;
    return isNaN(margin) ? 0 : margin;
  }

  get checkUOMIsEmpty() { return this.UOM == '' || this.UOM == null; }
  get checkBarcodeIsEmpty() { return this.barcode == '' || this.barcode == null; }
  get checkUnitCostIsEmpty() { return this.unitCost == null && !this.isChild; }
  get checkUnitCostIsZero() { return this.unitCost == 0 && !this.isChild; }
  get checkPriceIsEmpty() { return this.defaultPrice == null; }
  get checkPriceIsZero() { return this.defaultPrice == 0; }
  get checkNameIsEmpty() { return this.name == '' || this.name == null; }
  get checkParentIsEmpty() { return this.isChild && this.parentId == null; }
  get checkChildQtyLessThanOne() { return this.childQty < 1; }
  get checkChildQtyIsEmpty() { return this.childQty == null; }

  get checkBranchPriceEmptyNo() {
    return this.branchProduct?.length
      ? this.branchProduct.filter((f) => f.price == null && f.has_different_price).length
      : 0;
  }

  get checkBranchBuyDownQtyEmptyNo() {
    return this.branchProduct?.length
      ? this.branchProduct.filter((f) => f.buyDownQty == null && f.selectedPricingType == 'buyDownPrice').length
      : 0;
  }

  get checkBranchBuyDownPriceEmptyNo() {
    return this.branchProduct?.length
      ? this.branchProduct.filter((f) => f.buyDownPrice == null && f.selectedPricingType == 'buyDownPrice').length
      : 0;
  }

  get checkBranchPriceBoundaryFromEmptyNo() {
    return this.branchProduct?.length
      ? this.branchProduct.filter((f) => f.priceBoundriesFrom == null && f.selectedPricingType == 'priceBoundary').length
      : 0;
  }

  get checkBranchPriceBoundaryToEmptyNo() {
    return this.branchProduct?.length
      ? this.branchProduct.filter((f) => f.priceBoundriesTo == null && f.selectedPricingType == 'priceBoundary').length
      : 0;
  }

  get checkBranchPriceBoundaryToComparedWithFrom() {
    return this.branchProduct?.length
      ? this.branchProduct.filter(
          (f) =>
            ((f.priceBoundriesTo as number) < (f.priceBoundriesFrom as number) ||
              f.priceBoundriesTo == f.priceBoundriesFrom) &&
            f.selectedPricingType == 'priceBoundary',
        ).length
      : 0;
  }

  get checkBranchPriceByQtyQEmptyNo() {
    let totalErr = 0;
    if (this.branchProduct?.length) {
      this.branchProduct.forEach((b) => {
        totalErr += b?.priceByQty?.filter(
          (f: any) => f.qty == null && b.selectedPricingType == 'priceByQty',
        ).length ?? 0;
      });
    }
    return totalErr;
  }

  get checkBranchPriceByQtyPriceEmptyNo() {
    let totalErr = 0;
    if (this.branchProduct?.length) {
      this.branchProduct.forEach((b) => {
        totalErr += b?.priceByQty?.filter(
          (f: any) => f.price == null && b.selectedPricingType == 'priceByQty',
        ).length ?? 0;
      });
    }
    return totalErr;
  }

  get checkSerialUnitCostErr() {
    let totalErr = 0;
    if (this.branchProduct?.length) {
      this.branchProduct.forEach((b) => {
        totalErr += b?.serials?.filter((f: any) => f.unitCost == null).length ?? 0;
      });
    }
    return totalErr;
  }

  get checkExpiryDateIsLargerThanProduct() {
    let totalErr = 0;
    if (this.branchProduct?.length) {
      this.branchProduct.forEach((b) => {
        totalErr += b?.batches?.filter((f: any) => f.prodDate >= f.expireDate).length ?? 0;
      });
    }
    return totalErr;
  }

  get checkInBatchesOnHandIsNotEmpty() {
    let totalErr = 0;
    if (this.branchProduct?.length) {
      this.branchProduct.forEach((b) => {
        totalErr += b?.batches?.filter((f: any) => f.onHand == null).length ?? 0;
      });
    }
    return totalErr;
  }

  get checkInKitQtyIsNotEmpty() {
    return this.kitBuilder?.length ? this.kitBuilder.filter((f) => f.qty == null).length : 0;
  }

  get calculateTotalUnitCostForKit() {
    let total = 0;
    if (this.kitBuilder?.length) {
      this.kitBuilder.forEach((k) => { total += (k?.unitCost ?? 0) * (k?.qty ?? 0); });
    }
    return total;
  }

  get calculateTotalUnitCostPackage() {
    let total = 0;
    if (this.package?.length) this.package.forEach((p) => { total += (p?.qty ?? 0); });
    return total;
  }

  get calculateTotalUnitCostForSuppliers() {
    let total = 0;
    if (this.suppliers?.length) this.suppliers.forEach((s) => { total += (s?.cost ?? 0) * (s?.minimumOrder ?? 0); });
    return total;
  }

  get checkIfBarcodeExistsInBarcodes() {
    return this.getBarcodes?.length
      ? this.getBarcodes.filter((f: any) => f.barcode == this.barcode).length
      : 0;
  }

  get checkIfEmpPricesServiceTimeEmpty() {
    return this.employeePrices?.length
      ? this.employeePrices.filter((f) => f.serviceTime == null || f.serviceTime == 0).length
      : 0;
  }

  get checkIfPackageQtyIsEmpty() {
    return this.package?.length
      ? this.package.filter((f) => f.qty == null || f.qty == 0).length
      : 0;
  }

  get checkIfEmpPricesPriceIsEmpty() {
    return this.employeePrices?.length
      ? this.employeePrices.filter((f) => f.price == null).length
      : 0;
  }

  transform(value: number) {
    return parseFloat(value.toFixed(Product.afterDecimal));
  }

  onTypeChildQty() {
    this.unitCost = this.transform((this.parent?.unitCost ?? 0) / (this.childQty || 1));
  }

  totalPrice(param: any = {}) {
    const { withDiscount = false } = param;
    let list: any[] = [];
    let total = 0;

    if (this.type != null) {
      if (this.type === 'package') {
        list = this.package;
        if (list?.length) {
          list.forEach((element: any) => { total += element.defaultPrice * element.qty; });
          return withDiscount ? total - this.priceModel.discount : total;
        }
      } else if (this.type === 'menuSelection') {
        list = this.selection;
        if (list?.length) {
          list.forEach((level: SelectionItem) => {
            const sorted = level.items
              .filter((item: any) => item.defaultPrice != null)
              .sort((a: any, b: any) => a.defaultPrice - b.defaultPrice);
            const selected = sorted.slice(0, level.noOfSelection);
            selected.forEach((item: any) => { total += +item.defaultPrice; });
          });
          return withDiscount ? total - this.priceModel.discount : total;
        }
      }
    }

    return total;
  }

  // ── Build from raw API JSON ────────────────────────────────────────────────
  ParseJson(json: any): void {
    for (const key in json) {
      if (key === 'priceModel') {
        const pm = new PriceModel();
        pm.ParseJson(json[key]);
        this.priceModel = pm;
      } else if (key === 'inventorySummary') {
        const inv = new InventorySummary();
        inv.ParseJson(json[key]);
        this.inventorySummary = inv;
      } else if (key === 'measurements') {
        const m = new Measurement();
        m.ParseJson(json[key]);
        this.measurements = m;
      } else if (key === 'mediaUrl') {
        const mu = new ProductImage();
        mu.ParseJson(json[key]);
        this.mediaUrl = mu;
      } else if (key === 'nutrition') {
        const n = new Nutrition();
        n.ParseJson(json[key]);
        this.nutrition = n;
      } else if (key === 'translation') {
        const t = new Translation();
        t.ParseJson(json[key]);
        this.translation = t;
      } else if (key === 'productAttributes' && Array.isArray(json[key])) {
        this.productAttributes = json[key].map((raw: any) => {
          const a = new ProductAttributes();
          a.ParseJson(raw);
          return a;
        });
      } else if (key === 'tabBuilder') {
        const v = json[key];
        this.tabBuilder = v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : {};
      } else if (key === 'customFields') {
        if (json[key] && typeof json[key] === 'object' && !Array.isArray(json[key])) {
          this.customFields = { ...json[key] };
        } else if (Array.isArray(json[key])) {
          const obj: any = {};
          json[key].forEach((f: any) => {
            if (f.id && f.value !== undefined) obj[f.id] = f.value;
          });
          this.customFields = obj;
        } else {
          this.customFields = {};
        }
      } else if (key in this) {
        (this as any)[key] = json[key];
      }
    }

    if (this.isTaxable == null) this.isTaxable = true;
    if (this.isPurchaseItem == null) this.isPurchaseItem = true;
    if (this.isSaleItem == null) this.isSaleItem = true;

    // Normalise server-side `barcodes: [{barcode}]` and `tags: [...]` into the
    // UI-side `barcodesArr: [{value}]` / `tagsArr: [{value}]` shapes that the
    // alias-barcodes and tags editors consume. Without this, existing aliases
    // load into `barcodes` only and the editor renders empty on edit.
    if (Array.isArray(this.barcodes) && this.barcodes.length > 0 && this.barcodesArr.length === 0) {
      this.barcodesArr = this.barcodes.map((b: any) => ({ value: b?.barcode ?? b?.value ?? '' }));
    }
    if (Array.isArray(this.tags) && this.tags.length > 0 && this.tagsArr.length === 0) {
      this.tagsArr = this.tags.map((t: any) => ({ value: typeof t === 'string' ? t : (t?.value ?? '') }));
    }
  }
}
