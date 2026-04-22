import { ValidateReq } from "@src/validationSchema/validator"

export class RecipeValidation {
  public static async addRecipeValidation(data: any) {
    const recipeschema = {
      type: "object",
      properties: {
        inventoryId: { type: "string" },
        usage: { type: "number"  ,exclusiveMinimum: 0, errorMessage: 'qty must be greater than zero.'},
      },
      required: ["usage", "inventoryId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          usage: "usage Must Be Number",
          inventoryId: "batch Must Be String",
        },
        required: {
          usage: "usage is Required",
          inventoryId: "inventoryId is Required",
        },
      }
    }
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
        description: { type: "string" },
        items: { type: "array", "items": recipeschema }
      },
      required: ["name", "items"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "name Must Be String",
          items: "items Must Be array",
        },
        required: {
          name: "name is Required",
          items: "items is Required",
        },
      }
    }

    return await ValidateReq.reqValidate(schema, data)
  }
}