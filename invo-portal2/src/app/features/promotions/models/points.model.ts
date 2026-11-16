import { DaySpan, TranslatedString } from './common.model';

/** Ported 1:1 from legacy `promotional-points/modal/customer-promtion-points.modal.ts`. */

export interface CustomerPointAction {
  actionName: CustomerPointsActionName | string;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
  extraDetails?: any;
}

export interface CustomerPointUpdate {
  reason: TranslatedString;
  note?: string;
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
  orderNumber?: string;
  invoiceId?: string;
  actionsList?: CustomerPointAction[];
}

export interface PointsSettings {
  pointsName: TranslatedString;
  enabled: boolean;
  expiryPeriod: DaySpan;
  activePeriod: DaySpan;
  expirySoonPeriod: DaySpan;
  pointsValue: number;
  currencyValue: number;
  paymentMethodId: string;
}

export enum CustomerPointsStatues {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELED = 'CANCELED',
  SPEND = 'SPEND',
}

export enum CustomerPointsActionName {
  RESTORE_POINTS = 'RESTORE_POINTS',
  CANCEL_POINTS = 'CANCEL_POINTS',
  ADD = 'ADD',
  ACTIVATE = 'ACTIVATE',
  SPEND_POINTS = 'SPEND_POINTS',
  EXTEND = 'EXTEND',
  REFUND = 'REFUND',
  EXPIRE = 'EXPIRE',
  FAILED_SEND_EMAIL = 'FAILED_SEND_EMAIL',
  SUCCESS_SEND_EMAIL = 'SUCCESS_SEND_EMAIL',
}

export interface CustomerPointsSummary {
  customerTierId: string;
  activePoints: number;
}

export enum CustomerPointsSettingActionName {
  EDIT = 'EDIT',
}

export interface CustomerPointsSettingAction {
  actionName: CustomerPointsSettingActionName | string;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
  extraDetails?: any;
}
