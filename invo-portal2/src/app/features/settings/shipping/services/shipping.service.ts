import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/http';
import { CompanyService } from '@core/auth/company.service';
import {
  CountryEntry,
  Rate,
  ShippingOptions,
  ShippingSettingWire,
  TaxOption,
  Zone,
  emptyShippingOptions,
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
  private api     = inject(ApiService);
  private company = inject(CompanyService);

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

  // ─── Shipping Options ──────────────────────────────────────────
  // Four settings sit across two backends:
  //   • `type` + `deliveryMethod` are storefront-routing concerns and
  //     live on the website-builder `ThemeSettings` doc →
  //     `getThemeByType` / `saveWebsiteTheme`.
  //   • `weightUOM` + `deliveryChargeTaxId` are company-level fields
  //     already returned by `company/getCompanySetting` (cached in
  //     `CompanyService.settings`) and saved via `company/saveCompany`.
  //     We read them from the cache (no extra fetch) and write them
  //     back via a `saveCompany` patch.
  //
  // Splitting on backend (not on field) keeps each endpoint payload
  // minimal and matches where the legacy storefront expects to find
  // each value at runtime.

  /** Load the four options. Theme doc supplies `type` + `deliveryMethod`;
   *  the company-settings cache supplies `weightUOM` + `deliveryChargeTaxId`
   *  with no extra HTTP round-trip. */
  async loadOptions(): Promise<ShippingOptions> {
    const opts = emptyShippingOptions();

    try {
      const res = await this.api.request<any>(
        this.api.post('company/getThemeByType', { type: 'ThemeSettings' }),
      );
      const doc = (res?.data?.list ?? [])[0] ?? null;
      const so  = doc?.template?.shippingOptions;
      if (so?.type === 'shipping' || so?.type === 'delivery') opts.type = so.type;
      if (so?.deliveryMethod === 'address' || so?.deliveryMethod === 'zone') {
        opts.deliveryMethod = so.deliveryMethod;
      }
    } catch { /* fall through to defaults */ }

    // `weightUOM` and `deliveryChargeTaxId` live on the top-level
    // company doc returned by `company/getCompanySetting` (already
    // cached in `CompanyService.settings` from app boot). No extra
    // HTTP — read straight from the signal.
    const settings = this.company.settings();
    const uom = settings?.weightUOM;
    if (uom === 'kg' || uom === 'ounce' || uom === 'pound') opts.weightUOM = uom;
    const taxId = settings?.deliveryChargeTaxId ?? null;
    opts.deliveryChargeTaxId = taxId ? String(taxId) : null;

    return opts;
  }

  /** Persist the four options across the two backends. Both calls
   *  fire even when only one side changed — the diff is too small
   *  to be worth tracking, and both endpoints are idempotent. */
  async saveOptions(opts: ShippingOptions): Promise<{ success: boolean; msg?: string }> {
    // 1) Theme doc — `type` + `deliveryMethod` only. Read-modify-write
    //    so we don't blow away other `template` fields owned by the
    //    website-builder pages.
    let themeOk = true;
    let themeMsg: string | undefined;
    try {
      const res = await this.api.request<any>(
        this.api.post('company/getThemeByType', { type: 'ThemeSettings' }),
      );
      const doc = (res?.data?.list ?? [])[0] ?? {};
      const next = {
        ...doc,
        type:     'ThemeSettings',
        template: {
          ...(doc?.template ?? {}),
          shippingOptions: {
            ...((doc?.template ?? {}).shippingOptions ?? {}),
            type:           opts.type,
            deliveryMethod: opts.deliveryMethod,
          },
        },
      };
      const saveRes = await this.api.request<any>(
        this.api.post('company/saveWebsiteTheme', next),
      );
      themeOk  = !!saveRes?.success;
      themeMsg = saveRes?.msg;
    } catch (err: any) {
      themeOk  = false;
      themeMsg = err?.message;
    }

    // 2) Company doc — `weightUOM` + `deliveryChargeTaxId`. The
    //    `saveCompany` endpoint validates required fields like
    //    `country`, so we MUST spread the full cached doc; a minimal
    //    patch is rejected with "country is Required". The legacy
    //    `Company` model defines `deliveryChargeTaxId` as a string
    //    (default `""`), so we send the empty-string form when
    //    clearing — some endpoints treat `null` as "leave alone"
    //    rather than "clear", which keeps a stale id around.
    let companyOk = true;
    let companyMsg: string | undefined;
    try {
      const cur = this.company.settings() ?? {};
      const payload = {
        ...cur,
        weightUOM:           opts.weightUOM,
        deliveryChargeTaxId: opts.deliveryChargeTaxId ?? '',
      };
      const res = await this.api.request<any>(
        this.api.post('company/saveCompany', payload),
      );
      companyOk  = !!res?.success;
      companyMsg = res?.msg;
      // Refresh cached settings so the rest of the app (including
      // the rate-table weight adornment) picks up the new values
      // without a full reload.
      if (companyOk) await this.company.loadSettings(true);
    } catch (err: any) {
      companyOk  = false;
      companyMsg = err?.message;
    }

    return {
      success: themeOk && companyOk,
      msg:     [themeMsg, companyMsg].filter(Boolean).join(' · ') || undefined,
    };
  }

  /** Lightweight tax list for the picker — pages 1..1, limit 999
   *  to fit the typical small tax catalogue in one shot. */
  async loadTaxes(): Promise<TaxOption[]> {
    try {
      const res = await this.api.request<any>(
        this.api.post('accounts/getTaxesList', { page: 1, limit: 999 }),
      );
      const list: any[] = res?.data?.list ?? [];
      return list.map(t => ({ id: String(t?.id ?? t?._id ?? ''), name: String(t?.name ?? '') }))
                 .filter(t => t.id && t.name);
    } catch {
      return [];
    }
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
