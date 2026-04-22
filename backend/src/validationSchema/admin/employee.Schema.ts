import { body, validationResult } from "express-validator";
import { CompanyValdation } from "@src/validationSchema/admin/company.Schema";
import { ValidateReq } from "@src/validationSchema/validator";

export class EmployeeValidation {
  static employeesSchema = {
    type: "object",
    properties: {
    
      companyId:{ type: "string" },
      companyGroupId:{ type: ["string","null"]},
      name: { type: "string"  , transform: ["trim"], "isNotEmpty": true},
      email: { type: ["string","null"], transform: ["trim"]},
      password: { type: "string" },
      passCode: { type: "string" },
      branchId: { type: "string" },
      admin:{type:'boolean'},
      user:{type:'boolean'},
      //TODO: ADD PRIVILEGEDID  => STRING OR NULL 
      //MSR : NULL OR STRING NOT EMPTY STRING 
    },
    required: ["name"],
    additionalProperties: true,
    errorMessage: {
      properties: {
        name: "name Must Be String",
      },
      required: {
        name: "name is Required",
      },
    }
  };

  public static async EmployeeValidation(data: any) {
      return await ValidateReq.reqValidate(EmployeeValidation.employeesSchema, data)
  }

  public static async editEmployeeValidation(data:any){
  
      const schema ={
        type: "object",
        properties: {
          employee:EmployeeValidation.employeesSchema,
          employeeId:{   type: "object",employeeId:"string"}
        },
        required: ["employee","companyId"],
        additionalProperties: true
      }

      return await ValidateReq.reqValidate(schema,data)

  }
}