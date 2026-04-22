import { ValidateReq } from "../validator"

export class PriceManagmentValidation{
    public static async priceLabelValidation(data:any){
     //TODO: ADD VALIDATION TO OPTION PRICES
        const optionsPrices={
            type:'object',
            properties:{
                optionId:{type:'string',"isNotEmpty": true},// not null not empty 
                price:{type:'number'}, // not null not empty 
            },
            required: ["optionId","price"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    optionId: "optionId Must Be String",
                    price: "price Must Be Number",
                },
                required: {
                    price: "price is Required",
                    optionId: "optionId is Required",
      
                },
              }
        }


        const productPrices={
            type:'object',
            properties:{
                productId:{type:'string',"isNotEmpty": true},// not null not empty 
                price:{type:'number'}, // not null not empty 
            },
            required: ["productId","price"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    productId: "productId Must Be String",
                    price: "price Must Be Number",
                },
                required: {
                    price: "price is Required",
                    productId: "productId is Required",
      
                },
              }
        }
        const schema={
            type:'object',
            properties:{
                name:{type:'string' , "isNotEmpty": true,transform: ["trim"]}, 
                productsPrices:{type:"array",items:productPrices}, //array / empty Arry
                //TODO  optionsPrices:{type:"array",items:productPrices}, array / empty Arry   
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
        }
        return await ValidateReq.reqValidate(schema,data);
    }

    public static async priceManagmentValidation(data:any){


 
        const schema={
            type:'object',
            properties:{
            title:{type:'string' , "isNotEmpty": true},
            repeat:{type:'string'},
            priceLabelId:{type:'string'},
            branchIds:{type:'array'},
            fromDate:{type:"string"},
            toDate:{type:"string"}
            },
            required: ["title","priceLabelId"],
            additionalProperties: true
        }
        return await ValidateReq.reqValidate(schema,data)
    }
}