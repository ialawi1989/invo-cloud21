export interface Product {
  data?: {
    name: string;
    description: string;
    mediaUrl: string;
  };
}

interface FetchOptions {
  method?: 'GET' | 'POST';
  body?: any;
  /**
   * Per-visitor identity headers forwarded to the backend so its rate
   * limiter can bucket per end-user instead of per SSR-server IP.
   */
  visitor?: {
    ip?: string;
    userAgent?: string;
  };
}

// FIX: UUID v4 validation regex — rejects malformed/truncated IDs before they
// reach the database and cause "invalid input syntax for type uuid" errors.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A product can also be addressed by its SEO slug (`/menu/product/credit-notes`).
// Slugs still have to be shaped like slugs — the point of the UUID gate was to
// keep bot noise and truncated ids away from the database, and that holds here.
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,120}$/i;

/** True when `key` is safe to send upstream as a product lookup key. */
export function isProductKey(key: string): boolean {
  return UUID_REGEX.test(key) || SLUG_REGEX.test(key);
}

/** Slugify exactly as the dashboard does when deriving a default URL slug,
 *  so `Credit Notes` ⇄ `credit-notes` round-trips. */
function slugify(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** HTML-escape a meta value. Without this a quote in a product name or an
 *  og:description closes the attribute and the rest of the tag leaks into
 *  the document. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generic fetch wrapper for API calls
 */
async function fetchFromAPI(
  url: string,
  options: FetchOptions = { method: 'GET' }
): Promise<any | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.visitor?.ip) headers['x-end-user-ip'] = options.visitor.ip;
    if (options.visitor?.userAgent) headers['x-end-user-agent'] = options.visitor.userAgent;

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
    };

    if (options.body) fetchOptions.body = JSON.stringify(options.body);

    // FIX: Cap upstream fetches at 5s. Without this, an upstream hang on an
    // unknown slug would await forever and trip CloudFront's 30s origin-response
    // timeout → 504 Gateway Timeout.
    fetchOptions.signal = AbortSignal.timeout(5000);

    const response = await fetch(url, fetchOptions);
    const responseData = await response.json().catch(() => null);

    if (response.status === 401) {
      const errorMessage = responseData?.msg || responseData?.message || 'Unauthorized';
      throw new Error(errorMessage);
    }
    if (!response.ok) {
      const errorMessage = responseData?.msg || responseData?.message || `HTTP error ${response.status}`;
      throw new Error(errorMessage);
    }

    return responseData?.data ?? responseData;
  } catch (error: any) {
    console.error('Error fetching from API:', error.message);
    throw error;
  }
}

async function getProductData(apiUrl: string, productId: string, visitor?: FetchOptions['visitor']): Promise<Product | null> {
  return await fetchFromAPI(apiUrl, { method: 'POST', body: { productId }, visitor });
}

/**
 * Resolve a product SEO slug to its id.
 *
 * `shop/getProduct` keys on a UUID column, so a slug URL would otherwise come
 * back as `invalid input syntax for type uuid` and the page would be flagged
 * 404 despite rendering. `generalSearch` is public and returns id + name, so
 * we search the de-slugified words and match on the slugified name.
 *
 * Temporary: delete once `ShopRepo.getProduct` accepts a slug directly. It
 * also can't resolve a slug that was hand-edited away from the product name.
 */
async function resolveProductSlug(
  apiUrl: string,
  slug: string,
  visitor?: FetchOptions['visitor'],
): Promise<string | null> {
  const searchTerm = slug.replace(/-+/g, ' ').trim();
  if (!searchTerm) return null;
  const searchUrl = apiUrl.replace(/getProduct$/, 'generalSearch');
  if (searchUrl === apiUrl) return null;
  try {
    const data: any = await fetchFromAPI(searchUrl, {
      method: 'POST',
      body: { searchTerm, page: 1, limit: 20 },
      visitor,
    });
    const list: any[] = data?.list ?? [];
    const hit = list.find(item => slugify(item?.name) === slug.toLowerCase());
    return hit?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * The one URL that represents this product.
 *
 * The request URL is the wrong answer for two reasons. It carries `?from=shop`
 * or `?from=menu`, which is breadcrumb state, not identity — so the same
 * product would advertise two different canonicals and split its own ranking.
 * And it may address the product by UUID, while the canonical form is the slug.
 *
 * Falls back to the request URL minus its query string if anything here fails:
 * a canonical without the breadcrumb param is still strictly better than one
 * with it.
 */
function canonicalProductUrl(referer: string, productName: string, seoSlug?: string): string {
  const stripQuery = (u: string) => u.split('?')[0].split('#')[0];
  try {
    const url = new URL(referer);
    const parts = url.pathname.split('/').filter(Boolean);
    const at = parts.indexOf('product');
    const slug = (seoSlug || slugify(productName) || '').trim();
    if (at === -1 || at === parts.length - 1 || !slug) return stripQuery(referer);
    parts[at + 1] = slug;
    return `${url.origin}/${parts.join('/')}`;
  } catch {
    return stripQuery(referer);
  }
}

async function getPageData(apiUrl: string, slug: string, visitor?: FetchOptions['visitor']): Promise<Product | null> {
  if (!slug || slug === 'null' || slug === 'undefined') return null;
  return await fetchFromAPI(`${apiUrl}/theme/getPage/${slug}`, { method: 'GET', visitor });
}

async function getCompanyData(apiUrl: string, visitor?: FetchOptions['visitor']): Promise<Product | null> {
  return await fetchFromAPI(`${apiUrl}/getCompanyPrefrences`, { method: 'GET', visitor });
}

export interface VisitorContext {
  ip?: string;
  userAgent?: string;
}

export async function generateMetaTags(
  productId: string,
  apiUrl: string,
  referer: string,
  visitor?: VisitorContext
): Promise<string | null> {
  if (!productId || productId === 'null' || !apiUrl) return null;

  // FIX: keep malformed keys away from the API — a UUID or a slug, nothing else.
  if (!isProductKey(productId)) {
    console.warn('[generateMetaTags] Invalid product key, skipping meta fetch:', productId);
    return null;
  }

  try {
    // A slug has to become an id before the product lookup will accept it.
    const resolvedId = UUID_REGEX.test(productId)
      ? productId
      : await resolveProductSlug(apiUrl, productId, visitor);
    if (!resolvedId) {
      console.warn('[generateMetaTags] Could not resolve product key:', productId);
      return null;
    }

    const productData: any = await getProductData(apiUrl, resolvedId, visitor) || {};
    if (!productData || !productData.name) {
      console.warn('No product data found for meta tags');
      return null;
    }

    // Per-page SEO overrides authored in the dashboard (SEO Settings →
    // Basics / Social share). The backend ships them on the product payload;
    // when a field is blank the product's own values stand in, which is
    // exactly how the dashboard previews it.
    const seo = productData.seo ?? productData.seoOverride ?? {};

    const title       = seo.titleTag        || productData.name;
    const description = seo.metaDescription || productData.description || '';
    const image       = seo.ogImage         || productData.mediaUrl || '';

    const ogTitle       = seo.ogTitle       || title;
    const ogDescription = seo.ogDescription || description;

    // X (Twitter) falls back to the OG values, matching the dashboard preview.
    const xTitle       = seo.xTitle       || ogTitle;
    const xDescription = seo.xDescription || ogDescription;
    const xImage       = seo.xImage       || image;

    const robots = seo.robots
      || (seo.indexable === false ? 'noindex, nofollow' : 'index, follow');

    // Slug form, no breadcrumb query — see canonicalProductUrl.
    const canonical = canonicalProductUrl(referer, productData.name, seo.urlSlug);

    return `
      <title>${esc(title)}</title>
      <link rel="canonical" href="${esc(canonical)}">
      <meta name="description" content="${esc(description)}">
      <meta name="robots" content="${esc(robots)}">
      <meta property="og:title" content="${esc(ogTitle)}">
      <meta property="og:description" content="${esc(ogDescription)}">
      <meta property="og:image" content="${esc(image)}">
      <meta property="og:url" content="${esc(canonical)}">
      <meta property="og:type" content="product">
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="${esc(xTitle)}">
      <meta name="twitter:description" content="${esc(xDescription)}">
      <meta name="twitter:image" content="${esc(xImage)}">
    `;
  } catch (error) {
    console.error('Error generating product meta tags:', error);
    throw error;
  }
}

export async function generatePageMetaTags(
  apiUrl: string,
  slug: string,
  referer: string,
  visitor?: VisitorContext
): Promise<string | null> {
  if (!slug || slug === 'null' || slug === 'undefined' || !apiUrl) return null;
  try {
    let pageData: any = await getPageData(apiUrl, slug, visitor) || {};

    const slugNameMap: { [key: string]: string } = {
      'table-reservation': 'Reservations - Table Reservation',
      'appointments': 'Appointments - Create Appointment',
      'menu': 'Menu',
      'shop': 'Shop',
      'account': 'Account',
      'cart': 'Cart',
      'checkout': 'Checkout',
      'categories': 'Shop - Categories',
      'search': 'Search',
    };

    if (!pageData.name && slugNameMap[slug]) pageData.name = slugNameMap[slug];

    if (!pageData.name) {
      console.warn('No page data found for slug:', slug);
      return null;
    }

    const imageUrl =
      pageData.template?.settings?.subheader_settings?.defaultImage?.defaultUrl || '';

    return `
      <meta property="og:title" content="${pageData.name}">
      <meta property="og:description" content="${pageData.description || ''}">
      <meta property="og:image" content="${imageUrl}">
      <meta property="og:url" content="${referer}">
      <meta property="og:type" content="website">
    `;
  } catch (error) {
    console.error('Error generating page meta tags:', error);
    throw error;
  }
}

export async function generateCompanyMetaTags(
  apiUrl: string,
  referer: string,
  visitor?: VisitorContext
): Promise<string | null> {
  if (!apiUrl) return null;
  try {
    const companyData: any = await getCompanyData(apiUrl, visitor) || {};
    if (!companyData || !companyData.company) {
      console.warn('No company data found for meta tags');
      return null;
    }
    const imageUrl =
      companyData.company?.themeSettings?.template?.header?.logo?.defaultUrl ||
      companyData.company?.defaultUrl ||
      '';

    return `
      <meta property="og:title" content="${companyData.company?.name || ''}">
      <meta property="og:description" content="${companyData.company?.description || ''}">
      <meta property="og:image" content="${imageUrl}">
      <meta property="og:url" content="${referer}">
      <meta property="og:type" content="website">
    `;
  } catch (error) {
    console.error('Error generating company meta tags:', error);
    throw error;
  }
}
