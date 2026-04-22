import { ValidateReq } from "../validator";

export class SurchargeValidation {
    public static async surchargeValidation(data:any){
      
        const schema={
            type:"object", 
            properties:{
           
                name:{type:"string", transform: ["trim"], "isNotEmpty": true},
                amount:{type:"number"}, //not null
                percentage:{type:"boolean"},
            
            },
            required: ["name","amount","percentage"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    name: "name Must Be String",
                    amount: "amount Must Be Number",
                    percentage: "amount Must Be Boolean",
                },
                required: {
                    name: "name is Required",
                    amount: "amount is Required",
                    percentage: "percentage is Required",
                },
              }
           }

           return await ValidateReq.reqValidate(schema,data);
    }
}