import { Helper } from "@src/utilts/helper";
import { ValidateReq } from "../validator"

export class InvoiceValidation {
  public static async invoiceValidation(data: any) {

    data = Helper.trim_nulls(data);
    const subItemOptionsSchema = {
      type: "object",
      properties: {
        qty: { type: "number" },
        price: { type: "number" },
        optionId: { type: "string" },
      },
      required: ["optionId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          qty: "qty must be a number",
          price: "qty must be a number",
          optionId: "optionId is Required",

        }
      }
    }
    const subItemSchema = {
      type: "object",
      properties: {
        productId: { type: "string" },
        qty: { type: "integer" },
        price: { type: "number" },
        options: { type: "array", items: subItemOptionsSchema }
      },
      required: ["productId", "qty"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          qty: "qty must be a number",
          price: "price must be a number",
          productId: "accountId is Required",

        }
      }
    }


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
    const invoiceLineOptionsSchema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        invoiceLineId: { type: "string", "isNotEmpty": true },
        qty: { type: "integer" },
        note: { type: ["string"] ,transform: ["trim"]},
        price: { type: "number" },
        optionId: { type: "string" ,transform: ["trim"]},
      },
      required: ["qty", "price", "optionId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          qty: "qty must be a number",
          price: "price must be a number",
          optionId: "accountId is Required",

        }
      }
    }
    const invoiceLineSchema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        invoiceId: { type: "string" },
        productId: { type: ["string", "null"],transform: ["trim"] },
        qty: { type: "number" },
        batch: { type: "string" },
        serial: { type: "string" },
        total: { type: "number" },
        price: { type: "number" },
        note: { type: ["string"] ,transform: ["trim"]},
        seatNumber: { type: "integer" },
        salesEmployee: { type: "string" },
        subItems: { type: "array", items: subItemSchema },
        taxId: { type: ["string", "null"] },
        taxes: { type: ["array", "null"], items: taxesSchema },
        taxTotal: { type: "number" },
        taxPercentage: { type: "number" },
        invoiceLineOptions: { type: "array", items: invoiceLineOptionsSchema }
      },
      required: ["qty", "price", "accountId"],
      additionalProperties: true,
      errorMessage: {
     
        properties: {
          qty: "qty must be a number",
          price: "unitCost must be a number",
          accountId: "accountId is Required",

        }
      }
    }

    const schema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        customerId: { type: "string",transform: ["trim"] },

        invoiceNumber: { type: "string", "isNotEmpty": true },
        refrenceNumber: { type: "string" ,transform: ["trim"]},
        branchId: { type: "string", "isNotEmpty": true },
        note: { type: "string"  ,transform: ["trim"]},
        guests: { type: "integer" },

        tableId: { type: ["string", "null"] },
        total: { type: "number" },
        lines: { type: "array", items: invoiceLineSchema, minItems: 1 }
      },
      required: ["invoiceNumber", "branchId", "lines", "customerId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          invoiceNumber: "invoiceNumber is Required",
          branchId: "branchId is Required",
          customerId: "customerId is Required",

        },
        required: {
          invoiceNumber: "invoiceNumber is Required",
          branchId: "branchId is Required",
          customerId: "customerId is Required",
        },
      }
    }

    return await ValidateReq.reqValidate(schema, data)
  }

  public static async invoiceValidationForReurringInvoice(data: any) {

    data = Helper.trim_nulls(data);
    const subItemOptionsSchema = {
      type: "object",
      properties: {
        qty: { type: "number" },
        price: { type: "number" },
        optionId: { type: "string" },
      },
      required: ["optionId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          qty: "qty must be a number",
          price: "qty must be a number",
          optionId: "optionId is Required",

        }
      }
    }
    const subItemSchema = {
      type: "object",
      properties: {
        productId: { type: "string" },
        qty: { type: "integer" },
        price: { type: "number" },
        options: { type: "array", items: subItemOptionsSchema }
      },
      required: ["productId", "qty"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          qty: "qty must be a number",
          price: "price must be a number",
          productId: "accountId is Required",

        }
      }
    }


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
    const invoiceLineOptionsSchema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        invoiceLineId: { type: "string", "isNotEmpty": true },
        qty: { type: "integer" },
        note: { type: ["string"] ,transform: ["trim"]},
        price: { type: "number" },
        optionId: { type: "string" ,transform: ["trim"]},
      },
      required: ["qty", "price", "optionId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          qty: "qty must be a number",
          price: "price must be a number",
          optionId: "accountId is Required",

        }
      }
    }
    const invoiceLineSchema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        invoiceId: { type: "string" },
        productId: { type: ["string", "null"],transform: ["trim"] },
        qty: { type: "number" },
        batch: { type: "string" },
        serial: { type: "string" },
        total: { type: "number" },
        price: { type: "number" },
        note: { type: ["string"] ,transform: ["trim"]},
        seatNumber: { type: "integer" },
        salesEmployee: { type: "string" },
        subItems: { type: "array", items: subItemSchema },
        taxId: { type: ["string", "null"] },
        taxes: { type: ["array", "null"], items: taxesSchema },
        taxTotal: { type: "number" },
        taxPercentage: { type: "number" },
        invoiceLineOptions: { type: "array", items: invoiceLineOptionsSchema }
      },
      required: ["qty", "price", "accountId"],
      additionalProperties: true,
      errorMessage: {
     
        properties: {
          qty: "qty must be a number",
          price: "unitCost must be a number",
          accountId: "accountId is Required",

        }
      }
    }

    const schema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        customerId: { type: "string",transform: ["trim"] },
        refrenceNumber: { type: "string" ,transform: ["trim"]},
        branchId: { type: "string", "isNotEmpty": true },
        note: { type: "string"  ,transform: ["trim"]},
        guests: { type: "integer" },

        tableId: { type: ["string", "null"] },
        total: { type: "number" },
        lines: { type: "array", items: invoiceLineSchema, minItems: 1 }
      },
      required: [ "branchId", "lines", "customerId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
        
          branchId: "branchId is Required",
          customerId: "customerId is Required",

        },
        required: {
         
          branchId: "branchId is Required",
          customerId: "customerId is Required",
        },
      }
    }

    return await ValidateReq.reqValidate(schema, data)
  }



  public static async ecommerceInvoiceValidation(data: any) {

    data = Helper.trim_nulls(data);
    const subItemOptionsSchema = {
      type: "object",
      properties: {
        qty: { type: "number" },
        price: { type: "number" },
        optionId: { type: "string" },
      },
      required: ["optionId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          qty: "qty must be a number",
          price: "qty must be a number",
          optionId: "optionId is Required",

        }
      }
    }
    const subItemSchema = {
      type: "object",
      properties: {
        productId: { type: "string" },
        qty: { type: "integer" },
        price: { type: "number" },
        options: { type: "array", items: subItemOptionsSchema }
      },
      required: ["productId", "qty"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          qty: "qty must be a number",
          price: "price must be a number",
          productId: "accountId is Required",

        }
      }
    }


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
    const invoiceLineOptionsSchema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        invoiceLineId: { type: "string", "isNotEmpty": true },
        qty: { type: "integer" },
        note: { type: "string" },
        price: { type: "number" },
        optionId: { type: "string" },
      },
      required: ["qty", "price", "optionId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          qty: "qty must be a number",
          price: "price must be a number",
          optionId: "accountId is Required",

        }
      }
    }
    const invoiceLineSchema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        invoiceId: { type: "string" },
        productId: { type: ["string", "null"] },
        qty: { type: "integer" },
        batch: { type: "string" },
        serial: { type: "string" },
        total: { type: "number" },
        price: { type: "number" },
        seatNumber: { type: "integer" },
        salesEmployee: { type: "string" },
        subItems: { type: "array", items: subItemSchema },
        taxId: { type: ["string", "null"] },
        taxes: { type: ["array", "null"], items: taxesSchema },
        taxTotal: { type: "number" },
        taxPercentage: { type: "number" },
        invoiceLineOptions: { type: "array", items: invoiceLineOptionsSchema }
      },
      required: ["qty", "price", "accountId"],
      additionalProperties: true,
      errorMessage: {
     
        properties: {
          qty: "qty must be a number",
          price: "unitCost must be a number",
          accountId: "accountId is Required",

        }
      }
    }

    const schema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        branchId: { type: "string", "isNotEmpty": true },
        note: { type: "string" },
        guests: { type: "integer" },
        tableId: { type: ["string", "null"] },
        total: { type: "number" },
        lines: { type: "array", items: invoiceLineSchema, minItems: 1 }
      },
      required: [ "branchId", "lines"],
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

    return await ValidateReq.reqValidate(schema, data)
  }
}