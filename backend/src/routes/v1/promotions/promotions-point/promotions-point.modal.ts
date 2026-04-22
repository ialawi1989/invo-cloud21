import {
  DateTimeSpan,
  DatePeriodUnit,
  TranslatedString,
  PromotionSettings,
} from "../promotions.model";

export interface CustomerPointAction {
  actionName: CustomerPointsActionName;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
  extraDetails?: any;
}

export interface CustomerPoint {
  id: string;
  phoneNumber: string;
  status: CustomerPointsStatues;
  note?: string;
  reason: TranslatedString;
  givenPoints: number;
  activeDate: Date;
  expiryDate: Date;
  givenDate: Date;
  isCanceled: boolean;
  activePoints: number;
  invoiceId?: string;
  orderNumber?:string;
  actionsList?: CustomerPointAction[];
}
export interface PointsSettings extends PromotionSettings {
  pointsName: TranslatedString;
  enabled: boolean;
  paymentMethodId: string;
  expiryPeriod: DateTimeSpan;
  activePeriod: DateTimeSpan;
  expirySoonPeriod: DateTimeSpan;
  pointsValue: number;
  currencyValue: number;
  actionsList?: CustomerPointAction[];
}

export enum CustomerPointsStatues {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  EXPIRED = "EXPIRED",
  CANCELED = "CANCELED",
  SPEND = "SPEND",
}

export enum CustomerPointsActionName {
  RESTORE_POINTS = "RESTORE_POINTS",
  CANCEL_POINTS = "CANCEL_POINTS",
  ADD = "ADD",
  ACTIVATE = "ACTIVATE",
  SPEND_POINTS = "SPEND_POINTS",
  EXTEND = "EXTEND",
  REFUND = "REFUND",
  EXPIRE = "EXPIRE",
}
export interface CustomerPointsUpdate {
  reason: TranslatedString;
  note?: string;
}
export enum CustomerPointsSettingActionName {
  EDIT = "EDIT",
  DISABLE_POINTS = "DISABLE_POINTS",
  ENABLED_POINTS = "ENABLED_POINTS",
}
export interface CustomerPointsSettingAction {
  actionName: CustomerPointsSettingActionName;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
  extraDetails?: any;
}
