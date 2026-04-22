import { ValidateReq } from "../validator"

export class CustomerValidation {
    public static async customerValidation(data: any) {
console.log(typeof data.phone);
console.log(data);
console.log("data.Customer.phone");
        const addressSchema = {
            type: "object",
            properties: {
                title: { type: "string" },
                block: { type: "string" },
                city: { type: "string" },
                road: { type: "string" },
                building: { type: "string" },
                flat: { type: "string" },
                note: { type: "string" },
                lat: { type: "string" },
                lng: { type: "string" },
            },
            additionalProperties: true,
        }
        const schema = {
            type: "object",
            properties: {
                id: { type: ["string", "null"] },
                name: { type: "string", transform: ["trim"], "isNotEmpty": true },
                saluation: { type: "string" },
                phone: { type: "string" },
                mobile: { type: "string" },
                email: {type: ["string", "null"]  },
                // addresses:{type:'array',items:addressSchema}
            },
            required: ["name", "phone"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    name: "name Must be String",
                    phone: "phone Must be String",
                },
                required: {
                    name: "name is Required",
                    phone: "phone is Required",
                },
            }
        }

        return await ValidateReq.reqValidate(schema, data);
    }
}