import { DaySpan, TranslatedString } from './common.model';

/** Ported 1:1 from legacy `customer-tiers/customer-tiers.modal.ts`. */

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
}

export interface CustomerTierSettings {
  actionsList?: CustomerTierAction[];
  conditionMatch: ConditionMatch;
  calculationPeriod: DaySpan;
  evaluationLastDate: Date;
  customerTiers: CustomerTier[];
  useMinOrder: boolean;
  useMinSpend: boolean;
  enabled: boolean;
}

export interface CustomerTierUpdate {
  reason: TranslatedString;
  note?: string;
}

export enum ConditionMatch {
  ALL_CONDITION = 'ALL_CONDITION',
  ANY_CONDITION = 'ANY_CONDITION',
  NO_CONDITION = ' ',
}

export enum CustomerTierActionName {
  DISABLE_TIRES = 'DISABLE_TIRES',
  ENABLED_TIRES = 'ENABLED_TIRES',
  EDIT = 'EDIT',
  EVALUATION = 'EVALUATION',
}
