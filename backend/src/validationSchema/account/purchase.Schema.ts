import { Helper } from "@src/utilts/helper";
import { ValidateReq } from "../validator"

export class PurchaseValidation {
    public static async purchaseValidationValidation (data:any)
    {
      data = Helper.trim_nulls(data);
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
        const purchaseOrderLineSchema = {
            type: "object",
            properties: {
        
              purchaseOrderId: { type: "string" },
              productId: { type: ["string", "null"] ,transform: ["trim"]},
              note: { type: ["string", "null"] ,transform: ["trim"]},
              barcode:{type:"string"},
              qty: { type: "number" },
              unitCost: { type: "number" },
              accountId: { type: ["string" ,"null"]},
              taxId:{ type: ["string" ,"null"]},
              taxes:{ type: ["array","null"], items:taxesSchema},
              taxTotal:{ type: "number"},
              taxPercentage:{ type: "number"},
         
            },
            oneOf: [{ required:["productId"] }, { required: ["note"] }],
            required: ["qty","unitCost"],
            additionalProperties: true,
            errorMessage: {
              oneOf: "productId or note is Required",
              properties: {
                  qty: "qty must be a number",
                  unitCost: "unitCost must be a number",
                  accountId: "accountId is Required"
              }
          }
        }
        const schema={
            type: "object",
            properties: {
    
              purchaseNumber: { type: "string" },
              reference: { type: "string" },
              employeeId: { type: "string" },
              supplierId: { type: "string" },
              dueDate: {type:"string"},
              createdAt : {type : "string"}, //debit,credit
              branchId : {type : "string"},
              lines:{type:'array',items:purchaseOrderLineSchema, minItems:1}
            },
            required: ["supplierId","lines","branchId"],
            additionalProperties: true,
            errorMessage: {
              properties: {
                purchaseNumber: "billingNumber is Required",
                branchId: "branchId is Required",
                customerId:"customerId is Required",
      
              },
              required: {
                invoiceNumber: "billingNumber is Required",
                branchId: "branchId is Required",
                customerId:"customerId is Required",
              },
            }
        }

        return await ValidateReq.reqValidate(schema, data)
    }
}