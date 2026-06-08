import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { APP_CONFIG } from '../../../app-config.token';

/**
 * Resolves the tenant (merchant) slug the public blog talks to, mirroring
 * oldEco's `appServices.initializeApp` resolution order:
 *
 *   1. `window.__BLOG_SUBDOMAIN__` explicit override (multi-tenant shell / dev)
 *   2. `config.json` subdomain (SSR layer injects it from the request host)
 *   3. Local/dev host (`localhost`, `127.*`, LAN) → `?tenant=` or the last
 *      `blogTenant` saved to localStorage (no hardcoded company)
 *   4. Wildcard shop host (`<slug>.invopos.shop`, `.dev.`/`.test.`) → first
 *      label, guarding reserved prefixes (www/dev/…) and numeric/IP hosts
 *   5. Custom domain → backend lookup `POST /v1/app/getSlugByDomain` (cached)
 *
 * Resolved once via an app initializer (see app.config.ts) so the slug is in
 * place before any route/guard fires a blog request. `slug()` is then a cheap
 * synchronous read for the API client.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private http = inject(HttpClient);
  private appConfig = inject(APP_CONFIG, { optional: true }) as unknown;

  // Mirror oldEco's server.ts / appServices.ts constants exactly so SSR and
  // CSR agree on what is a slug vs. a reserved prefix vs. a custom domain.
  private readonly SHOP_HOSTS = ['test.invopos.shop', 'dev.invopos.shop', 'invopos.shop'];
  private readonly RESERVED   = ['www', 'dev', 'test', 'staging', 'preprod', 'uat', 'qa', 'demo'];

  private _slug = '';
  private resolved: Promise<void> | null = null;
  /** Resolved tenant slug. Empty until `resolve()` settles (or unresolvable). */
  slug(): string { return this._slug; }

  /** Resolve the slug once. Multiple callers (the app initializer AND the
   *  analytics warm-up) share the same promise so the work runs once and
   *  everyone awaits the same settled result. */
  resolve(): Promise<void> {
    return (this.resolved ??= this.doResolve());
  }

  private async doResolve(): Promise<void> {
    // 1. Explicit override.
    if (typeof window !== 'undefined') {
      const override = (window as any).__BLOG_SUBDOMAIN__;
      if (typeof override === 'string' && override.length) { this._slug = override; return; }
    }

    // 2. config.json (APP_CONFIG factory may be a Promise).
    try {
      const cfg: any = await Promise.resolve(this.appConfig as any);
      if (cfg && typeof cfg.subdomain === 'string' && cfg.subdomain.length) {
        this._slug = cfg.subdomain;
        return;
      }
    } catch { /* fall through */ }

    if (typeof window === 'undefined') return; // SSR with no config — leave empty.

    const host = (window.location?.hostname ?? '').toLowerCase();

    // 3. Local/dev — no derivable slug from an IP/localhost host. Take an
    //    explicit hint (?tenant= → remembered), else the env dev fallback.
    if (this.isLocal(host)) {
      const q = new URLSearchParams(window.location.search).get('tenant') ?? '';
      if (q) { try { localStorage.setItem('blogTenant', q); } catch { /* ignore */ } this._slug = q; return; }
      let stored = '';
      try { stored = localStorage.getItem('blogTenant') ?? ''; } catch { /* ignore */ }
      this._slug = stored || (environment as any).devTenant || '';
      if (!this._slug) {
        console.warn('[TenantService] Local dev: no tenant set. Append ?tenant=<slug> to the URL once (remembered), or set environment.devTenant.');
      }
      return;
    }

    // 4. Wildcard shop host → first label.
    const wild = this.fromShopHost(host);
    if (wild) { this._slug = wild; return; }

    // Numeric / IP host → unresolvable.
    if (/^[\d.]+$/.test(host)) { this._slug = ''; return; }

    // 5. Custom domain → backend lookup.
    this._slug = await this.getSlugByDomain(host.replace(/^www\./, ''));
    if (!this._slug) {
      console.warn('[TenantService] Could not resolve a tenant slug for host:', host);
    }
  }

  private isLocal(host: string): boolean {
    return host === 'localhost'
        || host === '127.0.0.1'
        || /^10\./.test(host)
        || /^192\.168\./.test(host)
        || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  }

  /** `<slug>.invopos.shop` family → the slug, else '' (custom domain). */
  private fromShopHost(host: string): string {
    for (const root of this.SHOP_HOSTS) {
      if (host === root) return '';
      if (host.endsWith('.' + root)) {
        const candidate = host.slice(0, -('.' + root).length).split('.')[0];
        if (!candidate || this.RESERVED.includes(candidate)) return '';
        return candidate;
      }
    }
    return '';
  }

  /** Custom-domain → slug, via the same endpoint oldEco uses. Best-effort. */
  private async getSlugByDomain(domain: string): Promise<string> {
    try {
      const res: any = await firstValueFrom(
        this.http.post<any>(`${environment.apiBase}/v1/app/getSlugByDomain`, { Domain: domain }),
      );
      return res?.success && res.data?.slug ? String(res.data.slug) : '';
    } catch {
      return '';
    }
  }
}
