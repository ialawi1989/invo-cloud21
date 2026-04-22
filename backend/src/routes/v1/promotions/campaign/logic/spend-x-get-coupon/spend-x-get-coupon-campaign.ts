
import { Invoice } from "../../../accounting/accounting.data";
import { CampaignReward, CustomerCouponReward, ICampaignLogic } from "../campaign.logic";
import { CouponsCampaign, PointsCampaign, PromotionsCampaign } from "../../campaign.modal";

export const SpendXGetCouponCampaignType = "SPEND_X_GET_COUPON";
export interface SpendXGetCouponCampaign extends CouponsCampaign {
  spentAmount: number;
  startFrom: number;
}
export class SpendXGetCouponCampaignLogic implements ICampaignLogic {
  private settings: SpendXGetCouponCampaign;
  private start: Date;
  private end: Date;
  constructor(settings: SpendXGetCouponCampaign) {
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


    if (await this.alreadyProcessed(invoice)) return false;

    return true;
  }

  async process(data: any): Promise<CampaignReward | undefined> {
    if ((await this.accepts(data)) == false) return undefined;
    const invoice = data as Invoice;

    if (!invoice.customerPhone || invoice.customerPhone == "") return undefined;

    const amount = invoice.payments
      .map((p) => p.amount)
      .reduce((sum, value) => sum + value, 0);

    if (amount < this.settings.spentAmount) 
      return undefined;

    const result: CustomerCouponReward = {
      campaignId: this.settings.id,
      companyId: invoice.companyId,
      phoneNumber: invoice.customerPhone,
      reason: this.settings.campaignsName,
      note: undefined,
      invoiceId: invoice.id,
      couponSetId: this.settings.couponSetId,
      date: new Date(),
    };

    return {
      type: "CustomerCouponReward",
      data: result,
    };
  }
}
