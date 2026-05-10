import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import {
  BranchSlim,
  CoveredZonePayload,
  Zone,
} from './covered-zone.types';

/**
 * Wraps the legacy covered-zone endpoints:
 *
 *   GET  branch/getCoveredZones        → `{ branches, coveredZones }`
 *   POST branch/setCompanyZones        → save zones array
 *   POST branch/setBranchLocation      → save one branch's pin
 *   GET  company/getpickUpMaxDistance  → number (km)
 *   POST company/setpickUpMaxDistance  → save km
 *
 * The pickup-distance + zones-list pair are independent on the
 * server but always edited together on this page; the page
 * orchestrates the two saves.
 */
@Injectable({ providedIn: 'root' })
export class CoveredZoneService {
  private api = inject(ApiService);

  async load(): Promise<CoveredZonePayload> {
    const res = await this.api.request<any>(
      this.api.get('branch/getCoveredZones'),
    );
    const data = res?.data ?? res ?? {};

    const branches: BranchSlim[] = (Array.isArray(data.branches) ? data.branches : [])
      .map((b: any) => {
        const lat = Number(b?.location?.lat ?? 0);
        const lng = Number(b?.location?.lng ?? 0);
        // Legacy server sends `{ lat: 0, lng: 0 }` for "not set" —
        // normalise to null so the UI can show a clear CTA.
        const hasPin = (lat !== 0 || lng !== 0) && Number.isFinite(lat) && Number.isFinite(lng);
        return {
          id:       String(b?.id ?? ''),
          name:     String(b?.name ?? ''),
          location: hasPin ? { lat, lng } : null,
        };
      })
      .filter((b: BranchSlim) => b.id);

    const coveredZones: Zone[] = (Array.isArray(data.coveredZones) ? data.coveredZones : [])
      .map((z: any) => ({
        radius:           Number(z?.radius ?? 0) || 0,
        deliveryCharge:   Number(z?.deliveryCharge ?? 0) || 0,
        minimumCharge:    Number(z?.minimumCharge ?? 0) || 0,
        freeDeliveryOver: z?.freeDeliveryOver != null ? Number(z.freeDeliveryOver) : null,
        note:             String(z?.note ?? ''),
      }));

    return { branches, coveredZones };
  }

  async saveZones(coveredZones: Zone[]): Promise<{ success: boolean; msg?: string }> {
    const res = await this.api.request<any>(
      this.api.post('branch/setCompanyZones', { coveredZones }),
    );
    return { success: !!res?.success, msg: res?.msg };
  }

  async setBranchLocation(branchId: string, lat: number, lng: number): Promise<{ success: boolean; msg?: string }> {
    const res = await this.api.request<any>(
      this.api.post('branch/setBranchLocation', { branchId, location: { lat, lng } }),
    );
    return { success: !!res?.success, msg: res?.msg };
  }

  async getPickupMaxDistance(): Promise<number> {
    const res = await this.api.request<any>(
      this.api.get('company/getpickUpMaxDistance'),
    );
    const raw = res?.data ?? res;
    const n = Number(raw?.pickUpMaxDistance ?? raw ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  async setPickupMaxDistance(km: number): Promise<{ success: boolean; msg?: string }> {
    const res = await this.api.request<any>(
      this.api.post('company/setpickUpMaxDistance', { pickUpMaxDistance: km }),
    );
    return { success: !!res?.success, msg: res?.msg };
  }
}
