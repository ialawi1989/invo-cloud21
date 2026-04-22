import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { Company } from "@src/models/admin/company";
import { Invoice } from "@src/models/account/Invoice";
import { ServiceRepo } from "@src/repo/admin/services.repo";
import { CustomerRepo } from "@src/repo/app/accounts/customer.repo";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { InvoiceRepo } from "@src/repo/app/accounts/invoice.repo";
import { AccountsRepo } from "@src/repo/app/accounts/account.repo";
import { ProductRepo } from '@src/repo/app/product/product.repo';
import { CartRepo } from '@src/repo/ecommerce/cart.repo';
import { ShopRepo } from '@src/repo/ecommerce/shop.repo';
import { Request, Response, NextFunction } from 'express';
import { PoolClient } from 'pg';
import { SocketInvoiceRepo } from '@src/repo/socket/invoice.socket';
import { Branches } from '@src/models/admin/Branches';
const axios = require('axios');

export class order{

    static baseUrl() {
        return "https://api-test.convobot360.com/v1";
    }

    public static async getServiceIdByServiceName(client: PoolClient,branchId: string, serviceName: string, company: Company){
        try{
            const branches= ['b3cac885-ba05-4d0c-8a61-ac77da18a84d', '95afc684-7ddf-491b-ae9c-226bd5e8932f']
            const query : { text: string, values: any } = {
                text: `SELECT id,name FROM "Services" 
                        WHERE EXISTS (SELECT 1 
                                    FROM json_array_elements(branches) AS b 
                                    where (b->>'branchId')::uuid = $2
                                    and   (b->'setting'->>'enabled')::boolean =true 
                                    )
                        and "companyId" = $1 and "name" = $3`,
                values: [company.id, branchId, serviceName]
            }

            let service = await DB.excu.query(query.text, query.values);
            return (<any>service.rows[0]).id

        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async checkOut(client: PoolClient,data: any, company: Company) {
        
        try {
        
            let branchId   = data.branchId
            const customer = data.customer;
            const serviceName = data.serviceName;


            //let cartData = new Invoice().ParseJson(data)
            
            let cart = new Invoice();
            
            cart.ParseJson(data);
            cart.status = "Draft"
            if (!(cart.lines.length > 0)) {
                throw new Error("Cart is Empty")
            }

            if ((cart.branchId == null || cart.branchId == "") && (branchId == null || branchId == "")) {
                throw new Error("Branch Id Is Required")
            }

            if ((cart.serviceId == null || cart.serviceId == "") && (serviceName == null || serviceName == "")) {
                throw new Error("service Name Is Required")
            }
                
            if(cart.serviceId == null || cart.serviceId=="" && (serviceName != null && serviceName != ""))
            {
                cart.serviceId = await this.getServiceIdByServiceName(client,branchId, serviceName, company);
                if (cart.serviceId == null || cart.serviceId=="") {
                    throw(serviceName +" is not available ofr the selected branch")
                }
            }

            cart.branchId = branchId
            cart.serviceName = serviceName

            if (cart.serviceName == "Delivery") {
                if (customer.address == null) {
                    throw new Error("Customer Address is Required")
                } 
                if(!cart.deliveryCharge ){
                    throw new Error("delivery charge is reqired")
                }    
                
            }
            
            cart.onlineData.onlineStatus = "Placed"

            for (let index = 0; index < cart.lines.length; index++) {

                const line = cart.lines[index];
                let totalProductQtyInInvoice = 0;

                if (line.productId) {
                    // get the info of a prod in the new  brunch 
                    // prodDate ---> proudData
                    let prodDate: any = await ProductRepo.getProductBranchData(client, line.productId, branchId)
                    
                

                    // check if this proudct is available in the new brunch
                    //check if the prod has different price
                    let tempPrice = prodDate.price ? prodDate.price : prodDate.defaultPrice
                    if (tempPrice != line.price) {
                        line.priceChange = true;
                        line.price = tempPrice;
                    }

                    line.maxQtyItems = prodDate.maxItemPerTicket
                    // check Qty per ticket
                    if (prodDate.maxItemPerTicket && prodDate.maxItemPerTicket != 0 && prodDate.maxItemPerTicket < (line.qty + totalProductQtyInInvoice)) {
                        line.maxQtyExceeded = true

                    } else {
                        line.maxQtyExceeded = false

                    } 
                    
                    
                    let LineTotal = line.total;
                    line.calculateTotal(company.afterDecimal)
                    if (LineTotal != line.total) {
                        line.totalChange = true
                    } else {
                        line.totalChange = false
                    }

                    
                    if (prodDate.type == "menuItem" || prodDate.type == "service") {
                        line.outOfStock = false
                        continue;
                    }
                    

                    //check if the product is out of stock or not  

                    let linesWithSameProducts = cart.lines.filter(f=>f.id != line.id && f.productId == line.productId );
                    if(linesWithSameProducts )
                    {
                        for (let i = 0; i < linesWithSameProducts.length; i++) {
                            const item = linesWithSameProducts[i];
                            if (item.productId == line.productId) {
                                totalProductQtyInInvoice += item.qty
                            }
                        }
                    }


                    prodDate.onHand = prodDate.onHand != 0 ? prodDate.onHand: 3
                    line.itemsQtyOnStock = prodDate.onHand;
                    if (prodDate.onHand < line.qty + totalProductQtyInInvoice) {
                        line.outOfStock = true
                    } else {
                        line.outOfStock = false
                    }

                    
                    
                }
            }
            let tempCartTotal = cart.total
            cart.calculateTotal(company.afterDecimal);

            



            let itemsAvailability = cart.lines.filter((f) => f.outOfStock == true)
            if (itemsAvailability.length > 0) {
                let outOfSstockProducts =  itemsAvailability.map(({id})=> id)
                return new ResponseData(false, "Out of stock Products: ", outOfSstockProducts);
            }

            let itemsWithDifferentPrice = cart.lines.filter((f) => f.priceChange == true)
            if (itemsWithDifferentPrice.length > 0) {
                let IdsOfItemsWithDifferentPrice  =  itemsWithDifferentPrice.map((x)=> ({'id':x.productId,'actualPrice':x.price}))
                return new ResponseData(false, "The following Products has differnt price: ", IdsOfItemsWithDifferentPrice);
            }
            
            let InCorrectCalculation = cart.lines.filter((f) => f.totalChange == true)
            if (InCorrectCalculation.length > 0) {
                return new ResponseData(false, "The total is Incorrect: ", InCorrectCalculation);
            }

            if (tempCartTotal != cart.total) {
                return new ResponseData(false, "The total is Incorrect, it's Should be: ", cart.total);
            }

            

            if (customer && customer.phone != null && customer.phone != "") {
                cart.customer.name = customer.name;
                cart.customer.phone = customer.phone
                cart.customerContact = customer.phone;
                cart.customerAddress = customer.address;

                if (customer.name != "" && customer.name) {
                    cart.customerId = await CustomerRepo.addEcommerceCustomer(client, cart.customerId, customer, company)
                    cart.customer.id = cart.customerId
                }


            }

                let invoiceData;
                cart.note = data.note;

                let scheduleTime = data.scheduleTime ? data.scheduleTime.trim() : null

                if (scheduleTime != null && scheduleTime != "") {

                    let scheduleTime: any = new Date(data.scheduleTime)
                    scheduleTime.setTime(scheduleTime.getTime())
                    cart.scheduleTime = scheduleTime;

                }


                // scheduleTime = moment(scheduleTime).add(1, 'day').format("YYYY-MM-DD 00:00:00");
            
                if ((cart.serviceId == null || cart.serviceId == "") ) {
                    throw new Error("service Name Is Required")
                }

                const accountId = (await AccountsRepo.getSalesId(client, null, company.id)).id;
                cart.lines.forEach(f=> f.accountId = accountId)

                if (cart.id != null && cart.id != "") {
                    invoiceData = await InvoiceRepo.editInvoice(client, cart, company)

                } else {
                    cart.createdAt = new Date();
                    invoiceData = await InvoiceRepo.addInvoice(client, cart, company)
                }

                cart.id = invoiceData.data.id;
                
                /**send invoice to pos  */


                
                if (invoiceData.success) {
                    console.log("customerIdcustomerIdcustomerIdcustomerIdcustomerId",invoiceData.data.invoice.customerId)
                    await SocketInvoiceRepo.sendOnlineInvoice(invoiceData.data.invoice)

                    return new ResponseData(true, "", invoiceData)

                } else {
                    throw new Error(invoiceData.msg)
                }
                /** 
                 * 

                let paymentData = (await PaymnetMethodRepo.getPaymentMethodSettings(client, company.id, data.payment.name)).data.paymentMethod

                if (invoiceData.success) {
                    

                    if (data.payment.name != "Cash") {
                        let payment = await PaymentRepo.addPayments(client, paymentData, cart, company)

                        await this.setRedisCart(company.id, sessionId, invoiceData.data.invoice)
                        return new ResponseData(true, "", payment.data)
                    } else {
                        await SocketInvoiceRepo.sendOnlineInvoice(invoiceData.data.invoice)
                        if (cart.serviceName == "DineIn" || cart.serviceName == "Salon") {
                            await this.setRedisCart(company.id, sessionId, invoiceData.data.invoice)
                        } else {
                            await this.deleteRedisCart(company.id, sessionId)
                        }
                    }
                    await client.query("COMMIT");
                    return new ResponseData(true, "", [])

                } else {
                    throw new Error(invoiceData.msg)
                }*/


        } catch (error: any) {
        
            throw new Error(error)
        } 
    }

    public static async orderStatus(data: any[], token:string) {
        try {
        

            let config = {
                method: 'post',
                url: this.baseUrl() + '/invopos/order-status',
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${token}`
                }
            };

            let response = (await axios(config))
            

            if (response.data.status_code == 200) {
                return new ResponseData(true, "", response.data.detail)
            } else {
                return new ResponseData(false, "Invalid Input", response.data.detail)
            }
            
        } catch (error: any) {
            if(error.response.data){
               return new ResponseData(false,error.message, error.response.data ) 
            }
            else {
                return new  ResponseData(false,"",error.message ) 
            }
            
        }


    }


}




