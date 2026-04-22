import { ValidateReq } from "../validator";

export class RecieptTemplateValidation{
    public static async validateRecieptTemplate(data:any)
    {

        const schema ={
        
                type:"object", 
                properties:{
                
                    name:{type:'string'},//NOT NULL NOT EMPTY NOT NULL 
                    recieptTemplate:{type:'array'},//NOT NULL NOT EMPTY NOT NULL 
                    templateType:{type:'string'}//NOT EMPTY STRING OR NULL L 
                },
                required: ["name","recieptTemplate"],
                additionalProperties: true,
                errorMessage: {
                    properties: {
               
                        name: "name Must Be String",
                        recieptTemplate: "recieptTemplate Must Be array",

                    },
                    required: {
                        name: "name is Required",
                        recieptTemplate: "recieptTemplate is Required",
                  
                    },
                }
               
        }

        
        return await ValidateReq.reqValidate(schema,data);  
        
    }
}