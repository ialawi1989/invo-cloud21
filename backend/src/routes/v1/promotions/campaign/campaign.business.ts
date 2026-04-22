import { PromotionsAction, TranslatedString } from "../promotions.model";
import {
  CampaignsActionName,
  CampaignsStatues,
  Campaign,
  PromotionsCampaign,
  CouponsCampaign,
} from "./campaign.modal";
import { CampaignRepository } from "./campaign.data";
import { PromotionsRepository } from "../promotions.data";
import { PoolClient } from "node_modules/@types/pg";
import { DbClient } from "../common/sql";
import { PageInfo } from "../common/pagination";
import { getLogic } from "./logic/factory.campaign.logic";
import { PromotionsPointsProvider } from "../promotions-point/promotions-point.business";

import { SortInfo } from "../common/sortInfo";
import { BuyXGetYPointsCampaignType } from "./logic/buy-x-get-y-point/buy-x-get-y-point-campaign";
import { SpendXGetYPointsCampaignType } from "./logic/spend-x-get-y-point/spend-x-get-y-point-campaign";
import { CustomerPointsStatues } from "../promotions-point/promotions-point.modal";
import { NotFoundException, ParameterException } from "../common/exceptions";
import { SpendXGetCouponCampaignType } from "./logic/spend-x-get-coupon/spend-x-get-coupon-campaign";
import { CouponProvider } from "../coupon/coupon.business";
import { BuyXGetCouponCampaignType } from "./logic/buy-x-get-coupon/buy-x-get-coupon";
import {
  CouponSetsActionName,
  CouponSetsStatues,
  CouponStatues,
} from "../coupon/coupon.modal";

export class CampaignProvider {
  public static async Create(client?: PoolClient) {
    client = client || (await DbClient());
    return new CampaignProvider(
      new CampaignRepository(new PromotionsRepository(client), client),
      await PromotionsPointsProvider.Create(client),
      await CouponProvider.Create(client),
    );
  }

  campaignRepository: CampaignRepository;
  promotionsPointsProvider: PromotionsPointsProvider;
  couponProvider: CouponProvider;
  constructor(
    campaignRepository: CampaignRepository,
    promotionsPointsProvider: PromotionsPointsProvider,
    couponProvider: CouponProvider,
  ) {
    this.campaignRepository = campaignRepository;
    this.promotionsPointsProvider = promotionsPointsProvider;
    this.couponProvider = couponProvider;
  }

  async getCampaignsLogics(
    companyId: string,
    campaignsStatues?: CampaignsStatues,
  ) {
    let campaigns = await this.getCampaigns(companyId, campaignsStatues);

    const settings =
      await this.promotionsPointsProvider.getPointsSettings(companyId);
    const couponSettings =
      await this.couponProvider.getCouponSetsSettings(companyId);
    campaigns = campaigns.filter((campaign) => {
      switch (campaign.campaignsType) {
        case SpendXGetYPointsCampaignType:
          return settings.enabled;
        case BuyXGetYPointsCampaignType:
          return settings.enabled;
        case SpendXGetCouponCampaignType:
          return couponSettings.enabled;
        case BuyXGetCouponCampaignType:
          return couponSettings.enabled;
        default:
          return true;
      }
    });

    return campaigns.map(getLogic).filter((campaign) => campaign);
  }

  async EndedCampaign(
    companyId: string,
    id: string,
    campaign: PromotionsCampaign,
    employeeId: string,
    reason: TranslatedString,
    note?: string,
  ) {
    if (!campaign)
      throw new NotFoundException(
        "Customer Points cannot be null or undefined",
      );

    let status = CampaignProvider.getStatus(campaign);
    const expiryDate = campaign.endDate;
    switch (status) {
      case CampaignsStatues.STOPPED:
        await this.ActivatedCampaign(
          companyId,
          campaign.id!,
          campaign,
          "SYSTEM",
          {
            an: "reactive the campaign after reactive coupon set ",
            ar: "اعادة تفعيل الحملة بعد اعادة تفعيل مجموعة القسائم",
          },
          "",
        );
      case CampaignsStatues.INACTIVE:
        throw new Error(
          `cannot expire points that are in ${campaign.status} status`,
        );

      case CampaignsStatues.ENDED:
        if (campaign.status == CampaignsStatues.ENDED) {
          return; // already expired
        }
        break;
      default:
        campaign.endDate = new Date();
        break;
    }
    campaign.status = CampaignsStatues.ENDED;

    await this.campaignRepository.UpdateCampaign(companyId, id, campaign, {
      actionName: CampaignsActionName.ENDED,
      actionDate: new Date(),
      user: employeeId,
      reason: reason,
      note: note || "",
      changes: {
        new: {
          status: status,
          expiryDate: campaign.endDate,
        },
        old: {
          status: campaign.status,
          expiryDate: expiryDate,
        },
      },
    });
  }
  async ActivatedCampaign(
    companyId: string,
    id: string,
    campaign: PromotionsCampaign,
    employeeId: string,
    reason: TranslatedString,
    note?: string,
  ) {
    if (!campaign)
      throw new NotFoundException("Campaign cannot be null or undefined");

    let status = CampaignProvider.getStatus(campaign);
    if (campaign.status === CampaignsStatues.ACTIVE) {
      return;
    }

    campaign.status = CampaignsStatues.ACTIVE;
    let oldIsConsumed = campaign.isConsumed ?? true;
    campaign.isConsumed = false;
    let oldIsActive = campaign.isActive ?? false;
    campaign.isActive = true;

    await this.campaignRepository.UpdateCampaign(companyId, id, campaign, {
      actionName: CampaignsActionName.ACTIVATED,
      actionDate: new Date(),
      user: employeeId,
      reason: reason,
      note: note || "",
      changes: {
        new: {
          status: status,
          isConsumed: campaign.isConsumed,
          isActive: campaign.isActive,
        },
        old: {
          status: campaign.status,
          isConsumed: oldIsConsumed,
          isActive: oldIsActive,
        },
      },
    });
  }
  async DeActivatedCampaign(
    companyId: string,
    id: string,
    campaign: PromotionsCampaign,
    employeeId: string,
    reason: TranslatedString,
    note?: string,
  ) {
    if (!campaign)
      throw new NotFoundException("Campaign cannot be null or undefined");

    let status = CampaignProvider.getStatus(campaign);

    switch (status) {
      case CampaignsStatues.INACTIVE:
        if (campaign.status == CampaignsStatues.INACTIVE) {
          return;
        }
        break;
      default:
        break;
    }
    campaign.status = CampaignsStatues.INACTIVE;
    let oldIsActive = campaign.isActive ?? true;
    campaign.isActive = false;
    await this.campaignRepository.UpdateCampaign(companyId, id, campaign, {
      actionName: CampaignsActionName.DEACTIVATED,
      actionDate: new Date(),
      user: employeeId,
      reason: reason,
      note: note || "",
      changes: {
        new: {
          status: campaign.status,
          isActive: campaign.isActive,
        },
        old: {
          status: status,
          isActive: oldIsActive,
        },
      },
    });
  }

  async ConsumedCampaign(
    companyId: string,
    id: string,
    campaign: PromotionsCampaign,
    employeeId: string,
    reason: TranslatedString,
    note?: string,
  ) {
    if (!campaign)
      throw new NotFoundException("Campaign cannot be null or undefined");

    let status = CampaignProvider.getStatus(campaign);

    switch (status) {
      case CampaignsStatues.STOPPED:
        await this.ActivatedCampaign(
          companyId,
          campaign.id!,
          campaign,
          "SYSTEM",
          {
            an: "reactive the campaign after reactive coupon set ",
            ar: "اعادة تفعيل الحملة بعد اعادة تفعيل مجموعة القسائم",
          },
          "",
        );
      case CampaignsStatues.INACTIVE:
        await this.ActivatedCampaign(
          companyId,
          campaign.id!,
          campaign,
          "SYSTEM",
          {
            an: "reactive the campaign after reactive coupon set ",
            ar: "اعادة تفعيل الحملة بعد اعادة تفعيل مجموعة القسائم",
          },
          "",
        );
        break;
      default:
        break;
    }
    campaign.status = CampaignsStatues.ENDED;
    let oldIsConsumed = campaign.isConsumed ?? false;
    campaign.isConsumed = true;
    await this.campaignRepository.UpdateCampaign(companyId, id, campaign, {
      actionName: CampaignsActionName.ENDED,
      actionDate: new Date(),
      user: employeeId,
      reason: reason,
      note: note || "",
      changes: {
        new: {
          status: campaign.status,
          isConsumed: campaign.isConsumed,
        },
        old: {
          status: status,
          isConsumed: oldIsConsumed,
        },
      },
    });
  }
  async getCampaigns(
    companyId: string,
    campaignsStatues?: CampaignsStatues,
    includeActions: boolean = false,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<PromotionsCampaign[]> {
    const result = await this.campaignRepository.getCampaigns(
      companyId,
      campaignsStatues,
      pageInfo,
      sortInfo,
    );

    const updatedCampaigns = await Promise.all(
      result.map(async (campaigns) => {
        const status = CampaignProvider.getStatus(campaigns);

        if (campaigns.status != status) {
          if (status === CampaignsStatues.ENDED) {
            await this.EndedCampaign(
              companyId,
              campaigns.id!,
              campaigns,
              "SYSTEM",
              {
                an: "The activation period for these campaigns has ended",
                ar: "انتهت فترة التفعيل لهذه الحملات",
              },
              "",
            );
          }
          if (status === CampaignsStatues.INACTIVE) {
            await this.DeActivatedCampaign(
              companyId,
              campaigns.id!,
              campaigns,
              "SYSTEM",
              {
                an: "The activation period for these campaigns has ended",
                ar: "انتهت فترة التفعيل لهذه الحملات",
              },
              "",
            );
          } else {
            throw new ParameterException(
              "Campaign",
              `Campaign with ID ${campaigns.id} have a problem in its status`,
            );
          }
        }

        return campaigns;
      }),
    );

    return updatedCampaigns.filter(
      (p) => !campaignsStatues || p.status === campaignsStatues,
    );
  }

  async getCampaignsActions(
    companyId: string,
    campaignsId: string,
    pageInfo?: PageInfo,
    sortInfo?: SortInfo,
  ): Promise<PromotionsAction[]> {
    return await this.campaignRepository.getCampaignsActions(
      companyId,
      campaignsId,
      pageInfo,
      sortInfo,
    );
  }

  async getCampaignsById(
    companyId: string,
    id: string,
  ): Promise<PromotionsCampaign | undefined> {
    const campaigns = await this.campaignRepository.getCampaignById(
      companyId,
      id,
    );
    if (campaigns) {
      campaigns.status = CampaignProvider.getStatus(campaigns);
    }
    return campaigns;
  }

  async AddCampaigns(
    companyId: string,
    campaign: PromotionsCampaign,
    employeeId: string,
  ): Promise<string> {
    campaign.status = CampaignProvider.getStatus(campaign);

    await this.campaignRepository.AddCampaigns(companyId, campaign, {
      actionName: CampaignsActionName.ADD,
      actionDate: new Date(),
      user: employeeId,
      reason: { an: "" },
      note: "",
      changes: {
        new: campaign,
      },
    });
    if ((campaign as CouponsCampaign).couponSetId) {
      let couponSet = await this.couponProvider.getCouponSetById(
        companyId,
        (campaign as CouponsCampaign).couponSetId,
      );
      if (couponSet && couponSet.status === CouponSetsStatues.INACTIVE)
        await this.DeActivatedCampaign(
          companyId,
          campaign.id!,
          campaign,
          "SYSTEM",
          {
            an: "Campaign deactivated because the associated coupon set is inactive.",
            ar: "تم إلغاء تفعيل الحملة لأن مجموعة القسائم المرتبطة بها غير مفعلة.",
          },
          "",
        );
    }

    return "";
  }
  public async getProducts(
    companyId: string,
    productName?: string,
    pageInfo?: PageInfo,
  ) {
    return await this.campaignRepository.getProducts(
      companyId,
      productName,
      pageInfo,
    );
  }
  async updateCampaign(
    companyId: string,
    id: string,
    campaign: PromotionsCampaign,
    employeeId: string,
    reason: TranslatedString,
    note?: string,
  ) {
    //solved TODO: getCampaignsById -> exist(companyId, id)
    let oldCampaign = await this.getCampaignsById(companyId, id);
    if (!oldCampaign)
      throw new Error(
        `Campaign with ID ${id} not found for company ${companyId}`,
      );

    campaign.status = CampaignProvider.getStatus(campaign);

    await this.campaignRepository.UpdateCampaign(companyId, id, campaign, {
      actionName: CampaignsActionName.EDITED,
      actionDate: new Date(),
      user: employeeId,
      reason: reason,
      note: note || "",
      changes: {
        old: oldCampaign,
        new: campaign,
      },
    });
  }

  async stopCampaign(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string,
  ) {
    const campaign = await this.getCampaignsById(companyId, id);
    if (!campaign)
      throw new Error(
        `Campaign with ID ${id} not found for company ${companyId}`,
      );

    if (!(campaign.status === CampaignsStatues.ACTIVE)) {
      await this.ActivatedCampaign(
        companyId,
        campaign.id!,
        campaign,
        "SYSTEM",
        {
          an: "reactive the campaign after reactive coupon set ",
          ar: "اعادة تفعيل الحملة بعد اعادة تفعيل مجموعة القسائم",
        },
        "",
      );
    }

    const oldIsStopped = campaign.isStopped;
    campaign.isStopped = true;
    campaign.status = CampaignProvider.getStatus(campaign);

    await this.campaignRepository.UpdateCampaign(
      companyId,
      campaign.id,
      campaign,

      {
        actionName: CampaignsActionName.STOPPED,
        actionDate: new Date(),
        user: employeeId,
        note: notes,
        reason: reason,
        changes: {
          new: {
            isStopped: campaign.isStopped,
          },
          old: {
            isStopped: oldIsStopped,
          },
        },
      },
    );
  }

  async startCampaign(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    employeeId: string,
  ) {
    const campaign = await this.getCampaignsById(companyId, id);
    if (!campaign)
      throw new Error(
        `Campaign with ID ${id} not found for company ${companyId}`,
      );

    if (
      !(
        campaign.status === CampaignsStatues.INACTIVE ||
        campaign.status === CampaignsStatues.STOPPED
      )
    ) {
      return;
    }

    const oldIsStopped = campaign.isStopped;
    campaign.isStopped = false;
    const oldIsActive = campaign.isActive;
    campaign.isActive = true;

    const now = new Date();
    const oldStartDate = new Date(campaign.startDate);
    if (oldStartDate > now) {
      campaign.startDate = now;
    }
    campaign.status = CampaignProvider.getStatus(campaign);
    await this.campaignRepository.UpdateCampaign(
      companyId,
      campaign.id,
      campaign,
      {
        actionName: CampaignsActionName.STARTED,
        actionDate: new Date(),
        user: employeeId,
        note: notes,
        reason: reason,
        changes: {
          new: {
            startDate: campaign.startDate,
            isStopped: campaign.isStopped,
            isActive: campaign.isActive,
          },
          old: {
            startDate: oldStartDate,
            isStopped: oldIsStopped,
            isActive: oldIsActive
          },
        },
      },
    );
  }

  async ExtendCampaign(
    companyId: string,
    id: string,
    reason: TranslatedString,
    notes: string | undefined,
    newEndDate: Date,
    employeeId: string,
  ) {
    const campaign = await this.getCampaignsById(companyId, id);
    if (!campaign)
      throw new Error(
        `Campaign with ID ${id} not found for company ${companyId}`,
      );

    const oldEndDate = campaign.endDate;
    campaign.endDate = newEndDate;
    campaign.status = CampaignProvider.getStatus(campaign);

    await this.campaignRepository.UpdateCampaign(
      companyId,
      campaign.id,
      campaign,
      {
        actionName: CampaignsActionName.EXTEND,
        actionDate: new Date(),
        user: employeeId,
        note: notes,
        reason: reason,
        changes: {
          new: {
            endDate: newEndDate,
          },
          old: {
            endDate: oldEndDate,
          },
        },
      },
    );
  }
  async isCampaignNameExists(
    companyId: string,
    name: string,
    lang: string,
    id?: string,
  ): Promise<boolean> {
    return await this.campaignRepository.isCampaignNameExists(
      companyId,
      name,
      lang,
      id,
    );
  }
  async isCampaignOverlap(
    companyId: string,
    startDate: Date,
    endDate: Date,
    customerTierIds: string[],
    id?: string,
  ): Promise<boolean> {
    return await this.campaignRepository.isCampaignOverlap(
      companyId,
      startDate,
      endDate,
      customerTierIds,
      id,
    );
  }
  static getStatus(data: Campaign): CampaignsStatues {
    const today = new Date();
    const startDate = new Date(data.startDate!).setHours(0, 0, 0, 0);
    const endDate = new Date(data.endDate!).setHours(0, 0, 0, 0);
    const currentDate = today.setHours(0, 0, 0, 0);

    if (endDate < currentDate || (data.isConsumed && data.isConsumed == true)) {
      return CampaignsStatues.ENDED;
    }
    if (data.isStopped == true) {
      return CampaignsStatues.STOPPED;
    }

    if (data.isActive == false) {
      return CampaignsStatues.INACTIVE;
    }
    if (startDate > currentDate) {
      return CampaignsStatues.INACTIVE;
    }
    {
      return CampaignsStatues.ACTIVE;
    }
  }

  async updateCampaignsByCouponSetId(
    companyId: string,
    couponSetId: string,
    couponSetsActionName: CouponSetsActionName,
    couponSetsStatues?: CouponSetsStatues,
  ): Promise<PromotionsCampaign[]> {
    const campaigns = await this.campaignRepository.getCampaignsByCouponSetId(
      companyId,
      couponSetId,
    );

    const updatedCampaigns = await Promise.all(
      campaigns.map(async (campaign) => {
        const status = CampaignProvider.getStatus(campaign);
        switch (couponSetsActionName) {
          case CouponSetsActionName.CONSUMED:
            if (status !== CampaignsStatues.ENDED) {
              await this.ConsumedCampaign(
                companyId,
                campaign.id!,
                campaign,
                "SYSTEM",
                {
                  an: "The campaign ended because the coupons were consumed",
                  ar: "انتهت الحملة بسبب استهلاك الكوبونات",
                },
                "",
              );
            } 
            return campaign;

          case CouponSetsActionName.DEACTIVATE:
            if (
              status !== CampaignsStatues.INACTIVE &&
              status !== CampaignsStatues.STOPPED
            ) {
              await this.DeActivatedCampaign(
                companyId,
                campaign.id!,
                campaign,
                "SYSTEM",
                {
                  an: "Campaign deactivated because the associated coupon is inactive.",
                  ar: "تم إلغاء تفعيل الحملة لأن مجموعة القسائم المرتبطة بها غير مفعلة.",
                },
                "",
              );
            }
  
            return campaign;

          case CouponSetsActionName.ACTIVATE:
            if (
              status !== CampaignsStatues.ACTIVE &&
              couponSetsStatues !== CouponSetsStatues.CONSUMED &&
              status !== CampaignsStatues.STOPPED
            ) {
              if (campaign.isStopped == false)
                await this.ActivatedCampaign(
                  companyId,
                  campaign.id!,
                  campaign,
                  "SYSTEM",
                  {
                    an: "reactive the campaign after reactive coupon set ",
                    ar: "اعادة تفعيل الحملة بعد اعادة تفعيل مجموعة القسائم",
                  },
                  "",
                );
              else if (campaign.isStopped == true)
                await this.stopCampaign(
                  companyId,
                  campaign.id!,

                  {
                    an: "reverted back to original stopped statue",
                    ar: "تم إرجاع الحملة إلى حالة التوقف الأصلية",
                  },
                  "",
                  "SYSTEM",
                );
            }
     

            return campaign;
          default:
            throw new Error(`Campaigns Action Name not found `);
        }
      }),
    );
    return updatedCampaigns;
  }
}
