import { BatchValidation } from "@src/validationSchema/product/ProductBatch.Schema"
import { SerialValidation } from "@src/validationSchema/product/serials.Schema"
import { ValidateReq } from "@src/validationSchema/validator"

export class BranchProductsValidation{

    public static priceByQtySchema ={
        type:"object",
        properties:{
            qty:{type:'integer'},
            price:{type:'number'}
        },
        required: ["qty","price"],
        additionalProperties: true,  
       errorMessage: {
          properties: {
            price: "price Must Be Number",
            qty: "qty Must Be Number",
          },
          required: {
            price: "price is Required",
            qty: "qty is Required",
          },
        }
    }
    public static branchProductSchema = {
      type:"object",
      properties:{
      type:{type:"string"},
      productId:{type:'string'},
      branchId:{type:'string' },
      available:{type:['boolean','null']},
      price:{type:['number','null']},
      priceBoundriesFrom:{type:['number','null']},
      priceBoundriesTo:{type:['number','null']},
      buyDownPrice:{type:['number','null']},
      buyDownQty:{type:['number','null']},
      selectedPricingType: {
        oneOf: [
          { type: 'null' },
          {
            type: 'string',
            enum: [
              "priceByQty",
              "buyDownPrice",
              "priceBoundary",
              "",
              "openPrice"
            ],
          },
        ],
      },
      priceByQty: {type:["array","null"],items:BranchProductsValidation.priceByQtySchema}
      },
      required: ["branchId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          branchId: "branchId Must Be String"
        },
        required: {
          branchId: "branchId is Required"
        },
      }
    }

    public static batchSchema = {
      type:"object",
      properties:{
        type:{type:"string"},

      productId:{type:'string'},
      branchId:{type:'string' },
      available:{type:['boolean','null']},
      price:{type:['number','null']},
   
      batches:{type:['array','null'],items:BatchValidation.Batchschema},
      priceBoundriesFrom:{type:['number','null']},
      priceBoundriesTo:{type:['number','null']},
      buyDownPrice:{type:['number','null']},
      buyDownQty:{type:['number','null']},
      selectedPricingType: {
        oneOf: [
          { type: 'null' },
          {
            type: 'string',
            enum: [
              "priceByQty",
              "buyDownPrice",
              "priceBoundary",
              "",
              "openPrice"
            ],
          },
        ],
      },
    
      priceByQty: {type:["array","null"],items:BranchProductsValidation.priceByQtySchema}},
      required: ["branchId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          branchId: "branchId Must Be String"
        },
        required: {
          branchId: "branchId is Required"
        },
      }
    }

    public static serialSchema = {
      type:"object",
      properties:{
        type:{type:"string"},
   
      productId:{type:'string'},
      branchId:{type:'string' },
      available:{type:'boolean'},
      price:{type:['number','null']},
      serials:{type:['array','null'],items:SerialValidation.serialSchema},
      priceBoundriesFrom:{type:['number','null']},
      priceBoundriesTo:{type:['number','null']},
      buyDownPrice:{type:['number','null']},
      buyDownQty:{type:['number','null']},
      selectedPricingType: {
        oneOf: [
          { type: 'null' },
          {
            type: 'string',
            enum: [
              "priceByQty",
              "buyDownPrice",
              "priceBoundary",
              "",
              "openPrice"
            ],
          },
        ],
      }, 
      priceByQty: {type:["array","null"],items:BranchProductsValidation.priceByQtySchema}},
      required: ["branchId"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          branchId: "branchId Must Be String"
        },
        required: {
          branchId: "branchId is Required"
        },
      }

    }

    public static inventorySchema = {
      type:"object",
      properties:{
      type:{type:"string"},

      productId:{type:'string'},
      branchId:{type:'string' },
      available:{type:['boolean','null']},
      price:{type:['number','null']},
      onHand:{type:'number'},
      priceBoundriesFrom:{type:['number','null']},
      priceBoundriesTo:{type:['number','null']},
      selectedPricingType: {
        oneOf: [
          { type: 'null' },
          {
            type: 'string',
            enum: [
              "priceByQty",
              "buyDownPrice",
              "priceBoundary",
              "",
              "openPrice"
            ],
          },
        ],
      },
      buyDownPrice:{type:['number','null']},
      buyDownQty:{type:['number','null']},
      priceByQty: {type:["array","null"],items:BranchProductsValidation.priceByQtySchema}},
      required: ["branchId","onHand"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          branchId: "branchId Must Be String",
          onHand: "onHand Must Be Number"
        },
        required: {
          branchId: "branchId is Required",
          onHand: "onHand is Required"
        },
      }

    }

  

    public static async inventoryBranchProduct(data:any){

      return await ValidateReq.reqValidate(BranchProductsValidation.inventorySchema,data)
    }

    public static async batchesBranchProduct(data:any){
      return await ValidateReq.reqValidate(BranchProductsValidation.batchSchema,data)
    }

    public static async serialBranchProduct(data:any){

      return await ValidateReq.reqValidate(BranchProductsValidation.serialSchema,data)
    }

    public static async branchProductValidation(data:any)
    {
      return await ValidateReq.reqValidate(BranchProductsValidation.branchProductSchema,data)
    }


}