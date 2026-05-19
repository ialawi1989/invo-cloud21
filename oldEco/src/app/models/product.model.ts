import { OptionGroup } from "./option_groups.model";
import { Package } from "./package.model";
import { Selection } from "./selection.model";
import { TaxData } from "./taxData.model";

export class Product {
  id: string = "";
  name: string = "";
  description?: string;
  translation: { [key: string]: any } = {};
  type: string = "";
  defaultPrice: number = 0;
  productMinPrice: number = 0;
  discountAmount: number = 0;
  maxItemPerTicket: number = 0;
  productAttributes: any[] = [];
  comparePriceAt: number = 0;
  productTaxes: { [key: string]: any } = {};
  mediaUrl?: any;
  hasOptions: boolean = false;
  branches: { [key: string]: any }[] = [];
  brandName?: string;
  quickOptions: any[] = [];
  defaultOptions:any [] = [];
  optionGroups: OptionGroup[] = [];
  selection: Selection[] = [];
  package: Package[] = [];
  branchProduct: any[] = [];
  quantity: number = 0;
  priceModel: any;
  branchId: string = "";
  price: number = 0;
  minSelectable: number = 0;
  maxSelectable: number = 0;
  isDiscountable: boolean = false;
  discountPercentage: boolean = false;
  medias: any = [];
  slideImages: any = [];
  tags: any = [];
  groupType: string = '';

  fixedSelection: any;
  fixedPackage: any;
  selectedMenuSelectionOptions: any;
  selectedPackageOptions: any;

  measurements: any = {};
  dimensions: any = [];
  variants: any = [];
  matrixBarcode: string = "";
  index: any = {};
  measurementsArray: any[] = [];
  productMatrixId: string = "";
  sku: string = "";
  selectedVariant: any;

  threeDModelUrl: string | null = null;
  file3dUrl: string = "";
  file3dType: string = "";

  constructor(initialData?: Partial<Product>) {
    if (initialData) {
      Object.assign(this, initialData);
    }
  }

  ParseJson(json: any): void {
    if (!json) return;

    this.id = json.id ?? "";
    this.name = json.name ?? "";
    this.description = json.description;
    this.translation = json.translation ?? {};
    this.type = json.type ?? "";
    this.defaultPrice = parseFloat(json.defaultPrice) || 0;
    this.productMinPrice = parseFloat(json.productMinPrice) || 0;
    this.discountAmount = json.discountAmount ?? 0;
    this.maxItemPerTicket = json.maxItemPerTicket ?? 0;
    this.productAttributes = json.productAttributes ?? [];
    this.comparePriceAt = json.comparePriceAt ? parseFloat(json.comparePriceAt) : 0;
    this.productTaxes = json.productTaxes ?? {};
    this.mediaUrl = json.mediaUrl ?? {};
    this.hasOptions = json.hasOptions ?? false;
    this.branches = json.branches ?? [];
    this.tags = json.tags ?? [];
    this.brandName = json.brandName;
    this.quickOptions = json.quickOptions ?? [];
    this.defaultOptions = json.defaultOptions ?? [];
    this.optionGroups = (json.optionGroups || [])
      .map((og: any) => {
        const group = new OptionGroup();
        group.ParseJson(og);
        return group;
      })
      .sort((a: OptionGroup, b: OptionGroup) => (a.index || 0) - (b.index || 0));
    this.selection = (json.selection || []).map((sel: any) => {
      const s = new Selection();
      s.ParseJson(sel);
      return s;
    });
    this.package = json.package ?? [];
    this.branchProduct = json.branchProduct ?? [];
    this.fixedSelection = json.fixedSelection ?? "";
    this.priceModel = json.priceModel ?? "";
    this.branchId = json.branchId ?? "";
    this.price = json.price ?? 0;
    this.fixedPackage = json.fixedPackage ?? "";
    this.minSelectable = json.minSelectable ?? 0;
    this.maxSelectable = json.maxSelectable ?? 0;
    this.selectedMenuSelectionOptions = json.selectedMenuSelectionOptions ?? [];
    this.selectedPackageOptions = json.selectedPackageOptions ?? [];
    this.isDiscountable = json.isDiscountable ?? false;
    this.discountPercentage = json.discountPercentage ?? false;
    this.medias = json.medias ?? [];
    this.slideImages = json.slideImages ?? [];
    this.groupType = json.groupType ?? '';
    this.measurements = json.measurements ?? {};
    this.dimensions = json.dimensions ?? [];
    this.variants = json.variants ?? [];
    this.matrixBarcode = json.matrixBarcode ?? "";
    this.index = json.index ?? "";
    this.measurementsArray = json.measurementsArray ?? [];
    this.productMatrixId = json.productMatrixId ?? "";
    this.sku = json.sku ?? "";
    this.selectedVariant = json.selectedVariant ?? "";
    this.threeDModelUrl = json.threeDModelUrl ?? "";
    this.file3dUrl = json.file3dUrl ?? "";
    this.file3dType = json.file3dType ?? "";
  }

  calculateDiscountedPrice(): number {
    let productPrice = this.calculateOriginalPrice();
    let discount = this.discountAmount ?? 0;
    return productPrice - (productPrice * discount / 100);
  }

  calculateOriginalPrice(): number {
    let price = this.defaultPrice === 0
      ? this.branchProduct?.[0]?.price ?? 0
      : this.defaultPrice ?? 0;

    if (!price) {
      return 0;
    }
    const totalPrice = price;
    return totalPrice;
  }

  checkProductAvailability() {
    if (this.type === "menuItem"
      || this.type === "service"
      || this.type === "menuSelection"
      || this.type === "package"
      || this.type === "tailoring"
    ) {
      this.quantity = 0;
    } else {
      if (this.branches.length > 0) {
        if (this.branches[0] && this.branches[0]["onHand"]) {
          this.quantity = this.branches[0]["onHand"] ?? 0;
          if (this.quantity <= 0) {
            this.quantity = Math.max(...this.branches?.map(branch => branch["onHand"])) || 0;
          }
        }
      } else {
        if (this.branches[0] && this.branches[0]["onHand"]) {
          this.quantity = this.branchProduct[0]['onHand'];
        }
      }
    }

    return this.quantity > 0;
  }

  getConvertedProductPrice(hasDiscount: boolean, rate: number, afterDecimal: number) {
    var price = ((hasDiscount ? this.calculateDiscountedPrice() : this.calculateOriginalPrice()) / (rate || 0)) || 0;
    return price.toFixed(afterDecimal);
  }

  getConvertedProductPrice2(price: number, rate: number, afterDecimal: number) {
    price = price / (rate || 0) || 0;
    return price.toFixed(afterDecimal);
  }

  showAddCartButton() {
    return ((this.type === 'menuItem' && this.hasOptions === false && this.price > 0) ||
      (this.quantity > 0 || this.quantity == null)) &&
      !this.showViewOptionButton();
  }

  showViewOptionButton() {
    return (this.type === 'menuItem' && this.hasOptions) ||
      (this.type === 'menuSelection' || this.type === 'package') ||
      (this.type == "tailoring" && this.measurements?.length > 0) ||
      (this.productMatrixId != undefined && this.productMatrixId != null && this.productMatrixId != '') ||
      ((this.price === 0) && (this.quantity == null || this.quantity > 0));
  }


  showOutOfStockButton() {
    return !this.showAddCartButton() && !this.showViewOptionButton();
  }

  calculateProductTax(price: any, taxData: any, isInclusiveTax: any) {
    let tax = new TaxData();
    let taxTotal = 0;
    tax.ParseJson(taxData);
    if (tax.id != '' && tax.id != null) {
      if (tax.taxes != null && tax.taxes.length > 0 && JSON.stringify(tax.taxes) != '[]' && Array.isArray(tax.taxes)) {
        // Additional logic can be implemented if needed
      } else {
        taxTotal = isInclusiveTax ? +Number((price * tax.taxPercentage) / (100 + tax.taxPercentage)) : +Number((price) * (tax.taxPercentage / 100));
      }
    }
    return taxTotal;
  }
}
