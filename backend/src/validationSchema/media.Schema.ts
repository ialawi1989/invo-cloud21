import { ValidateReq } from "./validator";

export class MediaValidation{
    public static async validateMedia(data:any)
    {

        const media ={
        
                type:"object", 
                properties:{
                
                    madiaType:{type:'object'},
                    media:{type:'object'},
                    companyId:{type:'string'},
                    size:{type:'number'}
                },
                required: ["media"],
                additionalProperties: true,
                errorMessage: {
                    properties: {
                        media: "media Must Be String",
                    },
                    required: {
                        media: "media is Required",
                   
                    },
                }
               
        }
        // const schema={
        //     type:"array", 
        //     items: media,
        //     minItems:1
        //    }
        
        return await ValidateReq.reqValidate(media,data);  
        
    }
}