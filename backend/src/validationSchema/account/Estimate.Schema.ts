import { Helper } from "@src/utilts/helper";
import { ValidateReq } from "../validator"

export class EstimateValidation {
    public static async estimateValidation (data:any)
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
        const estimateLineSchema={
            type: "object",
            properties: {
              id:{type:["string","null"]},
              productId:{ type: ["string","null"],transform: ["trim"] },
              note:{ type: ["string","null"] ,transform: ["trim"]},
              qty: { type: "number"},
              total:{ type: "number"},
              price:{type: "number"},
              taxes:{type: ["array","null"],items:taxesSchema},
              taxPercentage:{type: "number"},
              taxType:{type: ["string","null"]},
            },
            required: ["qty","price"],
            additionalProperties: true,
            errorMessage: {
              properties: {
                  qty: "qty must be a number",
                  price: "unitCost must be a number",
                  accountId: "accountId is Required"
              }
          }
        }
        const schema ={
            type: "object",
            properties: {
              id:{type:["string","null"]},
              estimateNumber:{ type: "string", "isNotEmpty": true },
              refrenceNumber:{ type: "string"},
              branchId:{type: "string", "isNotEmpty": true},
              note: { type: "string"},
              guests: { type: "integer"},
              tableId:{ type: ["string" ,"null"]},
              total:{ type: "number"},
              lines:{type:"array",items:estimateLineSchema,minItems:1}
            },
            required: ["estimateNumber","branchId","lines"],
            additionalProperties: true,
            errorMessage: {
              properties: {
                estimateNumber: "estimateNumber is Required",
                branchId: "branchId is Required",
      
              },
              required: {
                estimateNumber: "estimateNumber is Required",
                branchId: "branchId is Required",
      
              },
            }
        }

        return await ValidateReq.reqValidate(schema,data)
    }
}