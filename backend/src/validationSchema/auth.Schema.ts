import { ValidateReq } from "./validator";

export class AuthValidation{
    public static async validateAuth(data:any)
    {
        const schema={
            type:"object", 
            properties:{
                email:{type:'string'  , "isNotEmpty": true,transform: ["trim"]},
                password:{type:'string' , "isNotEmpty": true}
            },
            required: ["email","password"],
            additionalProperties: true,
            errorMessage: {
                properties: {
           
                    email: "email Must Be String",
                    password: "password Must Be String"
                },
                required: {
                    email: "email is Required",
                    password: "password is Required"
                },
            }
           }
        
        return await ValidateReq.reqValidate(schema,data);  
        
    }
}