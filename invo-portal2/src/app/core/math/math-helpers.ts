import Decimal from 'decimal.js';
import { CompanyService } from '@core/auth/company.service';

/**
 * Money maths — port of the legacy `MathHelpers`/`MathUtils`. The plain operations round to the
 * company's `afterDecimal`; the `*2` operations keep full precision (rounding is the last step).
 */
export class MathUtils {
  static get afterDecimal(): number {
    return CompanyService.companySettings?.settings?.afterDecimal ?? 3;
  }

  static sub(b: number, c: number): number {
    if (c == null) return b;
    return Number(new Decimal(b ?? 0).sub(new Decimal(c ?? 0)).toFixed(MathUtils.afterDecimal));
  }
  static add(b: number, c: number): number {
    return Number(new Decimal(b ?? 0).add(new Decimal(c ?? 0)).toFixed(MathUtils.afterDecimal));
  }
  static multiply(b: number, c: number): number {
    return Number(new Decimal(b ?? 0).mul(new Decimal(c ?? 0)).toFixed(MathUtils.afterDecimal));
  }
  static division(b: number, c: number): number {
    return Number(new Decimal(b ?? 0).div(new Decimal(c ?? 0)).toFixed(MathUtils.afterDecimal));
  }

  static add2(b: number, c: number): number { return Number(new Decimal(b ?? 0).add(new Decimal(c ?? 0))); }
  static sub2(b: number, c: number): number { return Number(new Decimal(b ?? 0).sub(new Decimal(c ?? 0))); }
  static multiply2(b: number, c: number): number { return Number(new Decimal(b ?? 0).mul(new Decimal(c ?? 0))); }
  static division2(b: number, c: number): number { return Number(new Decimal(b ?? 0).div(new Decimal(c ?? 0))); }

  static roundNumber(b: number): number { return Number(new Decimal(b)); }
  static roundDecimal(b: number): number { return Number(Number(b ?? 0).toFixed(MathUtils.afterDecimal)); }
  static tenToPowAfterDecimal(): number { return Math.pow(10, MathUtils.afterDecimal); }
  static setToMinValueIfItsUnder(value: number, min: number): number { return value < min ? min : value; }
}
