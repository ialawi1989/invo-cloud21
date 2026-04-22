import { BatchValidation } from "../product/ProductBatch.Schema"
import { SerialValidation } from "../product/serials.Schema"
import { ValidateReq } from "../validator"

export class InventoryTransfersValidations {
  public static async inventoryTransfersValidation(data: any) {
    const inventoryTransferLineSchema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        InventoryTransferId: { type: "string" },
        productId: { type: "string" },
        qty: { type: "number" , exclusiveMinimum: 0, errorMessage: 'qty must be greater than zero.' },
        unitCost: { type: "number" },
        batches:{type:"array"},
        serials:{type:"array"},
      },
      required: ["productId", "qty"],

      additionalProperties: true,
      errorMessage: {
        properties: {
          productId: "productId is Required",
          qty: "qty must be a number ",

        },
        required: {
          productId: "productId is Required",
          qty: "qty is Required"
        },
      }
    }

    const schema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        createdDate: { type: "string" },
        reference: { type: "string" },
        branchId: { type: "string" },
        type: { type: "string", enum: ["Transfer In", "Transfer Out"] },
        status: { type: "string", enum: ["Open", "Confirmed"] },
        reason: { type: "string" },
        note: { type: "string" },
        confirmDatetime: { type: "string" },
        transferedToBranch: { type: ["string", "null"] },
        lines: { type: 'array', items: inventoryTransferLineSchema, minItems: 1 }
      },
      required: ["lines", "branchId", "status", "type"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          branchId: "branchId is Required",
          status: "status must be one of the following ['Open','Confirmed']",
          type: "type must be one of the following ['Transfer In','Transfer Out'] "
        },
        required: {
          branchId: "branchId is Required",
          status: "status is Required",
          type: "type is Required",
        },
      }
    }

    return await ValidateReq.reqValidate(schema, data)
  }
}