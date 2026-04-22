import {
  DateTimeSpan,
  PromotionsAction,
  TranslatedString,
} from "../promotions.model";
import { DiscountCouponSet } from "./discountCoupon/discountCoupon";

export type PromotionsCouponsSet = CouponSet | DiscountCouponSet;

export interface CouponSet {
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
  expiryPeriod: DateTimeSpan;
  activePeriod: DateTimeSpan;
  isActive: boolean;
}
export interface CouponSetsSettings {
enabled:boolean;
actionsList?: CouponSetsSettingsAction[];
}
export interface Coupon {
  couponSet?: PromotionsCouponsSet | undefined;
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

export interface CouponSetsAction {
  actionName: CouponSetsActionName ;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
}
export interface  CouponSetsSettingsAction {
  actionName:  CouponSetsSettingsActionName;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
}
export interface CouponAction {
  actionName: CouponActionName;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
}

export enum CouponSetsStatues {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  CONSUMED = "CONSUMED",
}
export enum CouponStatues {
  USED = "USED",
  EXPIRED = "EXPIRED",
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  CANCELED = "CANCELED",
}

export enum CouponSetsSettingsActionName {
  DISABLED =  "DISABLED",
  ENABLED = "ENABLED",
  EDIT  = "EDIT",

} 

export enum CouponSetsActionName {
  EDITED = "EDITED",
  ACTIVATE = "ACTIVE",
  DEACTIVATE = "DEACTIVATE",
  ADD = "ADD",
  ISSUED = "ISSUED",
  CONSUMED = "CONSUMED",
  COUPON_USED = "COUPON_USED",  
}
export enum CouponActionName {
  ISSUED = "ISSUED",
  CANCEL = "CANCEL",
  UNCANCEL = "UNCANCEL",
  ACTIVATE = "ACTIVE",
  EXTEND = "EXTEND",
  EDITED = "EDITED",
  USED = "USED",  
  EXPIRE = "EXPIRE"
}
