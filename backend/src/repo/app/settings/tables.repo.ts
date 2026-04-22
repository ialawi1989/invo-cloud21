import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { TableGroups } from "@src/models/Settings/TableGroups";
import { Tables } from "@src/models/Settings/Tables";
import { TablesValidation } from "@src/validationSchema/product/tables.Schema";
import { PoolClient } from "pg";


import { ValidationException } from "@src/utilts/Exception";
export class TablesRepo {
  public static async checkIfTableGroupsExist(client: PoolClient, tableGroupId: string, companyId: string, branchId: string) {
    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "TableGroups" where  id = $1 and "companyId" = $2  `,
      values: [
        tableGroupId,
        companyId
      ],
    };
    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async checkIfGroupNameExist(client: PoolClient, groupId: string | null, name: string, branchId: string) {
    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "TableGroups" where lower(name) = lower($1) and id <> $2  and "branchId"=$3   `,
      values: [
        name,
        groupId,
        branchId
      ],
    };
    if (groupId == null) {
      query.text = `SELECT count(*) as qty FROM "TableGroups" where lower(name) = lower($1)  and "branchId"=$2   `;
      query.values = [name, branchId];
    }

    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;
  }
  public static async checkIfTableIdExist(tableId: string, companyId: string) {
    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Table" where id = $1  and "companyId" = $2`,
      values: [
        tableId,
        companyId,

      ],
    };

    const table = await DB.excu.query(query.text, query.values);
    if ((<any>table.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }

  public static async checkIfTableNameExist(client: PoolClient, tableId: string | null, name: string, branchId: string) {

    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Tables" where name = $1 and id <> $2 and "branchId" = $3 `,
      values: [
        name,
        tableId,
        branchId,
      ],
    };
    if (tableId == null) {
      query.text = `SELECT count(*) as qty FROM "Tables" where name = $1  and "branchId" = $2`;
      query.values = [name, branchId];
    }

    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;
  }





  public static async addTableGroups(client: PoolClient, data: any, compnayId: string) {

    try {
      const validate = await TablesValidation.tableGroupsValidation(data);
      if (!validate.valid) {
        throw new ValidationException(validate.error);
      }

      const group = new TableGroups();
      group.ParseJson(data);
      group.companyId = compnayId;

      const isGroupNameExist = await this.checkIfGroupNameExist(client, null, group.name, group.branchId);
      if (isGroupNameExist) {
        throw new ValidationException("Group Name Already Used")
      }
      const query : { text: string, values: any } = {
        text: `INSERT INTO "TableGroups" (name,index,"branchId","companyId",objects,properties,"isActive" ) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id `,
        values: [
          group.name,
          group.index,
          group.branchId,
          group.companyId,
          JSON.stringify(group.objects),
          group.properties,
          group.isActive
        ],
      };

      const insert = await client.query(query.text, query.values);
      group.id = (<any>insert.rows[0]).id;
      for (let index = 0; index < group.tables.length; index++) {
        const element = group.tables[index];
        element.branchId = group.branchId;
        element.tableGroupId = group.id;
        if (element.id != "" && element.id != null) {
          await this.editTable(client, element, compnayId)

        } else {
          group.tables[index].id = (await this.addTable(client, element, compnayId)).data.id

        }

      }
      const resdata = {
        id: group.id,
        group: group
      }

      return new ResponseData(true, "Added Successfully", resdata)

    } catch (error: any) {
      console.log(error)
    
      throw new Error(error.message)
    }
  }

  public static async addTable(client: PoolClient, table: Tables, compnayId: string) {
    try {
      table.companyId = compnayId;

      const isTableNameExist = await this.checkIfTableNameExist(client, null, table.name, table.branchId)
      if (isTableNameExist) {
        throw new ValidationException("table name Already Exist")
      }

      const query : { text: string, values: any } = {
        text: `INSERT INTO "Tables"("tableGroupId","branchId","maxSeat","companyId","name",properties,settings) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id `,
        values: [
          table.tableGroupId,
          table.branchId,
          table.maxSeat,
          table.companyId,
          table.name,
          table.properties,
          table.settings

        ],
      };

      const insert = await client.query(query.text, query.values);

      const resdata = {
        id: (<any>insert.rows[0]).id
      }

      return new ResponseData(true, "Added Successfullu", resdata)

    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }

  public static async editTableGroups(client: PoolClient, data: any, compnayId: string) {

    try {

      const validate = await TablesValidation.tableGroupsValidation(data);
      if (!validate.valid) {
        throw new ValidationException(validate.error);
      }
      const group = new TableGroups();
      group.ParseJson(data);
      group.companyId = compnayId;

      const isGroupNameExist = await this.checkIfGroupNameExist(client, group.id, group.name, group.branchId);
      if (isGroupNameExist) {
        throw new ValidationException("Group Name Already Used")
      }

      const query : { text: string, values: any } = {
        text: `UPDATE "TableGroups" SET name=$1 ,index=$2,properties=$3,objects=$4 , "updatedDate"=$5 ,"isActive"=true  WHERE id=$6 and  "branchId"=$7 and "companyId"=$8`,
        values: [
          group.name,
          group.index,
          group.properties,
          JSON.stringify(group.objects),
          group.updatedAt,
          group.id,
          group.branchId,
          group.companyId],
      };

      const update = await client.query(query.text, query.values);

      for (let index = 0; index < group.tables.length; index++) {
        const element: any = group.tables[index];
        element.companyId = compnayId;
        element.branchId = group.branchId;
        element.tableGroupId = group.id;
        if (element.id == null || element.id == "") {
          group.tables[index].id =   (await this.addTable(client, element, compnayId)).data.id
        } else {

          await this.editTable(client, element, compnayId)


        }

      }

      return new ResponseData(true, "Updated Successfully", {group:group})

    } catch (error: any) {

    
      throw new Error(error.message)
    }
  }
  public static async editTable(client: PoolClient, table: Tables, compnayId: string) {
    try {

      const isGroupIdExist = await this.checkIfTableGroupsExist(client, table.tableGroupId, compnayId, table.branchId);
      if (!isGroupIdExist) {
        throw new ValidationException("table Group Id doesn't exist")
      }
      const isTableNameExist = await this.checkIfTableNameExist(client, table.id, table.name, table.branchId)
      if (isTableNameExist) {
        throw new ValidationException("table name Already Exist")
      }

      const query : { text: string, values: any } = {
        text: `UPDATE "Tables" SET "maxSeat"=$1, name=$2, "updatedDate"=$3,properties=$4 ,"tableGroupId"=$5 , "settings"=$6 WHERE id=$7 `,
        values: [

          table.maxSeat,
          table.name,
          table.updatedDate,
          table.properties,
          table.tableGroupId,
          table.settings,
          table.id
        ],
      };

      const Update = await client.query(query.text, query.values);

      return new ResponseData(true, "Edit Successfully", [])

    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }

  public static async deleteGroup(groupId: string) {

    const client = await DB.excu.client()
    try {
      await client.query("BEGIN")
      const query : { text: string, values: any } = {
        text: `UPDATE "Tables" SET "tableGroupId" = null where  "tableGroupId"=$1`,
        values: [groupId]
      }

      await client.query(query.text, query.values);
      
      query.text = `UPDATE  "TableGroups" SET "isActive" = false , "updatedDate" = $2 where id =$1`;
      query.values = [groupId,new Date()];

      await client.query(query.text, query.values)
      await client.query("COMMIT")

      return new ResponseData(true, "", [])

    } catch (error: any) {
      await client.query("ROLLBACK");
    

      throw new Error(error)
    } finally {
      client.release()
    }
  }


  public static async getUnassingedTables(branchId: string) {
    try {
      const query : { text: string, values: any } = {
        text: `SELECT * FROM "Tables"  where "branchId"=$1 and "tableGroupId" is null`,
        values: [branchId]
      }

      let tables = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", tables.rows)
    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  // public static async getTablesList(branchId: string) {
  //   try {
  //     // const query={
  //     //   text:`SELECT * FROM "Tables" INNER JOIN table2 "TableGroups" 
  //     //         ON  "Tables"."branchId" = "TableGroups"."branchId" 
  //     //         AND  "Tables"."branchId" = $1`, 
  //     //   values: [branchId]
  //     // }
  //     // const tables = await DB.excu.query(query.text,query.values);

  //     const query : { text: string, values: any } = {
  //       text: `SELECT name,id,index FROM "TableGroups" WHERE "branchId" = $1`,
  //       values: [branchId]
  //     }

  //     const tableList: TableGroups[] = [];
  //     const groups = await DB.excu.query(query.text, query.values);
  //     for (let index = 0; index < groups.rows.length; index++) {
  //       const element: any = groups.rows[index];
  //       element.tables = [];

  //       query.text = `SELECT  "maxSeat",postion, image FROM "Tables" WHERE "branchId" = $1 AND  "tableGroupId" =$2`
  //       query.values = [branchId, element.id]
  //       const tables = await DB.excu.query(query.text, query.values);
  //       for (let j = 0; j < tables.rows.length; j++) {
  //         const table = tables.rows[j];

  //         element.tables.push(table);
  //       }
  //       tableList.push(element)
  //     }

  //     const data = {
  //       list: tableList
  //     }

  //     return new ResponseData(true, "", data)
  //   } catch (error: any) {

  //     return new ResponseData(false, "", error)
  //   }
  // }

  public static async getTableGroupbyId(branchId: string, tableGroupId: string) {
    try {

      const query : { text: string, values: any } = {
        text: ` SELECT
             TableGroups.id,
             TableGroups.name,
             TableGroups.index,
             ( SELECT json_agg(json_build_object('id',id,'maxSeat', "maxSeat" , 'postion', postion, 'image', image,'settings',"settings")) AS tables 
               From  "Tables" where   TableGroups.id = "Tables"."tableGroupId"  ) 
              FROM "TableGroups" AS TableGroups 
              INNER JOIN "Tables"
              ON "Tables" ."tableGroupId"= TableGroups.id
              AND TableGroups."branchId" =$1
              AND TableGroups.id = $2
              AND "isActive" = true
              GROUP BY TableGroups.id
          `,
        values: [branchId, tableGroupId]
      }

      const table = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", table.rows[0]);
    } catch (error: any) {
    
      throw new Error(error.message);
    }
  }



  public static async getEditedTableGroupbyId(branchId: string, tableGroupIds: [string]) {
    try {

      const query : { text: string, values: any } = {
        text: `  SELECT
        TableGroups.*,
        ( SELECT json_agg(json_build_object('id',id,'maxSeat', "maxSeat" , 'name',name,'properties',properties)) AS tables 
          From  "Tables" where   TableGroups.id = "Tables"."tableGroupId"  ) 
         FROM "TableGroups" AS TableGroups 
         INNER JOIN "Tables"
         ON "Tables" ."tableGroupId"= TableGroups.id
         AND TableGroups."branchId" =$1
         AND TableGroups.id = any($2)
         GROUP BY TableGroups.id
          `,
        values: [branchId, tableGroupIds]
      }

      const table = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", table.rows);
    } catch (error: any) {
    
      throw new Error(error.message);
    }
  }




  public static async getTables(branchId: string, date: any | null = null) {
    try {
      const query : { text: string, values: any } = {
        text: ` SELECT
        TableGroups.*,
        ( SELECT json_agg(json_build_object('id',id,'maxSeat', "maxSeat" ,  'image', image, 'name',name ,'properties',properties,'settings',"settings")) AS tables 
          From  "Tables"  where TableGroups.id = "Tables" ."tableGroupId" ) 
         FROM "TableGroups" AS TableGroups 
          where TableGroups."branchId" =$1
          AND TableGroups."isActive" = true
          GROUP BY TableGroups.id
          order by  TableGroups.index ASC
          `,
        values: [branchId]
      }


      const tables = await DB.excu.query(query.text, query.values);
      const data = tables.rows

      return new ResponseData(true, "", data);
    } catch (error: any) {
    
      throw new Error(error.message);
    }
  }


  public static async getTableName(tabelId: string) {
    try {

      const query : { text: string, values: any } = {
        text: `SELECT "Tables".name,"TableGroups"."branchId" from "Tables"
                inner join "TableGroups" on "TableGroups".id = "Tables"."tableGroupId"
                where "Tables".id=$1`,
        values: [tabelId]
      }

      let table = await DB.excu.query(query.text, query.values);
      if(table&& table.rows && table.rows.length>0)
      {
        return new ResponseData(true, "", table.rows[0])
      }else{
        throw new Error("Table Not Found")
      }
     
    } catch (error: any) {
    

      throw new Error(error)
    }
  }


  public static async unassignTable(tableId: string) {
    try {

      const query : { text: string, values: any } = {
        text: `UPDATE "Tables"  SET "tableGroupId"= null where id =$1 `,
        values: [tableId]
      }

      await DB.excu.query(query.text, query.values);

      return new ResponseData(true, "Deleted Successfully", [])
    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  public static async getInActiveGroups(branchId: string) {
    try {
      const query : { text: string, values: any } = {
        text: 'SELECT * FROM "TableGroups" where "branchId" = $1 and "isActive"=false',
        values: [branchId]
      }

      const groups = await DB.excu.query(query.text, query.values);

      return new ResponseData(true, "", groups.rows);
    } catch (error: any) {
    

      throw new Error(error)
    }
  }


}