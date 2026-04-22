import { ValidateReq } from "../validator";

export class LabelTemplateValidation{
    public static async validateLabelTemplate(data:any)
    {

        const schema ={
        
                type:"object", 
                properties:{
                
                    name:{type:'string'}, //TODO:NOT EMPTY 
                    template:{type:'array'},//TODO:NOT EMPTY 
                    //TODO: LABELHEIGHT ,LENGHT NUMBER => NOT EMPTY SET DEFAULT IN  MODLE
                    //TODO : DPI INT NOT EMPTY NOT NULL  
                },
                required: ["name","template"],
                additionalProperties: true,
                errorMessage: {
                    properties: {
               
                        name: "name Must Be String",
                        template: "template Must Be array"
                    },
                    required: {
                        name: "name is Required",
                        template: "template is Required"
                    },
                }
               
        }

        
        return await ValidateReq.reqValidate(schema,data);  
        
    }
}