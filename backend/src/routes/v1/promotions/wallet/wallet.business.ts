import { PoolClient } from "node_modules/@types/pg";
import { CustomerTiersRepository } from "../customer-tiers/customer-tiers.data";
import { PromotionsPointsRepository } from "../promotions-point/promotions-point.data";
import { CustomerPointAction } from "../promotions-point/promotions-point.modal";
import { PromotionsRepository } from "../promotions.data";
import { DateTimeSpan, fromDate } from "../promotions.model";
import { WalletRepository } from "./wallet.data";
import { CustomerWallet } from "./wallet.modal";
import { DbClient } from "../common/sql";
import { CouponProvider } from "../coupon/coupon.business";
import { CouponStatues, Coupon } from "../coupon/coupon.modal";
import { couponRepository } from "../coupon/coupon.data";

export class WalletProvider {
  public static async Create(client?: PoolClient) {
    client = client || (await DbClient());
    const promotionsRepository = new PromotionsRepository(client);
    return new WalletProvider(
      new WalletRepository(client),
      promotionsRepository,
      new PromotionsPointsRepository(promotionsRepository, client),
      new CustomerTiersRepository(promotionsRepository, client),
      new couponRepository(promotionsRepository, client),
      await CouponProvider.Create(client),
    );
  }

  promotionsRepository: PromotionsRepository;
  promotionsPointsRepository: PromotionsPointsRepository;
  customerTiersRepository: CustomerTiersRepository;
  walletRepository: WalletRepository;
  couponRepository: couponRepository;
  couponProvider: CouponProvider;
  constructor(
    WalletRepository: WalletRepository,
    PromotionsRepository: PromotionsRepository,
    PromotionsPointsRepository: PromotionsPointsRepository,
    CustomerTiersRepository: CustomerTiersRepository,
    CouponRepository: couponRepository,
    couponProvider: CouponProvider,
  ) {
    this.walletRepository = WalletRepository;
    this.promotionsRepository = PromotionsRepository;
    this.promotionsPointsRepository = PromotionsPointsRepository;
    this.customerTiersRepository = CustomerTiersRepository;
    this.couponRepository = CouponRepository;
    this.couponProvider = couponProvider;
  }

  async getCustomerWallet(
    companyId: string,
    customerPhoneNumber: string,
  ): Promise<CustomerWallet> {
  
    const customerInfo =
      (await this.promotionsRepository.getPromotionsCustomers(
        companyId,
        customerPhoneNumber,
      )) || {
        activePoints: 0,
      };
    const today = new Date();

    customerInfo.customerTierId =
      customerInfo.customerTierId ||
      (await this.customerTiersRepository.getCustomerTierSettings(companyId))
        .customerTiers[0].id;

    const customerTierSettings =
      await this.customerTiersRepository.getCustomerTierSettings(companyId);
    const evaluationDate = fromDate(
      today,
      new DateTimeSpan(
        customerTierSettings.calculationPeriod.value * -1,
        customerTierSettings.calculationPeriod.periodUnit,
      ),
    );
    const customerSpendingInfo =
      await this.promotionsRepository.getPromotionsCustomerSpending(
        companyId,
        customerPhoneNumber,
        evaluationDate,
      );

    const pointsSettings =
      await this.promotionsPointsRepository.getPointsSettings(companyId);
    const expirySoonPeriod = pointsSettings.expirySoonPeriod;
    const expiryDate = fromDate(today, expirySoonPeriod);
    const activeCustomerPoints =
      await this.promotionsPointsRepository.getActiveCustomerPoints(
        companyId,
        customerPhoneNumber,
        expiryDate,
      );

    const grouped: {
      [date: string]: { balanceValue: number; expirySoonDate: Date };
    } = {};
    for (const point of activeCustomerPoints) {
      const key = new Date(point.expiryDate).toDateString();
      if (!grouped[key]) {
        grouped[key] = {
          balanceValue: 0,
          expirySoonDate: point.expiryDate,
        };
      }
      grouped[key].balanceValue += point.activePoints;
    }
    const expirySoon = Object.values(grouped);
    const availableCoupons = await (
      await this.couponProvider.getCouponsByNumber(
        companyId,
        customerPhoneNumber,
        true,
        CouponStatues.ACTIVE,
      )
    ).length;
    const currencyValue =
      (pointsSettings.currencyValue * customerInfo.activePoints) /
      pointsSettings.pointsValue;
    const tierEnabled = customerTierSettings.enabled;
    const pointsEnabled = pointsSettings.enabled;

    return {
      phoneNumber: customerPhoneNumber,
      balancePoints: customerInfo.activePoints,
      customerTierId: customerInfo.customerTierId,
      currencyValue: currencyValue,
      numberOfOrders: customerSpendingInfo.numberOfOrders,
      amountSpend: customerSpendingInfo.amountSpend,
      latestOrderDate: customerSpendingInfo.latestOrderDate,
      expirySoon: expirySoon,
      availableCoupons: availableCoupons,
    };
  }

  async getAllActionList(
    companyId: string,
    customerPhoneNumber: string,
  ): Promise<CustomerPointAction[]> {
    return await this.walletRepository.getAllActionList(
      companyId,
      customerPhoneNumber,
    );
  }
  // async getCouponsByNumber(
  //   companyId: string,
  //   phoneNumber: string,
  //   customerCouponsOnly: boolean = false,
  //   couponsStatues?: CouponStatues,
  // ): Promise<Coupon[]> {
  //   const coupons = await this.walletRepository.getCouponsByNumber(
  //     companyId,
  //     phoneNumber,
  //     customerCouponsOnly,
  //     couponsStatues,
  //   );

  //   const result = await Promise.all(
  //     coupons.map(async (coupon, index) => {
  //       coupon.status = CouponProvider.couponGetStatus(coupon);

  //       coupon.couponSet = await this.couponRepository.getCouponSetById(
  //         companyId,
  //         coupon.couponSetId,
  //       );

  //       return coupon;
  //     }),
  //   );

  //   return result;
  // }
}
