import { DB } from "@src/dbconnection/dbconnection";
import { Option } from "@src/models/product/Option";
import { OptionGroup } from "@src/models/product/OptionGroup";
import { ResponseData } from "@src/models/ResponseData";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { SocketOption } from "@src/repo/socket/option.socket";
import { OptionValidation } from "@src/validationSchema/product/option.Schema";




import { Company } from "@src/models/admin/company";
import { PoolClient } from "pg";

export class OptionRepo {

  public static async checkIfOptionGroupsExist(client: PoolClient, Ids: [string], companyId: string) {
    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "OptionGroups" where id = ANY($1) and "companyId" = $2 `,
      values: [
        Ids,
        companyId,
      ],
    };
    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async checkIfOptioIdExist(client: PoolClient, ids: any[], companyId: string) {

    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Options" where id=ANY($1) and "companyId" = $2 `,
      values: [ids, companyId],
    };
    const resault = await client.query(query.text, query.values);

    if ((<any>resault.rows[0]).qty == ids.length) {
      return true
    }
    return false
  }
  public static async checkIfOptionNameExist(optionId: string | null, name: string, companyId: string) {

    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Options" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3`,
      values: [
        name,
        optionId,
        companyId,

      ],
    };
    if (optionId == null) {
      query.text = `SELECT count(*) as qty FROM "Options" where LOWER(name) = LOWER($1)  and "companyId" = $2 `;
      query.values = [name, companyId];
    }

    const resault = await DB.excu.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;

  }
  public static async checkIfOptionGroupTitleExist(optionGroupId: string | null, title: string, companyId: string) {
    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "OptionGroups" where LOWER(title) = LOWER($1) and id <> $2 and "companyId" = $3`,
      values: [
        title,
        optionGroupId,
        companyId,

      ],
    };
    if (optionGroupId == null) {
      query.text = `SELECT count(*) as qty FROM "OptionGroups" where title = $1  and "companyId" = $2 `;
      query.values = [title, companyId];
    }

    const resault = await DB.excu.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;
  }



  // public static async getOptionsNameAndId(optionIds: [string], companyId: string) {
  //   try {
  //     const query : { text: string, values: any } = {
  //       text: `SELECT id as "optionId",name from "Options" WHERE id=ANY($1) and "companyId"=$2`,
  //       values: [optionIds, companyId]
  //     }
  //     const data = await DB.excu.query(query.text, query.values);
  //     return data.rows
  //   } catch (error: any) {
  //   
  //      throw new Error(error)
  //   }
  // }
  // public static async getOptionGroupTitle(optionGroupId: string, companyId: string) {
  //   try {
  //     const query : { text: string, values: any } = {
  //       text: `SELECT title from "OptionGroups" where  id =$1 AND "companyId"=$2`,
  //       values: [optionGroupId, companyId]
  //     }
  //     const data = await DB.excu.query(query.text, query.values);

  //     return (<any>data.rows[0]).name
  //   } catch (error: any) {
  //   
  //      throw new Error(error)
  //   }
  // }


  public static async InsertOptionGroup(client: PoolClient, data: any, company: Company) {
    try {
      const companyId = company.id;
      const validate = await OptionValidation.optionGroupValidation(data);
      if (!validate.valid) {
        return new ResponseData(false, validate.error, null);
      }
      const optionGroup = new OptionGroup();
      optionGroup.ParseJson(data);
      optionGroup.companyId = companyId;
      const optionIds: any[] = [];
      optionGroup.options.forEach(element => {
        optionIds.push(element.optionId);
      });

      const isNameExists = await this.checkIfOptionGroupTitleExist(null, optionGroup.title, optionGroup.companyId);
      if (isNameExists) {
        throw new Error("Title Already Used")
      }
      const isOptionIdExist = await this.checkIfOptioIdExist(client, optionIds, optionGroup.companyId)
      if (!isOptionIdExist) {
        throw new Error("Option Id dosn't exist")
      }

      optionGroup.updatedDate = new Date()
      const query : { text: string, values: any } = {
        text: 'INSERT INTO "OptionGroups"(title,"minSelectable", "maxSelectable",translation,"companyId",options,"updatedDate","mediaId") VALUES($1, $2,$3,$4,$5,$6,$7,$8) RETURNING id',
        values: [optionGroup.title,
        optionGroup.minSelectable,
        optionGroup.maxSelectable,
        optionGroup.translation,
        optionGroup.companyId,
        JSON.stringify(optionGroup.options),
        optionGroup.updatedDate,
        optionGroup.mediaId
        ],
      };
      const insert = await client.query(query.text, query.values);
      optionGroup.id = (<any>insert.rows[0]).id

      const branchIds = await BranchesRepo.getCompanyBranchIds(client,companyId);
      await SocketOption.sendNewOptionGroup(optionGroup, branchIds)
      const resdata = {
        id: optionGroup.id
      }
      return new ResponseData(true, "", resdata)
    } catch (error: any) {

    
      throw new Error(error)
    }
  }
  public static async editOptionGroup(client:PoolClient,data: any, company: Company) {
    try {
      const companyId = company.id;
      const validate = await OptionValidation.optionGroupValidation(data);
      if (!validate.valid) {
        return new ResponseData(false, validate.error, null);
      }
      if (data.id == null || data.id == "") {
        throw new Error("Option Group id Is Required")
      }
      const optionGroup = new OptionGroup();
      optionGroup.ParseJson(data);
      optionGroup.companyId = companyId


      const isNameExists = await this.checkIfOptionGroupTitleExist(optionGroup.id, optionGroup.title, optionGroup.companyId);
      if (isNameExists) {
        throw new Error("Title Already Used")
      }
      optionGroup.updatedDate = new Date()

      const query : { text: string, values: any } = {
        text: 'UPDATE "OptionGroups" SET title=$1,"minSelectable"=$2,"maxSelectable"=$3,translation=$4,options=$5,"updatedDate" =$6,"mediaId"=$7 WHERE id = $8 AND "companyId"=$9',
        values: [optionGroup.title, optionGroup.minSelectable,
        optionGroup.maxSelectable,
        optionGroup.translation, JSON.stringify(optionGroup.options), optionGroup.updatedDate,optionGroup.mediaId, optionGroup.id, optionGroup.companyId],
      };
      const insert = await DB.excu.query(query.text, query.values);
      const branchIds = await BranchesRepo.getCompanyBranchIds(client,companyId);
      await SocketOption.sendUpdatedOptionGroup(optionGroup, branchIds)
      return new ResponseData(true, "Updated Successfully", null)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getOptionGroupsList(data: any, company: Company) {

    try {
      const companyId = company.id;
      let selectQuery;
      let selectValues;
      let countQuery;
      let countValues;
      let searchValue = '[A-Za-z0-9]*';
      let offset = 0;
      let sort: any;
      let sortValue;
      let sortDirection;
      let sortTerm;
      let count = 0;
      let pageCount = 0;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (data.page != 1) {
        offset = (limit * (data.page - 1))
      }


      const selectText = `SELECT
                              id,
                              title
                       
                        FROM "OptionGroups"`
      const countText = `SELECT
                          count(*)
                      FROM "OptionGroups"`

      let filterQuery = ` WHERE "companyId"=$1  `
      filterQuery += ` AND (LOWER ("OptionGroups".title) ~ $2 
      )`
      const limitQuery = ` Limit $3 offset $4`

      let selectCount;
      let orderByQuery;
      selectQuery = selectText + filterQuery
      selectValues = [companyId, searchValue]


      if (data != null && data != '' && JSON.stringify(data) != '{}') {

        sort = data.sortBy;
        sortValue = !sort ? '"OptionGroups"."createdAt"' : '"' + sort.sortValue + '"';
        sortDirection = !sort ? "DESC" : sort.sortDirection;
        sortTerm = sortValue + " " + sortDirection
        orderByQuery = ` Order by ` + sortTerm;
        if (data.searchTerm != "" && data.searchTerm != null) {
          searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
        }

        selectQuery = selectText + filterQuery + orderByQuery + limitQuery
        selectValues = [companyId, searchValue, limit, offset]
        countQuery = countText + filterQuery
        countValues = [companyId, searchValue]

        selectCount = await DB.excu.query(countQuery, countValues)
        count = Number((<any>selectCount.rows[0]).count)
        pageCount = Math.ceil(count / data.limit)
      }


      const selectList: any = await DB.excu.query(selectQuery, selectValues)



      offset += 1
      let lastIndex = ((data.page) * data.limit)
      if (selectList.rows.length < data.limit || data.page == pageCount) {
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

    
      throw new Error(error)
    }
  }
  public static async getOptionGroups(company: Company, optionsGroupId: string, brandId: string) {
    try {
      const companyId = company.id;
      const query : { text: string, values: any } = {
        text: `SELECT "OptionGroups" .*, 
        "Media"."url"->>'defaultUrl'
        FROM "OptionGroups" 
              Left JOIN "Media" on "Media".id = "OptionGroups"."mediaId"
              WHERE "OptionGroups" ."companyId"=$1 AND "OptionGroups".id = $2 `,
        values: [companyId, optionsGroupId],
      };
      const optionsGroupList = await DB.excu.query(query.text, query.values);
      if (optionsGroupList.rowCount == 0) {
        throw new Error("Not Found");
      }
      const optionGroup: any = optionsGroupList.rows[0]

      return new ResponseData(true, "", optionGroup)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }


  public static async addOption(client: PoolClient, data: any, company: Company) {
    try {
      const companyId = company.id;
      const validate = await OptionValidation.optionsValidation(data);
      if (!validate.valid) {
        return new ResponseData(false, validate.error, null);
      }

      const afterDecimal = company.afterDecimal
      const option = new Option();
      option.ParseJson(data);
      option.companyId = companyId;
      option.price = +(option.price).toFixed(afterDecimal)
      const isNameExists = await this.checkIfOptionNameExist(null, option.name, option.companyId);
      if (isNameExists) {
        throw new Error("Option Name Already Exist")
      }
      option.updatedDate = new Date()

      const query : { text: string, values: any } = {
        text: `INSERT INTO  "Options"(name,"displayName",translation, price,"isMultiple","isVisible","companyId","updatedDate","mediaId" ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        values: [option.name, option.displayName, option.translation, option.price, option.isMultiple, option.isVisible, option.companyId, option.updatedDate,option.mediaId],
      };
      const insert = await client.query(query.text, query.values);
      option.id = (<any>insert.rows[0]).id

      const resdata = {
        id: option.id
      }
      const branchIds = await BranchesRepo.getCompanyBranchIds(client,companyId);
      await SocketOption.sendNewOption(option, branchIds)
      return new ResponseData(true, "Option Added Successfully", resdata)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async editOption(data: any, company: Company) {
    const client = await DB.excu.client();
    try {
      const companyId = company.id;
      const validate = await OptionValidation.optionsValidation(data);
      if (!validate.valid) {
        return new ResponseData(false, validate.error, null);
      }
      if (data.id == null || data.id == "") {
        throw new Error("Option id Is Required")
      }
      await client.query("BEGIN")
      const afterDecimal = company.afterDecimal
      const option = new Option();
      option.ParseJson(data);
      option.companyId = companyId;
      option.price = +(option.price).toFixed(afterDecimal)
      
      const isNameExists = await this.checkIfOptionNameExist(option.id, option.name, option.companyId);
      if (isNameExists) {
        throw new Error("Option Name Already Exist")
      }
      option.updatedDate = new Date()

      const query : { text: string, values: any } = {
        text: `UPDATE "Options" SET name= $1,"displayName"= $2,translation= $3, price= $4,"isMultiple"= $5,"isVisible"= $6, "updatedDate"= $7 ,"mediaId"=$8
            WHERE id = $9 AND "companyId"= $10   RETURNING id`,
        values: [option.name, option.displayName, option.translation, option.price, option.isMultiple, option.isVisible, option.updatedDate, option.id, option.companyId,option.mediaId],
      };

      const insert = await client.query(query.text, query.values);
      const branchIds = await BranchesRepo.getCompanyBranchIds(client,companyId);
      await SocketOption.sendupdatedOption(option, branchIds)
      await client.query("COMMIT")

      return new ResponseData(true, "Updated Successfully", [])
    } catch (error: any) {
      await client.query("ROLLBACK")

    
      throw new Error(error)
    }finally{
      client.release()
    }
  }
  public static async getOptions(data: any, company: Company) {
    try {
      const companyId = company.id;
      let selectQuery;
      let selectValues;
      let countQuery;
      let countValues;
      let searchValue = '[A-Za-z0-9]*';
      let offset = 0;
      let sort: any;
      let sortValue;
      let sortDirection;
      let sortTerm;
      let count = 0;
      let pageCount = 0;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (data.page != 1) {
        offset = (limit * (data.page - 1))
      }


      const selectText = `SELECT
                              id,
                              name,
                              "Options"."displayName",
                              "Options".price
                        FROM "Options"`
      const countText = `SELECT
                          count(*)
                      FROM "Options"`

      let filterQuery = ` WHERE "companyId"=$1  `
      filterQuery += ` AND (LOWER ("Options".name) ~ $2 OR
        LOWER ("Options"."displayName") ~ $2
         )`
      const limitQuery = ` Limit $3 offset $4`

      let selectCount;
      let orderByQuery;
      selectQuery = selectText + filterQuery
      selectValues = [companyId, searchValue]


      if (data != null && data != '' && JSON.stringify(data) != '{}') {


        sort = data.sortBy;
        sortValue = !sort ? '"Options"."createdAt"' : '"' + sort.sortValue + '"';
        sortDirection = !sort ? "DESC" : sort.sortDirection;
        sortTerm = sortValue + " " + sortDirection
        orderByQuery = ` Order by ` + sortTerm;
        if (data.searchTerm != "" && data.searchTerm != null) {
          searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
        }
        selectQuery = selectText + filterQuery + orderByQuery + limitQuery
        selectValues = [companyId, searchValue, limit, offset]
        countQuery = countText + filterQuery
        countValues = [companyId, searchValue]



        selectCount = await DB.excu.query(countQuery, countValues)
        count = Number((<any>selectCount.rows[0]).count)
        pageCount = Math.ceil(count / data.limit)
      }


      const selectList: any = await DB.excu.query(selectQuery, selectValues)



      offset += 1
      let lastIndex = ((data.page) * data.limit)
      if (selectList.rows.length < data.limit || data.page == pageCount) {
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

    
      throw new Error(error)
    }
  }
  public static async getOption(company: Company, optionId: string, brandId: string) {
    try {
      const companyId = company.id;
      const query : { text: string, values: any } = {
        text: `SELECT "Options".*,
                       "Media"."url"->>'defaultUrl'
                FROM "Options" 
                Left JOIN "Media" on "Media".id = "Options"."mediaId"
                WHERE "Options"."companyId"=$1 AND "Options".id=$2`,
        values: [companyId, optionId],
      };
      const option = await DB.excu.query(query.text, query.values);
      if (option.rowCount == 0) {
        throw new Error("Not Found");
      }
      const temp = new Option();
      temp.ParseJson(option.rows[0]);

      return new ResponseData(true, "", temp)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }





  /**Used to set Ecommerce OPtion price */
  public static async getOptionPrice(client: PoolClient, optionId: string) {
    try {
      const query : { text: string, values: any } = {
        text: `SELECT price,"name" from "Options" where id = $1`,
        values: [optionId]
      }

      let option = await client.query(query.text, query.values);
      return option.rows[0]
    } catch (error: any) {
    

      throw new Error(error)
    }
  }

}