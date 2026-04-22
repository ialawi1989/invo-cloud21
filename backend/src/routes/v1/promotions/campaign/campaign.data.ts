import {
  CampaignsStatues,
  ProductInfo,
  PromotionsCampaign,
} from "./campaign.modal";
import { PromotionsRepository } from "../promotions.data";
import { PromotionsAction, TranslatedString } from "../promotions.model";
import { PoolClient } from "pg";
import { SQL } from "../common/sql";
import { orderBy, PageInfo, queryPage } from "../common/pagination";
import { UUID } from "../common/uuid";
import { CampaignProvider } from "./campaign.business";
import { SortInfo } from "../common/sortInfo";

export class CampaignRepository {
  private promotionsRepository: PromotionsRepository;
  private client: PoolClient;
  constructor(promotionsRepository: PromotionsRepository, client: PoolClient) {
    this.promotionsRepository = promotionsRepository;
    this.client = client;
  }

  async getCampaigns(
    companyId: string,
    campaignsStatues?: CampaignsStatues,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<PromotionsCampaign[]> {
    let p = 1;
    const query: SQL = {
      text: `SELECT "id","campaign"
                FROM "PromotionsCampaigns" 
                WHERE "companyId" = $${p++}
                `,
      values: [companyId],
    };

    if (campaignsStatues) {
      query.text += `--sql
          AND "campaign"->>'status' = $${p++}
        `;
      query.values?.push(campaignsStatues);
    }

    query.text += orderBy(
      {
        status: `"campaign"->>'status'`,
        pointsValue: `"campaign"->>'givenPoints'`,
        givenDate: `"campaign"->>'createdDate'`,
        startDate: `"campaign"->>'startDate'`,
        endDate: `"campaign"->>'endDate'`,
      },
      "status",
      sortInfo,
    );

    const results = (await queryPage<any>(this.client, query, pageInfo)).map(
      (value, index) => {
        const campaign = value.campaign;
        campaign.id = value.id;
        return campaign;
      },
    );
    return results;
  }

  async getCampaignById(
    companyId: string,
    id: string,
  ): Promise<PromotionsCampaign | undefined> {
    const query: SQL = {
      text: `SELECT "campaign"
                FROM "PromotionsCampaigns" 
                WHERE "companyId" = $1
                AND "id" = $2`,
      values: [companyId, id],
    };
    const rows = (await this.client.query(query.text, query.values)).rows;
    if (rows.length == 0) return undefined;
    const campaign = rows[0].campaign;
    campaign.id = id;
    return campaign;
  }

  async AddCampaigns(
    companyId: string,
    campaign: PromotionsCampaign,
    action: PromotionsAction,
  ): Promise<string> {
    campaign.id = UUID();
    campaign.actionsList = undefined;

    const campaignType = "SpendXGetYPointsCampaign";

    const query: SQL = {
      text: `INSERT INTO "PromotionsCampaigns" ("id","companyId","campaignType","campaign")
                VALUES ($1,$2,$3,$4)`,
      values: [campaign.id, companyId, campaignType, campaign],
    };
    const result = (await this.client.query(query.text, query.values)).rows;

    await this.AddCampaignsAction(companyId, campaign, action);

    return campaign.id;
  }

  async UpdateCampaign(
    companyId: string,
    id: string, // replaced campaigns
    campaign: PromotionsCampaign,
    action: PromotionsAction,
  ): Promise<string> {
    const campaignType = "SpendXGetYPointsCampaign";

    const query: SQL = {
      text: `UPDATE "PromotionsCampaigns"
                SET "campaign" = $3
                WHERE"companyId"=$1
                AND "id"=$2`,
      values: [companyId, id, campaign],
    };

    const result = (await this.client.query(query.text, query.values)).rows;
    await this.AddCampaignsAction(companyId, campaign, action);

    return id;
  }

  private async AddCampaignsAction(
    companyId: string,
    campaign: PromotionsCampaign,
    action: PromotionsAction,
  ): Promise<string> {
    return await this.promotionsRepository.AddAction(
      companyId,
      campaign.id,
      "PromotionsCampaign",
      action,
    );
  }

  async getCampaignsActions(
    companyId: string,
    campaignId: string,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<PromotionsAction[]> {
    return await this.promotionsRepository.getActions(
      companyId,
      campaignId,
      "PromotionsCampaign",
      pageInfo,
      sortInfo,
    );
  }

  public async getProducts(
    companyId: string,
    productName?: string,
    pageInfo?: PageInfo,
  ) {
    const values: any[] = [];
    let p = 1;

    let text = `--sql
    SELECT
      p.id,
      p."name",
      p."translation"->>'name'  as "translation"
    FROM "Products" p
    WHERE p."companyId" = $${p}
  `;

    values.push(companyId);

    if (productName && productName.trim() !== "") {
      text += `--sql
     AND p."name" ILIKE $${++p} `;
      values.push(`%${productName}%`);
    }

    const query = { text, values };

    const result = await queryPage<any>(this.client, query, pageInfo);

    return result.map((data) => {
      const translation: TranslatedString | undefined = JSON.parse(
        data.translation,
      );
      return {
        id: data.id,
        name:
          translation && Object.keys(translation).length > 0
            ? translation
            : {
                en: data.name,
              },
      };
    });
  }
  async isCampaignNameExists(
    companyId: string,
    name: string,
    lang: string,
    id?: string,
  ): Promise<boolean> {
    const values: any[] = [companyId, name, lang];

    let text = `
    SELECT 1
    FROM "PromotionsCampaigns"
    WHERE "companyId" = $1
    AND "campaign"->'campaignsName'->> $3 = $2
  `;

    if (id) {
      values.push(id);
      text += ` AND id != $4`;
    }

    text += ` LIMIT 1;`;

    const result = await this.client.query(text, values);
    return result.rows.length > 0;
  }
  async isCampaignOverlap(
    companyId: string,
    startDate: Date,
    endDate: Date,
    customerTierIds: string[],
    id?: string,
  ): Promise<boolean> {
    const values: any[] = [companyId, startDate, endDate, customerTierIds];

    let text = `--sql
    SELECT 1
    FROM "PromotionsCampaigns"
    WHERE "companyId" = $1

   
    AND ("campaign"->>'startDate')::timestamp <= $3
    AND ("campaign"->>'endDate')::timestamp >= $2

   
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text("campaign"->'customerTierIds') AS tier
      WHERE tier = ANY($4)
    )
  `;

    if (id) {
      values.push(id);
      text += ` AND id != $5`;
    }

    text += ` LIMIT 1`;

    const result = await this.client.query(text, values);

    return result.rows.length > 0;
  }
  async getCampaignsByCouponSetId(
    companyId: string,
    couponSetId: string,
  ): Promise<PromotionsCampaign[]> {
    const query: SQL = {
      text: `--sql
      SELECT "id","campaign"
      FROM "PromotionsCampaigns"
      WHERE "companyId" = $1
      AND "campaign"->>'couponSetId' = $2
    `,
      values: [companyId, couponSetId],
    };

    const rows = (await this.client.query(query.text, query.values)).rows;

    return rows.map((row) => {
      const campaign = row.campaign;
      campaign.id = row.id;
      return campaign;
    });
  }
}
