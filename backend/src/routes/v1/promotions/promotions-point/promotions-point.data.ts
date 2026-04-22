import {
  DateTimeSpan,
  DatePeriodUnit,
  PromotionsAction,
} from "../promotions.model";
import {
  CustomerPointAction,
  CustomerPoint,
  PointsSettings,
  CustomerPointsStatues,
  CustomerPointsSettingAction,
} from "./promotions-point.modal";
import { PromotionsRepository } from "../promotions.data";
import { PoolClient } from "pg";
import { SQL } from "../common/sql";
import { UUID } from "../common/uuid";
import { orderBy, PageInfo, queryPage } from "../common/pagination";
import { SortInfo } from "../common/sortInfo";
import { Exception } from "../common/exceptions";

export class PromotionsPointsRepository {
  private promotionsRepository: PromotionsRepository;
  private client: PoolClient;
  constructor(promotionsRepository: PromotionsRepository, client: PoolClient) {
    this.promotionsRepository = promotionsRepository;
    this.client = client;
  }

  static defaultPointsSettings: PointsSettings = {
    currencyValue: 1,
    pointsName: {
      ar: "نقاط ذهبية",
      en: "gold point",
    },
    pointsValue: 1000,
    paymentMethodId: "",
    enabled: false,
    expiryPeriod: new DateTimeSpan(3, DatePeriodUnit.MONTHS),
    activePeriod: new DateTimeSpan(0, DatePeriodUnit.DAYS),
    expirySoonPeriod: new DateTimeSpan(2, DatePeriodUnit.WEEKS),
    actionsList: [],
  };

  static settingType = "PointsSettings";
  async getPointsSettings(companyId: string): Promise<PointsSettings> {
    const result: PointsSettings = await this.promotionsRepository.getSettings(
      companyId,
      PromotionsPointsRepository.settingType,
      () => PromotionsPointsRepository.defaultPointsSettings
    );
    result.actionsList = await this.promotionsRepository.getActions(
      companyId,
      PromotionsPointsRepository.settingType,
      PromotionsPointsRepository.settingType
    );
    return this.updateDefaultValues(result);
  }

  async getPointsActionsList(
    companyId: string,
    pageInfo?: PageInfo,
    sortInfo?:SortInfo
  ): Promise<CustomerPointsSettingAction[]> {
    let actionsList: CustomerPointsSettingAction[] =
      await this.promotionsRepository.getActions(
        companyId,
        PromotionsPointsRepository.settingType,
        PromotionsPointsRepository.settingType,
        pageInfo,
        sortInfo
      );

    return actionsList;
  }

  private updateDefaultValues(settings: any) {
    if (settings == PromotionsPointsRepository.defaultPointsSettings)
      return settings;
    if (settings == PromotionsPointsRepository.defaultPointsSettings)
      return settings;

    settings.activePeriod =
      settings.activePeriod ??
      PromotionsPointsRepository.defaultPointsSettings.activePeriod;
    settings.currencyValue =
      settings.currencyValue ??
      PromotionsPointsRepository.defaultPointsSettings.currencyValue;
    settings.enabled =
      settings.enabled ??
      PromotionsPointsRepository.defaultPointsSettings.enabled;
    settings.expiryPeriod =
      settings.expiryPeriod ??
      PromotionsPointsRepository.defaultPointsSettings.expiryPeriod;
    settings.expirySoonPeriod =
      settings.expirySoonPeriod ??
      PromotionsPointsRepository.defaultPointsSettings.expirySoonPeriod;
    settings.pointsName =
      settings.pointsName ??
      PromotionsPointsRepository.defaultPointsSettings.pointsName;
    settings.pointsValue =
      settings.pointsValue ??
      PromotionsPointsRepository.defaultPointsSettings.pointsValue;
    settings.actionsList =
      settings.actionsList ??
      PromotionsPointsRepository.defaultPointsSettings.actionsList;
    return settings;
  }

  async savePointsSettings(
    companyId: string,
    pointsSettings: PointsSettings,
    action: CustomerPointsSettingAction
  ) {
    pointsSettings = this.updateDefaultValues(pointsSettings);

    await this.promotionsRepository.setSettings(
      companyId,
      PromotionsPointsRepository.settingType,
      pointsSettings
    );

    let X = await this.promotionsRepository.AddAction(
      companyId,
      PromotionsPointsRepository.settingType,
      PromotionsPointsRepository.settingType,
      action
    );
  }

  async getCustomerPoints(
    companyId: string,
    phoneNumber?: string,
    customerPointsStatues?: CustomerPointsStatues,
    pageInfo?: PageInfo,
    sortInfo?:SortInfo
  ): Promise<CustomerPoint[]> {
    let p = 1;
    const query: SQL = {
      text: `SELECT "id","points"
                FROM "PromotionsCustomerPoints" 
                WHERE "companyId" = $${p++}`,
      values: [companyId],
    };

    if (phoneNumber && phoneNumber != "") {
      query.text += `--sql
                        AND "phoneNumber" = $${p++}`;
      query.values?.push(phoneNumber);
    }

    if (customerPointsStatues) {
      query.text += `--sql
                        AND "points"->>'status' =  $${p++}`;
      query.values?.push(customerPointsStatues);
    }

    query.text += orderBy( {
        "status": `"points"->>'status'`,
        "pointsValue": `"points"->>'givenPoints'`,
        "givenDate": `"points"->>'givenDate'`,
        "activeDate": `"points"->>'activeDate'`,
        "expiryDate": `"points"->>'expiryDate'`
      },'givenDate',sortInfo);

    const results = (await queryPage<any>(this.client, query, pageInfo)).map(
      (value, index) => {
        const points = value.points;
        points.id = value.id;
        return points;
      }
    );

    return results;
  }

  async getCustomerPointsById(
    companyId: string,
    id: string
  ): Promise<CustomerPoint | undefined> {
    const query: SQL = {
      text: `SELECT "id","points"
                FROM "PromotionsCustomerPoints" 
                WHERE "companyId" = $1
                AND "id" = $2`,
      values: [companyId, id],
    };

    const rows = (await this.client.query(query.text, query.values)).rows;
    if (rows.length == 0) return undefined;
    const points = rows[0].points;
    points.id = id;
    return points;
  }

  async AddCustomerPoints(
    companyId: string,
    customerPoints: CustomerPoint,
    action: CustomerPointAction
  ): Promise<string> {
    customerPoints.id = UUID();
    customerPoints.activePoints = customerPoints.givenPoints;
    customerPoints.actionsList = undefined;
    if (customerPoints.invoiceId) {
      const orderNumberQuery: SQL = {
        text: `SELECT "invoiceNumber"
             FROM "Invoices"
             WHERE "companyId" = $1
             AND "id" = $2`,
        values: [companyId, customerPoints.invoiceId],
      };

      const result = await this.client.query(
        orderNumberQuery.text,
        orderNumberQuery.values
      );
      if (result.rows.length > 0) {
        customerPoints.orderNumber = result.rows[0].invoiceNumber;
      }
    }
    const query: SQL = {
      text: `INSERT INTO "PromotionsCustomerPoints" ("id","companyId","phoneNumber","points")
                VALUES ($1,$2,$3,$4)`,
      values: [
        customerPoints.id,
        companyId,
        customerPoints.phoneNumber,
        customerPoints,
      ],
    };

    const result = (await this.client.query(query.text, query.values)).rows;

    await this.AddCustomerPointsAction(companyId, customerPoints, action);

    // return valid JSON
    return customerPoints.id;
  }

  private async AddCustomerPointsAction(
    companyId: string,
    customerPoints: CustomerPoint,
    action: PromotionsAction
  ): Promise<string> {
    action.actionDate = new Date();
    const activePoints =
      await this.promotionsRepository.setPromotionsCustomerPointsBalance(
        companyId,
        customerPoints.phoneNumber,
        action.extraDetails.spentPoints
      );

    action.extraDetails.grandActivePoints = activePoints;
    return await this.promotionsRepository.AddAction(
      companyId,
      customerPoints.id,
      "CustomerPoint",
      action
    );
  }

  async getCustomerPointsAction(
    companyId: string,
    customerPointsId: string,
    pageInfo?: PageInfo,
    sortInfo?:SortInfo
  ) {
    return await this.promotionsRepository.getActions(
      companyId,
      customerPointsId,
      "CustomerPoint",
      pageInfo,
      sortInfo
    );
  }

  async updateCustomerPoints(
    companyId: string,
    customerPoints: CustomerPoint,
    action: CustomerPointAction
  ) {
    customerPoints.actionsList = undefined;

    const query: SQL = {
      text: `UPDATE "PromotionsCustomerPoints"
                SET "points" = $3
                WHERE "companyId" = $1
                AND "id" = $2`,
      values: [companyId, customerPoints.id, customerPoints],
    };
    const resultL = (await this.client.query(query.text, query.values)).rows;

    await this.AddCustomerPointsAction(companyId, customerPoints, action);

    //return the id
    return customerPoints.id;
  }

  async getActiveCustomerPoints(
    companyId: string,
    phoneNumber: string,
    expiryDate: Date
  ) {
    const query: SQL = {
      text: `SELECT "id","points"
                FROM "PromotionsCustomerPoints" 
                WHERE "companyId" = $1
                AND "phoneNumber" = $2
                AND ("points"->>'expiryDate')::date <= $3
                AND "points"->>'status' = $4`,
      values: [
        companyId,
        phoneNumber,
        expiryDate,
        CustomerPointsStatues.ACTIVE,
      ],
    };
    const results: CustomerPoint[] = (
      await this.client.query(query.text, query.values)
    ).rows.map((value, index) => {
      const points = value.points;
      points.id = value.id;
      return points;
    });
    return results;
  }

  async getAllActionList(
    companyId: string,
    customerPhoneNumber: string,
    pageInfo?: PageInfo,
     sortInfo?:SortInfo
  ) {
    const query: SQL = {
      text: `select "PromotionsActions"."timestamp","actionDetails"
                FROM "PromotionsActions" 
                JOIN "PromotionsCustomerPoints" 
                  ON "PromotionsCustomerPoints"."companyId" = "PromotionsActions"."companyId"
                  AND "PromotionsActions"."objectType" = 'CustomerPoint'
                  AND "PromotionsCustomerPoints"."id" = "PromotionsActions"."objectId"::uuid
                WHERE "PromotionsCustomerPoints"."companyId"=$1
                AND "PromotionsActions"."objectType" = 'CustomerPoint'
                AND "PromotionsActions"."companyId"=$1
                AND "PromotionsCustomerPoints"."phoneNumber"=$2
               `,
      values: [companyId, customerPhoneNumber],
    };
        query.text += orderBy( {
        actionDate:["timestamp", `"actionDetails"->>'actionDate'`],
        spentPoints: `("actionDetails"->'extraDetails'->>'spentPoints')::int`,
        grandActivePoints: `("actionDetails"->'extraDetails'->>'grandActivePoints')::int`,
       
      },'actionDate',sortInfo);
    const result = (await queryPage<any>(this.client, query, pageInfo)).map(
      (row, index) => row.actionDetails
    );
    // return valid JSON
    return result;
  }
}
