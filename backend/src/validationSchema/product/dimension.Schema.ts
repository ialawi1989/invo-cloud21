import { ValidateReq } from "@src/validationSchema/validator"

export class DimensionValidation{

    public static async AddDimesionValidation(data: any) {

        const attributeSchema = {
            type: "object",
            properties: {
                name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
                code: { type: "string" }
            },
            required: ["name", "code"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    name: "name Must Be String",
                    code: "code Must Be String"
                },
                required: {
                    name: "name is Required",
                    code: "code is Required"
                },
            }
        }


        const schema = {
            type: "object",
            properties: {
                name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
                displayType: { type: ["string", "null"], enum: ["buttons", "dropdown", "radio"] },
                attributes: { type: "array", items: attributeSchema, uniqueAttributesBy: ["name", "code"] }
            },
            required: ["name", "attributes"],
            additionalProperties: true,
            errorMessage: {
                properties: {

                    name: "name Must Be String",
                    attributes: "attributes Must Be array",
                    displayType: "displayType Must Be one of :[buttons, dropdown or radio]"


                },
                required: {
                    name: "name is Required",
                    attributes: "attributes is Required",


                },
            }
        }


        const validation = await ValidateReq.reqValidate(schema, data);
        return validation;
    }

    public static async attributeValidation(data: any) {

        const schema = {
            type: "object",
            properties: {
                name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
                code: { type: "string" }
            },
            required: ["name", "code"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    name: "name Must Be String",
                    code: "code Must Be String"
                },
                required: {
                    name: "name is Required",
                    code: "code is Required"
                },
            }
        }

        const validation = await ValidateReq.reqValidate(schema, data);
        return validation;
    }

    public static async dimensionValidation(data:any){
        const attributesSchema = {
            type: "object",
            properties: {
                name: { type: "string"   , "isNotEmpty": true,transform: ["trim"] },
                code:{type:"string"},
            },
            required: ["name","code"],
            additionalProperties: false,
            errorMessage: {
                properties: {
                    name: "name Must Be String",
                    code: "code Must Be String",
                },
                required: {
                    name: "name is Required",
                    code: "code is Required",

                },
              }
        }

        const schema={
            type: "object",
            properties: {
   
              name: { type: "string"  , "isNotEmpty": true,transform: ["trim"]},
              attributes:{type:"array",items:attributesSchema}
            },
            required: ["name", "attributes"],
            additionalProperties: false,
            errorMessage: {
                properties: {
                    name: "name Must Be String",
                },
                required: {
                    name: "name is Required",
                    attributes: "attributes is Required",

                },
              }
        }

        return await ValidateReq.reqValidate(schema,data)
  
    }
}