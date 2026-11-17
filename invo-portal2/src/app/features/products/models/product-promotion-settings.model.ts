import { DaySpan, PeriodUnit, TranslatedString } from '@features/promotions/models/common.model';
import { FieldTemplate } from './product-fields/field-template';

/**
 * Promotion (gift voucher) settings of a product — ported 1:1 from the legacy
 * `productPromotionSettings.ts`. Saved as the product's `promotionSettings` JSON.
 */
export interface ProductPromotionSettingsFields {
  voucherName: FieldTemplate;
  initialVoucher: FieldTemplate;
  count?: FieldTemplate;
  expiryPeriod?: FieldTemplate;
  activePeriod?: FieldTemplate;
  oneTimeUse?: FieldTemplate;
  private?: FieldTemplate;
}

/** Legacy master: "voucher max issue to 10". */
export const MAX_PROMOTION_COUNT = 10;

export class ProductPromotionSettings {
  voucherName: TranslatedString = {};
  initialVoucher: number | null = null;
  /** How many vouchers one sale issues — 1 to {@link MAX_PROMOTION_COUNT}. */
  count: number | null = 1;
  expiryPeriod: DaySpan = new DaySpan(1, PeriodUnit.DAYS);
  activePeriod: DaySpan = new DaySpan(1, PeriodUnit.DAYS);
  oneTimeUse: boolean = false;
  private: boolean = false;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }
}
