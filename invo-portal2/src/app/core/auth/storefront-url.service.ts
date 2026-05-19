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
      | (Record<string, unknown> & { slug?: string; domain?: DomainConfig | null })
      | null;
    const slug   = (company?.slug ?? '').trim();
    const domain = company?.domain ?? null;

    if (this.isActiveDomain(domain)) {
      const host = domain!.isSubdomain && domain!.subdomain
        ? `${domain!.subdomain}.${domain!.domain}`
        : domain!.domain!;
      return `https://${host}`;
    }

    return this.tierBase(environment.tier as Tier, slug);
  }

  /** Resolve a storefront path against `baseUrl()`. Empty path
   *  yields the bare origin; otherwise the leading slash is
   *  normalised so callers don't have to remember it. */
  pageUrl(path: string = ''): string {
    const base = this.baseUrl();
    if (!path) return base;
    const p = path.startsWith('/') ? path : `/${path}`;
    return base + p;
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
      // Local dev: storefront runs on its own port. Keep in sync with
      // `DEV_WEBSITE_URL` in environment.ts so developers see the
      // right host both in /settings/seo and via the receipt-builder
      // QR helper.
      case 'local':      return 'http://localhost:4600';
      case 'dev':        return slug ? `https://${slug}.dev.invopos.shop`  : 'https://dev.invopos.shop';
      case 'test':       return slug ? `https://${slug}.test.invopos.shop` : 'https://test.invopos.shop';
      case 'production': return slug ? `https://${slug}.invopos.shop`      : 'https://invopos.shop';
    }
  }
}
