import { TranslatedString } from "../../promotions.model";
import { PromotionsCampaign } from "../campaign.modal";

export interface ICampaignLogic {
  getSettings(): PromotionsCampaign;
  accepts(data: any): Promise<boolean>;
  process(data: any): Promise<CampaignReward | undefined>;
}

export interface CampaignReward {
  type: string;
  data: any;
}
export interface CustomerPointReward {
  campaignId: string;
  companyId: string;
  phoneNumber: string;
  reason: TranslatedString;
  note?: string;
  invoiceId?: string;
  givenPoints: number;
  date: Date;
}
export interface CustomerCouponReward {
  campaignId: string;
  companyId: string;
  phoneNumber: string;
  reason: TranslatedString;
  note?: string;
  invoiceId: string;
  couponSetId: string;
  date: Date;
}
