import { DateTimeSpan, PromotionsAction, TranslatedString } from "../promotions.model";
import { BuyXGetYPointsCampaign } from "./logic/buy-x-get-y-point/buy-x-get-y-point-campaign";
import { SpendXGetCouponCampaign } from "./logic/spend-x-get-coupon/spend-x-get-coupon-campaign";
import { SpendXGetYPointsCampaign } from "./logic/spend-x-get-y-point/spend-x-get-y-point-campaign";


export type PromotionsCampaign = Campaign | PointsCampaign | SpendXGetYPointsCampaign | BuyXGetYPointsCampaign|SpendXGetCouponCampaign;

export interface Campaign {
  id: string;
  campaignsName: TranslatedString;
  campaignsType: string ;
  expiryPeriod: DateTimeSpan;
  activePeriod: DateTimeSpan ;
  status: CampaignsStatues ;
  customerTierIds: string[] ;
  startDate: Date;
  endDate: Date ;
  createdDate: Date;
  isStopped: boolean;
  actionsList?: PromotionsAction[];  
  isConsumed?: boolean;
  isActive?:boolean
}

export interface PointsCampaign extends Campaign {
  awardedPoints: number;
}
export interface CouponsCampaign extends Campaign {
  couponSetId: string;
}
export interface ProductInfo{
   id: string;
   name: TranslatedString;
}

export enum CampaignsStatues {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ENDED = "ENDED",
  STOPPED = "STOPPED",
}

export enum CampaignsActionName {
  CLONED = "CLONED",
  EDITED = "EDITED",
  STOPPED = "STOPPED",
  STARTED = "STARTED",
  EXTEND = "EXTEND",
  ADD = "ADD",
  ENDED = "ENDED",
  ACTIVATED = "ACTIVATED",
  DEACTIVATED = "DEACTIVATED",

}