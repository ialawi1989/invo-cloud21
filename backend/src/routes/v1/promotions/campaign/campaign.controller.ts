import { Request, Response, NextFunction, Router } from "express";
import { CampaignProvider } from "./campaign.business";
import { CampaignsActionName, CampaignsStatues } from "./campaign.modal";
import { TranslatedString } from "../promotions.model";
import { ProcessEvent, ProcessRequest } from "../common/web";
import { onEvent } from "@src/utilts/system-events";
import { AccountingProvider } from "../accounting/accounting.business";
import { PromotionsPointsProvider } from "../promotions-point/promotions-point.business";
import { CustomerTiersProvider } from "../customer-tiers/customer-tiers.business";
import { promotionsJobsQueue } from "../promotions.jobs";
import { CouponProvider } from "../coupon/coupon.business";
import { WalletProvider } from "../wallet/wallet.business";
import { CouponStatues } from "../coupon/coupon.modal";

//import { CampaignRepository } from "./promotions-points.data";

export class CampaignController {
  public static registerRouts(router: Router) {
    router.get(
      "/promotions-campaigns/campaign",
      ProcessRequest(CampaignProvider.Create, CampaignController.getCampaigns),
    );
    //isCampaignOverlap
    router.get(
      "/promotions-campaigns/isCampaignOverlap",
      ProcessRequest(
        CampaignProvider.Create,
        CampaignController.isCampaignOverlap,
      ),
    );
    router.get(
      "/promotions-campaigns/isCampaignNameExists",
      ProcessRequest(
        CampaignProvider.Create,
        CampaignController.isCampaignNameExists,
      ),
    );
    router.get(
      "/promotions-campaigns/products",
      ProcessRequest(CampaignProvider.Create, CampaignController.getProducts),
    );

    router.get(
      "/promotions-campaigns/campaign/:id",
      ProcessRequest(
        CampaignProvider.Create,
        CampaignController.getCampaignById,
      ),
    );

    router.get(
      "/promotions-campaigns/campaign-action/:id",
      ProcessRequest(
        CampaignProvider.Create,
        CampaignController.getCampaignsActions,
      ),
    );

    router.post(
      //ADD
      "/promotions-campaigns/campaign",
      ProcessRequest(CampaignProvider.Create, CampaignController.AddCampaign),
    );

    router.put(
      //UPDATE
      "/promotions-campaigns/campaign/:id",
      ProcessRequest(
        CampaignProvider.Create,
        CampaignController.updateCampaign,
      ),
    );

    router.patch(
      //UPDATE-Actions
      "/promotions-campaigns/campaign/:id",
      ProcessRequest(CampaignProvider.Create, CampaignController.patchCampaign),
    );

    onEvent(
      "Invoice-Paid",
      ProcessEvent(async (client) => {
        return {
          campaignProvider: await CampaignProvider.Create(client),
          accountingProvider: await AccountingProvider.Create(client),
          promotionsPointsProvider:
            await PromotionsPointsProvider.Create(client),
          couponProvider: await CouponProvider.Create(client),
          customerTiersProvider: await CustomerTiersProvider.Create(client),
        };
      }, CampaignController.processPaidInvoice),
    );
  }
  public static async isCampaignNameExists(
    req: Request,
    res: Response,
    next: NextFunction,
    campaignProvider: CampaignProvider,
  ) {
    const company = res.locals.company;
    const name = req.query.name as string;
    const lang = req.query.lang as string;
    const id = req.query.id as string | undefined;

    const result = await campaignProvider.isCampaignNameExists(
      company.id,
      name,
      lang,
      id,
    );

    return result;
  }

  public static async isCampaignOverlap(
    req: Request,
    res: Response,
    next: NextFunction,
    campaignProvider: CampaignProvider,
  ) {
    const company = res.locals.company;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const customerTierIdsRaw = req.query.customerTierIds as string;

    const customerTierIds = customerTierIdsRaw
      ? customerTierIdsRaw.split(",")
      : [];

    const id = req.query.id as string | undefined;

    const result = await campaignProvider.isCampaignOverlap(
      company.id,
      startDate!,
      endDate!,
      customerTierIds,
      id,
    );

    return result;
  }
  public static async getCampaigns(
    req: Request,
    res: Response,
    next: NextFunction,
    campaignProvider: CampaignProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const pageInfo = res.locals.pageInfo;
    const sortInfo = res.locals.sortInfo;
    const campaignsStatue = req.query["campaignsStatue"] as CampaignsStatues;

    const result = await campaignProvider.getCampaigns(
      company.id,
      campaignsStatue,
      false,
      pageInfo,
      sortInfo,
    );

    return result;
  }
  public static async getProducts(
    req: Request,
    res: Response,
    next: NextFunction,
    campaignProvider: CampaignProvider,
  ) {
    const company = res.locals.company;

    const productName = req.query["productName"]?.toString() || "";

    let pageInfo = res.locals.pageInfo;

    let result = await campaignProvider.getProducts(
      company.id,
      productName,
      pageInfo,
    );

    return result;
  }
  public static async getCampaignById(
    req: Request,
    res: Response,
    next: NextFunction,
    campaignProvider: CampaignProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const id = req.params.id;

    const result = await campaignProvider.getCampaignsById(company.id, id);
    return result;
  }
  public static async getCampaignsActions(
    req: Request,
    res: Response,
    next: NextFunction,
    campaignProvider: CampaignProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const id = req.params.id;
    const pageInfo = res.locals.pageInfo;
    const sortInfo = res.locals.sortInfo;

    const result = await campaignProvider.getCampaignsActions(
      company.id,
      id,
      pageInfo,
      sortInfo,
    );
    return result;
  }
  public static async AddCampaign(
    req: Request,
    res: Response,
    next: NextFunction,
    campaignProvider: CampaignProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const Campaign = req.body;

    const result = await campaignProvider.AddCampaigns(
      company.id,
      Campaign,
      employeeId,
    );

    return result;
  }

  public static async updateCampaign(
    req: Request,
    res: Response,
    next: NextFunction,
    campaignProvider: CampaignProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const { reason, note, ...campaignData } = req.body; // نفصل reason و note
    const id = req.params.id;

    const result = await campaignProvider.updateCampaign(
      company.id,
      id,
      campaignData,
      employeeId,
      reason,
      note,
    );

    return result;
  }

  public static async patchCampaign(
    req: Request,
    res: Response,
    next: NextFunction,
    campaignProvider: CampaignProvider,
  ) {
    const company = res.locals.company;
    const employeeId = res.locals.user;
    const id = req.params.id;
    const PointCampaignUpdate: PointCampaignUpdate = req.body;

    let result: any = null;
    switch (PointCampaignUpdate.actionName) {
      case CampaignsActionName.STOPPED:
        result = await campaignProvider.stopCampaign(
          company.id,
          id,
          PointCampaignUpdate.reason,
          PointCampaignUpdate.note,
          employeeId,
        );
        break;

      case CampaignsActionName.STARTED:
        result = await campaignProvider.startCampaign(
          company.id,
          id,
          PointCampaignUpdate.reason,
          PointCampaignUpdate.note,
          employeeId,
        );
        break;

      case CampaignsActionName.EXTEND:
        if (PointCampaignUpdate.endDate == undefined) {
          return;
        }
        result = await campaignProvider.ExtendCampaign(
          company.id,
          id,
          PointCampaignUpdate.reason,
          PointCampaignUpdate.note,
          PointCampaignUpdate.endDate,
          employeeId,
        );
        break;

      default:
        throw new Error(`Campaigns Action Name not found `);
    }
    return result;
  }

  static async processPaidInvoice(
    invoice: any,
    providers: {
      campaignProvider: CampaignProvider;
      accountingProvider: AccountingProvider;
      promotionsPointsProvider: PromotionsPointsProvider;
      couponProvider: CouponProvider;
      customerTiersProvider: CustomerTiersProvider;
    },
  ) {
    if (!invoice) return;
    if (!invoice.invoiceId) return;

    const invoiceData = (
      await providers.accountingProvider.getInvoicesByIds(
        [invoice.invoiceId],
        "Paid",
        true,
      )
    )[0];

    if (!invoiceData) return;

    if (!invoiceData.customerPhone) return;

    const customerPointsSummary =
      await providers.promotionsPointsProvider.getCustomerPointsSummary(
        invoice.companyId,
        invoiceData.customerPhone,
      );
    const couponSummary = await providers.couponProvider.getCouponsByNumber(
      invoice.companyId,
      invoiceData.customerPhone,
      false,
      CouponStatues.ACTIVE,
    );

    invoiceData.customerTierId =
      customerPointsSummary?.customerTierId ||
      (
        await providers.customerTiersProvider.getCustomerTierSettings(
          invoice.companyId,
        )
      ).customerTiers[0].id;

    const activeCampaigns = await providers.campaignProvider.getCampaignsLogics(
      invoice.companyId,
      CampaignsStatues.ACTIVE,
    );
    if (activeCampaigns.length == 0) return; //No active campaigns;
    for (const activeCampaign of activeCampaigns) {
      const reward = await activeCampaign.process(invoiceData);
      if (reward) {
        promotionsJobsQueue.get().createJob({
          type: reward.type,
          data: reward.data,
        });
      }
    }
  }
}

export interface PointCampaignUpdate {
  actionName: CampaignsActionName;

  reason: TranslatedString;
  note?: string;

  startDate?: Date;
  endDate?: Date;
}
