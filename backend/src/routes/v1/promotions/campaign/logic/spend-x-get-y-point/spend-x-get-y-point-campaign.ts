
import { Invoice } from "../../../accounting/accounting.data";
import { CampaignReward, CustomerPointReward, ICampaignLogic } from "../campaign.logic";
import { PointsCampaign, PromotionsCampaign } from "../../campaign.modal";

export const SpendXGetYPointsCampaignType = "SPEND_X_GET_Y_POINTS";
export interface SpendXGetYPointsCampaign extends PointsCampaign {
  spentAmount: number;
  startFrom: number; 
}

export class SpendXGetYPointCampaignLogic implements ICampaignLogic {
  private settings: SpendXGetYPointsCampaign;
  private start: Date;
  private end: Date;
  constructor(settings: SpendXGetYPointsCampaign) {
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
    return date >= this.start && date <= this.end;
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

    const amount = invoice.payments
      .filter((p) => p.methodType != "point")
      .map((p) => p.amount)
      .reduce((sum, value) => sum + value, 0);
      
    if (amount < this.settings.spentAmount) 
      return undefined;

    const givenPoints = Math.floor(
      (amount / this.settings.spentAmount) * this.settings.awardedPoints
    );

    if (givenPoints <= 0) return undefined;

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
