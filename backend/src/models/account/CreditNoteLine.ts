import { Helper } from "@src/utilts/helper";
import { InvoiceLine, InvoiceLineRecipe, TaxModel } from "./InvoiceLine";
import { CreditNoteLineOption } from "./CreditNoteLineOptions";

export class CreditNoteLine {
    id = ""
    creditNoteId = "";

    total = 0;
    subTotal = 0;
    price = 0;
    qty = 0;


    productId: string | null;
    employeeId = "";
    createdAt = new Date();
    batch = "";
    serial = "";
    branchId = "";
    invoiceLineId = "";
    parentId: string | null;
    subItems: any = [];
    accountId = "";
    note = "";

    taxId: string | null;
    taxTotal = 0;
    taxes:TaxModel[] = []   // empty when selected tax  is not Group tax 
    taxType = "" //empty when selected tax  is not Group tax  [flat/stacked]
    taxPercentage = 0;
    isInclusiveTax = false;
    taxName="";
    discountId: string | null;
    discountAmount = 0;
    discountPercentage = false
    discountTotal = 0;

    salesEmployeeId: string | null;
    commissionPercentage = false;
    commissionAmount = 0;
    commissionTotal = 0;


    serviceDuration = 0;
    appointmentDate = new Date();
    selectedItem: any = {};

    recipe: InvoiceLineRecipe[] = []

    options: CreditNoteLineOption[] = [];
    isDeleted = false;
    maxQty=0;
    invoiceLine:InvoiceLine|null = null;
    parentUsages = 0 ;
    afterDecimal = 3
        companyId = ""
        discountPerQty= false;
            chargeType: string | null = ""
    chargeData: string | null = ""
    constructor() {
        this.parentId = null
        this.discountId = null;
        this.salesEmployeeId = null;

        this.taxId = null;
        this.productId = null
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "options") {
                const optionsTemp: CreditNoteLineOption[] = [];
                let option: CreditNoteLineOption;
                json[key].forEach((line: any) => {

                    option = new CreditNoteLineOption();
                    option.ParseJson(line);
                    optionsTemp.push(option)
                })
                this.options = optionsTemp;
            }else if(key == "subItems"){
                const subItemTemp: CreditNoteLine[] = [];
                let subItem: CreditNoteLine;
                json[key].forEach((line: any) => {

                    subItem = new CreditNoteLine();
                    subItem.ParseJson(line);
                    subItemTemp.push(subItem)
                })
                this.subItems = subItemTemp;
            }else if (key == "taxes" && json[key] && JSON.stringify(json[key]) !='{}') {
                const taxesTemp: TaxModel[] = [];
                let taxTemp: TaxModel;
                if(typeof json[key] == 'string')
                    {
                        json[key] = JSON.parse(json[key])
                    }
                if(typeof json[key] == 'string')
                    {
                        json[key] = JSON.parse(json[key])
                    }
                json[key].forEach((line: any) => {
                    taxTemp = new TaxModel();
                    taxTemp.ParseJson(line);
                    taxesTemp.push(taxTemp);
                });
                this.taxes = taxesTemp;
            }
            else if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }



    // calculateTax(afterDecimal: number) {
    //     //If the tax applied is Group Tax 
    //     this.taxTotal=0;
    //     if ( Array.isArray(this.taxes)&&this.taxes.length > 0 ) {
    //         let total = this.total;
    //         let taxTotal = 0;
    //         let taxTotalPercentage = 0;
    //         const taxesTemp: any = []

    //         if (this.taxType == "flat") { // flat tax calculate both tax separately from line total 
    //             this.taxes.forEach((tax: any) => {
    //                 const taxAmount = this.isInclusiveTax == true ? Helper.division((this.total * tax.taxPercentage), (100 + tax.taxPercentage), afterDecimal) : (this.total * (tax.taxPercentage / 100))
    //                 taxTotalPercentage += tax.taxPercentage;
    //                 taxTotal += taxAmount;
    //                 tax.totalAmount = taxAmount
    //                 taxesTemp.push(tax)
    //             });
    //         } else if (this.taxType == "stacked") {// stacked tax both tax depened on each other 
    //             this.taxes.forEach((tax: any) => {
    //                 const taxAmount = this.isInclusiveTax == true ? Helper.division((total * tax.taxPercentage), (100 + tax.taxPercentage), afterDecimal) : (total * (tax.taxPercentage / 100))
    //                 taxTotalPercentage += tax.amount;
    //                 taxTotal += taxAmount
    //                 total += taxAmount;
    //                 tax.totalAmount = taxAmount
    //                 taxesTemp.push(tax)
    //             });
    //         }
    //         this.taxPercentage = taxTotalPercentage;
    //         this.taxTotal = taxTotal;
    //         this.taxes = taxesTemp;
    //     } else {
    //         this.taxTotal = this.isInclusiveTax == true ? Helper.division((this.total * this.taxPercentage), (100 + this.taxPercentage), afterDecimal) : (this.total * (this.taxPercentage / 100))

    //     }
    // }


    getBasePrice(total: number, taxes:TaxModel[], afterDecimal: number) {

      
        let taxesAmount = this.taxType == 'stacked' ? 1 : 0 ;
      
        taxes.forEach(element => {
            if (this.taxType == 'flat') {
                taxesAmount = Helper.add(taxesAmount, element.taxPercentage, afterDecimal);
            } else {
                taxesAmount = Helper.multiply(taxesAmount, Helper.division(Helper.add(element.taxPercentage , 100,afterDecimal),100,afterDecimal), afterDecimal)
            }
        });

        if (this.taxType == 'flat') {
            let taxTotaltemp = 0;
            taxTotaltemp = Helper.division(Helper.add(100, taxesAmount, afterDecimal), 100, afterDecimal)
            total = Helper.division(total, taxTotaltemp, afterDecimal)
        } else if (this.taxType == 'stacked') {
    
            total = Helper.division(total, taxesAmount, afterDecimal)
        }

        console.log(total)
        return Helper.roundDecimal(total,afterDecimal)
    }

    calculateTax(line: any, afterDecimal: number) {
        //If the tax applied is Group Tax 
        this.taxTotal = 0;




        if (Array.isArray(this.taxes) && this.taxes.length > 0) {
            let total = this.total;
            let taxTotal = 0;
            let taxTotalPercentage = 0;
            const taxesTemp: any = []
            if(this.isInclusiveTax)
                {
                   total = this.getBasePrice(total,this.taxes,afterDecimal)
                }
            if (this.taxType == "flat") { // flat tax calculate both tax separately from line total 
                this.taxes.forEach((tax: any) => {

                    let taxAmount = Helper.multiply(total, Helper.division(tax.taxPercentage , 100,afterDecimal), afterDecimal)
                    let totalOfCreditNoteTaxes = 0
                    let totalInvoiceLineTaxes = 0
                    if (line.creditNoteQty > 0) {
                        if ((this.qty + line.creditNoteQty == line.qty)) {
                            for (let index = 0; index < line.creditNoteTaxes.length; index++) {
                                const element = line.creditNoteTaxes[index];
                                if (element != null) {
                                    let selectedTax = element.find((f: any) => f.taxId == tax.taxId)
                                    totalOfCreditNoteTaxes = Helper.add(totalOfCreditNoteTaxes,selectedTax.taxAmount,afterDecimal)
                                }

                            }
                            let selectedInvoiceTax = line.invoiceLineTaxes.find((f: any) => f.taxId == tax.taxId)
                            if (selectedInvoiceTax != null) {
                                totalInvoiceLineTaxes += Helper.add(totalInvoiceLineTaxes,selectedInvoiceTax.taxAmount,afterDecimal)
                            }
                            if (taxAmount + totalOfCreditNoteTaxes != totalInvoiceLineTaxes) {
                                taxAmount = Helper.sub(totalInvoiceLineTaxes, totalOfCreditNoteTaxes, afterDecimal)

                            }
                        }
                    }
                    taxTotalPercentage = Helper.add(taxTotalPercentage,tax.taxPercentage,afterDecimal);
                    taxTotal = Helper.add(taxTotal,taxAmount,afterDecimal);
                    tax.taxAmount = taxAmount
                    console.log(tax)
                    taxesTemp.push(tax)
                });
            } else if (this.taxType == "stacked") {// stacked tax both tax depened on each other 
                console.log("taxesssssssssssssssssssssssssssss",this.taxes);
                this.taxes.forEach((tax: any) => {

                    let taxAmount =  Helper.multiply(total, Helper.division(tax.taxPercentage , 100,afterDecimal), afterDecimal)
                    let totalOfCreditNoteTaxes = 0
                    let totalInvoiceLineTaxes = 0
                    if (line.creditNoteQty > 0) {
                        if ((this.qty + line.creditNoteQty == line.qty)) {
                            for (let index = 0; index < line.creditNoteTaxes.length; index++) {
                                const element = line.creditNoteTaxes[index];
                                if (element != null) {
                                    let selectedTax = element.find((f: any) => f.taxId == tax.taxId)
                                    totalOfCreditNoteTaxes = Helper.add(totalOfCreditNoteTaxes,selectedTax.taxAmount,afterDecimal)
                                }

                            }
                            let selectedInvoiceTax = line.invoiceLineTaxes.find((f: any) => f.taxId == tax.taxId)
                            if (selectedInvoiceTax != null) {
                                totalInvoiceLineTaxes = Helper.add( totalInvoiceLineTaxes,selectedInvoiceTax.taxAmount,afterDecimal)
                            }
                            if (taxAmount + totalOfCreditNoteTaxes != totalInvoiceLineTaxes) {
                                taxAmount = Helper.sub(totalInvoiceLineTaxes, totalOfCreditNoteTaxes, afterDecimal)

                            }
                        }
                    }

                    taxTotalPercentage = Helper.add( taxTotalPercentage ,tax.taxAmount,afterDecimal);
                    taxTotal = Helper.add(taxTotal,taxAmount,afterDecimal)
                    total = Helper.add(total,taxAmount,afterDecimal);
                    tax.taxAmount = taxAmount
                    console.log(tax)
                    taxesTemp.push(tax)
                });
            }
            this.taxPercentage = taxTotalPercentage;
            this.taxTotal = taxTotal;
            console.log("taxtTTTTTT",     this.taxTotal )
            this.taxes = taxesTemp;
        } else {
            this.taxTotal = this.isInclusiveTax == true ? Helper.division(Helper.multiply(this.total ,this.taxPercentage,afterDecimal), Helper.add(100 , this.taxPercentage,afterDecimal), afterDecimal) : Helper.multiply(this.total, Helper.division(this.taxPercentage ,100,afterDecimal), afterDecimal)
            if (line.creditNoteQty > 0 && (this.qty + line.creditNoteQty == line.qty) && this.taxTotal + line.creditNoteTaxTotal != line.taxTotal) {
                this.taxTotal = Helper.sub(line.taxTotal , line.creditNoteTaxTotal,afterDecimal)
            }
        }



    }


    optioTotal(afterDecimal: number) {
        let total = 0

        this.options.forEach(option => {
            total +=Helper.multiply(this.qty, Helper.multiply(option.qty, option.price, afterDecimal),afterDecimal);
        });
        return total;
    }



    calculateLineDiscountAmount(line: any) {
        const invoiceQty = line.qty;
        const creditNoteExistingQty = line.creditNoteQty;
        const rounding = 0.001;
        const totalDiscount =  line.discountPercentage ? line.discountAmount : line.discountPerQty ? line.discountAmount  * line.qty : line.discountAmount;
        const discount = Helper.division(totalDiscount , invoiceQty,this.afterDecimal) // divide total discount by qty 
        const roundedDiscount = Helper.multiply(Math.round(Helper.division(discount , rounding,this.afterDecimal)) , rounding,this.afterDecimal); // round
        this.discountTotal = 0;
        if (this.qty == invoiceQty) { // if line is fully credit note  // return total discount amount 
            this.discountTotal = totalDiscount
        }
        else if ((this.qty + creditNoteExistingQty) == invoiceQty) { // last credit note of line
            // this.discountTotal += roundedDiscount * (this.qty );
            this.discountTotal = Helper.add(  this.discountTotal ,Helper.sub(totalDiscount , Helper.multiply(roundedDiscount , (creditNoteExistingQty),this.afterDecimal),this.afterDecimal),this.afterDecimal) /** remaining of invoice total discount  */

        } else {
            this.discountTotal = Helper.add(this.discountTotal,Helper.multiply(roundedDiscount , (this.qty),this.afterDecimal),this.afterDecimal);/**when partially credit note */
        }
        this.discountAmount = this.discountTotal;
    }

    async calculateTotal(line: any, afterDecimal: number) {
        this.afterDecimal = afterDecimal
        this.price = Helper.roundNum(this.price, afterDecimal)
        this.subTotal = Helper.add((this.qty * this.price), this.optioTotal(afterDecimal), afterDecimal)
        this.total = this.subTotal;

        this.discountTotal = 0;
        this.discountPerQty = line.discountPerQty;
        //divid invoice line discount on creditNote line qty
        if (line.discountAmount > 0) {
            if (this.discountPercentage) {
                this.discountTotal = Helper.multiply(this.total ,Helper.division(line.discountAmount , 100,afterDecimal),afterDecimal) // if percentage 
            } else { // if cash 
                this.discountTotal = this.discountAmount;
                // const discount = line.discountAmount / invoiceQty // divide total discount by qty 
                // const roundedDiscount = Math.round(discount / rounding) * rounding; // round

                // if (this.qty == invoiceQty) { // if line is fully credit note  // return total discount amount 
                //     this.discountTotal = line.discountAmount
                // }
                // else if ((this.qty + creditNoteExistingQty) == invoiceQty) { // last credit note of line
                //     // this.discountTotal += roundedDiscount * (this.qty );
                //     this.discountTotal += line.discountAmount - (roundedDiscount * (creditNoteExistingQty)) /** remaining of invoice total discount  */

                // } else {
                //     this.discountTotal += roundedDiscount * (this.qty);/**when partially credit note */
                // }
                // this.discountAmount = this.discountTotal;
            }
            this.total = Helper.sub(this.total , this.discountTotal , afterDecimal) ;
        }

        if (this.taxId != null && this.taxId != "") {
            this.calculateTax(line, afterDecimal);

            if (!this.isInclusiveTax) {
                this.total =Helper.add(this.total , this.taxTotal , afterDecimal);
            }
        } else {
            this.taxPercentage = 0;
            this.taxTotal = 0;
            this.taxes = [];
        }
    }

    public calculateCommission(afterDecimal: number) {
        if (this.salesEmployeeId != null && this.salesEmployeeId != "") {
            if (this.commissionPercentage) {
                this.commissionTotal = Helper.multiply(this.total, Helper.division(this.commissionAmount ,100,afterDecimal), afterDecimal)
            } else {
                this.commissionAmount = Helper.multiply(this.commissionTotal, this.qty, afterDecimal)

            }
        }
    }
}