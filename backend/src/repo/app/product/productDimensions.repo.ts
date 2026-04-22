import { DB } from "@src/dbconnection/dbconnection";
import { Dimension } from "@src/models/product/Dimension";
import { DimensionAttribute } from "@src/models/product/DimensionAttribute";
import { ResponseData } from "@src/models/ResponseData";
import { ValidationException } from "@src/utilts/Exception";
import { Helper } from "@src/utilts/helper";
import { DimensionValidation } from "@src/validationSchema/product/dimension.Schema";
import { PoolClient } from "pg";

export class ProductDimensionRepo {

    public static async checkIfDimensionNameExists(client:PoolClient,  id: string | null, name: string, companyId: string) {

        const query : { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "Dimensions" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3`,
            values: [
                name,
                id,
                companyId,
            ],
        };
        if (!id) {
            query.text = `SELECT count(*) as qty FROM "Dimensions" where LOWER(name) = LOWER($1) and "companyId" = $2`;
            query.values = [name, companyId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;
    }

    public static async addDimension( client:PoolClient,  data: any, companyId:string): Promise<Dimension> {
        try {

            // ############### Parse and validate input ###############  
            const dimension = new Dimension();
            dimension.ParseJson(data);
            dimension.companyId = companyId

            const validate = await DimensionValidation.AddDimesionValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const isNameExists = await this.checkIfDimensionNameExists(client, null, dimension.name, dimension.companyId);
            if (isNameExists) {
                throw new ValidationException("Dimension name already used.");
            }


            // ###################### Insert Data #######################
            const query = {
                text: `
                    INSERT INTO "Dimensions" ( "name", translation, "companyId", "displayType")
                    VALUES ($1, $2, $3, $4)
                    RETURNING *; 
                `,
                values: [
                    dimension.name,
                    dimension.translation,
                    dimension.companyId,
                    dimension.displayType
                   ]
            };

            const dimensionInsert  = await client.query(query.text, query.values);
              if (dimensionInsert.rows.length === 0) {
                throw new ValidationException('Failed to add Dimension.');
            }
            const dimensionId = (<any>dimensionInsert.rows[0]).id;
            
            dimension.id = dimensionId;
            
            //Insert Lines
            for (let index = 0; index < dimension.attributes.length; index++) {
                const attribute = dimension.attributes[index];
                attribute.companyId = dimension.companyId
                attribute.dimensionId = dimension.id
                const insertAttribute: any = await this.addDimensionAttribute(client, attribute, companyId)
                attribute.id = insertAttribute.id;
            }



            // ######################   Response  #######################
          
          
            return dimension;


        } catch (error: any) {
          
            if (error instanceof ValidationException) {
                throw error; // Re-throw custom errors as-is
            }
            throw new ValidationException(`Failed to add Dimension: ${error.message}`);
        }
    }

     public static async updateDimension(client:PoolClient, data: any, companyId:string): Promise<Dimension> {

        /*********************************************************************************
         * Saves or updates a device pairing record in the database.
         * Uses ON CONFLICT (UPSERT) to avoid race conditions and ensure atomicity.
         * @param client - PostgreSQL PoolClient for transaction management.
         * @param data - The raw data for the device pairing.
         * @returns The saved PairedDevice object or null if no operation occurred.
        **********************************************************************************/
        try {

            // ############### Parse and validate input ###############  
            const dimension = new Dimension();
            dimension.ParseJson(data);
            dimension.companyId = companyId

            const validate = await DimensionValidation.AddDimesionValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const isNameExists = await this.checkIfDimensionNameExists(client, dimension.id, dimension.name, dimension.companyId);
            if (isNameExists) {
                throw new ValidationException("Dimension name already used.");
            }


            // ###################### Insert Data #######################
            const query = {
                text: `
                    update "Dimensions" set 
                        name = $2, 
                        translation = $3, 
                        "displayType" = $4 
                    where id = $1
                    RETURNING *; 
                `,
                values: [
                    dimension.id,
                    dimension.name,
                    dimension.translation,
                    dimension.displayType             ]
            };

            const dimensionInsert  = await client.query(query.text, query.values);
              if (dimensionInsert.rows.length === 0) {
                throw new ValidationException('Failed to update Dimension.');
            }
            const dimensionId = (<any>dimensionInsert.rows[0]).id;
            
            dimension.id = dimensionId;
            
            //Insert attribute
            for (let index = 0; index < dimension.attributes.length; index++) {
                const attribute = dimension.attributes[index];
                attribute.companyId = dimension.companyId
                attribute.dimensionId = dimension.id
                const insertAttribute: any = await this.addDimensionAttribute(client, attribute, companyId)
                attribute.id = insertAttribute.id;
            }

            


            // ######################   Response  #######################
            return dimension;


        } catch (error: any) {
          
            if (error instanceof ValidationException) {
                throw error; // Re-throw custom errors as-is
            }
            throw new ValidationException(`Failed to update Dimension: ${error.message}`);
        }
    }

    public static async getDimensionList(data:any, companyId: string): Promise<ResponseData> {

        /*************************************************************************************
         * Retrieves all Dimension records associated with a specific company ID.
         * @param companyId - The ID of the compnay.
         * @returns An array of Dimension.
        ************************************************************************************/

        try {

            //############## filter ##############
            let filterQuery = ``
            let searchValue = data.searchTerm ? `%` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `%` : null;
            if (searchValue) {
                filterQuery += `and LOWER("Dimensions".name) ilike '${searchValue}' `
            }

            //############## Sort ##############
            let sort = data.sortBy;
            let sortValue = !sort ? ' "createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
            if (data.dimensionId != null && data.dimensionId != "") {
                sortValue = ` "Dimensions"."id" = ` + "'" + data.dimensionId + "'"
            }
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm

            //############## limit ##############
            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            //############## Counter ##############
            const counterQuery: { text: string, values: any } = {
                text: `select count(*)
                        from "Dimensions" WHERE "companyId" = $1
                        ${filterQuery}`,
                values: [companyId]
            }
            const counter = await DB.excu.query(counterQuery.text, counterQuery.values)

            //############## Select ##############
            let list = []
            const query = {
                text: `
                SELECT * FROM "Dimensions" WHERE "companyId" = $1
                ${filterQuery}
                ${orderByQuery}
                limit $2 offset $3
                `,
                values: [companyId, limit, offset]
            };

            const records = await DB.excu.query(query.text, query.values);
            if (records.rows && records.rows.length > 0) {
                list = records.rows
            }

            //############## pagination ##############
            let count = counter.rows && counter.rows.length > 0 ? Number((<any>counter.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (list.length < limit || page == pageCount) {
                lastIndex = count
            }

            //############## Response ##############      
            const resData = {
                list: list,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            return new ResponseData(true, "", resData)

           

        } catch (error: any) {
          
            if (error instanceof ValidationException) {
                throw error;
            }
            throw new ValidationException(`Failed to retrieve Dimension List: ${error.message}`);
        }
    }

    public static async getDimensionById(companyId: string, dimensionId: string): Promise<ResponseData> {

        try {

            // ###################### select Data #######################
            const query = {
                text: ` SELECT 
                            d.* , 
                            jsonb_agg(da.*) as attributes
                        FROM "Dimensions"  d
                        left JOIN "DimensionAttributes" da  ON da."dimensionId" = d.id
                        WHERE d.id = $1 AND d."companyId" = $2
                        group by d.id`,
                values: [dimensionId, companyId]
            };

            let dimension = null
            const records = await DB.excu.query(query.text, query.values);
            if (records.rows && records.rows.length > 0) {
                dimension = records.rows[0]
            }

            // ######################   Response  #######################
            return new ResponseData(true, "", dimension)

        } catch (error: any) {
          
            if (error instanceof ValidationException) {
                throw error;
            }
            throw new ValidationException(`Failed to retrieve Dimension: ${error.message}`);
        }
    }


    public static async checkIfAttributeNameExists(client:PoolClient, id: string | null, name: string, code:string, dimensionId:string) {

        const query : { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "DimensionAttributes" where LOWER(name) = LOWER($1) and LOWER(code) = LOWER($2)  and  id <> $3 and "dimensionId" = $4`,
            values: [
                name, 
                code,
                id,
                dimensionId,
            ],
        };
        if (!id) {
            query.text = `SELECT count(*) as qty FROM "DimensionAttributes" where LOWER(name) = LOWER($1) and LOWER(code) = LOWER($2) and "dimensionId" = $3`;
            query.values = [name, code, dimensionId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;
    }


    public static async addDimensionAttribute( client:PoolClient, data: DimensionAttribute, companyId:string, addOnly:boolean=false): Promise<DimensionAttribute> {
        try {

            // ############### Parse and validate input ###############  
            const attribute = new DimensionAttribute();
            attribute.ParseJson(data);
            attribute.companyId = companyId

            const validate = await DimensionValidation.attributeValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const isNameExists = await this.checkIfAttributeNameExists(client, attribute.id, attribute.name, attribute.code, attribute.dimensionId);
            if (isNameExists) {
                throw new ValidationException(`attribute name:${attribute.name} or code:${attribute.code} already used.`);
            }

             
            // ###################### Insert Data #######################
            let  query = {
                text: `INSERT INTO "DimensionAttributes" 
                        ( "dimensionId", "name", translation, "companyId", "code", "value")
                         VALUES ($1, $2, $3, $4, $5, $6) Returning *;
                        
                `,
                values: [
                    
                    attribute.dimensionId,
                    attribute.name,
                    attribute.translation,
                    attribute.companyId,
                    attribute.code, 
                    attribute.value
                   ]
            }
            if (attribute.id && addOnly == false){
                query = {
                text: `update "DimensionAttributes" 
                SET  translation    = $2,
                     "value" = $3
                       WHERE id = $1
                       Returning *
                `,
                values: [
                    attribute.id,
                    attribute.translation,
                    attribute.value
                   ]
            }; 
            }
            

            const result = await client.query(query.text, query.values);


            // ######################   Response  #######################
            if (result.rows.length === 0) {
                throw new ValidationException('Failed to add attribute.');
            }
            attribute.ParseJson(result.rows[0]);
            return attribute;


        } catch (error: any) {
          
            if (error instanceof ValidationException) {
                throw error; // Re-throw custom errors as-is
            }
            throw new ValidationException(`Failed to add attribute: ${error.message}`);
        }
    }

     


}