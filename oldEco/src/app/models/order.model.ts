import { Address } from "./address.model";
import { Customer } from "./customer.model";


export class Order {
  id: string = "";
  branchId: string = "";
  referenceNumber: string = "";
  note: string = "";
  guests: number = 0;
  chargeAmount: number = 0;
  chargePercentage: boolean = false;
  chargeTotal: number = 0;
  deliveryCharge: number = 0;
  discountAmount: number = 0;
  discountPercentage: boolean = false;
  discountTotal: number = 0;
  estimateSource: string = "";
  source: string = "";
  customerContact: string = "";
  customerAddress: Address = new Address();
  customerLatLang: string = "";
  status: string = "";
  subTotal: number = 0;
  total: number = 0;
  paidAmount: number = 0;
  balance: number = 0;
  refunded: number = 0;
  appliedCredit: number = 0;
  customer: Customer = new Customer();
  lines: any[] = [];
  invoicePayments: any[] = [];
  employeeName: string = "";
  branchName: string = "";
  customerName: string = "";
  driverName: string = "";
  smallestCurrency: number = 0;
  roundingType: string = "";
  roundingTotal: number = 0;
  invoiceDate: string = "";
  createdAt: string = "";
  updatedDate: string = "";
  isInclusiveTax: boolean = true;
  itemSubTotal: number = 0;
  invoiceTaxTotal: number = 0;
  houseAccount: boolean = false;
  onlineStatus: string = "";
  rejectReason: string = "";
  onlineData: any = {};
  grubTechData: any = {};
  customerVatNumber: string = "";
  companyVatNumber: string = "";
  currentInvoiceStatus: string = "";
  minimumOrder: number = 0;
  isPaid: boolean = false;
  mediaUrl: string = "";
  addressKey: string = "";
  attachment: any[] = [];
  logs: any[] = [];
  mergeWithInvoiceNumber: string = "";
  branchAddress: string = "";
  branchPhone: string = "";
  branchCustomFields: any[] = [];
  customerEmail: string = "";
  salesEmployeeName: string = "";
  discountType: string = "";
  customerPhone: string = "";
  aggregator: string = "";
  aggregatorId: string = "";
  recurringInvoiceId: string = "";
  chargeType: string = "";
  taxesDetails: any[] = [];
  itemDiscountTotal: number = 0;
  oldReadyTime: string = "";
  employeeId: string = "";
  chargesTaxDetails: any = {};
  terminalId: string = "";
  tableId: string = "";
  serviceId: string = "";
  customerId: string = "";
  estimateId: string = "";
  printTime: string = "";
  readyTime: string = "";
  departureTime: string = "";
  arrivalTime: string = "";
  discountId: string = "";
  chargeId: string = "";
  scheduleTime: string = "";
  mergeWith: string = "";
  driverId: string = "";
  onlineActionTime: string = "";
  writeOffDate: string = "";
  serviceName: string = "";
  tableName: string = "";
  invoiceNumber: string = "";
  mediaId: string = "";
  salesEmployeeId: string = "";
  paymentTerm: string = "";
  dueDate: string = "";
  teamName:string = "";
  receivableAccountId: string = "";
  shippingOption:any = {};
  serviceDate:any = "";
  pointsDiscount: number | null = null;
  promoCoupon: number | null = null;
  couponId: string | null = null; 

  ParseJson(json: any): void {
    for (const key in json) {
      if (key === "customerAddress" && json[key]) {
        this.customerAddress = new Address();
        this.customerAddress.ParseJson(json[key]);
      } else if (key === "customer" && json[key]) {
        this.customer = new Customer();
        this.customer.ParseJson(json[key]);
      } else if (key in this) {
        this[key as keyof this] = json[key] ?? this[key as keyof this];
      }
    }
  }
}
