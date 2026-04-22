import { ValidateReq } from "../validator"

export class SupplierValidation {
    public static async supplierValidation (data:any)
    {

        const supplierItemsSchema={
            type:"object",
            properties:{
                supplierId:{type:"string"},
                minimumOrder:{type:"number"},
                cost:{type:"number"},
                supplierCode:{type:"string"},
                productId:{type:"string" , "isNotEmpty": true}
            },
            required: ["productId","cost"],
            additionalProperties: true,
            errorMessage: {
        
                properties: {
                    productId: "productId Must Be String",
                    cost: "cost Must Be Number",
                },
                required: {
                    productId: "productId is Required",
                    cost: "cost is Required",
                },
              }
        }


        const schema={
            type:"object", 
            properties:{
         
                name:{type:"string", transform: ["trim"], "isNotEmpty": true},
                address:{type:"string"},
                phone:{type:"string"},
                mobile:{type:"string"},
                email:{type:"string"},
                website:{type:"string"},
                note:{type:"string"},
                contacts:{type:['array','null']}, 
                code:{type:"string"},
                supplierItems:{type:'array',items:supplierItemsSchema}
            },
            required: ["name","phone"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    name: "name Must Be String",
                    phone: "phone Must Be String",
                },
                required: {
                    name: "name is Required",
                    phone: "phone is Required",
                },
              }
           }

           return await ValidateReq.reqValidate(schema,data);
    }
}