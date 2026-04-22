import { Lazy } from "./common/lazy";
import { UsingDbClient } from "./common/sql";
import { JobsQueue, NewQueueWorker } from "./common/background-jobs";
import { PromotionsPointsProvider } from "./promotions-point/promotions-point.business";
import {
  CustomerPointReward,
  CustomerCouponReward,
} from "./campaign/logic/campaign.logic";
import { CustomerPointsStatues } from "./promotions-point/promotions-point.modal";
import { fromDate } from "./promotions.model";
import { CouponProvider } from "./coupon/coupon.business";
import { CouponStatues } from "./coupon/coupon.modal";
import { AccountingProvider } from "./accounting/accounting.business";

export const promotionsJobsQueue = new Lazy<JobsQueue>(() => {
  return new JobsQueue("promotions", "events", async (jobData) => {
    switch (jobData.type) {
      case "CustomerPointReward": {
        const customerPointReward = jobData.data as CustomerPointReward;
        if (!customerPointReward) return undefined;
        return `CustomerPointReward_${customerPointReward.companyId}_${customerPointReward.campaignId}_${customerPointReward.invoiceId}`;
      }
      case "CustomerCouponReward": {
        const CustomerCouponReward = jobData.data as CustomerCouponReward;
        if (!CustomerCouponReward) return undefined;

        return `CustomerCouponReward_${CustomerCouponReward.companyId}_${CustomerCouponReward.campaignId}_${CustomerCouponReward.invoiceId}`;
      }
      default:
        return undefined;
    }
  });
});

export const promotionsJobsQueueWorker = async () =>
  NewQueueWorker("promotions", async (job) => {
    switch (job.type) {
      case "CustomerPointReward": {
        await UsingDbClient(async (client) => {
          const promotionsPointsProvider =
            await PromotionsPointsProvider.Create(client);
          var rewardData: CustomerPointReward = job.data;
          var settings = await promotionsPointsProvider.getPointsSettings(
            rewardData.companyId
          );
          var now = new Date();
          await promotionsPointsProvider.GiveCustomerPoints(
            rewardData.companyId,
            {
              id: "",
              activeDate: fromDate(now, settings.activePeriod),
              givenPoints: rewardData.givenPoints,
              activePoints: 0,
              expiryDate: fromDate(now, settings.expiryPeriod),
              givenDate: now,
              isCanceled: false,
              phoneNumber: rewardData.phoneNumber,
              invoiceId: rewardData.invoiceId,
              note: rewardData.campaignId,
              status: CustomerPointsStatues.INACTIVE,
              reason: { en: "Campaign Reward" },
            },
            "SYSTEM"
          );
        });
        break;
      }

      case "CustomerCouponReward": {
        await UsingDbClient(async (client) => {
          const couponProvider = await CouponProvider.Create(client);
          const accountingProvider = await AccountingProvider.Create(client);
          var rewardData: CustomerCouponReward = job.data;
           var invoice = await accountingProvider.getInvoice( rewardData.invoiceId);
          var couponSet = await couponProvider.getCouponSetById(
            rewardData.companyId,
            rewardData.couponSetId,
            invoice.branchId,
            invoice.serviceId
          );
          var now = new Date();
          if (!invoice.couponId && couponSet) {
            await couponProvider.IssueCoupon(
              rewardData.companyId,
              {
                id: "",
                code: "",
                couponSetId: rewardData.couponSetId,
                activeDate: fromDate(now, couponSet.activePeriod),
                expiryDate: fromDate(now, couponSet.expiryPeriod),
                status: CouponStatues.INACTIVE,
                giveDate: now,
                reason: { en: "Campaign Reward" },
                countOfUsage: 0,
                isUsed: false,
                isCancel: false,
                phoneNumber: rewardData.phoneNumber,
                invoiceId: rewardData.invoiceId
                
              },
              1,
              "SYSTEM",
              { en: "Campaign Reward" },
              ""
            );
          }
        });
        break;
      }
      default:
        break;
    }
  });
