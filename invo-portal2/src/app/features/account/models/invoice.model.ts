import Decimal from 'decimal.js';
import { MathUtils } from '@core/math/math-helpers';
import { CompanyService } from '@core/auth/company.service';
import { CustomerAddress } from '../customers/models/customer.model';
import { TaxDetails, TaxLineModel } from './tax.model';

/** Product picked on a document line (legacy `SelectedItem`). */
export class SelectedItem {
  id: string = '';
  name: string = '';
  type: string = '';
  barcode: string = '';
  printQty: number = 1;
  price: number = 1;
  unitCost: number = 1;
  description: string = '';
  /** Kept as a real field: ParseJson only copies `key in this`, so without it the server's translation would be dropped on save/reload. */
  translation: any = null;

  [key: string]: any;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) this[key as keyof typeof this] = json[key];
    }
  }
}

export class Invoice {
  id: string | null = null;
  invoiceNumber: string = '';
  attachment: any[] = [];
  customerPhone: string = '';
  refrenceNumber: string = '';
  note: string = '';
  guests: number = 0;
  employeeId: string = '';
  employeeName: string = '';
  tableId: string | null;
  total: number = 0;
  branchId: string = '';
  lines: InvoiceLine[] = [];
  salesEmployeeId: string = '';
  salesEmployeeName: string = '';
  salesRepresentative: string = '';
  settledBy: string = '';
  appliedCredit: number = 0;
  createdAt: Date = new Date();
  invoiceDate = new Date();
  branchName: string = '';
  branchAddress: string = '';
  branchPhone: string = '';
  invoicePayments: any = [];
  payments: any = [];
  source: string = '';
  serviceId: string | null;
  serviceName: string = '';
  carNumber: string = '';
  tableName: string = '';
  tableGroupName: string = '';
  customerId: string | null = null;
  customerContact: string = '';
  customerEmail: string = '';
  customerAddress: CustomerAddress = new CustomerAddress();
  customer: any = {};
  customeLatLang: string = '';
  customerName: string = 'WalkIn Customer';
  customerVatNumber: string = '';
  status: string = '';
  onlineData: OnlineData = new OnlineData();
  mergeWith: string = '';
  terminalId: string = '';
  mergeWithInvoiceNumber: string = '';
  paymentMethodId = '';
  chargeType: string | null = null;
  chargesTaxDetails!: TaxDetails | null;
  smallestCurrency: number = 0;
  roundingType: string = 'normal';
  currencyId = null;
  customFields: { [id: string]: any } = {};
  branchCustomFields: { [id: string]: any } = {};

  isInclusiveTax = false;

  discountId: string | null = null;
  discountAmount: number = 0;
  discountPercentage: boolean = true;
  discountTotal = 0;
  discountType = '';

  /**
   * The invoice discount is always taken before tax and always includes the tax, so both are
   * true and the form does not offer them as a choice the way the bill does.
   */
  applyDiscountBeforeTax = true;
  discountIncludesTax = true;
  /** the tax the invoice discount removed from the lines */
  taxReduction = 0;
  chargeId: string | null = null;
  chargeAmount = 0;
  chargePercentage = false;
  chargeTotal: number = 0; //calculated

  receivableAccountId: string = '';
  customerSignature: string = '';

  deliveryCharge: number = 0;

  subTotal = 0;
  itemSubTotal = 0;
  itemSubTotalBeforeDiscountWithTax = 0;
  itemTotalAfterDiscountWithoutTax = 0;
  itemTotalWithoutTax = 0;
  itemDiscountTotal = 0;
  itemSubTotalAfterDiscount = 0;
  invoiceTaxTotal = 0;
  roundingTotal: number = 0;
  balance: number = 0;
  returnedAmount: number = 0;
  creditBalance: number = 0;
  paidAmount: number = 0;
  isFullyRefunded: boolean = false;
  serviceNo: string = '';
  dueDate: Date | string = '';
  taxesDetails: any[] = [];
  // invoicePayments:InvoicePayment[]=[];
  // term:string = "net7";
  paymentTerm: string = 'net7';

  zatca_status = '';
  pointsDiscount: number | null = null;
  promoCoupon: number | null = null;
  couponId: string | null = null;
  couponType = '';

  // for preview
  currency: any | null = null;

  constructor() {
    this.tableId = null;
    this.serviceId = null;
    this.customerId = null;
    let temp = new InvoiceLine();
    temp.isNew = true;
    this.lines.push(temp);
  }

  get lineTotal(): number {
    let price = 0;
    this.lines.forEach((element) => {
      // let line = new InvoiceLine();
      // line.ParseJson(element);
      element.isInclusiveTax = this.isInclusiveTax;
      // price += element.amount;
      price +=
        element.voidedItems &&
          element.voidedItems.length == 0 &&
          element.isVoided
          ? 0
          : element.amount;

      if (element.voidedItems != null) {
        element.voidedItems.forEach((voided) => {
          price += voided.amount;
        });
      }
    });

    return price;
  }

  itemTotal(): number {
    let price = 0;
    let subTotal = 0;
    let taxTotal = 0;
    this.lines.forEach((element) => {
      element.isInclusiveTax = this.isInclusiveTax;

      /** the invoice level discount is spread over the lines again once they are all calculated */
      element.invoiceDiscount = 0;
      //calcuate the amount
      element.calculateAmount();

      price +=
        element.voidedItems &&
          element.voidedItems.length == 0 &&
          element.isVoided
          ? 0
          : element.total;
      subTotal += MathUtils.sub(element.subTotal, element.discountTotal);
      taxTotal += element.taxTotal;
      let voidedQty = 0;
      if (element.voidedItems && element.voidedItems.length > 0) {
        element.voidedItems.forEach((voided) => {
          voided.isInclusiveTax = this.isInclusiveTax;
          voided.invoiceDiscount = 0;
          //calcuate the amount
          voided.calculateAmount();
          taxTotal += voided.taxTotal;
          price += voided.amount;
          voidedQty += Math.abs(voided.qty)
          subTotal += MathUtils.add(voided.subTotal, voided.discountTotal * -1);
        });
        element.voidedQty = voidedQty
        element.minQty = voidedQty
      }

    });
    this.invoiceTaxTotal = taxTotal;
    this.itemSubTotal = subTotal;
    return price;
  }

  /**
   * The lines the invoice level discount is spread over, each with the net value it weighs.
   * It mirrors the lines making up the invoice total in itemTotal(), except that the voided
   * quantity takes no share of the discount : a void line weighs 0 and its (negative) net is
   * folded back into the line it was voided from. So a partially voided line only carries the
   * discount of the quantity still sold, and a line voided in full carries none.
   *
   * A void is always a line of its own holding the negative quantity : it is either listed in
   * "voidedItems" of the line it was voided from, or - when the line is voided in full and its
   * void lines are not loaded - the line itself is flagged "isVoided" and is left out.
   */
  transactionDiscountEntries(): { line: InvoiceLine; net: number }[] {
    const entries: { line: InvoiceLine; net: number }[] = [];
    const netOf = (line: InvoiceLine) =>
      MathUtils.sub2(line.total, line.taxTotal);

    this.lines.forEach((element) => {
      if (!(element.isVoided && element.voidedItems.length == 0)) {
        let net = netOf(element);
        element.voidedItems.forEach((voided) => {
          net = MathUtils.add2(net, netOf(voided));
        });
        entries.push({ line: element, net: net });
      }

      /** listed with no weight so applyInvoiceDiscount() clears the share of an earlier calculation */
      element.voidedItems.forEach((voided) =>
        entries.push({ line: voided, net: 0 }),
      );
    });

    return entries;
  }

  /**
   * The base the invoice (transaction) level discount is taken from.
   * The discount is always applied before tax, so the base is the net value of the lines
   * (line total after the line discount without its tax) for inclusive and exclusive tax.
   */
  transactionDiscountBase(): number {
    let base = 0;
    this.transactionDiscountEntries().forEach((entry) => {
      base = MathUtils.add2(base, entry.net);
    });
    return base;
  }

  get invoiceDiscount(): number {
    if (this.discountType == 'itemDiscount') return 0;

    if (this.applyDiscountBeforeTax) {
      if (this.discountAmount <= 0) return 0;
      const base = this.transactionDiscountBase();
      if (base <= 0) return 0;

      if (this.discountPercentage) {
        return MathUtils.roundDecimal(
          MathUtils.multiply2(
            base,
            MathUtils.division2(this.discountAmount, 100),
          ),
        );
      }
      return MathUtils.roundDecimal(
        this.discountAmount > base ? base : this.discountAmount,
      );
    }

    if (this.discountPercentage) {
      return this.lineTotal * (this.discountAmount / 100);
    } else {
      return this.discountAmount;
    }
  }

  /**
   * Spreads the invoice (transaction) level discount over the lines.
   * Every line takes the share of the discount matching its net value and its tax is
   * calculated again on its new taxable amount, since the discount is always applied before tax.
   * The line total is not touched, only its tax and its taxable amount, the discount itself is
   * taken off the invoice total together with the tax it removed (taxReduction).
   */
  applyTransactionDiscount() {
    this.taxReduction = 0;

    const entries = this.transactionDiscountEntries();
    const base = this.transactionDiscountBase();
    if (entries.length == 0 || base <= 0 || this.discountTotal <= 0) return;

    const shares: number[] = [];
    let allocated = 0;
    let biggest = 0;

    entries.forEach((entry, index) => {
      /** a void line weighs nothing : the discount of what it took back is already off its line */
      /** the ratio is kept unrounded so the shares stay as close as possible to the line values */
      const share =
        entry.net == 0
          ? 0
          : MathUtils.roundDecimal(
              MathUtils.multiply2(
                this.discountTotal,
                MathUtils.division2(entry.net, base),
              ),
            );

      shares.push(share);
      allocated = MathUtils.add2(allocated, share);

      if (Math.abs(entry.net) > Math.abs(entries[biggest].net)) biggest = index;
    });

    /** the rounding left over goes to the biggest line so the shares always add up to the invoice discount */
    shares[biggest] = MathUtils.add2(
      shares[biggest],
      MathUtils.sub2(this.discountTotal, allocated),
    );

    entries.forEach((entry, index) => {
      this.taxReduction = MathUtils.add2(
        this.taxReduction,
        entry.line.applyInvoiceDiscount(shares[index]),
      );
    });
  }

  setserviceNo() {
    if (this.tableName != '' && this.tableName != null) {
      this.serviceNo = this.tableName;
    } else if (this.carNumber != '' && this.carNumber != null) {
      this.serviceNo = this.carNumber;
    } else {
      this.serviceNo = ' ';
    }
  }

  calculateTotal() {
    this.total = this.itemTotal();
    this.subTotal = this.total;
    /** the net value of the lines, the base the invoice discount is taken from */
    this.itemTotalWithoutTax = MathUtils.sub2(this.total, this.invoiceTaxTotal);
    this.taxReduction = 0;

    this.discountTotal = this.invoiceDiscount;
    if (this.discountTotal != 0) {
      this.total = MathUtils.sub2(this.total, this.discountTotal);

      if (this.applyDiscountBeforeTax) {
        /** the discount is taken before tax so the lines lose a part of their tax with it */
        this.applyTransactionDiscount();
        this.total = MathUtils.sub2(this.total, this.taxReduction);
        this.invoiceTaxTotal = MathUtils.sub2(
          this.invoiceTaxTotal,
          this.taxReduction,
        );
      }
    }

    this.chargeTotal = this.chargeAmount;
    if (this.chargeAmount > 0) {
      if (this.chargePercentage) {
        let totalForCharge =
          this.chargeType == 'chargeBeforeTax' && this.isInclusiveTax
            ? MathUtils.sub(this.total, this.invoiceTaxTotal)
            : MathUtils.sub(this.total, this.invoiceTaxTotal);
        this.chargeTotal = MathUtils.multiply(
          totalForCharge,
          this.chargeAmount / 100,
        );
      } else {
        if (this.total == 0) {
          this.chargeAmount = 0;
        }
      }

      this.total += this.chargeTotal;
    }

    if (
      this.chargesTaxDetails &&
      this.chargeId != null &&
      this.chargeId != '' &&
      this.chargeTotal > 0 &&
      this.chargeType == 'chargeBeforeTax'
    ) {
      this.calculateChargeTax(this.chargeTotal);
      this.invoiceTaxTotal += this.chargesTaxDetails.taxAmount;
      if (!this.isInclusiveTax) {
        this.total = MathUtils.add(
          this.total,
          this.chargesTaxDetails.taxAmount,
        );
      }
    }

    this.total = MathUtils.add(this.total, this.deliveryCharge);

    this.calculateRounding(MathUtils.afterDecimal);
    this.total = MathUtils.add(this.total, this.roundingTotal);
  }

  calculateRounding(afterDecimal: number) {
    const companySettings = CompanyService.companySettings;

    if (
      this.smallestCurrency == 0 ||
      this.smallestCurrency == null ||
      this.smallestCurrency == undefined
    ) {
      this.smallestCurrency =
        companySettings?.smallestCurrency && companySettings.smallestCurrency > 0
          ? companySettings.smallestCurrency
          : MathUtils.division(
              1,
              MathUtils.roundNumber(Math.pow(10, parseInt(afterDecimal.toString())))
            );
    }

    if (!this.roundingType) {
      this.roundingType = companySettings?.roundingType ?? 'normal';
    }

    if (this.smallestCurrency > 0) {
      let roundedTotal = 0;
      switch (this.roundingType) {
        case 'normal':
          roundedTotal = MathUtils.multiply(
            Math.round(MathUtils.division(this.total, this.smallestCurrency)),
            this.smallestCurrency
          );
          break;
        case 'positive':
          roundedTotal = MathUtils.multiply(
            Math.ceil(MathUtils.division(this.total, this.smallestCurrency)),
            this.smallestCurrency
          );
          break;
        case 'negative':
          roundedTotal = MathUtils.multiply(
            Math.trunc(MathUtils.division(this.total, this.smallestCurrency)),
            this.smallestCurrency
          );
          break;
        default:
          this.roundingTotal = 0;
          return;
      }

      this.roundingTotal = MathUtils.sub(roundedTotal, this.total);
    } else {
      this.roundingTotal = 0;
    }
  }

  calculateChargeTax(chargeTotal: number) {
    //If the tax applied is Group Tax
    if (this.chargesTaxDetails) {
      if (
        this.chargesTaxDetails.taxes &&
        Array.isArray(this.chargesTaxDetails.taxes) &&
        this.chargesTaxDetails.taxes.length > 0 &&
        this.chargesTaxDetails.type != ''
      ) {
        let total = chargeTotal; // qty*price
        let taxTotal = 0;
        let taxTotalPercentage = 0;
        const taxesTemp: any = [];

        if (this.chargesTaxDetails.type == 'flat') {
          // flat tax calculate both tax separately from line total
          this.chargesTaxDetails.taxes.forEach((tax: any) => {
            const taxAmount = this.isInclusiveTax
              ? MathUtils.division(
                MathUtils.multiply(total, tax.taxPercentage),
                MathUtils.add(100, tax.taxPercentage),
              )
              : MathUtils.multiply(
                total,
                MathUtils.division(tax.taxPercentage, 100),
              );
            taxTotalPercentage += tax.taxPercentage;
            taxTotal += taxAmount;
            tax.taxAmount = taxAmount;
            taxesTemp.push(tax);
          });
        } else if (this.chargesTaxDetails.type == 'stacked') {
          // stacked tax both tax depened on each other
          this.chargesTaxDetails.taxes.forEach((tax: any) => {
            const taxAmount = this.isInclusiveTax
              ? MathUtils.division(
                MathUtils.multiply(total, tax.taxPercentage),
                MathUtils.add(100, tax.taxPercentage),
              )
              : MathUtils.multiply(
                total,
                MathUtils.division(tax.taxPercentage, 100),
              );
            taxTotalPercentage += tax.taxPercentage;
            taxTotal += taxAmount;
            total += taxAmount;
            tax.taxAmount = taxAmount;
            taxesTemp.push(tax);
          });
        }
        this.chargesTaxDetails.taxPercentage = taxTotalPercentage;
        this.chargesTaxDetails.taxAmount = taxTotal;
        this.chargesTaxDetails.taxes = taxesTemp;
      } else {
        this.chargesTaxDetails.taxAmount = this.isInclusiveTax
          ? MathUtils.division(
            MathUtils.multiply(
              chargeTotal,
              this.chargesTaxDetails.taxPercentage,
            ),
            MathUtils.add(100, this.chargesTaxDetails.taxPercentage),
          )
          : MathUtils.multiply(
            chargeTotal,
            MathUtils.division(this.chargesTaxDetails.taxPercentage, 100),
          );

        let a = new Decimal(chargeTotal);
        let b = +new Decimal(10) / +new Decimal(100);
      }
    }
  }

  ParseJson(json: any): void {
    let _line: InvoiceLine;
    let _branchCustomFields: any;
    let _customFields: any;
    
    let temp;
    for (const key in json) {
      if (key == 'customerName') {
        if (json[key] == '' || json[key] == null) {
          this.customerName = 'WalkIn Customer';
        } else {
          this.customerName = json[key];
        }
      } else if (key == 'customerPhone') {
        if (json[key] == '' || json[key] == null) {
          this.customerPhone = '';
        } else {
          this.customerPhone = json[key];
        }
      } else if (key == 'customerAddress') {
        const _customerAddress = new CustomerAddress();
        _customerAddress.ParseJson(json[key]);
        this[key] = _customerAddress;
      } else if (key == 'customFields') {
        // Handle customFields as object with ID keys
        this.customFields = {};
        temp = json[key];

        if (temp && typeof temp === 'object') {
          // If it's already in the new format {id: value}
          if (!Array.isArray(temp)) {
            this.customFields = { ...temp };
          } else {
            // Handle old array format for backward compatibility
            temp.forEach((field: any) => {
              if (field.id) {
                this.customFields[field.id] = field.value;
              }
            });
          }
        }
      } else if (key == 'branchCustomFields') {
        // Handle customFields as object with ID keys
        this.branchCustomFields = {};
        temp = json[key];

        if (temp && typeof temp === 'object') {
          // If it's already in the new format {id: value}
          if (!Array.isArray(temp)) {
            this.branchCustomFields = { ...temp };
          } else {
            // Handle old array format for backward compatibility
            temp.forEach((field: any) => {
              if (field.id) {
                this.branchCustomFields[field.id] = field.value;
              }
            });
          }
        }
      } else if (key == 'lines') {
        this.lines = [];
        temp = json[key];
        for (const propName in temp) {
          _line = new InvoiceLine();
          _line.ParseJson(temp[propName]);
          this.lines.push(_line);
        }
      } else if (key == 'chargesTaxDetails') {
        const _chargeTaxDetails = new TaxDetails();
        _chargeTaxDetails.ParseJson(json[key]);
        this.chargesTaxDetails = _chargeTaxDetails;
      } else if (key == 'onlineData') {
        const _onlineData = new OnlineData();
        _onlineData.ParseJson(json[key]);
        this.onlineData = _onlineData;
      } else {
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
      }
    }
    // if(this.attachment == null){
    //   this.attachment = [];
    // }
  }
}

export class InvoicePaymentTemp {
  paymentMethod: any = { name: '' };
  tenderAmount: number = 0;
  rate: number = 1;
  tenderEquivalent = 0;

  calculateEquivalentAmount() {
    this.tenderEquivalent = this.tenderAmount * this.rate;
  }
}

export class InvoiceLine {
  id: string | null = null;
  invoiceId: string = '';
  qty: number = 1;
  price: number = 0;
  createdAt: Date = new Date();
  lineCreatedAt: Date = new Date(); //ZAHRAA_HABIB: only for display
  productId: string = '';
  productName: string = '';
  categoryId: string | null = null;
  categoryName: string = '';
  total: number = 0;
  UOM: string = '';
  branchId: string = '';
  branchName: string = '';
  CRNUMBER: string = '';
  employeeId: string = '';
  batch: string = '';
  serial: string = '';
  subItems: any[] = [];
  seatNumber: number = 0;
  parentId: string | null;
  salesEmployeeId: string | null;
  note: string = '';
  isNew: boolean = false;
  showDropdownItems: boolean = false;
  selectedItem!: SelectedItem;
  discount: any = 0;
  accountId: string | null = '';
  accountName: string | null = '';
  isReturned: boolean = false;
  discountTotal = 0;
  subTotal = 0;
  maxQty: number = 0;
  waste = false;
  voidReason = '';
  index = 0;
  isInclusiveTax = false;

  commissionPercentage = false;
  commissionAmount = 0;

  lineQtyLimit = 0;

  discountId: string | null = null;
  discountAmount: number = 0;
  discountPercentage = true;

  /** the share of the invoice level discount that belongs to this line */
  invoiceDiscount = 0;
  /** the part of "taxTotal" that share removed, "taxTotal" keeps the tax before it */
  taxReduction = 0;
  /** the net value the tax of the line is calculated on, after the line and the invoice discount */
  taxableAmount = 0;

  /**
   * for display only : the qty the line was invoiced with and what the credit notes of it are
   * already holding, the credit note form divides the share of the line with them.
   */
  invoiceLineQty = 0;
  invoiceLineTaxReduction = 0;
  creditNoteQty = 0;
  creditNoteInvoiceDiscount = 0;
  creditNoteTaxReduction = 0;

  serviceDuration: number = 0;
  appointmentDate = new Date();

  options: InvoiceLineOption[] = [];

  discountedAmount: number = 0;

  isVoided = false;
  justVoided = false; //temp value to indicate if line is just voided

  voidedFrom: string | null;
  voidedItems: InvoiceLine[] = [];

  /** Direct URL of the product image, used by the document builder image column. */
  mediaUrl: string | null = null;

  taxId: string | null;
  taxTotal = 0;
  taxes: TaxLineModel[] = []; // empty when selected tax  is not Group tax
  taxType = ''; //empty when selected tax  is not Group tax  [flat/stacked]
  taxPercentage = 0;

  // for preview only
  itemDetailsTemp: any;
  optionsText: string = '';
  tempTaxesList: any[] = [];
  tempId: string = '';

  selectedToPick = false;
  disabled = false;

  smallestCurrency = 0;
  roundingTotal = 0;
  roundingType = '';

  discountPerQty = false;
  discountedByCoupon = false;
  voidedQty = 0;
  minQty = 0.001
  tempQty = 1
  /**
   * @param isInclusiveTax lets the caller calculate the tax on an amount that is already a net
   * amount (the taxable amount after the invoice discount), it defaults to the line setting
   */
  calculateTax(subTotal: number, isInclusiveTax: boolean = this.isInclusiveTax) {
    if (this.taxPercentage == 0) {
      this.taxTotal = 0;
      return;
    }
    //If the tax applied is Group Tax
    let total = subTotal;
    if (this.taxes != null && this.taxes.length > 0) {
      let taxTotal = 0;
      let taxTotalPercentage = 0;
      let taxesTemp: any = [];

      if (this.taxType == 'flat') {
        // flat tax calculate both tax separately from line total
        this.taxes.forEach((tax: TaxLineModel) => {
          let taxAmount =
            isInclusiveTax == true
              ? MathUtils.division2(
                MathUtils.multiply2(total, tax.taxPercentage),
                MathUtils.add2(100, tax.taxPercentage),
              )
              : MathUtils.multiply2(
                total,
                MathUtils.division2(tax.taxPercentage, 100),
              );
          taxTotalPercentage += tax.taxPercentage;
          taxTotal = MathUtils.add2(taxTotal, taxAmount);
          tax.taxAmount = taxAmount;
          taxesTemp.push(tax);
        });
      } else if (this.taxType == 'stacked') {
        // stacked tax both tax depened on each other
        this.taxes.forEach((tax: TaxLineModel) => {
          let taxAmount =
            isInclusiveTax == true
              ? MathUtils.division2(
                MathUtils.multiply2(total, tax.taxPercentage),
                MathUtils.add2(100, tax.taxPercentage),
              )
              : MathUtils.multiply2(
                total,
                MathUtils.division2(tax.taxPercentage, 100),
              );
          taxTotalPercentage += tax.taxPercentage;
          taxTotal = MathUtils.add2(taxTotal, taxAmount);
          total = MathUtils.add2(total, taxAmount);
          tax.taxAmount = taxAmount;
          taxesTemp.push(tax);
        });
      }
      this.taxTotal = taxTotal;
      this.taxes = taxesTemp;
    } else {
      this.taxTotal = isInclusiveTax
        ? MathUtils.division2(
          MathUtils.multiply2(total, this.taxPercentage),
          MathUtils.add2(100, this.taxPercentage),
        )
        : MathUtils.multiply2(
          total,
          MathUtils.division2(this.taxPercentage, 100),
        );
    }
  }

  /**
   * Applies the share of the invoice (transaction) level discount that belongs to this line.
   * The invoice discount is always taken before tax, so the tax of the line is calculated again
   * on the taxable amount : the net value left after the line discount and the invoice discount.
   *
   * The line total is left as it is, the invoice discount is only taken off the invoice total.
   *
   * @returns the tax amount the invoice discount took off this line
   */
  applyInvoiceDiscount(invoiceDiscount: number): number {
    const taxBeforeInvoiceDiscount = this.taxTotal;

    /** the line total holds the tax when it is exclusive and includes it when it is inclusive, in both cases the net is total - tax */
    const net = MathUtils.sub2(this.total, this.taxTotal);

    this.invoiceDiscount = invoiceDiscount;
    this.taxableAmount = MathUtils.sub2(net, invoiceDiscount);

    if (invoiceDiscount != 0 && this.taxId != null && this.taxId != '') {
      /** always calculated as exclusive tax, the taxable amount is already a net amount */
      this.calculateTax(this.taxableAmount, false);
    }

    this.taxReduction = MathUtils.sub2(
      taxBeforeInvoiceDiscount,
      this.taxTotal,
    );

    return this.taxReduction;
  }

  calculateAmount(): number {
    let optionTotal = 0;

    this.options.forEach((element) => {
      optionTotal += this.qty * element.qty * element.price;
    });

    let total = this.price * this.qty + optionTotal;
    this.discountedAmount = this.discountPercentage
      ? (total * this.discountAmount) / 100
      : this.discountAmount;

    if (this.discountPerQty) {
      this.discountedAmount = this.discountedAmount * this.qty;
    }
    if (this.qty > 0) {
      this.discountedAmount = Math.min(this.discountedAmount, total);
    } else if (this.qty < 0 && !this.discountPerQty) {
      this.discountedAmount = this.discountedAmount * (-1);
    }

    total = MathUtils.sub(total, this.discountedAmount);

    if (this.taxId != '' && this.taxId != null) {
      this.calculateTax(total);
      if (!this.isInclusiveTax) {
        /** the tax keeps its full precision, the rounding is done on the invoice total */
        total = MathUtils.add2(total, this.taxTotal);
      }
    }

    this.total = total;
    this.taxableAmount = MathUtils.sub2(this.total, this.taxTotal);

    /**
     * the share of the invoice level discount is kept through a recalculation of the line,
     * it is reset by the invoice in itemTotal() before it is spread over the lines again
     */
    if (this.invoiceDiscount != 0) {
      this.applyInvoiceDiscount(this.invoiceDiscount);
    }

    return total;
  }

  get amount() {
    return this.calculateAmount();
  }

  /** Alias for `categoryName` so report templates can bind `row.category` —
   *  the same field name the document-builder's dummy preview data uses —
   *  without needing a separate expression for real vs. preview data. */
  get category(): string {
    return this.categoryName;
  }

  get optionList() {
    let _options: any[] = [];
    this.options.forEach((element) => {
      _options.push({
        name: element.optionName ?? element.note,
        price: element.price,
      });
    });
    return _options;
  }

  constructor() {
    this.parentId = null;
    this.salesEmployeeId = null;
    this.taxId = null;
    this.voidedFrom = null;
  }

  ParseJson(json: any): void {
    let temp: any;
    for (const key in json) {
      if (key == 'options') {
        this.options = [];
        temp = json[key];

        for (const propName in temp) {
          let _option = new InvoiceLineOption();
          _option.ParseJson(temp[propName]);
          this.options.push(_option);
        }
      } else if (key == 'voidedItems') {
        const voidedTemps: InvoiceLine[] = [];
        let invoiceLine: InvoiceLine;
        json[key].forEach((line: any) => {
          invoiceLine = new InvoiceLine();
          invoiceLine.ParseJson(line);
          voidedTemps.push(invoiceLine);
        });
        this.voidedItems = voidedTemps;
      } else if (key == 'subItems') {
        const subItems: InvoiceLine[] = [];
        let invoiceLine: InvoiceLine;
        json[key].forEach((line: any) => {
          invoiceLine = new InvoiceLine();
          invoiceLine.ParseJson(line);
          subItems.push(invoiceLine);
        });
        this.subItems = subItems;
      } else if (key == 'selectedItem') {
        const _selectedItem = new SelectedItem();
        _selectedItem.ParseJson(json[key]);
        this[key] = _selectedItem;
      } else if (key == 'taxes') {
        const taxes: TaxLineModel[] = [];
        let _tax: TaxLineModel;
        if (json[key] != null && json[key].length > 0) {
          json[key].forEach((tax: any) => {
            _tax = new TaxLineModel();
            _tax.ParseJson(tax);
            taxes.push(_tax);
          });
        }

        this.taxes = taxes;
      } else if (key == 'qty') {
        this.qty = json[key]
        this.tempQty = this.qty
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }

    if (this.note != '' && this.note != null) {
      this.itemDetailsTemp = this.note;
    } else {
      this.itemDetailsTemp = this.productId;
    }
  }
}

export class InvoiceLineOption {
  id: string | null = null;
  invoiceLineId: string = '';
  optionId: string | null = null;
  optionName: string = '';
  note: string = '';
  price: number = 0;
  qty: number = 0;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class ExtraCharge {
  id: string | null = null;
  percentage: boolean = false;
  amount: number = 0;
  chargeTotal: number = 0;
}

export class OnlineData {
  sessionId: string = '';
  onlineStatus: string = '';
  rejectReason: string = '';

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
