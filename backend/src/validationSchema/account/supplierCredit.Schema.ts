import { ValidateReq } from "../validator";

export class SupplierCreditValidation {
    public static async validateSupplierCredit (data:any)
    {
        const taxesSchema={
            type: "object",
            properties: {
              taxId:{type:"string", transform: ["trim"], "isNotEmpty": true},
              taxPercentage:{type:"number"},
            },
            required: ["taxPercentage","taxId"],
            additionalProperties: true,
            errorMessage: {
              properties: {
                taxPercentage: "taxPercentage must be a number",
                taxId: "taxId must be string",
              },
              required: {
                taxPercentage: "taxPercentage is Required",
                taxId: "taxId is Required",
              },
          }
          }
        const supplierCreditLine={
            type:"object",
            properties:{
    
                billingLineId:{type:"string","isNotEmpty": true},
                productId:{type:["string","null"]},
                note:{type:["string","null"]},
                total:{type:"number"},
                subTotal:{type:"number"},
                serials:{type:["array","null"]},
                batches:{type:["array","null"]},
                unitCost:{type:["number"]},
                qty:{type:["number"]},
                accountId:{type:"string","isNotEmpty": true},
                taxId:{ type: ["string" ,"null"]},
                taxes:{ type: ["array","null"], items:taxesSchema},
                taxTotal:{ type: "number"},
                taxPercentage:{ type: "number"},
            },
            required: ["accountId"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    productId: "productId Must Be String",
                    accountId: "accountId Must Be String",
                },
                required: {
                    accountId: "accountId is Required",
                    productId: "productId is Required",
                },
              }
        }


        const schema={
            type:"object", 
            properties:{
  
                supplierCreditNumber:{type:"string"},
                billingId:{type:"string","isNotEmpty": true},
                shipping:{type:"number"},
                total:{type:"number"},
                supplierCreditDate:{type:"string"},
                branchId:{type:"string"},
                lines:{type:'array',items:supplierCreditLine}
            },
            required: ["billingId","lines","branchId"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    billingId: "billingId Must Be String",
                    branchId: "branchId Must Be String",
                },
                required: {
                    billingId: "billingId is Required",
                    branchId: "branchId is Required",
                },
              }
           }

           return await ValidateReq.reqValidate(schema,data);
    }
}