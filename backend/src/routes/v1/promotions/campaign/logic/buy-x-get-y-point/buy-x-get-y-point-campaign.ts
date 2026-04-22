import { Invoice } from "../../../accounting/accounting.data";
import { TranslatedString } from "../../../promotions.model";
import { PointsCampaign, PromotionsCampaign } from "../../campaign.modal";
import {
  ICampaignLogic,
  CampaignReward,
  CustomerPointReward,
} from "../campaign.logic";

export interface BuyXGetYPointsCampaign extends PointsCampaign {
  products: CampaignProduct[];
  points: number;
}

export interface CampaignProduct {
  productsInfo?: ProductInfo;
  count: number;
}

export interface ProductInfo {
  id: string;
  name: TranslatedString;
}

export const BuyXGetYPointsCampaignType = "BUY_X_GET_Y_POINTS";

export class BuyXGetYPointCampaignLogic implements ICampaignLogic {
  private settings: BuyXGetYPointsCampaign;
  private start: Date;
  private end: Date;
  constructor(settings: BuyXGetYPointsCampaign) {
    this.settings = settings;

    this.start = new Date(this.settings.startDate);
    this.end = new Date(this.settings.endDate);

    this.start.setHours(0, 0, 0, 0); // 00:00:00.000
    this.end.setHours(23, 59, 59, 999); // 23:59:59.999
  }

  getSettings(): PromotionsCampaign {
    return this.settings;
  }

  private inWindow(date: Date): boolean {
    return true;
  }

  private tierEligible(customerTierId: string): boolean {
    const tiers = this.settings.customerTierIds;
    if (!tiers || tiers.length === 0) return true; // no restriction
    if (!customerTierId) return false;
    return tiers.includes(customerTierId);
  }

  private async alreadyProcessed(_invoice: Invoice): Promise<boolean> {
    return false;
  }

  // --- Contract methods -----------------------------------------------------

  async accepts(data: any): Promise<boolean> {
    const invoice = data as Invoice;
    if (!invoice) return false;

    if (invoice.status !== "Paid") return false;

    if (!invoice.customerPhone || invoice.customerPhone == "") return false;

    if (!this.inWindow(invoice.date)) return false;

    if (!this.tierEligible(invoice.customerTierId)) return false;

    if (invoice.payments.filter((p) => p.methodType == "point").length > 0) {
      return false;
    }

    if (await this.alreadyProcessed(invoice)) return false;

    return true;
  }

  async process(data: any): Promise<CampaignReward | undefined> {
    if ((await this.accepts(data)) == false) return undefined;
    const invoice = data as Invoice;

    if (!invoice.customerPhone || invoice.customerPhone == "") return undefined;

    const campaignProducts = this.settings.products;
    const invoiceLines = invoice.lines || [];
    let givenPoints = 0;
    let purchasedQty = 0;
    for (const cp of campaignProducts) {
      if (!cp.productsInfo) continue;

      //TODO: consider lines with the same product id ..
      //TODO: consider giving for every X products Y points
      //TODO: consider if it is one other other products (AND / OR)

      purchasedQty = invoiceLines
        .filter((l) => l.productId === cp.productsInfo?.id && l.qty >= cp.count)
        .reduce((sum, line) => sum + line.qty, 0);

      if (purchasedQty > 0) 
        givenPoints = this.settings.awardedPoints;
    }

    //const givenPoints = this.settings.points;

    if (purchasedQty == 0) return undefined;

    //TODO low: consider making a function that takes the invoice and the given points and reason and nots to generate points reward
    const result: CustomerPointReward = {
      campaignId: this.settings.id,
      companyId: invoice.companyId,
      phoneNumber: invoice.customerPhone,
      reason: this.settings.campaignsName,
      note: undefined,
      invoiceId: invoice.id,
      givenPoints: givenPoints,
      date: new Date(),
    };

    return {
      type: "CustomerPointReward",
      data: result,
    };
  }
}
