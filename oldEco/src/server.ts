import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import compression from 'compression';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { generateCompanyMetaTags, generateMetaTags, generatePageMetaTags } from './app/services/generateMetaTags.service';
import { Logger } from './logger';

/* ------------------------------ Paths ------------------------------ */

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

/* --------------------------- Env Loading --------------------------- */

function loadEnvConfig(path: string | null = null) {
  const result = path ? dotenv.config({ path }) : dotenv.config();
  const label = path ?? 'Global environment';
  if (result.error) {
    console.warn(
      `Error Loading ${label}: ${result.error.name} ${result.error.message}`
    );
  } else if (result.parsed) {
    console.log(`Loaded ${label}`);
  } else {
    console.warn(`Did not load ${label}`);
  }
}

loadEnvConfig('.env.local');
loadEnvConfig('.env');
loadEnvConfig();

const Config = {
  // FIX: Strip trailing slash from BASE_URL to prevent double-slash in assembled URLs
  BASE_URL: (process.env.BASE_URL?.trim() || '').replace(/\/$/, ''),
  websocketIP: process.env.websocketIP?.trim() || '',
  domain: process.env.domain?.trim() || '',
  subDomain: process.env.subDomain?.trim() || '',
};

console.log('Runtime Config:', {
  BASE_URL: Config.BASE_URL,
  domain: Config.domain,
  subDomain: Config.subDomain,
});

/* ------------------------------ Server ----------------------------- */

const app = express();
const angularApp = new AngularNodeAppEngine();

// Behind proxies (ELB/CloudFront) use X-Forwarded-* correctly
app.set('trust proxy', true);

// Helpful defaults
app.disable('x-powered-by');

// Enable gzip/deflate compression for all responses
app.use(compression());

/* ------------------------ Logger middleware ----------------------- */
// Wrap every request in an AsyncLocalStorage context so Logger.error/warn/info
// automatically pick up traceId + request metadata without threading it through
// every call site.
app.use((req, res, next) => {
  const traceId =
    (req.headers['x-trace-id'] as string | undefined) ||
    (req.headers['x-request-id'] as string | undefined) ||
    randomUUID();

  res.setHeader('x-trace-id', traceId);

  Logger.runWithContext(
    {
      traceId,
      request: {
        method: req.method,
        url: req.originalUrl,
        route: req.path,
        params: req.params,
        query: req.query,
        headers: req.headers as Record<string, unknown>,
      },
    },
    () => next()
  );
});

/* ------------------------- Helpers / Utils ------------------------- */

// FIX: Reserved hostname prefixes (www, dev, etc.) are NOT company slugs.
// Mirrors RESERVED_PREFIXES in src/app/services/appServices.ts so SSR and CSR
// agree on which prefixes to strip.
const RESERVED_PREFIXES = ['www', 'dev', 'test', 'staging', 'preprod', 'uat', 'qa', 'demo'];

function getSubDomain(host: string): string {
  let subdomain = Config.subDomain;
  if (!subdomain) {
    const parts = (host || '').split('.');
    const fromHost = parts[0] || '';

    // FIX: Guard against full IP addresses (e.g. "172.31.4.70" as host) in addition
    // to numeric-only first segments (e.g. "172"). Test both the first segment AND
    // the full host string so internal AWS/ELB IPs never slip through as a subdomain.
    const isNumericOrIp =
      /^[\d.]+$/.test(fromHost) || /^[\d.]+$/.test(host);

    // FIX: For multi-segment hosts whose first segment is a reserved prefix
    // (e.g. www.fermendiet.com → "www"), return empty so the meta-tag route
    // guards skip the upstream call and fall through to plain SSR. Without
    // this, the upstream API was called with an invalid slug "www" and
    // hung — tripping CloudFront's 30s origin-response timeout → 504.
    const isReservedPrefix =
      RESERVED_PREFIXES.includes(fromHost.toLowerCase()) && parts.length > 1;

    subdomain = (isNumericOrIp || isReservedPrefix) ? '' : fromHost;

    if (!subdomain) {
      console.warn(
        '[getSubDomain] Could not resolve subdomain from host:',
        host,
        '— host is reserved/numeric or Config.subDomain is empty.'
      );
    }
  }
  return subdomain;
}

// Known wildcard shop roots. A host that ends with one of these uses
// `<merchant-slug>.<root>`; anything else is a custom domain that needs
// resolveSlug() to ask the backend's /app/getSlugByDomain. Order matters:
// list more specific roots BEFORE more general ones (test.invopos.shop must
// be checked before invopos.shop).
const SHOP_HOSTS = ['test.invopos.shop', 'dev.invopos.shop', 'invopos.shop'];

// In-memory slug cache for custom domains. Domains rarely change ownership,
// so a 60-minute TTL is plenty and keeps every page load from paying a
// roundtrip to /app/getSlugByDomain. Negative results are cached for 1
// minute so a typo'd / inactive domain doesn't hammer the backend.
const slugCache = new Map<string, { slug: string; expires: number }>();
const SLUG_TTL_MS = 60 * 60 * 1000;
const SLUG_NEGATIVE_TTL_MS = 60 * 1000;

/**
 * Async resolver used by the SSR meta-tag routes. Mirrors what the browser's
 * appServices.initializeApp does for custom domains:
 *   1. Config.subDomain override → use it (dev / on-prem)
 *   2. Numeric / IP host → no slug
 *   3. Wildcard host (`*.invopos.shop`) → first segment is the slug
 *   4. Custom domain → POST /app/getSlugByDomain (cached) to get the real slug
 *
 * getSubDomain (sync) stays in place for the proxy routers + /assets/config.json
 * which can't await; they continue to handle wildcard hosts only and the
 * browser falls back to its own getSlugByDomain when needed.
 */
async function resolveSlug(host: string): Promise<string> {
  if (Config.subDomain) return Config.subDomain;
  if (!host) return '';

  const lowerHost = host.toLowerCase().split(':')[0]; // drop port if present
  const fromHost = lowerHost.split('.')[0] || '';

  if (/^[\d.]+$/.test(fromHost) || /^[\d.]+$/.test(lowerHost)) return '';

  for (const root of SHOP_HOSTS) {
    if (lowerHost === root) return '';
    if (lowerHost.endsWith('.' + root)) {
      const candidate = lowerHost.slice(0, -('.' + root).length).split('.')[0];
      if (RESERVED_PREFIXES.includes(candidate)) return '';
      return candidate;
    }
  }

  // Custom domain path — backend lookup with cache.
  const cached = slugCache.get(lowerHost);
  if (cached && cached.expires > Date.now()) return cached.slug;

  try {
    const res = await fetch(`${Config.BASE_URL}/app/getSlugByDomain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Domain: lowerHost }),
      // Short timeout: this runs on every uncached page load. Keep it tight
      // so a slow backend can't itself become the source of a 5-30s SSR
      // hang (the original symptom on lvsbh.com).
      signal: AbortSignal.timeout(2000),
    });
    const json: any = await res.json().catch(() => null);
    const slug = json?.success && json.data?.slug ? String(json.data.slug) : '';
    slugCache.set(lowerHost, {
      slug,
      expires: Date.now() + (slug ? SLUG_TTL_MS : SLUG_NEGATIVE_TTL_MS),
    });
    return slug;
  } catch (error) {
    Logger.warn('resolveSlug failed', {
      host: lowerHost,
      message: (error as Error)?.message,
    });
    return '';
  }
}

// FIX: UUID v4 validation regex — rejects malformed/truncated IDs before they
// reach the database and cause "invalid input syntax for type uuid" errors.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// FIX: extract the end-visitor's IP/UA so we can forward it to the backend.
// The backend's ecommerceLimiter buckets by req.ip, but every SSR request
// comes from the SSR server's IP — so all visitors share one bucket and trip
// 429 quickly. Forwarding `x-end-user-ip` lets the limiter bucket per visitor.
function getVisitorContext(req: any) {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined) || '';
  const firstHop = fwd.split(',')[0]?.trim();
  return {
    ip: firstHop || req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
  };
}

// Link-preview bots: they DO render Open Graph tags, so they need the
// meta-tag fetch to run. WhatsApp, Facebook, Slack, etc. all hit the
// origin to scrape og:title / og:image when a user shares a link.
// SEO crawlers (Googlebot, Bingbot) also benefit from server-rendered
// meta — keep them on the allowlist too.
const LINK_PREVIEW_UA_RE =
  /facebookexternalhit|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|googlebot|bingbot|yandex|duckduckbot|baiduspider|applebot|skypeuripreview/i;

// Generic monitoring / scraping bots that don't render OG tags. Matching
// these lets the meta-tag routes skip their upstream API fetch entirely
// (UptimeRobot pings would otherwise spam getCompanyPrefrences across
// every wildcard domain every few minutes, exhausting the backend rate
// limiter and producing "Too Many Requests" log noise).
const SKIP_UA_RE =
  /bot\b|crawl|spider|uptimerobot|pingdom|monitoring|healthcheck|ahrefs|semrush|petalbot|mj12bot|dotbot|gptbot|claudebot/i;

function shouldSkipMetaFetch(req: any): boolean {
  if (req.method === 'HEAD') return true;
  const ua = (req.headers['user-agent'] as string | undefined) || '';
  if (!ua) return false;
  // Allowlist wins: even though FB/Slack/etc. UAs may also match SKIP_UA_RE
  // via the generic `bot\b` token, link-preview bots get the full SSR with
  // meta tags so previews render correctly.
  if (LINK_PREVIEW_UA_RE.test(ua)) return false;
  return SKIP_UA_RE.test(ua);
}

/* ----------------------- Static file serving ----------------------- */
/**
 * Serve hashed asset files with long cache.
 * Important: static middleware must come BEFORE SSR handler,
 * so requests like /main-XXXX.js do NOT fall through to SSR (which would return HTML).
 */

// Explicit route for common static extensions (extra safety)
app.get(
  /\.(?:js|mjs|css|map|ico|png|jpg|jpeg|webp|svg|gif|woff2?|ttf|otf)$/i,
  express.static(browserDistFolder, {
    maxAge: '1y',
    immutable: true,
    index: false,
    redirect: false,
  })
);

// General static (covers /assets/** etc.)
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

/* ----------------------- Health check ----------------------- */
// FIX: Explicit health-check endpoint added BEFORE all other routes.
// This prevents ALB/ELB health-check pings (which use internal IPs as Host)
// from falling through to SSR/meta-tag logic and triggering "Company Not Found".
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

/* --------------------- Dynamic runtime config ---------------------- */

app.get('/assets/config.json', (req, res) => {
  const host = (req.headers.host || '').toString();
  const subdomain = getSubDomain(host);
  res.json({ subdomain });
});

/* ------------------------ Log relay endpoint ----------------------- */
// Browser LoggerService POSTs here. The server forwards the payload to the
// upstream ingest endpoint via the SSR Logger (which holds the project key).
// Mount express.json() only for this route so the proxy middlewares below
// keep receiving the raw body for forwarding.
app.post(
  '/api/log',
  express.json({ limit: '64kb' }),
  (req, res) => {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const forwardedFor =
      (req.headers['x-forwarded-for'] as string | undefined) || req.ip;

    Logger.ingest(payload, {
      forwardedFor,
      userAgent: req.headers['user-agent'],
      host: req.headers.host,
      referer: req.headers['referer'],
    });

    res.status(204).end();
  }
);

/* ---------------------- for open graph - Product ---------------------- */

app.get('*/product/:id', async (req: any, res: any, next: any) => {
  // Skip the upstream meta-tag fetch entirely for HEAD probes and generic
  // monitoring bots — they don't render Open Graph tags. See shouldSkipMetaFetch.
  if (shouldSkipMetaFetch(req)) return next();

  const productId = req.params.id;
  if (!productId) {
    return res.status(400).send('Product ID is required');
  }

  // FIX: Validate UUID format before hitting the API. Malformed or truncated
  // UUIDs (e.g. from bots or bad links) cause Postgres "invalid input syntax
  // for type uuid" errors. Fall through to Angular CSR instead of erroring.
  if (!UUID_REGEX.test(productId)) {
    console.warn('[product] Invalid UUID format, skipping SSR meta-tag fetch:', productId);
    return next();
  }

  const host = (req.headers.host || '').toString();
  const sub = await resolveSlug(host);

  // FIX: Bail out early if subdomain could not be resolved — avoids sending
  // a malformed URL like /ecommerce//shop/getProduct to the API.
  if (!sub) {
    console.warn('[product] No subdomain resolved — skipping SSR meta-tag fetch');
    return next();
  }

  const apiUrl = `${Config.BASE_URL}/ecommerce/${sub}/shop/getProduct`;
  try {
    const metaTags = await generateMetaTags(productId, apiUrl, req.headers['referer'], getVisitorContext(req));
    const response = await angularApp.handle(req);
    if (!response) {
      return next();
    }

    const html = await response.text();
    const modifiedHtml = html.replace('<meta name="meta-tags">', metaTags || '');

    // FIX: When the upstream API has no product for this id, return HTTP 404
    // (good for crawlers/SEO) but still render Angular so the user sees the
    // styled not-found UI rather than plain text.
    if (!metaTags) {
      res.status(404);
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(modifiedHtml);
  } catch (error) {
    Logger.error(error, { route: 'product', productId });
    // FIX: Fall through to Angular SSR/CSR for ANY upstream failure (wrong
    // subdomain, company inactive, API down, etc.). Calling next(error) here
    // would surface the upstream error as a 500 "Internal Server Error" via
    // the global handler, which is the wrong UX — Angular has its own
    // no-connection / not-found UI that should render instead.
    return next();
  }
});

/* ---------------------- for open graph - Page by slug ---------------------- */

app.get('/:slug', async (req: any, res: any, next: any) => {
  // Skip upstream fetch for HEAD probes / monitoring bots (see /product/:id).
  if (shouldSkipMetaFetch(req)) return next();

  const slug = req.params.slug;
  if (!slug || slug === 'null' || slug === 'undefined' || slug.includes('.')) {
    return next();
  }

  const host = (req.headers.host || '').toString();
  const sub = await resolveSlug(host);

  // FIX: Bail out early if subdomain could not be resolved — avoids sending
  // a malformed URL like /ecommerce//theme/getPage/slug to the API.
  if (!sub) {
    console.warn('[slug] No subdomain resolved — skipping SSR meta-tag fetch');
    return next();
  }

  const apiUrl = `${Config.BASE_URL}/ecommerce/${sub}`;

  try {
    const metaTags = await generatePageMetaTags(apiUrl, slug, req.headers['referer'], getVisitorContext(req));
    const response = await angularApp.handle(req);
    if (!response) {
      return next();
    }

    const html = await response.text();
    const modifiedHtml = html.replace('<meta name="meta-tags">', metaTags || '');

    // FIX: When the upstream API has no page for this slug, return HTTP 404
    // (good for crawlers/SEO) but still render Angular so the user sees the
    // styled not-found UI rather than a plain 404.
    if (!metaTags) {
      res.status(404);
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(modifiedHtml);
  } catch (error) {
    Logger.error(error, { route: 'page', slug });
    // FIX: see /product handler — fall through to Angular for any upstream error.
    return next();
  }
});

/* ---------------------- for open graph - Home/Index ---------------------- */

app.get('', async (req: any, res: any, next: any) => {
  // Skip upstream fetch for HEAD probes / monitoring bots (see /product/:id).
  // This is the route UptimeRobot hits — without this guard, every 5-minute
  // ping was burning the backend's rate-limit bucket and producing
  // "Too Many Requests" log noise.
  if (shouldSkipMetaFetch(req)) return next();

  const host = (req.headers.host || '').toString();
  const sub = await resolveSlug(host);

  // FIX: Bail out early if subdomain could not be resolved — avoids sending
  // a malformed URL like /ecommerce//getCompanyPrefrences to the API,
  // which was causing the "Company Not Found" uncaughtException.
  if (!sub) {
    console.warn('[home] No subdomain resolved — skipping SSR meta-tag fetch');
    return next();
  }

  const apiUrl = `${Config.BASE_URL}/ecommerce/${sub}`;
  try {
    const metaTags = await generateCompanyMetaTags(apiUrl, req.headers['referer'], getVisitorContext(req));
    if (!metaTags) {
      return next();
    }
    const response = await angularApp.handle(req);
    if (!response) {
      return next();
    }

    const html = await response.text();
    const modifiedHtml = html.replace('<meta name="meta-tags">', metaTags);

    res.setHeader('Content-Type', 'text/html');
    res.send(modifiedHtml);
  } catch (error) {
    Logger.error(error, { route: 'home' });
    // FIX: see /product handler — fall through to Angular for any upstream error.
    return next();
  }
});

/* --------------------------- Proxy routes -------------------------- */
/**
 * NOTE: We use router() to dynamically decide the target using subdomain.
 * Ensure BASE_URL is something like https://api.example.com or similar.
 */

// FIX: Forward the end-visitor's IP/UA on every proxied request so the backend's
// rate limiter (ecommerceLimiter) buckets per visitor instead of per SSR-server
// IP. Without this, every browser-side /v1/* call routes through the SSR's IP
// and the whole user base shares one 100 req/min bucket → spurious 429s.
const forwardVisitorHeaders = (proxyReq: any, req: any) => {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined) || '';
  const firstHop = fwd.split(',')[0]?.trim();
  const endUserIp = firstHop || req.ip;
  if (endUserIp) {
    proxyReq.setHeader('x-end-user-ip', endUserIp);
  }
  const ua = req.headers['user-agent'];
  if (ua) {
    proxyReq.setHeader('x-end-user-agent', ua);
  }
};

app.use(
  '/server/assets',
  createProxyMiddleware({
    router: (req) => {
      const host = (req.headers.host || '').toString();
      const sub = getSubDomain(host);
      const target = `${Config.BASE_URL}/ecommerce/${sub}`;
      console.log('[proxy:/server/assets] ->', target);
      return target;
    },
    changeOrigin: true,
    pathRewrite: (path) => path, // no-op
    on: { proxyReq: forwardVisitorHeaders },
  })
);

app.use(
  '/server/images',
  createProxyMiddleware({
    router: (req) => {
      const host = (req.headers.host || '').toString();
      const sub = getSubDomain(host);
      const target = `${Config.BASE_URL}/ecommerce/${sub}/images`;
      return target;
    },
    changeOrigin: true,
    pathRewrite: (path) => path, // no-op
    on: { proxyReq: forwardVisitorHeaders },
  })
);

app.use(
  '/v1',
  createProxyMiddleware({
    router: () => {
      const target = Config.BASE_URL;
      return target;
    },
    changeOrigin: true,
    pathRewrite: (path) => path, // no-op
    on: { proxyReq: forwardVisitorHeaders },
  })
);

/* ------------------------------ SSR ------------------------------- */
/**
 * All remaining requests go through Angular SSR.
 * This must come AFTER static and proxy middlewares.
 */
app.use('/*', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch(next);
});

/* --------------------------- Error handler ------------------------- */

app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    Logger.error(err, { source: 'express-error-handler' });
    res.status(500).send('Internal Server Error');
  }
);

/* ---------------------------- Bootstrap ---------------------------- */

if (isMainModule(import.meta.url)) {
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
    console.log('Serving browser dist from:', browserDistFolder);
  });
}

/**
 * The request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createNodeRequestHandler(app);