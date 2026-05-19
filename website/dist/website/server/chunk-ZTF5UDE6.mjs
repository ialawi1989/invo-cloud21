import './polyfills.server.mjs';
import {
  environment
} from "./chunk-7T3LTQNF.mjs";
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams
} from "./chunk-MM3YSFEO.mjs";
import {
  Injectable,
  firstValueFrom,
  inject,
  setClassMetadata,
  signal,
  ɵɵdefineInjectable
} from "./chunk-7RMZTTLI.mjs";
import {
  __async
} from "./chunk-TXMZZVXC.mjs";

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
    languages: { default: "en", supported: ["en"], rtlLanguages: ["ar", "he", "fa", "ur"] },
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
    mobile: { overrideDesktop: false, feedLayout: "list", showCategoryMenu: true }
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
      rtlLanguages: Array.isArray(raw.languages?.rtlLanguages) ? raw.languages.rtlLanguages.map(String) : d.languages.rtlLanguages
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
    siteName: raw.siteName != null ? String(raw.siteName) : void 0,
    heroImage: raw.heroImage != null ? String(raw.heroImage) : void 0,
    defaultOgImage: raw.defaultOgImage != null ? String(raw.defaultOgImage) : void 0,
    tagline: raw.tagline != null ? String(raw.tagline) : void 0
  };
}

// src/app/features/blog/services/public-blog-api.service.ts
var PublicBlogApiService = class _PublicBlogApiService {
  constructor() {
    this.http = inject(HttpClient);
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
    if (typeof window !== "undefined") {
      const override = window.__BLOG_SUBDOMAIN__;
      if (typeof override === "string" && override.length)
        return override;
      const host = window.location?.hostname ?? "";
      return host.split(".")[0] ?? "";
    }
    return "";
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
  getPublicPost(slug, language) {
    return this.call("getPost", { slug, language });
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

// src/app/features/blog/services/blog-settings.service.ts
var BlogSettingsService = class _BlogSettingsService {
  constructor() {
    this.api = inject(PublicBlogApiService);
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
        return s;
      } finally {
        this.inflight = null;
      }
    }))();
    return this.inflight;
  }
  isRtl(lang) {
    return this._settings().languages.rtlLanguages.includes(lang);
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
  PublicBlogApiService,
  BlogSettingsService
};
//# sourceMappingURL=chunk-ZTF5UDE6.mjs.map
