import { PromotionsCampaign } from "../campaign.modal";
import { ICampaignLogic } from "./campaign.logic";
import { Dictionary } from "../../common/dictionary";
import { NotFoundException } from "../../common/exceptions";

const factory: Dictionary<
  string,
  (promotionsCampaign: PromotionsCampaign) => ICampaignLogic
> = new Dictionary();

export function registerCampaignLogic(
  campaignsType: string,
  creator: (promotionsCampaign: PromotionsCampaign) => ICampaignLogic
) {
  factory.addOrUpdate(campaignsType, creator);
}

export function getLogic(campaign: PromotionsCampaign): ICampaignLogic {
  const result = factory.tryGet(campaign.campaignsType);
  if (result) return result(campaign);
  throw new NotFoundException(
    "Campaign Logic not found for " + campaign.campaignsType
  );
}
