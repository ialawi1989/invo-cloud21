import {
  CustomerPointsSummary,
  PromotionsAction,
  PromotionSettings,
} from "./promotions.model";
import { PoolClient } from "pg";
import { SQL } from "./common/sql";
import { Dictionary } from "./common/dictionary";
import { orderBy, PageInfo, queryPage } from "./common/pagination";
import { SortInfo } from "./common/sortInfo";

export class PromotionsRepository {
  private client: PoolClient;
  constructor(client: PoolClient) {
    this.client = client;
  }

  async getSettings(
    companyId: string,
    settingType: string,
    defaultValueResolver: () => PromotionSettings
    //TODO: include actions parameter
  ): Promise<any> {
    const query: SQL = {
      text: `SELECT "settings"
              FROM "PromotionsSettings" AS Branches
              WHERE "companyId" = $1
              AND "settingsType" = $2
              `,
      values: [companyId, settingType],
    };
    const results = await this.client.query(query.text, query.values);

    if (
      results.rows.length > 0 &&
      JSON.stringify(results.rows[0].settings) !== "{}"
    ) {
      const settings = results.rows[0].settings;
      //TODO: indlude actions if reuqted by parameter

      return settings;
    }

    let defaultValue = defaultValueResolver();
    await this.setSettings(companyId, settingType, defaultValue);
    return defaultValue;
  }

  async setSettings(
    companyId: string,
    settingType: string,
    settings: PromotionSettings
  ) {
    const query: SQL = {
      text: `INSERT INTO "PromotionsSettings" ("companyId","settingsType","settings")
                VALUES ($1,$2,$3)
                ON CONFLICT ("companyId","settingsType")
                DO UPDATE SET "settings" = $3;`,
      values: [companyId, settingType, settings],
    };
    //TODO: figure out a way to check if the rwo was inserted or updated to throw an error otherwise
    const result = (await this.client.query(query.text, query.values)).rows;
    return result;
  }

  async getPromotionsCustomers(companyId: string, phoneNumber: string) {
    const query: SQL = {
      text: `SELECT "activePoints","customerTierId"
                FROM "PromotionsCustomers" 
                WHERE "companyId"= $1
                AND "phoneNumber" = $2`,
      values: [companyId, phoneNumber],
    };
    const rows = (await this.client.query(query.text, query.values)).rows;
    if (rows && rows.length > 0) return rows[0];
    return undefined;
  }

  async getPromotionsCustomerSpending(
    companyId: string,
    phoneNumber: string,
    evaluationDate: Date
  ) {
    const query: SQL = {
      text: `--sql
          SELECT 
            SUM(i."total") AS "amountSpend",
            COUNT(*) AS "numberOfOrders",
            MAX(i."invoiceDate") AS "latestOrderDate"
          FROM "Invoices" AS i
            JOIN "Customers" AS c ON c."id" = i."customerId"
          WHERE 'Paid' = i.status 
            AND i."companyId" = $1
            AND c."companyId" = $1
            AND i."invoiceDate" >= $2
            AND c."phone" = $3`,
      values: [companyId, evaluationDate, phoneNumber],
    };
    const rows = (await this.client.query(query.text, query.values)).rows;
    if (rows && rows.length > 0) return rows[0];
    return undefined;
  }

  async getPromotionsCustomer(
    companyId: string,
    phoneNumber: string
  ): Promise<CustomerPointsSummary> {
    const query2: SQL = {
      text: `SELECT "customerTierId","activePoints"
                FROM "PromotionsCustomers"
                WHERE "companyId"= $1
                AND "phoneNumber" = $2`,
      values: [companyId, phoneNumber],
    };
    const result = (await this.client.query(query2.text, query2.values)).rows;
    return result[0];
  }

  async setPromotionsCustomerCustomerTier(
    companyId: string,
    phoneNumber: string,
    customerTierId: string
  ) {
    const query: SQL = {
      text: `INSERT INTO "PromotionsCustomers" ("companyId","phoneNumber","customerTierId")
                VALUES ($1,$2,$3)
                ON CONFLICT ("companyId","phoneNumber")
                DO UPDATE SET "customerTierId" = $3;`,
      values: [companyId, phoneNumber, customerTierId],
    };
    await this.client.query(query.text, query.values);
    return (await this.getPromotionsCustomer(companyId, phoneNumber))
      .customerTierId;
  }

  async setPromotionsCustomerPointsBalance(
    companyId: string,
    phoneNumber: string,
    activePoints: number
  ) {
    const query: SQL = {
      text: `INSERT INTO "PromotionsCustomers" ("companyId","phoneNumber","activePoints")
                VALUES ($1,$2,$3)
                ON CONFLICT ("companyId","phoneNumber")
                DO UPDATE SET "activePoints" = COALESCE("PromotionsCustomers"."activePoints", 0)  + $3;`,
      values: [companyId, phoneNumber, activePoints],
    };
    await this.client.query(query.text, query.values);
    return (await this.getPromotionsCustomer(companyId, phoneNumber))
      .activePoints;
  }


  async AddAction(
    companyId: string,
    objectId: string,
    objectType: string,
    action: PromotionsAction
  ): Promise<string> {
    const query: SQL = {
      text: `INSERT INTO "PromotionsActions" ("companyId","objectId","objectType","actionDetails")
                  VALUES ($1,$2,$3,$4)
                  RETURNING id`,
      values: [companyId, objectId, objectType, JSON.stringify(action)],
    };
    const result = await this.client.query(query.text, query.values);

    return result.rows[0].id;
  }

  async getActions(
    companyId: string,
    objectId: string,
    objectType: string,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo
  ) {
    const query: SQL = {
      text: `select "actionDetails"
                  FROM "PromotionsActions" 
                  WHERE"companyId"=$1
                  AND "objectId"=$2
                  AND "objectType"=$3`,
      values: [companyId, objectId, objectType],
    };
    query.text += orderBy(
      {
        actionDate: `"actionDetails"->>'actionDate'`,
        BalanceValue: `("actionDetails"->'extraDetails'->>'spentPoints')::int`,
        Amount: `("actionDetails"->'extraDetails'->>'activePoints')::int`,
      },
      "actionDate",
      sortInfo
    );
    const result = (await queryPage<any>(this.client, query, pageInfo)).map(
      (row, index) => row.actionDetails
    );
    const users = new Dictionary<string, string>();
    for (let index = 0; index < result.length; index++) {
      const action = result[index];

      if (users.has(action.user)) {
        action.user = users.get(action.user);
      } else {
        const user = await this.getEmployeeName(action.user, companyId);
        action.user = user;
        users.set(action.user, user);
      }
    }

    return result;
  }

  async getAllPromotionsCustomersPhoneNumber(companyId: string) {
    const query: SQL = {
      text: `--sql
            SELECT DISTINCT "phoneNumber"
            FROM (
                SELECT "phoneNumber"
                  FROM "PromotionsCustomers"
                  WHERE "companyId" = $1
              UNION
                SELECT "phone" AS "phoneNumber"
                  FROM "Customers"
                  WHERE "companyId" = $1
            ) as A`,
      values: [companyId],
    };
    const { rows } = await this.client.query(query.text, query.values);
    return rows;
  }

  async getCustomersSpending(companyId: string, evaluationDate: Date) {
    const allCustomers = await this.getAllPromotionsCustomersPhoneNumber(
      companyId
    );

    return Promise.all(
      allCustomers.map(async (customer) => {
        const result = await this.getPromotionsCustomerSpending(
          companyId,
          customer.phoneNumber,
          evaluationDate
        );
        return {
          customerTierId: customer.CustomerTier,
          phoneNumber: customer.phoneNumber,
          ...result,
        };
      })
    );
  }

  public async getEmployeeName(employeeId: string, companyId: string) {
    if (employeeId == "SYSTEM") return "SYSTEM";

    const query: SQL = {
      text: `--sql
            SELECT
                e."name"
            FROM "Employees" AS e
            WHERE e.id = $1 AND  e."companyId"=$2
            UNION
            SELECT
                e."name"
            FROM "CompanyEmployees" AS ce
              INNER JOIN "Employees" AS e ON e."id" = ce."employeeId"
            WHERE ce."employeeId" = $1 AND  ce."companyId"=$2`,
      values: [employeeId, companyId],
    };
    const rows = (await this.client.query(query.text, query.values)).rows;
    if (rows && rows.length > 0) return rows[0].name;
    return undefined;
  }
}
