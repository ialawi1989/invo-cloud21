
import { ValidateReq } from "../validator"

export class ServiceValidation {
    public static async validateService (data:any)
    {

      //TODO: 
      // TRANSLATION ={
      //  ar:"", => NOT EMPTY 
      //  en:""=> NOT EMPTY  
     // }
        const schema={
            type:"object", 
            properties:{
           
                name:{type:"string", transform: ["trim"], "isNotEmpty": true},//STRING NOT NULL 
                index:{type:"integer"},//STRING NOT NULL 
                setting:{type:"object"},//STRING NOT NULL //TODO: SET DEFAULT {enable:true} 
                type:{type:"string","isNotEmpty": true}, //STRING NOT NULL 
                //TODO :TRANSLATION => NOT NULL 
                //TODO: PRICELABELID => NULL OR NOT EMPTY STRING
            },
            required: ["name","type"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                  name: "name Must Be String",
                  type: "type Must Be String",
                },
                required: {
                  name: "name is Required",
                  type: "type is Required",
                },
              }
           }

           return await ValidateReq.reqValidate(schema,data);
    }
}