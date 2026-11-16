import { DaySpan, TranslatedString } from './common.model';

/** Ported 1:1 from legacy `coupons/coupons.modal.ts`. */


export type PromotionsCouponSet = CouponsSet | DiscountSetCoupon | ProductsCouponSet | StampCardSet;

export interface CouponSetsSettings {
  enabled: boolean;
  actionsList?: CouponSetsSettingsAction[];
}
export interface CouponSetsSettingsAction {
  actionName: CouponSetsSettingsActionName;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
}
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
  actionsList?: CouponSetsAction[];
  expiryPeriod: DaySpan;
  activePeriod: DaySpan;
  isActive: boolean;
}
export interface DiscountSetCoupon extends CouponsSet {
  minimumOrder: number;
  percentage: number;
}
export interface  ProductsCouponSet extends CouponsSet {
  products: CouponProduct;
}

export interface CouponProduct {
  productsInfo?: ProductInfo;
  percentage : number;
}

export interface ProductInfo {
  id: string;
  name: TranslatedString;
}


export interface  StampCardSet extends CouponsSet {
  product?: ProductInfo[];  
  requiresStamps : number;
  prizeProduct?: ProductInfo[];
}


export interface CouponSetsAction {
  actionName: CouponSetsActionName;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
}

export enum CouponSetsStatues {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CONSUMED = 'CONSUMED',
}

export interface CouponSetUpdate {
  actionName: CouponSetsActionName;
  reason: TranslatedString;
  note?: string;
}
export interface CouponUpdate {
  actionName: CouponActionName;
  reason: TranslatedString;
  note?: string;
  expiryDate?: Date;
  stampCount?: number;
}
export enum CouponSetsActionName {
  EDITED = 'EDITED',
  ACTIVATE = 'ACTIVE',
  DEACTIVATE = 'DEACTIVATE',
  ADD = 'ADD',
  COUPON_USED = "COUPON_USED",
  CONSUMED = "CONSUMED",
  COUPON_EXPIRE = "COUPON_EXPIRE"
}
export enum CouponStatues {
  USED = 'USED',
  EXPIRED = 'EXPIRED',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CANCELED = 'CANCELED',
  CLAIMABLE = 'CLAIMABLE',

}
export enum CouponSetsSettingsActionName {
  DISABLED = 'DISABLED',
  ENABLED = 'ENABLED',
  EDIT = 'EDIT',
}
export interface CouponAction {
  actionName: CouponActionName;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
}
export enum CouponActionName {
  ISSUED = 'ISSUED',
  CANCEL = 'CANCEL',
  UNCANCEL = 'UNCANCEL',
  ACTIVATE = 'ACTIVE',
  EXTEND = 'EXTEND',
  EDITED = 'EDITED',
  EXPIRE = "EXPIRE",
  FAILED_SEND_EMAIL = "FAILED_SEND_EMAIL",
  SUCCESS_SEND_EMAIL = "SUCCESS_SEND_EMAIL",
  AUTO_FIX = "AUTO_FIX",
  STAMPED = "STAMPED",
  UNSTAMPED = "UNSTAMPED",
  DEACTIVATE = "DEACTIVATE",
}

export interface Coupon {
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
  useInvoiceId?: string;
}

export interface  StampCard extends Coupon {
 totalStamps: number;
 usedStamps: number;
 unUsedStamps?: number;
}
export class CouponSetActionDetails<T extends CouponsSet> {
  constructor(coupon: T) {
    this.coupon = coupon;
  }
  coupon!: T;
  reason: TranslatedString = {
    en: '',
  };
  note: string = '';
  title: string = '';
}
export class CouponActionDetails<T extends Coupon> {
  constructor(coupon: T) {
    this.coupon = coupon;
  }
  count!: number;
  coupon!: T;
  reason: TranslatedString = {
    en: '',
  };
  note: string = '';
  title: string = '';
}
