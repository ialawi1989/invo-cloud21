import { Pipe, PipeTransform, inject } from '@angular/core';
import Decimal from 'decimal.js';
import { CompanyService } from '../auth/company.service';

export interface MycurrencyArgs {
  /** Override the currency symbol (defaults to company settings). */
  symbol?: string;
  /** Override decimals (defaults to company settings). */
  afterDecimal?: number;
}

/**
 * Formats a number as "{symbol} {value-with-thousands-separators}".
 *
 * By default pulls `currencySymbol` and `afterDecimal` from the active
 * company settings via `CompanyService`. Accepts optional per-call overrides.
 *
 * Uses `decimal.js` internally so precision-sensitive values (prices,
 * unit costs multiplied by large quantities) format without float drift.
 *
 * Usage:
 *   {{ value | mycurrency }}
 *   {{ value | mycurrency:{ symbol: 'USD', afterDecimal: 2 } }}
 */
@Pipe({
  name: 'mycurrency',
  standalone: true,
  pure: false,
})
export class MycurrencyPipe implements PipeTransform {
  private companyService = inject(CompanyService);

  transform(val: unknown, args?: MycurrencyArgs): string {
    const raw = val == null || val === '' ? 0 : val;
    let d: Decimal;
    try {
      d = new Decimal(raw as any);
    } catch {
      d = new Decimal(0);
    }
    if (d.isNaN()) d = new Decimal(0);

    const settings = this.companyService.settings()?.settings ?? null;
    const symbol       = args?.symbol       ?? settings?.currencySymbol ?? '';
    const afterDecimal = args?.afterDecimal ?? settings?.afterDecimal   ?? 3;

    const formatted = d
      .toFixed(afterDecimal)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return symbol ? `${symbol} ${formatted}` : formatted;
  }
}
