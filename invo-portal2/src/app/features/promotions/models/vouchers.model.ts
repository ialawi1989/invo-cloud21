import { DaySpan, TranslatedString } from './common.model';

/** Ported 1:1 from legacy `promotions-vouchers/modal/promotions-vouchers.modal.ts`. */

export interface VoucherAction {
  actionName: VouchersActionName;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
  extraDetails?: any;
}

export interface VoucherWithCount {
  count?: number;
  voucher: Voucher;
}

export interface Voucher {
  code: string;
  id: string;
  phoneNumber: string;
  status: VouchersStatues;
  note?: string;
  reason: TranslatedString;
  initialVoucher: number;
  activeDate: Date;
  expiryDate: Date;
  givenDate: Date;
  isCanceled: boolean;
  invoiceId?: string;
  orderNumber?: string;
  actionsList?: VoucherAction[];
  customerEmail?: string;
  customerName?: string;
  balance: number;
  vouchersName: TranslatedString;
  oneTimeUse: boolean;
  private: boolean;
}

export interface VouchersSettings {
  vouchersName: TranslatedString;
  enabled: boolean;
  paymentMethodId: string;
  expiryPeriod: DaySpan;
  activePeriod: DaySpan;
  expirySoonPeriod: DaySpan;
  actionsList?: VoucherAction[];
}

export enum VouchersStatues {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELED = 'CANCELED',
  SPEND = 'SPEND',
}

export enum VouchersActionName {
  RESTORE_VOUCHERS = 'RESTORE_VOUCHERS',
  CANCEL_VOUCHERS = 'CANCEL_VOUCHERS',
  ADD = 'ADD',
  ACTIVATE = 'ACTIVATE',
  SPEND_VOUCHERS = 'SPEND_VOUCHERS',
  EXTEND = 'EXTEND',
  REFUND = 'REFUND',
  EXPIRE = 'EXPIRE',
  FAILED_SEND_EMAIL = 'FAILED_SEND_EMAIL',
  SUCCESS_SEND_EMAIL = 'SUCCESS_SEND_EMAIL',
  EDIT = 'EDIT',
}

export interface VouchersUpdate {
  reason: TranslatedString;
  note?: string;
}

export enum VouchersSettingActionName {
  EDIT = 'EDIT',
  DISABLE_POINTS = 'DISABLE_POINTS',
  ENABLED_POINTS = 'ENABLED_POINTS',
}

export interface VouchersSettingAction {
  actionName: VouchersSettingActionName;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
  extraDetails?: any;
}

export interface VoucherUpdate {
  actionName: VouchersActionName;
  reason: TranslatedString;
  note?: string;
  vouchersValue?: number;
  activeDate?: Date;
  expiryDate?: Date;
  spentOrderNumber?: string;
  spentOrderId?: string;
  paymentLineId?: string;
}

export class VouchersActionDetails {
  voucherWithCount!: VoucherWithCount;
  reason?: TranslatedString;
  notes?: string;
  title: string = '';
}
