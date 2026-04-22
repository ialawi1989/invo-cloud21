
export class InvoiceTemplate {
  templateName: String = '';
  selectedPaperOrientation: String = 'portrait';
  selectedPaperSize: String = 'A4';
  textColor: String = 'rgb 73 80 87';
  textSize: number = 10;
  BackgroundColor: String = '#ffffff';
  margins: margins;
  headerCustomization: headerCustomization;
  footerCustomization: footerCustomization;
  transactionalDetailsCustomization: transactionalDetailsCustomization;
  tableCustomization: tableCustomization;
  totalSectionCustomization: totalSectionCustomization;
  constructor() {
    this.margins = new margins();
    this.headerCustomization = new headerCustomization();
    this.footerCustomization = new footerCustomization();
    this.transactionalDetailsCustomization =
      new transactionalDetailsCustomization();
    this.tableCustomization = new tableCustomization();
    this.totalSectionCustomization = new totalSectionCustomization();
  }
  ParseJson(json: any): void {
    for (const key in json) {
      if (key == 'margins') {
        const _customerAddress = new margins();
        _customerAddress.ParseJson(json[key]);
        this[key] = _customerAddress;
      } else if (key == 'headerCustomization') {
        const _headerCustomization = new headerCustomization();
        _headerCustomization.ParseJson(json[key]);
        this[key] = _headerCustomization;
      } else if (key == 'footerCustomization') {
        const _footerCustomization = new footerCustomization();
        _footerCustomization.ParseJson(json[key]);
        this[key] = _footerCustomization;
      } else if (key == 'tableCustomization') {
        const _tableCustomization = new tableCustomization();
        _tableCustomization.ParseJson(json[key]);
        this[key] = _tableCustomization;
      } else if (key == 'totalSectionCustomization') {
        const _totalSectionCustomization = new totalSectionCustomization();
        _totalSectionCustomization.ParseJson(json[key]);
        this[key] = _totalSectionCustomization;
      } else if (key == 'transactionalDetailsCustomization') {
        const _transactionalDetailsCustomization =
          new transactionalDetailsCustomization();
        _transactionalDetailsCustomization.ParseJson(json[key]);
        this[key] = _transactionalDetailsCustomization;
      } else if (this.hasOwnProperty(key)) {
        this[key as keyof this] = json[key];
      }
    }
  }
}
export class margins {
  top: any = '0.635';
  bottom: any = '0.635';
  right: any = '0.635';
  left: any = '0.635';
  constructor() {}
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class headerCustomizationCustomFields {
  [key: string]: any;

  ParseJson(json: any): void {
    for (const key in json) {
      if (this.hasOwnProperty(key)) {
        this[key as keyof this] = json[key];
      }
    }
  }
}

export class headerCustomization {
  logo: CompanyLogo;
  companyName: textSizeAndColor;
  vatNumber: textSizeAndColor;
  invoiceTitle: textSizeAndColor;
  name: textSizeAndColor;
  address: textSizeAndColor;
  phone: textSizeAndColor;
  visibility: Visibality;

  customFields: any[] = [];

  [key: string]: any;

  constructor() {
    this.logo = new CompanyLogo();
    this.companyName = new textSizeAndColor();
    this.vatNumber = new textSizeAndColor();
    this.invoiceTitle = new textSizeAndColor();
    this.invoiceTitle.size = '24';
    this.name = new textSizeAndColor();
    this.address = new textSizeAndColor();
    this.phone = new textSizeAndColor();
    this.visibility = new Visibality();
  }

  ParseJson(json: any): void {
    let temp;
    let _customFields: textSizeAndColor;
    for (const key in json) {
      if (key == 'logo') {
        const _Logo = new CompanyLogo();
        _Logo.ParseJson(json[key]);
        this[key] = _Logo;
      } else if (
        key == 'companyName' ||
        key == 'vatNumber' ||
        key == 'invoiceTitle' ||
        key == 'name' ||
        key == 'address' ||
        key == 'phone'
      ) {
        const _obj = new textSizeAndColor();
        _obj.ParseJson(json[key]);
        this[key] = _obj;
      } else if (this.hasOwnProperty(key)) {
        this[key as keyof this] = json[key];
      }
    }
  }
}
export class footerCustomization {
  noteTitle: textSizeAndColorAndAligment;
  note: textSizeAndColorAndAligment;
  visibility: Visibality = new Visibality();
  constructor() {
    this.noteTitle = new textSizeAndColorAndAligment();
    this.noteTitle.size = 10;
    this.note = new textSizeAndColorAndAligment();
    this.note.size = 10;
    this.note.color = 'rgba(var(--bs-primary-rgb), var(--bs-text-opacity))';
    this.visibility.height = 85;
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key == 'noteTitle' || key == 'note') {
        const _obj = new textSizeAndColorAndAligment();
        _obj.ParseJson(json[key]);
        this[key] = _obj;
      } else if (key == 'visibility') {
        const _obj = new Visibality();
        _obj.ParseJson(json[key]);
        this[key] = _obj;
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
export class transactionalDetailsCustomization {
  customerName: textSizeAndColor;
  customerPhone: textSizeAndColor;
  customerAddress: textSizeAndColor;
  invNumber: textSizeAndColor;
  salesPerson: textSizeAndColor;
  invoiceDate: textSizeAndColor;
  invoiceDueDate: textSizeAndColor;
  createdDate: textSizeAndColor;
  invoiceTableHeader: textSizeAndColor;
  invoicLines: textSizeAndColor;
  invoicVoidedLines: textSizeAndColor;
  tableTitle: textSizeAndColor;
  taxType: textSizeAndColor;
  vatNumber: textSizeAndColor;
  refrence: textSizeAndColor;
  barcode: textSizeAndColor = new textSizeAndColor();

  customFields: any[] = [];

  constructor() {
    this.customerName = new textSizeAndColor();
    this.customerPhone = new textSizeAndColor();
    this.customerAddress = new textSizeAndColor();
    this.invNumber = new textSizeAndColor();
    this.salesPerson = new textSizeAndColor();
    this.invoiceDate = new textSizeAndColor();
    this.invoiceDueDate = new textSizeAndColor();
    this.createdDate = new textSizeAndColor();
    this.vatNumber = new textSizeAndColor();
    this.refrence = new textSizeAndColor();
    this.invoiceTableHeader = new textSizeAndColor();
    this.invoicLines = new textSizeAndColor();
    this.invoicVoidedLines = new textSizeAndColor();
    this.tableTitle = new textSizeAndColor();
    this.taxType = new textSizeAndColor();
    this.customerName.size = 10;
    this.invNumber.size = 10;
    this.salesPerson.size = 10;
    this.invoiceDate.size = 10;
    this.invoiceDueDate.size = 10;
    this.createdDate.size = 10;
    this.vatNumber.size = 10;
    this.refrence.size = 10;
    this.barcode = new textSizeAndColor();
  }

  ParseJson(json: any): void {
    let temp;
    let _customFields;
    for (const key in json) {
      if (
        key == 'customerName' ||
        key == 'customerPhone' ||
        key == 'customerAddress' ||
        key == 'invNumber' ||
        key == 'salesPerson' ||
        key == 'invoiceDate' ||
        key == 'invoiceDueDate' ||
        key == 'createdDate' ||
        key == 'vatNumber' ||
        key == 'refrence' ||
        key == 'invoiceTableHeader' ||
        key == 'invoicLines' ||
        key == 'invoicVoidedLines' ||
        key == 'tableTitle' ||
        key == 'taxType' ||
        key == 'barcode'
      ) {
        const _obj = new textSizeAndColor();
        _obj.ParseJson(json[key]);
        this[key] = _obj;
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }

    if (this.barcode == null) {
      this.barcode = new textSizeAndColor();
    }
  }
}
export class tableCustomization {
  description: TableColumnCustom;
  qty: TableColumnCustom;
  price: TableColumnCustom;
  taxPercantage: TableColumnCustom;
  tax: TableColumnCustom;
  discount: TableColumnCustom;
  amount: TableColumnCustom;
  constructor() {
    this.description = new TableColumnCustom();
    this.qty = new TableColumnCustom();
    this.price = new TableColumnCustom();
    this.taxPercantage = new TableColumnCustom();
    this.tax = new TableColumnCustom();
    this.discount = new TableColumnCustom();
    this.amount = new TableColumnCustom();
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (
        key == 'description' ||
        key == 'qty' ||
        key == 'price' ||
        key == 'taxPercantage' ||
        key == 'tax' ||
        key == 'discount' ||
        key == 'amount'
      ) {
        const _obj = new TableColumnCustom();
        _obj.ParseJson(json[key]);
        this[key] = _obj;
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }

    if (this.description.width == 0) {
      this.description.width = 30;
    }
    if (this.description.label == '') {
      this.description.label = 'Description';
    }
    if (this.qty.width == 0) {
      this.qty.width = 10;
    }
    if (this.qty.label == '') {
      this.qty.label = 'Qty';
    }
    if (this.price.width == 0) {
      this.price.width = 10;
    }
    if (this.price.label == '') {
      this.price.label = 'Price';
    }
    if (this.taxPercantage.width == 0) {
      this.taxPercantage.width = 10;
    }
    if (this.taxPercantage.label == '') {
      this.taxPercantage.label = 'Tax Percantage';
    }
    if (this.tax.width == 0) {
      this.tax.width = 10;
    }
    if (this.tax.label == '') {
      this.tax.label = 'Tax';
    }
    if (this.discount.width == 0) {
      this.discount.width = 10;
    }
    if (this.discount.label == '') {
      this.discount.label = 'Discount';
    }
    if (this.amount.width == 0) {
      this.amount.width = 10;
    }
    if (this.amount.label == '') {
      this.amount.label = 'Amount';
    }
  }
}
export class totalSectionCustomization {
  totalTable: totalTable;
  paymentTable: paymentTable;
  customerBalance: CustomerBalance;
  constructor() {
    this.totalTable = new totalTable();
    this.paymentTable = new paymentTable();
    this.customerBalance = new CustomerBalance();
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key == 'totalTable') {
        const _obj = new totalTable();
        _obj.ParseJson(json[key]);
        this[key] = _obj;
      } else if (key == 'paymentTable') {
        const _obj = new paymentTable();
        _obj.ParseJson(json[key]);
        this[key] = _obj;
      } else if (key == 'customerBalance') {
        const _obj = new CustomerBalance();
        _obj.ParseJson(json[key]);
        this[key] = _obj;
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
export class totalTable {
  show: boolean = true;
  backgroundColor: String = 'white';
  itemTotal: textSizeAndColor;
  taxTotal: textSizeAndColor;
  discount: textSizeAndColor;
  charge: textSizeAndColor;
  delevary: textSizeAndColor;
  Total: textSizeAndColor;
  subTotal: textSizeAndColor;
  roundingTotal: textSizeAndColor;
  constructor() {
    this.itemTotal = new textSizeAndColor();
    this.taxTotal = new textSizeAndColor();
    this.discount = new textSizeAndColor();
    this.charge = new textSizeAndColor();
    this.delevary = new textSizeAndColor();
    this.Total = new textSizeAndColor();
    this.subTotal = new textSizeAndColor();
    this.roundingTotal = new textSizeAndColor();
    this.itemTotal.size = 10;
    this.taxTotal.size = 10;
    this.discount.size = 10;
    this.charge.size = 10;
    this.delevary.size = 10;
    this.Total.size = 10;
    this.subTotal.show = false;
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (
        key == 'itemTotal' ||
        key == 'taxTotal' ||
        key == 'discount' ||
        key == 'charge' ||
        key == 'delevary' ||
        key == 'roundingTotal' ||
        key == 'Total' ||
        key == 'subTotal'
      ) {
        const _obj = new textSizeAndColor();
        _obj.ParseJson(json[key]);
        this[key] = _obj;
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
export class paymentTable {
  show: boolean = true;
  backgroundColor: String = '#f1b44c';
  paymnet: textSizeAndColor;
  credit: textSizeAndColor;
  balance: textSizeAndColor;
  payments: any = {
    show: true,
    color: "rgb 73 80 87",
    size: "10"
  };
  constructor() {
    this.paymnet = new textSizeAndColor();
    this.credit = new textSizeAndColor();
    this.balance = new textSizeAndColor();
    this.paymnet.size = 10;
    this.credit.size = 10;
    this.balance.size = 10;
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
export class CustomerBalance {
  show: boolean = true;
  backgroundColor: String = '#f1b44c';
  balance: textSizeAndColor;
  constructor() {
    this.balance = new textSizeAndColor();
    this.balance.size = 10;
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
export class textSizeAndColor {
  show: boolean = true;
  size: any = '12';
  color: String = 'rgb 73 80 87';
  backgroundColor: String = 'rgb 73 80 87';
  position?: string = 'firstColumn';

  constructor(json: { [key: string]: any } = {}) {
    this.show = json.show !== undefined ? json.show : true;
    this.size = json.size !== undefined ? json.size : '12';
    this.color = json.color !== undefined ? json.color : 'rgb 73 80 87';
    this.position = json.position !== undefined ? json.position : 'firstColumn';
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class TableColumnCustom {
  show: boolean = true;
  width: number = 0;
  label: String = '';
  translation: Translation = new Translation();

  constructor() {}

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

class Visibality {
  visible: boolean = true;
  height: number = 179;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
export class CompanyLogo {
  show = true;
  width: number = 122;
  height: number = 50;
  originalWidth: number = 122;
  originalHeight: number = 50;
  logo = "";

  constructor() {}
  onChangeSize(params: any) {
    let { $event, generalHelpers } = params;
    const originalWidth = this.originalWidth;
    const originalHeight = this.originalHeight;

    if ($event.target.id === 'width') {
      const newWidth = Number($event.target.value);
      const newHeight = (newWidth / originalWidth) * originalHeight;
      const { width, height } = generalHelpers.scaleImageSize(
        originalWidth,
        originalHeight,
        newWidth,
        newHeight
      );
      this.width = width;
      this.height = height;
    } else if ($event.target.id === 'height') {
      const newHeight = Number($event.target.value);
      const newWidth = (newHeight / originalHeight) * originalWidth;
      const { width, height } = generalHelpers.scaleImageSize(
        originalWidth,
        originalHeight,
        newWidth,
        newHeight
      );
      this.width = width;
      this.height = height;
    }
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
export class textSizeAndColorAndAligment {
  show: boolean = true;
  size: any = '12';
  color: String = 'rgb 73 80 87';
  alignment: String = 'center';

  constructor(json: { [key: string]: any } = {}) {
    this.show = json.show !== undefined ? json.show : true;
    this.size = json.size !== undefined ? json.size : '12';
    this.color = json.color !== undefined ? json.color : 'rgb 73 80 87';
    this.alignment = json.alignment !== undefined ? json.alignment : 'center';
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
export class Translation {
    title: TranslationLang = new TranslationLang();
    name: TranslationLang = new TranslationLang();
    displayName: TranslationLang = new TranslationLang();
    alias: TranslationLang = new TranslationLang();
    description: TranslationLang = new TranslationLang();
    body: TranslationLang = new TranslationLang();

    constructor() {
        this.title = new TranslationLang();
        this.name = new TranslationLang();
        this.displayName = new TranslationLang();
        this.alias = new TranslationLang();
        this.description = new TranslationLang();
        this.body = new TranslationLang();
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "title" || key == "name" || key == "displayName" || key == "alias" || key == "description" || key == "body") {
                const _translation = new TranslationLang();
                _translation.ParseJson(json[key])
                this[key] = _translation
            } else if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}

export class TranslationLang {
    en: string = "";
    ar: string = "";

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}