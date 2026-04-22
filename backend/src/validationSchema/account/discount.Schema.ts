import { ValidateReq } from "../validator";

export class DiscountValidation {
    public static async discountValidation(data:any){
      
        const schema={
            type:"object", 
            properties:{
                name:{type:"string", transform: ["trim"], "isNotEmpty": true},
                amount:{type:"number"}, // not empty 
                percentage:{type:"boolean"}, // not empty 
            
            },
            required: ["name","amount","percentage"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    name: "name  must be String",
                    amount: "amount must be Number",
                    percentage: "percentage must be boolean"
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