import { Helper } from "@src/utilts/helper";
import { ValidateReq } from "../validator"

export class ExpenseValidation {
    public static async expenseValidation (data:any)
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
      data = Helper.trim_nulls(data);
        const lines={
            type: "object",
            properties: {
              id:{type:["string","null"]},
              accountId:{ type: "string" ,transform: ["trim"], "isNotEmpty": true },
              taxId:{ type: ["string" ,"null"]},
              taxes:{ type: ["array","null"], items:taxesSchema},
              taxTotal:{ type: "number"},
              taxPercentage:{ type: "number"},
              amount:{ type: "number"},
              total:{ type: "number"},
            },
            required: ["accountId","amount"],
            errorMessage: {
              required: {
                accountId: "accountId is Required",
                amount: "amount is Required",
              },
            },
            additionalProperties: true
        }
        const schema ={
            type: "object",
            properties: {
              id:{type:["string","null"]},
              expenseDate:{ type: "string", "isNotEmpty": true },
              paidThroughAccountId:{type: "string"},
              paymentMethodId:{type: "string", "isNotEmpty": true},
              supplierId: { type:[ "string","null"]},
              branchId: { type: "string"},
              total:{ type: "number"},
              referenceNumber:{ type: ["string" ,"null"]},
              expenseNumber:{ type: "string" },
              lines:{type: "array", items:lines,minItems:1 }
            },
            required: ["paymentMethodId","lines","branchId"],
            additionalProperties: true,
            errorMessage: {
              required: {
                paymentMethodId: "paymentMethodId is Required",
                branchId:"branchId is Required"
      
              },
            },
        }

        return await ValidateReq.reqValidate(schema,data)
    }
}