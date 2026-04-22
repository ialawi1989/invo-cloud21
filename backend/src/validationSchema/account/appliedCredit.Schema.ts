import { ValidateReq } from "../validator"

export class AppliedCreditsValidation  {
    public static async invoiceApplyCreditValidation  (data:any)
    {
 
        const appliedCreditSchema={
              type:"object", 
            properties:{
                id:{type:"string"},
                invoiceId:{type:"string"},
                reference:{type:"string"},
                amount:{type:"number"}
            },
            required: ["id","invoiceId","amount","reference"],
            additionalProperties: true, 
            errorMessage: {
                properties: {
                    invoiceId: "invoiceId must be string",
                    amount: "amount must be number",
                    reference: "reference must be string",
                },
                required: {
                    invoiceId: "invoiceId is Required",
                    amount: "amount is Required",
                    reference: "reference is Required",
                },
            }
        }
           return await ValidateReq.reqValidate(appliedCreditSchema,data);
    
    }

    public static async billingAppliedCredit  (data:any)
    {

        const appliedCreditSchema={
              type:"object", 
            properties:{
                id:{type:"string"},
                billingId:{type:"string"},
                reference:{type:"string"},
                amount:{type:"number"}
            },
            required: ["id","billingId","amount","reference"],
            additionalProperties: true, 
        }
           return await ValidateReq.reqValidate(appliedCreditSchema,data);
    }
}