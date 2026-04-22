import { ValidateReq } from "../validator";
import { BranchValdation } from "./branch.Schema";
import { BrandValdation } from "./brand.Schema";
import { CompanyValdation } from "./company.Schema";
import { EmployeeValidation } from "./employee.Schema";

export class CompanyGroupValidation {
    static companyGroupSchema = {
        type: "object",
        properties: {
      
          name: { type: "string", transform: ["trim"], "isNotEmpty": true},
          slug:{type:"string"},
          translation: { type: "object" },
        },
        required: ["name"],
        additionalProperties: true
      };
    
    
      public static async addcompanyGroupValidation(data: any) {
     
          const schema = {
            type: "object",
            properties: {
              companyGroup:CompanyGroupValidation.companyGroupSchema,
              company:  CompanyValdation.companySchema ,
              employee:  EmployeeValidation.employeesSchema ,
              branch: {type:"array",items: BranchValdation.branchSchema }
            },
            required: ["company", "employee", "companyGroup", "branch"],
            additionalProperties: false
          }
    
         return await ValidateReq.reqValidate(schema,data)
    
    
      }
    
      public static async editompanyGroupyValidation(data:any){
    
      
          return await ValidateReq.reqValidate(CompanyGroupValidation.companyGroupSchema,data)
    
      }
}