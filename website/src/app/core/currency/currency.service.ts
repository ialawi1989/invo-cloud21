import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantService } from '../../features/blog/services/tenant.service';

interface Envelope<T> { success: boolean; msg: string; data: T; }

export interface StoreCurrency {
  /** Displayed before the amount, e.g. `BHD`. */
  symbol: string;
  /** Decimal places the merchant prices in — 3 for BHD, 2 for most others. */
  afterDecimal: number;
  /** Divisor for display in a non-base currency. 1 = the store's own. */
  rate: number;
}

/**
 * Everything price-shaped on the storefront.
 *
 * Amounts from the API are in the store's base currency, and the number of
 * decimals is a per-merchant setting, not a constant: BHD prices to 3 places,
 * so rendering `1.00` where the merchant means `1.000` is a wrong price, and a
 * wrong price is worse than a missing feature.
 *
 * `symbol` and `afterDecimal` come from `getCompanyPrefrences`
 * (`data.company.settings`), the same source the old storefront read. `rate` is
 * 1 until a currency switcher exists; the division is kept so adding one is a
 * change of state, not of every call site.
 */
@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private http   = inject(HttpClient);
  private tenant = inject(TenantService);

  private state = signal<StoreCurrency>({ symbol: '', afterDecimal: 3, rate: 1 });
  private loaded = false;
  private inFlight: Promise<void> | null = null;

  current = this.state.asReadonly();
  symbol  = computed(() => this.state().symbol);

  load(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    return (this.inFlight ??= this.doLoad());
  }

  private async doLoad(): Promise<void> {
    try {
      const company = encodeURIComponent(this.tenant.slug());
      const env = await firstValueFrom(
        this.http.get<Envelope<any>>(
          `${environment.apiBase}/v1/ecommerce/${company}/getCompanyPrefrences`,
          { headers: new HttpHeaders({ 'X-Sub-Domain': this.tenant.slug() }) },
        ),
      );
      const settings = env?.data?.company?.settings ?? {};
      const afterDecimal = Number(settings.afterDecimal);
      this.state.set({
        symbol: String(settings.currencySymbol ?? ''),
        // Guard the decimals: toFixed throws outside 0–100, and a merchant
        // record with a null here would take the whole page down.
        afterDecimal: Number.isFinite(afterDecimal) && afterDecimal >= 0 && afterDecimal <= 10
          ? afterDecimal
          : 3,
        rate: 1,
      });
    } catch {
      // Offline / not mounted — the defaults above stand, and prices still
      // render, just without a symbol.
    } finally {
      this.loaded = true;
      this.inFlight = null;
    }
  }

  /** `1` → `1.000`. The number alone, for tight layouts. */
  amount(value: number | null | undefined): string {
    const { afterDecimal, rate } = this.state();
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return (safe / (rate || 1)).toFixed(afterDecimal);
  }

  /** `1` → `BHD 1.000`. What a shopper should see. */
  format(value: number | null | undefined): string {
    const sym = this.state().symbol;
    const amount = this.amount(value);
    return sym ? `${sym} ${amount}` : amount;
  }
}
