import { ValidateReq } from "@src/validationSchema/validator"

export class DepartmentValidation{
    public static async departmentValidation (data:any){
        const schema ={
            type:"object",
            properties:{
           
                name:{type:"string"  , "isNotEmpty": true,transform: ["trim"]},
            },
            required:["name"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    name: "name Must Be String"
                },
                required: {
                    name: "name is Required"
                },
              }
        }

        return await ValidateReq.reqValidate(schema,data)
    }
}