import { DB } from "@src/dbconnection/dbconnection";
import { KitchenSection } from "@src/models/product/KitchenSection";
import { ResponseData } from "@src/models/ResponseData";
import { SocketKitchenSection } from "@src/repo/socket/kitchenSection.socket";
import { KitchenSectionValidation } from "@src/validationSchema/account/kitchen.Schema";
import { ProductRepo } from "./product.repo";



import { Company } from "@src/models/admin/company";
import { PoolClient } from "pg";
import { ValidationException } from "@src/utilts/Exception";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
export class KitchenSectionRepo {


  public static async checkIfNameExist(client:PoolClient,id:string|null,name:string,companyId:string){
    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "KitchenSections" where id<> $1 and LOWER(name) = LOWER($2) and "companyId" = $3 `,
      values: [
        id,
        name,
        companyId

      ],
    };

    if (id == null) {
      query.text = `SELECT count(*) as qty FROM "KitchenSections" where   LOWER(name) = LOWER($1) and "companyId" = $2 `
      query.values = [name, companyId]
    }
    const resault = await DB.excu.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async addKitchenSection(client:PoolClient,data: any, company: Company) {

    try {
      const companyId  = company.id;
      const validate = await KitchenSectionValidation.kitchenSectionValidation(data);
      if (!validate.valid) {
        throw new ValidationException(validate.error);
      }

      const isNameExist = await this.checkIfNameExist(client,null,data.name,companyId)
      if (isNameExist) {
        throw new ValidationException("Name Already Used");
      }
      const kitchenSection = new KitchenSection();
      kitchenSection.ParseJson(data);
      kitchenSection.companyId = companyId;
      const productIds: any[string] = [];
      kitchenSection.products.forEach((element: any) => {
        productIds.push(element.id)
      });

      const isProductsExist = await ProductRepo.checkIfProductIdExist(client,productIds, companyId)

      if (!isProductsExist) {
        throw new ValidationException("Invalid Product Id")
      }

      kitchenSection.updatedDate = new Date();
      const query : { text: string, values: any } = {
        text: `INSERT INTO "KitchenSections" (name,products,"companyId","updatedDate") VALUES ($1,$2,$3,$4) RETURNING id `,
        values: [kitchenSection.name,
        JSON.stringify(productIds),
        companyId,
        kitchenSection.updatedDate]
      }

      const insert = await DB.excu.query(query.text, query.values);
      kitchenSection.id = (<any>insert.rows[0]).id
      const branchIds = await BranchesRepo.getCompanyBranchIds(client,kitchenSection.companyId);
      await SocketKitchenSection.sendnewKitchenSection(kitchenSection, branchIds)
      return new ResponseData(true, "", { id: kitchenSection.id })
    } catch (error: any) {
    
       throw new Error(error.message)
    }
  }
  public static async editKitchenSection(client:PoolClient,data: any, company: Company) {

    try {
      const companyId =company.id;
      const validate = await KitchenSectionValidation.kitchenSectionValidation(data);
      if (!validate.valid) {
        throw new ValidationException(validate.error);
      }

      const isNameExist = await this.checkIfNameExist(client,data.id,data.name,companyId)
      if (isNameExist) {
        throw new ValidationException("Name Already Used");
      }
      const kitchenSection = new KitchenSection();
      kitchenSection.ParseJson(data);
      kitchenSection.companyId = companyId;
      const productIds: any[string] = [];
      kitchenSection.products.forEach((element: any) => {
        productIds.push(element.id)
      });
      kitchenSection.updatedDate = new Date();

      if (kitchenSection.id == null || kitchenSection.id == "") {
        throw new ValidationException("Kitchen Section id id required")
      }
      const query : { text: string, values: any } = {
        text: `UPDATE "KitchenSections" SET name=$1,products=$2, "updatedDate"=$3 WHERE  "companyId"=$4 AND id=$5  `,
        values: [kitchenSection.name,
        JSON.stringify(productIds),
        kitchenSection.updatedDate,
        kitchenSection.companyId,
        kitchenSection.id]
      }

      const insert = await client.query(query.text, query.values);
      const branchIds = await BranchesRepo.getCompanyBranchIds(client,kitchenSection.companyId);

      await SocketKitchenSection.sendUpdatedKitchenSection(kitchenSection,branchIds)
      return new ResponseData(true, "Updated Successfully", [])
    } catch (error: any) {
    
       throw new Error(error.message)

    }
  }

  public static async getKitchensSectionById(kitchenSectionId: string) {
    try {
      const query : { text: string, values: any } = {
        text: `
        SELECT  "KitchenSections". id,
                 "KitchenSections".name,
                json_agg(jsonb_build_object('id',"Products".id,'type',"Products".type,'name',"Products".name ,'price',"Products"."defaultPrice",'UOM',"Products"."UOM",'barcode',"Products"."barcode" )) as"products"
             FROM "KitchenSections" ,json_array_elements_text("products") AS elem
             INNER JOIN "Products" on "Products".id = elem::uuid
             WHERE   "KitchenSections".id=$1
             group by "KitchenSections".id,   "KitchenSections".name
        `,
        values: [kitchenSectionId]
      }


      const list = await DB.excu.query(query.text, query.values);
      const section: any = list.rows[0];

      return new ResponseData(true, "", section)
    } catch (error: any) {
    

    throw new Error(error.message)
    }
  }


  public static async getKitchensSectionList(data: any, company: Company) {
    try {

      const companyId =company.id;



      let searchValue =data.searchTerm?`^.*` + data.searchTerm.toLowerCase().trim() + `.*$`: '[A-Za-z0-9]*';
      let sort = data.sortBy;
      let sortValue = !sort ? '"KitchenSections"."createdAt"' : '"' + sort.sortValue + '"';
  
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;

    let offset = 0 ;
    let page = data.page;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
          offset = (limit * (page - 1))
      }

       const query={
        text:`SELECT 
                  count (*) over(),
                  "KitchenSections".id,
                  "KitchenSections".name,
                  products
          FROM "KitchenSections"
          WHERE "KitchenSections"."companyId"=$1
          AND (LOWER ("KitchenSections".name) ~ $2)
          ${orderByQuery}
          Limit $3 offset $4`,
          values:[companyId,searchValue,limit,offset]

       }
  
       const selectList = await DB.excu.query(query.text, query.values)

 
       let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
       let pageCount = Math.ceil(count / data.limit)
       offset += 1;
       let lastIndex = ((page) * limit)
       if (selectList.rows.length < limit || page == pageCount) {
         lastIndex = count
       }
 
 
 
 
       const resData = {
         list: selectList.rows,
         count: count,
         pageCount: pageCount,
         startIndex: offset,
         lastIndex: lastIndex
       }
   
      return new ResponseData(true, "", resData)
    } catch (error: any) {
    
    throw new Error(error.message)
    }
  }

  public static async getKitchenSectionProducts(companyId:string)
  {
    try {
      const query : { text: string, values: any } = {
        text:`SELECT id, name ,type, "defaultPrice" from "Products" where "companyId" =$1  and "Products"."isDeleted" = false`,
        values:[companyId]
      }

      const products = await DB.excu.query(query.text,query.values);
      return new ResponseData(true,"",{list:products.rows})
    } catch (error:any) {
    

      throw new Error(error)
    }
  }



}