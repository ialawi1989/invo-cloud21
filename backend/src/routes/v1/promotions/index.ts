require("module-alias/register");
import express from "express";
import { CustomerTiersController } from "./customer-tiers/customer-tiers.controller";
import { PromotionsPointsController } from "./promotions-point/promotions-point.controller";
import { CampaignController } from "./campaign/campaign.controller";
import { WalletController } from "./wallet/wallet.controller";
import { AccountingController } from "./accounting/accounting.controller";
import { promotionsJobsQueueWorker } from "./promotions.jobs";
import { registerCampaignLogic } from "./campaign/logic/factory.campaign.logic";

import { BuyXGetYPointCampaignLogic, BuyXGetYPointsCampaign, BuyXGetYPointsCampaignType } from "./campaign/logic/buy-x-get-y-point/buy-x-get-y-point-campaign";
import { SpendXGetYPointCampaignLogic, SpendXGetYPointsCampaign, SpendXGetYPointsCampaignType } from "./campaign/logic/spend-x-get-y-point/spend-x-get-y-point-campaign";
import { CouponController } from "./coupon/coupon.controller";
import { SpendXGetCouponCampaignType, SpendXGetCouponCampaignLogic, SpendXGetCouponCampaign } from "./campaign/logic/spend-x-get-coupon/spend-x-get-coupon-campaign";
import { BuyXGetCouponCampaignType, BuyXGetCouponCampaignLogic, BuyXGetCouponCampaign } from "./campaign/logic/buy-x-get-coupon/buy-x-get-coupon";

export const router = express.Router();
export default router;

export const frontendRouter = express.Router();
CustomerTiersController.registerRouts(frontendRouter);
PromotionsPointsController.registerRouts(frontendRouter);
CampaignController.registerRouts(frontendRouter);
AccountingController.registerRouts(frontendRouter);
CouponController.registerRouts(frontendRouter);

export const websiteRouter = express.Router();
WalletController.registerRouts(websiteRouter);

console.log("Starting Promotions Queue Works");
const workers = [promotionsJobsQueueWorker()];

registerCampaignLogic(
  SpendXGetYPointsCampaignType,
  (campaign) =>
    new SpendXGetYPointCampaignLogic(campaign as SpendXGetYPointsCampaign)
);
registerCampaignLogic(
  BuyXGetYPointsCampaignType,
  (campaign) =>
    new BuyXGetYPointCampaignLogic(campaign as BuyXGetYPointsCampaign)
);
registerCampaignLogic(
  SpendXGetCouponCampaignType,
  (campaign) =>
    new SpendXGetCouponCampaignLogic(campaign as SpendXGetCouponCampaign)
);
registerCampaignLogic(
  BuyXGetCouponCampaignType,
  (campaign) =>
    new BuyXGetCouponCampaignLogic(campaign as BuyXGetCouponCampaign)
);


console.log("Started Promotions Queue Works");
