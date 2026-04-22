import { CouponSetsSettings } from "../coupon/coupon.modal";
import { TranslatedString } from "../promotions.model";

export interface CustomerTiersAppearance {
  terms?: TranslatedString;
  [key: string]: any;
}

export interface CustomerTier {
  id: string | null;
  name: TranslatedString;
  minNumberOfOrders: number;
  minAmountSpend: number;
  customerTiersAppearance?: CustomerTiersAppearance;
}

export interface CustomerTierSettings {
  conditionMatch: string;
  useMinOrder: boolean;
  useMinSpend: boolean;
}

export interface ExpirySoon {
  balanceValue?: number;
  expirySoonDate?: Date;
}

export interface CustomerWallet {
  phoneNumber: string;
  customerTierId: string;
  numberOfOrders: number;
  amountSpend: number;
  availableCoupons: number;
  balancePoints: number;
  currencyValue: number;
  latestOrderDate: Date;
  expirySoon: ExpirySoon[];
}
export interface WalletSettings {
  enabled: boolean;
  pointsSettings?: PointsSettings;
  customerTiersSettings?: CustomerTiersSettings;
  couponSettings?: CouponSetsSettings;
}
export interface PointsSettings {
  enabled: boolean;
  pointsName?: TranslatedString;
  expiryPeriodByDay?: number;
  pointsValue?: number;
  currencyValue?: number;
}

export interface CustomerTiersSettings {
  //???
}
export interface PointsAction {
  actionName: string;
  actionDate: Date;
  reason: TranslatedString;
  grandActivePoints: number;
  spentPoints: number;
  invoiceId: string;
}
