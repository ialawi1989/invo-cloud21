import { ValidateReq } from "../validator"

export class TablesValidation {

    public static async tableGroupsValidation(data: any) {

        /**
         * properties
         * ANGLE =20 
         * TYPE STRING NOT NULL
         * SIZE STRUNG NOT NULL 
         * POSTION {X:NUMBER,Y:NUMBER}
         * HideSeats:boolean
         */
        const TableSchema = {
            type: 'object',
            properties: {
                tableGroupId: { type: 'string' },
                maxSeat: { type: 'integer' }, //default:1 
                postion: { type: 'string' },
                properties: { type: 'object' }, // not allwoed '{}'
                name: { type: 'string' }, //TODO: NOT EMPTY STRING NOT NULL 
                image: { type: ['string', 'null'] }
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

        //Table Group 
      /**
       *   properties={
       * defaultPatteren:"1" as default 
       * patternSize => 20 default 
        }
       */
        const schema = {
            type: 'object',
            properties: {
                name: { type: 'string', "isNotEmpty": true },
                index: { type: 'integer' },//dEFAULT 0 NOT NULL 
                branchId: { type: 'string' },
                properties: { type: 'object' }, // not allowed '{}'
                objects: { type: "array" },
                tables: { type: 'array', items: TableSchema }
            },
            required: ["name", "branchId"],
            additionalProperties: true,
            errorMessage: {
                properties: {

                    name: "name Must Be String",
                    branchId: "branchId Must Be String",
                },
                required: {
                    name: "name is Required",
                    branchId: "branchId is Required",
                },
            }
        }
        return await ValidateReq.reqValidate(schema, data)
    }
}