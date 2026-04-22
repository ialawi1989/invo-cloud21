import { ValidateReq } from "../validator"

export class KitchenSectionValidation {
  public static async kitchenSectionValidation(data: any) {
    const productSchema = {
      type: "object",
      properties: {
        id: { type: "string", transform: ["trim"], "isNotEmpty": true },
      },
      required: ["id"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          id: "id Must be String",
        },
        required: {
          id: "id is Required",
        },
      }
    }
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", transform: ["trim"], "isNotEmpty": true },
        products: { type: "array", items: productSchema, minItems: 1 }
      },
      required: ["products"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "name Must be String",
        },
        required: {
          id: "name is Required",
        },
      }
    }
    return await ValidateReq.reqValidate(schema, data)
  }
}