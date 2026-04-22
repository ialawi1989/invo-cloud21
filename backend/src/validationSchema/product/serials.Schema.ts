import { ValidateReq } from "@src/validationSchema/validator"

export class SerialValidation{
    public static serialSchema={
        type:'object',
        properties:{
            branchProductId:{type:'string'},
            serial:{type:'string'}, 
        },
        required: ["serial"],
        additionalProperties: true,
        errorMessage: {
            properties: {
                serial: "serial Must Be String",
            },
            required: {
                serial: "serial is Required",
  
            },
        }
    }

    public static async serialValidation(data:any){
        return await ValidateReq.reqValidate(SerialValidation.serialSchema,data);
    }
}