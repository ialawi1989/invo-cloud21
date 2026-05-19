import { Injectable } from '@angular/core';

import {
  Coupon,
  CouponSetsSettings,
  CustomerTier,
  CustomerTierSettings,
  PointsAction,
  PromotionsCampaign,
  PromotionsCouponSet,
  WalletSettings,
} from '../modal/promotion.modal';
import { BackendClient } from '../backend-client';

@Injectable({
  providedIn: 'root',
})
export class WalletServiceService {
  constructor(private backendClient: BackendClient) {}

  async load() {
    if (this.customerTierSettings) {
      return;
    }
    this.customerTierSettings = await this.getCustomerTiersSettings();
    this.customerTiers = this.customerTierSettings.customerTiers;
  }
  //tires

  async getNextTire(id: string) {
    await this.load();
    const index = this.customerTiers.findIndex((c) => c.id === id);
    return this.customerTiers[index + 1];
  }
  async getCustomerTier(id: string) {
    await this.load();
    const index = this.customerTiers.findIndex((c) => c.id === id);
    return this.customerTiers[index];
  }
  async getCustomerTierIndex(id: string) {
    await this.load();
    const index = this.customerTiers.findIndex((c) => c.id === id);
    return index;
  }

  async getCustomerTiers() {
    await this.load();
    return this.customerTiers;
  }

  async getCustomerTiersSettings(): Promise<CustomerTierSettings> {
    let url = 'promotions/customer-tiers';
    let result = await this.backendClient.get<CustomerTierSettings>(url);
    return result;
  }

  async getWalletSettings(): Promise<WalletSettings> {
    let url = 'promotions/settings';
    let result = await this.backendClient.get<WalletSettings>(url);
    return result;
  }
  async getCouponSetsSettings(): Promise<CouponSetsSettings> {
    let url = 'promotions/promotions-coupons/settings';
    let result = await this.backendClient.get<CouponSetsSettings>(url);
    return result;
  }
  async getCouponSet<T extends PromotionsCouponSet>(
    id: string = '',
  ): Promise<T> {
    let url = 'promotions/promotions-coupons/couponSet/' + id;
    let result = await this.backendClient.get<T>(url);
    return result;
  }

  async getCoupon<T extends Coupon>(id: string = ''): Promise<T> {
    let url = 'promotions/promotions-coupons/coupon/' + id;
    let result = await this.backendClient.get<T>(url);
    return result;
  }

  async getCustomerTierSettings() {
    await this.load();
    return this.customerTierSettings;
  }
  customerTierSettings!: CustomerTierSettings; // = await getCustomerTiersSettings();
  customerTiers: CustomerTier[] = [];

  async getCustomerWallet<CustomerWallet>(): Promise<CustomerWallet> {
    let url = 'promotions/wallet';
    let result = await this.backendClient.get<CustomerWallet>(url);
    return result;
  }
  async getCustomerCoupons(
    activeOnly: boolean = false,
    customerCouponsOnly: boolean = false,
    cartSessionId : boolean = false,
    branchId?: string,
    serviceId?: string,
    forList: boolean = false,
  ): Promise<any[]> {
  
    let url = 'promotions/promotions-coupons/coupons?A';
    if (activeOnly) {
      url += `&activeOnly=`+ activeOnly; 
    }
    if (customerCouponsOnly) {
      url += `&customerCouponsOnly=` + customerCouponsOnly;
    } 
    if (branchId) {
      url += `&branchId=` + branchId;
    }
    if (serviceId) {
      url += `&serviceId=` + serviceId;
    }
    if (forList) {
      url += `&forList=` + forList;
    }
    if (cartSessionId) {
      const sessionId = localStorage.getItem('sessionId');
      url += `&sessionId=` + sessionId;
    }
    let result = await this.backendClient.get<any[]>(url);
    return result;
  }

  async getAllAction(): Promise<PointsAction[]> {
    let url = 'promotions/promotional-points/transactions';
    let result = await this.backendClient.get<PointsAction[]>(url);
    return result;
  }

  getPointCampaigns = async (): Promise<any[]> => {
    let url = 'promotions/campaign';

    let result = await this.backendClient.get<PromotionsCampaign[]>(url);
    return result;
  };
  async redeemCoupon(
    couponId: string,
    couponDiscount: number,
    invoiceId: string,
  ) {
    let url = 'promotions/accounting/redeemCoupon';
    let result = await this.backendClient.put(url, {
      couponId,
      couponDiscount,
      invoiceId,
    });
    return result;
  }

  //   const result = await accountingProvider.redeemCoupon(
  //   company,
  //   invoiceId,
  //   couponId,
  //   couponDiscount
  // );
}
