import { PromotionsRepository } from "../promotions.data";
import { PromotionsAction, TranslatedString } from "../promotions.model";
import { PoolClient } from "pg";
import { SQL } from "../common/sql";
import { orderBy, PageInfo, queryPage } from "../common/pagination";
import { UUID } from "../common/uuid";
import { SortInfo } from "../common/sortInfo";
import {
  Coupon,
  CouponActionName,
  CouponSetsAction,
  CouponSetsSettings,
  CouponSetsSettingsAction,
  CouponSetsStatues,
  CouponStatues,
  PromotionsCouponsSet,
} from "./coupon.modal";

export class couponRepository {
  async getCouponSetsActionsList(
    companyId: string,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<CouponSetsSettingsAction[]> {
    let actionsList: CouponSetsSettingsAction[] =
      await this.promotionsRepository.getActions(
        companyId,
        couponRepository.settingType,
        couponRepository.settingType,
        pageInfo,
        sortInfo,
      );

    return actionsList;
  }

  private promotionsRepository: PromotionsRepository;
  private client: PoolClient;
  constructor(promotionsRepository: PromotionsRepository, client: PoolClient) {
    this.promotionsRepository = promotionsRepository;
    this.client = client;
  }
  static defaultCouponSetsSettings: CouponSetsSettings = {
    enabled: false,
  };
  static settingType = "CouponSetsSettings";
  async getCouponSetsSettings(companyId: string): Promise<CouponSetsSettings> {
    const result: CouponSetsSettings =
      await this.promotionsRepository.getSettings(
        companyId,
        couponRepository.settingType,
        () => couponRepository.defaultCouponSetsSettings,
      );
    result.actionsList = await this.promotionsRepository.getActions(
      companyId,
      couponRepository.settingType,
      couponRepository.settingType,
    );
    return this.updateDefaultValues(result);
  }

  private updateDefaultValues(settings: any) {
    if (settings == couponRepository.defaultCouponSetsSettings) return settings;

    settings.enabled =
      settings.enabled ?? couponRepository.defaultCouponSetsSettings.enabled;
    settings.actionsList =
      settings.actionsList ??
      couponRepository.defaultCouponSetsSettings.actionsList;
    return settings;
  }
  async saveCouponSetsSettings(
    companyId: string,
    couponSetsSettings: CouponSetsSettings,
    action: CouponSetsSettingsAction,
  ) {
    couponSetsSettings = this.updateDefaultValues(couponSetsSettings);

    await this.promotionsRepository.setSettings(
      companyId,
      couponRepository.settingType,
      couponSetsSettings,
    );

    let X = await this.promotionsRepository.AddAction(
      companyId,
      couponRepository.settingType,
      couponRepository.settingType,
      action,
    );
  }
  async generateUniquePrefix(
    companyId: string,
    name?: string,
  ): Promise<string> {
    let words: any[] = [];
    if (name) {
      words = name.split(" ").filter(Boolean);

      if (words.length > 1) {
        name = words.map((w) => w[0]).join("");
      } else if (words.length === 1) {
        name = words[0];
      }
    }
    let base = name
      ? name
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9 ]/g, "")
          .split(" ")
          .filter(Boolean)
          .join("")
          .slice(0, 5)
      : "";

    if (!base || base.length < 3) {
      const random = Math.random().toString(36).substring(2, 7).toUpperCase();

      base = (base + random).slice(0, 5);
    }

    const result = await this.client.query(
      `
    SELECT "couponSet"->>'codePrefix' AS prefix
    FROM "PromotionsCouponSets"
    WHERE "companyId" = $1
      AND "couponSet"->>'codePrefix' LIKE $2
    `,
      [companyId, `${base}%`],
    );

    const used = new Set<string>(result.rows.map((r) => r.prefix));

    if (!used.has(base)) return base;

    let counter = 1;
    while (used.has(`${base}-${counter}`)) {
      counter++;
    }

    return `${base}-${counter}`;
  }

  async getCouponSets(
    companyId: string,
    couponSetName?: string,
    couponSetsStatues?: CouponSetsStatues,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<PromotionsCouponsSet[]> {
    let p = 1;
    const query: SQL = {
      text: `SELECT "id","couponSet"
                FROM "PromotionsCouponSets" 
                WHERE "companyId" = $${p++}
                `,
      values: [companyId],
    };

    if (couponSetsStatues) {
      query.text += `--sql
          AND "couponSet"->>'status' = $${p++}
        `;

      query.values?.push(couponSetsStatues);
    }
    if (couponSetName && couponSetName.trim() !== "") {
      query.text += ` AND "couponSet"->>'name' ILIKE $${p++} `;
      query.values?.push(`%${couponSetName}%`);
    }

    query.text += orderBy(
      {
        status: `"couponSet"->>'status'`,
        used: `"couponSet"->>'used'`,
        issued: `"couponSet"->>'issued'`,
        expired: `"couponSet"->>'expired'`,
        givenDate: `"couponSet"->>'givenDate'`,
        max: `"couponSet"->>'max'`,
      },
      "status",
      sortInfo,
    );

    const pageResults = await queryPage<any>(this.client, query, pageInfo);

    const results = await Promise.all(
      pageResults.map(async (value) => {
        const couponSet = { ...value.couponSet, id: value.id };
        // couponSet.expired = await this.getExpiredCouponsCount(companyId, couponSet.id);
        return couponSet;
      }),
    );

    return results;
  }

  async getCouponSetById(
    companyId: string,
    id: string,
  ): Promise<PromotionsCouponsSet | undefined> {
    const query: SQL = {
      text: `SELECT "couponSet"
                FROM "PromotionsCouponSets" 
                WHERE "companyId" = $1
                AND "id" = $2`,
      values: [companyId, id],
    };
    const rows = (await this.client.query(query.text, query.values)).rows;
    if (rows.length == 0) return undefined;
    const couponSet = rows[0].couponSet;
    couponSet.id = id;
    // couponSet.expired = await this.getExpiredCouponsCount(companyId, id);
    return couponSet;
  }

  async getCouponById(
    companyId: string,
    id: string,
  ): Promise<Coupon | undefined> {
    const query: SQL = {
      text: `SELECT "coupon"
                FROM "PromotionsCoupons" 
                WHERE "companyId" = $1
                AND "id" = $2`,
      values: [companyId, id],
    };
    const rows = (await this.client.query(query.text, query.values)).rows;
    if (rows.length == 0) return undefined;
    const coupon = rows[0].coupon;
    coupon.id = id;
    return coupon;
  }
  async AddCouponSets(
    companyId: string,
    couponSet: PromotionsCouponsSet,
    action: PromotionsAction,
  ): Promise<string> {
    couponSet.id = UUID();
    couponSet.actionsList = undefined;

    const couponSetType = "DISCOUNT_COUPON";

    const query: SQL = {
      text: `INSERT INTO "PromotionsCouponSets" ("id","companyId","couponSetType","couponSet")
                VALUES ($1,$2,$3,$4)`,
      values: [couponSet.id, companyId, couponSetType, couponSet],
    };
    const result = (await this.client.query(query.text, query.values)).rows;

    await this.AddCouponSetsAction(companyId, couponSet, action);

    return couponSet.id;
  }

  async IssueCoupon(
    companyId: string,
    coupon: Coupon,
    action: PromotionsAction,
  ): Promise<string> {
    coupon.id = UUID();
    if (coupon.invoiceId) {
      const orderNumberQuery: SQL = {
        text: `SELECT "invoiceNumber"
             FROM "Invoices"
             WHERE "companyId" = $1
             AND "id" = $2`,
        values: [companyId, coupon.invoiceId],
      };

      const result = await this.client.query(
        orderNumberQuery.text,
        orderNumberQuery.values,
      );
      if (result.rows.length > 0) {
        coupon.orderNumber = result.rows[0].invoiceNumber;
      }
    }
    const query: SQL = {
      text: `INSERT INTO "PromotionsCoupons" ("id","companyId","coupon")
                VALUES ($1,$2,$3)`,
      values: [coupon.id, companyId, coupon],
    };
    const result = (await this.client.query(query.text, query.values)).rows;

    await this.AddCouponsAction(companyId, coupon, action);
    return coupon.id;
  }

  async UpdateCouponSet(
    companyId: string,
    id: string, // replaced coupons
    couponSet: PromotionsCouponsSet,
    action: PromotionsAction,
  ): Promise<string> {
    const couponSetType = "DISCOUNT_COUPONS";

    const query: SQL = {
      text: `UPDATE "PromotionsCouponSets"
                SET "couponSet" = $3,
                "couponSetType"=$4
                WHERE"companyId"=$1
                AND "id"=$2`,
      values: [companyId, id, couponSet, couponSetType],
    };

    const result = (await this.client.query(query.text, query.values)).rows;
    await this.AddCouponSetsAction(companyId, couponSet, action);

    return id;
  }
  async UpdateCoupon(
    companyId: string,
    id: string, // replaced coupons
    coupon: Coupon,
    action: PromotionsAction,
  ): Promise<string> {
    const query: SQL = {
      text: `UPDATE "PromotionsCoupons"
                SET "coupon" = $3
                WHERE"companyId"=$1
                AND "id"=$2`,
      values: [companyId, id, coupon],
    };

    const result = (await this.client.query(query.text, query.values)).rows;
    await this.AddCouponsAction(companyId, coupon, action);

    return id;
  }

  private async AddCouponSetsAction(
    companyId: string,
    couponSet: PromotionsCouponsSet,
    action: PromotionsAction,
  ): Promise<string> {
    return await this.promotionsRepository.AddAction(
      companyId,
      couponSet.id,
      "PromotionsCouponSet",
      action,
    );
  }
  private async AddCouponsAction(
    companyId: string,
    couponSet: Coupon,
    action: PromotionsAction,
  ): Promise<string> {
    return await this.promotionsRepository.AddAction(
      companyId,
      couponSet.id,
      "PromotionsCoupon",
      action,
    );
  }
  async getCoupons(
    companyId: string,
    couponSetId: string,
    couponsStatues?: CouponStatues,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<Coupon[]> {
    let p = 3;

    const query: SQL = {
      text: `
      SELECT "id", "coupon"
      FROM "PromotionsCoupons"
      WHERE "companyId" = $1
        AND coupon->>'couponSetId' = $2
    `,
      values: [companyId, couponSetId],
    };

    if (couponsStatues) {
      query.text += `
      AND coupon->>'status' = $${p++}
    `;
      query.values!.push(couponsStatues);
    }
    query.text += orderBy(
      {
        status: `"coupon"->>'status'`,
        activeDate: `"coupon"->>'activeDate'`,
        expiryDate: `"coupon"->>'expiryDate'`,
        countOfUsage: `"coupon"->>'countOfUsage'`,
        givenDate: `"coupon"->>'givenDate'`,
        uesDate: `"coupon"->>'uesDate'`,
      },
      "status",
      sortInfo,
    );

    const results = (await queryPage<any>(this.client, query, pageInfo)).map(
      (value) => {
        const coupon = value.coupon;
        coupon.id = value.id;
        return coupon;
      },
    );

    return results;
  }

  async getCouponSetsActions(
    companyId: string,
    couponSetId: string,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<PromotionsAction[]> {
    return await this.promotionsRepository.getActions(
      companyId,
      couponSetId,
      "PromotionsCouponSet",
      pageInfo,
      sortInfo,
    );
  }

  async getCouponActions(
    companyId: string,
    couponId: string,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<PromotionsAction[]> {
    return await this.promotionsRepository.getActions(
      companyId,
      couponId,
      "PromotionsCoupon",
      pageInfo,
      sortInfo,
    );
  }

  async getCouponsByNumber(
    companyId: string,
    phoneNumber: string,
    customerCouponsOnly: boolean = false,
    couponsStatues?: CouponStatues,
  ): Promise<Coupon[]> {
    let p = 3;

    let query: SQL;

    if (customerCouponsOnly) {
      query = {
        text: `
        SELECT "id", "coupon"
        FROM "PromotionsCoupons"
        WHERE "companyId" = $1
          AND coupon->>'phoneNumber' = $2
      `,
        values: [companyId, phoneNumber],
      };
    } else {
      query = {
        text: `
        SELECT "id", "coupon"
        FROM "PromotionsCoupons"
        WHERE "companyId" = $1
          AND (coupon->>'phoneNumber' = $2 OR coupon->>'phoneNumber' IS NULL)
      `,
        values: [companyId, phoneNumber],
      };
    }
    if (couponsStatues) {
      query.text += `
        AND coupon->>'status' = $${p++}
      `;
      query.values!.push(couponsStatues);
    }

    query.text += `
  ORDER BY
  CASE WHEN coupon->>'status' = 'ACTIVE' THEN 0 ELSE 1 END,
  coupon->>'status' ASC
`;

    const results = (await queryPage<any>(this.client, query)).map((value) => {
      const coupon = value.coupon;
      coupon.id = value.id;
      return coupon;
    });

    return results;
  }

async isCouponSetNameExists(
  companyId: string,
  name: string,
  lang: string,
  id?: string,
): Promise<boolean> {

  const values: any[] = [companyId, name, lang];

  let text = `
    SELECT 1
    FROM "PromotionsCouponSets"
    WHERE "companyId" = $1
    AND "couponSet"->'name'->> $3 = $2
  `;

  if (id) {
    values.push(id);
    text += ` AND id != $4`;
  }

    text += ` LIMIT 1;`;

  const result = await this.client.query(text, values);
  return result.rows.length > 0;
}

}
