import { body, validationResult } from "express-validator";
import {CompanyValdation} from"@src/validationSchema/admin/company.Schema"
import { ValidateReq } from "@src/validationSchema/validator";
export class BrandValdation{
 static brandSchema ={
  type:"object",
  properties:{

    companyId:{type:"string"},
    name:{type:"string"  , transform: ["trim"], "isNotEmpty": true},
    slug:{type:"string"},
    type:{type:"string"},
    translation:{type:"object"}
  }, 
  required: ["name","slug"],
  additionalProperties: false,
  errorMessage: {
    properties: {
      name: "name Must Be String",
      address: "slug Must Be String",
    },
    required: {
      name: "name is Required",
      address: "slug is Required",
    },
  }
 }

 public static async Brandvalidation(data:any){

    return await ValidateReq.reqValidate(BrandValdation.brandSchema,data)
 
 }
 public static async editBrandvalidation(data:any){
  
    const schema={
      type:"object",
      properties:{
        brand:BrandValdation.brandSchema,
        brandId:{type:"string"}
      },
      required: ["brand","brandId"],
      additionalProperties: true
    }

    return await ValidateReq.reqValidate(schema,data)

 }
}