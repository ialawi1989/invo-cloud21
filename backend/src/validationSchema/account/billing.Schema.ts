import { Helper } from "@src/utilts/helper"
import { BatchValidation } from "../product/ProductBatch.Schema"
import { SerialValidation } from "../product/serials.Schema"
import { ValidateReq } from "../validator"

export class BillingValidation {
  public static async billnigPaymentsValidation(data: any) {
    //TODO: ADD isOpeningBalance if true then billId is null elese billingId IS REQUIRED 
    const billingPaymentLineSchema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        billingId: { type: ["string", "null"] },
      },
      required: [ "amount"],
      additionalProperties: true,
      errorMessage: {

        required: {
          billingId: "billingId is Required",
          amount: "amount is Required "
        },
      },
    }
    const schema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        paymentMethodId: { type: "string" },
        companyId: { type: ["string", "null"] },
        lines: { type: "array", items: billingPaymentLineSchema }
      },

      required: ["paymentMethodId"],
      errorMessage: {

        required: {
          paymentMethodId: "Payment Method is Required",

        },
      },

      additionalProperties: true
    }
    return await ValidateReq.reqValidate(schema, data)
  }

  public static async billingValidation(data: any) {

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
        id: { type: ["string", "null"] },
        billingId: { type: ["string", "null"] },
        productId: { type: ["string", "null"]  ,transform: ["trim"]},
        barcode: { type: "string" },
        qty: { type: "number"}, 
        unitCost: { type: "number" }, 
        accountId: { type: "string" },
        batches: { type: "array"  },
        note: { type: ["string"] ,transform: ["trim"]},
        serials: { type: "array" },
        taxId:{ type: ["string" ,"null"]},
        taxes:{ type: ["array","null"], items:taxesSchema},
        taxTotal:{ type: "number"},
        taxPercentage:{ type: "number"},
      },
      required: ["qty", "unitCost", "accountId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          qty: "qty must be a number",
          unitCost: "unitCost must be a number",
          accountId: "accountId is Required",
          barcode:"barcode must be string",
          taxPercentage:"taxPercentage must be a number"
        }
      }
    }
    const schema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        billingNumber: { type: "string", transform: ["trim"], "isNotEmpty": true },
        reference: { type: "string" },
        supplierId: { type: "string" },
        branchId: { type: "string" },
        lines: { type: 'array', items: purchaseOrderLineSchema, minItems: 1 }
      },
      required: ["supplierId", "lines", "billingNumber"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          billingNumber: "billingNumber must be string",
          supplierId: "supplierId is Required",
          branchId: "branchId is Required",
          reference:"reference must be a number"
        },
        required: {
          billingNumber: "billingNumber is Required",
          supplierId: "supplierId is Required",
          branchId: "branchId is Required",

        },
      }
    }



    return await ValidateReq.reqValidate(schema, data)
  }

  public static async billingValidationForReurringBill(data: any) {

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
        id: { type: ["string", "null"] },
        billingId: { type: ["string", "null"] },
        productId: { type: ["string", "null"]  ,transform: ["trim"]},
        barcode: { type: "string" },
        qty: { type: "number"}, 
        unitCost: { type: "number" }, 
        accountId: { type: "string" },
        batches: { type: "array"  },
        note: { type: ["string"] ,transform: ["trim"]},
        serials: { type: "array" },
        taxId:{ type: ["string" ,"null"]},
        taxes:{ type: ["array","null"], items:taxesSchema},
        taxTotal:{ type: "number"},
        taxPercentage:{ type: "number"},
      },
      required: ["qty", "unitCost", "accountId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          qty: "qty must be a number",
          unitCost: "unitCost must be a number",
          accountId: "accountId is Required",
          barcode:"barcode must be string",
          taxPercentage:"taxPercentage must be a number"
        }
      }
    }
    const schema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        reference: { type: "string" },
        supplierId: { type: "string" },
        branchId: { type: "string" },
        lines: { type: 'array', items: purchaseOrderLineSchema, minItems: 1 }
      },
      required: ["supplierId", "lines"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          
          supplierId: "supplierId is Required",
          branchId: "branchId is Required",
          reference:"reference must be a number"
        },
        required: {
         
          supplierId: "supplierId is Required",
          branchId: "branchId is Required",

        },
      }
    }



    return await ValidateReq.reqValidate(schema, data)
  }
}