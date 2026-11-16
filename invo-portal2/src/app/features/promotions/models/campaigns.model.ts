import { DaySpan, TranslatedString } from './common.model';
import { ProductInfo } from './coupons.model';

/** Legacy `campaigns/modal/campaign.modal.ts` (+ the per-type modals), merged. */

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
  ENDED = 'ENDED',
  ACTIVATED = 'ACTIVATED',
  DEACTIVATED = 'DEACTIVATED',
}

/** `campaignsType` values the backend stores. */
export const StampCardCampaignType = 'STAMP_CARD_CAMPAIGN';
export type CampaignType =
  | 'SPEND_X_GET_Y_POINTS'
  | 'BUY_X_GET_Y_POINTS'
  | 'SPEND_X_GET_COUPON'
  | 'BUY_X_GET_COUPON'
  | typeof StampCardCampaignType;

export interface CampaignAction {
  actionName: string;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
}

export interface CampaignProduct {
  productsInfo?: ProductInfo;
  count: number;
}

/**
 * One campaign document. The legacy code had a class per type; they differ only
 * in these optional fields, so a single shape carries all five.
 */
export interface PromotionsCampaign {
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
  /** points campaigns */
  awardedPoints?: number | null;
  /** coupon / stamp-card campaigns */
  couponSetId?: string;
  /** buy-x campaigns */
  products?: CampaignProduct[];
  /** spend-x campaigns */
  spentAmount?: number | null;
  startFrom?: number | null;
  minSpend?: number;
}

export interface CampaignUpdate {
  actionName: CampaignsActionName;
  reason: TranslatedString;
  note?: string;
  endDate?: any;
}
