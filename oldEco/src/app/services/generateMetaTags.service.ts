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
    if (options.visitor?.ip) {
      headers['x-end-user-ip'] = options.visitor.ip;
    }
    if (options.visitor?.userAgent) {
      headers['x-end-user-agent'] = options.visitor.userAgent;
    }

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    // FIX: Cap upstream fetches at 5s. Without this, an upstream hang on an
    // unknown slug (e.g. host parsing produced "www") would await forever and
    // trip CloudFront's 30s origin-response timeout → 504 Gateway Timeout.
    fetchOptions.signal = AbortSignal.timeout(5000);

    const response = await fetch(url, fetchOptions);
    
    // Read the response body first
    const responseData = await response.json().catch(() => null);
    
    if (response.status === 401) {
      
      // Throw error with the msg from API
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

/**
 * Fetch product data by ID
 */
async function getProductData(apiUrl: string, productId: string, visitor?: FetchOptions['visitor']): Promise<Product | null> {
  return await fetchFromAPI(apiUrl, {
    method: 'POST',
    body: { productId },
    visitor,
  });
}

/**
 * Fetch page data by slug
 */
async function getPageData(apiUrl: string, slug: string, visitor?: FetchOptions['visitor']): Promise<Product | null> {
  if (!slug || slug === 'null' || slug === 'undefined') return null;
  return await fetchFromAPI(`${apiUrl}/theme/getPage/${slug}`, {
    method: 'GET',
    visitor,
  });
}

/**
 * Fetch company data
 */
async function getCompanyData(apiUrl: string, visitor?: FetchOptions['visitor']): Promise<Product | null> {
  return await fetchFromAPI(`${apiUrl}/getCompanyPrefrences`, {
    method: 'GET',
    visitor,
  });
}

export interface VisitorContext {
  ip?: string;
  userAgent?: string;
}

/**
 * Generate meta tags for a product
 */
export async function generateMetaTags(
  productId: string,
  apiUrl: string,
  referer: string,
  visitor?: VisitorContext
): Promise<string | null> {
  if (!productId || productId === 'null' || !apiUrl) return null;

  // FIX: Validate UUID format before hitting the API. Malformed or truncated
  // productIds (e.g. from bots, bad links, or proxy truncation) would otherwise
  // reach Postgres and cause "invalid input syntax for type uuid" errors.
  if (!UUID_REGEX.test(productId)) {
    console.warn('[generateMetaTags] Invalid UUID format, skipping meta fetch:', productId);
    return null;
  }

  try {

    const productData: any = await getProductData(apiUrl, productId, visitor) || {};

    if (!productData || !productData.name) {
      console.warn('No product data found for meta tags');
      return null;
    }


    return `
      <meta property="og:title" content="${productData.name}">
      <meta property="og:description" content="${productData.description || ''}">
      <meta property="og:image" content="${productData.mediaUrl || ''}">
      <meta property="og:url" content="${referer}">
      <meta property="og:type" content="product">
    `;
  } catch (error) {
    console.error('Error generating product meta tags:', error);
    throw error;
  }
}

/**
 * Generate meta tags for a page by slug
 */
export async function generatePageMetaTags(
  apiUrl: string,
  slug: string,
  referer: string,
  visitor?: VisitorContext
): Promise<string | null> {
  if (!slug || slug === 'null' || slug === 'undefined' || !apiUrl) return null;
  try {

    let pageData: any = await getPageData(apiUrl, slug, visitor) || {};

    // Fallback names for known slugs
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

    if (!pageData.name && slugNameMap[slug]) {
      pageData.name = slugNameMap[slug];
    }

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

/**
 * Generate meta tags for company home page
 */
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