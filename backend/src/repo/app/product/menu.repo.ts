import { DB } from "@src/dbconnection/dbconnection";
import { Menu } from "@src/models/product/Menu";
import { MenuSection } from "@src/models/product/MenuSection";
import { MenuSectionProduct } from "@src/models/product/MenuSectionProduct";
import { ResponseData } from "@src/models/ResponseData";
import { FileStorage } from "@src/utilts/fileStorage";
import { MenuValidation } from "@src/validationSchema/product/menu.Schema";
import { PoolClient } from "pg";
import { ProductRepo } from "./product.repo";
import axios from 'axios';
import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { PluginRepo } from "../accounts/plugin.repo";
import { BranchesRepo } from "@src/repo/admin/branches.repo";

export class MenuRepo {
  public static async checkIfMenuNameExist(client: PoolClient, menuId: string | null, name: string, companyId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Menu" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3 `,
      values: [
        name,
        menuId,
        companyId,

      ],
    };
    if (menuId == null) {
      query.text = `SELECT count(*) as qty FROM "Menu" where LOWER(name) = LOWER($1)  and "companyId" = $2 `;
      query.values = [name, companyId];
    }

    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;
  }
  public static async checkIfMenuSectionNameExist(client: PoolClient, menuSectionId: string | null, name: string, menuId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "MenuSection" where name = $1 and id <> $2 and "menuId"=$3`,
      values: [
        name,
        menuSectionId,


        menuId
      ],
    };
    if (menuSectionId == null) {
      query.text = `SELECT count(*) as qty FROM "MenuSection" where name = $1    and "menuId"=$2`;
      query.values = [name, menuId];
    }

    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;
  }
  public static async checkIfMenuIdExist(menuId: string, companyId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Menu" where  id = $1 and "companyId" = $2`,
      values: [
        menuId,
        companyId,

      ],
    };
    const resault = await DB.excu.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }

  public static async getMenuId(client: PoolClient, menuName: string, companyId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT id from "Menu" where lower(name)=lower($1) and "companyId"=$2`,
        values: [menuName, companyId]
      }

      let menu = await client.query(query.text, query.values);
      return menu.rows[0].id
    } catch (error: any) {
    

      throw new Error(error)
    }
  }





  public static async addMenu(client: PoolClient, data: any, company: Company) {

    try {
      const companyId = company.id;
      const validate = await MenuValidation.menuValidation(data);
      if (!validate.valid) {
        throw new ValidationException(validate.error)
      }

      const menu = new Menu();
      menu.ParseJson(data);
      menu.companyId = companyId;

      const isNameExists = await this.checkIfMenuNameExist(client, null, menu.name, menu.companyId);
      if (isNameExists) {
        throw new ValidationException("Menu Name Already used");
      }
      menu.updatedDate = new Date();


      const query: { text: string, values: any } = {
        text: 'INSERT INTO "Menu"(name,"branchIds","companyId", "startAt","endAt",index,"updatedDate","availableOnline","priceLabelId") VALUES($1, $2,$3,$4,$5,$6,$7,$8,$9) RETURNING id ',
        values: [menu.name, JSON.stringify(menu.branchIds), menu.companyId, menu.startAt, menu.endAt, menu.index, menu.updatedDate, menu.availableOnline, menu.priceLabelId],
      };
      const insert = await DB.excu.query(query.text, query.values);
      menu.id = (<any>insert.rows[0]).id

      for (let index = 0; index < menu.sections.length; index++) {
        const element = menu.sections[index];
        const menuSection = new MenuSection();
        menuSection.ParseJson(element);
        menuSection.menuId = menu.id;

        const menuSectionId = await this.addMenuSection(client, menuSection, companyId)
        menuSection.id = menuSectionId
        for (let i = 0; i < menuSection.products.length; i++) {
          const product = menuSection.products[i];
          const menuSectionProduct = new MenuSectionProduct();
          menuSectionProduct.ParseJson(product);

          menuSectionProduct.menuSectionId = menuSection.id;
          await this.addMenuSectionProduct(client, menuSectionProduct, companyId)
        }
      }

      const resData = {
        id: menu.id
      }
      return new ResponseData(true, "Added Successfully", resData)
    } catch (error: any) {
    
      console.log(error)
      throw new Error(error)
    }

  }

  public static async addMenuSection(clinet: PoolClient, menuSection: MenuSection, companyId: string) {
    try {


      const isNameExists = await this.checkIfMenuSectionNameExist(clinet, null, menuSection.name, menuSection.menuId);
      if (isNameExists) {

        throw new ValidationException("Menu Name Already used");
      }

      const isMenuIdExist = await this.checkIfMenuIdExist(menuSection.menuId, companyId);
      if (!isMenuIdExist) {
        throw new ValidationException("Menu Id doesn't Exist")
      }

      const query: { text: string, values: any } = {
        text: 'INSERT INTO "MenuSection"(name,translation ,image,index,"menuId",properties) VALUES($1, $2,$3,$4,$5,$6) RETURNING id ',
        values: [menuSection.name, menuSection.translation, menuSection.image, menuSection.index, menuSection.menuId, JSON.stringify(menuSection.properties)],
      };
      const insert = await clinet.query(query.text, query.values);

      return (<any>insert.rows[0]).id

    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async addMenuSectionProduct(clinet: PoolClient, menuSectionProduct: MenuSectionProduct, companyId: string) {
    try {


      const isProductId = await ProductRepo.checkIfProductIdExist(clinet, [menuSectionProduct.productId], companyId);
      if (!isProductId) {
        throw new ValidationException("Invalid Product")
      }

      const query: { text: string, values: any } = {
        text: 'INSERT INTO "MenuSectionProduct" (index,"doubleWidth","doubleHeight","productId","menuSectionId",color,page) VALUES($1, $2,$3,$4,$5,$6,$7) RETURNING id ',
        values: [menuSectionProduct.index, menuSectionProduct.doubleWidth, menuSectionProduct.doubleHeight, menuSectionProduct.productId, menuSectionProduct.menuSectionId, menuSectionProduct.color, menuSectionProduct.page],
      };

      const insert = await clinet.query(query.text, query.values);
      const resData = {
        id: (<any>insert.rows[0]).id
      }
      return new ResponseData(true, "Added Successfully", resData)

    } catch (error: any) {
    

      throw new Error(error)
    }
  }


  public static async editMenu(client: PoolClient, data: any, company: Company) {
    try {
      const companyId = company.id
      const validate = await MenuValidation.menuValidation(data);
      if (!validate.valid) {
        return new ResponseData(true, validate.error, [])
      }
      if (data.id == null || data.id == "") {
        throw new ValidationException("Menu id Is Required")
      }

      const menu = new Menu();
      menu.ParseJson(data);
      menu.companyId = companyId;


      const isNameExists = await this.checkIfMenuNameExist(client, menu.id, menu.name, menu.companyId);
      if (isNameExists) {
        throw new ValidationException("Menu Name Already used");
      }

      menu.updatedDate = new Date();
      const query: { text: string, values: any } = {
        text: 'UPDATE "Menu" SET name=$1, "startAt"=$2, "updatedDate"=$3 ,"branchIds" =$4,"endAt"=$5,index=$6,"availableOnline"=$7,"priceLabelId" = $8 WHERE id=$9 AND"companyId"=$10',
        values: [menu.name, menu.startAt, menu.updatedDate, JSON.stringify(menu.branchIds), menu.endAt, menu.index, menu.availableOnline, menu.priceLabelId, menu.id, menu.companyId],
      };
      const insert = await client.query(query.text, query.values);
      await this.deleteSections(client, menu.id)
      for (let index = 0; index < menu.sections.length; index++) {
        const element = menu.sections[index];
        const menuSection = new MenuSection();
        menuSection.ParseJson(element);

        menuSection.menuId = menu.id;
        const section = await this.addMenuSection(client, menuSection, companyId)

        menuSection.id = section

        for (let i = 0; i < menuSection.products.length; i++) {
          const product = menuSection.products[i];
          const menuSectionProduct = new MenuSectionProduct();
          menuSectionProduct.ParseJson(product);

          menuSectionProduct.menuSectionId = menuSection.id;

          await this.addMenuSectionProduct(client, menuSectionProduct, companyId)

        }

      }

      return new ResponseData(true, "Updated Successfully", [])
    } catch (error: any) {

    
      console.log(error)
      throw new Error(error)
    }

  }
  public static async deleteSections(client: PoolClient, menuId: string) {
    try {

      // Delete Section Products
      const query: { text: string, values: any } = {
        text: `DELETE FROM "MenuSectionProduct" 
              USING "MenuSection"
              WHERE "MenuSection".id =  "MenuSectionProduct"."menuSectionId"
              AND "MenuSection"."menuId" = $1`,
        values: [menuId]
      }
      await client.query(query.text, query.values)

      // Delete Sections
      query.text = `DELETE FROM "MenuSection" 
               WHERE  "menuId" = $1`,
        await client.query(query.text, query.values)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }


  public static async getMenuList(data: any, company: Company) {
    try {
      const companyId = company.id;



      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';


      let offset = 0;
      let page = data.page;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (data.page != 1) {
        offset = (limit * (data.page - 1))
      }


      let sort = data.sortBy;
      let sortValue = !sort ? '"Menu"."createdAt"' : '"' + sort.sortValue + '"';

      if (data.menuId != null && data.menuId != "") {
        sortValue = ` ("Menu".id = ` + "'" + data.menuId + "'" + ` )`
      }

      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;



      const query = {
        text: `SELECT  
                      COUNT(*) OVER(),
                      "Menu".id,
                      "Menu"."name",
                      "Menu"."startAt",
                      "Menu"."endAt",
                      "Menu"."index"
                      from "Menu"
                      WHERE "companyId"=$1
                      AND (LOWER ("Menu".name) ~ $2)
                      ${orderByQuery}
                      Limit $3 offset $4
                      `,
        values: [companyId, searchValue, limit, offset]
      }
      let list = await DB.excu.query(query.text, query.values);
      let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
      let pageCount = Math.ceil(count / limit)

      offset += 1
      let lastIndex = ((page) * limit)
      if (list.rows.length < limit || page == pageCount) {
        lastIndex = count
      }
      const resData = {
        list: list.rows,
        count: count,
        pageCount: pageCount,
        startIndex: offset,
        lastIndex: lastIndex
      }

      return new ResponseData(true, "", resData)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getBranchMenubyId(branchId: string, menuId: string) {

    const client = await DB.excu.client();
    try {

      await client.query("BEGIN")
      const query: { text: string, values: any } = {
        text: `SELECT "Menu".id,
         "Menu"."name",
        "Menu"."startAt",
        "Menu"."branchIds",
        "Menu"."availableOnline",
        "Menu"."priceLabelId",
        "PriceLabels"."name" as "priceLabelName"
         FROM "Menu"
         LEFT JOIN "PriceLabels" on "PriceLabels".id = "Menu"."priceLabelId"
         WHERE "Menu".id = $1
         `,
        values: [menuId]
      }
      const menu: any = await client.query(query.text, query.values)
      menu.rows[0].sections = []
      query.text = `SELECT id,
                        name,
                        translation,
                        image,
                        index,
                        properties
                  FROM "MenuSection"
                  WHERE "MenuSection"."menuId"=$1 `;
      query.values = [menuId];
      const menuSection: any = await client.query(query.text, query.values)

      for (let index = 0; index < menuSection.rows.length; index++) {
        const element = menuSection.rows[index];
        element.products = [];
        query.text = `SELECT "MenuSectionProduct".id,
                            index,
                            "doubleWidth",
                            "doubleHeight",
                            "productId",
                            "Products".name "productName", 
                            "Products"."defaultImage",
                            color
                            FROM "MenuSectionProduct" 
                            INNER JOIN "Products"
                            ON "Products".id = "MenuSectionProduct".  "productId"
                            WHERE "MenuSectionProduct"."menuSectionId" = $1
                            `
        query.values = [element.id]


        const products = await client.query(query.text, query.values);
        element.products.push(products.rows)
        menu.rows[0].sections[index].push(element)
      }
      await client.query("COMMIT")
      return new ResponseData(true, "", menu.rows[0])
    } catch (error: any) {
    
      await client.query("ROLLBACK")
      throw new Error(error)
    } finally {
      client.release();
    }
  }
  public static async getCompanyMenu(company: Company) {
    try {
      const companyId = company.id;
      const query: { text: string, values: any } = {
        text: `SELECT menu.id,
        menu."name",
        menu."startAt",
         "PriceLabels".id as "priceLabelId",
                "PriceLabels"."name" as "priceLabelName",
                    (SELECT
                       json_agg(json_build_object('id',id,
                            'name',name,
                            'translation',translation,
                            'color',color,
                            'image',image,
                            'index',index,
                            'products',(
                                 SELECT json_agg(json_build_object('id',id,'index',index,'doubleWidth',"doubleWidth",'doubleHeight',"doubleHeight",'productId',"productId"))
                                 FROM "MenuSectionProduct" 
                                 WHERE "MenuSectionProduct". "menuSectionId" = "MenuSection".id
                                 )
                    )) FROM "MenuSection"
                     WHERE menu.id = "MenuSection"."menuId") AS sections
                  FROM "Menu" AS menu
         inner Join "Branches" on "Branches".id = menu."branchId"
          LEFT JOIN "PriceLabels" on "PriceLabels".id = "Menu"."priceLabelId"
         and "Branches"."companyId" =$1`,
        values: [companyId]
      }

      const list = await DB.excu.query(query.text, query.values)
      return new ResponseData(true, "", list.rows)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getMenuById(menuId: string, company: Company) {

    try {
      const companyId = company.id
      const sql = `SELECT menu.id,
      menu."name",
      menu."startAt",
      menu."endAt",
      menu.index,
      "availableOnline",
      "priceLabelId",
      menu."branchIds",
                  (SELECT
                     json_agg(json_build_object(
                           'id',id,
                          'name',name,
                          'translation',translation,
                          'image',image,
                          'index',index,
                          'properties',properties,
                          'products',(
                               SELECT json_agg(json_build_object('id',"MenuSectionProduct".id,'index',index,'doubleWidth',"doubleWidth",'doubleHeight',"doubleHeight",'productId',"productId",'color',"Products".color,'defaultImage',"Products"."defaultImage",'productName',"Products".name,'page',page,'url',"Media".url,'mediaType',"Media"."mediaType",'mediaId',"Media".id))
                               FROM "MenuSectionProduct" 
                               INNER JOIN "Products"
                               ON "Products".id = "MenuSectionProduct"."productId"
                               left join "Media"
                               on "Media".id = "Products"."mediaId"
                               WHERE "MenuSectionProduct". "menuSectionId" = "MenuSection".id
                               )
                  )) FROM "MenuSection"
                   WHERE menu.id = "MenuSection"."menuId") AS sections
                FROM "Menu" AS menu
                WHERE menu.id =$1`;
      const query: { text: string, values: any } = {
        text: sql,
        values: [menuId]
      }
      const file = new FileStorage();
      const menus = await DB.excu.query(query.text, query.values);
      const menu: any = menus.rows[0]

      if (menu.sections) {
        for (let index = 0; index < menu.sections.length; index++) {
          const element = menu.sections[index];
          if (element.products) {
            for (let i = 0; i < element.products.length; i++) {
              const product = element.products[i];
              const type = await file.getImageType(companyId, product.productId)

              if (product.url != null) {
                menu.sections[index].products[i].defaultImage = product.url.defaultUrl
                const imageType = type?.split("/")[1];
                menu.sections[index].products[i].imageType = imageType;
              }

            }
          }

        }

      }

      return new ResponseData(true, "", menu)
    } catch (error: any) {

    
      throw new Error(error)
    }
  }





  public static async getGrupTechMenuById(menuId: string, company: Company, storeId: string) {

    try {
      let devider = await Math.pow(10, company.afterDecimal);
      const companyId = company.id
      const sql = `
SELECT
      jsonb_build_object(
          'name',
          jsonb_build_object('translations', jsonb_build_object('en-us', COALESCE(m."translation"->'name'->>'en', m."name"), 'ar-ae',COALESCE(m."translation"->'name'->>'ar', m."name"))),
             'description',
                              jsonb_build_object(
                                  'translations',
                                 jsonb_build_object('en-us', COALESCE(m."translation"->'description'->>'en', m."name"), 'ar-ae',COALESCE(m."translation"->'description'->>'ar', m."name"))
                              ),
          'id',
          m.id,
           'currencyCode',
          'BHD',
          'imageUrl',
          'https://cdn.staging.grubtech.io/default-menu-cover.jpg',
          'storeIds',
          jsonb_build_array($3::text),
          'modifierGroups',
          (
              SELECT
                 case when COUNT(og.id) =0  then '[]'::jsonb else jsonb_agg(
                      jsonb_build_object(
                          'id',
                          og.id,
                          'name',
                          jsonb_build_object(
                              'translations',
                          jsonb_build_object('en-us', COALESCE(og."translation"->'name'->>'en', og."title"), 'ar-ae',COALESCE(og."translation"->'name'->>'ar', og."title"))
                          ),
                          'quantityInfo',
                          jsonb_build_object(
                              'maxPermitted',
                              og."maxSelectable",
                              'minPermitted',
                              og."minSelectable"
                          ),
                          'modifiers',
                          (
                              SELECT
                                  json_agg(option_id) AS option_ids
                              FROM
                                  (
                                      SELECT
                                          DISTINCT json_array_elements(ogo."options") ->> 'optionId' AS option_id
                                      FROM
                                          "OptionGroups" ogo
                                      WHERE
                                          ogo.id = og.id
                                  ) AS subquery
                          )
                      )
                  )
             end FROM
                  "OptionGroups" og
              WHERE
                  og.id :: text IN (
                      SELECT
                          DISTINCT json_array_elements("optionGroups") ->> 'optionGroupId' :: text AS option_group_id
                      FROM
                          "Menu" mop
                          LEFT JOIN "MenuSection" ms ON m.id = ms."menuId"
                          INNER JOIN "MenuSectionProduct" msp ON ms.id = msp."menuSectionId"
                          INNER JOIN "Products" p ON msp."productId" = p.id
                      WHERE
                          mop.id = m.id
                  )
          ),
          'items',
          (
              (
    SELECT jsonb_agg(
          jsonb_build_object(
              'id', p.id,
              'name',  jsonb_build_object(
                                  'translations', jsonb_build_object('en-us', COALESCE(p."translation"->'name'->>'en', p."name"), 'ar-ae',COALESCE(p."translation"->'name'->>'ar', p."name"))),
              'description', jsonb_build_object(
                                  'translations', jsonb_build_object('en-us', COALESCE(p."translation"->'description'->>'en', p."name"), 'ar-ae',COALESCE(p."translation"->'description'->>'ar', p."name"))),
              'priceInfo', jsonb_build_object('price', floor(p."defaultPrice"::numeric*$2)),
              'quantityInfo', jsonb_build_object('maxPermitted', 100, 'minPermitted', 0),
              'type', 'ITEM',
              'availability', 'AVAILABLE',
              'imageUrl', COALESCE(
        (SELECT url->>'defaultUrl' FROM "Media" m2 WHERE p."mediaId" = m2.id),
        'https://cdn.staging.grubtech.io/default-menu-cover.jpg'
    ),
              'modifierGroups', (
                  CASE
                      WHEN EXISTS (
                          SELECT 1
                          FROM (
                              SELECT pj.id, json_agg(DISTINCT option_group->>'optionGroupId') AS option_group_ids
                              FROM "Products" pj
                              CROSS JOIN LATERAL json_array_elements(pj."optionGroups") AS option_group
                              WHERE pj.id = p.id
                              AND pj."optionGroups" IS NOT NULL
                              GROUP BY pj.id
                          ) AS pg
                      )
                      THEN
                          (
                              SELECT to_jsonb(pg.option_group_ids)
                              FROM (
                                  SELECT pj.id, json_agg( option_group->>'optionGroupId' ORDER BY (option_group->>'index')::int) AS option_group_ids
                                  FROM "Products" pj
                                  CROSS JOIN LATERAL json_array_elements(pj."optionGroups") AS option_group
                                  WHERE pj.id = p.id
                                  AND pj."optionGroups" IS NOT NULL
                                  GROUP BY pj.id
                              ) AS pg
                          )
                      ELSE
                          jsonb_build_array() -- Empty array if no modifier groups exist
                  END
              ),
              'classifications', jsonb_build_array('NON_VEG')
          )
      )
  FROM (
      SELECT DISTINCT ON (p.id) p.*
      FROM "Products" p
      JOIN "MenuSectionProduct" msp ON p.id = msp."productId"
      JOIN "MenuSection" ms ON msp."menuSectionId" = ms.id
      WHERE ms."menuId" = $1
  ) p
   )||(
                  SELECT
                     case when COUNT(o.id) =0  then  '[]'::jsonb else jsonb_agg(
                          jsonb_build_object(
                              'id',
                              o.id,
                              'name',
                              jsonb_build_object(
                                  'translations',
                              jsonb_build_object('en-us', COALESCE(o."translation"->'name'->>'en', o."name"), 'ar-ae',COALESCE(o."translation"->'name'->>'ar', o."name"))
                              ),
                              'description',
                              jsonb_build_object(
                                  'translations',
                                  jsonb_build_object('en-us', COALESCE(o."translation"->'description'->>'en', o."name"), 'ar-ae',COALESCE(o."translation"->'description'->>'ar', o."name"))
                              ),
                              'priceInfo',
                              jsonb_build_object('price',floor(o."price"::numeric*$2)),
                              'type',
                              'MODIFIER',
                              'availability',
                              'AVAILABLE',
                              'quantityInfo',
                              jsonb_build_object('maxPermitted', 100 ,'minPermitted' ,0),
                               'classifications',
                               jsonb_build_array() ,
                              'modifierGroups',
                               jsonb_build_array() 
                          )
                      ) end 
                  FROM
                      "Options" o
                  WHERE
                      id :: text IN (
                          SELECT
                              DISTINCT JSON_ARRAY_ELEMENTS(ogo."options") ->> 'optionId' AS option_id
                          FROM
                              "OptionGroups" ogo
                              JOIN (
                                  SELECT
                                      DISTINCT JSON_ARRAY_ELEMENTS("optionGroups") ->> 'optionGroupId' AS option_group_id
                                  FROM
                                      "Menu"
                                      JOIN "MenuSection" ON "Menu".id = "MenuSection"."menuId"
                                      JOIN "MenuSectionProduct" ON "MenuSection".id = "MenuSectionProduct"."menuSectionId"
                                      JOIN "Products" ON "MenuSectionProduct"."productId" = "Products".id
                                  WHERE
                                      "Menu".id = m.id
                              ) AS subquery ON ogo.id :: TEXT = subquery.option_group_id
                      )
              )
          ),
          'categories',
          (
                                SELECT 
    jsonb_agg(result) AS combined_result
FROM (
    SELECT 
        jsonb_build_object(
            'background',
            jsonb_build_object(
                'type',
                'SOLID_COLOR',
                'value',
                '#640505'
            ),
            'name',
            jsonb_build_object(
                'translations',
                jsonb_build_object('en-us', COALESCE(ms."translation"->'name'->>'en', ms."name"), 
                                   'ar-ae', COALESCE(ms."translation"->'name'->>'ar', ms."name"))
            ),
            'id',
            ms.id,
            'description',
            jsonb_build_object(
                'translations',
                jsonb_build_object('en-us', COALESCE(ms."translation"->'description'->>'en', ms."name"), 
                                   'ar-ae', COALESCE(ms."translation"->'description'->>'ar', ms."name"))
            ),
            'servingHours',
            jsonb_build_array(
                jsonb_build_object(
                    'dayOfWeek',
                    'SUNDAY',
                    'timePeriods',
                    jsonb_build_array(
                        jsonb_build_object('start', m."startAt", 'end', m."endAt")
                    )
                ),
                jsonb_build_object(
                    'dayOfWeek',
                    'MONDAY',
                    'timePeriods',
                    jsonb_build_array(
                        jsonb_build_object('start', m."startAt", 'end', m."endAt")
                    )
                ),
                jsonb_build_object(
                    'dayOfWeek',
                    'TUESDAY',
                    'timePeriods',
                    jsonb_build_array(
                        jsonb_build_object('start', m."startAt", 'end', m."endAt")
                    )
                ),
                jsonb_build_object(
                    'dayOfWeek',
                    'WEDNESDAY',
                    'timePeriods',
                    jsonb_build_array(
                        jsonb_build_object('start', m."startAt", 'end', m."endAt")
                    )
                ),
                jsonb_build_object(
                    'dayOfWeek',
                    'THURSDAY',
                    'timePeriods',
                    jsonb_build_array(
                        jsonb_build_object('start', m."startAt", 'end', m."endAt")
                    )
                ),
                jsonb_build_object(
                    'dayOfWeek',
                    'FRIDAY',
                    'timePeriods',
                    jsonb_build_array(
                        jsonb_build_object('start', m."startAt", 'end', m."endAt")
                    )
                ),
                jsonb_build_object(
                    'dayOfWeek',
                    'SATURDAY',
                    'timePeriods',
                    jsonb_build_array(
                        jsonb_build_object('start', m."startAt", 'end', m."endAt")
                    )
                )
            ),
            'items',
            (
                SELECT
                    jsonb_agg(msp."productId"  ORDER BY msp.index)
                FROM
                    "MenuSectionProduct" msp
                WHERE
                    msp."menuSectionId" = ms.id
                    
            )
        ) AS result
    FROM 
        "Menu" m
    LEFT JOIN 
        "MenuSection" ms ON m.id = ms."menuId"
    LEFT JOIN 
        "MenuSectionProduct" msp ON msp."menuSectionId" = ms."id"
    WHERE 
        m.id = $1 AND msp."productId" IS NOT NULL -- Exclude categories with null items
    GROUP BY 
        ms.id, m.id, m."startAt", m."endAt"
    ORDER BY 
        ms."index"
) subquery

          )
      ) AS menu
  FROM
      "Menu" m
      LEFT JOIN "MenuSection" ms ON m.id = ms."menuId"
      LEFT JOIN "MenuSectionProduct" msp ON msp."menuSectionId" = ms."id"
  WHERE
      m.id = $1
  GROUP BY
      m.id`;
      const query: { text: string, values: any } = {
        text: sql,
        values: [menuId, devider, storeId]
      }
      const menus = await DB.excu.query(query.text, query.values);
      const menu: any = menus.rows[0];

      return new ResponseData(true, "", menu)
    } catch (error: any) {

    
      throw new Error(error)
    }
  }






















  public static async MenuProductList(company: Company, data: any): Promise<ResponseData> {
    try {
      const companyId = company.id;
      let offset = 0
      const productlimit = ((data.limit == null) ? 15 : data.limit);


      if (data.page > 1) {
        offset = (productlimit * (data.page - 1)) + 1;
      }

      let searchValue = '[A-Za-z0-9]*';

      if (data.searchTerm) {
        searchValue = '%' + data.searchTerm.trim().toLowerCase() + '%';

      }

      let countQuery = `SELECT 
                          count("Products".id)
                      FROM "Products"
                      left JOIN "Categories" on "Categories".id = "Products"."categoryId"
                      left JOIN "Media"
                      on "Media".id =   "Products"."mediaId"
                      where "Products"."companyId"=$1
                      AND "Products"."isDeleted" =false
                     `
      let countValues = [companyId];

      let query: { text: string, values: any } = {
        text: `SELECT 
                  "Products".id,
                  "Products".name,
                  "Products"."defaultImage" ,
                  "Products".color,
                  "Products"."categoryId",
                  COALESCE("Categories".name,'Uncategorized')as "categoryName",
                  "Products"."mediaId",
                  "Media".url,
                  "Media"."mediaType" AS "imageType"
              FROM "Products"
              left JOIN "Categories" on "Categories".id = "Products"."categoryId"
              left JOIN "Media"
              on "Media".id =   "Products"."mediaId"
              where "Products"."companyId"=$1
              AND "Products"."isDeleted" =false
              ORDER BY "Products"."createdAt" DESC
              LIMIT $2
              OFFSET $3`,
        values: [
          companyId,
          productlimit,
          offset
        ],
      }
      if (data.searchTerm != "" && data.searchTerm != null) {
        countQuery = `SELECT 
                          count("Products".id)
                      FROM "Products"
                      left JOIN "Categories" on "Categories".id = "Products"."categoryId"
                      left JOIN "Media"
                      on "Media".id =   "Products"."mediaId"
                      where "Products"."companyId"=$1
                      AND "Products"."isDeleted" =false 
                      AND (LOWER("Products"."name") LIKE $2 OR LOWER("Categories"."name") LIKE $2)`
        countValues = [companyId, searchValue];

        query = {
          text: `SELECT 
                  "Products".id,
                  "Products".name,
                  "Products"."defaultImage",
                  "Products"."categoryId",
                  COALESCE("Categories".name,'Uncategorized')as "categoryName",
                  "Media".url,
                  "Media"."mediaType" AS "imageType"
              FROM "Products"
              left JOIN "Categories" on "Categories".id = "Products"."categoryId"
              left JOIN "Media"
              on "Media".id =   "Products"."mediaId"
              WHERE  "Products"."companyId" =$1
              AND "Products"."isDeleted" =false
              AND (LOWER("Products"."name") LIKE $2 OR LOWER("Categories"."name") LIKE $2)
              ORDER BY "Products"."createdAt" desc 
              limit $3 offset $4`,
          values: [
            companyId,
            searchValue,
            productlimit,
            offset
          ],
        }
      }
      let countSelect = await DB.excu.query(countQuery, countValues);
      let count = Number((<any>countSelect.rows[0]).count)
      let pageCount = Math.ceil(count / data.limit)
      const list: any = await DB.excu.query(query.text, query.values);


      for (let index = 0; index < list.rows.length; index++) {
        const element = list.rows[index];
        if (list.rows[index].url)
          list.rows[index].defaultImage = list.rows[index].url.thumbnailUrl
      }

      offset += 1
      let lastIndex = ((data.page) * data.limit)
      if (list.rows.length < data.limit || data.page == pageCount) {
        lastIndex = count;

      }

      const resData = {
        list: list.rows,
        count: count,
        pageCount: pageCount,
        startIndex: offset,
        lastIndex: lastIndex
      }
      return new ResponseData(true, "", resData)
    } catch (error: any) {
    
      throw new Error(error)
    }

  }
  public static async rearrangeMenu(data: any) {
    try {

      let updateDate = new Date();
      const queryText = `UPDATE "Menu" SET index =$1,"updatedDate"=$2 where id =$3`;


      for (let index = 0; index < data.length; index++) {
        const element = data[index];
        await DB.excu.query(queryText, [element.index, updateDate, element.id])

      }

      return new ResponseData(true, "", [])
    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  public static async deleteMenuSectionProduct(client: PoolClient, productId: string) {
    try {

      const query: { text: string, values: any } = {
        text: `DELETE FROM "MenuSectionProduct" where "productId"=$1`,
        values: [productId]
      }
      await client.query(query.text, query.values)
    } catch (error: any) {
    

      throw new Error(error)
    }
  }



  public static async GruptechItemAvailable(client: PoolClient, branchId: string, productId: string, available: boolean) {
    try {
      const companyId: any = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;
      let plugin = await PluginRepo.getPluginByNameWithClient(client, 'GrubTech', companyId);


      if (plugin.data == undefined || plugin.data.settings == undefined) {
        return
      }


      let setting = plugin.data.settings;
      const token = "liqGqa3N8o3VogWVqVqM77H3f6gW3xxz7sZ5DBiL";
      console.log(setting)
      const branchSetting = setting.branches.find((element: { branchId: string; }) => element.branchId == branchId) || [];

      if (branchSetting.length == 0) {
        return;
      }

      console.log(2)
      let menuId = branchSetting.menuId
      let storeId = branchSetting.storeId
      let itemID = productId;
      let AVAILABLE = available ? 'AVAILABLE' : 'UNAVAILABLE';

      const countQuery = `         
                select count("productId")  from "MenuSectionProduct" msp 
                join "MenuSection" ms ON ms.id = msp."menuSectionId" 
                join "Menu" m on ms."menuId"  = m.id 
                 WHERE m.id =$1 and "productId" = $2`
      const countValues = [menuId, itemID];

      let countSelect = await client.query(countQuery, countValues);
      let count = Number((<any>countSelect.rows[0]).count)
      if (count == 0) {
        return;
      }
      // const menu = (await MenuRepo.getGrupTechMenuById(menuId, company, storeId)).data?.menu;
      const config = {
        method: 'PUT',
        url: 'https://api.grubtech.io/menu/v1/menus/' + menuId + '/items/' + itemID + '/availability',
        headers: {
          'accept': '*/*',
          'Content-Type': 'application/json',
          'X-Api-Key': token
        },
        data: {
          "storeId": storeId,
          "availability": AVAILABLE
        },
        timeout: 30000, // Setting a timeout for the request
      };

      console.log(config);
      console.log("response");
      const response = await axios(config);
      console.log(response);

      if (response.status != 200) {
        return
      }
      console.log("response");
    } catch (error: any) {
      console.log(error);
    
    }
  }










}