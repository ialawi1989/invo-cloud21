import { ResponseData } from "@src/models/ResponseData";
import { Invoice } from "@src/models/account/Invoice";
import { InvoiceLine } from "@src/models/account/InvoiceLine";
import { Company } from "@src/models/admin/company";
import { RedisClient } from "@src/redisClient";
import { ProductRepo } from "../app/product/product.repo";
import { AccountsRepo } from "../app/accounts/account.repo";
import { DB } from "@src/dbconnection/dbconnection";
import { Helper } from "@src/utilts/helper";
import { InvoiceRepo } from "../app/accounts/invoice.repo";
import { CompanyRepo } from "../admin/company.repo";
import { EmployeeSchaduleRepo } from "../admin/employeeSchedule.repo";
import { PaymnetMethodRepo } from "../app/accounts/paymentMethod.repo";
import { Customer } from "@src/models/account/Customer";
import { CustomerRepo } from "../app/accounts/customer.repo";
import { PaymentRepo } from "./pament.repo";
import { SocketInvoiceRepo } from "../socket/invoice.socket";
import { SocketEstimateRepo } from "../socket/Estimate.socket";
import { InvoiceLineOption } from "@src/models/account/invoiceLineOption";
import { OptionRepo } from "../app/product/option.repo";
import { ServiceRepo } from "../admin/services.repo";
import { BranchesRepo } from "../admin/branches.repo";
import { TablesRepo } from "../app/settings/tables.repo";

import { PoolClient } from "pg";
import moment from "moment-timezone";
import { Estimate } from "@src/models/account/Estimate";
import { EstimateLine } from "@src/models/account/EstimateLine";
import { EstimateRepo } from "../app/accounts/estimate.repo";
import { ValidationException } from "@src/utilts/Exception";
import { ShopRepo } from "./shop.repo";
import { ShopperRepo } from "./shopper.repo";
import { point, distance } from '@turf/turf';
import crypto from "crypto";
import { AccountingRepository } from "@src/routes/v1/promotions/accounting/accounting.data";
import { PromotionsPointsProvider } from "@src/routes/v1/promotions/promotions-point/promotions-point.business";
import { PromotionsPointsRepository } from "@src/routes/v1/promotions/promotions-point/promotions-point.data";
import { PromotionsRepository } from "@src/routes/v1/promotions/promotions.data";
import { InvoicePaymentRepo } from "../app/accounts/invoicePayment.repo";
import { TriggerQueue } from "../triggers/triggerQueue";
import { CouponProvider } from "@src/routes/v1/promotions/coupon/coupon.business";
export class CartRepo {

    public static async getCompanyPrefrences(companyId: string) {
        try {


            const query = {
                text: `SELECT "isInclusiveTax" ,"template"->>'hideOutOfStocks' as "hideOutOfStocks" ,("template"->>'enforceServiceSelection')::boolean AS "enforceServiceSelection", ("template"->>'serviceMenus')::jsonb AS "serviceMenus" FROM "Companies"
                      left join "WebSiteBuilder" on "WebSiteBuilder"."companyId" = "Companies".id  and "WebSiteBuilder"."type" = 'ThemeSettings'
                      where "Companies".id = $1`,
                values: [companyId]
            }

            const companyData = await DB.excu.query(query.text, query.values);
            return companyData.rows[0];
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async createCart(data: any, company: Company, loggedInUser: any | null = null) {
        try {
            let companyData = await this.getCompanyPrefrences(company.id);
            if (!companyData) throw new Error("Company not found")


            let cart: Invoice | null = new Invoice();
            let branchId = data.branchId != null && data.branchId != "" ? data.branchId : null;
            let tableId = data.tableId != null && data.tableId != "" ? data.tableId : null;
            let serviceName = data.serviceName;
            let addressKey = data.addressKey;
            let serviceId;
            let minimumOrder = 0;
            let deliveryCharge = 0;
            let sessionId = data.sessionId != "" && data.sessionId != null ? data.sessionId : Helper.createGuid();

            // let companyOptions = await CompanyRepo.getCompanyWebsiteOptions(null, company.id);
            let hideOutOfStocks = false
            let enforceServiceSelection = false
            if (companyData ) {
                hideOutOfStocks = companyData.hideOutOfStocks
                enforceServiceSelection = companyData.enforceServiceSelection
                if (serviceName && enforceServiceSelection && (serviceName == null || serviceName == "")) {
                    throw new ValidationException("Service Selection is required")
                }
            }
            //TODO: CHECK LOGGEDIN USER FROM SHOPPERREPO 
            //TODO: SHOPPERREPO => 

            /** Get Cart from redis */

            let tempcart = await this.getRedisCart(company.id, sessionId);

            if (data.serviceName == "Delivery") {
                if (addressKey != "" && addressKey != null) {
                    let branch = await BranchesRepo.getAddressKeyBranchId(company.id, data.addressKey)
                    branchId = branch.data.id
                    minimumOrder = Number(branch.data.minimumOrder)
                    deliveryCharge = Number(branch.data.deliveryCharge)
                }
            }






            if (serviceName != null && serviceName != "") {
                if (data.serviceName == "Shipping") {
                    serviceId = await ServiceRepo.getDefaultServiceByName(company.id, "Delivery");

                } else {
                    serviceId = await ServiceRepo.getDefaultServiceByName(company.id, serviceName);
                }
                if (serviceId == null) {
                    throw new ValidationException(serviceName + ' Service Is not Available')
                }
            }



            if (tempcart) {
                if (tempcart.serviceId != serviceId || tempcart.branchId != branchId || tempcart.tableId != tableId) {
                    cart.ParseJson(data)
                    cart.onlineData.sessionId = Helper.createGuid()
                } else {
                    cart = tempcart
                    cart.onlineData.sessionId = sessionId;
                }
            } else {
                cart.onlineData.sessionId = Helper.createGuid()
                cart.ParseJson(data)
            }

            cart.isInclusiveTax = companyData.isInclusiveTax;
            cart.serviceId = serviceId;


            cart.tableId = tableId;


            cart.deliveryCharge = deliveryCharge;
            cart.minimumOrder = minimumOrder;
            cart.status = 'Draft'
            cart.source = "Online"
            cart.externalId = data.externalId;
            if (data.serviceName != "Shipping") {
                cart.branchId = branchId;
            }

            if (data.serviceName == "Shipping") {
                const shippingSetting: any = await CompanyRepo.getShippingSetting(company);
                const branchId = shippingSetting.data.defaultShippingBranch;

                cart.branchId = branchId;
                // deliveryCharge = await this.CalculateDeliveryPrice(company, data.addressKey, cart);
                // cart.deliveryCharge = deliveryCharge;
                // deliveryCharge = await this.CalculateDeliveryPrice(company, data.addressKey, cart);
                // cart.deliveryCharge = deliveryCharge;
            }

            if (data.serviceName == "DineIn") {
                if (cart.tableId != null && cart.tableId != "") {
                    let table = await TablesRepo.getTableName(data.tableId);
                    cart.tableId = tableId
                    cart.branchId = table.data.branchId
                    cart.tableName = table.data.name;
                }
            }


            if (loggedInUser) {
                let customer = new Customer();
                customer.ParseJson(loggedInUser)
                cart.customerId = (await CustomerRepo.checkIfCustomerExists(customer.phone, company.id))?.id
                cart.customer = customer;
                cart.customerContact = customer.phone;
                cart.customerName = customer.name
            }

            branchId = branchId != null && branchId != "" ? branchId : cart.branchId
            if (branchId != "" && branchId != null) {
                cart.branchName = await BranchesRepo.getBranchName(branchId)
            } else {

                let defaultBranch: any = await BranchesRepo.getDefaultEcommerceBranch(company.id)
                if (defaultBranch.branch) {
                    cart.branchId = defaultBranch.branch.id
                    cart.branchName = defaultBranch.branch.name
                }

            }
            cart.onlineData.onlineStatus = "Placed"
            /**Only When Service type is DineIn set expiry time for cart to 8 hours else 30 days*/

            if (tempcart == null) {
                let cartExpTime = 7 * 24 * 60 * 60;/**30 Days */
                if (serviceName == "DineIn") {
                    cartExpTime = 8 * 60 * 60
                }

                await this.setRedisCart(company.id, cart.onlineData.sessionId, cart, cartExpTime)
            } else {
                await this.setRedisCart(company.id, cart.onlineData.sessionId, cart)
            }

            // if (serviceName == "DineIn") {
            //     console.log()
            //     cartExpTime = 30/**8 Hours  */
            //     await this.setRedisCart(company.id, cart.onlineData.sessionId, cart, cartExpTime)
            // } else {
            //     await this.setRedisCart(company.id, cart.onlineData.sessionId, cart, cartExpTime)

            // }


            return new ResponseData(true, "", cart)
        } catch (error: any) {
            console.log(error)

            throw new Error(error)
        }
    }

    // public static async createEstimateCart(data: any, company: Company, loggedInUser: any | null = null) {
    //     try {

    //         let companyData = await CompanyRepo.getCompanyPrefrences(company.id);

    //         let cart: Estimate| null  = new Estimate();

    //        // let cart: Invoice | null = new Invoice();
    //         let branchId = data.branchId != null && data.branchId != "" ? data.branchId : null;
    //         let tableId = data.tableId != null && data.tableId != "" ? data.tableId : null;
    //         let serviceName = data.serviceName;
    //         let serviceId;

    //         let sessionId = data.sessionId != "" && data.sessionId != null ? data.sessionId : Helper.createGuid();

    //         //TODO: CHECK LOGGEDIN USER FROM SHOPPERREPO 
    //         //TODO: SHOPPERREPO => 

    //         /** Get Cart from redis */
    //         let tempcart = await this.getRedisCart(company.id, sessionId);

    //         if (serviceName != null && serviceName != "") {
    //             serviceId = await ServiceRepo.getDefaultServiceByName(company.id, serviceName);
    //         }


    //         if (tempcart) {
    //             if (tempcart.serviceId != serviceId || tempcart.branchId != branchId || tempcart.tableId != tableId) {
    //                 cart.ParseJson(data)
    //                 cart.onlineData.sessionId = Helper.createGuid()
    //             } else {
    //                 cart.ParseJson(tempcart)
    //                 cart.onlineData.sessionId = sessionId;
    //             }
    //         } else {
    //             cart.onlineData.sessionId = Helper.createGuid()
    //             cart.ParseJson(data)
    //         }

    //         cart.isInclusiveTax = companyData.data.isInclusiveTax;
    //         cart.serviceId = serviceId;
    //         cart.branchId = branchId;
    //         cart.tableId = tableId;


    //         cart.source = "Online"

    //         if (loggedInUser) {
    //             let customer = new Customer();
    //             customer.ParseJson(loggedInUser)
    //             cart.customerId = (await CustomerRepo.checkIfCustomerExists(customer.phone, company.id))?.id
    //             cart.customer = customer;
    //             cart.customerContact = customer.phone;
    //             cart.customerName = customer.name
    //         }

    //         branchId = branchId != null && branchId != "" ? branchId : cart.branchId
    //         if (branchId != "" && branchId != null) {
    //             cart.branchName = await BranchesRepo.getBranchName(branchId)
    //         }
    //         cart.onlineData.onlineStatus = "Placed"
    //         /**Only When Service type is DineIn set expiry time for cart to 8 hours else 30 days*/
    //         let cartExpTime = 30 * 24 * 60 * 60 * 1000;/**30 Days */
    //         await this.setRedisCart(company.id, cart.onlineData.sessionId, cart, cartExpTime)

    //         return new ResponseData(true, "", cart)
    //     } catch (error: any) {
    //       
    //         throw new Error(error)
    //     }
    // }

    public static async getCart(company: Company, cartSessionId: string) {
        try {
            let cart = await this.getRedisCart(company.id, cartSessionId);
            if (cart) {

                if (cart.serviceName == "Shipping") {

                    // const deliveryCharge = await this.CalculateDeliveryPrice(company, cart.addressKey, cart);
                    // cart.deliveryCharge = deliveryCharge;
                    // const deliveryCharge = await this.CalculateDeliveryPrice(company, cart.addressKey, cart);
                    // cart.deliveryCharge = deliveryCharge;
                }


                return new ResponseData(true, "", cart)
            } else {
                throw new Error("cart not created")
            }

        } catch (error: any) {


            throw new Error(error)
        }
    }





    // public static async CalculateDelevaryPrice(company: Company, cartSessionId: string) {
    //     try {
    //         let cart = await this.getRedisCart(company.id, cartSessionId);
    //         const shippingSetting: any = await CompanyRepo.getShippingSetting(company);
    //         let companyUnit =  shippingSetting.UOM
    //        let countryShippingprice =  shippingSetting.CountriesPrices.filter((country: { CountryCode: string | undefined; }) => country.CountryCode == cart?.addressKey).PPU;
    //        switch (companyUnit) {
    //         case "KG":
    //             weightInKg = element.weight;
    //             break;

    //             case "Ounce":
    //                 weightInKg =  element.weight * 0.02834952
    //             break;

    //             case "Pound":
    //                 weightInKg =  element.weight * 0.45359237
    //             break;

    //         default:
    //             break;
    //        }
    //         if (cart) {
    //       // eslint-disable-next-line @typescript-eslint/no-empty-function
    //       cart.lines.forEach(element => {
    //         let weightInKg = 0;
    //    switch (element.weightUOM) {
    //     case "KG":
    //         weightInKg = element.weight;
    //         break;

    //         case "Ounce":
    //             weightInKg =  element.weight * 0.02834952
    //         break;

    //         case "Pound":
    //             weightInKg =  element.weight * 0.45359237
    //         break;

    //     default:
    //         break;
    //    }






    //       });





    //             return new ResponseData(true, "", cart)
    //         } else {
    //             throw new Error("cart not created")
    //         }

    //     } catch (error: any) {
    //       

    //         throw new Error(error)
    //     }
    // }



    public static async CalculateDeliveryPrice(company: Company, addressKey: string, cart: Invoice) {
        try {
            // const cart = await this.getRedisCart(company.id, cartSessionId) || new Invoice;
            const shippingSetting: any = await CompanyRepo.getShippingSetting(company);
            let companyUnit = shippingSetting.data.UOM;
            const countryShipping = shippingSetting.data.CountriesPrices.find((country: { CountryCode: string | undefined }) => country.CountryCode == addressKey);
            let countryShippingPrice = 0;
            if (countryShipping && countryShipping.PPU !== undefined) {
                countryShippingPrice = countryShipping.PPU;
            }

            let weightInKg = 0;
            if (cart.onlineData.sessionId != "") {
                cart?.lines.forEach(element => {
                    const weight = element.weight;
                    const qty = element.qty;
                    let weightUOM = element.weightUOM;
                    if (weightUOM == null) {

                        weightUOM = "KG"
                    }
                    switch (weightUOM.toUpperCase()) {
                        case "KG":
                            weightInKg += (weight) * qty;
                            break;
                        case "OUNCE":
                            weightInKg += (weight * 0.02834952) * qty;
                            break;
                        case "POUND":
                            weightInKg += (weight * 0.45359237) * qty;
                            break;
                        default:
                            break;
                    }
                });

                let finalPrice = 0;
                if (companyUnit == null) {

                    companyUnit = "KG"
                }
                switch (companyUnit.toUpperCase()) {
                    case "KG":
                        finalPrice = weightInKg * countryShippingPrice;
                        break;
                    case "OUNCE":
                        finalPrice = (weightInKg * 35.27396) * countryShippingPrice;
                        break;
                    case "POUND":
                        finalPrice = (weightInKg * 2.204623) * countryShippingPrice;
                        break;
                    // Add more cases if there are additional unit conversions
                    default:
                        break;
                }

                return finalPrice;
            } else {
                throw new Error("Cart not created");
            }
        } catch (error: any) {

            throw new Error(error);
        }
    }




    public static async addItemToCart(data: any, company: Company) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")
            let cartSessionId = data.sessionId;
            let cartData = await this.getRedisCart(company.id, cartSessionId);
            let cart = new Invoice();
            let menuId = data.menuId
            if (cartData) {

                // let companyTax = (await TaxesRepo.getDefaultTax(client, company.id)).data
                cart.ParseJson(cartData);
                let productId = data.productId;
                let qty = data.qty;
                let options = data.options;
                let selectedItems = data.selectedItems;
                //let item ;
                // if (cart instanceof Invoice){ item = new InvoiceLine();}
                // else{item =  new EstimateLine();}
                let item = new InvoiceLine();
                let weight = (await ProductRepo.getProduct(productId, company)).data.weight;
                item.productId = productId;
                item.qty = qty
                item.id = Helper.createGuid()
                item.weight = weight;
                // item.selectedItem = selectedItems && selectedItems.length > 0 ? selectedItems : [];
                item.note = data.note;

                if (options && options.length > 0) {
                    for (let index = 0; index < options.length; index++) {
                        // let option;
                        // if (item instanceof InvoiceLine){ option= new InvoiceLineOption()}
                        // else{option =  new EstimateLineOption()}
                        let option = new InvoiceLineOption();
                        const optionData = options[index];
                        option.optionId = optionData.id;
                        option.qty = optionData.qty <= 0 ? 1 : optionData.qty
                        if (option.optionId != null) {
                            let optionInfo = await OptionRepo.getOptionPrice(client, option.optionId, optionData.optionGroupId ?? null)
                            const prices = await ShopRepo.getOptionPrices(
                                client,
                                [{ id: option.optionId }],
                                cart.branchId,
                                menuId ? [menuId] : [],
                                cart.serviceId
                            );
                            const opPrice = prices && prices.length > 0 && prices[0].price ? prices[0].price : null
                            option.price = opPrice ?? optionInfo.price
                            option.weight = optionInfo.weight
                            option.optionName = optionInfo.name
                            option.translation = optionInfo.translation
                            option.optionGroupId = optionData.optionGroupId ?? null
                            option.optionGroupName = optionInfo.optionGroupName
                            option.optionGroupTranslation = optionInfo.optionGroupTranslation
                        }

                        // if(item instanceof InvoiceLine && option instanceof InvoiceLineOption ){item.options.push(option)}
                        // else {
                        //     if(item instanceof EstimateLine && option instanceof EstimateLineOption ){item.options.push(option)}
                        // }
                        item.options.push(option)

                    }
                }


                const accountId = (await AccountsRepo.getSalesId(client, null, company.id)).id;


                if (cart.branchId != null && cart.branchId != "") {


                    let linesWithSameProducts = cart.lines.filter(f => f.productId == productId);
                    let totalProductQtyInInvoice = qty;
                    if (linesWithSameProducts) {
                        for (let i = 0; i < linesWithSameProducts.length; i++) {
                            const item = linesWithSameProducts[i];
                            if (item.productId == productId) {
                                totalProductQtyInInvoice += item.qty
                            }
                        }
                    }


                    let prodDate: any = await ProductRepo.getProductBranchData(client, productId, cart.branchId)
                    let prices = await ShopRepo.getProductPrices(client, [{ id: productId, menuId: data.menuId }], cart.branchId, data.menuId ? [data.menuId] : [], cart.serviceId)
                    let productPrice = prices && prices.length > 0 && prices[0].price ? prices[0].price : null
                    if (prodDate.type == 'tailoring' && (!data.measurements)) {
                        throw new ValidationException("Measurements Are Required")
                    }

                    if (prodDate && prodDate.optionGroups) {
                        const ids = prodDate.optionGroups.map((f: any) => { return f.optionGroupId })
                        const minimum = await OptionRepo.getMinSelectionCount(client, ids)
                        if ((options && minimum > options.length) || (minimum > 0 && !options)) {
                            throw new ValidationException("INSUFFICIENT OPTION SELECTION")
                        }
                    }
                    let productDiscount = await ShopRepo.getProductDiscounts(client, [productId], cart.branchId, company.id);

                    if (productDiscount && productDiscount.length > 0) {
                        let discount = productDiscount[0];

                        item.discountPercentage = discount.percentage;
                        item.discountAmount = discount.amount;
                        item.discountId = discount.discountId;
                        item.discountPerQty = discount.quantityBasedCashDiscount;
                        cart.discountType = 'itemDiscount'
                        item.discountType = 'itemDiscount'
                    }

                    if (totalProductQtyInInvoice > prodDate.onHand && (prodDate.type != "tailoring" && prodDate.type != "menuItem" && prodDate.type != "service" && prodDate.type != "menuSelection" && prodDate.type != "package")) {
                        throw new Error("Item qty is not available, Max Available qty is " + prodDate.onHand)
                    }

                    if (totalProductQtyInInvoice > prodDate.maxItemPerTicket && (prodDate.maxItemPerTicket != 0) && (prodDate.type != "service")) {
                        throw new Error("You have reached the maximum qty, maximum allowed quantity  is " + prodDate.maxItemPerTicket)
                    }

                    item.price = productPrice ? productPrice : prodDate.price ? prodDate.price : prodDate.defaultPrice
                    item.defaultPrice = item.price
                    item.priceModel = prodDate.priceModel
                    item.accountId = accountId
                    item.taxId = prodDate.taxId
                    item.taxes = prodDate.taxes
                    item.weight = prodDate.weight
                    item.weightUOM = prodDate.weightuom
                    item.productName = prodDate.name
                    item.translation = prodDate.translation
                    item.taxPercentage = prodDate.taxPercentage
                    item.taxType = prodDate.taxType
                    item.mediaUrl = prodDate.mediaUrl
                    item.translation = prodDate.translation
                    item.measurements = data.measurements

                    if (selectedItems && selectedItems.length > 0) {
                        item.subItems = []
                        console.log("lengthlengthlengthlengthlength", selectedItems.length)
                        for (let index = 0; index < selectedItems.length; index++) {
                            const element = selectedItems[index];
                            const lineProducts = new InvoiceLine();
                            let selectedItemData: any = await ProductRepo.getProductBranchData(client, element.productId, cart.branchId)
                            let selectedItemDiscount = await ShopRepo.getProductDiscounts(client, [element.productId], cart.branchId, company.id);
                            let selectedItemPrices = await ShopRepo.getProductPrices(client, [{ id: element.productId, menuId: data.menuId }], cart.branchId, data.menuId ? [data.menuId] : [], cart.serviceId)
                            let selectedProductPrice = selectedItemPrices && selectedItemPrices.length > 0 && selectedItemPrices[0].price ? selectedItemPrices[0].price : null

                            lineProducts.qty = element.qty ?? 1
                            lineProducts.price = selectedProductPrice ?? (selectedItemData.price || selectedItemData.defaultPrice)
                            lineProducts.defaultPrice = (selectedItemData.price || selectedItemData.defaultPrice)
                            lineProducts.productId = element.productId;
                            lineProducts.weight = selectedItemData.weight
                            lineProducts.weightUOM = selectedItemData.weightuom
                            lineProducts.translation = selectedItemData.translation
                            lineProducts.productName = selectedItemData.name

                            if (selectedItemDiscount && selectedItemDiscount.length > 0) {
                                let discount = selectedItemDiscount[0];
                                lineProducts.discountPercentage = discount.percentage;
                                lineProducts.discountAmount = discount.amount;
                                lineProducts.discountId = discount.discountId;
                                lineProducts.discountType = 'itemDiscount'
                            }

                            if (element.options) {
                                for (let index = 0; index < element.options.length; index++) {
                                    const option = element.options[index];
                                    const lineOption = new InvoiceLineOption();

                                    let optionData = await OptionRepo.getOptionPrice(client, option.optionId, option.optionGroupId ?? null)
                                    const prices = await ShopRepo.getOptionPrices(
                                        client,
                                        [{ id: option.optionId }],
                                        cart.branchId,
                                        menuId ? [menuId] : [],
                                        cart.serviceId
                                    );
                                    const opPrice = prices && prices.length > 0 && prices[0].price ? prices[0].price : null
                                    lineOption.optionId = option.optionId
                                    lineOption.optionName = optionData.name
                                    lineOption.qty = option.qty
                                    lineOption.weight = optionData.weight
                                    lineOption.price = opPrice ?? optionData.price
                                    lineOption.defaultPrice = opPrice ?? optionData.price
                                    lineOption.translation = optionData.translation
                                    lineOption.optionGroupId = option.optionGroupId ?? ""
                                    option.optionGroupName = optionData.optionGroupName ?? null
                                    option.optionGroupTranslation = optionData.optionGroupTranslation ?? {}
                                    lineProducts.options.push(lineOption)
                                }
                            }

                            item.subItems.push(lineProducts)
                        }


                    }
                    if (prodDate.type == "service") {

                        let salesEmployeeId = data.employeeId;
                        item.salesEmployeeId = salesEmployeeId ? salesEmployeeId : null
                        let available = true
                        item.serviceDuration = prodDate.serviceTime ? prodDate.serviceTime : 0
                        let serviceScheduale = moment(data.date + ' ' + data.time).tz("Asia/" + company.country).format("YYYY-MM-DD HH:mm")


                        if (cart.lines.length > 0) {
                            for (let i = 0; i < cart.lines.length; i++) {
                                const e = cart.lines[i]
                                serviceScheduale = moment(serviceScheduale).add(e.serviceDuration, 'minute').format("YYYY-MM-DD HH:mm")
                            }
                        }

                        item.serviceDate = new Date(moment(serviceScheduale).format("YYYY-MM-DD"))
                        item.serviceDate.setUTCHours(moment(serviceScheduale).hour())
                        item.serviceDate.setUTCMinutes(moment(serviceScheduale).minutes())



                        if (salesEmployeeId != null && salesEmployeeId != "") {

                            let empProdDate: any = await ProductRepo.getProductEmployeeData(client, productId, salesEmployeeId, company.id)
                            if (empProdDate) {
                                item.price = empProdDate.price ? empProdDate.price : item.price,
                                    item.serviceDuration = empProdDate.serviceTime ? empProdDate.serviceTime : prodDate.serviceTime

                            }

                        }

                        available = await this.checkTimeAvailability(client, { "employeeId": salesEmployeeId, "branchId": item.branchId, "date": data.date, "start": serviceScheduale, "duration": item.serviceDuration }, company)

                        if (!available) {
                            throw new Error("The employee is busy...")
                        }
                    }

                } else {
                    let prodDate: any = await ProductRepo.getProductData(client, productId, company.id)
                    if (prodDate.type == 'tailoring' && (!data.measurements)) {
                        throw new ValidationException("Measurements Are Required")
                    }
                    if (prodDate && prodDate.optionGroups) {
                        const ids = prodDate.optionGroups.map((f: any) => { return f.optionGroupId })
                        const minimum = await OptionRepo.getMinSelectionCount(client, ids)
                        if ((options && minimum > options.length) || (minimum > 0 && !options)) {
                            throw new ValidationException("INSUFFICIENT OPTION SELECTION")
                        }
                    }
                    item.price = prodDate.defaultPrice
                    item.measurements = data.measurements
                    item.accountId = accountId
                    item.taxId = prodDate.taxId
                    item.taxes = prodDate.taxes
                    item.taxType = prodDate.taxType
                    item.productName = prodDate.name
                    item.translation = prodDate.translation
                    item.weight = prodDate.weight
                    item.weightUOM = prodDate.weightuom
                    item.taxPercentage = prodDate.taxPercentage
                    item.mediaUrl = prodDate.mediaUrl
                    item.priceModel = prodDate.priceModel
                    item.translation = prodDate.translation
                    if (selectedItems && selectedItems.length > 0) {
                        item.subItems = []
                        for (let index = 0; index < selectedItems.length; index++) {
                            const element = selectedItems[index];
                            const lineProducts = new InvoiceLine();
                            let selectedItemData: any = await ProductRepo.getProductData(client, element.productId, company.id)
                            let selectedItemPrices = await ShopRepo.getProductPrices(client, [{ id: element.productId, menuId: data.menuId }], cart.branchId, data.menuId ? [data.menuId] : [], cart.serviceId)
                            let selectedProductPrice = selectedItemPrices && selectedItemPrices.length > 0 && selectedItemPrices[0].price ? selectedItemPrices[0].price : null

                            lineProducts.qty = element.qty ?? 1
                            lineProducts.price = selectedProductPrice ?? selectedItemData.defaultPrice
                            lineProducts.productId = element.productId;
                            lineProducts.defaultPrice = lineProducts.price
                            lineProducts.weight = selectedItemData.weight
                            lineProducts.weightUOM = selectedItemData.weightuom
                            lineProducts.translation = selectedItemData.translation
                            lineProducts.productName = selectedItemData.name
                            if (element.options) {
                                for (let index = 0; index < element.options.length; index++) {
                                    const option = element.options[index];
                                    const lineOption = new InvoiceLineOption();
                                    let optionInfo = await OptionRepo.getOptionPrice(client, option.optionId, option.optionGroupId ?? null)
                                    const prices = await ShopRepo.getOptionPrices(
                                        client,
                                        [{ id: option.optionId }],
                                        cart.branchId,
                                        menuId ? [menuId] : [],
                                        cart.serviceId
                                    );
                                    const opPrice = prices && prices.length > 0 && prices[0].price ? prices[0].price : null

                                    lineOption.optionId = option.optionId
                                    lineOption.qty = option.qty
                                    lineOption.optionName = optionInfo.name
                                    lineOption.weight = optionInfo.weight
                                    lineOption.price = opPrice ?? optionInfo.price
                                    lineOption.defaultPrice = opPrice ?? optionInfo.price
                                    lineOption.translation = optionInfo.translation
                                    lineOption.optionGroupId = option.optionGroupId ?? null
                                    option.optionGroupName = optionInfo.optionGroupName ?? null
                                    option.optionGroupTranslation = optionInfo.optionGroupTranslation ?? {}
                                    lineProducts.options.push(lineOption)
                                }
                            }

                            item.subItems.push(lineProducts)


                        }


                    }
                    if (prodDate.type == "service") {

                        let salesEmployeeId = data.employeeId;
                        item.salesEmployeeId = salesEmployeeId ? salesEmployeeId : null
                        let available = true
                        item.serviceDuration = prodDate.serviceTime ? prodDate.serviceTime : 0
                        let serviceScheduale = moment(data.date + ' ' + data.time).tz("Asia/" + company.country).format("YYYY-MM-DD HH:mm")


                        if (cart.lines.length > 0) {
                            for (let i = 0; i < cart.lines.length; i++) {
                                const e = cart.lines[i]
                                serviceScheduale = moment(serviceScheduale).add(e.serviceDuration, 'minute').format("YYYY-MM-DD HH:mm")
                            }
                        }

                        item.serviceDate = new Date(moment(serviceScheduale).format("YYYY-MM-DD"))
                        item.serviceDate.setUTCHours(moment(serviceScheduale).hour())
                        item.serviceDate.setUTCMinutes(moment(serviceScheduale).minutes())



                        if (salesEmployeeId != null && salesEmployeeId != "") {

                            let empProdDate: any = await ProductRepo.getProductEmployeeData(client, productId, salesEmployeeId, company.id)
                            if (empProdDate) {
                                item.price = empProdDate.price ? empProdDate.price : item.price,
                                    item.serviceDuration = empProdDate.serviceTime ? empProdDate.serviceTime : prodDate.serviceTime

                            }

                        }

                        available = await this.checkTimeAvailability(client, { "employeeId": salesEmployeeId, "date": data.date, "start": serviceScheduale, "duration": item.serviceDuration }, company)

                        if (!available) {
                            throw new Error("The employee is busy...")
                        }
                    }




                }





                // if(cart instanceof Invoice && item instanceof InvoiceLine ){cart.lines.push(item)}
                // else {
                //     if(cart instanceof Estimate && item instanceof EstimateLine ){cart.lines.push(item)}
                // }

                item.menuId = menuId;
                cart.lines.push(item)

                console.log("subItems", cart.lines[0].subItems)
                if (cart.serviceName == "Shipping") {
                    // const deliveryCharge = await this.CalculateDeliveryPrice(company, cart.addressKey, cart);
                    // cart.deliveryCharge = deliveryCharge;
                    // const deliveryCharge = await this.CalculateDeliveryPrice(company, cart.addressKey, cart);
                    // cart.deliveryCharge = deliveryCharge;
                }
                cart.calculateTotal(company.settings.afterDecimal)
                await this.setRedisCart(company.id, cartSessionId, cart)
            } else {
                throw new Error("Cart Is not Created")
            }

            await client.query("COMMIT")
            return new ResponseData(true, "", cart)
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")


            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getTypeOfCart(cart: Estimate | Invoice) {
        if (cart instanceof Estimate) return "Estimate";
        else return "Invoice";
    }


    // public static async addItemToEstimateCart(data: any, company: Company) {
    //     const client = await DB.excu.client()
    //     try {

    //         await client.query("BEGIN")
    //         let cartSessionId = data.sessionId;
    //         let cartData = await this.getRedisCart(company.id, cartSessionId);

    //         let cart = new Estimate()


    //         if (cartData) {

    //             let companyTax = (await TaxesRepo.getDefaultTax(client,company.id)).data

    //             cart.ParseJson(cartData);
    //             let productId = data.productId;
    //             let qty = data.qty;
    //             let employeeId = data.employeeId;
    //             let options = data.options;
    //             let selectedItems = data.selecredItems;
    //             // let item ;
    //             // if (cart instanceof Estimate){ item = new EstimateLine();}
    //             // else{item =  new InvoiceLine();}


    //             let  item = new EstimateLine();

    //             item.productId = productId;
    //             item.qty = qty
    //             item.id = Helper.createGuid()
    //             item.selectedItem = selectedItems && selectedItems.length > 0 ? selectedItems : [];
    //             item.note = data.note;

    //             if (options && options.length > 0) {
    //                 for (let index = 0; index < options.length; index++) {
    //                     // let option;
    //                     // if (item instanceof InvoiceLine){ option= new InvoiceLineOption()}
    //                     // else{option =  new EstimateLineOption()}
    //                     let option= new EstimateLineOption();
    //                     const optionData = options[index];
    //                     option.optionId = optionData.id;
    //                     option.qty = optionData.qty <= 0 ? 1 : optionData.qty
    //                     if (option.optionId != null) {
    //                         let optionInfo = await OptionRepo.getOptionPrice(client, option.optionId)
    //                         option.price = optionInfo.price
    //                         option.optionName = optionInfo.name
    //                     }

    //                     // if(item instanceof InvoiceLine && option instanceof InvoiceLineOption ){item.options.push(option)}
    //                     // else {
    //                     //     if(item instanceof EstimateLine && option instanceof EstimateLineOption ){item.options.push(option)}
    //                     // }
    //                    item.options.push(option)

    //                 }
    //             }
    //             const accountId = (await AccountsRepo.getSalesId(client, null, company.id)).id;


    //             if (cart.branchId != null && cart.branchId != "") {


    //                 let linesWithSameProducts = cart.lines?.filter((f:any)=> f.productId == productId );
    //                 let totalProductQtyInInvoice = qty;
    //                 if(linesWithSameProducts )
    //                 {
    //                     for (let i = 0; i < linesWithSameProducts.length; i++) {
    //                         const item = linesWithSameProducts[i];
    //                         if (item.productId == productId) {
    //                             totalProductQtyInInvoice += item.qty
    //                         }
    //                     }
    //                 }


    //                 let prodDate: any = await ProductRepo.getProductBranchData(client, productId, cart.branchId)


    //                 if (totalProductQtyInInvoice > prodDate.onHand && (prodDate.type != "menuItem" && prodDate.type != "service" && prodDate.type != "menuSelection")) {
    //                     throw new Error("Item qty is not available, Max Available qty is "+ prodDate.onHand)
    //                 }

    //                 if ( totalProductQtyInInvoice > prodDate.maxItemPerTicket && (prodDate.maxItemPerTicket != 0) && (prodDate.type != "service")) {
    //                     throw new Error("You have reached the maximum qty, maximum allowed quantity  is "+prodDate.maxItemPerTicket )
    //                 }



    //                 item.employeeId = employeeId ? employeeId : null
    //                 item.price = prodDate.price ? prodDate.price : prodDate.defaultPrice
    //                 item.accountId = accountId
    //                 item.taxId = prodDate.taxId == null || prodDate.taxId == "" ? companyTax.id : prodDate.taxId
    //                 item.taxes = prodDate.taxId == null || prodDate.taxId == "" ? companyTax.taxes : prodDate.taxes
    //                 item.productName = prodDate.name
    //                 item.taxPercentage = prodDate.taxId == null || prodDate.taxId == "" ? companyTax.taxPercentage : prodDate.taxPercentage
    //                 item.mediaUrl = prodDate.mediaUrl



    //                 if (prodDate.type == "service" ) {

    //                     let available =  true
    //                     item.serviceDuration = prodDate.serviceTime ? prodDate.serviceTime : 0
    //                     let serviceScheduale = moment(data.date + ' ' + data.time).tz("Asia/" + company.country).format("YYYY-MM-DD HH:mm")


    //                     if (cart.lines.length > 0) {
    //                         for (let i = 0; i < cart.lines.length; i++) {
    //                             const e = cart.lines[i]
    //                             serviceScheduale = moment(serviceScheduale).add(e.serviceDuration, 'minute').format("YYYY-MM-DD HH:mm")
    //                         }
    //                     }

    //                     item.serviceDate = new Date( moment(serviceScheduale).format("YYYY-MM-DD"))
    //                     item.serviceDate.setUTCHours(moment(serviceScheduale).hour())
    //                     item.serviceDate.setUTCMinutes(moment(serviceScheduale).minutes())

    //                     if (employeeId != null && employeeId != "") {

    //                         let empProdDate: any = await ProductRepo.getProductEmployeeData(client, productId, employeeId, company.id)
    //                         if (empProdDate) {
    //                             item.price = empProdDate.price ? empProdDate.price : item.price,
    //                             item.serviceDuration = empProdDate.serviceTime ? empProdDate.serviceTime : prodDate.serviceTime

    //                         }

    //                     }

    //                     available = await this.checkTimeAvailability(client, {"employeeId" : data.employeeId,"branchId": item.branchId, "date": data.date, "start": serviceScheduale, "duration": item.serviceDuration},company)

    //                     if (!available){
    //                        throw new Error("The employee is busy...")
    //                     }
    //                 }

    //             } else {
    //                 let prodDate: any = await ProductRepo.getProductData(client,productId, company.id)
    //                 item.price = prodDate.defaultPrice
    //                 item.accountId = accountId
    //                 item.taxId = prodDate.taxId == null || prodDate.taxId == "" ? companyTax.id : prodDate.taxId
    //                 item.taxes = prodDate.taxId == null || prodDate.taxId == "" ? companyTax.taxes : prodDate.taxes
    //                 item.productName = prodDate.name
    //                 item.employeeId = employeeId ? employeeId : null
    //                 item.taxPercentage = prodDate.taxId == null || prodDate.taxId == "" ? companyTax.taxPercentage : prodDate.taxPercentage
    //                 item.mediaUrl = prodDate.mediaUrl


    //                 if (prodDate.type == "service" && employeeId != null && employeeId != "") {

    //                     item.serviceDuration = prodDate.serviceTime ? prodDate.serviceTime : 0
    //                     let serviceScheduale = moment(data.date + ' ' + data.time).tz("Asia/" + company.country).format("YYYY-MM-DD HH:mm")


    //                     if (cart.lines.length > 0) {
    //                         for (let i = 0; i < cart.lines.length; i++) {
    //                             const e = cart.lines[i]
    //                             serviceScheduale = moment(serviceScheduale).add(e.serviceDuration, 'minute').format("YYYY-MM-DD HH:mm")
    //                         }
    //                     }

    //                     item.serviceDate = new Date( moment(serviceScheduale).format("YYYY-MM-DD"))
    //                     item.serviceDate.setUTCHours(moment(serviceScheduale).hour())
    //                     item.serviceDate.setUTCMinutes(moment(serviceScheduale).minutes())

    //                     let empProdDate: any = await ProductRepo.getProductEmployeeData(client, productId, employeeId, company.id)
    //                     if (empProdDate) {
    //                         item.price = empProdDate.price ? empProdDate.price : item.price,
    //                         item.serviceDuration = empProdDate.serviceTime ? empProdDate.serviceTime : prodDate.serviceTime

    //                     }


    //                     const available = await this.checkTimeAvailability(client, {"employeeId" : data.employeeId, "date": data.date, "start": serviceScheduale, "duration": item.serviceDuration},company)
    //                     if (!available){
    //                        throw new Error("The employee is busy...")
    //                     }
    //                 }

    //             }


    //             // if(cart instanceof Invoice && item instanceof InvoiceLine ){cart.lines.push(item)}
    //             // else {
    //             //     if(cart instanceof Estimate && item instanceof EstimateLine ){cart.lines.push(item)}
    //             // }

    //             cart.lines.push(item)

    //             cart.calculateTotal(company.settings.afterDecimal)

    //             this.setRedisCart(company.id, cartSessionId, cart)
    //         } else {
    //             throw new Error("Cart Is not Created")
    //         }

    //         await client.query("COMMIT")
    //         return new ResponseData(true, "", cart)
    //     } catch (error: any) {
    //         await client.query("ROLLBACK")
    //       

    //         throw new Error(error)
    //     } finally {
    //         client.release()
    //     }
    // }

    public static async saveInvoiceScheduleTime(data: any, company: Company) {
        try {
            let cartSessionId = data.sessionId;
            let transactionId = data.transactionId;
            let scheduleTime = data.scheduleTime

            let cartData = await this.getRedisCart(company.id, cartSessionId)
            let cart = new Invoice()
            if (cartData) {
                cart.ParseJson(cartData)
                cart.scheduleTime = scheduleTime
                await this.setRedisCart(company.id, cartSessionId, cart);
            } else {
                throw new Error("cart not created")
            }

            return new ResponseData(true, "", cart)
        } catch (error: any) {


            throw new Error(error)
        }
    }


    public static async getRedisCart(companyId: string, sessionId: string): Promise<Invoice | null> {
        try {
            let redisClient = RedisClient.getRedisClient();

            let key = "Cart" + companyId + sessionId;
            let data = await redisClient.get(key);
            if (!data) return null;
            return JSON.parse(data)
        } catch (error: any) {


            throw new Error(error)
        }
    }



    public static async deleteRedisCart(companyId: string, sessionId: string) {
        try {
            let redisClient = RedisClient.getRedisClient();

            let key = "Cart" + companyId + sessionId;
            await redisClient.deletKey(key);


        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async setRedisCart(companyId: string, sessionId: string, cart: any, time: number | null = null) {
        try {
            let redisClient = RedisClient.getRedisClient();
            let key = "Cart" + companyId + sessionId;
            if (time == null) {
                return await redisClient.set(key, JSON.stringify(cart));
            } else {
                return await redisClient.set(key, JSON.stringify(cart), time);
            }

        } catch (error: any) {


            throw new Error(error)
        }
    }


    public static async removeItem(data: any, company: Company) {
        try {
            let cartSessionId = data.sessionId;
            let transactionId = data.transactionId;


            let cartData = await this.getRedisCart(company.id, cartSessionId)
            let cart = new Invoice()
            if (cartData) {

                cart.ParseJson(cartData);
                cart.removeItem(transactionId)
                cart.calculateTotal(company.settings.afterDecimal)
                this.setRedisCart(company.id, cartSessionId, cart)
            } else {
                throw new Error("cart not created")
            }


            return new ResponseData(true, "", cart)
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async clearCartItems(data: any, company: Company) {
        try {
            let cartSessionId = data.sessionId;

            let cartData = await this.getRedisCart(company.id, cartSessionId)
            let cart = new Invoice()
            if (cartData) {
                cart.ParseJson(cartData);
                cart.lines = []
                cart.calculateTotal(company.settings.afterDecimal)
            } else {
                throw new Error("cart not created")
            }

            this.setRedisCart(company.id, cartSessionId, cart)

            return new ResponseData(true, "", cart)
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async changeItemQty(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            let cartSessionId = data.sessionId;
            let transactionId = data.transactionId;
            let qty = data.qty

            await client.query("BEGIN")
            let cartData = await this.getRedisCart(company.id, cartSessionId)
            let cart = new Invoice()
            if (cartData) {
                cart.ParseJson(cartData)
                let line = cart.lines.find((f => f.id == transactionId))
                if (line && line.productId) {
                    let indexOfLine = cart.lines.indexOf(line)
                    if (cart.branchId != null && cart.branchId != "") {
                        let prodDate: any = await ProductRepo.getProductBranchData(client, line.productId, cart.branchId)
                        if (qty > prodDate.onHand && (prodDate.type != "tailoring" && prodDate.type != "menuItem" && prodDate.type != "service" && prodDate.type != "menuSelection" && prodDate.type != "package")) {
                            throw new Error("qty is not available")
                        }

                    }
                    cart.lines[indexOfLine].qty = qty
                }
                cart.calculateTotal(company.settings.afterDecimal);

                await this.setRedisCart(company.id, cartSessionId, cart);

            } else {
                throw new Error("cart not created")
            }
            await client.query("COMMIT")


            return new ResponseData(true, "", cart)
        } catch (error: any) {
            await client.query("ROLLBACK")



            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async checkTimeAvailability(client: PoolClient, data: any, company: Company) {
        try {

            let em = (await EmployeeSchaduleRepo.getEmployeesScheduleForAppointment(client, data, company)).data

            //let workingHours = data.shift


            for (const wh of em) {

                for (const c of wh.days.shift) {

                    let serviceStartTime = moment(data.start).tz("Asia/" + company.country).format("HH:mm");

                    let serviceEndtTime = moment(data.start).tz("Asia/" + company.country).add(data.duration, 'minute').format("HH:mm");


                    if ((serviceStartTime >= c.from) && (serviceEndtTime <= c.to)) { return true }

                }
            }
            return false

        } catch (error: any) {
            console.log(error)


            throw new Error(error)
        }
    }


    public static async checkBranchAvailability(client: PoolClient, data: any, company: Company, isCheckout: boolean = false) {
        try {

            let branchId = data.branchId;
            let cartSessionId = data.sessionId;


            let cartData = await this.getRedisCart(company.id, cartSessionId)
            let cart = new Invoice()
            if (cartData) {
                cart.ParseJson(cartData)
                cart.branchId = branchId != null && branchId != "" ? branchId : cartData.branchId /** sometimes change service is called without branch Id  */


                if (!cart.branchId) { throw new ValidationException("Branch Id Is Required") }

                for (let index = 0; index < cart.lines.length; index++) {
                    const line = cart.lines[index];
                    let totalProductQtyInInvoice = 0;

                    if (line.productId) {
                        // get the info of a prod in the new  brunch 
                        // prodDate ---> proudData
                        let prodDate: any = await ProductRepo.getProductBranchData(client, line.productId, cart.branchId)





                        // check if this proudct is available in the new brunch
                        //check if the prod has  different price
                        let tempPrice = prodDate.price ? prodDate.price : prodDate.defaultPrice


                        if (prodDate.type == "service" && line.employeeId != null && line.employeeId != "") {

                            let empProdDate: any = await ProductRepo.getProductEmployeeData(client, line.productId, line.employeeId, company.id)
                            if (empProdDate) {
                                tempPrice = empProdDate.price ? empProdDate.price : tempPrice
                            }
                        }

                        let prices = await ShopRepo.getProductPrices(client, [{ id: line.productId }], data.branchId, line.menuId ? [line.menuId] : [], cart.serviceId)
                        if (prices && prices.length > 0) {
                            let price = prices[0];
                            tempPrice = price.price ? price.price : tempPrice
                        }
                        if (tempPrice != line.price && !isCheckout) {
                            line.priceChange = true;
                            line.price = tempPrice
                        }

                        line.priceModel = prodDate.priceModel

                        if (line.options && !isCheckout) {
                            for (let index = 0; index < line.options.length; index++) {
                                const option = line.options[index];
                                if (option.optionId) {
                                    let optionData = await OptionRepo.getOptionPrice(client, option.optionId, option.optionGroupId ?? null)
                                    const prices = await ShopRepo.getOptionPrices(
                                        client,
                                        [{ id: option.optionId }],
                                        cart.branchId,
                                        line.menuId ? [line.menuId] : [],
                                        cart.serviceId
                                    );
                                    const opPrice = prices && prices.length > 0 && prices[0].price ? prices[0].price : null
                                    option.price = opPrice ?? optionData.price
                                    option.defaultPrice = option.price
                                }


                            }
                        }
                        if (line && line.subItems.length > 0 && !isCheckout) {

                            for (let index = 0; index < line.subItems.length; index++) {
                                const element = line.subItems[index];
                                if (element.productId) {
                                    let selectedItemData: any = await ProductRepo.getProductBranchData(client, element.productId, cart.branchId)
                                    let selectedItemDiscount = await ShopRepo.getProductDiscounts(client, [element.productId], cart.branchId, company.id);
                                    let selectedItemPrices = await ShopRepo.getProductPrices(client, [{ id: element.productId, menuId: data.menuId }], cart.branchId, data.menuId ? [data.menuId] : [], cart.serviceId)
                                    let selectedProductPrice = selectedItemPrices && selectedItemPrices.length > 0 && selectedItemPrices[0].price ? selectedItemPrices[0].price : null
                                    line.subItems[index].qty = element.qty ?? 1
                                    line.subItems[index].price = selectedItemData.price ?? selectedItemData.defaultPrice
                                    line.subItems[index].price = selectedProductPrice ?? line.subItems[index].price
                                    line.subItems[index].defaultPrice = line.subItems[index].price
                                    line.subItems[index].productId = element.productId;
                                    line.subItems[index].weight = selectedItemData.weight
                                    line.subItems[index].weightUOM = selectedItemData.weightuom
                                    line.subItems[index].translation = selectedItemData.translation
                                    line.subItems[index].productName = selectedItemData.name
                                    if (selectedItemDiscount && selectedItemDiscount.length > 0) {
                                        let discount = selectedItemDiscount[0];
                                        line.subItems[index].discountPercentage = discount.percentage;
                                        line.subItems[index].discountAmount = discount.amount;
                                        line.subItems[index].discountId = discount.discountId;
                                        line.subItems[index].discountType = 'itemDiscount'
                                    }

                                    const tempOption: any[] = []
                                    if (element.options) {
                                        for (let index = 0; index < element.options.length; index++) {
                                            const option = element.options[index];
                                            const lineOption = new InvoiceLineOption();
                                            if (option.optionId) {
                                                let optionData = await OptionRepo.getOptionPrice(client, option.optionId, option.optionGroupId ?? null)
                                                const prices = await ShopRepo.getOptionPrices(
                                                    client,
                                                    [{ id: option.optionId }],
                                                    cart.branchId,
                                                    line.menuId ? [line.menuId] : [],
                                                    cart.serviceId
                                                );
                                                const opPrice = prices && prices.length > 0 && prices[0].price ? prices[0].price : null
                                                lineOption.optionId = option.optionId
                                                lineOption.optionName = optionData.name
                                                lineOption.qty = option.qty
                                                lineOption.weight = optionData.weight
                                                lineOption.price = opPrice ?? optionData.price
                                                lineOption.defaultPrice = opPrice ?? optionData.price
                                                lineOption.translation = optionData.translation
                                                lineOption.optionGroupId = option.optionGroupId ?? ""
                                                lineOption.optionGroupName = optionData.optionGroupName ?? null
                                                lineOption.optionGroupTranslation = optionData.optionGroupTranslation ?? {}
                                            }
                                            tempOption.push(lineOption)

                                        }
                                        line.subItems[index].options = tempOption
                                    }

                                }
                            }
                        }
                        if (prodDate.type == "tailoring" || prodDate.type == "menuSelection" || prodDate.type == "menuItem" || prodDate.type == "service" || prodDate.type == "package") {
                            line.outOfStock = false
                            continue;
                        }

                        //check if the product is out of stock or not  

                        let linesWithSameProducts = cart.lines.filter(f => f.id != line.id && f.productId == line.productId);
                        if (linesWithSameProducts) {
                            for (let i = 0; i < linesWithSameProducts.length; i++) {
                                const item = linesWithSameProducts[i];
                                if (item.productId == line.productId) {
                                    totalProductQtyInInvoice += item.qty
                                }
                            }
                        }


                        line.itemsQtyOnStock = prodDate.onHand;
                        // need to retun number of iteams in the stock?
                        if (prodDate.onHand < line.qty + totalProductQtyInInvoice) {
                            line.outOfStock = true
                        } else {
                            line.outOfStock = false
                        }

                        line.maxQtyItems = prodDate.maxItemPerTicket
                        // check Qty per ticket
                        if (prodDate.maxItemPerTicket && prodDate.maxItemPerTicket != 0 && prodDate.maxItemPerTicket < (line.qty + totalProductQtyInInvoice)) {
                            line.maxQtyExceeded = true

                        } else {
                            line.maxQtyExceeded = false

                        }

                        let productDiscount = await ShopRepo.getProductDiscounts(client, [line.productId], cart.branchId, company.id);

                        if (productDiscount && productDiscount.length > 0) {
                            let discount = productDiscount[0];
                            line.discountPercentage = discount.percentage;
                            line.discountAmount = discount.amount;
                            line.discountId = discount.discountId;
                            cart.discountType = 'itemDiscount'
                            line.discountType = 'itemDiscount'
                        } else {
                            line.resetDiscount()
                        }

                    }
                }
                cart.calculateTotal(company.afterDecimal);
                await this.setRedisCart(company.id, cartSessionId, cart)
            } else {
                throw new Error("Cart not Created")
            }

            return new ResponseData(true, "", cart)
        } catch (error: any) {
            console.log(error)


            throw new Error(error)
        }
    }

    public static async ChangeService2(data: any, company: Company, date: any) {
        const client = await DB.excu.client();
        try {
            let branchId = data.branchId
            const sessionId = data.sessionId;
            const serviceName = data.serviceName;
            const addressKey = data.addressKey;
            let cartData = await this.getRedisCart(company.id, sessionId)  //get user cart


            let cart = new Invoice(); //new cart 

            if (cartData) {

                cart.ParseJson(cartData);
                //I think no need
                // if (!(cart.lines.length > 0)) {
                //     return new ResponseData(false, "NO Change >> Cart is Empty", cart);
                // }

                //service name  requied 
                if ((serviceName == null || serviceName == "")) {
                    throw new Error("service Name Is Required")
                }

                //set cart service Name 
                cart.serviceName = serviceName;
                cart.addressKey
                //set service id
                let serviceId = "";
                if (serviceName == "Shipping") {

                    serviceId = await ServiceRepo.getDefaultServiceByName(company.id, "Delivery");

                } else {
                    serviceId = await ServiceRepo.getDefaultServiceByName(company.id, serviceName);

                }
                if (serviceId == null) {
                    throw new ValidationException(serviceName + ' Service Is not Available')
                }
                cart.serviceId = serviceId;


                if (cart.serviceName == "Delivery") {

                    if (data.addressKey != "" && data.addressKey != null) {   //the addressKey is required when the service = Delivery

                        let branch = await BranchesRepo.getAddressKeyBranchId(company.id, data.addressKey)  //get branch of the selected addressKey
                        //update branchId, minimumOder, deliveryCharge
                        let nbranchId = branch.data.id
                        cart.addressKey = addressKey;
                        cart.minimumOrder = Number(branch.data.minimumOrder);
                        cart.deliveryCharge = Number(branch.data.deliveryCharge);

                        cart.calculateTotal(company.afterDecimal);

                        branchId = nbranchId
                        data.branchId = nbranchId
                    } else { throw ("addressKey is required ") }
                } else if (cart.serviceName == "Shipping") {


                    cart.minimumOrder = 0;
                    cart.addressKey = addressKey;
                    // const shippimgTotal = await this.CalculateDeliveryPrice(company, data.addressKey, cart);

                } else {

                    cart.addressKey = "";
                    cart.minimumOrder = 0;
                    cart.deliveryCharge = 0;

                }


                // if it is pickup the branchId is reqired 
                if ((cart.branchId == null || cart.branchId == "") && (branchId == null || branchId == "")) {
                    throw new Error("Branch Id Is Required")
                }

                /*   false >> no change in the cart 
                     true  >> there is change in the cart
                     update cart when the branchId has been changed
                                1. set cart.branchId= new branchId  
                                2.chek availabilities of the product in the new branch 
                                3.return new cart   */

                if (cart.branchId != branchId) {
                    if ((cart.branchId == null || cart.branchId == "") && (branchId == null || branchId == "")) {
                        throw new Error("Branch Is Required")
                    } else if (branchId != null && branchId != "") {
                        cart.branchId = branchId
                        cart.branchName = await BranchesRepo.getBranchName(branchId)
                    }



                    // cart = (await this.checkBranchAvailability(client, { sessionId: sessionId, branchId: branchId }, company)).data

                    // let itemsAvailability = cart.lines.filter((f) => f.outOfStock == true)
                    // if (itemsAvailability.length > 0) {
                    //      return new ResponseData(false, "",cart); //some products out of stock
                    // }

                }


                await BranchesRepo.validateServiceAvailability(client, cart.serviceName, cart.branchId, company.timeOffset)
                await this.setRedisCart(company.id, sessionId, cart)
                cart = (await this.checkBranchAvailability(client, { sessionId: sessionId, branchId: cart.branchId }, company)).data

                //await this.setRedisCart(company.id, sessionId, cart)

                return new ResponseData(true, "", cart)

            } else {
                throw new Error("cart is not created")
            }

        } catch (error: any) {
            await client.query("ROLLBACK");


            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async ChangeService(data: any, company: Company, date: any) {
        const client = await DB.excu.client();
        try {
            let branchId = data.branchId
            const sessionId = data.sessionId;
            const serviceName = data.serviceName;
            const addressKey = data.addressKey;
            let cartData = await this.getRedisCart(company.id, sessionId)  //get user cart


            let cart = new Invoice(); //new cart 

            if (cartData) {

                cart.ParseJson(cartData);
                //I think no need
                // if (!(cart.lines.length > 0)) {
                //     return new ResponseData(false, "NO Change >> Cart is Empty", cart);
                // }

                //service name  requied 
                if ((serviceName == null || serviceName == "")) {
                    throw new Error("service Name Is Required")
                }

                //set cart service Name 
                cart.serviceName = serviceName;
                if (serviceName != "DineIn") {
                    cart.tableId = null;
                    cart.tableName = null;
                }
                cart.addressKey
                //set service id
                let serviceId = "";
                if (serviceName == "Shipping") {

                    serviceId = await ServiceRepo.getDefaultServiceByName(company.id, "Delivery");

                } else {
                    serviceId = await ServiceRepo.getDefaultServiceByName(company.id, serviceName);

                }
                if (serviceId == null) {
                    throw new ValidationException(serviceName + ' Service Is not Available')
                }
                cart.serviceId = serviceId;
                if (cart.serviceName != 'Delivery' && cart.serviceName != 'Shipping') {
                    cart.deliveryCharge = 0
                    cart.freeDeliveryOver = 0
                }

                if (cart.serviceName == "Delivery") {

                    const branch = await this.getDeliveryBranchData(client, company.id, data.lat, data.long, addressKey)
                    if (branch) {
                        let nbranchId = branch.id
                        cart.addressKey = addressKey;
                        cart.minimumOrder = Number(branch.minimumOrder);
                        cart.deliveryCharge = Number(branch.deliveryCharge);
                        cart.branchId = nbranchId
                        cart.branchName = branch.branchName
                        cart.freeDeliveryOver = branch.freeDeliveryOver;
                        cart.deliveryNote = branch.note;
                        cart.calculateTotal(company.afterDecimal);
                        branchId = nbranchId
                    } else {
                        throw new ValidationException("Invalid Delivery Address")
                    }

                    // if (data.addressKey != "" && data.addressKey != null) {   //the addressKey is required when the service = Delivery

                    //     let branch = await BranchesRepo.getAddressKeyBranchId(company.id, data.addressKey)  //get branch of the selected addressKey
                    //     //update branchId, minimumOder, deliveryCharge
                    //     let nbranchId = branch.data.id
                    //     cart.addressKey = addressKey;
                    //     cart.minimumOrder = Number(branch.data.minimumOrder);
                    //     cart.deliveryCharge = Number(branch.data.deliveryCharge);

                    //     cart.calculateTotal(company.afterDecimal);

                    //     branchId = nbranchId
                    //     data.branchId = nbranchId
                    // } else if (data.long && data.lat) {
                    //     let branch = await this.getNearbyBranchUsingZones(client,company.id,data.lat,data.long)
                    //     if(branch)
                    //     {
                    //         cart.branchId = branch.branchId
                    //         cart.minimumOrder = Number(branch.minimumCharge);
                    //         cart.deliveryCharge = Number(branch.deliveryCharge);
                    //         cart.customerLatLang = data.lat + ',' + data.long
                    //     }else{
                    //         throw new ValidationException("invalid address")  
                    //     }

                    // } else {
                    //     throw new ValidationException("address is required ")
                    // }

                } else if (cart.serviceName == "Shipping") {


                    cart.minimumOrder = 0;
                    cart.addressKey = addressKey;
                    // const shippimgTotal = await this.CalculateDeliveryPrice(company, data.addressKey, cart);

                } else {

                    cart.addressKey = "";
                    cart.minimumOrder = 0;
                    cart.deliveryCharge = 0;

                }


                // if it is pickup the branchId is reqired 
                if ((cart.branchId == null || cart.branchId == "") && (branchId == null || branchId == "")) {
                    throw new Error("Branch Id Is Required")
                }

                /*   false >> no change in the cart 
                     true  >> there is change in the cart
                     update cart when the branchId has been changed
                                1. set cart.branchId= new branchId  
                                2.chek availabilities of the product in the new branch 
                                3.return new cart   */

                if (cart.branchId != branchId) {
                    if ((cart.branchId == null || cart.branchId == "") && (branchId == null || branchId == "")) {
                        throw new Error("Branch Is Required")
                    } else if (branchId != null && branchId != "") {
                        cart.branchId = branchId
                        cart.branchName = await BranchesRepo.getBranchName(branchId)
                    }



                    // cart = (await this.checkBranchAvailability(client, { sessionId: sessionId, branchId: branchId }, company)).data

                    // let itemsAvailability = cart.lines.filter((f) => f.outOfStock == true)
                    // if (itemsAvailability.length > 0) {
                    //      return new ResponseData(false, "",cart); //some products out of stock
                    // }

                }


                await BranchesRepo.validateServiceAvailability(client, cart.serviceName, cart.branchId, company.timeOffset)
                await this.setRedisCart(company.id, sessionId, cart)
                cart = (await this.checkBranchAvailability(client, { sessionId: sessionId, branchId: cart.branchId }, company)).data

                //await this.setRedisCart(company.id, sessionId, cart)

                return new ResponseData(true, "", cart)

            } else {
                throw new Error("cart is not created")
            }

        } catch (error: any) {
            await client.query("ROLLBACK");


            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async validateUserPhone(client: PoolClient, phone: string, id: string) {
        try {
            // let hashedPassword = await AuthRepo.hashPassword(password.toString())


            // shopper.password = password

            const query: { text: string, values: any } = {
                text: `SELECT count(*) FROM "Shoppers" where lower(trim(phone)) =lower(trim($1)) and (id<> $2) `,
                values: [phone, id]
            }
            console.log(query.values)
            const shopperData = await client.query(query.text, query.values);
            console.log(shopperData.rows)
            if (shopperData.rows && shopperData.rows.length > 0 && (<any>shopperData.rows[0]).count > 0) {
                throw new ValidationException("Phone Number Already Used")
            }
            return false
        } catch (error: any) {



            throw new Error(error)
        }
    }

    public static async checkOut(data: any, company: Company, date: any, userSessionId: string) {
        const client = await DB.excu.client();
        const promotionsPointsProvider = await PromotionsPointsProvider.Create(client);
        const couponProvider = await CouponProvider.Create(client);
        const isNullOrEmpty = (v: any) =>
            v == null || (typeof v === "string" && v.trim() === "");
        let transactionStarted = false;

        try {
            const sessionId = data.sessionId;
            let branchId = data.branchId;
            const customer = data.customer;
            const serviceName: string | null = data.serviceName ?? null;
            let setServiceId: string | null = null;
            let loggedInUser = await ShopperRepo.getShopper(userSessionId, company);
            const pointsCount: number | undefined = data.pointsCount;
            const pointsAmount: number = data.pointsAmount ?? 0;
            const couponId: string | null = data.couponId;
            const promoCoupon: number | null = data.promoCoupon;
            // Start DB transaction
            await client.query("BEGIN");
            transactionStarted = true;



            /** Retrieve cart from Redis */
            const cartData = await this.getRedisCart(company.id, sessionId);
            if (!cartData) {
                throw new Error("Cart is not created");
            }
            cartData.pointsDiscount = pointsAmount;
            cartData.couponId = couponId;
            cartData.promoCoupon = promoCoupon;

            let cart = new Invoice()

            cart.ParseJson(cartData);
            let cartUserPhone = data.customer.phone
            /** Validate shopper phone if logged-in user exists */
            if (loggedInUser) {
                const userPhone = loggedInUser.phoneNumber ?? loggedInUser.phone;

                // Phone exists but not verified
                if (userPhone && !loggedInUser.isPhoneValidated) {
                    throw new ValidationException("User phone number must be validated");
                }

                // Phone missing → set from current checkout customer
                if (!userPhone && customer && customer.phone) {
                    loggedInUser.phone = customer.phone;
                    await ShopperRepo.setShopperPhone(client, loggedInUser, company, userSessionId);
                }
                cartUserPhone = userPhone
            }
            /** Validate cart hash or expired invoice date */
            const generatedHash = this.generateCartHash(cart.lines);
            const currentDate = moment(new Date()).format("DD/MM/YYYY");
            const invoiceDate = moment(cart.invoiceDate).format("DD/MM/YYYY");

            if ((cart.id && cart.id !== "") && (cart.cartHash !== generatedHash || currentDate !== invoiceDate)) {
                await this.setSessionIdToNull(client, cart.id);
                cart.createNewCart();
                cart.cartHash = generatedHash;
                await this.setRedisCart(company.id, sessionId, cart);
            } else {
                cart.cartHash = generatedHash;
                await this.setRedisCart(company.id, sessionId, cart);
            }

            /** Assign serviceId dynamically if not provided */
            if ((isNullOrEmpty(cart.serviceId)) && !isNullOrEmpty(serviceName)) {
                cart.serviceId = await ServiceRepo.getDefaultServiceByName(company.id, serviceName!);
                setServiceId = cart.serviceId;
            }

            /** Validate cart has items */
            if (!cart.lines || cart.lines.length === 0) {
                throw new Error("Cart is empty");
            }

            /** branchId and serviceName are required */
            if (isNullOrEmpty(cart.branchId) && isNullOrEmpty(branchId) && serviceName !== "Shipping") {
                throw new Error("Branch ID is required");
            }

            if (isNullOrEmpty(cart.serviceId) && isNullOrEmpty(serviceName)) {
                throw new Error("Service name is required");
            }

            // Use provided branchId or fallback to cart branch
            branchId = !isNullOrEmpty(branchId) ? branchId : cart.branchId;

            /** Check branch availability */
            const branchCheck = await this.checkBranchAvailability(
                client,
                { sessionId: sessionId, branchId: branchId },
                company,
                true
            );
            cart = branchCheck.data;

            if (setServiceId) cart.serviceId = setServiceId;
            cart.onlineStatus = "Placed";

            /** Item availability check before order creation */
            const itemsAvailability = cart.lines.filter((f: any) => f.outOfStock === true);
            if (itemsAvailability.length > 0) {
                await client.query("ROLLBACK");
                transactionStarted = false;
                return new ResponseData(false, "", cart);
            }

            /** Load payment method settings */
            const paymentSettingsResponse = await PaymnetMethodRepo.getPaymentMethodSettings(
                client, company.id, data.payment.name
            );
            const paymentData = paymentSettingsResponse.data.paymentMethod;
            cart.branchId = branchId;

            /** Save customer information */
            if (customer && !isNullOrEmpty(customer.phone)) {
                cart.customer.name = customer.name;
                cart.customer.phone = customer.phone;
                cart.customerContact = customer.phone;

                // Save address
                if (customer.address) {
                    if (!isNullOrEmpty(data.lat) && !isNullOrEmpty(data.long)) {
                        cart.customerLatLang = `${data.lat},${data.long}`;
                        customer.address.lat = data.lat.toString();
                        customer.address.lng = data.long.toString();
                    }
                    cart.customerAddress = customer.address;
                }

                // Persist customer record in DB
                if (!isNullOrEmpty(customer.name)) {
                    cart.customerId = await CustomerRepo.addEcommerceCustomer(client, cart.customerId, customer, company);
                    cart.customer.id = cart.customerId;
                }

                /** Special handling for delivery orders */
                if (cart.serviceName === "Delivery") {
                    if (!customer.address) {
                        throw new Error("Customer address is required");
                    }

                    const branch = await this.getDeliveryBranchData(
                        client, company.id, data.lat, data.long, cart.addressKey
                    );

                    if (!branch) throw new ValidationException("Invalid delivery address");

                    cart.minimumOrder = Number(branch.minimumOrder);
                    cart.deliveryCharge = Number(branch.deliveryCharge);
                    cart.branchId = branch.id;
                    cart.branchName = branch.branchName;
                    cart.freeDeliveryOver = branch.freeDeliveryOver;
                    cart.calculateTotal(company.afterDecimal);
                }
            }

            /** Parse schedule time if provided */
            let scheduleTimeStr: string | null = data.scheduleTime ? String(data.scheduleTime).trim() : null;
            if (!isNullOrEmpty(scheduleTimeStr)) {
                const scheduleDate = new Date(scheduleTimeStr!);
                if (!isNaN(scheduleDate.getTime())) cart.scheduleTime = scheduleDate;
            }

            if (isNullOrEmpty(cart.serviceId)) {
                throw new Error("Service name is required");
            }

            /** Save order note and car number */
            const note: string = !isNullOrEmpty(data.note) ? data.note : "";
            const carString: string = !isNullOrEmpty(data.carNumber) ? " Car Number: " + data.carNumber : "";
            cart.note = note + carString;

            if (data.auth) cart.subscriptionId = data.auth;
            if (loggedInUser && loggedInUser.id) cart.shopperId = loggedInUser.id;

            /** Validate service availability in branch */
            await BranchesRepo.validateServiceAvailability(
                client, cart.serviceName, cart.branchId, company.timeOffset
            );

            /** Create or update Estimate or Invoice based on service/payment rules */
            let invoiceData: any;
            cart.customerContact = cartUserPhone
            if (cart.serviceName === "Salon" && data.payment.name === "Cash") {
                const EstimateCart = new Estimate();
                EstimateCart.ParseJson(cart);

                if (!isNullOrEmpty(cart.id)) {
                    invoiceData = await EstimateRepo.editEstimate(client, EstimateCart, company, null);
                } else {
                    cart.invoiceDate = new Date();
                    cart.createdAt = new Date();
                    invoiceData = await EstimateRepo.addEstimate(client, EstimateCart, company);
                }
            } else {
                if (data.payment.name !== "Cash") {
                    cart.onlineData.onlineStatus = "Pending Payments";
                }

                if (!isNullOrEmpty(cart.id)) {
                    if (data.payment.name === "Cash" && cart.onlineData.onlineStatus === "Pending Payments") {
                        cart.onlineData.onlineStatus = "Placed";
                        cart.status = "Draft";
                    }
                    invoiceData = await InvoiceRepo.editInvoice(client, cart, company);
                } else {
                    cart.invoiceDate = new Date();
                    cart.createdAt = new Date();
                    invoiceData = await InvoiceRepo.addInvoice(client, cart, company);
                }
            }

            if (!invoiceData.success) throw new Error(invoiceData.msg);

            /** Extract final invoice/estimate */
            const invoice = invoiceData.data.invoice ?? null;
            const estimate = invoiceData.data.estimate ?? null;

            cart.id = invoice ? invoice.id : estimate.id;
            cart.countryCode = customer ? customer.phoneCode : null;

            let payment: any = null;

            /** Process digital payments */
            if (data.payment.name !== "Cash") {
                cart.onlineData.onlineStatus = "Pending Payments";
                cart.pointsDiscount = pointsAmount;

                payment = await PaymentRepo.addPayments(client, paymentData, cart, company);
                if (!payment || !payment.success) {
                    throw new ValidationException(payment?.msg || "Payment failed");
                }

                if (invoice) await this.setRedisCart(company.id, sessionId, invoice);
            } else {
                /** Cash payments: emit sockets and optionally persist cart */
                if (estimate) await SocketEstimateRepo.sendOnlineEstimate(estimate);
                else if (invoice) await SocketInvoiceRepo.sendOnlineInvoice(invoice);

                if (cart.serviceName === "DineIn" || cart.serviceName === "Salon") {
                    await this.setRedisCart(company.id, sessionId, estimate ?? invoice);
                }

                // Delete cart for final cash checkout
                if (data.payment.name === "Cash") {
                    await this.deleteRedisCart(company.id, sessionId);
                }
            }

            /** Redeem loyalty points after successful payment */
            if (company.features && company.features.length > 0 && company.features?.includes("PROMOTIONS") && ((data.payment.name === "Cash" || (payment && payment.success)) && pointsCount && invoice)) {
                const pointsPayment = await this.redeemPoints(
                    client, customer, company, invoice, pointsCount || 0,
                    promotionsPointsProvider, data.pointsAmount ? data.pointsAmount : 0
                );

                if (pointsPayment?.success && pointsPayment.data.id) {
                    const queueInstance = TriggerQueue.getInstance();
                    queueInstance.createJob({
                        type: "InvoicePayments",
                        invoiceIds: [invoice.id],
                        id: [pointsPayment.data.id],
                        companyId: company.id
                    });
                }
            }
            if (couponId && promoCoupon) {
                await this.redeemCoupon(company.id, cart.id, couponProvider, promoCoupon, couponId, client)
            }

            /** Commit DB transaction */
            await client.query("COMMIT");
            transactionStarted = false;

            /** Return payment response (if online) or empty array for cash */
            if (payment) return new ResponseData(true, "", payment.data);
            return new ResponseData(true, "", []);

        } catch (error: any) {

            /** Rollback if transaction was started and not committed */
            if (transactionStarted) {
                try { await client.query("ROLLBACK"); }
                catch (rollbackError) { console.error("Failed to rollback transaction", rollbackError); }
            }


            console.error(error);

            // Re-throw without losing stack trace
            throw error instanceof Error ? error : new Error(String(error));

        } finally {
            client.release();
        }
    }

    public static async redeemCoupon(companyId: string, cartId: string, couponProvider: CouponProvider, promoCoupon: number, couponId: string, client: PoolClient,) {
        if (promoCoupon) {

            await couponProvider.redeemCoupon(
                companyId,
                couponId,
                promoCoupon,
                cartId,
                client
            );


        }
    }

    public static async redeemPoints(client: PoolClient, customer: any, company: Company, cart: Invoice, pointsCount: number, promotionsPointsProvider: PromotionsPointsProvider, pointsAmount: number) {
        if (pointsCount && customer.phone) {

            const settings = await promotionsPointsProvider.getPointsSettings(company.id);
            if (settings.enabled) {
                await promotionsPointsProvider.SpendCustomerPointsByPhoneNumber(
                    company.id,
                    customer.phone,
                    { en: "Checkout use ", ar: "استخدام النقاط عند الدفع" },
                    "Using points for order",
                    pointsCount,
                    cart.invoiceNumber ?? "",
                    cart.id,
                    "SYSTEM"
                );

                let pointPayment = await InvoicePaymentRepo.addInvoicePayment(client, {

                    branchId: cart.branchId,
                    lines: [{
                        branchId: cart.branchId,
                        amount: pointsAmount,
                        invoiceId: cart.id,
                        paymentDate: cart.invoiceDate,
                        total: cart.total,
                    }],
                    paidAmount: pointsAmount,
                    paymentDate: cart.createdAt,
                    paymentMethodId: settings.paymentMethodId
                }, company);
                return new ResponseData(true, "", { id: pointPayment.data.id })
            }
        }
    }

    public static async getInvoiceBySessionId(client: PoolClient, sessionId: string, company: Company) {

        try {

            const query: { text: string, values: any } = {
                text: `SELECT "Invoices".* ,
                              
                              "Customers".name as "customerName",
                              "Tables".name as "tableName",
                              "Branches".name as "branchName",
                              "Services".type as "serviceName"
                       FROM "Invoices" 
                       Left join "Customers" ON  "Customers".id =  "Invoices"."customerId"
                       LEFT JOIN "Branches" ON "Branches".id = "Invoices"."branchId"
                       inner join "Services" on "Services".id = "Invoices"."serviceId"
                       LEFT JOIN "Tables" ON "Tables".id = "Invoices"."tableId"
                      where "onlineData"->>'sessionId' =$1
                      and "Branches"."companyId" = $2
                      `,
                values: [sessionId, company.id]
            }
            let invoiceData = await client.query(query.text, query.values);




            let invoice = new Invoice()
            invoice.ParseJson(invoiceData.rows[0])

            if (invoice.id != "" && invoice.id != null) {
                query.text = `SELECT "InvoiceLines".*, ("InvoiceLines"."serviceDate" ::text),
                "Products".name as "productName",
                  "Products".translation, 
                "Media".url->>'defaultUrl' as "mediaUrl"
                FROM "InvoiceLines"
                LEFT JOIN "Products" on "Products".id = "InvoiceLines"."productId"
                LEFT JOIN "Media" on "Media".id = "Products"."mediaId"
                where "invoiceId"=$1
                `
                query.values = [invoice.id]

                let invoiceLines = await client.query(query.text, query.values);


                for (let index = 0; index < invoiceLines.rows.length; index++) {
                    const element: any = invoiceLines.rows[index];
                    const line = new InvoiceLine();
                    line.ParseJson(element)
                    query.text = `SELECT "InvoiceLineOptions".*,
                                         "Options"."name" as "optionName",
                                                     "Options".translation, 
                                                     "OptionGroups".title as  "optionGroupName",
                                                     "OptionGroups".translation as "optionGroupTranslation"

                                    FROM "InvoiceLineOptions"
                                    INNER JOIN "Options" on   "Options".id = "InvoiceLineOptions"."optionId"
                                     left join "OptionGroups" on "OptionGroups".id =   "InvoiceLineOptions"."optionGroupId"
                                    where "invoiceLineId"=$1`;
                    query.values = [line.id]

                    const options = await client.query(query.text, query.values);
                    line.options = options.rows;
                    invoice.lines.push(line)
                }


                query.text = `SELECT
                                "InvoicePaymentLines"."amount" as "paidAmount",
                                "PaymentMethods"."name" 
                             FROM "InvoicePaymentLines" 
                             INNER JOIN "InvoicePayments" ON "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                             INNER JOIN "PaymentMethods" ON "PaymentMethods".id = "InvoicePayments"."paymentMethodId"
                             where "invoiceId" = $1
                             and ("InvoicePayments".status = 'SUCCESS' )
                             `
                query.values = [invoice.id]
                let invoicePayments = await client.query(query.text, query.values);
                invoice.invoicePayments = invoicePayments.rows


                invoice.calculateTotal(company.afterDecimal);
                invoice.setOnlineStatus()



                let parentLine: InvoiceLine | undefined;
                invoice.lines.filter(f => f.parentId != null).forEach(element => {

                    parentLine = invoice.lines.find(f => f.id == element.parentId);

                    if (parentLine != null) {
                        parentLine!.subItems.push(element);
                        invoice.lines.splice(invoice.lines.indexOf(element), 1);
                    }
                });

                invoice.lines.filter(f => f.voidFrom != null).forEach(element => {
                    parentLine = invoice.lines.find(f => f.id == element.voidFrom);
                    if (parentLine != null) {
                        parentLine!.voidedItems.push(element);
                        invoice.lines.splice(invoice.lines.indexOf(element), 1);
                    }
                });
                return invoice

            }


        } catch (error: any) {
            console.log(error)


            throw new Error(error)
        }
    }

    public static async getEstimateBySessionId(client: PoolClient, sessionId: string, company: Company) {

        try {


            const query: { text: string, values: any } = {
                text: `SELECT "Estimates".* ,
                                "Customers".name as "customerName",
                                "Tables".name as "tableName",
                                "Branches".name as "branchName",
                                "Services".type as "serviceName"
                            
                        FROM "Estimates" 
                        Left join "Customers" ON  "Customers".id =  "Estimates"."customerId"
                        Left join "Employees" ON  "Employees".id =  "Estimates"."salesEmployeeId"
                        LEFT JOIN "Branches" ON "Branches".id = "Estimates"."branchId"
                        inner join "Services" on "Services".id = "Estimates"."serviceId"
                        LEFT JOIN "Tables" ON "Tables".id = "Estimates"."tableId"
                        where "onlineData"->>'sessionId' =$1
                        and "Branches"."companyId" = $2`,
                values: [sessionId, company.id]
            }
            let EstimateData = await client.query(query.text, query.values);

            let estimate = new Estimate()
            estimate.ParseJson(EstimateData.rows[0])
            query.text = `SELECT "EstimateLines".*, ("EstimateLines"."serviceDate" ::text),
            "Products".name as "productName",
                 "Products".translation, 
            "Media".url->>'defaultUrl' as "mediaUrl",
                "Employees".name as "employeeName"
                
            FROM "EstimateLines"
            LEFT JOIN "Products" on "Products".id = "EstimateLines"."productId"
            Left join "Employees" ON  "Employees".id =  "EstimateLines"."salesEmployeeId"
            LEFT JOIN "Media" on "Media".id = "Products"."mediaId"
            where "estimateId"=$1
            `
            query.values = [estimate.id]

            let estimateLines = await client.query(query.text, query.values);


            for (let index = 0; index < estimateLines.rows.length; index++) {
                const element: any = estimateLines.rows[index];
                const line = new EstimateLine();
                line.ParseJson(element)
                query.text = `SELECT "EstimateLineOptions".*,
                    "Options".translation,
                                        "Options"."name" as "optionName"
                                FROM "EstimateLineOptions"
                                INNER JOIN "Options" on   "Options".id = "EstimateLineOptions"."optionId"
                                where "estimateLineId"=$1`;
                query.values = [element.id]

                const options = await client.query(query.text, query.values);

                line.options = options.rows;
                estimate.lines.push(line)
            }


            // query.text = `SELECT
            //                 "InvoicePaymentLines"."amount" as "paidAmount",
            //                 "PaymentMethods"."name" 
            //              FROM "InvoicePaymentLines" 
            //              INNER JOIN "InvoicePayments" ON "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
            //              INNER JOIN "PaymentMethods" ON "PaymentMethods".id = "InvoicePayments"."paymentMethodId"
            //              where "invoiceId" = $1
            //              and "InvoicePayments".status = 'SUCCESS'
            //              `
            // query.values = [invoice.id]
            // let invoicePayments = await client.query(query.text, query.values);
            // invoice.invoicePayments = invoicePayments.rows


            estimate.calculateTotal(company.afterDecimal);
            return estimate

        } catch (error: any) {


            throw new Error(error)
        }
    }




    public static async getOrderBySessionId(client: PoolClient, sessionId: string, company: Company) {

        try {

            const query: { text: string, values: any } = {
                text: ` with v1 as( 
                            select 'Invoice' as "cartSource" from "Invoices" where "companyId" = $2 and "onlineData"->>'sessionId' = $1
                            union all
                            select 'Estimate' as "cartSource" from "Estimates" where "onlineData"->>'sessionId' = $1
                            limit 1 	
                        )
                        select "cartSource" from v1 `,
                values: [sessionId, company.id]
            }
            let invoiceSource = await client.query(query.text, query.values);



            if (invoiceSource.rowCount != null && invoiceSource.rowCount > 0) {

                let orderInfo;

                if (invoiceSource.rows[0].cartSource == "Invoice") {
                    orderInfo = await this.getInvoiceBySessionId(client, sessionId, company)
                } else if (invoiceSource.rows[0].cartSource == "Estimate") {
                    orderInfo = await this.getEstimateBySessionId(client, sessionId, company)
                }
                if (orderInfo) {
                    return new ResponseData(true, "", orderInfo)
                } else {
                    return new ResponseData(false, "", orderInfo)
                }


            }


            return new ResponseData(true, "", null)

        } catch (error: any) {


            throw new Error(error)
        }
    }



    public static async getDeliveryBranchData(client: PoolClient, companyId: string, customerLat: number, customerLng: number, addressesKey: string) {
        try {
            const deliveryType = {
                text: `SELECT "template"->>'deliveryAreaType' as "deliveryAreaType" FROM "WebSiteBuilder" where "companyId" = $1 and "type"  = 'ThemeSettings' `,
                values: [companyId]
            }

            let type = await DB.excu.query(deliveryType.text, deliveryType.values);
            let deliveryAreaType;
            if (type && type.rows && type.rows.length > 0) {
                deliveryAreaType = (<any>type.rows[0]).deliveryAreaType
            }



            if ((!deliveryAreaType) || deliveryAreaType == 'addresses') {
                if (!addressesKey) {
                    throw new ValidationException("Address Key Is Required")
                }
                let branch = await BranchesRepo.getAddressKeyBranchId(companyId, addressesKey)  //get branch of the selected addressKey

                return branch.data
            } else {
                if (!customerLat || !customerLng) {
                    throw new ValidationException("lat and lng are Required")
                }
                let branch = await this.getNearbyBranchUsingZones(client, companyId, customerLat, customerLng)  //get branch of the selected addressKey

                return branch
            }

        } catch (error: any) {
            throw new Error(error)
        }
    }



    public static getDistance(customerLat: number, customerLng: number, branchLat: number, branchLng: number): number {
        const from = point([customerLng, customerLat]);
        const to = point([branchLng, branchLat]);

        const distInKm = distance(from, to, { units: 'kilometers' });
        return distInKm;
    }

    public static async getNearbyBranchUsingZones(client: PoolClient, companyId: string, customerLat: number, customerLng: number) {
        try {


            const query = {
                text: `
                SELECT 
                    "coveredZones",
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', "Branches".id,
                            'name', "Branches"."name",
                            'location', "Branches"."location"
                        )
                    ) AS "branches"
                FROM "Companies"
                INNER JOIN "Branches" ON "Branches"."companyId" = "Companies".id
                WHERE "Companies".id = $1
                and "Branches"."onlineAvailability" = true
                GROUP BY "Companies".id
            `,
                values: [companyId],
            };

            const result = await client.query(query.text, query.values);

            if (!result.rows || result.rows.length === 0) {
                throw new ValidationException("Invalid Delivery Address")
            }

            const { branches, coveredZones } = result.rows[0];

            if (!branches?.length || !coveredZones?.length) {
                throw new ValidationException("Invalid Delivery Address")
            }

            let nearestBranch: any = null;
            let nearestDistance = Infinity;
            let matchedZone: any = null;

            for (const branch of branches) {
                const location = branch.location;
                if (!location?.lat || !location?.lng) continue;

                const distance = this.getDistance(customerLat, customerLng, location.lat, location.lng);

                // Check zones from closest to farthest
                const sortedZones = coveredZones.sort((a: any, b: any) => a.radius - b.radius);

                for (const zone of sortedZones) {
                    if (distance <= zone.radius) {
                        // Customer is within this zone for this branch
                        if (distance < nearestDistance) {
                            nearestDistance = distance;
                            nearestBranch = branch;
                            matchedZone = zone;
                        }
                        break; // Stop at the first matched zone
                    }
                }
            }

            if (!nearestBranch || !matchedZone) {
                throw new ValidationException("Invalid Delivery Address")
            }

            return {
                id: nearestBranch.id,
                branchName: nearestBranch.name,
                deliveryCharge: matchedZone.deliveryCharge,
                minimumOrder: matchedZone.minimumCharge,
                matchedZoneRadius: matchedZone.radius,
                freeDeliveryOver: matchedZone.freeDeliveryOver,
                note: matchedZone.note,
                customerDistance: nearestDistance
            };
        } catch (error: any) {
            throw new Error(error);
        }
    }



    public static async getAddressKeyBranchId(client: PoolClient, companyId: string, addressKey: string) {
        try {



            const query: { text: string, values: any } = {
                text: `with "addresses" as (select 
                      "coveredAddresses"->>'type' as type,
                      jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'address'as "addressKey",
                      jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'minimumOrder'as "minimumOrder",
                      jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'deliveryCharge'as "deliveryCharge",
                      "Branches".id as "branchId"
                      from "Branches"
                      where "companyId" = $1
                    )
                      select * from "addresses"
                      where "addressKey" = $2 `,
                values: [companyId, addressKey]
            }

            let branch = await client.query(query.text, query.values);

            let data = {
                id: (<any>branch.rows[0]).branchId,
                deliveryCharge: (<any>branch.rows[0]).deliveryCharge,
                minimumOrder: (<any>branch.rows[0]).minimumOrder
            }
            return new ResponseData(true, "", data)
        } catch (error: any) {

            console.log(error)
            throw new Error(error)
        }
    }


    public static generateCartHash(cartLines: any[]): string {
        const cleaned = cartLines.map(line => ({
            productId: line.productId,
            id: line.id,
            quantity: line.quantity,
            price: line.price,
            modifiers: line.modifiers || [],
            notes: line.notes || ''
        }));
        return crypto.createHash('sha256').update(JSON.stringify(cleaned)).digest('hex');
    }


    public static async setSessionIdToNull(client: PoolClient, invoiceId: string) {
        try {

            await client.query(`UPDATE "Invoices"
                                    SET "onlineData" = jsonb_set("onlineData", '{sessionId}', 'null'::jsonb)
                                    WHERE id = $1;`, [invoiceId])
        } catch (error: any) {
            throw new Error(error)
        }
    }
}


