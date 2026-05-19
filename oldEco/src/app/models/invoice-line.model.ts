export class InvoiceLine {
    id: string = "";
  invoiceId: string = "";
  branchId: string = "";
  note: string = "";
  accountId: string = "";
  batch: string = "";
  serial: string = "";
  priceOfferType: string = "";
  seatNumber: number = 0;
  qty: number = 0;
  price: number = 0;
  total: number = 0;
  defaultPrice: number = 0;
  subTotal: number = 0;
  translation: { [key: string]: any } = {};
  subItems: any[] = [];
  product: { [key: string]: any } = {};
  voidedItems: any[] = [];
  returnItems: any[] = [];
  createdAt: string = "";
  taxTotal: number = 0;
  taxes: any[] = [];
  taxType: string = "";
  taxPercentage: number = 0;
  isInclusiveTax: boolean = false;
  discountAmount: number = 0;
  discountPercentage: boolean = false;
  commissionPercentage: boolean = false;
  commissionAmount: number = 0;
  commissionTotal: number = 0;
  serviceDuration: number = 0;
  serviceDate: string = "";
  options: any[] = [];
  status: string = "";
  discountTotal: number = 0;
  selectedItem: { [key: string]: any } = {};
  voidedTotal: number = 0;
  isVoided: boolean = false;
  waste: boolean = false;
  taxName: string = "";
  productName: string = "";
  outOfStock: boolean = false;
  itemsQtyOnStock: number = 0;
  priceChange: boolean = false;
  totalChange: boolean = false;
  maxQtyExceeded: boolean = false;
  maxQtyItems: number = 0;
  recipe: any[] = [];
  isReturned: boolean = false;
  returnedQty: number = 0;
  UOM: string = "";
  discountType: string = "";
  weight: number = 0;
  weightUOM: string = "";
  measurements: { [key: string]: any } = {};
  parentUsages: number = 0;
  accountName: string = "";
  maxQty: number = 0;
  isEditedLine: boolean = false;
  mediaUrl: string | null = null;
  parentId: string | null = null;
  salesEmployeeId: string | null = null;
  productId: string = "";
  discountId: string | null = null;
  voidFrom: string | null = null;
  taxId: string = "";
  employeeId: string | null = null;
  holdTime: string | null = null;
  printTime: string | null = null;
  readyTime: string | null = null;
  voidReason: string | null = null;
  priceModel: string | null = null;
  addedByCoupon!: boolean;
  discountedByCoupon!: boolean;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
