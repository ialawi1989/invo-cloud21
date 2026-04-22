// document-template.model.ts

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

/**
 * Document types supported by the template system
 */
export type DocumentType = 'invoice' | 'estimate' | 'credit-note' | 'purchaseOrder' | 'bill' | 'expense' | 'supplier-credit' | 'invoicePayment' | 'billPayment' | 'billOfEntry';

/**
 * Generic Document Template - Works for all document types
 */
export class DocumentTemplate {
  templateName: string = '';
  documentType: DocumentType = 'invoice';
  selectedPaperOrientation: string = 'portrait';
  selectedPaperSize: string = 'A4';
  textColor: string = 'rgb(73, 80, 87)';
  textSize: number = 10;
  BackgroundColor: string = '#ffffff';
  margins: Margins;
  headerCustomization: HeaderCustomization;
  footerCustomization: FooterCustomization;
  transactionalDetailsCustomization: TransactionalDetailsCustomization;
  tableCustomization: TableCustomization;
  totalSectionCustomization: TotalSectionCustomization;

  constructor(documentType: DocumentType = 'invoice') {
    this.documentType = documentType;
    this.margins = new Margins();
    this.headerCustomization = new HeaderCustomization();
    this.footerCustomization = new FooterCustomization();
    this.transactionalDetailsCustomization = new TransactionalDetailsCustomization(documentType);
    this.tableCustomization = new TableCustomization();
    this.totalSectionCustomization = new TotalSectionCustomization();
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key === 'margins') {
        const obj = new Margins();
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (key === 'headerCustomization') {
        const obj = new HeaderCustomization();
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (key === 'footerCustomization') {
        const obj = new FooterCustomization();
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (key === 'tableCustomization') {
        const obj = new TableCustomization();
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (key === 'totalSectionCustomization') {
        const obj = new TotalSectionCustomization();
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (key === 'transactionalDetailsCustomization') {
        const obj = new TransactionalDetailsCustomization(this.documentType);
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (this.hasOwnProperty(key)) {
        (this as any)[key] = json[key];
      }
    }
  }

  /**
   * Get paper dimensions based on size and orientation
   */
  getPaperWidth(): string {
    const sizes: { [key: string]: { portrait: string; landscape: string } } = {
      'A4': { portrait: '21', landscape: '29.7' },
      'A5': { portrait: '14.8', landscape: '21' },
      'Letter': { portrait: '21.59', landscape: '27.94' }
    };
    const size = sizes[this.selectedPaperSize] || sizes['A4'];
    return this.selectedPaperOrientation === 'landscape' ? size.landscape : size.portrait;
  }

  getPaperHeight(): string {
    const sizes: { [key: string]: { portrait: string; landscape: string } } = {
      'A4': { portrait: '29.7', landscape: '21' },
      'A5': { portrait: '21', landscape: '14.8' },
      'Letter': { portrait: '27.94', landscape: '21.59' }
    };
    const size = sizes[this.selectedPaperSize] || sizes['A4'];
    return this.selectedPaperOrientation === 'landscape' ? size.landscape : size.portrait;
  }
}

/**
 * Margins configuration
 */
export class Margins {
  top: any = '0.635';
  bottom: any = '0.635';
  right: any = '0.635';
  left: any = '0.635';

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }
}

/**
 * Visibility settings for header/footer
 */
export class Visibility {
  visible: boolean = true;
  height: number = 179;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }
}

/**
 * Company logo configuration
 */
export class CompanyLogo {
  show: boolean = true;
  width: number = 122;
  height: number = 50;
  originalWidth: number = 122;
  originalHeight: number = 50;
  logo: string = '';

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }

  onChangeSize(params: { $event: any; generalHelpers: any }): void {
    const { $event, generalHelpers } = params;
    const originalWidth = this.originalWidth;
    const originalHeight = this.originalHeight;

    if ($event.target.id === 'width') {
      const newWidth = Number($event.target.value);
      const newHeight = (newWidth / originalWidth) * originalHeight;
      const { width, height } = generalHelpers.scaleImageSize(
        originalWidth, originalHeight, newWidth, newHeight
      );
      this.width = width;
      this.height = height;
    } else if ($event.target.id === 'height') {
      const newHeight = Number($event.target.value);
      const newWidth = (newHeight / originalHeight) * originalWidth;
      const { width, height } = generalHelpers.scaleImageSize(
        originalWidth, originalHeight, newWidth, newHeight
      );
      this.width = width;
      this.height = height;
    }
  }
}

/**
 * Text style configuration (size, color, show/hide, label, bold/italic/underline)
 */
export class TextSizeAndColor {
  show: boolean = true;
  size: string | number = '12';
  color: any = 'rgb(73, 80, 87)';
  labelColor: string = 'rgb(73, 80, 87)'; // Color for the label text
  backgroundColor: string = '';
  position: string = 'firstColumn';
  alignment: string = 'left';
  label: string = ''; // Custom label override
  bold: boolean = false;
  italic: boolean = false;
  underline: boolean = false;

  constructor(defaults: Partial<TextSizeAndColor> = {}) {
    Object.assign(this, defaults);
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }
}

/**
 * Text style with alignment support
 */
export class TextSizeAndColorAndAlignment {
  show: boolean = true;
  size: string | number = '12';
  color: string = 'rgb(73, 80, 87)';
  labelColor: string = 'rgb(73, 80, 87)'; // Color for the label text
  backgroundColor: string = 'white';
  alignment: string = 'center';
  position: string = 'firstColumn';
  label: string = ''; // Custom label override
  bold: boolean = false;
  italic: boolean = false;
  underline: boolean = false;

  constructor(defaults: Partial<TextSizeAndColorAndAlignment> = {}) {
    Object.assign(this, defaults);
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }
}

/**
 * Table column customization
 */
export class TableColumnCustom {
  show: boolean = true;
  width: number = 0;
  label: string = '';
  translation: Translation = new Translation();

  ParseJson(json: any): void {
    for (const key in json) {
      if (key == "translation") {
        const _translation = new Translation();
        _translation.ParseJson(json[key])
        this[key] = _translation
      } else if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }
}

/**
 * Header customization
 */
export class HeaderCustomization {
  logo: CompanyLogo;
  companyName: TextSizeAndColor;
  vatNumber: TextSizeAndColor;
  title: TextSizeAndColor;
  name: TextSizeAndColor;
  address: TextSizeAndColor;
  phone: TextSizeAndColor;
  visibility: Visibility;
  customFields: any[] = [];

  [key: string]: any;

  constructor() {
    this.logo = new CompanyLogo();
    this.companyName = new TextSizeAndColor();
    this.vatNumber = new TextSizeAndColor();
    this.title = new TextSizeAndColor({ size: '24' });
    this.name = new TextSizeAndColor();
    this.address = new TextSizeAndColor();
    this.phone = new TextSizeAndColor();
    this.visibility = new Visibility();
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key === 'logo') {
        const obj = new CompanyLogo();
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (key === 'visibility') {
        const obj = new Visibility();
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (['companyName', 'vatNumber', 'title', 'name', 'address', 'phone'].includes(key)) {
        const obj = new TextSizeAndColor();
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (this.hasOwnProperty(key)) {
        (this as any)[key] = json[key];
      }
    }
  }
}

/**
 * Footer customization
 */
export class FooterCustomization {
  noteTitle: TextSizeAndColorAndAlignment;
  note: TextSizeAndColorAndAlignment;
  customerNote: TextSizeAndColorAndAlignment;
  term: TextSizeAndColorAndAlignment;
  visibility: Visibility;

  constructor() {
    this.noteTitle = new TextSizeAndColorAndAlignment({ size: 10 });
    this.note = new TextSizeAndColorAndAlignment({ size: 10, color: '#495057' });
    this.customerNote = new TextSizeAndColorAndAlignment({ size: 10, color: '#495057' });
    this.term = new TextSizeAndColorAndAlignment({ size: 10, color: '#495057' });
    this.visibility = new Visibility();
    this.visibility.height = 85;
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (['noteTitle', 'note', 'term'].includes(key)) {
        const obj = new TextSizeAndColorAndAlignment();
        obj.ParseJson(json[key]);
        (this as any)[key] = obj;
      } else if (key === 'visibility') {
        const obj = new Visibility();
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }
}

/**
 * Transactional details customization - Supports all document types
 */
export class TransactionalDetailsCustomization {
  // Common fields for all document types
  tableTitle: TextSizeAndColor;
  taxType: TextSizeAndColor;
  barcode: TextSizeAndColor;
  options: TextSizeAndColor;
  customFields: any[] = [];

  // Table headers - Type specific
  invoiceTableHeader: TextSizeAndColor;      // Invoice
  estimateTableHeader: TextSizeAndColor;     // Estimate
  creditNoteTableHeader: TextSizeAndColor;   // Credit Note
  purchaseTableHeader: TextSizeAndColor;     // Purchase Order
  billTableHeader: TextSizeAndColor;         // Bill
  expenseTableHeader: TextSizeAndColor;      // Expense
  supplierCreditTableHeader: TextSizeAndColor; // Supplier Credit
  invoicePaymentTableHeader: TextSizeAndColor; //invoice payemnt
  billOfEntryTableHeader: TextSizeAndColor; //billOfEntry

  // Table lines - Type specific
  invoicLines: TextSizeAndColor;             // Invoice (keep typo for backward compatibility)
  estimateLines: TextSizeAndColor;           // Estimate
  creditNoteLines: TextSizeAndColor;         // Credit Note
  purchaseLines: TextSizeAndColor;           // Purchase Order
  billLines: TextSizeAndColor;               // Bill
  expenseLines: TextSizeAndColor;            // Expense
  supplierCreditLines: TextSizeAndColor;     // Supplier Credit
  invoicePaymentLines: TextSizeAndColor; //invoice payemnt
  billOfEntryLines: TextSizeAndColor; //invoice payemnt

  // Voided lines - Type specific
  invoicVoidedLines: TextSizeAndColor;       // Invoice (keep typo for backward compatibility)
  estimateVoidedLines: TextSizeAndColor;     // Estimate
  creditNoteVoidedLines: TextSizeAndColor;   // Credit Note
  purchaseVoidedLines: TextSizeAndColor;     // Purchase Order
  billVoidedLines: TextSizeAndColor;         // Bill
  expenseVoidedLines: TextSizeAndColor;      // Expense
  supplierCreditVoidedLines: TextSizeAndColor; // Supplier Credit

  // Customer-facing documents (Invoice, Estimate, Credit Note)
  customerName: TextSizeAndColor;
  customerPhone: TextSizeAndColor;
  customerAddress: TextSizeAndColor;
  customerVatNumber: TextSizeAndColor;
  vatNumber: TextSizeAndColor;
  salesPerson: TextSizeAndColor;
  employeeName: TextSizeAndColor;

  // POS / Order service fields
  service: TextSizeAndColor;


  //  supplier-facing documents (PO, Bill, Expense, Supplier Credit)
  supplierName: TextSizeAndColor;
  supplierPhone: TextSizeAndColor;
  supplierAddress: TextSizeAndColor;
  supplierVatNumber: TextSizeAndColor;


  // Document number fields (different per type)
  invNumber: TextSizeAndColor;           // Invoice
  estimateNumber: TextSizeAndColor;      // Estimate
  creditNoteNumber: TextSizeAndColor;    // Credit Note
  purchaseOrderNumber: TextSizeAndColor;      // Purchase Order
  billNumber: TextSizeAndColor;       // Bill
  uom: TextSizeAndColor;       // Bill
  expenseNumber: TextSizeAndColor;       // Expense
  supplierCreditNumber: TextSizeAndColor; // Supplier Credit
  billOfEntryNumber: TextSizeAndColor; // Supplier Credit


  // Date fields
  invoiceDate: TextSizeAndColor;
  invoiceDueDate: TextSizeAndColor;
  estimateDate: TextSizeAndColor;
  estimateExpDate: TextSizeAndColor;
  creditNoteDate: TextSizeAndColor;
  purchaseOrderDate: TextSizeAndColor;
  purchaseOrderExpiryDate: TextSizeAndColor;
  expectedDeliveryDate: TextSizeAndColor;
  billDate: TextSizeAndColor;
  billDueDate: TextSizeAndColor;
  dueDate: TextSizeAndColor;
  expenseDate: TextSizeAndColor;
  supplierCreditDate: TextSizeAndColor;
  createdDate: TextSizeAndColor;
  paymentDate: TextSizeAndColor;
  billOfEntryDate: TextSizeAndColor;



  // Reference fields
  refrence: TextSizeAndColor;  // Keep typo for backward compatibility
  originalInvoice: TextSizeAndColor;     // Credit Note
  originalBill: TextSizeAndColor;        // Supplier Credit
  purchaseOrder: TextSizeAndColor;       // Bill
  vendorBillNumber: TextSizeAndColor;    // Bill

  // Expense-specific
  paymentMethodName: TextSizeAndColor;
  paidThrough: TextSizeAndColor;

  //invoice payment
  amountReceived: TextSizeAndColor;

  [key: string]: any;

  constructor(documentType: DocumentType = 'invoice') {
    // Initialize common fields
    this.tableTitle = new TextSizeAndColor();
    this.taxType = new TextSizeAndColor();
    this.barcode = new TextSizeAndColor();
    this.options = new TextSizeAndColor();

    // Default table header style - dark background with white text
    const defaultTableHeaderStyle = { color: '#fff', backgroundColor: '#3c3d3a' };

    // Table headers - all types with consistent styling
    this.invoiceTableHeader = new TextSizeAndColor(defaultTableHeaderStyle);
    this.estimateTableHeader = new TextSizeAndColor(defaultTableHeaderStyle);
    this.creditNoteTableHeader = new TextSizeAndColor(defaultTableHeaderStyle);
    this.purchaseTableHeader = new TextSizeAndColor(defaultTableHeaderStyle);
    this.billTableHeader = new TextSizeAndColor(defaultTableHeaderStyle);
    this.expenseTableHeader = new TextSizeAndColor(defaultTableHeaderStyle);
    this.supplierCreditTableHeader = new TextSizeAndColor(defaultTableHeaderStyle);
    this.invoicePaymentTableHeader = new TextSizeAndColor(defaultTableHeaderStyle);
    this.billPaymentTableHeader = new TextSizeAndColor(defaultTableHeaderStyle);
    this.billOfEntryTableHeader = new TextSizeAndColor(defaultTableHeaderStyle);


    // Table lines - all types
    this.invoicLines = new TextSizeAndColor();
    this.estimateLines = new TextSizeAndColor();
    this.creditNoteLines = new TextSizeAndColor();
    this.purchaseLines = new TextSizeAndColor();
    this.billLines = new TextSizeAndColor();
    this.expenseLines = new TextSizeAndColor();
    this.supplierCreditLines = new TextSizeAndColor();
    this.invoicePaymentLines = new TextSizeAndColor();
    this.billPaymentLines = new TextSizeAndColor();
    this.billOfEntryLines = new TextSizeAndColor();

    // Voided lines - all types
    this.invoicVoidedLines = new TextSizeAndColor();
    this.estimateVoidedLines = new TextSizeAndColor();
    this.creditNoteVoidedLines = new TextSizeAndColor();
    this.purchaseVoidedLines = new TextSizeAndColor();
    this.billVoidedLines = new TextSizeAndColor();
    this.expenseVoidedLines = new TextSizeAndColor();
    this.supplierCreditVoidedLines = new TextSizeAndColor();

    // Customer fields
    this.customerName = new TextSizeAndColor({ size: 10 });
    this.customerPhone = new TextSizeAndColor();
    this.customerAddress = new TextSizeAndColor();
    this.customerVatNumber = new TextSizeAndColor();
    this.vatNumber = new TextSizeAndColor({ size: 10 });
    this.salesPerson = new TextSizeAndColor({ size: 10 });
    this.employeeName = new TextSizeAndColor({ size: 10 });

    // POS / Order service fields — default to hidden so existing templates are unaffected
    this.service = new TextSizeAndColor({ size: 10, show: false });

    // Vendor fields
    this.supplierName = new TextSizeAndColor({ size: 10 });
    this.supplierPhone = new TextSizeAndColor();
    this.supplierAddress = new TextSizeAndColor();
    this.supplierVatNumber = new TextSizeAndColor({ size: 10 });

    // Document numbers
    this.invNumber = new TextSizeAndColor({ size: 10 });
    this.estimateNumber = new TextSizeAndColor({ size: 10 });
    this.creditNoteNumber = new TextSizeAndColor({ size: 10 });
    this.purchaseOrderNumber = new TextSizeAndColor({ size: 10 });
    this.billNumber = new TextSizeAndColor({ size: 10 });
    this.uom = new TextSizeAndColor({ size: 10 });
    this.expenseNumber = new TextSizeAndColor({ size: 10 });
    this.supplierCreditNumber = new TextSizeAndColor({ size: 10 });
    this.billOfEntryNumber = new TextSizeAndColor({ size: 10 });

    // Dates
    this.invoiceDate = new TextSizeAndColor({ size: 10 });
    this.invoiceDueDate = new TextSizeAndColor({ size: 10 });
    this.estimateDate = new TextSizeAndColor({ size: 10 });
    this.estimateExpDate = new TextSizeAndColor({ size: 10 });
    this.creditNoteDate = new TextSizeAndColor({ size: 10 });
    this.purchaseOrderDate = new TextSizeAndColor({ size: 10 });
    this.purchaseOrderExpiryDate = new TextSizeAndColor({ size: 10 });
    this.expectedDeliveryDate = new TextSizeAndColor({ size: 10 });
    this.billDate = new TextSizeAndColor({ size: 10 });
    this.billDueDate = new TextSizeAndColor({ size: 10 });
    this.dueDate = new TextSizeAndColor({ size: 10 });
    this.expenseDate = new TextSizeAndColor({ size: 10 });
    this.supplierCreditDate = new TextSizeAndColor({ size: 10 });
    this.createdDate = new TextSizeAndColor({ size: 10 });
    this.paymentDate = new TextSizeAndColor({ size: 10 });
    this.billOfEntryDate = new TextSizeAndColor({ size: 10 });

    // References
    this.refrence = new TextSizeAndColor({ size: 10 });
    this.originalInvoice = new TextSizeAndColor({ size: 10 });
    this.originalBill = new TextSizeAndColor({ size: 10 });
    this.purchaseOrder = new TextSizeAndColor({ size: 10 });
    this.vendorBillNumber = new TextSizeAndColor({ size: 10 });

    // Expense-specific
    this.paymentMethodName = new TextSizeAndColor({ size: 10 });
    this.paidThrough = new TextSizeAndColor({ size: 10 });
  
    //invoice payment
    this.amountReceived = new TextSizeAndColor({ size: 10 });
  }

  ParseJson(json: any): void {


    for (const key in json) {
      if (key != 'customFields') {
        const obj = new TextSizeAndColor();
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (key in this) {
        (this as any)[key] = json[key];
      }
    }

    // Ensure barcode is initialized
    if (!this.barcode) {
      this.barcode = new TextSizeAndColor({ color: '#34c38f', labelColor: '#fff' });
    }
    if (!this.options) {
      this.options = new TextSizeAndColor({ color: '#50a5f1', labelColor: '#fff' });
    }
  }



  /**
 * Get the user config for a specific document type
 */
  getUser(documentType: DocumentType): TextSizeAndColor {
    const mapping: Record<DocumentType, string> = {
      'invoice': 'customerName',
      'estimate': 'customerName',
      'credit-note': 'customerName',
      'purchaseOrder': 'supplierName',
      'bill': 'supplierName',
      'expense': 'supplierName',
      'supplier-credit': 'supplierName',
      'invoicePayment': 'customerName',
      'billPayment' : 'supplierName',
      'billOfEntry' : 'supplierName'
    };
    return this[mapping[documentType]] || this.customerName;
  }


  /**
* Get the user phone config for a specific document type
*/
  getUserPhone(documentType: DocumentType): TextSizeAndColor {
    const mapping: Record<DocumentType, string> = {
      'invoice': 'customerPhone',
      'estimate': 'customerPhone',
      'credit-note': 'customerPhone',
      'purchaseOrder': 'supplierPhone',
      'bill': 'supplierPhone',
      'expense': 'supplierPhone',
      'supplier-credit': 'supplierPhone',
      'invoicePayment': 'customerPhone',
      'billPayment': 'supplierPhone',
      'billOfEntry': 'supplierPhone',
    };
    return this[mapping[documentType]] || this.customerPhone;
  }


  /**
* Get the user phone config for a specific document type
*/
  getUserAddress(documentType: DocumentType): TextSizeAndColor {
    const mapping: Record<DocumentType, string> = {
      'invoice': 'customerAddress',
      'estimate': 'customerAddress',
      'credit-note': 'customerAddress',
      'purchaseOrder': 'supplierAddress',
      'bill': 'supplierAddress',
      'expense': 'supplierAddress',
      'supplier-credit': 'supplierAddress',
      'invoicePayment': 'customerAddress',
      'billPayment': 'supplierAddress',
      'billOfEntry': 'supplierAddress',
    };
    return this[mapping[documentType]] || this.customerAddress;
  }


  /**
* Get the user phone config for a specific document type
*/
  getUserVatNumber(documentType: DocumentType): TextSizeAndColor {
    const mapping: Record<DocumentType, string> = {
      'invoice': 'vatNumber',
      'estimate': 'vatNumber',
      'credit-note': 'vatNumber',
      'purchaseOrder': 'vatNumber',
      'bill': 'vatNumber',
      'expense': 'vatNumber',
      'supplier-credit': 'vatNumber',
      'invoicePayment': '',
      'billPayment': '',
      'billOfEntry': '',
    };
    return this[mapping[documentType]] || this.vatNumber;
  }


  /**
* Get the user phone config for a specific document type
*/
  getTransactionDate(documentType: DocumentType): TextSizeAndColor {
    const mapping: Record<DocumentType, string> = {
      'invoice': 'invoiceDate',
      'estimate': 'estimateDate',
      'credit-note': 'creditNoteDate',
      'purchaseOrder': 'purchaseOrderDate',
      'bill': 'billDate',
      'expense': 'expenseDate',
      'supplier-credit': 'supplierCreditDate',
      'invoicePayment': 'paymentDate',
      'billPayment': 'paymentDate',
      'billOfEntry': 'billOfEntryDate',

    };
    return this[mapping[documentType]] || this.invoiceDate;
  }


  /**
* Get the user phone config for a specific document type
*/
  getTransactionDueDate(documentType: DocumentType): TextSizeAndColor {
    const mapping: Record<DocumentType, string> = {
      'invoice': 'invoiceDueDate',
      'estimate': 'estimateExpDate',
      'credit-note': '',
      'purchaseOrder': 'purchaseOrderExpiryDate',
      'bill': 'billDueDate',
      'expense': '',
      'supplier-credit': '',
      'invoicePayment': '',
      'billPayment': '',
      'billOfEntry': '',
    };
    return this[mapping[documentType]] || this.invoiceDueDate;
  }



  /**
 * Get the number config for a specific document type
 */
  getTransactionNumber(documentType: DocumentType): TextSizeAndColor {
    const mapping: Record<DocumentType, string> = {
      'invoice': 'invNumber',
      'estimate': 'estimateNumber',
      'credit-note': 'creditNoteLines',
      'purchaseOrder': 'purchaseOrderNumber',
      'bill': 'billNumber',
      'expense': 'expenseNumber',
      'supplier-credit': 'supplierCreditNumber',
      'invoicePayment': '',
      'billPayment': '',
      'billOfEntry': 'billOfEntryNumber',
    };
    return this[mapping[documentType]] || this.invNumber;
  }

  /**
   * Get the table header config for a specific document type
   */
  getTableHeader(documentType: DocumentType): TextSizeAndColor {
    const mapping: Record<DocumentType, string> = {
      'invoice': 'invoiceTableHeader',
      'estimate': 'estimateTableHeader',
      'credit-note': 'creditNoteTableHeader',
      'purchaseOrder': 'purchaseTableHeader',
      'bill': 'billTableHeader',
      'expense': 'expenseTableHeader',
      'supplier-credit': 'supplierCreditTableHeader',
      'invoicePayment': 'invoicePaymentTableHeader',
      'billPayment': 'billPaymentTableHeader',
      'billOfEntry': 'billOfEntryTableHeader',
    };
    return this[mapping[documentType]] || this.invoiceTableHeader;
  }

  /**
   * Get the table lines config for a specific document type
   */
  getTableLines(documentType: DocumentType): TextSizeAndColor {
    const mapping: Record<DocumentType, string> = {
      'invoice': 'invoicLines',
      'estimate': 'estimateLines',
      'credit-note': 'creditNoteLines',
      'purchaseOrder': 'purchaseLines',
      'bill': 'billLines',
      'expense': 'expenseLines',
      'supplier-credit': 'supplierCreditLines',
      'invoicePayment': 'invoicePaymentLines',
      'billPayment': 'billPaymentLines',
      'billOfEntry': 'billOfEntryLines',
    };
    return this[mapping[documentType]] || this.invoicLines;
  }

  /**
   * Get the voided lines config for a specific document type
   */
  getVoidedLines(documentType: DocumentType): TextSizeAndColor {
    const mapping: Record<DocumentType, string> = {
      'invoice': 'invoicVoidedLines',
      'estimate': 'estimateVoidedLines',
      'credit-note': 'creditNoteVoidedLines',
      'purchaseOrder': 'purchaseVoidedLines',
      'bill': 'billVoidedLines',
      'expense': 'expenseVoidedLines',
      'supplier-credit': 'supplierCreditVoidedLines',
      'invoicePayment': '',
      'billPayment': '',
      'billOfEntry': '',
    };
    return this[mapping[documentType]] || this.invoicVoidedLines;
  }
}

/**
 * Table customization
 */
export class TableCustomization {
  order: TableColumnCustom;
  description: TableColumnCustom;
  product: TableColumnCustom;
  qty: TableColumnCustom;
  price: TableColumnCustom;
  taxPercantage: TableColumnCustom;  // Keep typo for backward compatibility
  tax: TableColumnCustom;
  discount: TableColumnCustom;

  //bill payment
  billingNumber: TableColumnCustom;
  issueDate: TableColumnCustom;
  reference: TableColumnCustom;

  amount: TableColumnCustom;

  // Expense
  total: TableColumnCustom;
  expense: TableColumnCustom;

  //bill
  uom: TableColumnCustom;
  unitCost: TableColumnCustom;

  //invoice payment
  invoiceNumber: TableColumnCustom;
  paidOn: TableColumnCustom;
  invoiceAmount: TableColumnCustom;
  paymentAmount: TableColumnCustom;

  //bill of entry
  assessambleValue: TableColumnCustom;
  customDutyAdditionalCharges: TableColumnCustom;
  taxableAmount: TableColumnCustom;

  


  [key: string]: any;

  constructor() {
    this.order = new TableColumnCustom();

    this.description = new TableColumnCustom()
    this.expense = new TableColumnCustom();
    this.product = new TableColumnCustom();
    //bill
    this.uom = new TableColumnCustom();

    this.qty = new TableColumnCustom();
    //bill
    this.unitCost = new TableColumnCustom();

    this.price = new TableColumnCustom();
    this.taxPercantage = new TableColumnCustom();
    this.tax = new TableColumnCustom();
    this.discount = new TableColumnCustom();
    //
    this.billingNumber = new TableColumnCustom();
    this.issueDate = new TableColumnCustom();
    this.reference = new TableColumnCustom();

    this.amount = new TableColumnCustom();

    this.total = new TableColumnCustom();

    this.invoiceNumber = new TableColumnCustom();
    this.paidOn = new TableColumnCustom();
    this.invoiceAmount = new TableColumnCustom();
    this.paymentAmount = new TableColumnCustom();


    this.assessambleValue = new TableColumnCustom();
    this.customDutyAdditionalCharges = new TableColumnCustom();
    this.taxableAmount = new TableColumnCustom();





  }

  ParseJson(json: any): void {
    const columns = ['order','description', 'product', 'uom', 'qty', 'price', 'taxPercantage', 'tax', 'discount', 'amount', 'total', 
                      'invoiceNumber', 'paidOn', 'invoiceAmount', 'paymentAmount', 'billingNumber', 'issueDate', 'reference',
                      'assessambleValue', 'customDutyAdditionalCharges', 'taxableAmount'
                    ];

    for (const key in json) {
      if (columns.includes(key)) {
        const obj = new TableColumnCustom();
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (key in this) {
        (this as any)[key] = json[key];
      }
    }

    // Set defaults
    this.setDefaults();
  }

  private setDefaults(): void {
    const defaults: { [key: string]: { width: number; label: string } } = {
      order: { width: 5, label: '#' },
      description: { width: 30, label: 'Description' },
      qty: { width: 10, label: 'Qty' },
      price: { width: 10, label: 'Price' },
      taxPercantage: { width: 10, label: 'Tax %' },
      tax: { width: 10, label: 'Tax' },
      discount: { width: 10, label: 'Discount' },
      amount: { width: 10, label: 'Amount' }
    };

    for (const key in defaults) {
      if (this[key].width === 0) {
        this[key].width = defaults[key].width;
      }
      if (this[key].label === '') {
        this[key].label = defaults[key].label;
      }
    }
  }
}

/**
 * Total table customization
 */
export class TotalTable {
  show: boolean = true;
  backgroundColor: string = 'white';
  itemTotal: TextSizeAndColor;
  taxTotal: TextSizeAndColor;
  discount: TextSizeAndColor;
  charge: TextSizeAndColor;
  delevary: TextSizeAndColor;  // Keep typo for backward compatibility
  Total: TextSizeAndColor;
  subTotal: TextSizeAndColor;
  roundingTotal: TextSizeAndColor;
  bankCharge: TextSizeAndColor;
  changeAmount: TextSizeAndColor;
  customDutyTotal: TextSizeAndColor;

  [key: string]: any;

  constructor() {
    this.itemTotal = new TextSizeAndColor({ size: 10 });
    this.taxTotal = new TextSizeAndColor({ size: 10 });
    this.discount = new TextSizeAndColor({ size: 10 });
    this.charge = new TextSizeAndColor({ size: 10 });
    this.delevary = new TextSizeAndColor({ size: 10 });
    this.Total = new TextSizeAndColor({ size: 10, bold: true });
    this.subTotal = new TextSizeAndColor({ size: 10, show: false });
    this.roundingTotal = new TextSizeAndColor({ size: 10 });
    this.bankCharge = new TextSizeAndColor({ size: 10 });
    this.changeAmount = new TextSizeAndColor({ size: 10 });
    this.customDutyTotal = new TextSizeAndColor({ size: 10 });
  }

  ParseJson(json: any): void {
    const fields = ['itemTotal', 'taxTotal', 'discount', 'charge', 'delevary', 'roundingTotal', 'Total', 'subTotal', 'bankCharge', 'changeAmount', 'customDutyTotal'];

    for (const key in json) {
      if (fields.includes(key)) {
        const obj = new TextSizeAndColor();
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }
}

/**
 * Payment table customization
 */
export class PaymentTable {
  show: boolean = true;
  backgroundColor: string = '#f1b44c';
  payments: TextSizeAndColor;
  paymentMethods: TextSizeAndColor;
  credit: TextSizeAndColor;
  balance: TextSizeAndColor;
  refundDue: TextSizeAndColor;

  [key: string]: any;

  constructor() {
    this.payments = new TextSizeAndColor({ size: 10 });
    this.paymentMethods = new TextSizeAndColor({ size: 10 });
    this.credit = new TextSizeAndColor({ size: 10 });
    this.balance = new TextSizeAndColor({ size: 10 });
    this.refundDue = new TextSizeAndColor({ size: 10 });
  }

  ParseJson(json: any): void {
    const fields = ['payments', 'paymentMethods', 'credit', 'balance', 'refundDue'];

    for (const key in json) {
      if (fields.includes(key)) {
        const obj = new TextSizeAndColor();
        obj.ParseJson(json[key]);
        this[key] = obj;
      } else if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }
}

/**
 * Customer/Vendor balance display
 */
export class CustomerBalance {
  show: boolean = true;
  backgroundColor: string = '#f1b44c';
  balance: TextSizeAndColor;

  constructor() {
    this.balance = new TextSizeAndColor({ size: 10 });
  }

  ParseJson(json: any): void {
    if (json.balance) {
      const obj = new TextSizeAndColor();
      obj.ParseJson(json.balance);
      this.balance = obj;
    }
    if ('show' in json) this.show = json.show;
    if ('backgroundColor' in json) this.backgroundColor = json.backgroundColor;
  }
}

/**
 * Total section customization
 */
export class TotalSectionCustomization {
  totalTable: TotalTable;
  paymentTable: PaymentTable;
  customerBalance: CustomerBalance;

  constructor() {
    this.totalTable = new TotalTable();
    this.paymentTable = new PaymentTable();
    this.customerBalance = new CustomerBalance();
  }

  ParseJson(json: any): void {
    if (json.totalTable) {
      const obj = new TotalTable();
      obj.ParseJson(json.totalTable);
      this.totalTable = obj;
    }
    if (json.paymentTable) {
      const obj = new PaymentTable();
      obj.ParseJson(json.paymentTable);
      this.paymentTable = obj;
    }
    if (json.customerBalance) {
      const obj = new CustomerBalance();
      obj.ParseJson(json.customerBalance);
      this.customerBalance = obj;
    }
  }
}

/**
 * Type aliases for backward compatibility
 */
export type textSizeAndColor = TextSizeAndColor;
export type textSizeAndColorAndAligment = TextSizeAndColorAndAlignment;
export type margins = Margins;
export type headerCustomization = HeaderCustomization;
export type footerCustomization = FooterCustomization;
export type transactionalDetailsCustomization = TransactionalDetailsCustomization;
export type tableCustomization = TableCustomization;
export type totalSectionCustomization = TotalSectionCustomization;
export type totalTable = TotalTable;
export type paymentTable = PaymentTable;


