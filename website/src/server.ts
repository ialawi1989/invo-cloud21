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
import {
  generateCompanyMetaTags,
  generateMetaTags,
  generatePageMetaTags,
} from './app/services/generateMetaTags.service';
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
  // FIX: Strip trailing slash from BASE_URL to prevent double-slash in assembled URLs.
  BASE_URL: (process.env['BASE_URL']?.trim() || '').replace(/\/$/, ''),
  websocketIP: process.env['websocketIP']?.trim() || '',
  domain: process.env['domain']?.trim() || '',
  subDomain: process.env['subDomain']?.trim() || '',
  /** Origin the dashboard customizer iframe lives on. We use this to
   *  set frame-ancestors so the dashboard can embed '/' as a preview. */
  dashboardOrigin: process.env['DASHBOARD_ORIGIN']?.trim() || '',
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

/* ------------------ Customizer iframe embedding ------------------- */
// The dashboard loads "/?customize=true" inside an <iframe>. Some
// hosting setups (CloudFront, Helmet defaults, etc.) inject
// X-Frame-Options: DENY which breaks the embed. Explicitly allow
// framing on the preview entry. Other paths fall through with no
// frame-options header (or whatever upstream sets).
app.use((req, res, next) => {
  if (req.query['customize'] === 'true') {
    res.removeHeader('X-Frame-Options');
    if (Config.dashboardOrigin) {
      res.setHeader(
        'Content-Security-Policy',
        `frame-ancestors 'self' ${Config.dashboardOrigin}`
      );
    } else {
      res.setHeader('Content-Security-Policy', `frame-ancestors *`);
    }
  }
  next();
});

/* ----------------- Runtime-config HTML injector ------------------- */
// Replace `<meta name="runtime-config">` in any HTML response with an
// inline <script> that seeds window.__DASHBOARD_ORIGIN__ + friends
// BEFORE the bundle runs. environment.ts and PreviewService pick
// those up synchronously, so the postMessage allowlist is correct on
// first paint without waiting for /assets/config.json.
function escapeForScriptTag(s: string): string {
  // Defense in depth: forbid '</' inside an inline <script>. Config
  // values come from process.env so this is paranoia, not a real
  // attack surface — but cheap.
  return String(s).replace(/</g, '\\u003c');
}

function buildRuntimeConfigScript(subdomain: string): string {
  const payload = {
    subdomain,
    dashboardOrigin: Config.dashboardOrigin || null,
  };
  const dashboardOrigin = Config.dashboardOrigin || '';
  const allowedOrigins: string[] = dashboardOrigin ? [dashboardOrigin] : [];

  // Inline script: keep it short and synchronous so it executes
  // before main.js. No external resources fetched.
  return (
    `<script>` +
    `window.__APP_CONFIG__=${escapeForScriptTag(JSON.stringify(payload))};` +
    `window.__DASHBOARD_ORIGIN__="${escapeForScriptTag(dashboardOrigin)}";` +
    `window.__CUSTOMIZER_ORIGINS__=${escapeForScriptTag(JSON.stringify(allowedOrigins))};` +
    `</script>`
  );
}

function injectRuntimeConfig(html: string, subdomain: string): string {
  if (!html.includes('<meta name="runtime-config">')) return html;
  return html.replace(
    '<meta name="runtime-config">',
    buildRuntimeConfigScript(subdomain),
  );
}

/* ------------------------ Logger middleware ----------------------- */
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

// Reserved hostname prefixes (www, dev, etc.) are NOT company slugs.
const RESERVED_PREFIXES = ['www', 'dev', 'test', 'staging', 'preprod', 'uat', 'qa', 'demo'];

function getSubDomain(host: string): string {
  let subdomain = Config.subDomain;
  if (!subdomain) {
    const parts = (host || '').split('.');
    const fromHost = parts[0] || '';

    const isNumericOrIp =
      /^[\d.]+$/.test(fromHost) || /^[\d.]+$/.test(host);

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
// list more specific roots BEFORE more general ones.
const SHOP_HOSTS = ['test.invopos.shop', 'dev.invopos.shop', 'invopos.shop'];

// In-memory slug cache for custom domains.
const slugCache = new Map<string, { slug: string; expires: number }>();
const SLUG_TTL_MS = 60 * 60 * 1000;
const SLUG_NEGATIVE_TTL_MS = 60 * 1000;

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

// UUID v4 validation regex.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// First-path segments that are framework routes, NOT storefront page slugs.
// The `/:slug` Open-Graph handler must skip these so it never treats them as
// pages: it would (a) log a spurious "No page data found", (b) force a 404 on a
// perfectly good route, and (c) swallow Angular's redirect response (e.g. the
// subdirectory-mode `/blog` → `/:lang/blog` 302). The blog injects its own SSR
// Open-Graph tags via BlogSeoService, so it needs no help from this handler.
const RESERVED_SLUGS = new Set(['blog']);

function getVisitorContext(req: any) {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined) || '';
  const firstHop = fwd.split(',')[0]?.trim();
  return {
    ip: firstHop || req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
  };
}

const LINK_PREVIEW_UA_RE =
  /facebookexternalhit|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|googlebot|bingbot|yandex|duckduckbot|baiduspider|applebot|skypeuripreview/i;

const SKIP_UA_RE =
  /bot\b|crawl|spider|uptimerobot|pingdom|monitoring|healthcheck|ahrefs|semrush|petalbot|mj12bot|dotbot|gptbot|claudebot/i;

function shouldSkipMetaFetch(req: any): boolean {
  if (req.method === 'HEAD') return true;
  const ua = (req.headers['user-agent'] as string | undefined) || '';
  if (!ua) return false;
  if (LINK_PREVIEW_UA_RE.test(ua)) return false;
  return SKIP_UA_RE.test(ua);
}

/**
 * Dashboard customizer guard.
 *
 * The dashboard embeds the website at "/?customize=true" inside an
 * iframe. The customizer never has a real merchant slug to resolve,
 * the preview is meant to render the in-memory page data the
 * dashboard posts via window.postMessage. We MUST NOT call the
 * upstream meta-tag API in this mode — there is no company yet, and
 * the call would either 404 or hang waiting on an unknown slug. Also
 * skip when the request is a navigation INSIDE the customizer iframe
 * (Sec-Fetch-Dest=iframe + Sec-Fetch-Site=cross-site) so the
 * customizer route never accidentally pays the upstream cost.
 */
function isCustomizerRequest(req: any): boolean {
  if (req.query?.customize === 'true') return true;
  if (req.headers['x-customizer-preview'] === 'true') return true;
  return false;
}

/* ----------------------- Static file serving ----------------------- */
// Static middleware must come BEFORE SSR handler so requests like
// /main-XXXX.js do NOT fall through to SSR (which would return HTML).

app.get(
  /\.(?:js|mjs|css|map|ico|png|jpg|jpeg|webp|svg|gif|woff2?|ttf|otf)$/i,
  express.static(browserDistFolder, {
    maxAge: '1y',
    immutable: true,
    index: false,
    redirect: false,
  })
);

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

/* ----------------------- Health check ----------------------- */
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

/* --------------------- Dynamic runtime config ---------------------- */
// Browser bundle bootstraps from this endpoint (via APP_CONFIG). It
// also carries the dashboard origin so the customizer postMessage
// allowlist can be configured per-deployment without a rebuild.
app.get('/assets/config.json', (req, res) => {
  const host = (req.headers.host || '').toString();
  const subdomain = getSubDomain(host);
  res.json({
    subdomain,
    dashboardOrigin: Config.dashboardOrigin || null,
  });
});

/* ------------------------ Log relay endpoint ----------------------- */
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

/* ---------------------- Open Graph - Product ---------------------- */

app.get('*/product/:id', async (req: any, res: any, next: any) => {
  if (shouldSkipMetaFetch(req)) return next();
  // Customizer iframe — no slug, no API. Fall through to Angular CSR.
  if (isCustomizerRequest(req)) return next();

  const productId = req.params.id;
  if (!productId) {
    return res.status(400).send('Product ID is required');
  }

  if (!UUID_REGEX.test(productId)) {
    console.warn('[product] Invalid UUID format, skipping SSR meta-tag fetch:', productId);
    return next();
  }

  const host = (req.headers.host || '').toString();
  const sub = await resolveSlug(host);

  if (!sub) {
    console.warn('[product] No subdomain resolved — skipping SSR meta-tag fetch');
    return next();
  }

  const apiUrl = `${Config.BASE_URL}/ecommerce/${sub}/shop/getProduct`;
  try {
    const metaTags = await generateMetaTags(productId, apiUrl, req.headers['referer'], getVisitorContext(req));
    const response = await angularApp.handle(req);
    if (!response) return next();

    let html = await response.text();
    html = html.replace('<meta name="meta-tags">', metaTags || '');
    html = injectRuntimeConfig(html, sub);

    if (!metaTags) res.status(404);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    Logger.error(error, { route: 'product', productId });
    return next();
  }
});

/* ---------------------- Open Graph - Page by slug ---------------------- */

app.get('/:slug', async (req: any, res: any, next: any) => {
  if (shouldSkipMetaFetch(req)) return next();
  if (isCustomizerRequest(req)) return next();

  const slug = req.params.slug;
  if (!slug || slug === 'null' || slug === 'undefined' || slug.includes('.')) {
    return next();
  }
  // Framework routes (blog, …) aren't storefront pages — hand them to the
  // generic SSR handler, which passes redirects through and never forces 404.
  if (RESERVED_SLUGS.has(slug.toLowerCase())) {
    return next();
  }

  const host = (req.headers.host || '').toString();
  const sub = await resolveSlug(host);

  if (!sub) {
    console.warn('[slug] No subdomain resolved — skipping SSR meta-tag fetch');
    return next();
  }

  const apiUrl = `${Config.BASE_URL}/ecommerce/${sub}`;

  try {
    const metaTags = await generatePageMetaTags(apiUrl, slug, req.headers['referer'], getVisitorContext(req));
    const response = await angularApp.handle(req);
    if (!response) return next();

    let html = await response.text();
    html = html.replace('<meta name="meta-tags">', metaTags || '');
    html = injectRuntimeConfig(html, sub);

    if (!metaTags) res.status(404);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    Logger.error(error, { route: 'page', slug });
    return next();
  }
});

/* ---------------------- Open Graph - Home/Index ---------------------- */

app.get('', async (req: any, res: any, next: any) => {
  if (shouldSkipMetaFetch(req)) return next();
  // CRITICAL: the dashboard customizer loads '/' as '?customize=true'
  // inside an iframe. If we run the upstream meta-tag fetch here it
  // will either 404 (no company) or block the iframe load on a slow
  // backend. Always fall through to Angular for the customizer.
  if (isCustomizerRequest(req)) return next();

  const host = (req.headers.host || '').toString();
  const sub = await resolveSlug(host);

  if (!sub) {
    console.warn('[home] No subdomain resolved — skipping SSR meta-tag fetch');
    return next();
  }

  const apiUrl = `${Config.BASE_URL}/ecommerce/${sub}`;
  try {
    const metaTags = await generateCompanyMetaTags(apiUrl, req.headers['referer'], getVisitorContext(req));
    if (!metaTags) return next();
    const response = await angularApp.handle(req);
    if (!response) return next();

    let html = await response.text();
    html = html.replace('<meta name="meta-tags">', metaTags);
    html = injectRuntimeConfig(html, sub);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    Logger.error(error, { route: 'home' });
    return next();
  }
});

/* --------------------------- Proxy routes -------------------------- */

const forwardVisitorHeaders = (proxyReq: any, req: any) => {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined) || '';
  const firstHop = fwd.split(',')[0]?.trim();
  const endUserIp = firstHop || req.ip;
  if (endUserIp) proxyReq.setHeader('x-end-user-ip', endUserIp);
  const ua = req.headers['user-agent'];
  if (ua) proxyReq.setHeader('x-end-user-agent', ua);
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
    pathRewrite: (path) => path,
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
    pathRewrite: (path) => path,
    on: { proxyReq: forwardVisitorHeaders },
  })
);

app.use(
  '/v1',
  createProxyMiddleware({
    router: () => Config.BASE_URL,
    changeOrigin: true,
    pathRewrite: (path) => path,
    on: { proxyReq: forwardVisitorHeaders },
  })
);

/* ------------------------------ SSR ------------------------------- */
// HTML responses are buffered so we can splice the runtime-config
// inline script (and clear the leftover meta-tags placeholder) on
// EVERY route — not just the OG-tagged ones. Non-HTML responses
// (rare from the SSR engine, but possible: redirects, JSON, etc.)
// stream through unchanged via writeResponseToNodeResponse.
app.use('/*', async (req: any, res, next) => {
  try {
    const response = await angularApp.handle(req);
    if (!response) return next();

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return writeResponseToNodeResponse(response, res);
    }

    const host = (req.headers.host || '').toString();
    const sub = isCustomizerRequest(req) ? '' : await resolveSlug(host);

    let html = await response.text();
    // Clear any leftover meta-tags placeholder (only the OG-aware
    // handlers above fill it; the rest leave it as plain text).
    html = html.replace('<meta name="meta-tags">', '');
    html = injectRuntimeConfig(html, sub);

    // Mirror the upstream response's headers so things like Set-Cookie
    // from middleware still reach the client.
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-length') return;
      res.setHeader(key, value);
    });
    res.status(response.status);
    res.setHeader('Content-Type', contentType);
    res.send(html);
  } catch (err) {
    next(err);
  }
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
  const port = Number(process.env['PORT'] || 4000);
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
    console.log('Serving browser dist from:', browserDistFolder);
  });
}

export const reqHandler = createNodeRequestHandler(app);
