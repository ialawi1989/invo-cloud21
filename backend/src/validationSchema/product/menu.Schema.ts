import { ValidateReq } from "../validator"

export class MenuValidation {
    public static async menuValidation(data:any){
      const productsschema={
        type: "object",
        properties: {
          index:{type:"integer"}, // not Empty 
          doubleWidth:{type:"boolean"}, // NOT EMPTY 
          branchId:{type:'string'}, 
          doubleHeight:{type:'boolean'}, // NOT EMPTY  
          productId:{type:'string'}, //NOT NULL STRING 
          menuSectionId:{type:'string'},
          //page :{} = > 1 
        },
        required: ["productId"],
        additionalProperties: true,
        errorMessage: {
          properties: {
            productId: "productId Must Be String"
          },
          required: {
            productId: "productId is Required",

          },
        }

      }
      const menuSection ={
        type: "object",
        properties: {
            name:{type:'string'   , "isNotEmpty": true,transform: ["trim"]},
            translation:{type:'object'},
            branchId:{type:'string'},
            color:{type:'string'}, //TODO: COLOR DROP 
            image:{type:'string'}, 
            index:{type:'integer'},// TODO: default => 0 
            menuId:{type:'string'},
            products:{type:'array',items:productsschema}
            /**TODO: PROPERTIES { => NOT EMPTY OBJECT 
             * COLOR: STRING SET DEFUALT 
             * {"color":{"colorName":"Raw Umber","borderColor":"rgba(162, 71, 16, 1)","colorStart":"rgba(105, 44, 7,1)","colorEnd":"rgba(105, 44, 7,1)"}}
             * }*/
        },
        required: ["name"],
        additionalProperties: true,
        errorMessage: {
          properties: {
            name: "name Must Be String"
          },
          required: {
            name: "name is Required",

          },
        }
      }
          
      const schema ={
        type: "object",
        properties: {
            name:{type:'string'   , "isNotEmpty": true,transform: ["trim"]},
            branchId:{type:'string'},
            menuSections:{type:'array',items:menuSection}
            //TODO: startAt: not null and not empty 
            //TODO: endAt: not null and not empty 
        },
        required: ["name"],
        additionalProperties: true,
        errorMessage: {
          properties: {
            name: "name Must Be String"
          },
          required: {
            name: "name is Required",

          },
        }
      }

      return await ValidateReq.reqValidate(schema,data);
    }


}