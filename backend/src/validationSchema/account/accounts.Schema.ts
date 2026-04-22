import { ValidateReq } from "../validator"

export class AccountValidation {
    public static async accountValidation(data: any) {
        const schema = {
            type: "object",
            properties: {
                id: { type: ["string", "null"] },
                name: { type: "string", transform: ["trim"], "isNotEmpty": true },
                code: { type: ["string", "null"] },
                description: { type: "string" },
                type: { type: "string",transform: ["trim"], "isNotEmpty": true },
                parentType: { type: "string",transform: ["trim"], "isNotEmpty": true }
            },
            required: ["name", "type", "parentType"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    name: "Account name must be string",
                    type: "Account type must be string",
                    parentType: " Account parentType must be string",
                },
                required: {
                    name: "Account name is Required",
                    type: "Account type is Required",
                    parentType: "Account parentType is Required",
                },
            }
        }

        return await ValidateReq.reqValidate(schema, data);
    }
}