import { Helper } from "@src/utilts/helper";
import { TaxModel } from "./InvoiceLine";

// ####################### Tax functions #######################

/**
 * Represents the results of a detailed tax calculation for a line item.
 */
interface CalculatedTaxes {
    amountBeforeTax: number; /** The calculated net amount after accounting for inclusive taxes. */
    totalTaxAmount: number;  /** The total calculated tax amount for the line item. */
    totalTaxPercentage: number;  /** The sum of all tax percentages (for flat tax) or a conceptual sum (for stacked tax). */
    detailedTaxes: TaxModel[] |[]; /** The array of `TaxModel` objects, with `taxAmount` populated for each individual tax. */
}

/**
 * Calculates the base (net) price from a given gross amount when taxes are flat and inclusive.
 * Formula: `net = gross / (1 + sum_of_percentages / 100)`
 *
 * @param grossAmount The total amount including flat taxes.
 * @param taxes An array of `TaxModel` objects representing flat taxes.
 * @param afterDecimal The number of decimal places for calculations.
 * @returns The calculated base (net) price.
 */
const getBasePriceFromGrossForFlatTaxes = (grossAmount: number, taxes: TaxModel[], afterDecimal: number): number => {
    let flatTaxSumPercentage = 0;
    taxes.forEach(element => { flatTaxSumPercentage = Helper.add(flatTaxSumPercentage, element.taxPercentage, afterDecimal); });
    const taxFactor = Helper.division(Helper.add(100, flatTaxSumPercentage, afterDecimal), 100, afterDecimal);
    const total =  Helper.division(grossAmount, taxFactor, afterDecimal);
    return Helper.roundNum(total,afterDecimal)
};

/**
 * Calculates the base (net) price from a given gross amount when taxes are stacked and inclusive.
 * Formula: `net = gross / ((1 + tax1/100) * (1 + tax2/100) * ...)`
 *
 * @param grossAmount The total amount including stacked taxes.
 * @param taxes An array of `TaxModel` objects representing stacked taxes.
 * @param afterDecimal The number of decimal places for calculations.
 * @returns The calculated base (net) price.
 */
const getBasePriceFromGrossForStackedTaxes = (grossAmount: number, taxes: TaxModel[],afterDecimal: number): number => {
    let multiplier = 1;
    taxes.forEach(element => {multiplier = Helper.multiply(multiplier, Helper.division(Helper.add(element.taxPercentage, 100, afterDecimal), 100, afterDecimal), afterDecimal);});
    const total = Helper.division(grossAmount, multiplier, afterDecimal);
    return Helper.roundNum(total,afterDecimal)
};


/**
 * Calculates tax amounts for 'flat' type taxes for a given line item amount.
 *
 * @param lineAmount The base amount for tax calculation (could be original or discounted).
 * @param taxes An array of `TaxModel` objects for flat taxes.
 * @param isInclusiveTax True if `lineAmount` already includes tax; false otherwise.
 * @param afterDecimal The number of decimal places for calculations.
 * @returns A `CalculatedTaxes` object.
 */
const calculateFlatTaxesForAmount = (lineAmount: number,taxes: TaxModel[],isInclusiveTax: boolean,afterDecimal: number): CalculatedTaxes => {
    let currentBaseAmount = lineAmount; // This will be the net amount for tax calculation
    let totalTaxAmount = 0;
    let totalTaxPercentage = 0;
    const detailedTaxes: TaxModel[] = [...taxes]; // Deep copy

    if (isInclusiveTax) {
        currentBaseAmount = getBasePriceFromGrossForFlatTaxes(lineAmount, detailedTaxes, afterDecimal);
    }

    detailedTaxes.forEach(tax => {
        const taxAmount = Helper.multiply(currentBaseAmount, Helper.division(tax.taxPercentage, 100, afterDecimal), afterDecimal);
        tax.taxAmount = taxAmount;
        totalTaxPercentage = Helper.add(totalTaxPercentage, tax.taxPercentage, afterDecimal);
        totalTaxAmount = Helper.add(totalTaxAmount, taxAmount, afterDecimal);
    });

    const finalNetAmount = isInclusiveTax ? currentBaseAmount : lineAmount;

    return {
        amountBeforeTax: finalNetAmount,
        totalTaxAmount: Helper.roundNum(totalTaxAmount, afterDecimal),
        totalTaxPercentage: Helper.roundNum(totalTaxPercentage, afterDecimal),
        detailedTaxes: detailedTaxes
    };
};

/**
 * Calculates tax amounts for 'stacked' type taxes for a given line item amount.
 *
 * @param lineAmount The base amount for tax calculation (could be original or discounted).
 * @param taxes An array of `TaxModel` objects for stacked taxes.
 * @param isInclusiveTax True if `lineAmount` already includes tax; false otherwise.
 * @param afterDecimal The number of decimal places for calculations.
 * @returns A `CalculatedTaxes` object.
 */
const calculateStackedTaxesForAmount = ( lineAmount: number, taxes: TaxModel[], isInclusiveTax: boolean, afterDecimal: number): CalculatedTaxes => {
    let currentBaseAmount = lineAmount; // This will be the net amount for tax calculation
    let totalTaxAmount = 0;
    let totalTaxPercentage = 0; // Sum of percentages for display
    const detailedTaxes: TaxModel[] =[...taxes]; // Deep copy

    if (isInclusiveTax) {
        currentBaseAmount = getBasePriceFromGrossForStackedTaxes(lineAmount, detailedTaxes, afterDecimal);
    }

    let runningTotalForStacked = currentBaseAmount; // Base for the first stacked tax
    detailedTaxes.forEach(tax => {
        const taxAmount = Helper.multiply(runningTotalForStacked, Helper.division(tax.taxPercentage, 100, afterDecimal), afterDecimal);
        tax.taxAmount = taxAmount;
        totalTaxPercentage = Helper.add(totalTaxPercentage, tax.taxPercentage, afterDecimal); // Sum for display
        totalTaxAmount = Helper.add(totalTaxAmount, taxAmount, afterDecimal);
        runningTotalForStacked = Helper.add(runningTotalForStacked, taxAmount, afterDecimal); // Add tax to base for next stacked tax
    });

    const finalNetAmount = isInclusiveTax ? currentBaseAmount : lineAmount;

    return {
        amountBeforeTax: finalNetAmount,
        totalTaxAmount: Helper.roundNum(totalTaxAmount, afterDecimal),
        totalTaxPercentage: Helper.roundNum(totalTaxPercentage, afterDecimal),
        detailedTaxes: detailedTaxes
    };
};


/**
 * Dispatches to the appropriate tax calculation function based on `taxType`.
 * If no `taxes` array or `taxType` is specified, it assumes a single `lineTaxRate`.
 *
 * @param lineAmount The base amount for tax calculation (could be original or discounted).
 * @param item The original LineItem, used to access `taxes`, `taxType`, and `lineTaxRate`.
 * @param isInclusiveTax True if `lineAmount` already includes tax; false otherwise.
 * @param afterDecimal The number of decimal places for calculations.
 * @returns A `CalculatedTaxes` object.
 */
const calculateTaxesForLineItem = (lineAmount: number,item: LineItem, isInclusiveTax: boolean,afterDecimal: number): CalculatedTaxes => {
    if (item.taxes && item.taxes.length > 0 && item.taxType) {
        if (item.taxType === 'flat') {
            return calculateFlatTaxesForAmount(lineAmount, item.taxes, isInclusiveTax, afterDecimal);
        } else if (item.taxType === 'stacked') {
            return calculateStackedTaxesForAmount(lineAmount, item.taxes, isInclusiveTax, afterDecimal);
        }
    }

    // Fallback if no specific tax type or taxes array is provided, use single lineTaxRate
    const itemTaxRateDecimal = (item.lineTaxRate || 0) / 100;
    let netAmount = lineAmount;
    let totalTaxAmount = 0;

    if (isInclusiveTax) {
        totalTaxAmount = lineAmount * (itemTaxRateDecimal / (1 + itemTaxRateDecimal));
        netAmount = lineAmount - totalTaxAmount;
    } else {
        totalTaxAmount = lineAmount * itemTaxRateDecimal;
    }

    let taxes = []
    if(item.lineTaxRate){
       const t = new TaxModel()
        t.taxPercentage = item.lineTaxRate
        t. taxAmount =  Helper.roundNum(totalTaxAmount, afterDecimal) 
        taxes.push(t)
    }
    

    return {
        amountBeforeTax: Helper.roundNum(netAmount, afterDecimal),
        totalTaxAmount: Helper.roundNum(totalTaxAmount, afterDecimal),
        totalTaxPercentage: Helper.roundNum(item.lineTaxRate || 0, afterDecimal),
        detailedTaxes: taxes};
};



/**
 * Represents a single line item in a bill.
 */
export interface LineItem {
    /** Unique identifier for the line item. */
    id: string;
    /** A descriptive name for the product or service. */
    description: string;
    /** The base monetary amount of the line item before any discounts or taxes. */
    amount: number;
    /** The percentage discount rate applied specifically to this line item (e.g., 10 for 10%). */
    lineDiscountRate: number;
    /** A fixed monetary discount amount applied specifically to this line item. */
    lineDiscountAmount: number;
    /** The percentage tax rate applicable to this line item if no complex `taxes` array is used. */
    lineTaxRate?: number;
    /** An optional array of `TaxModel` objects if multiple taxes are applied to this line item. */
    taxes?: TaxModel[];
    /** Specifies how taxes in the `taxes` array are applied: 'flat' (summed) or 'stacked' (compounded). Can be empty if `taxes` array is not used. */
    taxType?: string|'flat' | 'stacked' | '';
}

/**
 * Represents the detailed calculated financial breakdown for a single line item.
 */
interface CalculatedLineDetail {
    /** Unique identifier for the line item. */
    id: string;
    /** The net value of the item after all applicable discounts (line-level and proportional bill-level), before its specific tax. */
    net: number;
    /** The calculated tax amount specifically for this line item. */
    tax: number;
    /** The total discount applied to this line item, combining line-level and its attributed portion of the bill-level discount. */
    discount: number;
    /** The final total monetary amount for this line item, after all calculations. */
    total: number;
}

/**
 * Represents the comprehensive results of the bill calculation.
 */
interface CalculationResults {
    /** The final grand total monetary amount of the entire bill. */
    total: number;
    /** The sum of all tax amounts across all line items in the bill. */
    tax: number;
    /** The sum of all discounts applied (line-level and bill-level) across the entire bill. */
    discount: number;
    /** The sum of net values from all line items after all applicable discounts, before their respective taxes. This represents the core value of goods/services. */
    subtotal: number;
    /** An array containing the detailed financial breakdown for each individual line item. */
    lineDetails: CalculatedLineDetail[];
}

/**
 * Internal interface to hold temporary calculation results for each line item during the first pass.
 */
interface IntermediateLineDetail extends LineItem {
    _lineNetComponent: number; // Net value of the item before bill-level discount.
    _lineTaxComponent: number; // Tax component of the item before bill-level discount.
    _effectiveLineDiscount: number; // Effective line-level discount applied.
    _taxes: TaxModel[];
    _taxPercentage: number;
}






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
const getDiscountAmount = (base: number, rate: number, amount: number, type: 'rate' | 'amount'): number => {
    let discount = 0;
    if (type === 'rate') {
        discount = base * (rate / 100);
    } else { // type === 'amount'
        discount = amount;
    }
    return Math.min(discount, base); // Ensure discount never exceeds the base amount
};

/**
 * Processes a single line item to determine its initial net component, tax component,
 * and effective line-level discount based on whether discounts apply before or after tax,
 * and whether complex tax structures are used.
 *
 * @param item The `LineItem` object to process.
 * @param isInclusiveTax A boolean flag: `true` if line item `amount`s already include their respective taxes; `false` if taxes are added on top.
 * @param applyDiscountBeforeTax A boolean flag: `true` if line-level discounts are applied before tax calculation; `false` if applied after.
 * @returns An `IntermediateLineDetail` object with calculated components.
 */

export const calculateLine = ( item: LineItem, isInclusiveTax: boolean, applyDiscountBeforeTax: boolean, afterDecimal: number): IntermediateLineDetail => {
    
    const currentLineAmount = item.amount;
    let lineNetComponent = 0;
    let lineTaxComponent = 0;
    let lineTaxRate = 0;
    let taxes:TaxModel[] = [];
    let effectiveLineDiscountForThisLine = 0;

    if (applyDiscountBeforeTax) {
        // SCENARIO: Line-level discounts applied BEFORE tax

        let initialNetPrice: number = currentLineAmount ; 

        if (isInclusiveTax) {
            let originalCalculatedTaxes: CalculatedTaxes;
            // Step 1: Calculate the price before tax (Net Price) from the currentLineAmount
            originalCalculatedTaxes = calculateTaxesForLineItem(currentLineAmount, item, isInclusiveTax, afterDecimal);
            initialNetPrice = originalCalculatedTaxes.amountBeforeTax; // This is the $10 in your example
        } 

       
        // Step 2: Calculate the discountTotal. The discount is applied to the initial Net Price.
        effectiveLineDiscountForThisLine = getDiscountAmount(initialNetPrice,  item.lineDiscountRate, item.lineDiscountAmount, item.lineDiscountRate > 0 ? 'rate' : 'amount');

        // Step 3: Calculate Price After Discount (and before tax)
        lineNetComponent = Helper.roundNum(initialNetPrice - effectiveLineDiscountForThisLine, afterDecimal); // This is the $8 in your example

        // Step 4: Calculate the taxTotal. The tax is applied to the Price After Discount.
        // We now treat the `lineNetComponent` (Price After Discount) as an exclusive base for tax calculation.
        const taxesOnDiscountedNet = calculateTaxesForLineItem(lineNetComponent, item, false, afterDecimal);
        lineTaxComponent = taxesOnDiscountedNet.totalTaxAmount; // This is the $0.80 in your example
        lineTaxRate = taxesOnDiscountedNet.totalTaxPercentage
        taxes = taxesOnDiscountedNet.detailedTaxes
    } else {
        // SCENARIO: Line-level discounts applied AFTER tax
        // 1. Determine net and tax components of the original line amount first.
        //    Tax is calculated on the original amount.
        const calculatedTaxes = calculateTaxesForLineItem(currentLineAmount,item,isInclusiveTax,afterDecimal);
        lineNetComponent = calculatedTaxes.amountBeforeTax;
        lineTaxComponent = calculatedTaxes.totalTaxAmount;
        lineTaxRate = calculatedTaxes.totalTaxPercentage
        taxes = calculatedTaxes.detailedTaxes

        // 2. Calculate line-level discount. It applies to the amount *including* its tax component.
        const baseForLineDiscount = Helper.add(currentLineAmount, (isInclusiveTax ? 0 : lineTaxComponent), afterDecimal);
        effectiveLineDiscountForThisLine = getDiscountAmount(baseForLineDiscount,item.lineDiscountRate,item.lineDiscountAmount, item.lineDiscountRate > 0 ? 'rate' : 'amount');
    }

    return {
        ...item,
        _lineNetComponent: Helper.roundNum(lineNetComponent, afterDecimal),
        _lineTaxComponent: Helper.roundNum(lineTaxComponent, afterDecimal),
        _effectiveLineDiscount: Helper.roundNum(effectiveLineDiscountForThisLine, afterDecimal),
        _taxes: taxes,
        _taxPercentage: lineTaxRate
    };
};



/**
 * Calculates the total, tax, and discount for a bill with multiple line items,
 * supporting per-line tax rates, line-level discounts, and a global bill-level discount.
 * The calculation order for discounts and taxes is determined by the `applyDiscountBeforeTax` flag.
 *
 * This function handles two primary scenarios for discount/tax application:
 *
 * **Scenario 1: `applyDiscountBeforeTax` is `true`**
 * - **Line-level discounts** are applied first to the original `lineItem.amount`.
 * - **Tax** for each line is then calculated on this *discounted* amount (or extracted if `isInclusiveTax` is true).
 * - The **bill-level discount** is applied to the sum of *net values* (after line discounts, before taxes) across all lines.
 * - The **total tax** is *recalculated* proportionally based on the further reduced net values after the bill-level discount.
 *
 * **Scenario 2: `applyDiscountBeforeTax` is `false`**
 * - **Tax** for each line is calculated on the *original* `lineItem.amount` (or extracted if `isInclusiveTax` is true).
 * - **Line-level discounts** are applied to the total line amount *including its tax component*.
 * - The **bill-level discount** is applied to the grand total (sum of net + tax) after line discounts.
 * - The initial tax calculation remains unchanged; the bill discount reduces the final gross total.
 *
 * @param lineItems An array of `LineItem` objects representing individual products or services.
 * @param isInclusiveTax A boolean flag: `true` if line item `amount`s already include their respective taxes; `false` if taxes are added on top.
 * @param billDiscVal The value of the bill-level discount. This can be a rate or an amount depending on `billDiscType`.
 * @param billDiscType The type of the bill-level discount: 'rate' (percentage) or 'amount' (fixed value).
 * @param applyDiscountBeforeTax A global boolean flag: `true` if all discounts (line and bill) should be applied before tax calculations; `false` if discounts are applied after tax.
 * @returns A `CalculationResults` object containing the final calculated totals and per-line details.
 */
export const calculateBill = (lineItems: LineItem[],isInclusiveTax: boolean,discountAmount: number,discountRate:number,applyDiscountBeforeTax: boolean,afterDecimal: number): CalculationResults => {
    
    let totalNetValueFromLines = 0;
    let totalTaxFromLines = 0;
    let totalLineDiscountsApplied = 0;
     afterDecimal = afterDecimal;

    // First pass: Process each line item to get initial net, tax, and line discount
    const intermediateLineDetails: IntermediateLineDetail[] = lineItems.map(item => {
        const processedItem = calculateLine(item, isInclusiveTax, applyDiscountBeforeTax, afterDecimal);

        totalLineDiscountsApplied = Helper.add(totalLineDiscountsApplied, processedItem._effectiveLineDiscount, afterDecimal);
        totalNetValueFromLines = Helper.add(totalNetValueFromLines, processedItem._lineNetComponent, afterDecimal);
        totalTaxFromLines = Helper.add(totalTaxFromLines, processedItem._lineTaxComponent, afterDecimal);

        return processedItem;
    });

    let effectiveBillDiscount = 0;
    let finalTax = totalTaxFromLines;
    let finalSubtotalNet = totalNetValueFromLines;

    // Second pass: Apply Bill-Level Discount
    if (applyDiscountBeforeTax) {
        const baseForBillDiscount = totalNetValueFromLines;

        effectiveBillDiscount = getDiscountAmount(baseForBillDiscount,discountRate,discountAmount, discountRate > 0 ? 'rate' : 'amount');
        effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, baseForBillDiscount), afterDecimal);

        let recalculatedTotalTax = 0;
        if (totalNetValueFromLines > 0) { // Avoid division by zero
            intermediateLineDetails.forEach(item => {
                // If the item had a lineTaxRate, use it; otherwise, sum up percentages from its tax models if they exist.
                // This part ensures that the proportional recalculation of tax for the bill-level discount
                // correctly attributes the tax based on the *effective* tax rate of the item.
                let effectiveItemTaxRateDecimal = 0;
                if (item.taxes && item.taxes.length > 0 && item.taxType) {
                    // For re-calculation, we need to know the effective combined percentage for the line
                    if (item.taxType === 'flat') {
                        let sumPercent = 0;
                        item.taxes.forEach(t => sumPercent = Helper.add(sumPercent, t.taxPercentage, afterDecimal));
                        effectiveItemTaxRateDecimal = sumPercent / 100;
                    } else if (item.taxType === 'stacked') {
                        // For stacked, the effective percentage for a gross amount is derived from the multiplier
                        let multiplier = 1;
                        item.taxes.forEach(t => multiplier = Helper.multiply(multiplier, Helper.division(Helper.add(t.taxPercentage, 100, afterDecimal), 100, afterDecimal), afterDecimal + 4));
                        effectiveItemTaxRateDecimal = multiplier - 1;
                    }
                } else {
                    effectiveItemTaxRateDecimal = (item.lineTaxRate || 0) / 100;
                }

                const effectiveLineNetBeforeBillDisc = item._lineNetComponent;

                const proportion = Helper.division(effectiveLineNetBeforeBillDisc, totalNetValueFromLines, afterDecimal + 4);
                const billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);

                const newEffectiveLineNet = Helper.roundNum(effectiveLineNetBeforeBillDisc - billDiscountAttributedToLine, afterDecimal);
                recalculatedTotalTax = Helper.add(recalculatedTotalTax, Helper.multiply(newEffectiveLineNet, effectiveItemTaxRateDecimal, afterDecimal), afterDecimal);
            });
            finalTax = recalculatedTotalTax;
        } else {
            finalTax = 0;
        }

        finalSubtotalNet = Helper.roundNum(totalNetValueFromLines - effectiveBillDiscount, afterDecimal);
        finalSubtotalNet = Math.max(0, finalSubtotalNet);

    } else {
        const baseForBillDiscount = Helper.add(totalNetValueFromLines, totalTaxFromLines, afterDecimal);

        effectiveBillDiscount = getDiscountAmount(baseForBillDiscount, discountRate, discountAmount, discountRate > 0 ? 'rate' : 'amount');
        effectiveBillDiscount = Helper.roundNum(Math.min(effectiveBillDiscount, baseForBillDiscount), afterDecimal);

        // finalTax and finalSubtotalNet remain as initially calculated in this scenario
    }

    let finalTotal = Helper.roundNum(
        Helper.add(finalSubtotalNet, finalTax, afterDecimal) - (applyDiscountBeforeTax ? 0 : effectiveBillDiscount),
        afterDecimal
    );
    finalTotal = Math.max(0, finalTotal);

    // Third pass: Calculate detailed per-line results for display
    const calculatedLineDetails: CalculatedLineDetail[] = [];
    intermediateLineDetails.forEach(item => {
        let lineNetComponent = item._lineNetComponent;
        let lineTaxComponent = item._lineTaxComponent;
        let effectiveLineDiscountForThisLine = item._effectiveLineDiscount;
        let lineTotalDiscount = 0;
        let lineFinalTotal = 0;

        if (applyDiscountBeforeTax) {
            let billDiscountAttributedToLine = 0;
            if (totalNetValueFromLines > 0) {
                const proportion = Helper.division(lineNetComponent, totalNetValueFromLines, afterDecimal + 4);
                billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);
            }

            const newEffectiveLineNet = Helper.roundNum(lineNetComponent - billDiscountAttributedToLine, afterDecimal);
            // Recalculate tax for display based on the new effective net and original tax rules for the line
            const recalculatedLineTaxes = calculateTaxesForLineItem(newEffectiveLineNet, item, false, afterDecimal); // Pass false for isInclusiveTax because newEffectiveLineNet is explicitly net
            const newEffectiveLineTax = recalculatedLineTaxes.totalTaxAmount;

            lineTotalDiscount = Helper.roundNum(Helper.add(effectiveLineDiscountForThisLine, billDiscountAttributedToLine, afterDecimal), afterDecimal);
            lineFinalTotal = Helper.roundNum(Helper.add(newEffectiveLineNet, newEffectiveLineTax, afterDecimal), afterDecimal);

            calculatedLineDetails.push({
                id: item.id,
                net: newEffectiveLineNet,
                tax: newEffectiveLineTax,
                discount: lineTotalDiscount,
                total: lineFinalTotal
            });

        } else {
            let billDiscountAttributedToLine = 0;
            const lineGrossBeforeBillDisc = Helper.roundNum(Helper.add(lineNetComponent, lineTaxComponent, afterDecimal) - effectiveLineDiscountForThisLine, afterDecimal);

            if (Helper.add(totalNetValueFromLines, totalTaxFromLines, afterDecimal) > 0) {
                const proportion = Helper.division(lineGrossBeforeBillDisc, Helper.add(totalNetValueFromLines, totalTaxFromLines, afterDecimal), afterDecimal + 4);
                billDiscountAttributedToLine = Helper.multiply(effectiveBillDiscount, proportion, afterDecimal);
            }

            lineTotalDiscount = Helper.roundNum(Helper.add(effectiveLineDiscountForThisLine, billDiscountAttributedToLine, afterDecimal), afterDecimal);
            lineFinalTotal = Helper.roundNum(lineGrossBeforeBillDisc - billDiscountAttributedToLine, afterDecimal);

            calculatedLineDetails.push({
                id: item.id,
                net: lineNetComponent,
                tax: lineTaxComponent,
                discount: lineTotalDiscount,
                total: lineFinalTotal
            });
        }
    });

    return {
        total: finalTotal,
        tax: finalTax,
        discount: Helper.roundNum(Helper.add(totalLineDiscountsApplied, effectiveBillDiscount, afterDecimal), afterDecimal),
        subtotal: finalSubtotalNet,
        lineDetails: calculatedLineDetails
    };
};






























// type Discount = { type: 'amount'; value: number } | { type: 'percent'; value: number };
// type ResultItem = {
//     name: string;
//     baseBeforeDiscount: number;
//     lineDiscount: number;
//     baseAfterLineDiscount: number;
//     billLevelDiscount: number;
//     baseAfterAllDiscounts: number;
//     taxAmount: number;
//     finalTotal: number;
//   }

// type LineItem = {
//   name: string;
//   totalInclTax: number;
//   taxRate: number;
//   lineDiscount?: Discount;
// };

// type InvoiceInput = {
//   isInclusive: boolean;
//   totalBillLevelDiscount?: Discount;
//   lines: LineItem[];
// };



// function applyDiscount(base: number, discount?: Discount): number {
//     //get discount as amount 
//     if (!discount) return 0;  // if discount is empty 
//     return discount.type === 'percent'
//       ? (discount.value / 100) * base //if discount percentage
//       : discount.value;               //if discount amount
//   }

//   export function calculateInvoice(input: InvoiceInput ): {
//     items: ResultItem[];
//     summary: {
//       totalBase: number;
//       totalTax: number;
//       lineDiscountTotal: number;
//       billLevelDiscountTotal: number;
//       finalTotal: number;
//     };
//   } {
//     const { isInclusive, lines, totalBillLevelDiscount } = input;
    
  
//     // Step 1: Convert to base (before tax) values    
//     const bases = lines.map(l =>
//       isInclusive ? l.totalInclTax / (1 + l.taxRate) : l.totalInclTax
//     );
  
//     // Step 2: Line-level discounts
//     const lineDiscounts = lines.map((line, i) =>
//       applyDiscount(bases[i], line.lineDiscount)
//     );
//     const baseAfterLineDiscounts = bases.map((b, i) => b - lineDiscounts[i]);

//     // Step 3: Compute bill-level discount total
//     const subtotal = baseAfterLineDiscounts.reduce((sum, b) => sum + b, 0);
//     const billLevelDiscountTotal = applyDiscount(subtotal, totalBillLevelDiscount);

     
//     // Step 4: Allocate bill-level discount proportionally
//     const billLevelDiscounts = baseAfterLineDiscounts.map(base =>
//         subtotal > 0 ? (base / subtotal) * billLevelDiscountTotal : 0
//     );
    
  
//     // Step 5: Compute tax and totals
//     const items: ResultItem[] = lines.map((line, i) => {
//       const baseBefore = bases[i];
//       const lineDiscount = lineDiscounts[i];
//       const baseAfterLine = baseBefore - lineDiscount;
//       const billDiscount = billLevelDiscounts[i];
//       const baseAfterAllDiscounts = baseAfterLine - billDiscount;
//       const taxAmount = baseAfterAllDiscounts * line.taxRate;
//       const finalTotal = baseAfterAllDiscounts + taxAmount;
  
//       return {
//         name: line.name,
//         baseBeforeDiscount: baseBefore,
//         lineDiscount,
//         baseAfterLineDiscount: baseAfterLine,
//         billLevelDiscount: billDiscount,
//         baseAfterAllDiscounts,
//         taxAmount,
//         finalTotal
//       };
//     });
  
//    // Step 6: Build summary
//    const summary = {
//     totalBase: items.reduce((sum, i) => sum + i.baseAfterAllDiscounts, 0),
//     totalTax: items.reduce((sum, i) => sum + i.taxAmount, 0),
//     lineDiscountTotal: lineDiscounts.reduce((sum, d) => sum + d, 0),
//     billLevelDiscountTotal,
//     finalTotal: items.reduce((sum, i) => sum + i.finalTotal, 0),
//     };
    
//     return { items, summary };
//   }
  