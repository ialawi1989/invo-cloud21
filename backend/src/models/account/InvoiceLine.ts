import { InvoiceRepo } from "@src/repo/app/accounts/invoice.repo";
import { SurchargeRepo } from "@src/repo/app/accounts/surcharge.repo";
import { Helper } from "@src/utilts/helper";
import { Discount } from "./Discount";
import { InvoiceLineOption } from "./invoiceLineOption";
import Decimal from 'decimal.js'


export class TaxModel {
    name = ""
    index = ""
    taxId = ""
    taxPercentage = 0
    taxAmount = 0

    ParseJson(json: any): void {

        for (const key in json) {

            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}
export class InvoiceLineRecipe {
    productId = "";
    cost = 0;
    qty = 0
    unitCost = 0;
    ParseJson(json: any): void {

        for (const key in json) {

            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}
export class InvoiceLine {
    id = "";
    invoiceId = "";
    branchId = "";
    employeeId: string | null;
    parentId: string | null; //when line is Created from "Lines sunItems"
    note = "";
    accountId = "";
    productId: string | null;

    companyId = ""
    batch = "";
    serial = "";

    priceOfferType = "";

    seatNumber = 0;
    qty = 0;
    price = 0;
    total = 0;
    defaultPrice = 0
    subTotal = 0;


    holdTime: Date | null;
    printTime: Date | null;
    readyTime: Date | null;
    translation: {} | null = null;
    /**
     * menu selection and packge product 
     * use subItems => sub items will be added as new line having the parentId = line id of (package or menu selection product) 
     */
    subItems: InvoiceLine[] = [];
    product: any | null = {};
    voidedItems: InvoiceLine[] = [];
    returnItems: InvoiceLine[] = [];
    createdAt: Date | number = new Date();



    taxId: string | null;
    taxTotal = 0;
    taxes: TaxModel[] = []; // empty when selected tax  is not Group tax 
    taxType = "" //empty when selected tax  is not Group tax  [flat/stacked]
    taxPercentage = 0;
    isInclusiveTax = false;


    discountId: string | null;
    discountAmount = 0;
    discountPercentage = false
    discount: any;


    salesEmployeeId: string | null;
    commissionPercentage = false;
    commissionAmount = 0;
    commissionTotal = 0;

    serviceDuration = 0;
    serviceDate = new Date();

    menuId: string | null = null

    options: InvoiceLineOption[] = []
    status = "";
    discountTotal = 0;
    selectedItem: any = {};

    voidedTotal = 0;
    /**
     *  void line works by adding new line with negtive qty  (voidFrom) holds the id of line where the void line is  created from 
     */
    voidFrom: string | null;
    voidReason: string | null;
    isVoided = false; //when the lines of the invoice is voided 
    waste = false; //when product of line is waste => wont be return to inventory when voided 

    taxName = "";

    productName: string = "";

    outOfStock = false;
    itemsQtyOnStock = 0;
    priceChange = false;
    totalChange = false;

    maxQtyExceeded = false;
    maxQtyItems = 0;

    mediaUrl: string | null;

    recipe: InvoiceLineRecipe[] = [];

    isReturned = false
    returnedQty = 0
    UOM = ""
    discountType = "";/** an indecator to differenciate old invoices from new invoices after changes made in discount (before discount can be applied after tax)  */
    weight = 0;
    weightUOM = "KG";
    totalWeight = 0;
    measurements: any | null = null;
    parentUsages = 0;

    priceModel: any | null;
    accountName = ""
    maxQty = 0;
    isEditedLine = false;
    discountPerQty = false
    chargeType: string | null = ""
    chargeData: string | null = ""
    index = 0;
    constructor() {
        this.mediaUrl = null;
        this.parentId = null;
        this.salesEmployeeId = null;
        this.productId = null;
        this.discountId = null;
        this.voidFrom = null;
        this.taxId = null;
        this.employeeId = null;
        this.holdTime = null;
        this.printTime = null;
        this.readyTime = null;
        this.voidReason = null;
        this.priceModel = null;
    }


    get remainQty(): number {
        let voidedQty = 0;
        this.voidedItems.forEach(f => voidedQty = f.qty);
        return this.qty + voidedQty;
    }

    ParseJson(json: any): void {
        try {
            for (const key in json) {


                if (key == 'options') {
                    const optionsTemp: InvoiceLineOption[] = [];
                    let lineOption: InvoiceLineOption;
                    json[key].forEach((option: any) => {
                        lineOption = new InvoiceLineOption();
                        lineOption.ParseJson(option)
                        optionsTemp.push(lineOption)
                    })
                    this.options = optionsTemp;
                } else if (key == "voidedItems") {
                    const voidedTemps: InvoiceLine[] = [];
                    let invoiceLine: InvoiceLine;
                    json[key].forEach((line: any) => {
                        invoiceLine = new InvoiceLine();
                        invoiceLine.ParseJson(line);
                        voidedTemps.push(invoiceLine);
                    });
                    this.voidedItems = voidedTemps;
                } else if (key == "subItems") {
                    const subItems: InvoiceLine[] = [];
                    let invoiceLine: InvoiceLine;
                    json[key].forEach((line: any) => {
                        invoiceLine = new InvoiceLine();
                        invoiceLine.ParseJson(line);
                        subItems.push(invoiceLine);
                    });
                    this.subItems = subItems;
                }
                else if (key == "employeeId" && json[key] == "") {
                    this[key] = null;

                } else if (key == "taxes" && json[key] && JSON.stringify(json[key]) != '{}') {
                    const taxesTemp: TaxModel[] = [];
                    let taxTemp: TaxModel;
                    if (typeof json[key] == 'string') {
                        json[key] = JSON.parse(json[key])
                    }
                    json[key].forEach((line: any) => {
                        taxTemp = new TaxModel();
                        taxTemp.ParseJson(line);
                        taxesTemp.push(taxTemp);
                    });
                    this.taxes = taxesTemp;
                }
                else {
                    if (key in this) {
                        this[key as keyof typeof this] = json[key];
                    }
                }
            }
        } catch (error) {

        }

    }

    getBasePrice(total: number, taxes: TaxModel[], afterDecimal: number) {


        let taxesAmount = this.taxType == 'stacked' ? 1 : 0;

        taxes.forEach(element => {
            if (this.taxType == 'flat') {
                taxesAmount = Helper.add(taxesAmount, element.taxPercentage, afterDecimal);
            } else {
                taxesAmount = Helper.multiply(taxesAmount, Helper.division(Helper.add(element.taxPercentage, 100, afterDecimal), 100, afterDecimal), afterDecimal)
            }
        });

        if (this.taxType == 'flat') {
            let taxTotaltemp = 0;
            taxTotaltemp = Helper.division(Helper.add(100, taxesAmount, afterDecimal), 100, afterDecimal)
            total = Helper.division(total, taxTotaltemp, afterDecimal)
        } else if (this.taxType == 'stacked') {

            total = Helper.division(total, taxesAmount, afterDecimal)
        }

        console.log("BASEEEEEEEEEEEEEEEEEE", total)
        return Helper.roundDecimal(total, afterDecimal)
    }

    calculateTax(afterDecimal: number) {
        //If the tax applied is Group Tax 


        if (this.remainQty == 0) {
            this.isVoided = true;
        }
        if (this.taxes && Array.isArray(this.taxes) && this.taxes.length > 0 && this.taxType != "") {

            let total = this.total; // qty*price
            let taxTotal = 0;
            let taxTotalPercentage = 0;
            let tempstackedTotal = 0

            const taxesTemp: any = []
            if (this.isInclusiveTax) {
                total = this.getBasePrice(total, this.taxes, afterDecimal)
            }


            if (this.taxType == "flat") { // flat tax calculate both tax separately from line total 
                this.taxes.forEach((tax: any) => {
                    const taxAmount = Helper.multiply(total, Helper.division(tax.taxPercentage, 100, afterDecimal), afterDecimal)
                    taxTotalPercentage = Helper.add(taxTotalPercentage, tax.taxPercentage, afterDecimal);
                    taxTotal = Helper.add(taxTotal, taxAmount, afterDecimal);
                    tax.taxAmount = taxAmount
                    taxesTemp.push(tax)
                });
            } else if (this.taxType == "stacked") {// stacked tax both tax depened on each other 


                this.taxes.forEach((tax: any) => {
                    tax.stackedTotal = Helper.roundNum(tempstackedTotal, afterDecimal)
                    const taxAmount = Helper.multiply(total, Helper.division(tax.taxPercentage, 100, afterDecimal), afterDecimal)
                    taxTotalPercentage = Helper.add(taxTotalPercentage, tax.taxPercentage, afterDecimal);
                    taxTotal = Helper.add(taxTotal, taxAmount, afterDecimal);
                    total = Helper.add(total, taxAmount, afterDecimal);
                    tax.taxAmount = taxAmount
                    tempstackedTotal = taxAmount
                    taxesTemp.push(tax)
                });
            }
            this.taxPercentage = taxTotalPercentage;
            this.taxTotal = taxTotal;
            this.taxes = taxesTemp;
        } else if (this.taxPercentage && this.taxId) {

            this.taxTotal = this.isInclusiveTax ? Helper.division(Helper.multiply(this.total, this.taxPercentage, afterDecimal), Helper.add(100, this.taxPercentage, afterDecimal), afterDecimal) : Helper.multiply(this.total, Helper.division(this.taxPercentage, 100, afterDecimal), afterDecimal);
        }
    }



    calculateTotal(afterDecimal: number) {
        let optionTotal = 0;
        if (this.subItems.length > 0) {
            this.setPrice(afterDecimal)
        } else {
            // when there is no sub items price will be taken from line price 
            // if there is no price model or price model is fixed price without option if there is price model
            //  with option the price will be calculated based on options price
            this.price = Helper.roundDecimal(this.price, afterDecimal)
        }

        this.options.forEach(element => {
            optionTotal += Helper.multiply(this.qty, Helper.multiply(element.qty, element.price, afterDecimal), afterDecimal);
        });
        this.subTotal = Helper.add(Helper.multiply(this.qty, this.price, afterDecimal), optionTotal, afterDecimal)


        this.total = this.subTotal;
        this.discountTotal = 0;

        let discountTotal = this.discountAmount;

        if (this.discountAmount > 0) {
            if (this.discountPercentage) {
                this.discountTotal = Helper.multiply(this.total, Helper.division(this.discountAmount, 100, afterDecimal), afterDecimal)
            } else {
                if (this.discountPerQty) {
                    discountTotal = Helper.multiply(this.discountAmount, this.qty)
                }
                if (Math.abs(discountTotal) > Math.abs(this.total)) {
                    discountTotal = this.total;
                }
                this.discountTotal = discountTotal;
            }
        }
        if (this.discountTotal > 0) {
            this.total = Math.max(Helper.sub(this.total, this.discountTotal, afterDecimal), 0);
        } else if (this.discountTotal < 0 && this.qty < 0) {
            this.total = Helper.sub(this.total, this.discountTotal, afterDecimal)
        }

        if (this.taxId != null || this.taxId != "") {
            this.calculateTax(afterDecimal);
            if (!this.isInclusiveTax) //add tax to total only when tax type is exclusive 
            {
                this.total = Helper.add(this.total, this.taxTotal, afterDecimal);
            }
        } else {
            this.taxPercentage = 0;
            this.taxTotal = 0;
            this.taxes = []
        }



        if (this.salesEmployeeId != null && this.salesEmployeeId != "") {
            if (this.commissionPercentage) {
                this.commissionTotal = Helper.multiply(this.total, Helper.division(this.commissionAmount, 100, afterDecimal), afterDecimal)
            } else {
                this.commissionTotal = Helper.multiply(this.commissionAmount, this.qty, afterDecimal)
            }
        }

        this.total = Helper.roundNum(this.total, afterDecimal)
        this.setTotalWeight()
    }

    setPrice(afterDecimal: number) {
        if (this.priceModel) {
            if (this.priceModel.model) {
                let discount = this.priceModel.discount ?? 0
                switch (this.priceModel.model) {
                    case 'fixedPrice':
                        this.fixedPrice(afterDecimal)
                        break;
                    case 'fixedPriceWOption':
                        this.fixedPriceWOption(afterDecimal)
                        break;
                    case 'totalPrice':
                        this.totalPrice(afterDecimal, 0)
                        break;

                    case 'totalPriceWithDiscount':
                        this.totalPrice(afterDecimal, discount)
                        break;
                    default:
                        break;
                }
            }
        }
    }

    fixedPrice(afterDecimal: number) {
        let tempSelectedItems: InvoiceLine[] = [];
        this.subItems.forEach((element) => {
            let tempOptions: InvoiceLineOption[] = []
            element.price = 0;

            element.options.forEach((op) => {
                op.resetPrice()
                tempOptions.push(op)
            });
            element.options = tempOptions;
            tempSelectedItems.push(element)
        });
        this.price = Helper.roundNum(this.defaultPrice, afterDecimal)
        this.subItems = tempSelectedItems;
    }
    fixedPriceWOption(afterDecimal: number) {
        let tempSelectedItems: InvoiceLine[] = [];
        let total = 0
        total = this.defaultPrice
        this.subItems.forEach((element) => {
            let tempOptions: InvoiceLineOption[] = []
            element.price = 0;

            element.options.forEach((op) => {
                tempOptions.push(op)
                total += op.defaultPrice ?? 0
                op.resetPrice()
            });
            element.options = tempOptions;
            tempSelectedItems.push(element)
        });

        this.price = Helper.roundNum(total, afterDecimal)
        this.subItems = tempSelectedItems;

    }

    totalPrice(afterDecimal: number, discount: number) {

        let total = 0;
        let tempSelectedItems: InvoiceLine[] = [];
        this.subItems.forEach((element) => {
            let itemTotal = element.defaultPrice;
            let tempOptions: InvoiceLineOption[] = []


            element.options.forEach((op) => {
                tempOptions.push(op)
                itemTotal += op.defaultPrice ?? 0
                op.resetPrice()
            });

            total += itemTotal
            element.price = 0;
            element.options = tempOptions;
            tempSelectedItems.push(element)

        });
        console.log("totaaaal", total)

        this.price = Helper.sub(total, discount, afterDecimal)
        this.subItems = tempSelectedItems;

    }

    resetDiscount() {
        this.discountAmount = 0;
        this.discountTotal = 0;
        this.discountPercentage = false;
        this.discountId = null

    }

    setTotalWeight() {
        let optionsWeight = 0;
        this.totalWeight = 0;
        this.options.forEach(element => {
            if (element.weight)
                optionsWeight += Helper.multiply(element.qty, element.weight);

        });
        if (this.subItems.length > 0) {

            this.subItems.forEach(element => {
                element.setTotalWeight()
                if (!this.weightUOM) {
                    this.weightUOM = element.weightUOM
                }
                optionsWeight += Helper.multiply(element.qty, element.totalWeight);
            });
        }
        if (this.weight) {
            this.totalWeight = Helper.add(this.weight, optionsWeight)

        } else {
            this.totalWeight = Helper.add(0, optionsWeight)
        }
    }
}