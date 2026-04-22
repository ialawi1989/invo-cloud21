import { Helper } from "@src/utilts/helper";

export class CompanyOptions {

  allowOnlyOneCashierPerTerminal = false;
  noSaleWhenZero = false;
  hideVoidedItem = false;
  voidedItemNeedExplanation = false;
  maxReferneceNumber = 99
  addCustomerByMSR = false;
  disableHalfItem = false;
  showQty = true;
  showPrice = true;

  adjPriceNeedExplanation = false;
  customerIsRequiredInInvoice = false;
  disableWaste = false;
  instantSaveRetailOrder = true;

  ParseJson(json: any): void {
    for (const key in json) {
      this[key as keyof typeof this] = json[key];
    }
  }
}

export class PrintingOptions {

  printReceiptOnSent = false;
  numberOfReceiptWhenSent = 0;
  printReceiptOnPaid = false;
  numberOfReceiptWhenPaid = 0;
  printReceiptOnVoid = false;
  printVoidedItems = true;
  printVoidDetails = false;
  printHoldStamp = false;
  sortItemsByCategoryForKitchenPrint = false;
  hideShortNoteInReceipt = false;
  printSecondLanguageInReceipt = false;
  ParseJson(json: any): void {
    for (const key in json) {
      this[key as keyof typeof this] = json[key];
    }
  }
}

export class InvoiceOptions {
  note = "";
  term = "";
  enableWaste = false;
  enableVoidReason = false;
  isInvoiceOptionGroupVisible  = false;
  ParseJson(json: any): void {
    for (const key in json) {
      this[key as keyof typeof this] = json[key];
    }
  }
}
export class CustomField {
  id = Helper.createGuid();
  index = 0;
  disable = false;
  name = "";
  type = "";
  required = false;
  showOptions = false;
  customOptions = [];
  visible = true;


  ParseJson(json: any): void {
    for (const key in json) {
      this[key as keyof typeof this] = json[key];
    }
  }
}
export class Company {
  id = "";
  name = "";
  slug = "";
  type = "";
  country = "";
  translation: any = {}; // er & ar .. 
  companyGroupId = ""
  createdAt: Date = new Date();
  base64Image = "";

  smallestCurrency = 0;
  roundingType = "normal";
  //TODO: DELETE THIS

  mediaId: string | null;
  mediaUrl: any = {};
  afterDecimal = 0;
  currencySymbol = "";
  settings: any|null = {};
  vatNumber = ""
  isInclusiveTax = false //TODO: ADD TO COMPANY AND RETRIVE 
  //TODO: TRANSLATION LANGUAGES DEPEND  on country  RETURN IN PREFRENCES  DONT ADD TO DB SIMILAR TO SYMBOL 
  langs = [];
  attachment: any;

  options? = new CompanyOptions();
  voidReasons: [] = [];

  workingHours: any = {} // only for pos

  timeOffset = "";
  printingOptions = new PrintingOptions();
  invoiceOptions = new InvoiceOptions();

  logo = "";
  updatedDate = new Date();
  //TODO:ADD TO INSERT EDIT QUERY
  customDiscountTaxId: string | null;
  deliveryChargeTaxId: string | null;

  customFields = [];
  vatPaymentDate: string | null;
  zatca: any | null;
  jofotara: any | null;
  pickUpMaxDistance: number | null = null;
  features:string[]|null = null ;
  constructor() {
    this.zatca = null
    this.jofotara = null
    this.name = "";
    this.mediaId = null;
    this.customDiscountTaxId = null;
    this.deliveryChargeTaxId = null;
    this.vatPaymentDate = null
  }
  ParseJson(json: any): void {
    for (const key in json) {

      if (key == "options") {
        let options = new CompanyOptions();
        options.ParseJson(json[key])
        this[key] = options
      }
      else if (key == "invoiceOptions") {
        let _invoiceOptions = new InvoiceOptions();
        _invoiceOptions.ParseJson(json[key]);
        this[key] = _invoiceOptions;
      }
      else {
        this[key as keyof typeof this] = json[key];
      }
    }
  }

  //   setCountryCode():void{
  //     switch (this.country) {
  //       case "Bahrain":
  //           this.contryCode= "+973";
  //           break;
  //       case "Kuwait":
  //         this.contryCode=  "+965";
  //         break;
  //       case "Saudi Arabia":
  //         this.contryCode= "+966";
  //         break;
  //       case "Iraq":
  //         this.contryCode= "+964";
  //         break;
  //       default:
  //         this.contryCode= "+973";
  //   }
  // }


  // setAfterDecimal():void{

  //   switch (this.country) {
  //     case "Bahrain":
  //         this.afterDecimal= 3;
  //         break;
  //     case "Kuwait":
  //       this.afterDecimal= 3;
  //       break;
  //     case "Saudi Arabia":
  //       this.afterDecimal= 2;
  //       break;
  //     case "Iraq":
  //       this.afterDecimal= 0;
  //       break;
  //     default:
  //       this.afterDecimal= 2;
  // }
  // }

  // setCompanySymbol():void{
  //   switch (this.country) {
  //     case "Bahrain":
  //         this.currencySymbol= "BHD";
  //         break;
  //     case "Kuwait":
  //       this.currencySymbol= "KD";
  //       break;
  //     case "Saudi Arabia":
  //       this.currencySymbol= "SR";
  //       break;
  //     case "Iraq":
  //       this.currencySymbol= "IQD";
  //       break;
  //     default:
  //       this.currencySymbol= "BHD";
  // }
  // }
}

