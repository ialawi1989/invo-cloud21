import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import {
  BranchDeliveryAddresses,
  CountryAddress,
  CountryAddressTranslation,
  CoveredAddressesPayload,
  CoveredAddressRow,
  emptyTranslation,
  TranslationLang,
} from './covered-address.types';

/**
 * Wraps `company/getCoveredAddresses` and `company/setCoveredAddresses`.
 *
 * GET shape: `{ countryAddresses: CountryAddress[], coveredAddresses:
 * { type, coveredAddresses[] } }` — the country list is the source
 * of truth for built-in types (Governorate / City / Block) and is
 * read-only; the rest is what the user edits.
 */
@Injectable({ providedIn: 'root' })
export class CoveredAddressService {
  private api = inject(ApiService);

  async load(): Promise<CoveredAddressesPayload> {
    const res = await this.api.request<any>(
      this.api.get('company/getCoveredAddresses'),
    );
    const raw = res?.data ?? {};

    const countryAddresses: CountryAddress[] = (Array.isArray(raw.countryAddresses) ? raw.countryAddresses : [])
      .map((c: any) => ({
        Governorate: String(c?.Governorate ?? ''),
        City:        String(c?.City ?? ''),
        Block:       String(c?.Block ?? ''),
        translation: this.normTranslation(c?.translation),
      }));

    const cov = raw.coveredAddresses ?? {};
    const rows: CoveredAddressRow[] = (Array.isArray(cov.coveredAddresses) ? cov.coveredAddresses : [])
      .map((a: any) => ({
        branchId:         String(a?.branchId ?? ''),
        address:          String(a?.address ?? ''),
        parent:           String(a?.parent ?? ''),
        note:             String(a?.note ?? ''),
        deliveryCharge:   Number(a?.deliveryCharge ?? 0) || 0,
        minimumOrder:     Number(a?.minimumOrder ?? 0) || 0,
        freeDeliveryOver: a?.freeDeliveryOver != null ? Number(a.freeDeliveryOver) : null,
        translation:      this.normTranslation(a?.translation),
        newlyAdded:       false,
        isSelected:       false,
        showInSearch:     true,
      }));

    const coveredAddresses: BranchDeliveryAddresses = {
      type:             String(cov.type ?? ''),
      coveredAddresses: rows,
    };

    return { countryAddresses, coveredAddresses };
  }

  /** Persist. The UI flags (`isSelected`, `showInSearch`,
   *  `newlyAdded`) get stripped here so they never ride along
   *  to the server. */
  async save(data: BranchDeliveryAddresses): Promise<{ success: boolean; msg?: string }> {
    const payload: BranchDeliveryAddresses = {
      type: data.type,
      coveredAddresses: data.coveredAddresses.map(r => ({
        branchId:         r.branchId,
        address:          r.address,
        parent:           r.parent,
        note:             r.note,
        deliveryCharge:   r.deliveryCharge,
        minimumOrder:     r.minimumOrder,
        freeDeliveryOver: r.freeDeliveryOver,
        translation:      r.translation,
      })),
    };
    const res = await this.api.request<any>(
      this.api.post('company/setCoveredAddresses', payload),
    );
    return { success: !!res?.success, msg: res?.msg };
  }

  /** Coerce server translation into the canonical `{ City, Governorate }`
   *  shape. Preserves every language present (en/ar + any site language)
   *  so an added language survives the round-trip; guarantees en/ar exist
   *  so the form's bindings never read `undefined`. */
  private normTranslation(raw: any): CountryAddressTranslation {
    const t = raw && typeof raw === 'object' ? raw : {};
    const bucket = (src: any): TranslationLang => {
      const out: TranslationLang = { en: '', ar: '' };
      if (src && typeof src === 'object') {
        for (const lang of Object.keys(src)) {
          if (typeof src[lang] === 'string') out[lang] = src[lang];
        }
      }
      return out;
    };
    return {
      City:        bucket(t.City),
      Governorate: bucket(t.Governorate),
    };
  }
}
