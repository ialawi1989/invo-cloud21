

import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company";
import { Product } from "@src/models/product/Product";
import { integer } from "aws-sdk/clients/cloudfront";

import { double } from "aws-sdk/clients/lightsail";
import { Catalog } from "aws-sdk/clients/sagemaker";
import s from "connect-redis";
import { response } from "express";

const axios = require('axios');
const { authorize } = require('passport');

//trandData of request  
class option {
    id: string ="" ;
    name: string ="";
    price: double =0.0 ;
    translation: {name:{ ar: string ; en: string }} = {name:{ar:"",en:""}}  
}
class optionGroup {
    id: string = "";
    title: string = "";
    minSelectable: integer = 0;
    maxSelectable: integer = 0;
    options: any[] =[]
}
class group {
    id: string = "";
    name: string = "";
    index: integer = 0;
    products: string[] = []
}

class tax {
    country_code: string = "bh";
    tax_id: string = "";
    tax_name: string ="";
    tax_percent: Number = 0;
}

class WProduct {
    id: string = "";
    branches: { available: boolean, branchId: string }[]=[];
    name: string ="";
    category: string | null =null;
    imageUrl: string | null="";

    translation: 
        {name       : { ar: string ; en: string  },
        description : { ar: string ; en: string },
       } = {name:{ar:"",en:""},description:{ar:"",en:""}};

    price: double=0.0;
    description: String | null = "";
    maxItemPerTicket : integer | null = null;
    available: boolean = true;
    taxable: boolean= false;
    tax : tax[]=[];
    optionsGroups: optionGroup[]=[];
}



export class whatsappProduct {

    private static Username = "invopos9001";
    private static  Password = "nhJQNTYkULljydHdWS3aAN73DSOwaN";
    static token = Buffer.from(`${this.Username}:${this.Password}`, 'utf8').toString('base64')

    static baseUrl() {
        return "https://api-test.convobot360.com/v1";
    }

  

    public static async options(optionList: any[], company: Company, token:any) {
        try {
            let options :option[] = [];
            for (const opt of optionList) {
              
                let temp = new option() ;
                temp.id   = opt.id,
                temp.name = opt.name,
                temp.price=  opt.price? opt.price: 0,
                temp.translation.name.en = (opt.translation)?.name.en ? opt.translation.name.en : "" 
                temp.translation.name.ar = (opt.translation)?.name.ar ? opt.translation.name.ar : "" 
                options.push(temp)

            }
        

            let config = {
                method: 'post',
                url: this.baseUrl() + '/invopos/options',
                data: options,
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
        
    public static async catalog(products: any[], company: Company,token:any) {
        try {
            let catalog :WProduct[] = [];

            
            for (const product of products) {
                
                 let tempProduct = new WProduct()
                 tempProduct.id         = product.id
                 tempProduct.name       = product.name
                 tempProduct.imageUrl   = product.imageUrl ? product.imageUrl: null
                 tempProduct.branches   = product.branches
                 tempProduct.price      = product.defaultPrice
                 tempProduct.description = product.description ? product.description: null
                 tempProduct.category    = product.menuSectionName  ? product.menuSectionName: null
                 tempProduct.branches.forEach((f:any)=>{f.price = f.price ? f.price : tempProduct.price} )   
                 tempProduct.maxItemPerTicket = !product.maxItemPerTicket || product.maxItemPerTicket == 0 ? null: product.maxItemPerTicket

                if (!product.translation || Object.keys(product.translation).length == 0){
                    tempProduct.translation    = tempProduct.translation ;
                }else{
                    if(product.translation.hasOwnProperty('name') && tempProduct.translation){
                        tempProduct.translation.name.ar = (product.translation as any).name.ar ? (product.translation as any).name.ar : "";
                        tempProduct.translation.name.en = (product.translation as any).name.en ? (product.translation as any).name.en : "" ;
                    }
                    if(product.translation.hasOwnProperty('description') && tempProduct.translation){
                        tempProduct.translation.description.ar = (product.translation as any).description.ar ? (product.translation as any).description.ar : "" ;
                        tempProduct.translation.description.en = (product.translation as any).description.en ? (product.translation as any).description.en : "" ;
                    }
                }

                tempProduct.price      = product.defaultPrice
                tempProduct.available  = product.isDeleted ? false :  true
                tempProduct.taxable    = product.taxId     ? true  :  false 
                

                if (!product.optionGroups ){
                    tempProduct.optionsGroups    = [];
                }else{
                    if(tempProduct.optionsGroups){
                        for (const optionG of product.optionGroups ){
                            let temp = new optionGroup()
                            temp.id = optionG.optionGroupId 
                            temp.title = optionG.title
                            temp.maxSelectable = optionG.maxSelectable
                            temp.minSelectable = optionG.minSelectable
                            temp.options = optionG.options
                            tempProduct.optionsGroups.push(temp)
                        }
                    }
                
                }
                

                if(product.taxesInfo){
                    for(const taxInfo of product.taxesInfo){
                        let tempTax = new tax()
                        tempTax.tax_id = taxInfo.taxId
                        tempTax.tax_name = taxInfo.taxName
                        tempTax.tax_percent = taxInfo.taxPercent
                       
                        tempProduct.tax.push(tempTax)
                    }
                }
                


              
                catalog.push(tempProduct)

            }


        
        
            let config = {
                method: 'post',
                url: this.baseUrl() + '/invopos/catalog',
                data: catalog,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${this.token}`
                }
            };

            let response = (await axios(config));
            

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

    public static async getCatalogList(company: Company,token:string) {
        try {

            let config = {
                method: 'Post',
                url: this.baseUrl()  + '/invopos/catalog/list/' + company.id,
                headers: {
                    'Content-Type': 'application/json',
                   'Authorization': `Basic ${token}`
                }
            };

            let response = (await axios(config)).data

            if (response) {
                return new ResponseData(true, "", response)
            } else {
                return new ResponseData(false, "No Product Available", {})
            }
        } catch (error: any) {

            throw new Error(error)
        }

    }

    public static async Groups(categories: any[], company: Company,token:any) {
        try {

            let groupsList :group[] = [];
            
            for (const category  of categories) {
                let temp = new group() ;
                temp.id   = category.id,
                temp.name = category.name,
                temp.products = category.products ? category.products : [],
                groupsList.push(temp)

            }
           // console.log(groupsList)

            let config = {
                method: 'post',
                url: this.baseUrl() + '/invopos/menu-groups',
                data: groupsList,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${token}`
                }
            };

            let response = (await axios(config));
            

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






