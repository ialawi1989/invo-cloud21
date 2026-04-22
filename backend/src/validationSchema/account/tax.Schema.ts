import { ValidateReq } from "../validator";

export class TaxValidation {
    public static async taxValidation(data:any){
            const taxesSchema={
            type: "object",
            properties: {
              taxId:{type:"string", transform: ["trim"], "isNotEmpty": true},
              taxPercentage:{type:"number"},//default =>0
            },
            required: ["taxPercentage","taxId"],
            }
        const schema={
            type:"object", 
            properties:{
            
                name:{type:"string", transform: ["trim"], "isNotEmpty": true},
                taxPercentage:{type:"number"},
                taxType:{type:["string","null"]},
                taxes:{ type: ["array","null"], items:taxesSchema},
                },
            required: ["name","taxPercentage"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    name: "name Must Be String",
                    taxPercentage: "cost Must Be Number",
                },
                required: {
                    name: "name is Required",
                    taxPercentage: "taxPercentage is Required",
                },
              }
           }

           return await ValidateReq.reqValidate(schema,data);
    }
}