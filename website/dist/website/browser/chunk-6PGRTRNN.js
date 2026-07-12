import {
  DOCUMENT,
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
  Injectable,
  InjectionToken,
  NavigationEnd,
  PLATFORM_ID,
  Router,
  __async,
  __spreadValues,
  computed,
  filter,
  firstValueFrom,
  inject,
  isPlatformBrowser,
  setClassMetadata,
  signal,
  ɵɵdefineInjectable
} from "./chunk-VBJDAOBI.js";

// src/environments/environment.ts
var PROD_DASHBOARD_URL = "";
var DEV_DASHBOARD_URL = "http://localhost:4700";
var PROD_API_BASE = "";
var DEV_API_PORT = 3001;
function isProdHost() {
  if (typeof window === "undefined" || !window.location)
    return false;
  const host = window.location.hostname;
  if (!host)
    return false;
  if (host === "localhost" || host === "127.0.0.1")
    return false;
  if (/^10\./.test(host))
    return false;
  if (/^192\.168\./.test(host))
    return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host))
    return false;
  return true;
}
function resolveApiBase(prod) {
  if (typeof window !== "undefined") {
    const injected = window.__BLOG_API_BASE__;
    if (typeof injected === "string" && injected.length)
      return injected;
  }
  if (prod)
    return PROD_API_BASE;
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${DEV_API_PORT}`;
  }
  return `http://localhost:${DEV_API_PORT}`;
}
function resolveSiteOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}
function resolveDashboardUrl(prod) {
  if (typeof window !== "undefined") {
    const injected = window.__DASHBOARD_ORIGIN__;
    if (typeof injected === "string" && injected.length)
      return injected;
  }
  return prod ? PROD_DASHBOARD_URL : DEV_DASHBOARD_URL;
}
function resolveCustomizerAllowlist(prod) {
  const fromWindow = typeof window !== "undefined" ? window.__CUSTOMIZER_ORIGINS__ : void 0;
  if (Array.isArray(fromWindow)) {
    return fromWindow.filter((o) => typeof o === "string" && o.length > 0);
  }
  return prod ? [] : ["http://localhost:4700"];
}
var isProd = isProdHost();
var environment = {
  production: isProd,
  // ── Backend (proxied through Express SSR layer) ──────────────────
  // Browser code talks to `./v1/...` and the SSR layer proxies to
  // `${process.env.BASE_URL}`. `BASE_URL` here is intentionally
  // relative so the same bundle works on every tenant origin
  // (`*.invopos.shop`, custom domain, dev, etc.).
  BASE_URL: "./v1",
  websocketIP: "./v1",
  PORT: 4e3,
  // ── Customizer (dashboard ⇄ iframe postMessage) ──────────────────
  // PreviewService accepts any of: this value, anything in
  // `customizerOriginsAllowed`, or the page's own origin.
  dashboardUrl: resolveDashboardUrl(isProd),
  customizerOriginsAllowed: resolveCustomizerAllowlist(isProd),
  // ── Blog feature (separate API base) ─────────────────────────────
  apiBase: resolveApiBase(isProd),
  siteOrigin: resolveSiteOrigin(),
  /** Last-resort fallback for the storefront name in <title> templates and the
   *  blog header. The real value is the ecommerce store's name from
   *  getSettings (`settings.siteName`); this only shows if the backend doesn't
   *  send one. Kept generic — NOT "Blog", since this is the whole storefront. */
  siteName: "Store",
  /** Dev-only tenant fallback. On localhost / LAN IPs the slug can't be
   *  derived from the host, so TenantService uses this (after `?tenant=` and
   *  localStorage). Mirrors oldEco's `Config.subDomain` dev override; ignored
   *  on real subdomains / custom domains. Set to your dev merchant slug. */
  devTenant: "shussain"
};

// src/app/models/settings.model.ts
var DEFAULT_GLOBAL_SETTINGS = {
  headerBgColor: "#ffffff",
  headerTextColor: "#1f2937",
  bodyBgColor: "#ffffff",
  bodyTextColor: "#374151",
  primaryColor: "#6366f1",
  secondaryColor: "#8b5cf6",
  accentColor: "#06b6d4",
  fontFamily: "Inter",
  headingFontFamily: "Inter",
  baseFontSize: 16,
  headingFontSize: 48,
  lineHeight: 1.6,
  fontWeight: 400,
  containerWidth: 1200,
  headerHeight: 70,
  sectionPadding: 80,
  borderRadius: 12,
  siteTitle: "My Website",
  siteTagline: "Building amazing experiences",
  footerText: "\xA9 2024 My Website. All rights reserved.",
  showHeader: true,
  showFooter: true,
  stickyHeader: true
};
var COMPONENT_NAMES = {
  "hero": "Hero Section",
  "features": "Features Grid",
  "testimonials": "Testimonials",
  "cta": "Call to Action",
  "pricing": "Pricing",
  "gallery": "Image Gallery",
  "faq": "FAQ",
  "contact": "Contact",
  "stats": "Stats",
  "team": "Team",
  "newsletter": "Newsletter",
  "blog": "Blog Posts"
};

// src/app/services/preview.service.ts
var PreviewService = class _PreviewService {
  constructor() {
    this.isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    this.allowedOrigins = /* @__PURE__ */ new Set();
    this.allowAnyOrigin = false;
    this._isCustomizeMode = signal(false, ...ngDevMode ? [{ debugName: "_isCustomizeMode" }] : (
      /* istanbul ignore next */
      []
    ));
    this._globalSettings = signal(__spreadValues({}, DEFAULT_GLOBAL_SETTINGS), ...ngDevMode ? [{ debugName: "_globalSettings" }] : (
      /* istanbul ignore next */
      []
    ));
    this._components = signal([], ...ngDevMode ? [{ debugName: "_components" }] : (
      /* istanbul ignore next */
      []
    ));
    this._navigation = signal(null, ...ngDevMode ? [{ debugName: "_navigation" }] : (
      /* istanbul ignore next */
      []
    ));
    this.isCustomizeMode = computed(() => this._isCustomizeMode(), ...ngDevMode ? [{ debugName: "isCustomizeMode" }] : (
      /* istanbul ignore next */
      []
    ));
    this.globalSettings = computed(() => this._globalSettings(), ...ngDevMode ? [{ debugName: "globalSettings" }] : (
      /* istanbul ignore next */
      []
    ));
    this.components = computed(() => this._components(), ...ngDevMode ? [{ debugName: "components" }] : (
      /* istanbul ignore next */
      []
    ));
    this.navigation = computed(() => this._navigation(), ...ngDevMode ? [{ debugName: "navigation" }] : (
      /* istanbul ignore next */
      []
    ));
    this.init();
  }
  init() {
    if (!this.isBrowser)
      return;
    const urlParams = new URLSearchParams(window.location.search);
    const customizeMode = urlParams.get("customize") === "true";
    if (!customizeMode)
      return;
    this.resolveAllowedOrigins();
    this._isCustomizeMode.set(true);
    document.body.classList.add("customize-mode");
    this.setupMessageListener();
    setTimeout(() => this.notifyReady(), 100);
  }
  resolveAllowedOrigins() {
    const origins = /* @__PURE__ */ new Set();
    const add = (o) => {
      if (typeof o !== "string")
        return;
      const trimmed = o.trim();
      if (!trimmed)
        return;
      origins.add(trimmed);
    };
    add(environment.dashboardUrl);
    (environment.customizerOriginsAllowed || []).forEach(add);
    const w = window;
    add(w.__DASHBOARD_ORIGIN__);
    if (Array.isArray(w.__CUSTOMIZER_ORIGINS__)) {
      w.__CUSTOMIZER_ORIGINS__.forEach(add);
    }
    add(w.__APP_CONFIG__?.dashboardOrigin);
    if (window.location?.origin)
      origins.add(window.location.origin);
    this.allowedOrigins = origins;
    const meaningful = [...origins].filter((o) => o !== window.location?.origin);
    if (meaningful.length === 0) {
      this.allowAnyOrigin = true;
      console.warn("[PreviewService] No dashboard origin configured \u2014 accepting postMessage from any origin. Set DASHBOARD_ORIGIN in the SSR env or window.__DASHBOARD_ORIGIN__ to lock this down.");
    } else {
      console.info("[PreviewService] Allowed customizer origins:", [...origins]);
    }
  }
  isOriginAllowed(origin) {
    if (this.allowAnyOrigin)
      return true;
    return this.allowedOrigins.has(origin);
  }
  /** Pick a concrete origin to use as postMessage's targetOrigin.
   *  Prefers anything other than the page's own origin (because the
   *  iframe needs to message its PARENT, which is the dashboard).
   *  Returns '*' as a last resort. */
  targetOriginForParent() {
    if (this.allowAnyOrigin)
      return "*";
    const myOrigin = window.location?.origin;
    for (const o of this.allowedOrigins) {
      if (o !== myOrigin)
        return o;
    }
    return "*";
  }
  setupMessageListener() {
    window.addEventListener("message", (event) => {
      if (!this.isOriginAllowed(event.origin))
        return;
      this.handleMessage(event.data);
    });
  }
  handleMessage(data) {
    switch (data.type) {
      case "page-data":
        if (data.pageData) {
          this.applyPageData(data.pageData);
        }
        if (data.navigation)
          this._navigation.set(data.navigation);
        break;
      case "sync-all":
        if (data.settings) {
          this.applyGlobalSettings(data.settings);
        }
        break;
      case "scroll-to-component":
        if (data.componentId) {
          this.scrollToComponent(data.componentId);
        }
        break;
      case "navigation":
        if (data.navigation)
          this._navigation.set(data.navigation);
        break;
      case "reset":
        this.applyPageData({
          globalSettings: DEFAULT_GLOBAL_SETTINGS,
          components: []
        });
        this._navigation.set(null);
        break;
    }
  }
  scrollToComponent(componentId) {
    const element = document.querySelector(`[data-component-id="${componentId}"]`);
    if (element) {
      document.querySelectorAll(".component-highlight").forEach((el) => {
        el.classList.remove("component-highlight");
      });
      element.classList.add("component-highlight");
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        element.classList.remove("component-highlight");
      }, 2e3);
    }
  }
  applyPageData(pageData) {
    this._globalSettings.set(__spreadValues({}, pageData.globalSettings));
    this._components.set([...pageData.components]);
    this.applyGlobalSettings(pageData.globalSettings);
  }
  applyGlobalSettings(settings) {
    const root = document.documentElement;
    root.style.setProperty("--header-bg", settings.headerBgColor);
    root.style.setProperty("--header-text", settings.headerTextColor);
    root.style.setProperty("--body-bg", settings.bodyBgColor);
    root.style.setProperty("--body-text", settings.bodyTextColor);
    root.style.setProperty("--primary", settings.primaryColor);
    root.style.setProperty("--secondary", settings.secondaryColor);
    root.style.setProperty("--accent", settings.accentColor);
    root.style.setProperty("--font-family", `'${settings.fontFamily}', sans-serif`);
    root.style.setProperty("--heading-font", `'${settings.headingFontFamily}', sans-serif`);
    root.style.setProperty("--base-font-size", `${settings.baseFontSize}px`);
    root.style.setProperty("--heading-font-size", `${settings.headingFontSize}px`);
    root.style.setProperty("--line-height", settings.lineHeight.toString());
    root.style.setProperty("--font-weight", settings.fontWeight.toString());
    root.style.setProperty("--container-width", `${settings.containerWidth}px`);
    root.style.setProperty("--header-height", `${settings.headerHeight}px`);
    root.style.setProperty("--section-padding", `${settings.sectionPadding}px`);
    root.style.setProperty("--border-radius", `${settings.borderRadius}px`);
  }
  notifyReady() {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "preview-ready" }, this.targetOriginForParent());
    }
  }
  static {
    this.\u0275fac = function PreviewService_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _PreviewService)();
    };
  }
  static {
    this.\u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _PreviewService, factory: _PreviewService.\u0275fac, providedIn: "root" });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PreviewService, [{
    type: Injectable,
    args: [{
      providedIn: "root"
    }]
  }], () => [], null);
})();

// src/app/features/blog/models/blog-settings.types.ts
var FEED_LAYOUTS = [
  "grid",
  "list",
  "masonry",
  "magazine",
  "sideBySide",
  "editorial"
];
function defaultPublicBlogSettings() {
  return {
    languages: { default: "en", supported: ["en"], rtlLanguages: ["ar"], autoSwitch: false, urlStructure: "subdirectory" },
    layouts: { feed: "grid", categoryFeed: "list" },
    display: {
      postsPerPage: 12,
      showAuthor: true,
      showDate: true,
      showReadingTime: true,
      showCategoryLabel: true,
      showTags: true,
      showHashtags: true,
      showSocialShare: true,
      showRelatedPosts: true,
      showCommentCount: true
    },
    comments: { enabled: true, allowReplies: true, maxDepth: 3, requireShopperLogin: true },
    rss: { enabled: true, itemsCount: 20 },
    mobile: { overrideDesktop: false, feedLayout: "list", showCategoryMenu: true },
    tracking: { clicksEnabled: false },
    seo: { titleTemplate: "{postTitle} | {siteName}" }
  };
}
function coerceLayout(v, fallback) {
  return FEED_LAYOUTS.includes(v) ? v : fallback;
}
function normalizePublicBlogSettings(raw) {
  const d = defaultPublicBlogSettings();
  if (!raw || typeof raw !== "object")
    return d;
  return {
    languages: {
      default: String(raw.languages?.default ?? d.languages.default),
      supported: Array.isArray(raw.languages?.supported) && raw.languages.supported.length ? raw.languages.supported.map(String) : d.languages.supported,
      rtlLanguages: Array.isArray(raw.languages?.rtlLanguages) ? raw.languages.rtlLanguages.map(String) : d.languages.rtlLanguages,
      autoSwitch: raw.languages?.autoSwitch === true,
      urlStructure: ["subdirectory", "subdomain", "parameter"].includes(raw.languages?.urlStructure) ? raw.languages.urlStructure : d.languages.urlStructure
    },
    layouts: {
      feed: coerceLayout(raw.layouts?.feed, d.layouts.feed),
      categoryFeed: coerceLayout(raw.layouts?.categoryFeed, d.layouts.categoryFeed)
    },
    display: {
      postsPerPage: Math.max(1, Number(raw.display?.postsPerPage ?? d.display.postsPerPage)) || d.display.postsPerPage,
      showAuthor: raw.display?.showAuthor !== false,
      showDate: raw.display?.showDate !== false,
      showReadingTime: raw.display?.showReadingTime !== false,
      showCategoryLabel: raw.display?.showCategoryLabel !== false,
      showTags: raw.display?.showTags !== false,
      showHashtags: raw.display?.showHashtags !== false,
      showSocialShare: raw.display?.showSocialShare !== false,
      showRelatedPosts: raw.display?.showRelatedPosts !== false,
      showCommentCount: raw.display?.showCommentCount !== false
    },
    comments: {
      enabled: raw.comments?.enabled !== false,
      allowReplies: raw.comments?.allowReplies !== false,
      maxDepth: Math.min(5, Math.max(1, Number(raw.comments?.maxDepth ?? d.comments.maxDepth) || d.comments.maxDepth)),
      requireShopperLogin: raw.comments?.requireShopperLogin !== false
    },
    rss: {
      enabled: raw.rss?.enabled !== false,
      itemsCount: raw.rss?.itemsCount != null ? Number(raw.rss.itemsCount) || void 0 : void 0,
      title: raw.rss?.title != null ? String(raw.rss.title) : void 0,
      description: raw.rss?.description != null ? String(raw.rss.description) : void 0
    },
    mobile: {
      overrideDesktop: !!raw.mobile?.overrideDesktop,
      feedLayout: coerceLayout(raw.mobile?.feedLayout, d.mobile.feedLayout),
      showCategoryMenu: raw.mobile?.showCategoryMenu !== false
    },
    tracking: {
      clicksEnabled: !!raw.tracking?.clicksEnabled,
      ga4MeasurementId: nonEmptyString(raw.tracking?.ga4MeasurementId),
      gscVerification: nonEmptyString(raw.tracking?.gscVerification),
      // Accept the clean camelCase keys, falling back to the raw plugin
      // setting keys the backend might surface verbatim.
      googleTagId: nonEmptyString(raw.tracking?.googleTagId) ?? nonEmptyString(raw.tracking?.gtag_tagId),
      facebookPixelId: nonEmptyString(raw.tracking?.facebookPixelId) ?? nonEmptyString(raw.tracking?.fbpixel_pixelId)
    },
    seo: {
      titleTemplate: nonEmptyString(raw.seo?.titleTemplate) ?? d.seo.titleTemplate,
      // Accept the nested `seo.defaultOgImage`, falling back to the
      // legacy top-level `defaultOgImage` the backend may still send.
      defaultOgImage: nonEmptyString(raw.seo?.defaultOgImage) ?? nonEmptyString(raw.defaultOgImage)
    },
    siteName: raw.siteName != null ? String(raw.siteName) : void 0,
    heroImage: raw.heroImage != null ? String(raw.heroImage) : void 0,
    defaultOgImage: raw.defaultOgImage != null ? String(raw.defaultOgImage) : void 0,
    tagline: raw.tagline != null ? String(raw.tagline) : void 0,
    // Trim a trailing slash so `${siteUrl}/path` never double-slashes.
    siteUrl: nonEmptyString(raw.siteUrl)?.replace(/\/+$/, "")
  };
}
function nonEmptyString(v) {
  if (v == null)
    return void 0;
  const s = String(v).trim();
  return s ? s : void 0;
}

// src/app/app-config.token.ts
var APP_CONFIG = new InjectionToken("APP_CONFIG");

// src/app/features/blog/services/tenant.service.ts
var TenantService = class _TenantService {
  constructor() {
    this.http = inject(HttpClient);
    this.appConfig = inject(APP_CONFIG, { optional: true });
    this.SHOP_HOSTS = ["test.invopos.shop", "dev.invopos.shop", "invopos.shop"];
    this.RESERVED = ["www", "dev", "test", "staging", "preprod", "uat", "qa", "demo"];
    this._slug = "";
    this.resolved = null;
  }
  /** Resolved tenant slug. Empty until `resolve()` settles (or unresolvable). */
  slug() {
    return this._slug;
  }
  /** Resolve the slug once. Multiple callers (the app initializer AND the
   *  analytics warm-up) share the same promise so the work runs once and
   *  everyone awaits the same settled result. */
  resolve() {
    return this.resolved ??= this.doResolve();
  }
  doResolve() {
    return __async(this, null, function* () {
      if (typeof window !== "undefined") {
        const override = window.__BLOG_SUBDOMAIN__;
        if (typeof override === "string" && override.length) {
          this._slug = override;
          return;
        }
      }
      try {
        const cfg = yield Promise.resolve(this.appConfig);
        if (cfg && typeof cfg.subdomain === "string" && cfg.subdomain.length) {
          this._slug = cfg.subdomain;
          return;
        }
      } catch (e) {
      }
      if (typeof window === "undefined")
        return;
      const host = (window.location?.hostname ?? "").toLowerCase();
      if (this.isLocal(host)) {
        const q = (new URLSearchParams(window.location.search).get("tenant") ?? "").trim().toLowerCase();
        if (q) {
          try {
            localStorage.setItem("blogTenant", q);
          } catch (e) {
          }
          this._slug = q;
          return;
        }
        let stored = "";
        try {
          stored = (localStorage.getItem("blogTenant") ?? "").toLowerCase();
        } catch (e) {
        }
        this._slug = stored || (environment.devTenant || "").toLowerCase();
        if (!this._slug) {
          console.warn("[TenantService] Local dev: no tenant set. Append ?tenant=<slug> to the URL once (remembered), or set environment.devTenant.");
        }
        return;
      }
      const wild = this.fromShopHost(host);
      if (wild) {
        this._slug = wild;
        return;
      }
      if (/^[\d.]+$/.test(host)) {
        this._slug = "";
        return;
      }
      this._slug = yield this.getSlugByDomain(host.replace(/^www\./, ""));
      if (!this._slug) {
        console.warn("[TenantService] Could not resolve a tenant slug for host:", host);
      }
    });
  }
  isLocal(host) {
    return host === "localhost" || host === "127.0.0.1" || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  }
  /** `<slug>.invopos.shop` family → the slug, else '' (custom domain). */
  fromShopHost(host) {
    for (const root of this.SHOP_HOSTS) {
      if (host === root)
        return "";
      if (host.endsWith("." + root)) {
        const candidate = host.slice(0, -("." + root).length).split(".")[0];
        if (!candidate || this.RESERVED.includes(candidate))
          return "";
        return candidate;
      }
    }
    return "";
  }
  /** Custom-domain → slug, via the same endpoint oldEco uses. Best-effort. */
  getSlugByDomain(domain) {
    return __async(this, null, function* () {
      try {
        const res = yield firstValueFrom(this.http.post(`${environment.apiBase}/v1/app/getSlugByDomain`, { Domain: domain }));
        return res?.success && res.data?.slug ? String(res.data.slug) : "";
      } catch (e) {
        return "";
      }
    });
  }
  static {
    this.\u0275fac = function TenantService_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _TenantService)();
    };
  }
  static {
    this.\u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _TenantService, factory: _TenantService.\u0275fac, providedIn: "root" });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(TenantService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

// src/app/features/blog/services/public-blog-api.service.ts
var PublicBlogApiService = class _PublicBlogApiService {
  constructor() {
    this.http = inject(HttpClient);
    this.tenant = inject(TenantService);
    this.base = environment.apiBase;
  }
  url(action) {
    const company = encodeURIComponent(this.resolveCompany());
    return `${this.base}/v1/ecommerce/${company}/blog/${action}`;
  }
  /** Resolve the tenant company slug used in both the URL path and
   *  the `X-Sub-Domain` header. Order:
   *   1. `window.__BLOG_SUBDOMAIN__` override (set by the server-
   *      rendered shell — useful when several tenants share a
   *      domain or for local dev against a remote tenant).
   *   2. First label of `window.location.hostname` —
   *      `shussain.dev.invopos.shop` → `shussain`.
   *      Bare IPs / localhost give a literal value the backend
   *      probably can't resolve; set the override in dev. */
  resolveCompany() {
    return this.tenant.slug();
  }
  headers() {
    return new HttpHeaders({ "X-Sub-Domain": this.resolveCompany() });
  }
  call(_0) {
    return __async(this, arguments, function* (action, body = {}) {
      let env;
      try {
        env = yield firstValueFrom(this.http.post(this.url(action), body, {
          headers: this.headers(),
          withCredentials: true
        }));
      } catch (e) {
        if (e instanceof HttpErrorResponse && e.error?.msg) {
          const wrapped = new Error(e.error.msg);
          wrapped.status = e.status;
          wrapped.code = e.error?.code;
          wrapped.cause = e;
          throw wrapped;
        }
        throw e;
      }
      if (!env || env.success === false) {
        const err = new Error(env?.msg || "Request failed");
        err.status = 0;
        throw err;
      }
      return env.data;
    });
  }
  // ── Settings ───────────────────────────────────────────────────────
  getPublicSettings() {
    return __async(this, null, function* () {
      const raw = yield this.call("getSettings", {});
      return normalizePublicBlogSettings(raw);
    });
  }
  // ── Posts ──────────────────────────────────────────────────────────
  /** New list contract — paginated, sorted, and filtered. The page
   *  callers pass a flat `PostListQuery` (legacy shape kept for
   *  ergonomics); we restructure into the nested filter / sortBy
   *  shape the backend expects. */
  listPublicPosts(query) {
    return this.call("getPostList", {
      page: query.page ?? 1,
      limit: query.limit ?? 12,
      searchTerm: query.search ?? "",
      sortBy: {
        sortValue: query.sort ?? "date",
        sortDirection: query.order ?? "desc"
      },
      filter: {
        language: query.language,
        taxonomyId: query.taxonomyId,
        authorEmployeeId: query.authorEmployeeId,
        // Public site only sees published posts; backend enforces
        // this regardless, but pass the value for clarity.
        status: "published"
      }
    });
  }
  /** Fetch a single post. `preview` asks the backend to return it even
   *  when unpublished (draft/scheduled) — used by the dashboard's
   *  Preview action via `?preview=1`. Backend must honour the flag. */
  getPublicPost(slug, language, preview = false) {
    return this.call("getPost", __spreadValues({ slug, language }, preview ? { preview: true } : {}));
  }
  // ── Taxonomies ─────────────────────────────────────────────────────
  listPublicTaxonomies(opts) {
    return this.call("getTaxonomyList", {
      page: 1,
      limit: 200,
      searchTerm: opts.search ?? "",
      sortBy: { sortValue: "name", sortDirection: "asc" },
      filter: { taxonomyType: opts.taxonomyType, language: opts.language }
    });
  }
  getCategoryPosts(slug, language, paging = {}) {
    return this.call("getCategoryPosts", {
      slug,
      page: paging.page ?? 1,
      limit: paging.limit ?? 12,
      language
    });
  }
  getTagPosts(slug, language, paging = {}) {
    return this.call("getTagPosts", {
      slug,
      page: paging.page ?? 1,
      limit: paging.limit ?? 12,
      language
    });
  }
  // ── Authors ────────────────────────────────────────────────────────
  /** Author profile is keyed by employeeId on the new contract, not
   *  by slug. Pages route on `:authorEmployeeId`; if the value in
   *  the URL is actually a slug, the backend will 404 and the page
   *  surfaces the not-found view. */
  getAuthorProfile(authorEmployeeId, _language, _paging = {}) {
    return this.call("getAuthorProfile", { authorEmployeeId });
  }
  // ── Comments ───────────────────────────────────────────────────────
  /** Comments are keyed by postId on the new contract. Page passes
   *  `post.id` (loaded from `getPost` on the post page) — the slug
   *  is no longer enough. */
  listPostComments(postId, _language, paging = {}) {
    return this.call("getPostComments", {
      postId,
      page: paging.page ?? 1,
      limit: paging.limit ?? 200
    });
  }
  createComment(postId, payload) {
    return this.call("createComment", {
      postId,
      content: payload.content,
      parentCommentId: payload.parentCommentId ?? null,
      language: payload.language
    });
  }
  updateOwnComment(commentId, content) {
    return this.call("updateOwnComment", { id: commentId, content });
  }
  deleteOwnComment(commentId) {
    return this.call("deleteOwnComment", { id: commentId });
  }
  // ── Crawler endpoints (GET, language as query) ─────────────────────
  rssUrl(lang) {
    const q = new HttpParams().set("lang", lang).toString();
    const company = encodeURIComponent(this.resolveCompany());
    return `${this.base}/v1/ecommerce/${company}/blog/rss?${q}`;
  }
  sitemapUrl() {
    const company = encodeURIComponent(this.resolveCompany());
    return `${this.base}/v1/ecommerce/${company}/blog/sitemap.xml`;
  }
  static {
    this.\u0275fac = function PublicBlogApiService_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _PublicBlogApiService)();
    };
  }
  static {
    this.\u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _PublicBlogApiService, factory: _PublicBlogApiService.\u0275fac, providedIn: "root" });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PublicBlogApiService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

// src/app/features/blog/services/blog-analytics.service.ts
var BlogAnalyticsService = class _BlogAnalyticsService {
  constructor() {
    this.platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.doc = inject(DOCUMENT);
    this.router = inject(Router);
    this.preview = inject(PreviewService);
    this.measurementId = null;
    this.clicksEnabled = false;
    this.started = false;
  }
  init(tracking) {
    if (this.started)
      return;
    if (this.preview.isCustomizeMode())
      return;
    this.started = true;
    this.applyGscVerification(tracking.gscVerification);
    if (!this.isBrowser)
      return;
    this.clicksEnabled = !!tracking.clicksEnabled;
    const id = tracking.ga4MeasurementId?.trim();
    if (!id)
      return;
    this.measurementId = id;
    this.loadGtag(id);
    this.sendPageView(this.router.url);
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => this.sendPageView(e.urlAfterRedirects));
  }
  applyGscVerification(token) {
    const t = token?.trim();
    if (!t || !this.doc?.head)
      return;
    let meta = this.doc.head.querySelector('meta[name="google-site-verification"]');
    if (!meta) {
      meta = this.doc.createElement("meta");
      meta.setAttribute("name", "google-site-verification");
      this.doc.head.appendChild(meta);
    }
    meta.setAttribute("content", t);
  }
  /** Fire a GA4 content-selection event for a clicked post. Gated on
   *  `clicksEnabled`; safe to call unconditionally from templates. */
  trackPostClick(post) {
    if (!this.clicksEnabled)
      return;
    this.gtag("event", "select_content", {
      content_type: "blog_post",
      item_id: post.slug,
      item_name: post.title
    });
  }
  loadGtag(id) {
    const w = this.doc.defaultView;
    if (!w)
      return;
    w.dataLayer = w.dataLayer || [];
    w.gtag = w.gtag || function gtag() {
      w.dataLayer.push(arguments);
    };
    w.gtag("js", /* @__PURE__ */ new Date());
    w.gtag("config", id, { send_page_view: false });
    const s = this.doc.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    this.doc.head.appendChild(s);
  }
  sendPageView(path) {
    this.gtag("event", "page_view", {
      page_path: path,
      page_location: this.doc.location?.href,
      page_title: this.doc.title
    });
  }
  gtag(...args) {
    if (!this.isBrowser || !this.measurementId)
      return;
    this.doc.defaultView?.gtag?.(...args);
  }
  static {
    this.\u0275fac = function BlogAnalyticsService_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _BlogAnalyticsService)();
    };
  }
  static {
    this.\u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _BlogAnalyticsService, factory: _BlogAnalyticsService.\u0275fac, providedIn: "root" });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(BlogAnalyticsService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

// src/app/services/marketing-tools.service.ts
var MarketingToolsService = class _MarketingToolsService {
  constructor() {
    this.platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.doc = inject(DOCUMENT);
    this.router = inject(Router);
    this.preview = inject(PreviewService);
    this.started = false;
    this.gtagLoaded = false;
    this.gtagKind = null;
    this.googleTagId = null;
    this.pixelId = null;
  }
  init(tracking) {
    if (this.started)
      return;
    if (this.preview.isCustomizeMode())
      return;
    if (!this.isBrowser)
      return;
    this.started = true;
    const gId = tracking.googleTagId?.trim();
    if (gId && gId !== tracking.ga4MeasurementId?.trim()) {
      this.googleTagId = gId;
      this.loadGoogleTag(gId);
    }
    const pId = tracking.facebookPixelId?.trim();
    if (pId) {
      this.pixelId = pId;
      this.loadFacebookPixel(pId);
    }
    if (!this.googleTagId && !this.pixelId)
      return;
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => this.onNavigation(e.urlAfterRedirects));
  }
  // ── Google Tag ───────────────────────────────────────────────────────
  loadGoogleTag(id) {
    const w = this.doc.defaultView;
    if (!w || this.gtagLoaded)
      return;
    this.gtagLoaded = true;
    if (/^GTM-/i.test(id)) {
      this.gtagKind = "gtm";
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      const s = this.doc.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
      this.doc.head.appendChild(s);
      this.addGtmNoscript(id);
    } else {
      this.gtagKind = "gtag";
      w.dataLayer = w.dataLayer || [];
      w.gtag = w.gtag || function gtag() {
        w.dataLayer.push(arguments);
      };
      w.gtag("js", /* @__PURE__ */ new Date());
      w.gtag("config", id);
      const s = this.doc.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      this.doc.head.appendChild(s);
    }
  }
  /** GTM's <noscript> fallback iframe, injected at the top of <body>. */
  addGtmNoscript(id) {
    const ns = this.doc.createElement("noscript");
    const iframe = this.doc.createElement("iframe");
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(id)}`;
    iframe.height = "0";
    iframe.width = "0";
    iframe.style.display = "none";
    iframe.style.visibility = "hidden";
    ns.appendChild(iframe);
    this.doc.body?.insertBefore(ns, this.doc.body.firstChild);
  }
  // ── Facebook (Meta) Pixel ────────────────────────────────────────────
  loadFacebookPixel(id) {
    const w = this.doc.defaultView;
    if (!w)
      return;
    if (!w.fbq) {
      const n = w.fbq = function(...args) {
        n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
      };
      if (!w._fbq)
        w._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      const s = this.doc.createElement("script");
      s.async = true;
      s.src = "https://connect.facebook.net/en_US/fbevents.js";
      this.doc.head.appendChild(s);
    }
    w.fbq("init", id);
    w.fbq("track", "PageView");
    this.addFbPixelNoscript(id);
  }
  /** Meta Pixel's <noscript> tracking image. */
  addFbPixelNoscript(id) {
    const ns = this.doc.createElement("noscript");
    const img = this.doc.createElement("img");
    img.height = 1;
    img.width = 1;
    img.style.display = "none";
    img.src = `https://www.facebook.com/tr?id=${encodeURIComponent(id)}&ev=PageView&noscript=1`;
    ns.appendChild(img);
    this.doc.body?.appendChild(ns);
  }
  // ── SPA navigation ───────────────────────────────────────────────────
  onNavigation(path) {
    const w = this.doc.defaultView;
    if (!w)
      return;
    if (this.googleTagId) {
      if (this.gtagKind === "gtm") {
        w.dataLayer?.push({ event: "gtm.historyChange", "gtm.newUrl": this.doc.location?.href });
      } else {
        w.gtag?.("event", "page_view", {
          page_path: path,
          page_location: this.doc.location?.href,
          page_title: this.doc.title
        });
      }
    }
    if (this.pixelId) {
      w.fbq?.("track", "PageView");
    }
  }
  static {
    this.\u0275fac = function MarketingToolsService_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _MarketingToolsService)();
    };
  }
  static {
    this.\u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _MarketingToolsService, factory: _MarketingToolsService.\u0275fac, providedIn: "root" });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MarketingToolsService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

// src/app/features/blog/services/blog-settings.service.ts
var BlogSettingsService = class _BlogSettingsService {
  constructor() {
    this.api = inject(PublicBlogApiService);
    this.analytics = inject(BlogAnalyticsService);
    this.marketing = inject(MarketingToolsService);
    this.platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(this.platformId);
    this._settings = signal(defaultPublicBlogSettings(), ...ngDevMode ? [{ debugName: "_settings" }] : (
      /* istanbul ignore next */
      []
    ));
    this._loaded = signal(false, ...ngDevMode ? [{ debugName: "_loaded" }] : (
      /* istanbul ignore next */
      []
    ));
    this.inflight = null;
    this.settings = this._settings.asReadonly();
    this.loaded = this._loaded.asReadonly();
  }
  load() {
    if (this._loaded())
      return Promise.resolve(this._settings());
    if (this.inflight)
      return this.inflight;
    this.inflight = (() => __async(this, null, function* () {
      try {
        const s = yield this.api.getPublicSettings();
        this._settings.set(s);
        this._loaded.set(true);
        this.analytics.init(s.tracking);
        this.marketing.init(s.tracking);
        return s;
      } catch (e) {
        const fallback = defaultPublicBlogSettings();
        this._settings.set(fallback);
        this._loaded.set(true);
        return fallback;
      } finally {
        this.inflight = null;
      }
    }))();
    return this.inflight;
  }
  isRtl(lang) {
    return this._settings().languages.rtlLanguages.includes(lang);
  }
  /** Absolute storefront origin for canonical / og:url. Prefers the
   *  backend-provided `siteUrl`, then the build-time origin, then the
   *  live browser origin (empty on the server when nothing is set). */
  originUrl() {
    return this._settings().siteUrl || environment.siteOrigin || (this.isBrowser ? window.location.origin : "");
  }
  static {
    this.\u0275fac = function BlogSettingsService_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _BlogSettingsService)();
    };
  }
  static {
    this.\u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _BlogSettingsService, factory: _BlogSettingsService.\u0275fac, providedIn: "root" });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(BlogSettingsService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

export {
  COMPONENT_NAMES,
  environment,
  PreviewService,
  APP_CONFIG,
  TenantService,
  PublicBlogApiService,
  BlogAnalyticsService,
  BlogSettingsService
};
//# sourceMappingURL=chunk-6PGRTRNN.js.map
