import { BranchValdation } from "@src/validationSchema/admin/branch.Schema";
import { BrandValdation } from "@src/validationSchema/admin/brand.Schema";
import { EmployeeValidation } from "@src/validationSchema/admin/employee.Schema";
import { ValidateReq } from "@src/validationSchema/validator";


export class CompanyValdation {
  static companySchema = {
    type: "object",
    properties: {

      name: { type: "string", transform: ["trim"], "isNotEmpty": true },
      slug: { type: "string", transform: ["trim"], "isNotEmpty": true },
      country: { type: "string", "isNotEmpty": true },
      type: { type: "string" },
      companyGroupId: { type: "string" },
      translation: { type: "object" },
      smallestCurrency: { type: "number" },
      roundingType: { enum: ["normal", "negative", "positive", "null", ""] } //TODO: REMOVE ""
      //TODO: ADD OPTIONS NULL OR NOT EMTPY OBJECT '{}'NOT ALLOWED
      //TODO : VOID REASON NULL OR NOT EMPTY ARRAY 
      //TODO: ADD VATnUMBER NULL OR NOT EMPTY STRING
      //TODO: ADD ISINCLUSIVE NOT NULL ONLY BOOLEAN FROM MODULE SET DEAFULT VALUE 

    },
    required: ["name", "country"],
    additionalProperties: true,
    errorMessage: {
      properties: {
        name: "name Must Be String",
        country: "country Must Be String",
      },
      required: {
        name: "name is Required",
        country: "country is Required",
      },
    }
  };


  public static async addcompanyValidation(data: any) {

    const schema = {
      type: "object",
      properties: {

        company: CompanyValdation.companySchema,
        employee: {
          anyOf: [
            EmployeeValidation.employeesSchema, // validate if provided
            { type: "null" },                   // or allow null
            { type: "object", maxProperties: 0 } // or allow empty object
          ]
        },
        branch: { type: "array", items: BranchValdation.branchSchema }
      },
      required: ["company"],
      additionalProperties: false,

    }
    return await ValidateReq.reqValidate(schema, data)


  }

  public static async editCompanyValidation(data: any) {


    return await ValidateReq.reqValidate(CompanyValdation.companySchema, data)

  }

}
