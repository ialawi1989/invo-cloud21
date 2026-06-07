import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';

import {
  SiteAnalytics,
  SiteAnalyticsParams,
  RealtimeAnalytics,
} from './site-analytics.types';

/**
 * Store-wide analytics service. Wraps the two `company/*` analytics
 * endpoints and normalizes their responses into the canonical shapes so
 * the dashboard can render partial data gracefully.
 *
 *   POST company/getSiteAnalytics    { from?, to? }
 *   GET  company/getRealtimeAnalytics
 */
@Injectable({ providedIn: 'root' })
export class SiteAnalyticsService {
  private api = inject(ApiService);

  async getSiteAnalytics(params: SiteAnalyticsParams = {}): Promise<SiteAnalytics> {
    const res = await this.api.request<any>(
      this.api.post('company/getSiteAnalytics', { from: params.from, to: params.to }),
    );
    const d = res?.data ?? res ?? {};
    return {
      range:        d.range ?? undefined,
      integrations: d.integrations ?? { ga4Enabled: false, gscEnabled: false },
      traffic:      d.traffic ?? null,
      ecommerce:    d.ecommerce ?? null,
      search:       d.search ?? null,
      currency:     d.currency ?? undefined,
    };
  }

  async getRealtime(): Promise<RealtimeAnalytics> {
    const res = await this.api.request<any>(this.api.get('company/getRealtimeAnalytics'));
    const d = res?.data ?? res ?? {};
    return {
      activeUsers: Number(d.activeUsers ?? 0),
      last30min:   Array.isArray(d.last30min) ? d.last30min : [],
      topPages:    Array.isArray(d.topPages) ? d.topPages : undefined,
      byCountry:   Array.isArray(d.byCountry) ? d.byCountry : undefined,
    };
  }
}
