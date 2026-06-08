import { Injectable, inject } from '@angular/core';
import { environment, type Tier } from '../../../environments/environment';
import { CompanyService } from './company.service';

/**
 * Shape of the optional `domain` column on the company settings
 * payload — the user-mapped custom domain. Coming straight off the
 * backend, the fields are nullable / loosely typed so we narrow at
 * use-site below. Example payload:
 *
 *   { "domain": "fff.co", "status": "submitted",
 *     "subdomain": "ddd", "isSubdomain": true }
 *
 * The custom domain is only honoured when `status` is one of the
 * terminal "verified" values (see `ACTIVE_DOMAIN_STATUSES`). Until
 * then the storefront URL falls back to the `<slug>.invopos.shop`
 * pattern so the user doesn't see a broken preview link.
 */
export interface DomainConfig {
  domain?:      string;
  status?:      string;
  subdomain?:   string;
  isSubdomain?: boolean;
}

/** Status values that mean the domain is live and resolvable on the
 *  open internet. Anything else (e.g. `submitted`, `pending`,
 *  `verifying`) → fall back to the slug pattern. The list is
 *  conservative on purpose; backend can broaden it later. */
const ACTIVE_DOMAIN_STATUSES: readonly string[] = [
  'active',
  'verified',
  'connected',
  'live',
];

/**
 * StorefrontUrlService
 * ────────────────────
 * Single source of truth for "where does this tenant's storefront
 * live?". Resolves to a fully-qualified URL that opens in the
 * customer-facing site (the `*.invopos.shop` family of hosts) given
 * the current admin tier and the tenant's company config.
 *
 * Resolution rules (in order):
 *
 *   1. Custom domain on the company — used iff `domain.status` is
 *      one of the active values above. Honours the `isSubdomain`
 *      flag so `{ domain: "fff.co", subdomain: "shop" }` resolves to
 *      `https://shop.fff.co`.
 *
 *   2. Slug-on-invopos-shop, scoped by tier:
 *        local       → `http://localhost:4600`
 *        dev         → `https://<slug>.dev.invopos.shop`
 *        test        → `https://<slug>.test.invopos.shop`
 *        production  → `https://<slug>.invopos.shop`
 *
 * Components should never reimplement this logic — inject the
 * service, call `baseUrl()` or `pageUrl(path)`. The receipt-builder
 * QR feedback link and the SEO "View live page" actions are the
 * primary consumers; new ones get a one-liner.
 */
@Injectable({ providedIn: 'root' })
export class StorefrontUrlService {
  private companies = inject(CompanyService);

  /** Public storefront origin for the current tenant. */
  baseUrl(): string {
    const company = this.companies.currentCompany() as
      | (Record<string, unknown> & { domain?: DomainConfig | null })
      | null;
    const domain = company?.domain ?? null;

    if (this.isActiveDomain(domain)) {
      const host = domain!.isSubdomain && domain!.subdomain
        ? `${domain!.subdomain}.${domain!.domain}`
        : domain!.domain!;
      return `https://${host}`;
    }

    return this.tierBase(environment.tier as Tier, this.companySlug());
  }

  /** Resolve a storefront path against `baseUrl()`. Empty path
   *  yields the bare origin; otherwise the leading slash is
   *  normalised so callers don't have to remember it.
   *
   *  Local dev: the storefront host (localhost / LAN IP) carries no
   *  tenant slug, so the website can't tell which company to load and
   *  every API call 404s on `/v1/ecommerce//…`. Pass the slug
   *  explicitly via `?tenant=<slug>` — the storefront reads it and
   *  remembers it in localStorage. */
  pageUrl(path: string = ''): string {
    const base = this.baseUrl();
    let url = path ? base + (path.startsWith('/') ? path : `/${path}`) : base;

    if (environment.tier === 'local') {
      const slug = this.companySlug();
      if (slug) {
        url += (url.includes('?') ? '&' : '?') + `tenant=${encodeURIComponent(slug)}`;
      } else {
        console.warn(
          '[StorefrontUrlService] Local preview: no company slug found on ' +
          'currentCompany()/settings(). The storefront will load without a ' +
          'tenant (→ /v1/ecommerce//…). Open the storefront once with ' +
          '?tenant=<slug> (it is remembered), or verify the slug field name ' +
          'in the company payload.',
        );
      }
    }
    return url;
  }

  /** Active tenant's company slug (trimmed, '' when none). Checks the
   *  company identity AND the full company settings, since the cached
   *  `currentCompany` can predate `slug` being populated. Tolerates a
   *  few key spellings the backend might use. */
  private companySlug(): string {
    const pick = (o: Record<string, any> | null | undefined): string =>
      String(o?.['slug'] ?? o?.['subDomain'] ?? o?.['subdomain'] ?? '');
    const fromCompany  = pick(this.companies.currentCompany() as Record<string, any> | null);
    const fromSettings = pick(this.companies.settings() as Record<string, any> | null);
    return (fromCompany || fromSettings).trim();
  }

  /** Whether the company already has a *usable* custom domain. */
  hasActiveDomain(): boolean {
    const company = this.companies.currentCompany() as { domain?: DomainConfig | null } | null;
    return this.isActiveDomain(company?.domain ?? null);
  }

  // ─── Internals ──────────────────────────────────────────────────────────

  private isActiveDomain(domain: DomainConfig | null | undefined): boolean {
    if (!domain || !domain.domain) return false;
    const status = (domain.status ?? '').toLowerCase();
    return ACTIVE_DOMAIN_STATUSES.includes(status);
  }

  private tierBase(tier: Tier, slug: string): string {
    switch (tier) {
      // Local dev: storefront runs on its own port (4600) on the SAME
      // host the dashboard is opened from. We derive the host from the
      // page rather than hardcoding `localhost` so previews work when
      // the dashboard is reached over the LAN (e.g. http://10.2.2.89:4700
      // → http://10.2.2.89:4600). Falls back to localhost during SSR.
      case 'local':      return `http://${this.localHost()}:4600`;
      case 'dev':        return slug ? `https://${slug}.dev.invopos.shop`  : 'https://dev.invopos.shop';
      case 'test':       return slug ? `https://${slug}.test.invopos.shop` : 'https://test.invopos.shop';
      case 'production': return slug ? `https://${slug}.invopos.shop`      : 'https://invopos.shop';
    }
  }

  /** Hostname the dashboard is currently served from (no port), so the
   *  local-tier storefront link targets the same machine. */
  private localHost(): string {
    return (typeof window !== 'undefined' && window.location?.hostname) || 'localhost';
  }
}
