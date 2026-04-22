
import { ValidateReq } from "../validator"
export class PaymentMethodValidation{
    public static async paymentMethodValidation(data: any) {

        const schema = {
          type: "object",
          properties: {
     
            name: { type: "string", "isNotEmpty": true },
            type: { type: "string" ,  enum: ["Card", "Cash","point"]},//string => default Cash
            rate : { type: "number" },// not null number default => 1
            symbol:{type:"string"},
            accountId:{type: "string", "isNotEmpty": true },
            index:{type:"integer"},
            //afterDecimal=>  number => 0 default => 0
          },
          required: [ "name","accountId"],
          additionalProperties: true,
          errorMessage: {
            properties: {
              name: "name must be string",
              accountId: "accountId must be string",
            },
            required: {
              name: "name is Required",
              accountId: "accountId is Required"
            },
          }
        }
    
        return await ValidateReq.reqValidate(schema, data)
      }    
} 