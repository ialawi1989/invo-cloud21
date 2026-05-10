import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/http';
import {
  CountryEntry,
  Rate,
  ShippingSettingWire,
  Zone,
} from './shipping.types';

/**
 * Wraps the legacy shipping endpoints:
 *
 *   GET  company/getShippingSetting  → `Zone[]` in wire format
 *   POST company/setShippingSetting  → save zones array
 *
 * Also lazy-loads `public/Countries.json` once per session — the
 * page needs it to translate between ISO codes (wire format) and
 * country names (UI display).
 */
@Injectable({ providedIn: 'root' })
export class ShippingService {
  private api = inject(ApiService);

  /** Cached country list — fetched on first call, reused after. */
  private countriesCache = signal<CountryEntry[]>([]);

  async loadZones(): Promise<Zone[]> {
    const res = await this.api.request<any>(
      this.api.get('company/getShippingSetting'),
    );
    const wire: ShippingSettingWire[] = Array.isArray(res?.data) ? res.data : [];
    const countries = await this.loadCountries();
    const byCode = new Map(countries.map(c => [c.code, c.name]));

    // Resolve country codes back to display names + assign client-
    // side ids that drive the @for trackBy in the template.
    const seed = Date.now();
    return wire.map((z, zi) => ({
      id:        seed + zi,
      name:      String(z.name ?? ''),
      countries: (z.Countries ?? [])
        .map(code => byCode.get(code))
        .filter((n): n is string => !!n),
      rates: (z.rates ?? []).map((r, ri): Rate => ({
        id:    seed + zi * 1000 + ri + 1,
        name:  String(r.name ?? ''),
        type:  r.type === 'weight' ? 'weight' : 'total',
        from:  String(r.from ?? ''),
        to:    String(r.to ?? ''),
        price: String(r.price ?? ''),
        note:  String(r.note ?? ''),
      })),
    }));
  }

  /** Persist. Strips the UI ids and converts country names →
   *  ISO codes before the wire round-trip. */
  async saveZones(zones: Zone[]): Promise<{ success: boolean; msg?: string }> {
    const countries = await this.loadCountries();
    const byName = new Map(countries.map(c => [c.name, c.code]));
    const payload: ShippingSettingWire[] = zones.map(z => ({
      name:      z.name,
      Countries: z.countries
        .map(name => byName.get(name))
        .filter((c): c is string => !!c),
      rates: z.rates.map(r => ({
        type:  r.type,
        from:  r.from,
        to:    r.to,
        price: r.price,
        note:  r.note,
        name:  r.name,
      })),
    }));

    const res = await this.api.request<any>(
      this.api.post('company/setShippingSetting', payload),
    );
    return { success: !!res?.success, msg: res?.msg };
  }

  /** Lazy-load + cache the country list. Hosted from `public/`
   *  so the JSON is available at the same origin as the SPA. */
  async loadCountries(): Promise<CountryEntry[]> {
    if (this.countriesCache().length) return this.countriesCache();
    try {
      const res = await fetch('Countries.json', { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const list = await res.json();
      const norm: CountryEntry[] = Array.isArray(list)
        ? list
            .map((c: any) => ({
              name:      String(c?.name ?? ''),
              code:      String(c?.code ?? ''),
              dial_code: String(c?.dial_code ?? ''),
            }))
            .filter(c => c.name && c.code)
        : [];
      this.countriesCache.set(norm);
      return norm;
    } catch {
      return [];
    }
  }
}
