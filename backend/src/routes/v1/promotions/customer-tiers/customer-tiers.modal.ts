import {
  DateTimeSpan,
  PeriodUnit,
  PromotionSettings,
  TranslatedString,
} from "../promotions.model";

export interface CustomerTiersAppearance {
  terms?: string;
  [key: string]: any;
}

export interface CustomerTier {
  id: string;
  name: TranslatedString;
  minNumberOfOrders: number;
  minAmountSpend: number;
  customerCount: number;
  enabled: boolean;
  customerTiersAppearance?: CustomerTiersAppearance;
}

export interface CustomerTierAction {
  actionName: CustomerTierActionName;
  actionDate: Date;
  note?: string;
  user: string;
  reason: TranslatedString;
  changes?: any;
  extraDetails?: any;
}

export interface CustomerTierSettings extends PromotionSettings {
  conditionMatch: conditionMatch;
  calculationPeriod: DateTimeSpan;
  evaluationLastDate?: Date;
  customerTiers: CustomerTier[];
  useMinOrder: boolean;
  useMinSpend: boolean;
  enabled: boolean;
  actionsList?: CustomerTierAction[];
}

export interface CustomerTierUpdate {
  reason: TranslatedString;
  note?: string;
}
export enum conditionMatch {
  ALL_CONDITION = "ALL_CONDITION",
  ANY_CONDITION = "ANY_CONDITION",
  NO_CONDITION = "",
}

export enum CustomerTierActionName {
  DISABLE_TIRES = "DISABLE_TIRES",
  ENABLED_TIRES = "ENABLED_TIRES",
  EDIT = "EDIT",
  EVALUATION = "EVALUATION",
}
