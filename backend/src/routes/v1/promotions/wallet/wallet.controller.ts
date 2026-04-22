import { Request, Response, NextFunction, Router } from "express";
import { WalletProvider } from "./wallet.business";
import { CustomerTiersController } from "../customer-tiers/customer-tiers.controller";
import { PromotionsPointsController } from "../promotions-point/promotions-point.controller";
import { ShopperRepo } from "@src/repo/ecommerce/shopper.repo";
import { TranslatedString } from "../promotions.model";
import { PromotionsPointsProvider } from "../promotions-point/promotions-point.business";
import { ProcessRequest } from "../common/web";
import { CustomerTiersProvider } from "../customer-tiers/customer-tiers.business";
import { PointsAction, WalletSettings } from "./wallet.modal";
import { PoolClient } from "pg";
import { CampaignController } from "../campaign/campaign.controller";
import { CampaignProvider } from "../campaign/campaign.business";
import { CouponProvider } from "../coupon/coupon.business";
import { CouponController } from "../coupon/coupon.controller";
import { CouponSetsStatues, CouponStatues } from "../coupon/coupon.modal";

export class WalletController {
  public static registerRouts(router: Router) {
    router.get(
      "/promotions-coupons/settings",
      ProcessRequest(
        CouponProvider.Create,
        CouponController.getCouponSetsSettings,
      ),
    );
    router.get(
      "/wallet",
      ProcessRequest(WalletProvider.Create, WalletController.getCustomerWallet),
    );
    router.get(
      "/promotions-coupons/coupons",
      ProcessRequest(
        CouponProvider.Create,
        CouponController.getCouponsByNumber,
      ),
    );
    // router.get(
    //   "/wallet/coupons",
    //   ProcessRequest(
    //     WalletProvider.Create,
    //     WalletController.getCouponsByNumber,
    //   ),
    // );
    router.get(
      "/promotions-coupons/couponSet/:id",
      ProcessRequest(CouponProvider.Create, CouponController.getCouponSetById),
    );

    router.get(
      "/campaign",
      ProcessRequest(CampaignProvider.Create, CampaignController.getCampaigns),
    );

    router.get(
      "/customer-tiers",
      ProcessRequest(
        CustomerTiersProvider.Create,
        CustomerTiersController.getCustomerTiers,
      ),
    );

    router.get(
      "/promotional-points/transactions",
      ProcessRequest(WalletProvider.Create, WalletController.getAllActionList),
    );

    router.get(
      "/customer-tiers",
      ProcessRequest(
        CustomerTiersProvider.Create,
        CustomerTiersController.getCustomerTiers,
      ),
    );

    router.get(
      "/settings",
      ProcessRequest(async (client) => {
        return {
          promotionsPointsProvider:
            await PromotionsPointsProvider.Create(client),
          customerTiersProvider: await CustomerTiersProvider.Create(client), //other provider ????
          couponProvider: await CouponProvider.Create(client),
        };
      }, WalletController.getSettings),
    );
    router.put(
      "/accounting/redeemCoupon",
      ProcessRequest(CouponProvider.Create, CouponController.redeemCoupon),
    );
  }

  public static async getSettings(
    req: Request,
    res: Response,
    next: NextFunction,
    providers: {
      promotionsPointsProvider: PromotionsPointsProvider;
      customerTiersProvider: CustomerTiersProvider;
      couponProvider: CouponProvider;
    },
  ) {
    const company = res.locals.company;
    const pointsSettings =
      await providers.promotionsPointsProvider.getPointsSettings(company.id);
    const tiersSettings =
      await providers.customerTiersProvider.getCustomerTierSettings(company.id);
    const couponSettings = await providers.couponProvider.getCouponSetsSettings(
      company.id,
    );
    if (
      pointsSettings.enabled == false &&
      tiersSettings.enabled == false &&
      couponSettings.enabled == false
    ) {
      return {
        enabled: false,
      };
    }

    const result: WalletSettings = {
      enabled: true,
    };
    if (pointsSettings.enabled == false) {
      result.pointsSettings = {
        enabled: false,
      };
    } else {
      result.pointsSettings = pointsSettings;
    }
    if (tiersSettings.enabled == false) {
      result.customerTiersSettings = {
        enabled: false,
      };
    } else {
      result.customerTiersSettings = tiersSettings;
    }

    if (couponSettings.enabled == false) {
      //add to wallet settings
      result.couponSettings = {
        enabled: false,
      };
    } else {
      result.couponSettings = couponSettings;
    }

    return result;
  }

  public static async getCustomerWallet(
    req: Request,
    res: Response,
    next: NextFunction,
    walletProvider: WalletProvider,
  ) {
    const company = res.locals.company;
    const sessionId = res.locals.userSessionId;
    const loggedInUser = await ShopperRepo.getShopper(sessionId, company);
    if(!sessionId )return;
    if(!loggedInUser)return;
    const result = await walletProvider.getCustomerWallet(
      company.id,
      loggedInUser.phone,
    );
    return result;
  }

  public static async getAllActionList(
    req: Request,
    res: Response,
    next: NextFunction,
    walletProvider: WalletProvider,
  ) {
    const company = res.locals.company;
    const sessionId = res.locals.userSessionId;

    const loggedInUser = await ShopperRepo.getShopper(sessionId, company);

    const actions = await walletProvider.getAllActionList(
      company.id,
      loggedInUser.phone,
    );

    const result: PointsAction[] = actions.map((action) => ({
      actionName: action.actionName,
      actionDate: action.actionDate,
      reason: action.reason,
      grandActivePoints: action.extraDetails?.grandActivePoints ?? 0,
      spentPoints: action.extraDetails?.spentPoints ?? 0,
      invoiceId: action.extraDetails?.spentOrderId ?? "",
    }));

    const mergedMap = new Map<string, PointsAction>();

    for (const action of result) {
      const date = new Date(action.actionDate);
      const normalizedDate =
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getDate()).padStart(2, "0") +
        " " +
        String(date.getHours()).padStart(2, "0") +
        ":" +
        String(date.getMinutes()).padStart(2, "0");

      const normalizedInvoice = action.invoiceId?.trim() || "NO_INVOICE";

      const key = `${normalizedInvoice}-${normalizedDate}`;

      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;

        existing.spentPoints += action.spentPoints;

        if (existing.actionDate < action.actionDate) {
          existing.grandActivePoints = action.grandActivePoints;
        }
      } else {
        mergedMap.set(key, action);
      }
    }

    // Convert map to array
    const mergedResult = Array.from(mergedMap.values());

    return mergedResult;
  }

  // public static async getCouponsByNumber(
  //   req: Request,
  //   res: Response,
  //   next: NextFunction,
  //   walletProvider: WalletProvider,
  // ) {
  //   const company = res.locals.company;
  //   const sessionId = res.locals.userSessionId;
  //   const loggedInUser = await ShopperRepo.getShopper(sessionId, company);
  //   const activeOnly: boolean =
  //     req.query.activeOnly !== undefined && req.query.activeOnly !== "false";
  //   const customerCouponsOnly: boolean =
  //     req.query.customerCouponsOnly !== undefined &&
  //     req.query.customerCouponsOnly !== "false";
  //   const result = await walletProvider.getCouponsByNumber(
  //     company.id,
  //     loggedInUser.phone,
  //     customerCouponsOnly,
  //   );
  //   if (activeOnly === true) {
  //     const filteredResult = await walletProvider.getCouponsByNumber(
  //       company.id,
  //       loggedInUser.phone,
  //       customerCouponsOnly,
  //       CouponStatues.ACTIVE,
  //     );

  //     return filteredResult;
  //   }

  //   return result;
  // }
}
