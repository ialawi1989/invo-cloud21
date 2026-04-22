import { Category } from "@src/models/product/Category";
import { ValidateReq } from "@src/validationSchema/validator";

export class CategoryValidation{
    public static async categoreSchema(data:any){
        const schema ={
            type:"object",
            properties:{
                name:{type:"string"  , "isNotEmpty": true,transform: ["trim"]},
                departmentId:{type:"string", "isNotEmpty": true,transform: ["trim"]}
            },
            required:["name","departmentId"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    name: "name Must Be String",
                    departmentId: "departmentId Must Be String"
                },
                required: {
                    name: "name is Required",
                    departmentId: "departmentId is Required",
                },
              }
        }

        return await ValidateReq.reqValidate(schema,data)
    }
}