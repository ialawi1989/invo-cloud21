import { ValidateReq } from "@src/validationSchema/validator"

export class BatchValidation {
    public static Batchschema = {
        type: "object",
        properties: {
            branchProductId: { type: 'string' },
            batch: { type: 'string', "isNotEmpty": true },
            onHand: { type: 'number' },
            unitCost: { type: "number" },
            prodDate: { type: 'string' },
            expireDate: { type: 'string', "isNotEmpty": true },
        },
        required: ["batch", "onHand", "expireDate"],
        additionalProperties: true,
        errorMessage: {
            properties: {
                expireDate: "name Must Be String",
                batch: "batch Must Be String",
                onHand: "onHand Must Be Number",
            },
            required: {
                expireDate: "expireDate is Required",
                batch: "batch is Required",
                onHand: "onHand is Required",
            },
        }
    }

    public static async batchValidation(data: any) {
        return await ValidateReq.reqValidate(BatchValidation.Batchschema, data)
    }
}