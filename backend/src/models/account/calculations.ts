import { Helper } from "@src/utilts/helper";
import { after } from "lodash";

// ####################### tax Calculator #######################
class Tax {
    taxRate = 0;
    taxType = ""      //empty when its not tax Group 
    taxes:TaxModel[] = []; //empty when its not tax Group
} 

class TaxModel {
    name = ""
    index = ""
    taxId = ""
    taxPercentage = 0
    taxAmount = 0
    stackedTotal?=0
 
    ParseJson(json: any): void {

        for (const key in json) {

            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}

interface CalculatedTaxes {
    //Represents the results of a detailed tax calculation for a line item.
    baseAmount: number; /** The calculated net amount after accounting for inclusive taxes. */
    taxTotal: number;  /** The total calculated tax amount for the line item. */
    taxPercentage: number;  /** The sum of all tax percentages (for flat tax) or a conceptual sum (for stacked tax). */
    taxes: TaxModel[] |[]; /** The array of `TaxModel` objects, with `taxAmount` populated for each individual tax. */
}
 
// --- Inclusive price calculators ---

const getBasePriceFromGrossForFlatTaxes = (gross: number, taxes: TaxModel[], afterDecimal: number): number => {
   
    /**
     * Calculates the base (net) price from a given gross amount when taxes are flat and inclusive.
     * Formula: `net = gross / (1 + sum_of_percentages / 100)`
     *
     * @param gross The total amount including flat taxes.
     * @param taxes An array of `TaxModel` objects representing flat taxes.
     * @param afterDecimal The number of decimal places for calculations.
     * @returns The calculated base (net) price.
     * 
     */
  
  let totalPercent = 0;
  taxes.forEach(t => {
    totalPercent = Helper.add(totalPercent, t.taxPercentage, afterDecimal);
  });
  const factor = Helper.division(Helper.add(100, totalPercent, afterDecimal), 100, afterDecimal);
  const base = Helper.division(gross, factor, afterDecimal);
  return Helper.roundNum(base, afterDecimal);

};

const getBasePriceFromGrossForStackedTaxes = ( gross: number, taxes: TaxModel[], afterDecimal: number): number => {
    /**
     * Calculates the base (net) price from a given gross amount when taxes are stacked and inclusive.
     * Formula: `net = gross / ((1 + tax1/100) * (1 + tax2/100) * ...)`
     *
     * @param gross The total amount including stacked taxes.
     * @param taxes An array of `TaxModel` objects representing stacked taxes.
     * @param afterDecimal The number of decimal places for calculations.
     * @returns The calculated base (net) price.
    */

  let multiplier = 1;
  taxes.forEach(t => {
    const rate = Helper.division(Helper.add(t.taxPercentage, 100, afterDecimal), 100, afterDecimal);
    multiplier = Helper.multiply(multiplier, rate, afterDecimal);
  });
  const base = Helper.division(gross, multiplier, afterDecimal);
  return Helper.roundNum(base, afterDecimal);

};

// --- Tax Calculators ---

const calculateFlatTax = ( base: number, taxes: TaxModel[], afterDecimal: number) => {

  let taxTotal = 0;
  let taxPercentage = 0;
  const result: TaxModel[] = [];

  taxes.forEach(t => {
    const amount = Helper.multiply(base, Helper.division(t.taxPercentage, 100, afterDecimal), afterDecimal);
    t.taxAmount = amount;
    taxTotal = Helper.add(taxTotal, amount, afterDecimal);
    taxPercentage = Helper.add(taxPercentage, t.taxPercentage, afterDecimal);
    result.push(t);
  });

  return { taxTotal, taxPercentage, taxes: result };

};

const calculateStackedTax = ( base: number, taxes: TaxModel[], afterDecimal: number) => {
  let taxTotal = 0;
  let subtotal = base;
  let multiplier = 1;
  const result: TaxModel[] = [];

  taxes.forEach(t => {
    t.stackedTotal = Helper.roundNum(taxTotal, afterDecimal);
    const amount = Helper.multiply(subtotal, Helper.division(t.taxPercentage, 100, afterDecimal), afterDecimal);
    t.taxAmount = amount;
    subtotal = Helper.add(subtotal, amount, afterDecimal);
    taxTotal = Helper.add(taxTotal, amount, afterDecimal);
    multiplier = Helper.multiply(multiplier, 1 + Helper.division(t.taxPercentage, 100, afterDecimal), afterDecimal);
    result.push(t);
  });

  const taxPercentage = Helper.multiply(Helper.sub(multiplier, 1, afterDecimal), 100, afterDecimal);
  return { taxTotal, taxPercentage, taxes: result };
};

const calculateSingleTax = ( amount: number, taxRate: number, isInclusive: boolean, afterDecimal: number) => {

  let base = amount;
  let taxTotal = 0;

  if (isInclusive) {
    taxTotal = Helper.division( Helper.multiply(amount, taxRate, afterDecimal),  Helper.add(100, taxRate, afterDecimal), afterDecimal);
    base     = Helper.division( amount, 1 + Helper.division(taxRate, 100, afterDecimal), afterDecimal);
  } else {
    taxTotal = Helper.multiply(amount, Helper.division(taxRate, 100, afterDecimal), afterDecimal);
  }

  return { base, taxTotal };

};

// --- Main Dispatcher ---

export const calculateTax = ( amount: number, tax: Tax, isInclusive: boolean, afterDecimal: number): CalculatedTaxes => {

  let base = amount;
  let taxTotal = 0;
  let taxPercentage = 0;
  let resultTaxes: TaxModel[] = [];

  const isGroupTax = tax.taxes?.length && tax.taxType;

  if (isGroupTax) {
    base = isInclusive
      ? tax.taxType === 'flat'
        ? getBasePriceFromGrossForFlatTaxes(amount, tax.taxes, afterDecimal)
        : getBasePriceFromGrossForStackedTaxes(amount, tax.taxes, afterDecimal)
      : amount;

    const result =
      tax.taxType === 'flat'
        ? calculateFlatTax(base, tax.taxes, afterDecimal)
        : calculateStackedTax(base, tax.taxes, afterDecimal);

    taxTotal = result.taxTotal;
    taxPercentage = result.taxPercentage;
    resultTaxes = result.taxes;
  } else {
    const result = calculateSingleTax(amount, tax.taxRate, isInclusive, afterDecimal);
    base = result.base;
    taxTotal = result.taxTotal;
    taxPercentage = tax.taxRate;
  }

  return {
    baseAmount: Helper.roundNum(base, afterDecimal),
    taxTotal: Helper.roundNum(taxTotal, afterDecimal),
    taxPercentage: Helper.roundNum(taxPercentage, afterDecimal),
    taxes: resultTaxes
  };

};


// ####################### discount Calculator #######################

// --- Main Dispatcher ---
export const  getDiscountAmount =(base: number, amount: number, type: 'rate' | 'amount',taxPercentage:number|null = null ,isInclusiveTax:boolean|null = null ,discountIncludesTax:boolean|null = null ,tax:Tax|null=null,isInclusive:boolean|null=null,afterDecimal:number|null = null): {discount:number,isInclusiveDiscount:number,discountTax:number} => {
/**
 * Calculates the effective discount amount based on a base value, rate, or fixed amount.
 * Ensures that the calculated discount does not exceed the base amount.
 *
 * @param base The monetary amount on which the discount is to be applied.
 * @param rate The percentage discount rate (e.g., 10 for 10%).
 * @param amount The fixed monetary discount amount.
 * @param type Specifies whether the discount is a 'rate' (percentage) or an 'amount' (fixed value).
 * If `rate` is greater than 0, 'rate' type is implicitly prioritized.
 * @returns The calculated effective discount amount.
*/
     let discount = 0;
     let isInclusiveDiscount = 0 
     if (type === 'rate') {
      discount = base * (amount / 100);
      } else { // type === 'amount'
     discount = amount;
     }
     discount = Math.min(discount, base); // Ensure discount does not exceed base amount
     let discountTax = 0 
     if(taxPercentage)
     {
        if(isInclusiveTax)
          {
            if( discountIncludesTax && tax && afterDecimal)
              {
                let  originalTaxes = calculateTax(discount, tax, isInclusiveTax, afterDecimal);
                 discountTax= originalTaxes.taxTotal
                isInclusiveDiscount = discount  - discountTax
              }
          }
     }
     
    
         // Ensure discount never exceeds the base amount
  return {discount:discount,isInclusiveDiscount:isInclusiveDiscount, discountTax: discountTax}
};


// ######################## Line Calculator ########################

export interface LineItem {
    // Represents a single line item in a transaction.

    /** Unique identifier for the line item. */
    id: string;
    /** A descriptive name for the product or service. */
    description: string;
    /** The base monetary amount of the line item before any discounts or taxes. */
    amount: number;
    /** The percentage discount rate applied specifically to this line item (e.g., 10 for 10%). */
    discountPercentage: boolean;
    /** A fixed monetary discount amount applied specifically to this line item. */
    discountAmount: number;
    /** The percentage tax rate applicable to this line item if no complex `taxes` array is used. */
    taxId?: string;
    taxPercentage?: number;
    transactionDiscount :number;
    /** An optional array of `TaxModel` objects if multiple taxes are applied to this line item. */
    taxes?: TaxModel[];
    /** Specifies how taxes in the `taxes` array are applied: 'flat' (summed) or 'stacked' (compounded). Can be empty if `taxes` array is not used. */
    taxType?: string|'flat' | 'stacked' | '';
    discountIncludesTax: boolean;
    supplierCreditDiscount?: number;
    discountTotal?: number;
}


// used for supplier credit
export const calculateCreditLineDiscountAmount = (refrenceLine: any, qty:number, afterDecimal:number )=> {
        let discountAmount = refrenceLine.DiscountAmount
        let supplierCreditDiscount = 0
        if ( refrenceLine.discountPercentage === false ){
                  const discount = Helper.division(refrenceLine.discountAmount , refrenceLine.qty,afterDecimal) // divide total discount by qty 
                  discountAmount = Helper.multiply(discount , qty ,afterDecimal)

        }
        if(refrenceLine.billDiscount && refrenceLine.billDiscount != 0){
           const discount = Helper.division(refrenceLine.billDiscount , refrenceLine.qty, afterDecimal) // divide total discount by qty 
           supplierCreditDiscount = Helper.multiply(discount , qty ,afterDecimal)
        }
        return {discountAmount:discountAmount, supplierCreditDiscount:supplierCreditDiscount}
}

// --- Main Dispatcher ---
export const calculateLine = (item: LineItem, isInclusiveTax: boolean, applyDiscountBeforeTax: boolean = true, afterDecimal: number) => {
  /**
   * Processes a single line item:
   * - Applies discounts (before or after tax)
   * - Computes tax totals
   * - Returns a fully calculated line detail
   */

  let total = item.amount 
  let baseAmount = item.amount
  let taxTotal = 0
  let discountTotal = 0
  let totalTaxPercentage = 0;
  let taxes: TaxModel[] = [];
  let originalTaxes: CalculatedTaxes | null = null;
  let taxableAmount = total
  const hasTax = !!item.taxId;
  const hasDiscount = item.discountAmount > 0;

  // ---------- Step 1: Initial Tax Calculation ----------
  if (hasTax) {
    const tax = {
      taxRate: item.taxPercentage ?? 0,
      taxes: item.taxes ?? [],
      taxType: item.taxType ?? ''
    };

    originalTaxes = calculateTax(total, tax, isInclusiveTax, afterDecimal);
    taxTotal = originalTaxes.taxTotal;
    taxes = originalTaxes.taxes;
    totalTaxPercentage = originalTaxes.taxPercentage;

    baseAmount = isInclusiveTax ? baseAmount - taxTotal : baseAmount 
    total      = isInclusiveTax ? total      : total      + taxTotal

  }

  // ---------- Step 2: Discount Application ----------
  //    - applyDiscountAfterTax:   total = price(incTax) - discount
  //    - applyDiscountBeforeTax:  total = basePrice - discount + recalclatedTax( basePrice - discount )
  
  
    if (hasDiscount) {

        const discountType = item.discountPercentage === false ? 'amount' : 'rate';
        
        // if (applyDiscountBeforeTax) {
          const tax = {
              taxRate: item.taxPercentage ?? 0,
              taxes: item.taxes ?? [],
              taxType: item.taxType ?? ''
            };

            const baseForDiscount = baseAmount;
            const discountTemp = getDiscountAmount(baseForDiscount, item.discountAmount, discountType, totalTaxPercentage, isInclusiveTax, item.discountIncludesTax,tax,isInclusiveTax,afterDecimal)  
            discountTotal = isInclusiveTax && item.discountIncludesTax ? discountTemp.isInclusiveDiscount : discountTemp.discount
            baseAmount = isInclusiveTax && item.discountIncludesTax ? baseAmount + discountTemp.discountTax  : baseAmount
            total = Helper.sub(baseForDiscount, discountTotal, afterDecimal);
            // Recalculate tax after discount
     
            if (hasTax) {


                const tax = {
                    taxRate: item.taxPercentage ?? 0,
                    taxes: item.taxes ?? [],
                    taxType: item.taxType ?? ''
                };
                originalTaxes = calculateTax(total, tax, false, afterDecimal);
                taxTotal = originalTaxes.taxTotal;
                taxes = originalTaxes.taxes;
                totalTaxPercentage = originalTaxes.taxPercentage;

            }
            taxableAmount = total
            total = Helper.add(total, taxTotal, afterDecimal);
            discountTotal = isInclusiveTax && item.discountIncludesTax ? discountTemp.discount : discountTotal
            
        // } else {
        //     const baseForDiscount = total;
        //     discountTotal = getDiscountAmount(baseForDiscount, item.discountAmount, discountType)
        //     total = Helper.sub(baseForDiscount, discountTotal, afterDecimal);
        // }
    }

  // ---------- Step 3: Return Complete Line Summary ----------
  return {
    ...item,
    basePrice: Helper.roundNum(baseAmount, afterDecimal),
    discount: Helper.roundNum(discountTotal, afterDecimal),
    taxTotal: Helper.roundNum(taxTotal, afterDecimal),
    totalTaxPercentage,
    taxes,
    total: Helper.roundNum(total, afterDecimal),
    taxableAmount:taxableAmount
  };
}



// ######################## Bill Calculator ########################
interface CalculationResults {
    /** The final grand total monetary amount of the entire transaction. */
    total: number;
    /** The sum of all tax amounts across all line items in the transaction. */
    tax: number;
    /** The sum of all discounts applied (line-level and transaction-level) across the entire transaction. */
    discount: number;
    /** The sum of net values from all line items after all applicable discounts, before their respective taxes. This represents the core value of goods/services. */
    subtotal: number;
    /** An array containing the detailed financial breakdown for each individual line item. */
    transactionDiscount: number;
    lines : any[]
}

export const calculateBill = (lineItems: LineItem[],isInclusiveTax: boolean,transactionDiscountAmount: number,discountPercentage: boolean,applyDiscountBeforeTax: boolean, afterDecimal: number): CalculationResults =>{
    
    // ---------- Step 1:   line Calculation before Bill Discount ----------
    // Calculate each line's initial tax, discount, and totals 
    let LinesTotal = 0;           // Sum of line totals (gross or net+tax)
    let LinesTaxTotal = 0;        // Sum of taxes from all lines
    let LinesDiscountTotal = 0;   // Sum of line-level discounts
    let linesBaseAmountTotal = 0; // Sum of net amounts before tax & after line discount

    const intermediateLineDetails = lineItems.map(item => {
      const processedLine = calculateLine(item, isInclusiveTax, applyDiscountBeforeTax, afterDecimal);

      LinesTotal = Helper.add(LinesTotal, processedLine.total, afterDecimal);
      LinesTaxTotal = Helper.add(LinesTaxTotal, processedLine.taxTotal, afterDecimal);
      LinesDiscountTotal = Helper.add(LinesDiscountTotal, processedLine.discount, afterDecimal);
      linesBaseAmountTotal = Helper.add(linesBaseAmountTotal, processedLine.basePrice, afterDecimal);

      return processedLine;
    });


    // ---------- Step 2:  Bill Discount Application ----------

    // *** transaction variables ***
    let transactionTotal = LinesTotal
    let transactionTaxTotal = LinesTaxTotal
    let transactionDiscount = 0
    let transactionSubTotal = applyDiscountBeforeTax ? Helper.sub(LinesTotal, LinesTaxTotal, afterDecimal) : LinesTotal

    const hasBillDiscount = transactionDiscountAmount > 0 

    if (hasBillDiscount) {
        
        let newTaxTotal = 0
        const discountType = discountPercentage === false ? 'amount' : 'rate'

        const transactionBaseBeforeBillDisc = applyDiscountBeforeTax ? Helper.sub(LinesTotal, LinesTaxTotal, afterDecimal) : LinesTotal;
        const effectiveBillDiscount = getDiscountAmount(transactionBaseBeforeBillDisc, transactionDiscountAmount, discountType)
        
        transactionDiscount = effectiveBillDiscount.discount
        transactionTotal = Helper.sub(transactionBaseBeforeBillDisc, transactionDiscount, afterDecimal)


        for (let item of intermediateLineDetails) {

            if (applyDiscountBeforeTax) {

                const lineBaseBeforeBillDisc = Helper.sub(item.total, item.taxTotal, afterDecimal);

                if (transactionBaseBeforeBillDisc > 0) {
                    const proportion = Helper.division(lineBaseBeforeBillDisc, transactionBaseBeforeBillDisc, afterDecimal + 4);
                    item.transactionDiscount = Helper.multiply(effectiveBillDiscount.discount, proportion, afterDecimal);
                }

                //lineTotalAftertransactionDiscount to get tax Total (not save)
                const newEffectiveLineNet = Helper.roundNum(Helper.sub(lineBaseBeforeBillDisc, item.transactionDiscount, afterDecimal), afterDecimal);
                const tax: Tax = { taxRate: item.taxPercentage ?? 0, taxes: item.taxes ?? [], taxType: item.taxType ?? '' }

                // Recalculate tax after transaction Discount
                const recalculatedLineTaxes = calculateTax(newEffectiveLineNet, tax, false, afterDecimal);
                const newEffectiveLineTax = recalculatedLineTaxes.taxTotal;
                item.taxes = recalculatedLineTaxes.taxes
                item.taxPercentage = recalculatedLineTaxes.taxPercentage
                item.taxTotal = Helper.roundNum(newEffectiveLineTax, afterDecimal);
                item.taxableAmount = newEffectiveLineNet
                newTaxTotal = Helper.add(newTaxTotal, item.taxTotal, afterDecimal)



            } else {
                // --- get transaction discount amount on line ---
                if (transactionBaseBeforeBillDisc > 0) {
                    const proportion = Helper.division(item.total, transactionBaseBeforeBillDisc, afterDecimal + 4);
                    item.transactionDiscount = Helper.multiply(effectiveBillDiscount.discount, proportion, afterDecimal);
                }
            }
        }

        LinesTaxTotal = (newTaxTotal != 0) ? newTaxTotal : LinesTaxTotal
        transactionTotal = applyDiscountBeforeTax ? Helper.add(transactionTotal, LinesTaxTotal, afterDecimal) : transactionTotal

    }

    lineItems = intermediateLineDetails


 

    // Compose final result summary
    return {
      total: transactionTotal,
      tax: LinesTaxTotal,
      discount: Helper.add(transactionDiscount, 0, afterDecimal),
      transactionDiscount:transactionDiscount,
      subtotal: transactionSubTotal,
      lines : lineItems
    };
  }



export const allocatePartialReturn = (
  totalValue: number,          // e.g. 0.07
  totalQty: number,            // e.g. 12
  alreadyReturnedQty: number,  // e.g. 0
  currentReturnedQty: number,  // e.g. 6
   alreadyReturnedTotal: number, 
  afterDecimal: number        // e.g. 3
) => {
  if (totalQty === 0 || currentReturnedQty === 0) return 0;

  // 1️⃣ Compute per-unit value, rounded
  const perUnit = Helper.roundDecimal(
    Helper.division(totalValue, totalQty, afterDecimal),
    afterDecimal
  );

  // 2️⃣ Create array of per-unit values
  const arr = Array(totalQty).fill(perUnit);

  // 3️⃣ Adjust last unit to ensure total sums exactly to totalValue
  const totalArr = arr.reduce((a, b) => Helper.add(a, b, afterDecimal), 0);
  const diff = Helper.sub(totalValue, totalArr, afterDecimal);
  arr[totalQty - 1] = Helper.add(arr[totalQty - 1], diff, afterDecimal);

  // 4️⃣ Slice for current returned quantity
  const start = alreadyReturnedQty;
  const end = alreadyReturnedQty + currentReturnedQty;
  const slice = arr.slice(start, end);

  // 5️⃣ Adjust last element of slice to absorb rounding difference
   const sliceTotal = slice.reduce((a, b) => Helper.add(a, b, afterDecimal), 0);
   const expected = Helper.multiply(totalValue, Helper.division(currentReturnedQty, totalQty, afterDecimal), afterDecimal);
   const sliceDiff = Helper.sub(expected, sliceTotal, afterDecimal);
   slice[slice.length - 1] = Helper.add(slice[slice.length - 1], sliceDiff, afterDecimal);
   alreadyReturnedTotal = alreadyReturnedTotal?? 0 
  // 6️⃣ Return sum of the slice
  let returnedDiscount =  Helper.roundDecimal(slice.reduce((a, b) => Helper.add(a, b, afterDecimal), 0),afterDecimal);
  if((alreadyReturnedQty + currentReturnedQty) == totalQty && (alreadyReturnedTotal + returnedDiscount) != totalValue )
  {
    let difference = Helper.sub(totalValue,Helper.add(alreadyReturnedTotal,returnedDiscount ),afterDecimal)
    let lastDiscount =  Helper.sub(totalValue,alreadyReturnedTotal ,afterDecimal)
    if(0.001>=Math.abs(difference))
    {
        returnedDiscount = lastDiscount
    }
  }
   return returnedDiscount 
};




export const calculateCreditNoteLine = (item: LineItem, isInclusiveTax: boolean, applyDiscountBeforeTax: boolean = true, afterDecimal: number) => {
  /**
   * Processes a single line item:
   * - Applies discounts (before or after tax)
   * - Computes tax totals
   * - Returns a fully calculated line detail
   */

  let total = item.amount 
  let baseAmount = item.amount
  let taxTotal = 0
  let discountTotal = item.discountTotal ?? 0 
  let totalTaxPercentage = 0;
  let taxes: TaxModel[] = [];
  let originalTaxes: CalculatedTaxes | null = null;
  let taxableAmount = total
  const hasTax = !!item.taxId;
  const hasDiscount = item.discountAmount > 0;

  // ---------- Step 1: Initial Tax Calculation ----------
      if (hasTax) {
        const tax = {
          taxRate: item.taxPercentage ?? 0,
          taxes: item.taxes ?? [],
          taxType: item.taxType ?? ''
        };

        originalTaxes = calculateTax(total, tax, isInclusiveTax, afterDecimal);
        taxTotal = originalTaxes.taxTotal;
        taxes = originalTaxes.taxes;
        totalTaxPercentage = originalTaxes.taxPercentage;

        baseAmount = isInclusiveTax ? baseAmount - taxTotal : baseAmount 
        total = 0

      }
    const tax = {
              taxRate: item.taxPercentage ?? 0,
              taxes: item.taxes ?? [],                    
              taxType: item.taxType ?? ''
            };
                  let discountTax = 0 
          if(hasDiscount && item.discountTotal) {
        
              if(isInclusiveTax && item.discountIncludesTax){{
                    originalTaxes = calculateTax(item.discountAmount, tax, isInclusiveTax, afterDecimal);
                    discountTax = originalTaxes.taxTotal;
              }
              discountTotal = item.discountTotal - discountTax;
              
          }
}
      total = Helper.sub(baseAmount,discountTotal,afterDecimal);
      baseAmount = isInclusiveTax && item.discountIncludesTax ? baseAmount + discountTax  : baseAmount
      isInclusiveTax = false;
      taxableAmount = total
      originalTaxes = calculateTax(total, tax, isInclusiveTax, afterDecimal);
      totalTaxPercentage = originalTaxes.taxPercentage;
      taxTotal = originalTaxes.taxTotal;
      taxes = originalTaxes.taxes;
      total = Helper.add(total, taxTotal, afterDecimal);
  // ---------- Step 3: Return Complete Line Summary ----------
  return {
    ...item,
    basePrice: Helper.roundNum(baseAmount, afterDecimal),
    discount: item.discountTotal ? Helper.roundNum(item.discountTotal, afterDecimal):0,
    taxTotal: Helper.roundNum(taxTotal, afterDecimal),
    totalTaxPercentage,
    taxes,
    total: Helper.roundNum(total, afterDecimal),
    taxableAmount:taxableAmount
  };


}
  


export const calculateCredit = (lineItems: any [], afterDecimal: number): CalculationResults =>{
    
   let transactionTotal = 0; 
   let discountTotal = 0;
   let applyDiscountBeforeTax = false;
  let transactionSubTotal = 0;
  let LinesTaxTotal =0 ;
    lineItems.forEach(element => {
      if(element.supplierCreditDiscount && element.supplierCreditDiscount > 0)
        {
          if(element.applyDiscountBeforeTax)
          {
            applyDiscountBeforeTax = true
            let basePrice = Helper.sub(element.total, element.taxTotal, afterDecimal)
            let newBasePrice = Helper.sub(basePrice, element.supplierCreditDiscount, afterDecimal)
            let tax: Tax = { taxRate: element.taxPercentage ?? 0, taxes: element.taxes ?? [], taxType: element.taxType ?? '' }
            let recalculatedLineTaxes = calculateTax(newBasePrice, tax, false, afterDecimal);
            let newEffectiveLineTax = recalculatedLineTaxes.taxTotal;
            element.taxes = recalculatedLineTaxes.taxes
            element.taxPercentage = recalculatedLineTaxes.taxPercentage
            element.taxTotal = Helper.roundNum(newEffectiveLineTax, afterDecimal);
            element.taxableAmount = newBasePrice
      
            transactionTotal = Helper.add(transactionTotal, Helper.add(newBasePrice, newEffectiveLineTax, afterDecimal), afterDecimal);
            discountTotal = Helper.add(discountTotal, element.supplierCreditDiscount, afterDecimal);
          }else{
            transactionTotal = Helper.add(transactionTotal, element.total, afterDecimal);
               element.taxableAmount = transactionTotal
            discountTotal = Helper.add(discountTotal, element.supplierCreditDiscount, afterDecimal);
          }
        }else{
          transactionTotal = Helper.add(transactionTotal, element.total, afterDecimal);
          element.taxableAmount = transactionTotal
        }
           LinesTaxTotal = Helper.add(LinesTaxTotal, element.taxTotal, afterDecimal)
    }); 
    transactionSubTotal = transactionTotal;
    transactionTotal = applyDiscountBeforeTax ? Helper.add(transactionTotal, 0, afterDecimal) :  Helper.sub(transactionTotal, discountTotal, afterDecimal)

    // Compose final result summary
    return {
      total: transactionTotal,
      tax: LinesTaxTotal,
      discount: discountTotal,
      transactionDiscount:discountTotal,
      subtotal: transactionSubTotal,
      lines : lineItems
      
    };
  }


// export const calculateBill = (lineItems: LineItem[],isInclusiveTax: boolean,billDiscountAmount: number,discountPercentage: boolean,applyDiscountBeforeTax: boolean, afterDecimal: number): CalculationResults =>{
    
//     // ################################  get lines totals ################################
//     // --- First pass: Calculate each line's initial tax, discount, and totals ---
//     let LinesTotal = 0;           // Sum of line totals (gross or net+tax)
//     let LinesTaxTotal = 0;        // Sum of taxes from all lines
//     let LinesDiscountTotal = 0;   // Sum of line-level discounts
//     let linesBaseAmountTotal = 0; // Sum of net amounts before tax & after line discount

//     const intermediateLineDetails = lineItems.map(item => {
//       const processedLine = calculateLine(item, isInclusiveTax, applyDiscountBeforeTax, afterDecimal);

//       LinesTotal = Helper.add(LinesTotal, processedLine.lineTotal, afterDecimal);
//       LinesTaxTotal = Helper.add(LinesTaxTotal, processedLine.lineTaxTotal, afterDecimal);
//       LinesDiscountTotal = Helper.add(LinesDiscountTotal, processedLine.lineDiscountTotal, afterDecimal);
//       linesBaseAmountTotal = Helper.add(linesBaseAmountTotal, processedLine.lineBasePrice, afterDecimal);

//       return processedLine;
//     });


//     // ############################ Apply bill-level discount ############################
//     let effectiveBillDiscount = 0;
//     let finalTax = LinesTaxTotal;       // Start with total line tax
//     let finalSubtotalNet = linesBaseAmountTotal; // Sum of net amounts before bill discount

//     const hasBillDiscount = billDiscountAmount > 0 

//     if (hasBillDiscount) {
//          const discountType = discountPercentage == false ? 'amount' : 'rate'
//       if (applyDiscountBeforeTax) {

//         // ----------- effective Bill-Level Discount -----------
//         const baseForBillDiscount = Helper.sub(LinesTotal, LinesTaxTotal, afterDecimal); // net total

//         console.log(LinesTotal, LinesTaxTotal, baseForBillDiscount )

//         effectiveBillDiscount = getDiscountAmount(baseForBillDiscount, billDiscountAmount, discountType);

//         // Prevent discount from exceeding base amount
//         effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, baseForBillDiscount), afterDecimal);

//                     console.log(effectiveBillDiscount, baseForBillDiscount, billDiscountAmount )


//         // -------------- recalculate Total Tax --------------
//         let recalculatedTotalTax = 0;
//         if (baseForBillDiscount > 0) {
//           // Recalculate tax on discounted net amounts proportionally for each line
//           for (const item of intermediateLineDetails) {

//             const itemTaxInput: Tax = {taxRate: item.taxPercentage ?? 0,taxes: item.taxes ?? [], taxType: item.taxType ?? '', };
//             const hasItemTax        = item.taxId !== undefined && item.taxId !== null && item.taxId !== '';

//             if (!hasItemTax) {
//               continue; // Skip if no tax
//             }

//             // Calculate effective tax rate 
//             let effectiveItemTaxRateDecimal = 0;

//             if (itemTaxInput.taxes && itemTaxInput.taxes.length > 0 && itemTaxInput.taxType) {
//               if (itemTaxInput.taxType === 'flat') {
//                 const sumPercent = itemTaxInput.taxes.reduce((sum, t) => sum + t.taxPercentage, 0);
//                 effectiveItemTaxRateDecimal = sumPercent / 100;
//               } else if (itemTaxInput.taxType === 'stacked') {
//                 let multiplier = 1;
//                 for (const t of itemTaxInput.taxes) {
//                   multiplier *= (1 + t.taxPercentage / 100);
//                 }
//                 effectiveItemTaxRateDecimal = multiplier - 1;
//               }
//             } else {
//               effectiveItemTaxRateDecimal = (item.taxPercentage ?? 0) / 100;
//             }

//             // Calculate effective discount on the line
//             const lineBaseTotalBeforeBillDisc = Helper.sub(item.lineTotal, item.lineTaxTotal, afterDecimal);
//             const proportion = Helper.division(lineBaseTotalBeforeBillDisc, baseForBillDiscount, afterDecimal + 4);
//             const billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);

//             // Calculate effective line total before tax
//             const newEffectiveLineNet = Helper.roundNum(Helper.sub(lineBaseTotalBeforeBillDisc, billDiscountAttributedToLine, afterDecimal), afterDecimal);

//             // Calculate effective line tax
//             recalculatedTotalTax = Helper.add( recalculatedTotalTax, Helper.multiply(newEffectiveLineNet, effectiveItemTaxRateDecimal, afterDecimal), afterDecimal );
//           }

//           finalTax = recalculatedTotalTax;
//         } else {
//           finalTax = 0; // No net base, no tax
//         }
//       } else {
//         // Bill discount applies AFTER tax, so discount is on gross amount

//         const baseForBillDiscount = LinesTotal;

//         effectiveBillDiscount = getDiscountAmount( baseForBillDiscount,billDiscountAmount, discountType);
//         effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, baseForBillDiscount), afterDecimal);
//       }
//     }

//     // Calculate total discount and final total after discounts and taxes
//     const finalDiscount = Helper.add(effectiveBillDiscount, LinesDiscountTotal);
//     const finalTotal = Helper.roundNum(
//       Helper.sub(Helper.add(finalSubtotalNet, finalTax, afterDecimal), effectiveBillDiscount, afterDecimal),
//       afterDecimal
//     );


//     // ##################### lines Detailes after Bill-level discount #####################
//     // --- Third pass: Prepare detailed per-line output with bill-level discount allocation ---
//     const calculatedLineDetails: CalculatedLineDetail[] = [];

//     for (const item of intermediateLineDetails) {
//       let lineTaxTotal = item.lineTaxTotal;
//       let lineLevelDiscountTotal = item.lineDiscountTotal;
//       let lineFinalDiscount = lineLevelDiscountTotal;
//       let lineFinalTotal = item.lineTotal;

//       if (hasBillDiscount) {
//         if (applyDiscountBeforeTax) {
//           // Calculate bill discount proportion for each line and recalc tax on discounted net

//           const lineBaseBeforeBillDisc = Helper.sub(item.lineTotal, item.lineTaxTotal, afterDecimal);
//           const billBaseBeforeBillDisc = Helper.sub(LinesTotal, LinesTaxTotal, afterDecimal);

//           let billDiscountAttributedToLine = 0;

//           if (billBaseBeforeBillDisc > 0) {
//             const proportion = Helper.division(lineBaseBeforeBillDisc, billBaseBeforeBillDisc, afterDecimal + 4);
//             billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);
//           }

//           const newEffectiveLineNet = Helper.roundNum(Helper.sub(lineBaseBeforeBillDisc, billDiscountAttributedToLine, afterDecimal),afterDecimal);
//           const tax: Tax = {taxRate: item.taxPercentage ?? 0, taxes: item.taxes ?? [], taxType: item.taxType ?? ''}
//           // Recalculate tax on discounted net
//           const recalculatedLineTaxes = calculateTax(newEffectiveLineNet, tax, false, afterDecimal);
//           const newEffectiveLineTax = recalculatedLineTaxes.taxTotal;

//           lineFinalDiscount = Helper.roundNum(Helper.add(lineFinalDiscount, billDiscountAttributedToLine, afterDecimal), afterDecimal);

//           lineTaxTotal = Helper.roundNum(newEffectiveLineTax, afterDecimal);
//           lineFinalTotal = Helper.roundNum(newEffectiveLineNet + newEffectiveLineTax, afterDecimal);
//         } else {
//           // Discount after tax, so bill discount applied proportionally on gross amounts

//           const proportion = Helper.division(item.lineTotal, LinesTotal, afterDecimal + 4);
//           const billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);

//           lineFinalDiscount = Helper.roundNum(Helper.add(lineFinalDiscount, billDiscountAttributedToLine, afterDecimal),afterDecimal);
//           lineFinalTotal = Helper.roundNum(item.lineTotal - billDiscountAttributedToLine, afterDecimal);
//         }
//       }

//       // Compose final line detail
//       calculatedLineDetails.push({
//         id: item.id,
//         net: Helper.roundNum(lineFinalTotal - lineTaxTotal, afterDecimal),
//         tax: Helper.roundNum(lineTaxTotal, afterDecimal),
//         discount: lineFinalDiscount,
//         total: lineFinalTotal,
//       });
//     }

//     // Compose final result summary
//     return {
//       total: finalTotal,
//       tax: finalTax,
//       discount: finalDiscount,
//       billDiscount: effectiveBillDiscount,
//       subtotal: finalSubtotalNet,
//       lineDetails: calculatedLineDetails,
//     };
//   }


/**
 * Represents the detailed calculated financial breakdown for a single line item.
 */
// interface CalculatedLineDetail {
//     /** Unique identifier for the line item. */
//     id: string;
//     /** The net value of the item after all applicable discounts (line-level and proportional bill-level), before its specific tax. */
//     net: number;
//     /** The calculated tax amount specifically for this line item. */
//     tax: number;
//     /** The total discount applied to this line item, combining line-level and its attributed portion of the bill-level discount. */
//     discount: number;
//     /** The final total monetary amount for this line item, after all calculations. */
//     total: number;
// }






// import { Helper } from "@src/utilts/helper";
// import { after } from "lodash";



// // ####################### Tax functions #######################
// class Tax {
//     taxRate = 0;
//     taxType = ""      //empty when its not tax Group 
//     taxes:TaxModel[] = []; //empty when its not tax Group
// } 

// class TaxModel {
//     name = ""
//     index = ""
//     taxId = ""
//     taxPercentage = 0
//     taxAmount = 0
//     stackedTotal?=0
 
//     ParseJson(json: any): void {

//         for (const key in json) {

//             if (key in this) {
//                 this[key as keyof typeof this] = json[key];
//             }
//         }
//     }
// }

// interface CalculatedTaxes {
//     //Represents the results of a detailed tax calculation for a line item.
//     amountBeforeTax: number; /** The calculated net amount after accounting for inclusive taxes. */
//     taxTotal: number;  /** The total calculated tax amount for the line item. */
//     taxPercentage: number;  /** The sum of all tax percentages (for flat tax) or a conceptual sum (for stacked tax). */
//     taxes: TaxModel[] |[]; /** The array of `TaxModel` objects, with `taxAmount` populated for each individual tax. */
// }
 
// interface IntermediateLineDetail extends LineItem {
//     // Internal interface to hold temporary calculation results for each line item during the first pass.
//     _lineNetComponent: number; // Net value of the item before bill-level discount.
//     _lineTaxComponent: number; // Tax component of the item before bill-level discount.
//     _effectiveLineDiscount: number; // Effective line-level discount applied.
//     _taxes: TaxModel[];
//     _taxPercentage: number;
// }

// interface IntermediateLineDetail2 extends LineItem {
//     // Internal interface to hold temporary calculation results for each line item during the first pass.
//     lineBasePrice: number; // Net value of the item before bill-level discount.
//     lineTaxTotal: number; // Tax component of the item before bill-level discount.
//     lineDiscountTotal: number; // Effective line-level discount applied.
//     lineTaxes: TaxModel[];
//     lineTaxPercentage: number;
//     lineTotal :number
// }
 
// export interface LineItem {
//     // Represents a single line item in a bill.

//     /** Unique identifier for the line item. */
//     id: string;
//     /** A descriptive name for the product or service. */
//     description: string;
//     /** The base monetary amount of the line item before any discounts or taxes. */
//     amount: number;
//     /** The percentage discount rate applied specifically to this line item (e.g., 10 for 10%). */
//     discountPercentage: boolean;
//     /** A fixed monetary discount amount applied specifically to this line item. */
//     discountAmount: number;
//     /** The percentage tax rate applicable to this line item if no complex `taxes` array is used. */
//     taxId?: string;
//     taxPercentage?: number;
//     /** An optional array of `TaxModel` objects if multiple taxes are applied to this line item. */
//     taxes?: TaxModel[];
//     /** Specifies how taxes in the `taxes` array are applied: 'flat' (summed) or 'stacked' (compounded). Can be empty if `taxes` array is not used. */
//     taxType?: string|'flat' | 'stacked' | '';
// }

// const getBasePriceFromGrossForFlatTaxes = (grossAmount: number, taxes: TaxModel[], afterDecimal: number): number => {
//     /**
//      * Calculates the base (net) price from a given gross amount when taxes are flat and inclusive.
//      * Formula: `net = gross / (1 + sum_of_percentages / 100)`
//      *
//      * @param grossAmount The total amount including flat taxes.
//      * @param taxes An array of `TaxModel` objects representing flat taxes.
//      * @param afterDecimal The number of decimal places for calculations.
//      * @returns The calculated base (net) price.
//      * 
//      */




//     let flatTaxSumPercentage = 0;
//     taxes.forEach(element => {
//         flatTaxSumPercentage = Helper.add(flatTaxSumPercentage, element.taxPercentage, afterDecimal);
//     });
//     const taxFactor = Helper.division(Helper.add(100, flatTaxSumPercentage, afterDecimal), 100, afterDecimal);
//     const baseAmount = Helper.division(grossAmount, taxFactor, afterDecimal);
//     return Helper.roundNum(baseAmount, afterDecimal)
// }
        
// const getBasePriceFromGrossForStackedTaxes = (grossAmount: number, taxes: TaxModel[], afterDecimal: number): number => {
//     /**
//      * Calculates the base (net) price from a given gross amount when taxes are stacked and inclusive.
//      * Formula: `net = gross / ((1 + tax1/100) * (1 + tax2/100) * ...)`
//      *
//      * @param grossAmount The total amount including stacked taxes.
//      * @param taxes An array of `TaxModel` objects representing stacked taxes.
//      * @param afterDecimal The number of decimal places for calculations.
//      * @returns The calculated base (net) price.
//      */



//     let multiplier = 1;
//     taxes.forEach(element => {
//         multiplier = Helper.multiply(multiplier, Helper.division(Helper.add(element.taxPercentage, 100, afterDecimal), 100, afterDecimal), afterDecimal);
//     });
//     const baseAmount = Helper.division(grossAmount, multiplier, afterDecimal);
//     return Helper.roundNum(baseAmount, afterDecimal)
// }

// const calculateTax = (lineAmount: number,tax: Tax, isInclusiveTax: boolean,afterDecimal: number): CalculatedTaxes => {

//     /**
//  * Dispatches to the appropriate tax calculation function based on `taxType`.
//  * If no `taxes` array or `taxType` is specified, it assumes a single `taxPercentage`.
//  *
//  * @param lineAmount The base amount for tax calculation (could be original or discounted).
//  * @param Tax The original tax, used to access grouped `taxes`, `taxType`, and `taxRate`.
//  * @param isInclusiveTax True if `lineAmount` already includes tax; false otherwise.
//  * @param afterDecimal The number of decimal places for calculations.
//  * @returns A `CalculatedTaxes` object.
//  */

//     let baseAmount = lineAmount
//     let taxTotal = 0;
//     let taxPercentage = 0;
//     const taxes: TaxModel[] =[]

    
//     if (tax.taxes && tax.taxes.length > 0 && tax.taxType) {
//         if (tax.taxType === 'flat') {
//             if (isInclusiveTax) {
//                 baseAmount = getBasePriceFromGrossForFlatTaxes(lineAmount, tax.taxes, afterDecimal);
//             } 
//             tax.taxes.forEach(t => {
//                 const taxAmount = Helper.multiply(baseAmount, Helper.division(t.taxPercentage, 100, afterDecimal), afterDecimal);
//                 t.taxAmount = taxAmount;
//                 taxTotal = Helper.add(taxTotal, taxAmount, afterDecimal);
//                 taxPercentage = Helper.add(taxPercentage, t.taxPercentage, afterDecimal);
//                 taxes.push(t)
//             });

//             return {
//                 amountBeforeTax: Helper.roundNum(baseAmount, afterDecimal),
//                 taxTotal: Helper.roundNum(taxTotal, afterDecimal),
//                 taxPercentage: Helper.roundNum(taxPercentage|| 0, afterDecimal),
//                 taxes: taxes
//             };

            
//         } else if (tax.taxType === 'stacked') {
            
//             if (isInclusiveTax) {
//                 baseAmount = getBasePriceFromGrossForStackedTaxes(lineAmount, tax.taxes, afterDecimal);
//             } 

//             let tempstackedTotal = 0
//             let runningTotalForStacked = baseAmount

//             tax.taxes.forEach(t => {
//                 t.stackedTotal =  Helper.roundNum(tempstackedTotal,afterDecimal)
//                 const taxAmount = Helper.multiply(runningTotalForStacked, Helper.division(t.taxPercentage, 100, afterDecimal), afterDecimal);
//                 t.taxAmount = taxAmount;
//                 tempstackedTotal = taxAmount;
//                 taxTotal = Helper.add(taxTotal, taxAmount, afterDecimal);
//                 taxPercentage = Helper.multiply((taxPercentage==0) ? 1: taxPercentage , (1 + Helper.division(t.taxPercentage, 100, afterDecimal)), afterDecimal); // Sum for display
//                 runningTotalForStacked = Helper.add(runningTotalForStacked, taxAmount, afterDecimal); // Add tax to base for next stacked tax
//                 taxes.push(t)
//             });

//             taxPercentage = Helper.multiply(Helper.sub(taxPercentage,1, afterDecimal),100,afterDecimal)

//             return {
//                 amountBeforeTax: Helper.roundNum(baseAmount, afterDecimal),
//                 taxTotal: Helper.roundNum(taxTotal, afterDecimal),
//                 taxPercentage: Helper.roundNum(taxPercentage|| 0, afterDecimal),
//                 taxes: taxes
//             };

//         }
//     }

    

//     // Fallback if no specific tax type or taxes array is provided, use normal tax rate 
//     taxPercentage = tax.taxRate
//     if (isInclusiveTax) {
//         taxTotal = Helper.division(Helper.multiply(lineAmount ,tax.taxRate ,afterDecimal), Helper.add(100 , tax.taxRate,afterDecimal), afterDecimal) 
//         baseAmount = Helper.division(lineAmount, 1+ Helper.division(tax.taxRate , 100,afterDecimal), afterDecimal)
//     }else{
//         taxTotal = Helper.multiply(lineAmount, Helper.division(tax.taxRate , 100,afterDecimal), afterDecimal)
//     }

//     return {
//         amountBeforeTax: Helper.roundNum(baseAmount, afterDecimal),
//         taxTotal: Helper.roundNum(taxTotal, afterDecimal),
//         taxPercentage: Helper.roundNum(tax.taxRate || 0, afterDecimal),
//         taxes: []};
// }

// // ####################### discount functions #######################
// const getDiscountAmount = (base: number, amount: number, type: 'rate' | 'amount'): number => {
//     /**
//  * Calculates the effective discount amount based on a base value, rate, or fixed amount.
//  * Ensures that the calculated discount does not exceed the base amount.
//  *
//  * @param base The monetary amount on which the discount is to be applied.
//  * @param rate The percentage discount rate (e.g., 10 for 10%).
//  * @param amount The fixed monetary discount amount.
//  * @param type Specifies whether the discount is a 'rate' (percentage) or an 'amount' (fixed value).
//  * If `rate` is greater than 0, 'rate' type is implicitly prioritized.
//  * @returns The calculated effective discount amount.
//  */

//     let discount = 0;
//     if (type === 'rate') {
//         discount = base * (amount / 100);
//     } else { // type === 'amount'
//         discount = amount;
//     }
//     return Math.min(discount, base); // Ensure discount never exceeds the base amount
// };

// // ####################### Line functions #######################
// export const calculateLine = ( item: LineItem, isInclusiveTax: boolean, applyDiscountBeforeTax: boolean, afterDecimal: number) => {
    
//     /**
//   * Processes a single line item to determine its initial net component, tax component,
//   * and effective line-level discount based on whether discounts apply before or after tax,
//   * and whether complex tax structures are used.
//   *
//   * @param item The `LineItem` object to process.
//   * @param isInclusiveTax A boolean flag: `true` if line item `amount`s already include their respective taxes; `false` if taxes are added on top.
//   * @param applyDiscountBeforeTax A boolean flag: `true` if line-level discounts are applied before tax calculation; `false` if applied after.
//   * @returns An `IntermediateLineDetail` object with calculated components.
//   */

//     // ############################### variables ###############################
//     let lineTotal = item.amount;
//     let lineBasePrice = item.amount;
//     let lineTaxTotal = 0
//     let lineDiscountTotal = 0
//     let lineTaxes :TaxModel[] = []
//     let originalTaxes: CalculatedTaxes|null = null;
//     let lineTaxPercentage = 0
    
//     // ############################# calculate Tax  ##############################
//     if(item.taxId && item.taxId != undefined){
//          const tax = {taxRate: item.taxPercentage ?? 0, taxes: item.taxes ?? [], taxType: item.taxType ?? ''}
//          originalTaxes = calculateTax(lineTotal, tax , isInclusiveTax, afterDecimal);
//          lineBasePrice = originalTaxes.amountBeforeTax
//          lineTaxTotal = originalTaxes.taxTotal
//          lineTaxes = originalTaxes.taxes
//          lineTaxPercentage = originalTaxes.taxPercentage
//     }

//     // ########################### calculate Discount ###########################
//     if (item.discountAmount > 0) {
//         const discountType = item.discountPercentage == false ? 'amount' : 'rate'
//         if (applyDiscountBeforeTax) {

//             const baseForLineDiscount = isInclusiveTax ? lineBasePrice : lineTotal
//             lineDiscountTotal = getDiscountAmount(baseForLineDiscount, item.discountAmount, discountType );

//             lineTotal = Helper.sub(baseForLineDiscount, lineDiscountTotal, afterDecimal);

//             // recalculate tax after discount 
//             if (item.taxId && item.taxId != undefined) {
//                 const tax = { taxRate: item.taxPercentage ?? 0, taxes: item.taxes ?? [], taxType: item.taxType ?? '' }
//                 originalTaxes = calculateTax(lineTotal, tax, false, afterDecimal);
//                 lineBasePrice = originalTaxes.amountBeforeTax
//                 lineTaxTotal = originalTaxes.taxTotal
//                 lineTaxes = originalTaxes.taxes
//                 lineTotal = Helper.add(lineTotal, lineTaxTotal, afterDecimal)
//             }

//         } else {

//             // Calculate line-level discount. It applies to the amount *including* its tax component.
//             const baseForLineDiscount = Helper.add(lineTotal, (isInclusiveTax ? 0 : lineTaxTotal), afterDecimal);
//             lineDiscountTotal = getDiscountAmount(baseForLineDiscount,  item.discountAmount, discountType);

//             lineTotal = Helper.sub(baseForLineDiscount, lineDiscountTotal, afterDecimal);
//         }


//     }

//     // ############################### Return obj ###############################
//     return {
//         ...item,
//         lineBasePrice: Helper.roundNum(lineBasePrice, afterDecimal),
//         lineDiscountTotal: Helper.roundNum(lineDiscountTotal, afterDecimal),
//         lineTaxTotal: Helper.roundNum(lineTaxTotal, afterDecimal),
//         lineTaxPercentage: lineTaxPercentage,
//         lineTaxes: lineTaxes,
//         lineTotal: Helper.roundNum(lineTotal, afterDecimal),
//     };
    
//  };

 


// export const calculateLine2 = ( item: LineItem, isInclusiveTax: boolean, applyDiscountBeforeTax: boolean, afterDecimal: number): IntermediateLineDetail => {
    
//    /**
//  * Processes a single line item to determine its initial net component, tax component,
//  * and effective line-level discount based on whether discounts apply before or after tax,
//  * and whether complex tax structures are used.
//  *
//  * @param item The `LineItem` object to process.
//  * @param isInclusiveTax A boolean flag: `true` if line item `amount`s already include their respective taxes; `false` if taxes are added on top.
//  * @param applyDiscountBeforeTax A boolean flag: `true` if line-level discounts are applied before tax calculation; `false` if applied after.
//  * @returns An `IntermediateLineDetail` object with calculated components.
//  */
   
//     const currentLineAmount = item.amount;
//     let lineNetComponent = 0;
//     let lineTaxComponent = 0;
//     let taxPercentage = 0;
//     let taxes:TaxModel[] = [];
//     let effectiveLineDiscountForThisLine = 0;
//     let originalCalculatedTaxes: CalculatedTaxes|null = null;

//     if(item.taxId && item.taxId != undefined){
//         const tax = {taxRate: item.taxPercentage ?? 0, taxes: item.taxes ?? [], taxType: item.taxType ?? ''}
//         originalCalculatedTaxes = calculateTax(currentLineAmount, tax , isInclusiveTax, afterDecimal);
//     }

//     const discountType = item.discountPercentage == false ? 'amount' : 'rate'
//     if (applyDiscountBeforeTax) {
//         // SCENARIO: Line-level discounts applied BEFORE tax

//         let initialNetPrice: number = currentLineAmount ; 

//         if (isInclusiveTax && originalCalculatedTaxes) {
//             // Step 1: Calculate the price before tax (Net Price) 
//             initialNetPrice = originalCalculatedTaxes.amountBeforeTax;
//         } 

       
//         effectiveLineDiscountForThisLine = getDiscountAmount(initialNetPrice,  item.discountAmount, discountType );

//         lineNetComponent = Helper.roundNum(initialNetPrice - effectiveLineDiscountForThisLine, afterDecimal); // This is the $8 in your example

//        if(item.taxId && item.taxId != undefined){
//             const tax = {taxRate: item.taxPercentage ?? 0, taxes: item.taxes ?? [], taxType: item.taxType ?? ''}
//             const taxesOnDiscountedNet = calculateTax(lineNetComponent, tax,false, afterDecimal);
//             lineTaxComponent = taxesOnDiscountedNet.taxTotal; // This is the $0.80 in your example
//             taxPercentage = taxesOnDiscountedNet.taxPercentage
//             taxes = taxesOnDiscountedNet.taxes        }
        
//     } else {
//         // SCENARIO: Line-level discounts applied AFTER tax
//         // 1. Determine net and tax components of the original line amount first.
//         //    Tax is calculated on the original amount.
//         if(originalCalculatedTaxes){
//             lineNetComponent = originalCalculatedTaxes.amountBeforeTax;
//         lineTaxComponent = originalCalculatedTaxes.taxTotal;
//         taxPercentage = originalCalculatedTaxes.taxPercentage
//         taxes = originalCalculatedTaxes.taxes
//         }
        

//         // 2. Calculate line-level discount. It applies to the amount *including* its tax component.
//         const baseForLineDiscount = Helper.add(currentLineAmount, (isInclusiveTax ? 0 : lineTaxComponent), afterDecimal);
//         effectiveLineDiscountForThisLine = getDiscountAmount(baseForLineDiscount,item.discountAmount, discountType);
//     }

//     return {
//         ...item,
//         _lineNetComponent: Helper.roundNum(lineNetComponent, afterDecimal),
//         _lineTaxComponent: Helper.roundNum(lineTaxComponent, afterDecimal),
//         _effectiveLineDiscount: Helper.roundNum(effectiveLineDiscountForThisLine, afterDecimal),
//         _taxes: taxes,
//         _taxPercentage: taxPercentage
//     };
// };



// /**
//  * Represents the detailed calculated financial breakdown for a single line item.
//  */
// interface CalculatedLineDetail {
//     /** Unique identifier for the line item. */
//     id: string;
//     /** The net value of the item after all applicable discounts (line-level and proportional bill-level), before its specific tax. */
//     net: number;
//     /** The calculated tax amount specifically for this line item. */
//     tax: number;
//     /** The total discount applied to this line item, combining line-level and its attributed portion of the bill-level discount. */
//     discount: number;
//     /** The final total monetary amount for this line item, after all calculations. */
//     total: number;
// }

// /**
//  * Represents the comprehensive results of the bill calculation.
//  */
// interface CalculationResults {
//     /** The final grand total monetary amount of the entire bill. */
//     total: number;
//     /** The sum of all tax amounts across all line items in the bill. */
//     tax: number;
//     /** The sum of all discounts applied (line-level and bill-level) across the entire bill. */
//     discount: number;
//     /** The sum of net values from all line items after all applicable discounts, before their respective taxes. This represents the core value of goods/services. */
//     subtotal: number;
//     /** An array containing the detailed financial breakdown for each individual line item. */
//     lineDetails: CalculatedLineDetail[];
// }











// /**
//  * Calculates the total, tax, and discount for a bill with multiple line items,
//  * supporting per-line tax rates, line-level discounts, and a global bill-level discount.
//  * The calculation order for discounts and taxes is determined by the `applyDiscountBeforeTax` flag.
//  *
//  * This function handles two primary scenarios for discount/tax application:
//  *
//  * **Scenario 1: `applyDiscountBeforeTax` is `true`**
//  * - **Line-level discounts** are applied first to the original `lineItem.amount`.
//  * - **Tax** for each line is then calculated on this *discounted* amount (or extracted if `isInclusiveTax` is true).
//  * - The **bill-level discount** is applied to the sum of *net values* (after line discounts, before taxes) across all lines.
//  * - The **total tax** is *recalculated* proportionally based on the further reduced net values after the bill-level discount.
//  *
//  * **Scenario 2: `applyDiscountBeforeTax` is `false`**
//  * - **Tax** for each line is calculated on the *original* `lineItem.amount` (or extracted if `isInclusiveTax` is true).
//  * - **Line-level discounts** are applied to the total line amount *including its tax component*.
//  * - The **bill-level discount** is applied to the grand total (sum of net + tax) after line discounts.
//  * - The initial tax calculation remains unchanged; the bill discount reduces the final gross total.
//  *
//  * @param lineItems An array of `LineItem` objects representing individual products or services.
//  * @param isInclusiveTax A boolean flag: `true` if line item `amount`s already include their respective taxes; `false` if taxes are added on top.
//  * @param discountAmount The fixed monetary value of the bill-level discount.
//  * @param discountRate The percentage rate of the bill-level discount.
//  * @param applyDiscountBeforeTax A global boolean flag: `true` if all discounts (line and bill) should be applied before tax calculations; `false` if discounts are applied after tax.
//  * @param afterDecimal The number of decimal places to round all calculations to.
//  * @returns A `CalculationResults` object containing the final calculated totals and per-line details.
//  */
// export const calculateBill1 = (lineItems: LineItem[],isInclusiveTax: boolean,discountAmount: number,discountPercentage:boolean,applyDiscountBeforeTax: boolean,afterDecimal: number): CalculationResults => {
    
//     let totalNetValueFromLines = 0;
//     let totalTaxFromLines = 0;
//     let totalLineDiscountsApplied = 0;

//     // First pass: Process each line item to get initial net, tax, and line discount
//     const intermediateLineDetails: IntermediateLineDetail[] = lineItems.map(item => {
//         const processedItem = calculateLine2(item, isInclusiveTax, applyDiscountBeforeTax, afterDecimal);

//         totalLineDiscountsApplied = Helper.add(totalLineDiscountsApplied, processedItem._effectiveLineDiscount, afterDecimal);
//         totalNetValueFromLines = Helper.add(totalNetValueFromLines, processedItem._lineNetComponent, afterDecimal);
//         totalTaxFromLines = Helper.add(totalTaxFromLines, processedItem._lineTaxComponent, afterDecimal);

//         return processedItem;
//     });

//     let effectiveBillDiscount = 0;
//     let finalTax = totalTaxFromLines;
//     let finalSubtotalNet = totalNetValueFromLines;

//     // Second pass: Apply Bill-Level Discount
//      const discountType = discountPercentage == false ? 'amount' : 'rate'
//     if (applyDiscountBeforeTax) {
//         // When discounts apply before tax, the bill discount is applied to the total net value of lines.
//         const baseForBillDiscount = totalNetValueFromLines;

//         effectiveBillDiscount = getDiscountAmount(baseForBillDiscount,discountAmount,discountType);
//         effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, baseForBillDiscount), afterDecimal);

//         let recalculatedTotalTax = 0;
//         if (totalNetValueFromLines > 0) { // Avoid division by zero
//             intermediateLineDetails.forEach(item => {
//                 // Determine the effective tax rate for the current line item.
//                 // This handles both simple percentage and complex flat/stacked tax types.
//                 let effectiveItemTaxRateDecimal = 0;
//                 if (item.taxes && item.taxes.length > 0 && item.taxType) {
//                     if (item.taxType === 'flat') {
//                         let sumPercent = 0;
//                         item.taxes.forEach(t => sumPercent = Helper.add(sumPercent, t.taxPercentage, afterDecimal));
//                         effectiveItemTaxRateDecimal = Helper.division(sumPercent, 100, afterDecimal);
//                     } else if (item.taxType === 'stacked') {
//                         let multiplier = 1;
//                         item.taxes.forEach(t => multiplier = Helper.multiply(multiplier, Helper.division(Helper.add(t.taxPercentage, 100, afterDecimal), 100, afterDecimal + 4), afterDecimal + 4));
//                         effectiveItemTaxRateDecimal = Helper.sub(multiplier, 1, afterDecimal + 4);
//                     }
//                 } else {
//                     effectiveItemTaxRateDecimal = Helper.division((item.taxPercentage || 0), 100, afterDecimal);
//                 }

//                 const effectiveLineNetBeforeBillDisc = item._lineNetComponent;

//                 // Proportionally attribute the bill discount to each line based on its net component.
//                 const proportion = Helper.division(effectiveLineNetBeforeBillDisc, totalNetValueFromLines, afterDecimal + 4);
//                 const billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);

//                 // Calculate the new net amount for the line after applying its share of the bill discount.
//                 const newEffectiveLineNet = Helper.roundNum(Helper.sub(effectiveLineNetBeforeBillDisc, billDiscountAttributedToLine, afterDecimal), afterDecimal);
                
//                 // Recalculate the tax for this line based on its new net amount and effective tax rate.
//                 recalculatedTotalTax = Helper.add(recalculatedTotalTax, Helper.multiply(newEffectiveLineNet, effectiveItemTaxRateDecimal, afterDecimal), afterDecimal);
//             });
//             finalTax = recalculatedTotalTax;
//         } else {
//             finalTax = 0; // If no net value, no tax can be generated.
//         }

//         // Adjust the final subtotal net by the effective bill discount.
//         finalSubtotalNet = Helper.roundNum(Helper.sub(totalNetValueFromLines, effectiveBillDiscount, afterDecimal), afterDecimal);
//         finalSubtotalNet = Math.max(0, finalSubtotalNet); // Ensure subtotal doesn't go negative.

//     } else {
//         // When discounts apply after tax, the bill discount is applied to the gross total (net + tax) of lines.
//         const baseForBillDiscount = Helper.add(totalNetValueFromLines, totalTaxFromLines, afterDecimal);

//         effectiveBillDiscount = getDiscountAmount(baseForBillDiscount,discountAmount, discountType);
//         effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, baseForBillDiscount), afterDecimal);

//         // In this scenario, finalTax and finalSubtotalNet remain as initially calculated because
//         // the bill discount is applied to the gross total, not affecting the underlying net/tax components directly.
//     }

//     // Calculate the final grand total of the bill.
//     // If applyDiscountBeforeTax is true, the bill discount has already reduced finalSubtotalNet.
//     // If false, the bill discount is subtracted from the sum of finalSubtotalNet and finalTax.
//     let finalTotal = Helper.roundNum(
//         Helper.add(finalSubtotalNet, finalTax, afterDecimal) - (applyDiscountBeforeTax ? 0 : (effectiveBillDiscount+totalLineDiscountsApplied)),
//         afterDecimal
//     );
//     finalTotal = Math.max(0, finalTotal); // Ensure total doesn't go negative.

//     // Third pass: Calculate detailed per-line results for display
//     const calculatedLineDetails: CalculatedLineDetail[] = [];
//     intermediateLineDetails.forEach(item => {
//         let lineNetComponent = item._lineNetComponent;
//         let lineTaxComponent = item._lineTaxComponent;
//         let effectiveLineDiscountForThisLine = item._effectiveLineDiscount;
//         let lineTotalDiscount = 0;
//         let lineFinalTotal = 0;

//         if (applyDiscountBeforeTax) {
//             // When discounts apply before tax, attribute a portion of the bill discount to each line.
//             let billDiscountAttributedToLine = 0;
//             if (totalNetValueFromLines > 0) {
//                 const proportion = Helper.division(lineNetComponent, totalNetValueFromLines, afterDecimal + 4);
//                 billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);
//             }

//             // Adjust the line's net component and recalculate its tax.
//             const newEffectiveLineNet = Helper.roundNum(Helper.sub(lineNetComponent, billDiscountAttributedToLine, afterDecimal), afterDecimal);
//             // Recalculate tax for display based on the new effective net and original tax rules for the line.
//             const taxInput = { taxRate: item.taxPercentage ?? 0, taxes: item.taxes ?? [], taxType: item.taxType ?? '' };
//             const recalculatedLineTaxes = calculateTax(newEffectiveLineNet, taxInput, false, afterDecimal); // Pass false for isInclusiveTax because newEffectiveLineNet is explicitly net
//             const newEffectiveLineTax = recalculatedLineTaxes.taxTotal; // Corrected from totalTaxAmount

//             // Sum line-level and attributed bill-level discounts for the total line discount.
//             lineTotalDiscount = Helper.roundNum(Helper.add(effectiveLineDiscountForThisLine, billDiscountAttributedToLine, afterDecimal), afterDecimal);
//             // Calculate the final total for the line.
//             lineFinalTotal = Helper.roundNum(Helper.add(newEffectiveLineNet, newEffectiveLineTax, afterDecimal), afterDecimal);

//             calculatedLineDetails.push({
//                 id: item.id,
//                 net: newEffectiveLineNet,
//                 tax: newEffectiveLineTax,
//                 discount: lineTotalDiscount,
//                 total: lineFinalTotal
//             });

//         } else {
//             // When discounts apply after tax, attribute a portion of the bill discount to each line's gross value.
//             let billDiscountAttributedToLine = 0;
//             // Calculate the line's gross value before the bill discount.
//             const lineGrossBeforeBillDisc = Helper.roundNum(Helper.add(lineNetComponent, lineTaxComponent, afterDecimal), afterDecimal);
            
//             // The discount was applied to the total of (net + tax). So, for proportionality, use this sum.
//             const totalGrossBeforeBillDisc = Helper.add(totalNetValueFromLines, totalTaxFromLines, afterDecimal) ;
//             if (totalGrossBeforeBillDisc > 0) {
//                 const proportion = Helper.division(lineGrossBeforeBillDisc, totalGrossBeforeBillDisc, afterDecimal + 4);
//                 billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);
//             }

//             // Line-level discount is already factored in `effectiveLineDiscountForThisLine`.
//             // Add the attributed bill discount to get the total discount for the line.
//             lineTotalDiscount = Helper.roundNum(Helper.add(effectiveLineDiscountForThisLine, billDiscountAttributedToLine, afterDecimal), afterDecimal);
//             // The final total for the line is its gross before bill discount minus the attributed bill discount.
//             lineFinalTotal = Helper.roundNum(Helper.sub(lineGrossBeforeBillDisc, lineTotalDiscount, afterDecimal), afterDecimal);

//             calculatedLineDetails.push({
//                 id: item.id,
//                 net: lineNetComponent, // Net remains unchanged in this scenario
//                 tax: lineTaxComponent, // Tax remains unchanged in this scenario
//                 discount: lineTotalDiscount,
//                 total: lineFinalTotal
//             });
//         }
//     });

//     return {
//         total: finalTotal,
//         tax: finalTax,
//         discount: Helper.roundNum(Helper.add(totalLineDiscountsApplied, effectiveBillDiscount, afterDecimal), afterDecimal),
//         subtotal: finalSubtotalNet,
//         lineDetails: calculatedLineDetails
//     };
// };



// // export const calculateBill2 = (lineItems: LineItem[],isInclusiveTax: boolean,discountAmount: number,discountRate:number,applyDiscountBeforeTax: boolean,afterDecimal: number): CalculationResults => {
    
// //     let linesBasePriceTotal = 0;
// //     let linesTotal = 0;
// //     let linesTaxTotal = 0;
// //     let linesDiscountTotal = 0;

// //     // First pass: Process each line item to get initial net, tax, and line discount
// //     const intermediateLineDetails: IntermediateLineDetail2[] = lineItems.map(item => {
// //         const processedItem = calculateLine2(item, isInclusiveTax, applyDiscountBeforeTax, afterDecimal);

// //         linesDiscountTotal = Helper.add(linesDiscountTotal, processedItem.lineDiscountTotal, afterDecimal);
// //         linesBasePriceTotal = Helper.add(linesBasePriceTotal, processedItem.lineBasePrice, afterDecimal);
// //         linesTaxTotal = Helper.add(linesTaxTotal, processedItem.lineTaxTotal, afterDecimal);
// //         linesTotal =  Helper.add(linesTotal, processedItem.lineTotal, afterDecimal);

// //         return processedItem;
// //     });

// //     let effectiveBillDiscount = 0;
// //     let finalTax = linesTaxTotal;
// //     let finalTotal = linesTotal
// //     let finalSubtotalNet = linesBasePriceTotal;

// //     // ########################### calculate Discount ###########################
// //     if (discountAmount > 0 || discountRate > 0) {
// //         if (applyDiscountBeforeTax) {

// //             const baseForBillDiscount = Helper.sub(linesTotal, linesTaxTotal, afterDecimal);
// //             effectiveBillDiscount = getDiscountAmount(baseForBillDiscount, discountRate, discountAmount, discountRate > 0 ? 'rate' : 'amount');
// //             effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, baseForBillDiscount), afterDecimal);

// //             //recalculate tax total 
// //             let recalculatedTotalTax = 0
// //             if (baseForBillDiscount > 0) {// Avoid division by zero
// //                 intermediateLineDetails.forEach(item => {
// //                     // Determine the effective tax rate for the current line item.
// //                     // This handles both simple percentage and complex flat/stacked tax types.
// //                     let effectiveItemTaxRateDecimal = 0;
// //                     if (item.taxId && item.taxId != undefined) {
// //                         if (item.taxes && item.taxes.length > 0 && item.taxType) {
// //                             if (item.taxType === 'flat') {
// //                                 let sumPercent = 0;
// //                                 item.taxes.forEach(t => sumPercent = Helper.add(sumPercent, t.taxPercentage, afterDecimal));
// //                                 effectiveItemTaxRateDecimal = Helper.division(sumPercent, 100, afterDecimal);
// //                             } else if (item.taxType === 'stacked') {
// //                                 let multiplier = 1;
// //                                 item.taxes.forEach(t => multiplier = Helper.multiply(multiplier, Helper.division(Helper.add(t.taxPercentage, 100, afterDecimal), 100, afterDecimal + 4), afterDecimal + 4));
// //                                 effectiveItemTaxRateDecimal = Helper.sub(multiplier, 1, afterDecimal + 4);
// //                             }
// //                         } else {
// //                             effectiveItemTaxRateDecimal = Helper.division((item.taxPercentage || 0), 100, afterDecimal);
// //                         }

// //                     }

// //                     // total- tax => line/ bill => (line/bill)*billDiscTotal => line - lineDisc
// //                     const lineBaseBeforeBillDisc = Helper.sub(item.lineTotal, item.lineTaxTotal, afterDecimal);

// //                     // Proportionally attribute the bill discount to each line based on its net component.
// //                     const proportion = Helper.division(lineBaseBeforeBillDisc, baseForBillDiscount, afterDecimal + 4);
// //                     const billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);

// //                     // Calculate the new net amount for the line after applying its share of the bill discount.
// //                     const newEffectiveLineNet = Helper.roundNum(Helper.sub(lineBaseBeforeBillDisc, billDiscountAttributedToLine, afterDecimal), afterDecimal);

// //                     // Recalculate the tax for this line based on its new net amount and effective tax rate.
// //                     recalculatedTotalTax = Helper.add(recalculatedTotalTax, Helper.multiply(newEffectiveLineNet, effectiveItemTaxRateDecimal, afterDecimal), afterDecimal);
// //                 });
// //                 finalTax = recalculatedTotalTax;
// //             }else {
// //             finalTax = 0; // If no net value, no tax can be generated.
// //             }

// //             finalTotal = Helper.sub(baseForBillDiscount, finalTax, afterDecimal)



// //         // Adjust the final subtotal net by the effective bill discount.
// //         // finalSubtotalNet = Helper.roundNum(Helper.sub(linesTotal, effectiveBillDiscount, afterDecimal), afterDecimal);
// //         // finalSubtotalNet = Math.max(0, finalSubtotalNet); // Ensure subtotal doesn't go negative.



// //             // lineTotal = Helper.sub(baseForLineDiscount, lineDiscountTotal, afterDecimal);

// //             // // recalculate tax after discount 
// //             // if (item.taxId && item.taxId != undefined) {
// //             //     const tax = { taxRate: item.taxPercentage ?? 0, taxes: item.taxes ?? [], taxType: item.taxType ?? '' }
// //             //     originalTaxes = calculateTax(lineTotal, tax, false, afterDecimal);
// //             //     lineBasePrice = originalTaxes.amountBeforeTax
// //             //     lineTaxTotal = originalTaxes.taxTotal
// //             //     lineTaxes = originalTaxes.taxes
// //             //     lineTotal = Helper.add(lineTotal, lineTaxTotal, afterDecimal)
// //             // }

// //         } else {

// //             // When discounts apply after tax, the bill discount is applied to the gross total (net + tax - discount) of lines.
    
// //             effectiveBillDiscount = getDiscountAmount(linesTotal, discountRate, discountAmount, discountRate > 0 ? 'rate' : 'amount');
// //             effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, linesTotal), afterDecimal);

            

// //             // In this scenario, finalTax and finalSubtotalNet remain as initially calculated because
// //             // the bill discount is applied to the gross total, not affecting the underlying net/tax components directly.
// //         }


// //     }

  

// //     // Calculate the final grand total of the bill.
// //     // If applyDiscountBeforeTax is true, the bill discount has already reduced finalSubtotalNet.
// //     // If false, the bill discount is subtracted from the sum of finalSubtotalNet and finalTax.
// //      finalTotal = Helper.roundNum(
// //         Helper.add(finalSubtotalNet, finalTax, afterDecimal) - (applyDiscountBeforeTax ? 0 : (effectiveBillDiscount+linesDiscountTotal)),
// //         afterDecimal
// //     );
// //     finalTotal = Math.max(0, finalTotal); // Ensure total doesn't go negative.





// //     // Third pass: Calculate detailed per-line results for display
// //     // const calculatedLineDetails: CalculatedLineDetail[] = [];
// //     // intermediateLineDetails.forEach(item => {
// //     //     let lineNetComponent = item._lineNetComponent;
// //     //     let lineTaxComponent = item._lineTaxComponent;
// //     //     let effectiveLineDiscountForThisLine = item._effectiveLineDiscount;
// //     //     let lineTotalDiscount = 0;
// //     //     let lineFinalTotal = 0;

// //     //     if (applyDiscountBeforeTax) {
// //     //         // When discounts apply before tax, attribute a portion of the bill discount to each line.
// //     //         let billDiscountAttributedToLine = 0;
// //     //         if (totalNetValueFromLines > 0) {
// //     //             const proportion = Helper.division(lineNetComponent, totalNetValueFromLines, afterDecimal + 4);
// //     //             billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);
// //     //         }

// //     //         // Adjust the line's net component and recalculate its tax.
// //     //         const newEffectiveLineNet = Helper.roundNum(Helper.sub(lineNetComponent, billDiscountAttributedToLine, afterDecimal), afterDecimal);
// //     //         // Recalculate tax for display based on the new effective net and original tax rules for the line.
// //     //         const taxInput = { taxRate: item.taxPercentage ?? 0, taxes: item.taxes ?? [], taxType: item.taxType ?? '' };
// //     //         const recalculatedLineTaxes = calculateTax(newEffectiveLineNet, taxInput, false, afterDecimal); // Pass false for isInclusiveTax because newEffectiveLineNet is explicitly net
// //     //         const newEffectiveLineTax = recalculatedLineTaxes.taxTotal; // Corrected from totalTaxAmount

// //     //         // Sum line-level and attributed bill-level discounts for the total line discount.
// //     //         lineTotalDiscount = Helper.roundNum(Helper.add(effectiveLineDiscountForThisLine, billDiscountAttributedToLine, afterDecimal), afterDecimal);
// //     //         // Calculate the final total for the line.
// //     //         lineFinalTotal = Helper.roundNum(Helper.add(newEffectiveLineNet, newEffectiveLineTax, afterDecimal), afterDecimal);

// //     //         calculatedLineDetails.push({
// //     //             id: item.id,
// //     //             net: newEffectiveLineNet,
// //     //             tax: newEffectiveLineTax,
// //     //             discount: lineTotalDiscount,
// //     //             total: lineFinalTotal
// //     //         });

// //     //     } else {
// //     //         // When discounts apply after tax, attribute a portion of the bill discount to each line's gross value.
// //     //         let billDiscountAttributedToLine = 0;
// //     //         // Calculate the line's gross value before the bill discount.
// //     //         const lineGrossBeforeBillDisc = Helper.roundNum(Helper.add(lineNetComponent, lineTaxComponent, afterDecimal), afterDecimal);
            
// //     //         // The discount was applied to the total of (net + tax). So, for proportionality, use this sum.
// //     //         const totalGrossBeforeBillDisc = Helper.add(totalNetValueFromLines, totalTaxFromLines, afterDecimal) ;
// //     //         if (totalGrossBeforeBillDisc > 0) {
// //     //             const proportion = Helper.division(lineGrossBeforeBillDisc, totalGrossBeforeBillDisc, afterDecimal + 4);
// //     //             billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);
// //     //         }

// //     //         // Line-level discount is already factored in `effectiveLineDiscountForThisLine`.
// //     //         // Add the attributed bill discount to get the total discount for the line.
// //     //         lineTotalDiscount = Helper.roundNum(Helper.add(effectiveLineDiscountForThisLine, billDiscountAttributedToLine, afterDecimal), afterDecimal);
// //     //         // The final total for the line is its gross before bill discount minus the attributed bill discount.
// //     //         lineFinalTotal = Helper.roundNum(Helper.sub(lineGrossBeforeBillDisc, lineTotalDiscount, afterDecimal), afterDecimal);

// //     //         calculatedLineDetails.push({
// //     //             id: item.id,
// //     //             net: lineNetComponent, // Net remains unchanged in this scenario
// //     //             tax: lineTaxComponent, // Tax remains unchanged in this scenario
// //     //             discount: lineTotalDiscount,
// //     //             total: lineFinalTotal
// //     //         });
// //     //     }
// //     // });

// //     return {
// //         total: finalTotal,
// //         tax: finalTax,
// //         discount: Helper.roundNum(Helper.add(linesDiscountTotal, effectiveBillDiscount, afterDecimal), afterDecimal),
// //         subtotal: finalSubtotalNet,
// //         lineDetails: []//calculatedLineDetails
// //     };
// // };


// // /**
// //  * Calculates the total, tax, and discount for a bill with multiple line items,
// //  * supporting per-line tax rates, line-level discounts, and a global bill-level discount.
// //  * The calculation order for discounts and taxes is determined by the `applyDiscountBeforeTax` flag.
// //  *
// //  * This function handles two primary scenarios for discount/tax application:
// //  *
// //  * **Scenario 1: `applyDiscountBeforeTax` is `true`**
// //  * - **Line-level discounts** are applied first to the original `lineItem.amount`.
// //  * - **Tax** for each line is then calculated on this *discounted* amount (or extracted if `isInclusiveTax` is true).
// //  * - The **bill-level discount** is applied to the sum of *net values* (after line discounts, before taxes) across all lines.
// //  * - The **total tax** is *recalculated* proportionally based on the further reduced net values after the bill-level discount.
// //  *
// //  * **Scenario 2: `applyDiscountBeforeTax` is `false`**
// //  * - **Tax** for each line is calculated on the *original* `lineItem.amount` (or extracted if `isInclusiveTax` is true).
// //  * - **Line-level discounts** are applied to the total line amount *including its tax component*.
// //  * - The **bill-level discount** is applied to the grand total (sum of net + tax) after line discounts.
// //  * - The initial tax calculation remains unchanged; the bill discount reduces the final gross total.
// //  *
// //  * @param lineItems An array of `LineItem` objects representing individual products or services.
// //  * @param isInclusiveTax A boolean flag: `true` if line item `amount`s already include their respective taxes; `false` if taxes are added on top.
// //  * @param billDiscVal The value of the bill-level discount. This can be a rate or an amount depending on `billDiscType`.
// //  * @param billDiscType The type of the bill-level discount: 'rate' (percentage) or 'amount' (fixed value).
// //  * @param applyDiscountBeforeTax A global boolean flag: `true` if all discounts (line and bill) should be applied before tax calculations; `false` if discounts are applied after tax.
// //  * @returns A `CalculationResults` object containing the final calculated totals and per-line details.
// //  */
// // export const calculateBill = (lineItems: LineItem[],isInclusiveTax: boolean,discountAmount: number,discountRate:number,applyDiscountBeforeTax: boolean,afterDecimal: number): CalculationResults => {
    
// //     let totalNetValueFromLines = 0;
// //     let totalTaxFromLines = 0;
// //     let totalLineDiscountsApplied = 0;
// //      afterDecimal = afterDecimal;

// //     // First pass: Process each line item to get initial net, tax, and line discount
// //     const intermediateLineDetails: IntermediateLineDetail[] = lineItems.map(item => {
// //         const processedItem = calculateLine(item, isInclusiveTax, applyDiscountBeforeTax, afterDecimal);

// //         totalLineDiscountsApplied = Helper.add(totalLineDiscountsApplied, processedItem._effectiveLineDiscount, afterDecimal);
// //         totalNetValueFromLines = Helper.add(totalNetValueFromLines, processedItem._lineNetComponent, afterDecimal);
// //         totalTaxFromLines = Helper.add(totalTaxFromLines, processedItem._lineTaxComponent, afterDecimal);

// //         return processedItem;
// //     });

// //     let effectiveBillDiscount = 0;
// //     let finalTax = totalTaxFromLines;
// //     let finalSubtotalNet = totalNetValueFromLines;

// //     // Second pass: Apply Bill-Level Discount
// //     if (applyDiscountBeforeTax) {
// //         const baseForBillDiscount = totalNetValueFromLines;

// //         effectiveBillDiscount = getDiscountAmount(baseForBillDiscount,discountRate,discountAmount, discountRate > 0 ? 'rate' : 'amount');
// //         effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, baseForBillDiscount), afterDecimal);

// //         let recalculatedTotalTax = 0;
// //         if (totalNetValueFromLines > 0) { // Avoid division by zero
// //             intermediateLineDetails.forEach(item => {
// //                 // If the item had a taxPercentage, use it; otherwise, sum up percentages from its tax models if they exist.
// //                 // This part ensures that the proportional recalculation of tax for the bill-level discount
// //                 // correctly attributes the tax based on the *effective* tax rate of the item.
// //                 let effectiveItemTaxRateDecimal = 0;
// //                 if (item.taxes && item.taxes.length > 0 && item.taxType) {
// //                     // For re-calculation, we need to know the effective combined percentage for the line
// //                     if (item.taxType === 'flat') {
// //                         let sumPercent = 0;
// //                         item.taxes.forEach(t => sumPercent = Helper.add(sumPercent, t.taxPercentage, afterDecimal));
// //                         effectiveItemTaxRateDecimal = sumPercent / 100;
// //                     } else if (item.taxType === 'stacked') {
// //                         // For stacked, the effective percentage for a gross amount is derived from the multiplier
// //                         let multiplier = 1;
// //                         item.taxes.forEach(t => multiplier = Helper.multiply(multiplier, Helper.division(Helper.add(t.taxPercentage, 100, afterDecimal), 100, afterDecimal), afterDecimal + 4));
// //                         effectiveItemTaxRateDecimal = multiplier - 1;
// //                     }
// //                 } else {
// //                     effectiveItemTaxRateDecimal = (item.taxPercentage || 0) / 100;
// //                 }

// //                 const effectiveLineNetBeforeBillDisc = item._lineNetComponent;

// //                 const proportion = Helper.division(effectiveLineNetBeforeBillDisc, totalNetValueFromLines, afterDecimal + 4);
// //                 const billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);

// //                 const newEffectiveLineNet = Helper.roundNum(effectiveLineNetBeforeBillDisc - billDiscountAttributedToLine, afterDecimal);
// //                 recalculatedTotalTax = Helper.add(recalculatedTotalTax, Helper.multiply(newEffectiveLineNet, effectiveItemTaxRateDecimal, afterDecimal), afterDecimal);
// //             });
// //             finalTax = recalculatedTotalTax;
// //         } else {
// //             finalTax = 0;
// //         }

// //         finalSubtotalNet = Helper.roundNum(totalNetValueFromLines - effectiveBillDiscount, afterDecimal);
// //         finalSubtotalNet = Math.max(0, finalSubtotalNet);

// //     } else {
// //         const baseForBillDiscount = Helper.add(totalNetValueFromLines, totalTaxFromLines, afterDecimal);

// //         effectiveBillDiscount = getDiscountAmount(baseForBillDiscount, discountRate, discountAmount, discountRate > 0 ? 'rate' : 'amount');
// //         effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, baseForBillDiscount), afterDecimal);

// //         // finalTax and finalSubtotalNet remain as initially calculated in this scenario
// //     }

// //     let finalTotal = Helper.roundNum(
// //         Helper.add(finalSubtotalNet, finalTax, afterDecimal) - (applyDiscountBeforeTax ? 0 : effectiveBillDiscount),
// //         afterDecimal
// //     );
// //     finalTotal = Math.max(0, finalTotal);

// //     // Third pass: Calculate detailed per-line results for display
// //     const calculatedLineDetails: CalculatedLineDetail[] = [];
// //     intermediateLineDetails.forEach(item => {
// //         let lineNetComponent = item._lineNetComponent;
// //         let lineTaxComponent = item._lineTaxComponent;
// //         let effectiveLineDiscountForThisLine = item._effectiveLineDiscount;
// //         let lineTotalDiscount = 0;
// //         let lineFinalTotal = 0;

// //         if (applyDiscountBeforeTax) {
// //             let billDiscountAttributedToLine = 0;
// //             if (totalNetValueFromLines > 0) {
// //                 const proportion = Helper.division(lineNetComponent, totalNetValueFromLines, afterDecimal + 4);
// //                 billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);
// //             }

// //             const newEffectiveLineNet = Helper.roundNum(lineNetComponent - billDiscountAttributedToLine, afterDecimal);
// //             // Recalculate tax for display based on the new effective net and original tax rules for the line
// //             const recalculatedLineTaxes = calculateTax(newEffectiveLineNet, item, false, afterDecimal); // Pass false for isInclusiveTax because newEffectiveLineNet is explicitly net
// //             const newEffectiveLineTax = recalculatedLineTaxes.totalTaxAmount;

// //             lineTotalDiscount = Helper.roundNum(Helper.add(effectiveLineDiscountForThisLine, billDiscountAttributedToLine, afterDecimal), afterDecimal);
// //             lineFinalTotal = Helper.roundNum(Helper.add(newEffectiveLineNet, newEffectiveLineTax, afterDecimal), afterDecimal);

// //             calculatedLineDetails.push({
// //                 id: item.id,
// //                 net: newEffectiveLineNet,
// //                 tax: newEffectiveLineTax,
// //                 discount: lineTotalDiscount,
// //                 total: lineFinalTotal
// //             });

// //         } else {
// //             let billDiscountAttributedToLine = 0;
// //             const lineGrossBeforeBillDisc = Helper.roundNum(Helper.add(lineNetComponent, lineTaxComponent, afterDecimal) - effectiveLineDiscountForThisLine, afterDecimal);

// //             if (Helper.add(totalNetValueFromLines, totalTaxFromLines, afterDecimal) > 0) {
// //                 const proportion = Helper.division(lineGrossBeforeBillDisc, Helper.add(totalNetValueFromLines, totalTaxFromLines, afterDecimal), afterDecimal + 4);
// //                 billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);
// //             }

// //             lineTotalDiscount = Helper.roundNum(Helper.add(effectiveLineDiscountForThisLine, billDiscountAttributedToLine, afterDecimal), afterDecimal);
// //             lineFinalTotal = Helper.roundNum(lineGrossBeforeBillDisc - billDiscountAttributedToLine, afterDecimal);

// //             calculatedLineDetails.push({
// //                 id: item.id,
// //                 net: lineNetComponent,
// //                 tax: lineTaxComponent,
// //                 discount: lineTotalDiscount,
// //                 total: lineFinalTotal
// //             });
// //         }
// //     });

// //     return {
// //         total: finalTotal,
// //         tax: finalTax,
// //         discount: Helper.roundNum(Helper.add(totalLineDiscountsApplied, effectiveBillDiscount, afterDecimal), afterDecimal),
// //         subtotal: finalSubtotalNet,
// //         lineDetails: calculatedLineDetails
// //     };
// // };






























// // type Discount = { type: 'amount'; value: number } | { type: 'percent'; value: number };
// // type ResultItem = {
// //     name: string;
// //     baseBeforeDiscount: number;
// //     lineDiscount: number;
// //     baseAfterLineDiscount: number;
// //     billLevelDiscount: number;
// //     baseAfterAllDiscounts: number;
// //     taxAmount: number;
// //     finalTotal: number;
// //   }

// // type LineItem = {
// //   name: string;
// //   totalInclTax: number;
// //   taxRate: number;
// //   lineDiscount?: Discount;
// // };

// // type InvoiceInput = {
// //   isInclusive: boolean;
// //   totalBillLevelDiscount?: Discount;
// //   lines: LineItem[];
// // };



// // function applyDiscount(base: number, discount?: Discount): number {
// //     //get discount as amount 
// //     if (!discount) return 0;  // if discount is empty 
// //     return discount.type === 'percent'
// //       ? (discount.value / 100) * base //if discount percentage
// //       : discount.value;               //if discount amount
// //   }

// //   export function calculateInvoice(input: InvoiceInput ): {
// //     items: ResultItem[];
// //     summary: {
// //       totalBase: number;
// //       totalTax: number;
// //       lineDiscountTotal: number;
// //       billLevelDiscountTotal: number;
// //       finalTotal: number;
// //     };
// //   } {
// //     const { isInclusive, lines, totalBillLevelDiscount } = input;
    
  
// //     // Step 1: Convert to base (before tax) values    
// //     const bases = lines.map(l =>
// //       isInclusive ? l.totalInclTax / (1 + l.taxRate) : l.totalInclTax
// //     );
  
// //     // Step 2: Line-level discounts
// //     const lineDiscounts = lines.map((line, i) =>
// //       applyDiscount(bases[i], line.lineDiscount)
// //     );
// //     const baseAfterLineDiscounts = bases.map((b, i) => b - lineDiscounts[i]);

// //     // Step 3: Compute bill-level discount total
// //     const subtotal = baseAfterLineDiscounts.reduce((sum, b) => sum + b, 0);
// //     const billLevelDiscountTotal = applyDiscount(subtotal, totalBillLevelDiscount);

     
// //     // Step 4: Allocate bill-level discount proportionally
// //     const billLevelDiscounts = baseAfterLineDiscounts.map(base =>
// //         subtotal > 0 ? (base / subtotal) * billLevelDiscountTotal : 0
// //     );
    
  
// //     // Step 5: Compute tax and totals
// //     const items: ResultItem[] = lines.map((line, i) => {
// //       const baseBefore = bases[i];
// //       const lineDiscount = lineDiscounts[i];
// //       const baseAfterLine = baseBefore - lineDiscount;
// //       const billDiscount = billLevelDiscounts[i];
// //       const baseAfterAllDiscounts = baseAfterLine - billDiscount;
// //       const taxAmount = baseAfterAllDiscounts * line.taxRate;
// //       const finalTotal = baseAfterAllDiscounts + taxAmount;
  
// //       return {
// //         name: line.name,
// //         baseBeforeDiscount: baseBefore,
// //         lineDiscount,
// //         baseAfterLineDiscount: baseAfterLine,
// //         billLevelDiscount: billDiscount,
// //         baseAfterAllDiscounts,
// //         taxAmount,
// //         finalTotal
// //       };
// //     });
  
// //    // Step 6: Build summary
// //    const summary = {
// //     totalBase: items.reduce((sum, i) => sum + i.baseAfterAllDiscounts, 0),
// //     totalTax: items.reduce((sum, i) => sum + i.taxAmount, 0),
// //     lineDiscountTotal: lineDiscounts.reduce((sum, d) => sum + d, 0),
// //     billLevelDiscountTotal,
// //     finalTotal: items.reduce((sum, i) => sum + i.finalTotal, 0),
// //     };
    
// //     return { items, summary };
// //   }

// export const calculateBill22 = (lineItems: LineItem[],isInclusiveTax: boolean,discountAmount: number,discountPercentage:boolean,applyDiscountBeforeTax: boolean,afterDecimal: number): CalculationResults => {
//     // First pass: Process each line item to get initial net, tax, and line discount

//     // ################## get lines: total, tax, disc ,basePrice ##################
//     let linesTotal = 0;
//     let linesTaxTotal = 0;
//     let linesDiscountTotal = 0;
//     let linesBasePriceTotal = 0;

//     const intermediateLineDetails: IntermediateLineDetail2[] = lineItems.map(item => {
//         const processedItem = calculateLine(item, isInclusiveTax, applyDiscountBeforeTax, afterDecimal);

//         linesDiscountTotal  = Helper.add(linesDiscountTotal, processedItem.lineDiscountTotal, afterDecimal);
//         linesBasePriceTotal = Helper.add(linesBasePriceTotal, processedItem.lineBasePrice, afterDecimal);
//         linesTaxTotal       = Helper.add(linesTaxTotal, processedItem.lineTaxTotal, afterDecimal);
//         linesTotal          = Helper.add(linesTaxTotal, processedItem.lineTotal, afterDecimal);

//         return processedItem;
//     });

//     // ################## Bill Discount ##################
//     let effectiveBillDiscount = 0;
//     let BillTaxTotal = linesTaxTotal;
//     let finalSubtotalNet = linesBasePriceTotal;

//     if (discountAmount > 0 ) {
//          const discountType = discountPercentage == false ? 'amount' : 'rate'
//         if (applyDiscountBeforeTax) {
//             // get lines before tax = linesTotal - linesTaxTotal 
//             // get tax Total => for each line => 
//             //                 newTaxRate = based on the tax type
//             //                 lineTotal  = linewithdisc - linewithdisc/billTotal * billDiscAmount 
//             //                 lineTotal  = lineTotal + newTaxRate * lineTotal 
//             //                 billTaxTotal  = billTaxTotal + newTaxRate * lineTotal 

//             const baseForBillDiscount = Helper.sub(linesTotal, linesTaxTotal, afterDecimal);

//             effectiveBillDiscount = getDiscountAmount(baseForBillDiscount,discountAmount, discountType);
//             effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, baseForBillDiscount), afterDecimal);

//             let recalculatedTotalTax = 0;
//             if (baseForBillDiscount != 0) { // Avoid division by zero
//                 intermediateLineDetails.forEach(item => {
//                     // Determine the effective tax rate for the current line item.
//                     // This handles both simple percentage and complex flat/stacked tax types.
//                     let effectiveItemTaxRateDecimal = 0;
//                     if (item.taxes && item.taxes.length > 0 && item.taxType) {
//                         if (item.taxType === 'flat') {
//                             let sumPercent = 0;
//                             item.taxes.forEach(t => sumPercent = Helper.add(sumPercent, t.taxPercentage, afterDecimal));
//                             effectiveItemTaxRateDecimal = Helper.division(sumPercent, 100, afterDecimal);
//                         } else if (item.taxType === 'stacked') {
//                             let multiplier = 1;
//                             item.taxes.forEach(t => multiplier = Helper.multiply(multiplier, Helper.division(Helper.add(t.taxPercentage, 100, afterDecimal), 100, afterDecimal + 4), afterDecimal + 4));
//                             effectiveItemTaxRateDecimal = Helper.sub(multiplier, 1, afterDecimal + 4);
//                         }
//                     } else {
//                         effectiveItemTaxRateDecimal = Helper.division((item.taxPercentage || 0), 100, afterDecimal);
//                     }

//                     const effectiveLineNetBeforeBillDisc = Helper.sub(item.lineTotal, item.lineTaxTotal, afterDecimal);

//                     // Proportionally attribute the bill discount to each line based on its net component.
//                     const proportion = Helper.division(effectiveLineNetBeforeBillDisc, baseForBillDiscount, afterDecimal + 4);
//                     const billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);

//                     // Calculate the new net amount for the line after applying its share of the bill discount.
//                     const newEffectiveLineNet = Helper.roundNum(Helper.sub(effectiveLineNetBeforeBillDisc, billDiscountAttributedToLine, afterDecimal), afterDecimal);
                    
//                     // Recalculate the tax for this line based on its new net amount and effective tax rate.
//                     recalculatedTotalTax = Helper.add(recalculatedTotalTax, Helper.multiply(newEffectiveLineNet, effectiveItemTaxRateDecimal, afterDecimal), afterDecimal);
//                 });
//                 BillTaxTotal = recalculatedTotalTax;
//             } else {
//                 BillTaxTotal = 0; // If no net value, no tax can be generated.
//             }

//             // // Adjust the final subtotal net by the effective bill discount.
//             // finalSubtotalNet = Helper.roundNum(Helper.sub(linesBasePriceTotal, effectiveBillDiscount, afterDecimal), afterDecimal);
//             // finalSubtotalNet = Math.max(0, finalSubtotalNet); // Ensure subtotal doesn't go negative.

//         } else {
//             const baseForBillDiscount = linesTotal;
//             effectiveBillDiscount = getDiscountAmount(baseForBillDiscount, discountAmount, discountType);
//             effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, baseForBillDiscount), afterDecimal);
//         }
//     }



//     const TotalBillDiscount =  Helper.add(effectiveBillDiscount,linesDiscountTotal, afterDecimal)

//     // ################## Bill Total ##################
//     // Calculate the final grand total of the bill.
//     let billTotal = Helper.roundNum( Helper.sub(Helper.add(finalSubtotalNet, BillTaxTotal, afterDecimal) , TotalBillDiscount, afterDecimal),afterDecimal);




//     // ################## Calculate detailed per-line results for display ##################
//     const calculatedLineDetails: CalculatedLineDetail[] = [];
//     intermediateLineDetails.forEach(item => {
//         let lineTotal = item.lineTotal;
//         let lineTax = item.lineTaxTotal;
//         let lineBasePrice = item.lineBasePrice
//         let lineDiscount = item.lineDiscountTotal;
//         let lineTotalDiscount = 0;
//         let lineFinalTotal = 0;


//         if (applyDiscountBeforeTax) {
//             // get Base amount fro the bill Discount 
//             const lineBaseForBillDiscount = Helper.sub(lineTotal, lineTax, afterDecimal)
//             const baseForBillDiscount  = Helper.sub(linesTotal, linesTaxTotal, afterDecimal)

//             // get bill disount propotion for billLine
//             let billDiscountAttributedToLine = 0;
//             if (baseForBillDiscount > 0) {
//                 const proportion = Helper.division(lineBaseForBillDiscount , baseForBillDiscount, afterDecimal + 4);
//                 billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);
//             }

//             //recalculate tax 
//             // Adjust the line's net component and recalculate its tax.
//             const newEffectiveLineNet = Helper.roundNum(Helper.sub(lineBaseForBillDiscount, billDiscountAttributedToLine, afterDecimal), afterDecimal);
//             // Recalculate tax for display based on the new effective net and original tax rules for the line.
//             const taxInput = { taxRate: item.taxPercentage ?? 0, taxes: item.taxes ?? [], taxType: item.taxType ?? '' };
//             const recalculatedLineTaxes = calculateTax(newEffectiveLineNet, taxInput, false, afterDecimal); // Pass false for isInclusiveTax because newEffectiveLineNet is explicitly net
            
//             const newEffectiveLineTax = recalculatedLineTaxes.taxTotal; // Corrected from totalTaxAmount

//             // Sum line-level and attributed bill-level discounts for the total line discount.
//             lineTotalDiscount = Helper.roundNum(Helper.add(lineDiscount, billDiscountAttributedToLine, afterDecimal), afterDecimal);
//             // Calculate the final total for the line.
//             lineFinalTotal = Helper.roundNum(Helper.add(newEffectiveLineNet, newEffectiveLineTax, afterDecimal), afterDecimal);

//             calculatedLineDetails.push({
//                 id: item.id,
//                 net: newEffectiveLineNet,
//                 tax: newEffectiveLineTax,
//                 discount: lineTotalDiscount,
//                 total: lineFinalTotal
//             });

//         } else {
//             // When discounts apply after tax, attribute a portion of the bill discount to each line's gross value.
//             let billDiscountAttributedToLine = 0;
//             // Calculate the line's gross value before the bill discount.

//             // lines total before bill disc
//             const lineGrossBeforeBillDisc = lineTotal //(lineTotal +lineTax - lineDisc)

//             //bill total before bill disc
//             const totalGrossBeforeBillDisc = linesTotal ;
//             if (totalGrossBeforeBillDisc > 0) {
//                 const proportion = Helper.division(lineGrossBeforeBillDisc, totalGrossBeforeBillDisc, afterDecimal + 4);
//                 billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);
//             }

//             // get total line disc = lineDisc(bill line level) + lineDisc(bill level)
//             lineTotalDiscount = Helper.roundNum(Helper.add(lineDiscount, billDiscountAttributedToLine, afterDecimal), afterDecimal);

//             // The final total for the line is its gross before bill discount minus the attributed bill discount.
//             lineFinalTotal = Helper.roundNum(Helper.sub(lineGrossBeforeBillDisc, billDiscountAttributedToLine, afterDecimal), afterDecimal);

//             calculatedLineDetails.push({
//                 id: item.id,
//                 net: lineTotal, // Net remains unchanged in this scenario
//                 tax: lineTax, // Tax remains unchanged in this scenario
//                 discount: lineTotalDiscount,
//                 total: lineFinalTotal
//             });
//         }
//     });

//     return {
//         total: billTotal,
//         tax: BillTaxTotal,
//         discount: Helper.roundNum(Helper.add(linesDiscountTotal, effectiveBillDiscount, afterDecimal), afterDecimal),
//         subtotal: finalSubtotalNet,
//         lineDetails:[]// calculatedLineDetails
//     };
// };

// export const calculateBill = (lineItems: LineItem[],isInclusiveTax: boolean,billDiscountAmount: number,discountPercentage: boolean,applyDiscountBeforeTax: boolean, afterDecimal: number): CalculationResults =>{
    
//     // ################################  get lines totals ################################
//     // --- First pass: Calculate each line's initial tax, discount, and totals ---
//     let LinesTotal = 0;           // Sum of line totals (gross or net+tax)
//     let LinesTaxTotal = 0;        // Sum of taxes from all lines
//     let LinesDiscountTotal = 0;   // Sum of line-level discounts
//     let linesBaseAmountTotal = 0; // Sum of net amounts before tax & after line discount

//     const intermediateLineDetails = lineItems.map(item => {
//       const processedLine = calculateLine(item, isInclusiveTax, applyDiscountBeforeTax, afterDecimal);

//       LinesTotal = Helper.add(LinesTotal, processedLine.lineTotal, afterDecimal);
//       LinesTaxTotal = Helper.add(LinesTaxTotal, processedLine.lineTaxTotal, afterDecimal);
//       LinesDiscountTotal = Helper.add(LinesDiscountTotal, processedLine.lineDiscountTotal, afterDecimal);
//       linesBaseAmountTotal = Helper.add(linesBaseAmountTotal, processedLine.lineBasePrice, afterDecimal);

//       return processedLine;
//     });

//     // ############################ Apply bill-level discount ############################
//     let effectiveBillDiscount = 0;
//     let finalTax = LinesTaxTotal;       // Start with total line tax
//     let finalSubtotalNet = linesBaseAmountTotal; // Sum of net amounts before bill discount

//     const hasBillDiscount = billDiscountAmount > 0 

//     if (hasBillDiscount) {
//          const discountType = discountPercentage == false ? 'amount' : 'rate'
//       if (applyDiscountBeforeTax) {

//         // ----------- effective Bill-Level Discount -----------
//         const baseForBillDiscount = Helper.sub(LinesTotal, LinesTaxTotal, afterDecimal); // net total
//         effectiveBillDiscount = getDiscountAmount(baseForBillDiscount, billDiscountAmount, discountType);

//         // Prevent discount from exceeding base amount
//         effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, baseForBillDiscount), afterDecimal);

//         // -------------- recalculate Total Tax --------------
//         let recalculatedTotalTax = 0;
//         if (baseForBillDiscount > 0) {
//           // Recalculate tax on discounted net amounts proportionally for each line
//           for (const item of intermediateLineDetails) {

//             const itemTaxInput: Tax = {taxRate: item.taxPercentage ?? 0,taxes: item.taxes ?? [], taxType: item.taxType ?? '', };
//             const hasItemTax        = item.taxId !== undefined && item.taxId !== null && item.taxId !== '';

//             if (!hasItemTax) {
//               continue; // Skip if no tax
//             }

//             // Calculate effective tax rate 
//             let effectiveItemTaxRateDecimal = 0;

//             if (itemTaxInput.taxes && itemTaxInput.taxes.length > 0 && itemTaxInput.taxType) {
//               if (itemTaxInput.taxType === 'flat') {
//                 const sumPercent = itemTaxInput.taxes.reduce((sum, t) => sum + t.taxPercentage, 0);
//                 effectiveItemTaxRateDecimal = sumPercent / 100;
//               } else if (itemTaxInput.taxType === 'stacked') {
//                 let multiplier = 1;
//                 for (const t of itemTaxInput.taxes) {
//                   multiplier *= (1 + t.taxPercentage / 100);
//                 }
//                 effectiveItemTaxRateDecimal = multiplier - 1;
//               }
//             } else {
//               effectiveItemTaxRateDecimal = (item.taxPercentage ?? 0) / 100;
//             }

//             // Calculate effective discount on the line
//             const lineBaseTotalBeforeBillDisc = Helper.sub(item.lineTotal, item.lineTaxTotal, afterDecimal);
//             const proportion = Helper.division(lineBaseTotalBeforeBillDisc, baseForBillDiscount, afterDecimal + 4);
//             const billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);

//             // Calculate effective line total before tax
//             const newEffectiveLineNet = Helper.roundNum(Helper.sub(lineBaseTotalBeforeBillDisc, billDiscountAttributedToLine, afterDecimal), afterDecimal);

//             // Calculate effective line tax
//             recalculatedTotalTax = Helper.add( recalculatedTotalTax, Helper.multiply(newEffectiveLineNet, effectiveItemTaxRateDecimal, afterDecimal), afterDecimal );
//           }

//           finalTax = recalculatedTotalTax;
//         } else {
//           finalTax = 0; // No net base, no tax
//         }
//       } else {
//         // Bill discount applies AFTER tax, so discount is on gross amount

//         const baseForBillDiscount = LinesTotal;

//         effectiveBillDiscount = getDiscountAmount( baseForBillDiscount,billDiscountAmount, discountType);
//         effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, baseForBillDiscount), afterDecimal);
//       }
//     }

//     // Calculate total discount and final total after discounts and taxes
//     const finalDiscount = Helper.add(effectiveBillDiscount, LinesDiscountTotal);
//     const finalTotal = Helper.roundNum(
//       Helper.sub(Helper.add(finalSubtotalNet, finalTax, afterDecimal), effectiveBillDiscount, afterDecimal),
//       afterDecimal
//     );


//     // ##################### lines Detailes after Bill-level discount #####################
//     // --- Third pass: Prepare detailed per-line output with bill-level discount allocation ---
//     const calculatedLineDetails: CalculatedLineDetail[] = [];

//     for (const item of intermediateLineDetails) {
//       let lineTaxTotal = item.lineTaxTotal;
//       let lineLevelDiscountTotal = item.lineDiscountTotal;
//       let lineFinalDiscount = lineLevelDiscountTotal;
//       let lineFinalTotal = item.lineTotal;

//       if (hasBillDiscount) {
//         if (applyDiscountBeforeTax) {
//           // Calculate bill discount proportion for each line and recalc tax on discounted net

//           const lineBaseBeforeBillDisc = Helper.sub(item.lineTotal, item.lineTaxTotal, afterDecimal);
//           const billBaseBeforeBillDisc = Helper.sub(LinesTotal, LinesTaxTotal, afterDecimal);

//           let billDiscountAttributedToLine = 0;

//           if (billBaseBeforeBillDisc > 0) {
//             const proportion = Helper.division(lineBaseBeforeBillDisc, billBaseBeforeBillDisc, afterDecimal + 4);
//             billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);
//           }

//           const newEffectiveLineNet = Helper.roundNum(Helper.sub(lineBaseBeforeBillDisc, billDiscountAttributedToLine, afterDecimal),afterDecimal);
//           const tax: Tax = {taxRate: item.taxPercentage ?? 0, taxes: item.taxes ?? [], taxType: item.taxType ?? ''}
//           // Recalculate tax on discounted net
//           const recalculatedLineTaxes = calculateTax(newEffectiveLineNet, tax, false, afterDecimal);
//           const newEffectiveLineTax = recalculatedLineTaxes.taxTotal;

//           lineFinalDiscount = Helper.roundNum(Helper.add(lineFinalDiscount, billDiscountAttributedToLine, afterDecimal), afterDecimal);

//           lineTaxTotal = Helper.roundNum(newEffectiveLineTax, afterDecimal);
//           lineFinalTotal = Helper.roundNum(newEffectiveLineNet + newEffectiveLineTax, afterDecimal);
//         } else {
//           // Discount after tax, so bill discount applied proportionally on gross amounts

//           const proportion = Helper.division(item.lineTotal, LinesTotal, afterDecimal + 4);
//           const billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);

//           lineFinalDiscount = Helper.roundNum(Helper.add(lineFinalDiscount, billDiscountAttributedToLine, afterDecimal),afterDecimal);
//           lineFinalTotal = Helper.roundNum(item.lineTotal - billDiscountAttributedToLine, afterDecimal);
//         }
//       }

//       // Compose final line detail
//       calculatedLineDetails.push({
//         id: item.id,
//         net: Helper.roundNum(lineFinalTotal - lineTaxTotal, afterDecimal),
//         tax: Helper.roundNum(lineTaxTotal, afterDecimal),
//         discount: lineFinalDiscount,
//         total: lineFinalTotal,
//       });
//     }

//     // Compose final result summary
//     return {
//       total: finalTotal,
//       tax: finalTax,
//       discount: finalDiscount,
//       subtotal: finalSubtotalNet,
//       lineDetails: calculatedLineDetails,
//     };
//   }

