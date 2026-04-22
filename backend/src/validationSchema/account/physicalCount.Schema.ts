import { BatchValidation } from "../product/ProductBatch.Schema"
import { SerialValidation } from "../product/serials.Schema"
import { ValidateReq } from "../validator"


export class PhysicalCountValidations {
  public static async physicalCountValidation(data: any) {

    const physicalCountLineSchema = {
      type: "object",
      properties: {

        productId: { type: "string" },
        physicalCountId: { type: "string" },
        enteredQty: { type: "number" },
        expectedQty: { type: "number" },
        batches:{type:"array"},
        serials:{type:"array"},
        type: { type: "string" },
      },
      required: ["productId", "enteredQty"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          productId: "productId Must Be String",
          expectedQty: "expectedQty Must Be Number",
        },
        required: {
          productId: "productId is Required",
          expectedQty: "expectedQty is Required",

        },
      }
    }
    const schema = {
      type: "object",
      properties: {

        reference: { type: "string" },
        status: { type: "string", enum: ['Open', 'Calculated', 'Closed'] },
        note: { type: "string" },
        type: { type: "string" },
        branchId: { type: "string" },
        createdDate: { type: "string" }, //debit,credit
        closedDate: { type: "string" },
        calculatedDate: { type: "string" },

        lines: { type: 'array', items: physicalCountLineSchema, minItems: 1 }
      },
      required: ["lines", "branchId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          branchId: "branchId Must Be String",
        },
        required: {
          branchId: "branchId is Required"
        },
      }
    }

    return await ValidateReq.reqValidate(schema, data)
  }
}