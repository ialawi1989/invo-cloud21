import { ValidateReq } from "../validator"

export class RefundValidation {
    public static async validateRefund (data:any)
    {

        const refundLines={
            type:"object",
            properties:{
    
                paymentMethodId:{type:"string","isNotEmpty": true},
                amount:{type:"number"},
            },
            required: ["paymentMethodId","amount"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    paymentMethodId: "branchId Must Be String",
                    amount: "branchId Must Be Number",
                },
                required: {
                    paymentMethodId: "paymentMethodId is Required",
                    amount: "amount is Required"
                },
              }
        }


        const schema={
            type:"object", 
            properties:{
  
                total:{type:"number"},
                creditNoteId:{type:"string","isNotEmpty": true},
                lines:{type:'array',items:refundLines,minItems:1}
            },
            required: ["creditNoteId","lines"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    creditNoteId: "creditNoteId Must Be String",
                },
                required: {
                    creditNoteId: "creditNoteId is Required",
             
                },
              }
           }

           return await ValidateReq.reqValidate(schema,data);
    }
}