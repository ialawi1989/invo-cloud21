import { DaySpan, PeriodUnit, TranslatedString } from '@features/promotions/models/common.model';
import { FieldTemplate } from './product-fields/field-template';

/**
 * Promotion (gift voucher) settings of a product — ported 1:1 from the legacy
 * `productPromotionSettings.ts`. Saved as the product's `promotionSettings` JSON.
 */
export interface ProductPromotionSettingsFields {
  voucherName: FieldTemplate;
  initialVoucher: FieldTemplate;
  expiryPeriod?: FieldTemplate;
  activePeriod?: FieldTemplate;
  oneTimeUse?: FieldTemplate;
  private?: FieldTemplate;
}

export class ProductPromotionSettings {
  voucherName: TranslatedString = {};
  initialVoucher: number | null = null;
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
