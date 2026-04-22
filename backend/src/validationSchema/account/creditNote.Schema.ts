import { Helper } from "@src/utilts/helper";
import { ValidateReq } from "../validator";

export class CreditNoteValidation {
    public static async creditNoteValidation(data: any) {
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
        const creditNoteLineSchema = {
            type: "object",
            properties: {
                id: { type: ["string", "null"] },
                invoiceLineId: { type: "string" },
                creditNoteId: { type: "string" },
                total: { type: "number" },
                price: { type: "number" },
                qty: { type: "number" },
                batch: { type: ["string"] },
                serial: { type: "string" },
                productId: { type: ["string", "null"],transform: ["trim"] },
                accountId: { type: "string" },
                note: { type: ["string", "null"],transform: ["trim"] },
                employeeId: { type: "string" },
                taxId:{ type: ["string" ,"null"]},
                taxes:{ type: ["array","null"], items:taxesSchema},
                taxTotal:{ type: "number"},
                taxPercentage:{ type: "number"},
            },
            required: ["price", "qty", "invoiceLineId"],
            additionalProperties: true,
            errorMessage: {
                oneOf: "productId or note is Required",
                properties: {
                    qty: "qty must be a number",
                    unitCost: "unitCost must be a number",
                    accountId: "accountId is Required"
                } , required: {
                    price: "price is Required",
                    qty: "qty is Required",
                    invoiceLineId: "invoiceLineId is Required",
                }
            }
        }
        const schema = {
            type: "object",
            properties: {
                id: { type: ["string", "null"] },
                creditNoteNumber: { type: "string" },
                invoiceId: { type: "string" },
                refrenceNumber: { type: "string" },
                total: { type: "number" },
                branchId: { type: ["string", "null"] },
                employeeId: { type: "string" },
                tableId: { type: ["string", "null"] },
                guests: { type: "integer" },
                lines: { type: 'array', items: creditNoteLineSchema, minItems: 1 }
            },
            required: ["creditNoteNumber", "lines", "invoiceId"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    creditNoteNumber: "creditNoteNumber Must be String",
                    invoiceId: "invoiceId is Must be String",
                },
                required: {
                    creditNoteNumber: "creditNoteNumber is Required",
                    invoiceId: "invoiceId is Required",
                },
            }
        }

        return await ValidateReq.reqValidate(schema, data);
    }
}