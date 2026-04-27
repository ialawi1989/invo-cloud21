import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** What the user picks in the Image Display settings page. */
export interface ImageDisplaySettings {
  /** CSS `object-fit` value applied to product images everywhere they render. */
  fit: 'cover' | 'contain' | 'fill';
  /** CSS `object-position` short-hand. Maps to one of nine standard anchors. */
  position:
    | 'top-left'    | 'top-center'    | 'top-right'
    | 'center-left' | 'center-center' | 'center-right'
    | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

export const DEFAULT_IMAGE_DISPLAY: ImageDisplaySettings = {
  fit: 'cover',
  position: 'center-center',
};

/**
 * MediaSettingsService
 * ────────────────────
 * Wraps the company-customization endpoints for the `imageDisplay` key
 * (type = 'media'). Mirrors `TabBuilderSettingsService` — same upsert
 * protocol against `company/getCustomizationByKey` + `company/saveCustomizations`.
 *
 * Storage shape:
 *   CustomizationSettings(type='media').settings.imageDisplay = {
 *     fit: 'cover' | ...,
 *     position: 'center-center' | ...,
 *   }
 *
 * Future media-related settings (max upload size, compression quality,
 * EXIF stripping, etc.) can co-exist under the same `type='media'` row
 * with their own keys.
 */
@Injectable({ providedIn: 'root' })
export class MediaSettingsService {
  private api = inject(ApiService);

  private static readonly TYPE = 'media';
  private static readonly KEY  = 'imageDisplay';

  /** Cached CustomizationSettings row id (see TabBuilderSettingsService for rationale). */
  private customizationId: string | null = null;

  /** In-flight save promise — serialises rapid clicks. */
  private savePromise: Promise<void> | null = null;

  async getImageDisplay(): Promise<ImageDisplaySettings> {
    try {
      const res = await this.api.request<any>(
        this.api.get(`company/getCustomizationByKey/${MediaSettingsService.TYPE}/${MediaSettingsService.KEY}`),
      );
      const data = res?.data ?? {};
      this.customizationId = data?.id ?? null;
      const raw =
        data?.[MediaSettingsService.KEY] ?? data?.imageDisplay ?? data?.value ?? null;
      return this.normalise(raw);
    } catch (e) {
      console.error('[media-settings] getImageDisplay failed', e);
      return { ...DEFAULT_IMAGE_DISPLAY };
    }
  }

  async saveImageDisplay(settings: ImageDisplaySettings): Promise<void> {
    if (this.savePromise) return this.savePromise;
    this.savePromise = this.doSave(settings)
      .finally(() => { this.savePromise = null; });
    return this.savePromise;
  }

  private async doSave(settings: ImageDisplaySettings): Promise<void> {
    const payload = this.normalise(settings);
    const res = await this.api.request<any>(this.api.post('company/saveCustomizations', {
      data: {
        id: this.customizationId,
        type: MediaSettingsService.TYPE,
        settings: { [MediaSettingsService.KEY]: payload },
      },
      key: MediaSettingsService.KEY,
    }));
    const newId = res?.data?.id ?? null;
    if (newId) this.customizationId = newId;
  }

  /** Coerce arbitrary backend payloads into a valid settings object. */
  private normalise(raw: any): ImageDisplaySettings {
    const fit: ImageDisplaySettings['fit'] =
      raw?.fit === 'contain' || raw?.fit === 'fill' ? raw.fit : 'cover';
    const validPositions: ImageDisplaySettings['position'][] = [
      'top-left', 'top-center', 'top-right',
      'center-left', 'center-center', 'center-right',
      'bottom-left', 'bottom-center', 'bottom-right',
    ];
    const position: ImageDisplaySettings['position'] =
      validPositions.includes(raw?.position) ? raw.position : 'center-center';
    return { fit, position };
  }
}
