import { ValidateReq } from "../validator"
export class ReportQueriesValidation {
    public static async validateReportQuery (data:any)
    {

        const schema = {
            type: "object",
            properties: {
                text: { type: "string", "isNotEmpty": true  },
                name: { type: "string", "isNotEmpty": true },
            },
            required: ["name", "text"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    name: "name Must Be String",
                    text: "text Must Be String",
                },
                required: {
                    name: "name is Required",
                    text: "text is Required",
                },
              }
        }

        return await ValidateReq.reqValidate(schema, data);
    }
}