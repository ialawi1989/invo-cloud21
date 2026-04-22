import { Helper } from "@src/utilts/helper";
import { ValidateReq } from "../validator"

export class InvoicePaymentValidation {

  //TODO:invoiceId or "note"
  public static async invoicePaymentValidation(data: any) {
    data = Helper.trim_nulls(data);
    const invoicePaymentLineSchema = {
      type: "object",
      properties: {
        id:{type:["string","null"]},
        invoiceId: { type: ["string", "null"] },
        note: { type: "string" },
      },
      required: [ "amount" ],
      additionalProperties: true,
      errorMessage: {
        properties: {
          branchId: "branchId is Required",
        },
        required: {
          branchId: "branchId is Required",

        },
      }
    }
    const schema = {
      type: "object",
      properties: {
        id:{type:["string","null"]},
        date: { type: "string" },
        paymentMethodId:{type: ["string","null"] },
        branchId: { type: ["string","null"] },
        lines: { type: "array", items: invoicePaymentLineSchema,minItems:1 }
      },
      required: ["paymentMethodId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          paymentMethodId: "paymentMethodId is Required",
        },
        required: {
          paymentMethodId: "paymentMethodId is Required",

        },
      }
    }

    return await ValidateReq.reqValidate(schema, data)
  }
}