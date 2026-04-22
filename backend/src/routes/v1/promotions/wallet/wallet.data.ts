import { SQL } from "../common/sql";
import { Coupon, CouponStatues } from "../coupon/coupon.modal";
import { CustomerPointsActionName } from "../promotions-point/promotions-point.modal";
import { PoolClient } from "pg";
import { orderBy, PageInfo, queryPage } from "../common/pagination";
export class WalletRepository {
  private client: PoolClient;
  constructor(client: PoolClient) {
    this.client = client;
  }

  async getAllActionList(companyId: string, customerPhoneNumber: string) {
    const query: SQL = {
      text: `select "actionDetails"
              FROM "PromotionsActions" 
              JOIN "PromotionsCustomerPoints" 
                ON "PromotionsCustomerPoints"."companyId" = "PromotionsActions"."companyId"
                AND "PromotionsCustomerPoints"."id" = "PromotionsActions"."objectId"::uuid
              WHERE "PromotionsCustomerPoints"."companyId"=$1
              AND "PromotionsActions"."objectType" = 'CustomerPoint'
              AND "PromotionsActions"."companyId"=$1
              AND "PromotionsCustomerPoints"."phoneNumber"=$2
              AND "actionDetails"->> 'actionName' NOT IN ($3 ,$4)`,
      values: [
        companyId,
        customerPhoneNumber,
        CustomerPointsActionName.ADD,
        CustomerPointsActionName.EXTEND,
      ],
    };
    const result = (await this.client.query(query.text, query.values)).rows.map(
      (row, index) => row.actionDetails,
    );
    // return valid JSON
    return result;
  }
//   async getCouponsByNumber(
//     companyId: string,
//     phoneNumber: string,
//     customerCouponsOnly: boolean = false,
//     couponsStatues?: CouponStatues,
//   ): Promise<Coupon[]> {
//     let p = 3;

//     let query: SQL;

//     if (customerCouponsOnly) {
//       query = {
//         text: `
//         SELECT "id", "coupon"
//         FROM "PromotionsCoupons"
//         WHERE "companyId" = $1
//           AND coupon->>'phoneNumber' = $2
//       `,
//         values: [companyId, phoneNumber],
//       };
//     } else {
//       query = {
//         text: `
//         SELECT "id", "coupon"
//         FROM "PromotionsCoupons"
//         WHERE "companyId" = $1
//           AND (coupon->>'phoneNumber' = $2 OR coupon->>'phoneNumber' IS NULL)
//       `,
//         values: [companyId, phoneNumber],
//       };
//     }
//     if (couponsStatues) {
//       query.text += `
//         AND coupon->>'status' = $${p++}
//       `;
//       query.values!.push(couponsStatues);
//     }

//     query.text += `
//   ORDER BY
//   CASE WHEN coupon->>'status' = 'ACTIVE' THEN 0 ELSE 1 END,
//   coupon->>'status' ASC
// `;

//     const results = (await queryPage<any>(this.client, query)).map((value) => {
//       const coupon = value.coupon;
//       coupon.id = value.id;
//       return coupon;
//     });

//     return results;
//   }

}
