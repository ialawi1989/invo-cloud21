import { TranslatedString } from "./TranslatedString.modal";

export interface PointsAction {
  actionName: string;
  actionDate: Date;
  reason: TranslatedString;
   grandActivePoints: number;
  spentPoints: number;
}
export interface ExtraDetails {
  spentPointsValue?: number;
  currency?: string;
  spentOrderNumber?: string;
  [key: string]: any;
}

export interface ExpirySoon {
  balanceValue: number;
  expirySoonDate: Date; 
}

export interface CustomerWallet {
  phoneNumber: string;
  balancePoints: number;
  currencyValue: number;
  customerTierId: string ;
  numberOfOrders: number ;
  amountSpend: number ;
  latestOrderDate: Date;
  expirySoon: ExpirySoon[] ;
  availableCoupons: number;
}
export interface WalletSettings {
  enabled: boolean; 
  pointsSettings?: PointsSettings;
  customerTiersSettings?: CustomerTierSettings;
  couponSettings?: CouponSetsSettings;

}
export interface  PointsSettings {
  pointsName: TranslatedString ; 
  expiryPeriodByDay: number ;
  pointsValue: number ;
  currencyValue: number ;
  enabled: boolean;
}


export interface CustomerTiersAppearance {
  terms?: string;
  [key: string]: any;
}

export interface CustomerTier {
  campaign?:  PromotionsCampaign[];
  id: string;
  name:  TranslatedString ;
  minNumberOfOrders: number ;
  minAmountSpend: number ;
  customerCount: number ;
  enabled: boolean ;
  customerTiersAppearance?: CustomerTiersAppearance;
  
}

export interface CustomerTierSettings {
  conditionMatch: string;
  calculationPeriod: number ;
  calculationPeriodUnit: PeriodUnit ;
  evaluationLastDate: Date ;
  customerTiers: CustomerTier[];
  useMinOrder: boolean;
  useMinSpend: boolean;
   enabled: boolean ;
}
export type PromotionsCampaign =
  | Campaign
  | PointsCampaign
  | SpendXGetYPointsCampaign;

export interface CampaignAction {
  actionName: CampaignsActionName;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
}
export interface CouponSetsSettings {
enabled:boolean;
actionsList?: any[];
}
export interface Campaign {
  id: string;
  campaignsName: TranslatedString;
  campaignsType: string;
  expiryPeriod: DaySpan;
  activePeriod: DaySpan;
  status: CampaignsStatues;
  customerTierIds: string[];
  startDate: Date;
  endDate: Date;
  createdDate: Date;
  isStopped: boolean;
  actionsList?: CampaignAction[];
}
export class DaySpan {
  constructor(value: number = 1, periodUnit: PeriodUnit = PeriodUnit.DAYS) {
    this.value = value;
    this.periodUnit = periodUnit;
  }
  public value: number = 1;
  public periodUnit: PeriodUnit = PeriodUnit.DAYS;
}

export interface SpendXGetYPointsCampaign extends PointsCampaign {
  spentAmount: number;
  minSpend: number;
  startFrom: number;
}


export interface PointsCampaign extends Campaign {
  awardedPoints: number;
}
export type PromotionsCouponSet = DiscountSetCoupon |CouponsSet ;
export interface CouponsSet {
  id: string;
  name: TranslatedString;
  codePrefix: string;
  type: string;
  used: number;
  issued: number;
  expired: number;
  max: number;
  givenDate: Date;
  status: CouponSetsStatues;
  servicesId?: string[];
  branchesId?: string[];
  expiryPeriod: DaySpan;
  activePeriod: DaySpan;
  isActive: boolean;
}

export enum CouponSetsStatues {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CONSUMED = 'CONSUMED',
}
export interface DiscountSetCoupon extends CouponsSet {
  minimumOrder: number;
  percentage: number;
}
export interface  ProductsCouponSet extends CouponsSet {
  products: CouponProduct | undefined;
}

export interface CouponProduct {
  productsInfo: ProductInfo;
  percentage : number;

}

export interface ProductInfo {
  id: string;
  name: TranslatedString;
  defaultPrice : number;
}

export interface Coupon {
  couponSet?: PromotionsCouponSet;
  id: string;
  code: string;
  couponSetId: string;
  invoiceId?: string;
  activeDate: Date;
  expiryDate: Date;
  status: CouponStatues;
  giveDate?: Date;
  reason: TranslatedString;
  countOfUsage: number;
  isUsed: boolean;
  isCancel: boolean;
  uesDate?: Date;
  phoneNumber?: string;
  email?: string;
  orderNumber?: string;
}
export enum CouponStatues {
  USED = 'USED',
  EXPIRED = 'EXPIRED',
  ACTIVE ="ACTIVE",
  INACTIVE ="INACTIVE",
  CANCELED ="CANCELED"
}
export enum CampaignsStatues {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ENDED = 'ENDED',
  STOPPED = 'STOPPED',
}

export enum CampaignsActionName {
  CLONED = 'CLONED',
  EDITED = 'EDITED',
  STOPPED = 'STOPPED',
  STARTED = 'STARTED',
  EXTEND = 'EXTEND',
  ADD = 'ADD',
}

export class CampaignActionDetails<T extends Campaign> {
  constructor(campaign: T) {
    this.campaign = campaign;
  }
  campaign!: T;
  reason: TranslatedString = {
    en: '',
  };
  note: string = '';
  title: string = '';
}


export interface SpendXGetYPointsCampaign extends PointsCampaign {
  spentAmount: number;
  minSpend: number;
  startFrom: number;
}

export enum PeriodUnit {
  DAYS = 'DAYS',
  WEEKS = 'WEEKS',
  MONTHS = 'MONTHS',
  YEARS = 'YEARS'
}


export enum CustomerPointsActionName {
  RESTORE_POINTS = 'RESTORE_POINTS',
  CANCEL_POINTS = 'CANCEL_POINTS',
  ADD = 'ADD',
  ACTIVATE = 'ACTIVATE',
  SPEND_POINTS = 'SPEND_POINTS',
  EXTEND = 'EXTEND',
}

export { TranslatedString };
