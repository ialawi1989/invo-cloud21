import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { TenantService } from '../../blog/services/tenant.service';
import { MobileIconBar, NavMenu } from '../models/navigation.types';

interface ApiEnvelope<T> {
  success: boolean;
  msg: string;
  data: T;
}

/**
 * Public navigation client. Mirrors {@link PublicBlogApiService}: every
 * action POSTs JSON to `/v1/ecommerce/<subDomain>/<action>`, with the
 * tenant slug in both the path and the `X-Sub-Domain` header, and
 * `withCredentials` so shopper auth carries over.
 *
 * ⚠️ Endpoint actions: the storefront navigation endpoint name isn't
 * fixed across backend versions. The two action strings below are the
 * single place to adjust — everything else (parsing, fallbacks) is
 * stable. They default to the generic theme reader used by the CP.
 */
const ACTION_MENUS       = 'page/getNavigation';
const ACTION_MOBILE_BAR  = 'page/getMobileIconBar';

@Injectable({ providedIn: 'root' })
export class PublicNavigationApiService {
  private http   = inject(HttpClient);
  private tenant = inject(TenantService);
  private base   = environment.apiBase;

  private url(action: string): string {
    const company = encodeURIComponent(this.tenant.slug());
    return `${this.base}/v1/ecommerce/${company}/${action}`;
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ 'X-Sub-Domain': this.tenant.slug() });
  }

  private async call<T>(action: string, body: Record<string, unknown> = {}): Promise<T | null> {
    try {
      const env = await firstValueFrom(
        this.http.post<ApiEnvelope<T>>(this.url(action), body, {
          headers: this.headers(),
          withCredentials: true,
        }),
      );
      if (env && env.success === false) return null;
      return (env?.data ?? null) as T | null;
    } catch (e) {
      // Navigation is non-critical chrome — never throw into the shell.
      // A missing/!ok endpoint just yields the hardcoded fallback header.
      if (!(e instanceof HttpErrorResponse)) console.warn('[nav] fetch failed', e);
      return null;
    }
  }

  /** All published menus. Tolerates `{ list: [...] }`, a bare array, or a single menu. */
  async getMenus(): Promise<NavMenu[]> {
    if (!this.tenant.slug()) return [];
    const data = await this.call<any>(ACTION_MENUS);
    if (!data) return [];
    const rows = Array.isArray(data) ? data : data.list ?? data.menus ?? [data];
    return rows
      .filter((r: any) => r && (r.template || r.list))
      .map((r: any) => this.toMenu(r));
  }

  async getMobileIconBar(): Promise<MobileIconBar | null> {
    if (!this.tenant.slug()) return null;
    const data = await this.call<any>(ACTION_MOBILE_BAR);
    if (!data) return null;
    const row = Array.isArray(data) ? data[0] : data.list ? data : data.template ? data : data;
    const list = row?.template?.list ?? row?.list ?? [];
    return { list };
  }

  /** A backend row (`{ template: {list}, isPrimaryMenu, ... }`) or already-unwrapped menu → NavMenu. */
  private toMenu(row: any): NavMenu {
    const template = row.template ?? row;
    return {
      id: row.id ?? row._id,
      name: row.name ?? template.name ?? '',
      isPrimaryMenu: row.isPrimaryMenu,
      isFooterMenu: row.isFooterMenu,
      list: template.list ?? [],
    };
  }
}
