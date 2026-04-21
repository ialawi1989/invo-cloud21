import { Pipe, PipeTransform, inject } from '@angular/core';
import Decimal from 'decimal.js';
import { CompanyService } from '../auth/company.service';

/**
 * Formats a number with thousand separators, using the company's
 * `afterDecimal` setting unless an explicit decimal count is passed.
 *
 * Uses `decimal.js` so operations on very small or very large numbers keep
 * their precision (JS floats lose precision beyond ~15 significant digits).
 *
 * Usage:
 *   {{ value | mynumber }}
 *   {{ value | mynumber:0 }}
 *   {{ value | mynumber:2 }}
 */
@Pipe({
  name: 'mynumber',
  standalone: true,
  pure: false,   // depends on live company settings
})
export class MynumberPipe implements PipeTransform {
  private companyService = inject(CompanyService);

  transform(val: unknown, decimals?: number): string {
    const raw = val == null || val === '' ? 0 : val;
    let d: Decimal;
    try {
      d = new Decimal(raw as any);
    } catch {
      d = new Decimal(0);
    }
    if (d.isNaN()) d = new Decimal(0);

    if (decimals != null) {
      return addThousandSeparators(d.toFixed(decimals));
    }

    const afterDecimal = this.companyService.settings()?.settings?.afterDecimal ?? 3;
    // If the actual decimals already fit the company precision, use that
    // precision; otherwise keep the raw value (up to ~10 places) and only
    // format thousand separators on the integer part.
    const actualDecimals = d.decimalPlaces();
    if (actualDecimals <= afterDecimal || actualDecimals > 10) {
      return addThousandSeparators(d.toFixed(afterDecimal));
    }
    return addThousandSeparators(d.toString());
  }
}

/** Inserts ',' as thousand separators on the integer part of a numeric string. */
function addThousandSeparators(numStr: string): string {
  const [intPart, fracPart] = numStr.split('.');
  const withSeps = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart ? `${withSeps}.${fracPart}` : withSeps;
}
