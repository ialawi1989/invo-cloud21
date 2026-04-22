import { ValidateReq } from "@src/validationSchema/validator";

export class OptionValidation{

    public static async optionsValidation(data:any){
      const recipeschema = {
        type: "object",
        anyOf: [
          {
            properties: {
              usages: { 
                type: "number", 
                exclusiveMinimum: 0,  // Ensures usages > 0
                errorMessage: 'qty must be greater than zero.'  // Custom error message for invalid usages
              },
              inventoryId: { 
                type: "string" 
              },
            },
            required: ["inventoryId", "usages"],
            additionalProperties: true,
          },
          {
            properties: {
              usages: { 
                type: "number", 
                exclusiveMinimum: 0,  // Ensures usages > 0
                errorMessage: 'qty must be greater than zero.'  // Custom error message for invalid usages
              },
              recipeId: { 
                type: "string" 
              },
            },
            required: ["recipeId", "usages"],
            additionalProperties: true,
            errorMessage: {
              properties: {
                anyOf: "Either inventoryId or recipeId and usages are required",
                inventoryId: "inventoryId Must Be String",
                usages: "usages Must Be Number",
              },
              required: {
                anyOf: "Either inventoryId or recipeId and usages are required",
                recipeId: "recipeId is Required",
                usages: "usages is Required",
              },
            },
          },
        ],
        errorMessage: {
          // Global error message in case the data doesn't match any schema in 'anyOf'
          anyOf: "Either the inventoryId / recipeId with usages Greater than 0 is required ",
        },
      };
    
    const schema = {
        type:"object", 
        properties:{

        name:{type:'string'   , "isNotEmpty": true,transform: ["trim"]},
        displayName:{type:'string' },
        translation:{type:['object','null']}, // not empty {}
        price:{type:'number'}, //default:0
        isMultiple:{type:'boolean'},
        brandId:{type:'string'},
        isVisible:{type:'boolean'},
        recipe: { "type": "array", "items": recipeschema },

        },
        required: ["name","isMultiple","isVisible"],
        additionalProperties: true,
        errorMessage: {
            properties: {
              name: "name Must Be String",
              
            },
            required: {
              name: "name is Required",
  
            },
          }
      }
  
      return await ValidateReq.reqValidate(schema,data);
    }

    public static async optionGroupValidation(data:any){

        const optionSchema ={
            type:"object", 
            properties:{
                index:{type:"integer"},// not null  
                qty:{type:"number"},// not null  
                optionId:{type:'string'} // not null 
            },
            required: ["optionId","index"],
            additionalProperties: true
        }
        const schema = {
            type:"object", 
            properties:{

            title:{type:'string'  , "isNotEmpty": true},
            minSelectable:{type:'integer'},//default => 1
            maxSelectable:{type:'integer'},//default => 1
            translation:{type:['object','null']},
            required:{type:'boolean'},
            brandId:{type:'string'},
            options:{type:'array',items:optionSchema},
            },
            required: ["title","minSelectable","maxSelectable","options"],
            additionalProperties: true
          }

          return await ValidateReq.reqValidate(schema,data);
    }
}