import { Customer } from "./customer.model";
import { InvoiceLine } from "./invoice-line.model";

export class Invoice {
  id: string = "";
  branchId: string = "";
  refrenceNumber: string = "";
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
  customerAddress: any = {};
  customerLatLang: string = "";
  deliveryNote: string = "";
  status: string = "";
  subTotal: number = 0;
  total: number = 0;
  paidAmount: number = 0;
  balance: number = 0;
  refunded: number = 0;
  appliedCredit: number = 0;
  customer: Customer = {} as Customer;
  lines: InvoiceLine[] = [];
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
  isInclusiveTax: boolean = false;
  itemSubTotal: number = 0;
  invoiceTaxTotal: number = 0;
  freeDeliveryOver: any = null;
  houseAccount: boolean = false;
  onlineStatus: string = "";
  rejectReason: string = "";
  onlineData: { sessionId: string; onlineStatus: string } = { sessionId: "", onlineStatus: "" };
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
  aggregatorId: string | null = null;
  recurringInvoiceId: string | null = null;
  chargeType: string = "";
  taxesDetails: any[] = [];
  itemDiscountTotal: number = 0;
  oldReadyTime: string | null = null;
  employeeId: string | null = null;
  chargesTaxDetails: any | null = null;
  terminalId: string | null = null;
  tableId: string | null = null;
  serviceId: string = "";
  customerId: string | null = null;
  estimateId: string | null = null;
  printTime: string | null = null;
  readyTime: string | null = null;
  departureTime: string | null = null;
  arrivalTime: string | null = null;
  discountId: string | null = null;
  chargeId: string | null = null;
  scheduleTime: string | null = null;
  mergeWith: string | null = null;
  driverId: string | null = null;
  onlineActionTime: string | null = null;
  writeOffDate: string | null = null;
  serviceName: string = "";
  tableName: string | null = null;
  invoiceNumber: string | null = null;
  mediaId: string | null = null;
  salesEmployeeId: string | null = null;
  paymentTerm: string = "";
  dueDate: string | null = null;
  receivableAccountId: string | null = null;
  promoCoupon: number = 0;
  couponId: string | null = null;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key === 'customer' && json[key]) {
        const c = new Customer();
        c.ParseJson(json[key]);
        this.customer = c;
      } else if (key === 'lines' && Array.isArray(json[key])) {
        this.lines = json[key].map((l: any) => {
          const line = new InvoiceLine();
          line.ParseJson(l);
          return line;
        });
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
