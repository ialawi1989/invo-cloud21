import {
  APP_CONFIG,
  BlogSettingsService,
  ChangeDetectionStrategy,
  CommonModule,
  Component,
  DomSanitizer,
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  Injectable,
  Input,
  PLATFORM_ID,
  PreviewService,
  Router,
  RouterOutlet,
  TenantService,
  __async,
  __spreadProps,
  __spreadValues,
  bootstrapApplication,
  catchError,
  computed,
  environment,
  firstValueFrom,
  inject,
  input,
  isPlatformBrowser,
  isPlatformServer,
  of,
  provideAppInitializer,
  provideClientHydration,
  provideHttpClient,
  provideRouter,
  provideZoneChangeDetection,
  setClassMetadata,
  signal,
  withEventReplay,
  withFetch,
  withHttpTransferCacheOptions,
  withInMemoryScrolling,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵattribute,
  ɵɵclassProp,
  ɵɵconditional,
  ɵɵconditionalCreate,
  ɵɵdefineComponent,
  ɵɵdefineInjectable,
  ɵɵdirectiveInject,
  ɵɵdomElement,
  ɵɵdomElementEnd,
  ɵɵdomElementStart,
  ɵɵdomProperty,
  ɵɵelement,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵnamespaceHTML,
  ɵɵnamespaceSVG,
  ɵɵnextContext,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵrepeaterTrackByIndex,
  ɵɵsanitizeHtml,
  ɵɵsanitizeUrl,
  ɵɵstyleProp,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1
} from "./chunk-WIK4ERCU.js";

// src/app/features/navigation/services/public-navigation-api.service.ts
var ACTION_MENUS = "page/getNavigation";
var ACTION_MOBILE_BAR = "page/getMobileIconBar";
var PublicNavigationApiService = class _PublicNavigationApiService {
  constructor() {
    this.http = inject(HttpClient);
    this.tenant = inject(TenantService);
    this.base = environment.apiBase;
  }
  url(action) {
    const company = encodeURIComponent(this.tenant.slug());
    return `${this.base}/v1/ecommerce/${company}/${action}`;
  }
  headers() {
    return new HttpHeaders({ "X-Sub-Domain": this.tenant.slug() });
  }
  call(_0) {
    return __async(this, arguments, function* (action, body = {}) {
      try {
        const env = yield firstValueFrom(this.http.post(this.url(action), body, {
          headers: this.headers(),
          withCredentials: true
        }));
        if (env && env.success === false)
          return null;
        return env?.data ?? null;
      } catch (e) {
        if (!(e instanceof HttpErrorResponse))
          console.warn("[nav] fetch failed", e);
        return null;
      }
    });
  }
  /** All published menus. Tolerates `{ list: [...] }`, a bare array, or a single menu. */
  getMenus() {
    return __async(this, null, function* () {
      if (!this.tenant.slug())
        return [];
      const data = yield this.call(ACTION_MENUS);
      if (!data)
        return [];
      const rows = Array.isArray(data) ? data : data.list ?? data.menus ?? [data];
      return rows.filter((r) => r && (r.template || r.list)).map((r) => this.toMenu(r));
    });
  }
  getMobileIconBar() {
    return __async(this, null, function* () {
      if (!this.tenant.slug())
        return null;
      const data = yield this.call(ACTION_MOBILE_BAR);
      if (!data)
        return null;
      const row = Array.isArray(data) ? data[0] : data.list ? data : data.template ? data : data;
      const list = row?.template?.list ?? row?.list ?? [];
      return { list };
    });
  }
  /** A backend row (`{ template: {list}, isPrimaryMenu, ... }`) or already-unwrapped menu → NavMenu. */
  toMenu(row) {
    const template = row.template ?? row;
    return {
      id: row.id ?? row._id,
      name: row.name ?? template.name ?? "",
      isPrimaryMenu: row.isPrimaryMenu,
      isFooterMenu: row.isFooterMenu,
      list: template.list ?? []
    };
  }
  static {
    this.\u0275fac = function PublicNavigationApiService_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _PublicNavigationApiService)();
    };
  }
  static {
    this.\u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _PublicNavigationApiService, factory: _PublicNavigationApiService.\u0275fac, providedIn: "root" });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PublicNavigationApiService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

// src/app/features/navigation/services/navigation.service.ts
var NavigationService = class _NavigationService {
  constructor() {
    this.preview = inject(PreviewService);
    this.api = inject(PublicNavigationApiService);
    this._liveMenus = signal([], ...ngDevMode ? [{ debugName: "_liveMenus" }] : (
      /* istanbul ignore next */
      []
    ));
    this._liveMobile = signal(null, ...ngDevMode ? [{ debugName: "_liveMobile" }] : (
      /* istanbul ignore next */
      []
    ));
    this._loaded = signal(false, ...ngDevMode ? [{ debugName: "_loaded" }] : (
      /* istanbul ignore next */
      []
    ));
    this.loading = null;
    this.loaded = this._loaded.asReadonly();
    this.menus = computed(() => {
      const fromPreview = this.preview.navigation()?.menus;
      if (fromPreview && fromPreview.length)
        return fromPreview;
      return this._liveMenus();
    }, ...ngDevMode ? [{ debugName: "menus" }] : (
      /* istanbul ignore next */
      []
    ));
    this.primaryMenu = computed(() => this.menus().find((m) => !m.isFooterMenu) ?? this.menus()[0] ?? null, ...ngDevMode ? [{ debugName: "primaryMenu" }] : (
      /* istanbul ignore next */
      []
    ));
    this.footerMenu = computed(() => this.menus().find((m) => m.isFooterMenu) ?? null, ...ngDevMode ? [{ debugName: "footerMenu" }] : (
      /* istanbul ignore next */
      []
    ));
    this.mobileBar = computed(() => {
      const fromPreview = this.preview.navigation()?.mobileBar;
      if (fromPreview !== void 0 && fromPreview !== null)
        return fromPreview;
      return this._liveMobile();
    }, ...ngDevMode ? [{ debugName: "mobileBar" }] : (
      /* istanbul ignore next */
      []
    ));
    this.hasMenu = computed(() => (this.primaryMenu()?.list?.length ?? 0) > 0, ...ngDevMode ? [{ debugName: "hasMenu" }] : (
      /* istanbul ignore next */
      []
    ));
  }
  /** One-shot load of the published navigation. Skipped in customize mode. */
  load() {
    if (this.preview.isCustomizeMode()) {
      this._loaded.set(true);
      return Promise.resolve();
    }
    return this.loading ??= this.doLoad();
  }
  doLoad() {
    return __async(this, null, function* () {
      try {
        const [menus, mobile] = yield Promise.all([
          this.api.getMenus(),
          this.api.getMobileIconBar()
        ]);
        this._liveMenus.set(menus);
        this._liveMobile.set(mobile);
      } catch (e) {
      } finally {
        this._loaded.set(true);
      }
    });
  }
  static {
    this.\u0275fac = function NavigationService_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _NavigationService)();
    };
  }
  static {
    this.\u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _NavigationService, factory: _NavigationService.\u0275fac, providedIn: "root" });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NavigationService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], null, null);
})();

// src/app/features/navigation/models/navigation.types.ts
function buildNavTree(list) {
  const roots = [];
  const lastAtDepth = [];
  for (const raw of list ?? []) {
    const node = __spreadProps(__spreadValues({}, raw), { children: [] });
    const depth = Math.max(0, node.depth || 0);
    if (depth === 0) {
      roots.push(node);
    } else {
      const parent = lastAtDepth[depth - 1];
      if (parent)
        (parent.children ??= []).push(node);
      else
        roots.push(node);
    }
    lastAtDepth[depth] = node;
    lastAtDepth.length = depth + 1;
  }
  return roots;
}
function navName(item, lang) {
  return item.translation?.[lang]?.name || item.name || "";
}
function resolveHref(item, lang = "en") {
  const slug = (item.abbr || "").trim();
  switch (item.type) {
    case "customUrl":
    case "custom":
      return item.customUrl || "#";
    case "mega":
      return "#";
    case "page":
    case "pages":
      return slug === "home" || slug === "/" ? `/${lang}` : `/${lang}/${slug}`;
    case "collections":
    case "collection":
      return `/${lang}/collection/${slug}`;
    case "shop":
      return `/${lang}/shop`;
    case "menu":
      return `/${lang}/menu`;
    case "orders":
      return `/${lang}/account/orders`;
    case "reservations":
      return `/${lang}/account/reservations`;
    case "services":
      return `/${lang}/${slug}`;
    case "image":
      return item.customUrl || "#";
    default:
      return item.customUrl || (slug ? `/${lang}/${slug}` : "#");
  }
}
function mobileHref(slug, lang = "en") {
  switch (slug) {
    case "/":
      return `/${lang}`;
    case "search":
      return `/${lang}/search`;
    case "toTop":
      return "#top";
    case "categories":
      return `/${lang}/categories`;
    case "wishlist":
      return `/${lang}/wishlist`;
    case "cart":
      return `/${lang}/cart`;
    case "account":
      return `/${lang}/account`;
    case "menu":
      return `/${lang}/menu`;
    case "shop":
      return `/${lang}/shop`;
    case "my-orders":
      return `/${lang}/account/orders`;
    case "appointments":
      return `/${lang}/account/reservations`;
    default:
      return `/${lang}/${slug}`;
  }
}

// src/app/features/navigation/components/site-nav.component.ts
var _forTrack0 = ($index, $item) => $item.uId || $item.name;
function SiteNavComponent_Conditional_0_For_3_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275namespaceSVG();
    \u0275\u0275domElementStart(0, "svg", 5);
    \u0275\u0275domElement(1, "polyline", 8);
    \u0275\u0275domElementEnd();
  }
}
function SiteNavComponent_Conditional_0_For_3_Conditional_4_For_3_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "h4", 13);
    \u0275\u0275text(1);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const col_r1 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(col_r1.title);
  }
}
function SiteNavComponent_Conditional_0_For_3_Conditional_4_For_3_For_4_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "a", 14);
    \u0275\u0275domElement(1, "img", 16);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const ci_r2 = \u0275\u0275nextContext().$implicit;
    const ctx_r2 = \u0275\u0275nextContext(5);
    \u0275\u0275domProperty("href", ctx_r2.href(ci_r2), \u0275\u0275sanitizeUrl);
    \u0275\u0275advance();
    \u0275\u0275domProperty("src", (ci_r2.mediaUrl == null ? null : ci_r2.mediaUrl.defaultUrl) || "", \u0275\u0275sanitizeUrl)("alt", ci_r2.name);
  }
}
function SiteNavComponent_Conditional_0_For_3_Conditional_4_For_3_For_4_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "a", 15);
    \u0275\u0275text(1);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const ci_r2 = \u0275\u0275nextContext().$implicit;
    const ctx_r2 = \u0275\u0275nextContext(5);
    \u0275\u0275domProperty("href", ctx_r2.href(ci_r2), \u0275\u0275sanitizeUrl);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r2.label(ci_r2));
  }
}
function SiteNavComponent_Conditional_0_For_3_Conditional_4_For_3_For_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "li");
    \u0275\u0275conditionalCreate(1, SiteNavComponent_Conditional_0_For_3_Conditional_4_For_3_For_4_Conditional_1_Template, 2, 3, "a", 14)(2, SiteNavComponent_Conditional_0_For_3_Conditional_4_For_3_For_4_Conditional_2_Template, 2, 2, "a", 15);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const ci_r2 = ctx.$implicit;
    \u0275\u0275advance();
    \u0275\u0275conditional(ci_r2.type === "image" ? 1 : 2);
  }
}
function SiteNavComponent_Conditional_0_For_3_Conditional_4_For_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "div", 12);
    \u0275\u0275conditionalCreate(1, SiteNavComponent_Conditional_0_For_3_Conditional_4_For_3_Conditional_1_Template, 2, 1, "h4", 13);
    \u0275\u0275domElementStart(2, "ul");
    \u0275\u0275repeaterCreate(3, SiteNavComponent_Conditional_0_For_3_Conditional_4_For_3_For_4_Template, 3, 1, "li", null, _forTrack0);
    \u0275\u0275domElementEnd()();
  }
  if (rf & 2) {
    const col_r1 = ctx.$implicit;
    \u0275\u0275styleProp("flex-basis", col_r1.width || null, "%");
    \u0275\u0275advance();
    \u0275\u0275conditional(col_r1.title ? 1 : -1);
    \u0275\u0275advance(2);
    \u0275\u0275repeater(col_r1.items);
  }
}
function SiteNavComponent_Conditional_0_For_3_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "div", 9)(1, "div", 10);
    \u0275\u0275repeaterCreate(2, SiteNavComponent_Conditional_0_For_3_Conditional_4_For_3_Template, 5, 3, "div", 11, \u0275\u0275repeaterTrackByIndex);
    \u0275\u0275domElementEnd()();
  }
  if (rf & 2) {
    const item_r4 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275classProp("full", item_r4.megaWidth === "full");
    \u0275\u0275advance(2);
    \u0275\u0275repeater(item_r4.megaColumns);
  }
}
function SiteNavComponent_Conditional_0_For_3_Conditional_5_For_2_Conditional_3_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "li")(1, "a", 15);
    \u0275\u0275text(2);
    \u0275\u0275domElementEnd()();
  }
  if (rf & 2) {
    const g_r5 = ctx.$implicit;
    const ctx_r2 = \u0275\u0275nextContext(6);
    \u0275\u0275advance();
    \u0275\u0275domProperty("href", ctx_r2.href(g_r5), \u0275\u0275sanitizeUrl);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r2.label(g_r5));
  }
}
function SiteNavComponent_Conditional_0_For_3_Conditional_5_For_2_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "ul", 18);
    \u0275\u0275repeaterCreate(1, SiteNavComponent_Conditional_0_For_3_Conditional_5_For_2_Conditional_3_For_2_Template, 3, 2, "li", null, _forTrack0);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const child_r6 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275advance();
    \u0275\u0275repeater(child_r6.children);
  }
}
function SiteNavComponent_Conditional_0_For_3_Conditional_5_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "li")(1, "a", 15);
    \u0275\u0275text(2);
    \u0275\u0275domElementEnd();
    \u0275\u0275conditionalCreate(3, SiteNavComponent_Conditional_0_For_3_Conditional_5_For_2_Conditional_3_Template, 3, 0, "ul", 18);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const child_r6 = ctx.$implicit;
    const ctx_r2 = \u0275\u0275nextContext(4);
    \u0275\u0275classProp("has-sub", child_r6.children == null ? null : child_r6.children.length);
    \u0275\u0275advance();
    \u0275\u0275domProperty("href", ctx_r2.href(child_r6), \u0275\u0275sanitizeUrl);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r2.label(child_r6));
    \u0275\u0275advance();
    \u0275\u0275conditional((child_r6.children == null ? null : child_r6.children.length) ? 3 : -1);
  }
}
function SiteNavComponent_Conditional_0_For_3_Conditional_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "ul", 7);
    \u0275\u0275repeaterCreate(1, SiteNavComponent_Conditional_0_For_3_Conditional_5_For_2_Template, 4, 5, "li", 17, _forTrack0);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const item_r4 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275advance();
    \u0275\u0275repeater(item_r4.children);
  }
}
function SiteNavComponent_Conditional_0_For_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "li", 3)(1, "a", 4);
    \u0275\u0275text(2);
    \u0275\u0275conditionalCreate(3, SiteNavComponent_Conditional_0_For_3_Conditional_3_Template, 2, 0, ":svg:svg", 5);
    \u0275\u0275domElementEnd();
    \u0275\u0275conditionalCreate(4, SiteNavComponent_Conditional_0_For_3_Conditional_4_Template, 4, 2, "div", 6)(5, SiteNavComponent_Conditional_0_For_3_Conditional_5_Template, 3, 0, "ul", 7);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const item_r4 = ctx.$implicit;
    const ctx_r2 = \u0275\u0275nextContext(2);
    \u0275\u0275classProp("has-pop", (item_r4.children == null ? null : item_r4.children.length) || item_r4.isMegaMenu);
    \u0275\u0275advance();
    \u0275\u0275domProperty("href", ctx_r2.href(item_r4), \u0275\u0275sanitizeUrl);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r2.label(item_r4), " ");
    \u0275\u0275advance();
    \u0275\u0275conditional((item_r4.children == null ? null : item_r4.children.length) || item_r4.isMegaMenu ? 3 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(item_r4.isMegaMenu && (item_r4.megaColumns == null ? null : item_r4.megaColumns.length) ? 4 : (item_r4.children == null ? null : item_r4.children.length) ? 5 : -1);
  }
}
function SiteNavComponent_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "nav", 0)(1, "ul", 1);
    \u0275\u0275repeaterCreate(2, SiteNavComponent_Conditional_0_For_3_Template, 6, 6, "li", 2, _forTrack0);
    \u0275\u0275domElementEnd()();
  }
  if (rf & 2) {
    const ctx_r2 = \u0275\u0275nextContext();
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r2.tree());
  }
}
var SiteNavComponent = class _SiteNavComponent {
  constructor() {
    this.nav = inject(NavigationService);
    this.lang = input("en", ...ngDevMode ? [{ debugName: "lang" }] : (
      /* istanbul ignore next */
      []
    ));
    this.tree = computed(() => {
      const menu = this.nav.primaryMenu();
      return menu ? buildNavTree(menu.list) : [];
    }, ...ngDevMode ? [{ debugName: "tree" }] : (
      /* istanbul ignore next */
      []
    ));
  }
  label(item) {
    return navName(item, this.lang());
  }
  href(item) {
    return resolveHref(item, this.lang());
  }
  static {
    this.\u0275fac = function SiteNavComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _SiteNavComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _SiteNavComponent, selectors: [["app-site-nav"]], inputs: { lang: [1, "lang"] }, decls: 1, vars: 1, consts: [[1, "site-nav"], [1, "nav-root"], [1, "nav-node", 3, "has-pop"], [1, "nav-node"], [1, "nav-link", 3, "href"], ["width", "12", "height", "12", "viewBox", "0 0 24 24", "fill", "none", "stroke", "currentColor", "stroke-width", "2.5", 1, "caret"], [1, "mega", 3, "full"], [1, "dropdown"], ["points", "6 9 12 15 18 9"], [1, "mega"], [1, "mega-inner"], [1, "mega-col", 3, "flex-basis"], [1, "mega-col"], [1, "mega-col-title"], [1, "mega-img", 3, "href"], [3, "href"], [3, "src", "alt"], [3, "has-sub"], [1, "sub"]], template: function SiteNavComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275conditionalCreate(0, SiteNavComponent_Conditional_0_Template, 4, 0, "nav", 0);
      }
      if (rf & 2) {
        \u0275\u0275conditional(ctx.tree().length ? 0 : -1);
      }
    }, dependencies: [CommonModule], styles: ["\n.site-nav[_ngcontent-%COMP%] {\n  display: flex;\n}\n.nav-root[_ngcontent-%COMP%] {\n  list-style: none;\n  display: flex;\n  gap: 4px;\n  margin: 0;\n  padding: 0;\n  align-items: center;\n}\n.nav-node[_ngcontent-%COMP%] {\n  position: relative;\n}\n.nav-link[_ngcontent-%COMP%] {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  padding: 8px 12px;\n  color: var(--header-text);\n  text-decoration: none;\n  font-size: 14px;\n  opacity: .85;\n  border-radius: 6px;\n  white-space: nowrap;\n}\n.nav-link[_ngcontent-%COMP%]:hover {\n  opacity: 1;\n}\n.caret[_ngcontent-%COMP%] {\n  transition: transform .15s;\n}\n.nav-node[_ngcontent-%COMP%]:hover    > .nav-link[_ngcontent-%COMP%]   .caret[_ngcontent-%COMP%] {\n  transform: rotate(180deg);\n}\n.dropdown[_ngcontent-%COMP%], \n.mega[_ngcontent-%COMP%] {\n  position: absolute;\n  top: 100%;\n  left: 0;\n  opacity: 0;\n  visibility: hidden;\n  transform: translateY(6px);\n  transition:\n    opacity .15s,\n    transform .15s,\n    visibility .15s;\n  z-index: 200;\n  background: var(--header-bg, #fff);\n  border: 1px solid rgba(0, 0, 0, .08);\n  border-radius: 10px;\n  box-shadow: 0 12px 32px rgba(0, 0, 0, .12);\n}\n.nav-node[_ngcontent-%COMP%]:hover    > .dropdown[_ngcontent-%COMP%], \n.nav-node[_ngcontent-%COMP%]:hover    > .mega[_ngcontent-%COMP%] {\n  opacity: 1;\n  visibility: visible;\n  transform: translateY(0);\n}\n.dropdown[_ngcontent-%COMP%] {\n  min-width: 200px;\n  padding: 6px;\n  list-style: none;\n}\n.dropdown[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {\n  position: relative;\n  list-style: none;\n}\n.dropdown[_ngcontent-%COMP%]   a[_ngcontent-%COMP%] {\n  display: block;\n  padding: 8px 12px;\n  color: var(--header-text);\n  text-decoration: none;\n  font-size: 14px;\n  border-radius: 6px;\n}\n.dropdown[_ngcontent-%COMP%]   a[_ngcontent-%COMP%]:hover {\n  background: rgba(0, 0, 0, .05);\n}\n.dropdown[_ngcontent-%COMP%]   .sub[_ngcontent-%COMP%] {\n  position: absolute;\n  top: 0;\n  left: 100%;\n  min-width: 190px;\n  padding: 6px;\n  margin: 0;\n  list-style: none;\n  background: var(--header-bg,#fff);\n  border: 1px solid rgba(0, 0, 0, .08);\n  border-radius: 10px;\n  box-shadow: 0 12px 32px rgba(0, 0, 0, .12);\n  opacity: 0;\n  visibility: hidden;\n  transition: .15s;\n}\n.dropdown[_ngcontent-%COMP%]   li.has-sub[_ngcontent-%COMP%]:hover    > .sub[_ngcontent-%COMP%] {\n  opacity: 1;\n  visibility: visible;\n}\n.mega[_ngcontent-%COMP%] {\n  padding: 20px;\n  min-width: 520px;\n}\n.mega.full[_ngcontent-%COMP%] {\n  left: 0;\n  right: 0;\n  position: fixed;\n  width: 100vw;\n  border-radius: 0;\n}\n.mega-inner[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 28px;\n  max-width: var(--container-width,1200px);\n  margin: 0 auto;\n}\n.mega-col[_ngcontent-%COMP%] {\n  flex: 1 1 0;\n  min-width: 140px;\n}\n.mega-col-title[_ngcontent-%COMP%] {\n  font-size: 13px;\n  font-weight: 700;\n  text-transform: uppercase;\n  letter-spacing: .04em;\n  color: var(--header-text);\n  opacity: .6;\n  margin: 0 0 10px;\n}\n.mega-col[_ngcontent-%COMP%]   ul[_ngcontent-%COMP%] {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.mega-col[_ngcontent-%COMP%]   a[_ngcontent-%COMP%] {\n  color: var(--header-text);\n  text-decoration: none;\n  font-size: 14px;\n  opacity: .85;\n}\n.mega-col[_ngcontent-%COMP%]   a[_ngcontent-%COMP%]:hover {\n  opacity: 1;\n}\n.mega-img[_ngcontent-%COMP%]   img[_ngcontent-%COMP%] {\n  width: 100%;\n  border-radius: 8px;\n  display: block;\n}\n@media (max-width: 768px) {\n  .site-nav[_ngcontent-%COMP%] {\n    display: none;\n  }\n}\n/*# sourceMappingURL=site-nav.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(SiteNavComponent, [{
    type: Component,
    args: [{ selector: "app-site-nav", standalone: true, imports: [CommonModule], changeDetection: ChangeDetectionStrategy.OnPush, template: `
    @if (tree().length) {
      <nav class="site-nav">
        <ul class="nav-root">
          @for (item of tree(); track item.uId || item.name) {
            <li class="nav-node" [class.has-pop]="item.children?.length || item.isMegaMenu">
              <a class="nav-link" [href]="href(item)">
                {{ label(item) }}
                @if (item.children?.length || item.isMegaMenu) {
                  <svg class="caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                }
              </a>

              <!-- Mega panel -->
              @if (item.isMegaMenu && item.megaColumns?.length) {
                <div class="mega" [class.full]="item.megaWidth === 'full'">
                  <div class="mega-inner">
                    @for (col of item.megaColumns; track $index) {
                      <div class="mega-col" [style.flex-basis.%]="col.width || null">
                        @if (col.title) { <h4 class="mega-col-title">{{ col.title }}</h4> }
                        <ul>
                          @for (ci of col.items; track ci.uId || ci.name) {
                            <li>
                              @if (ci.type === 'image') {
                                <a [href]="href(ci)" class="mega-img">
                                  <img [src]="ci.mediaUrl?.defaultUrl || ''" [alt]="ci.name" />
                                </a>
                              } @else {
                                <a [href]="href(ci)">{{ label(ci) }}</a>
                              }
                            </li>
                          }
                        </ul>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Nested dropdown -->
              @else if (item.children?.length) {
                <ul class="dropdown">
                  @for (child of item.children; track child.uId || child.name) {
                    <li [class.has-sub]="child.children?.length">
                      <a [href]="href(child)">{{ label(child) }}</a>
                      @if (child.children?.length) {
                        <ul class="sub">
                          @for (g of child.children; track g.uId || g.name) {
                            <li><a [href]="href(g)">{{ label(g) }}</a></li>
                          }
                        </ul>
                      }
                    </li>
                  }
                </ul>
              }
            </li>
          }
        </ul>
      </nav>
    }
  `, styles: ["/* angular:styles/component:css;40b7af6245adf2a49c1c1fc9e02d7768a21d65e0ea85b60f9e14e6fa04b24159;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/navigation/components/site-nav.component.ts */\n.site-nav {\n  display: flex;\n}\n.nav-root {\n  list-style: none;\n  display: flex;\n  gap: 4px;\n  margin: 0;\n  padding: 0;\n  align-items: center;\n}\n.nav-node {\n  position: relative;\n}\n.nav-link {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  padding: 8px 12px;\n  color: var(--header-text);\n  text-decoration: none;\n  font-size: 14px;\n  opacity: .85;\n  border-radius: 6px;\n  white-space: nowrap;\n}\n.nav-link:hover {\n  opacity: 1;\n}\n.caret {\n  transition: transform .15s;\n}\n.nav-node:hover > .nav-link .caret {\n  transform: rotate(180deg);\n}\n.dropdown,\n.mega {\n  position: absolute;\n  top: 100%;\n  left: 0;\n  opacity: 0;\n  visibility: hidden;\n  transform: translateY(6px);\n  transition:\n    opacity .15s,\n    transform .15s,\n    visibility .15s;\n  z-index: 200;\n  background: var(--header-bg, #fff);\n  border: 1px solid rgba(0, 0, 0, .08);\n  border-radius: 10px;\n  box-shadow: 0 12px 32px rgba(0, 0, 0, .12);\n}\n.nav-node:hover > .dropdown,\n.nav-node:hover > .mega {\n  opacity: 1;\n  visibility: visible;\n  transform: translateY(0);\n}\n.dropdown {\n  min-width: 200px;\n  padding: 6px;\n  list-style: none;\n}\n.dropdown li {\n  position: relative;\n  list-style: none;\n}\n.dropdown a {\n  display: block;\n  padding: 8px 12px;\n  color: var(--header-text);\n  text-decoration: none;\n  font-size: 14px;\n  border-radius: 6px;\n}\n.dropdown a:hover {\n  background: rgba(0, 0, 0, .05);\n}\n.dropdown .sub {\n  position: absolute;\n  top: 0;\n  left: 100%;\n  min-width: 190px;\n  padding: 6px;\n  margin: 0;\n  list-style: none;\n  background: var(--header-bg,#fff);\n  border: 1px solid rgba(0, 0, 0, .08);\n  border-radius: 10px;\n  box-shadow: 0 12px 32px rgba(0, 0, 0, .12);\n  opacity: 0;\n  visibility: hidden;\n  transition: .15s;\n}\n.dropdown li.has-sub:hover > .sub {\n  opacity: 1;\n  visibility: visible;\n}\n.mega {\n  padding: 20px;\n  min-width: 520px;\n}\n.mega.full {\n  left: 0;\n  right: 0;\n  position: fixed;\n  width: 100vw;\n  border-radius: 0;\n}\n.mega-inner {\n  display: flex;\n  gap: 28px;\n  max-width: var(--container-width,1200px);\n  margin: 0 auto;\n}\n.mega-col {\n  flex: 1 1 0;\n  min-width: 140px;\n}\n.mega-col-title {\n  font-size: 13px;\n  font-weight: 700;\n  text-transform: uppercase;\n  letter-spacing: .04em;\n  color: var(--header-text);\n  opacity: .6;\n  margin: 0 0 10px;\n}\n.mega-col ul {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.mega-col a {\n  color: var(--header-text);\n  text-decoration: none;\n  font-size: 14px;\n  opacity: .85;\n}\n.mega-col a:hover {\n  opacity: 1;\n}\n.mega-img img {\n  width: 100%;\n  border-radius: 8px;\n  display: block;\n}\n@media (max-width: 768px) {\n  .site-nav {\n    display: none;\n  }\n}\n/*# sourceMappingURL=site-nav.component.css.map */\n"] }]
  }], null, { lang: [{ type: Input, args: [{ isSignal: true, alias: "lang", required: false }] }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(SiteNavComponent, { className: "SiteNavComponent", filePath: "src/app/features/navigation/components/site-nav.component.ts", lineNumber: 119 });
})();

// src/app/features/navigation/components/mobile-icon-bar.component.ts
var _forTrack02 = ($index, $item) => $item.slug;
function MobileIconBarComponent_Conditional_0_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "a", 1);
    \u0275\u0275domElement(1, "span", 2);
    \u0275\u0275domElementStart(2, "span", 3);
    \u0275\u0275text(3);
    \u0275\u0275domElementEnd()();
  }
  if (rf & 2) {
    const item_r1 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275domProperty("href", ctx_r1.href(item_r1), \u0275\u0275sanitizeUrl);
    \u0275\u0275advance();
    \u0275\u0275domProperty("innerHTML", ctx_r1.icon(item_r1), \u0275\u0275sanitizeHtml);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r1.label(item_r1));
  }
}
function MobileIconBarComponent_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "nav", 0);
    \u0275\u0275repeaterCreate(1, MobileIconBarComponent_Conditional_0_For_2_Template, 4, 3, "a", 1, _forTrack02);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r1.items());
  }
}
var MobileIconBarComponent = class _MobileIconBarComponent {
  constructor() {
    this.nav = inject(NavigationService);
    this.sanitizer = inject(DomSanitizer);
    this.lang = input("en", ...ngDevMode ? [{ debugName: "lang" }] : (
      /* istanbul ignore next */
      []
    ));
    this.items = computed(() => (this.nav.mobileBar()?.list ?? []).filter((i) => i.enabled).slice(0, 5), ...ngDevMode ? [{ debugName: "items" }] : (
      /* istanbul ignore next */
      []
    ));
  }
  label(item) {
    return item.translation?.title?.[this.lang()] || item.name || "";
  }
  href(item) {
    return mobileHref(item.slug, this.lang());
  }
  icon(item) {
    return this.sanitizer.bypassSecurityTrustHtml(item.icon || "");
  }
  static {
    this.\u0275fac = function MobileIconBarComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _MobileIconBarComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _MobileIconBarComponent, selectors: [["app-mobile-icon-bar"]], inputs: { lang: [1, "lang"] }, decls: 1, vars: 1, consts: [[1, "mbar"], [1, "mbar-item", 3, "href"], [1, "mbar-icon", 3, "innerHTML"], [1, "mbar-label"]], template: function MobileIconBarComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275conditionalCreate(0, MobileIconBarComponent_Conditional_0_Template, 3, 0, "nav", 0);
      }
      if (rf & 2) {
        \u0275\u0275conditional(ctx.items().length ? 0 : -1);
      }
    }, dependencies: [CommonModule], styles: ["\n.mbar[_ngcontent-%COMP%] {\n  position: fixed;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  z-index: 300;\n  display: none;\n  align-items: stretch;\n  justify-content: space-around;\n  background: var(--header-bg,#fff);\n  border-top: 1px solid rgba(0, 0, 0, .1);\n  padding: 6px 4px env(safe-area-inset-bottom, 6px);\n}\n.mbar-item[_ngcontent-%COMP%] {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 3px;\n  padding: 4px 2px;\n  color: var(--header-text);\n  text-decoration: none;\n  opacity: .8;\n}\n.mbar-item[_ngcontent-%COMP%]:hover {\n  opacity: 1;\n  color: var(--primary);\n}\n.mbar-icon[_ngcontent-%COMP%] {\n  display: inline-flex;\n}\n.mbar-icon[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {\n  width: 22px;\n  height: 22px;\n}\n.mbar-label[_ngcontent-%COMP%] {\n  font-size: 10px;\n  line-height: 1;\n}\n@media (max-width: 768px) {\n  .mbar[_ngcontent-%COMP%] {\n    display: flex;\n  }\n}\n/*# sourceMappingURL=mobile-icon-bar.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MobileIconBarComponent, [{
    type: Component,
    args: [{ selector: "app-mobile-icon-bar", standalone: true, imports: [CommonModule], changeDetection: ChangeDetectionStrategy.OnPush, template: `
    @if (items().length) {
      <nav class="mbar">
        @for (item of items(); track item.slug) {
          <a class="mbar-item" [href]="href(item)">
            <span class="mbar-icon" [innerHTML]="icon(item)"></span>
            <span class="mbar-label">{{ label(item) }}</span>
          </a>
        }
      </nav>
    }
  `, styles: ["/* angular:styles/component:css;95af66f8985ce3c837dbaecc35d2b952e1c9491035f536583c17fddc169e6983;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/navigation/components/mobile-icon-bar.component.ts */\n.mbar {\n  position: fixed;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  z-index: 300;\n  display: none;\n  align-items: stretch;\n  justify-content: space-around;\n  background: var(--header-bg,#fff);\n  border-top: 1px solid rgba(0, 0, 0, .1);\n  padding: 6px 4px env(safe-area-inset-bottom, 6px);\n}\n.mbar-item {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 3px;\n  padding: 4px 2px;\n  color: var(--header-text);\n  text-decoration: none;\n  opacity: .8;\n}\n.mbar-item:hover {\n  opacity: 1;\n  color: var(--primary);\n}\n.mbar-icon {\n  display: inline-flex;\n}\n.mbar-icon svg {\n  width: 22px;\n  height: 22px;\n}\n.mbar-label {\n  font-size: 10px;\n  line-height: 1;\n}\n@media (max-width: 768px) {\n  .mbar {\n    display: flex;\n  }\n}\n/*# sourceMappingURL=mobile-icon-bar.component.css.map */\n"] }]
  }], null, { lang: [{ type: Input, args: [{ isSignal: true, alias: "lang", required: false }] }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(MobileIconBarComponent, { className: "MobileIconBarComponent", filePath: "src/app/features/navigation/components/mobile-icon-bar.component.ts", lineNumber: 40 });
})();

// src/app/app.component.ts
function AppComponent_Conditional_1_Conditional_8_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-site-nav");
  }
}
function AppComponent_Conditional_1_Conditional_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "nav", 11)(1, "a", 15);
    \u0275\u0275text(2, "Home");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "a", 16);
    \u0275\u0275text(4, "Features");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "a", 16);
    \u0275\u0275text(6, "Pricing");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(7, "a", 16);
    \u0275\u0275text(8, "About");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(9, "a", 17);
    \u0275\u0275text(10, "Blog");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(11, "a", 16);
    \u0275\u0275text(12, "Contact");
    \u0275\u0275elementEnd()();
  }
}
function AppComponent_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "header", 5)(1, "div", 6)(2, "div", 7);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(3, "svg", 8);
    \u0275\u0275element(4, "rect", 9)(5, "path", 10);
    \u0275\u0275elementEnd();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(6, "span");
    \u0275\u0275text(7);
    \u0275\u0275elementEnd()();
    \u0275\u0275conditionalCreate(8, AppComponent_Conditional_1_Conditional_8_Template, 1, 0, "app-site-nav")(9, AppComponent_Conditional_1_Conditional_9_Template, 13, 0, "nav", 11);
    \u0275\u0275elementStart(10, "div", 12)(11, "a", 13);
    \u0275\u0275text(12, "Sign In");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(13, "a", 14);
    \u0275\u0275text(14, "Get Started");
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275classProp("sticky", ctx_r0.settings().stickyHeader);
    \u0275\u0275advance(4);
    \u0275\u0275attribute("fill", ctx_r0.settings().primaryColor);
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r0.settings().siteTitle);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.navHasMenu() ? 8 : 9);
  }
}
function AppComponent_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "footer", 3)(1, "div", 18)(2, "div", 19)(3, "p");
    \u0275\u0275text(4);
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r0.settings().footerText);
  }
}
function AppComponent_Conditional_6_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 4);
    \u0275\u0275text(1, "Preview Mode");
    \u0275\u0275elementEnd();
  }
}
var AppComponent = class _AppComponent {
  constructor(previewService) {
    this.previewService = previewService;
    this.navigationService = inject(NavigationService);
    this.isCustomizeMode = false;
    this.navHasMenu = computed(() => this.navigationService.hasMenu(), ...ngDevMode ? [{ debugName: "navHasMenu" }] : (
      /* istanbul ignore next */
      []
    ));
    this.isCustomizeMode = this.previewService.isCustomizeMode();
  }
  get settings() {
    return this.previewService.globalSettings;
  }
  static {
    this.\u0275fac = function AppComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _AppComponent)(\u0275\u0275directiveInject(PreviewService));
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _AppComponent, selectors: [["app-root"]], decls: 7, vars: 3, consts: [[1, "site-wrapper"], [1, "site-header", 3, "sticky"], [1, "site-main"], [1, "site-footer"], [1, "customize-badge"], [1, "site-header"], [1, "container", "header-content"], [1, "logo"], ["width", "32", "height", "32", "viewBox", "0 0 32 32", "fill", "none"], ["width", "32", "height", "32", "rx", "8"], ["d", "M10 16L14 20L22 12", "stroke", "white", "stroke-width", "2.5", "stroke-linecap", "round", "stroke-linejoin", "round"], [1, "main-nav"], [1, "header-actions"], ["href", "#", 1, "btn", "btn-secondary"], ["href", "#", 1, "btn", "btn-primary"], ["href", "/"], ["href", "#"], ["href", "/blog"], [1, "container"], [1, "footer-bottom"]], template: function AppComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275elementStart(0, "div", 0);
        \u0275\u0275conditionalCreate(1, AppComponent_Conditional_1_Template, 15, 5, "header", 1);
        \u0275\u0275elementStart(2, "main", 2);
        \u0275\u0275element(3, "router-outlet");
        \u0275\u0275elementEnd();
        \u0275\u0275conditionalCreate(4, AppComponent_Conditional_4_Template, 5, 1, "footer", 3);
        \u0275\u0275element(5, "app-mobile-icon-bar");
        \u0275\u0275conditionalCreate(6, AppComponent_Conditional_6_Template, 2, 0, "div", 4);
        \u0275\u0275elementEnd();
      }
      if (rf & 2) {
        \u0275\u0275advance();
        \u0275\u0275conditional(ctx.settings().showHeader ? 1 : -1);
        \u0275\u0275advance(3);
        \u0275\u0275conditional(ctx.settings().showFooter ? 4 : -1);
        \u0275\u0275advance(2);
        \u0275\u0275conditional(ctx.isCustomizeMode ? 6 : -1);
      }
    }, dependencies: [CommonModule, RouterOutlet, SiteNavComponent, MobileIconBarComponent], styles: ["\n.site-wrapper[_ngcontent-%COMP%] {\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n  background: var(--body-bg);\n  color: var(--body-text);\n}\n.container[_ngcontent-%COMP%] {\n  max-width: var(--container-width, 1200px);\n  margin: 0 auto;\n  padding: 0 24px;\n}\n.site-main[_ngcontent-%COMP%] {\n  flex: 1;\n}\n.site-header[_ngcontent-%COMP%] {\n  background: var(--header-bg);\n  height: var(--header-height, 64px);\n  display: flex;\n  align-items: center;\n  border-bottom: 1px solid rgba(0, 0, 0, .1);\n}\n.site-header.sticky[_ngcontent-%COMP%] {\n  position: sticky;\n  top: 0;\n  z-index: 100;\n}\n.header-content[_ngcontent-%COMP%] {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  width: 100%;\n}\n.logo[_ngcontent-%COMP%] {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  font-weight: 700;\n  color: var(--header-text);\n}\n.main-nav[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 32px;\n}\n.main-nav[_ngcontent-%COMP%]   a[_ngcontent-%COMP%] {\n  color: var(--header-text);\n  text-decoration: none;\n  font-size: 14px;\n  opacity: .8;\n}\n.main-nav[_ngcontent-%COMP%]   a[_ngcontent-%COMP%]:hover {\n  opacity: 1;\n}\n.header-actions[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 12px;\n}\n.btn[_ngcontent-%COMP%] {\n  padding: 10px 20px;\n  border-radius: var(--border-radius, 8px);\n  font-size: 14px;\n  text-decoration: none;\n  cursor: pointer;\n}\n.btn-primary[_ngcontent-%COMP%] {\n  background: var(--primary);\n  color: #fff;\n}\n.btn-secondary[_ngcontent-%COMP%] {\n  background: transparent;\n  color: var(--header-text);\n  border: 1px solid rgba(0, 0, 0, .1);\n}\n.site-footer[_ngcontent-%COMP%] {\n  background: var(--header-bg);\n  color: var(--header-text);\n  padding: 60px 0 24px;\n  margin-top: auto;\n}\n.footer-bottom[_ngcontent-%COMP%] {\n  padding-top: 24px;\n  text-align: center;\n}\n.customize-badge[_ngcontent-%COMP%] {\n  position: fixed;\n  bottom: 16px;\n  right: 16px;\n  padding: 8px 14px;\n  background: var(--primary);\n  color: #fff;\n  border-radius: 100px;\n  font-size: 12px;\n  box-shadow: 0 4px 12px rgba(99, 102, 241, .4);\n  z-index: 9999;\n}\n/*# sourceMappingURL=app.component.css.map */"] });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(AppComponent, [{
    type: Component,
    args: [{ selector: "app-root", standalone: true, imports: [CommonModule, RouterOutlet, SiteNavComponent, MobileIconBarComponent], template: `
    <div class="site-wrapper">
      @if (settings().showHeader) {
        <header class="site-header" [class.sticky]="settings().stickyHeader">
          <div class="container header-content">
            <div class="logo">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" [attr.fill]="settings().primaryColor"/>
                <path d="M10 16L14 20L22 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>{{ settings().siteTitle }}</span>
            </div>
            @if (navHasMenu()) {
              <app-site-nav />
            } @else {
              <nav class="main-nav">
                <a href="/">Home</a>
                <a href="#">Features</a>
                <a href="#">Pricing</a>
                <a href="#">About</a>
                <a href="/blog">Blog</a>
                <a href="#">Contact</a>
              </nav>
            }
            <div class="header-actions">
              <a href="#" class="btn btn-secondary">Sign In</a>
              <a href="#" class="btn btn-primary">Get Started</a>
            </div>
          </div>
        </header>
      }

      <main class="site-main"><router-outlet></router-outlet></main>

      @if (settings().showFooter) {
        <footer class="site-footer">
          <div class="container">
            <div class="footer-bottom">
              <p>{{ settings().footerText }}</p>
            </div>
          </div>
        </footer>
      }

      <app-mobile-icon-bar />

      @if (isCustomizeMode) {
        <div class="customize-badge">Preview Mode</div>
      }
    </div>
  `, styles: ["/* angular:styles/component:css;16e720e50cd915d018c727aa57a78ed91d9a9beeadb9932f38d6fbe22a9be565;D:/Users/Invo/Downloads/angular-customizer/website/src/app/app.component.ts */\n.site-wrapper {\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n  background: var(--body-bg);\n  color: var(--body-text);\n}\n.container {\n  max-width: var(--container-width, 1200px);\n  margin: 0 auto;\n  padding: 0 24px;\n}\n.site-main {\n  flex: 1;\n}\n.site-header {\n  background: var(--header-bg);\n  height: var(--header-height, 64px);\n  display: flex;\n  align-items: center;\n  border-bottom: 1px solid rgba(0, 0, 0, .1);\n}\n.site-header.sticky {\n  position: sticky;\n  top: 0;\n  z-index: 100;\n}\n.header-content {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  width: 100%;\n}\n.logo {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  font-weight: 700;\n  color: var(--header-text);\n}\n.main-nav {\n  display: flex;\n  gap: 32px;\n}\n.main-nav a {\n  color: var(--header-text);\n  text-decoration: none;\n  font-size: 14px;\n  opacity: .8;\n}\n.main-nav a:hover {\n  opacity: 1;\n}\n.header-actions {\n  display: flex;\n  gap: 12px;\n}\n.btn {\n  padding: 10px 20px;\n  border-radius: var(--border-radius, 8px);\n  font-size: 14px;\n  text-decoration: none;\n  cursor: pointer;\n}\n.btn-primary {\n  background: var(--primary);\n  color: #fff;\n}\n.btn-secondary {\n  background: transparent;\n  color: var(--header-text);\n  border: 1px solid rgba(0, 0, 0, .1);\n}\n.site-footer {\n  background: var(--header-bg);\n  color: var(--header-text);\n  padding: 60px 0 24px;\n  margin-top: auto;\n}\n.footer-bottom {\n  padding-top: 24px;\n  text-align: center;\n}\n.customize-badge {\n  position: fixed;\n  bottom: 16px;\n  right: 16px;\n  padding: 8px 14px;\n  background: var(--primary);\n  color: #fff;\n  border-radius: 100px;\n  font-size: 12px;\n  box-shadow: 0 4px 12px rgba(99, 102, 241, .4);\n  z-index: 9999;\n}\n/*# sourceMappingURL=app.component.css.map */\n"] }]
  }], () => [{ type: PreviewService }], null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(AppComponent, { className: "AppComponent", filePath: "src/app/app.component.ts", lineNumber: 95 });
})();

// src/app/features/blog/blog.routes.ts
var BLOG_CHILDREN = [
  __spreadValues({ path: "", loadComponent: () => import("./blog-index.component-XNOL6JPB.js").then((m) => m.BlogIndexPage) }, false ? { \u0275entryName: "src/app/features/blog/pages/blog-index.component.ts" } : {}),
  __spreadValues({ path: "search", loadComponent: () => import("./search.component-ZXBPTCGI.js").then((m) => m.SearchPage) }, false ? { \u0275entryName: "src/app/features/blog/pages/search.component.ts" } : {}),
  __spreadValues({ path: "category/:categorySlug", loadComponent: () => import("./category.component-OTDN5OGI.js").then((m) => m.CategoryPage) }, false ? { \u0275entryName: "src/app/features/blog/pages/category.component.ts" } : {}),
  __spreadValues({ path: "tag/:tagSlug", loadComponent: () => import("./tag.component-PJDWNJXZ.js").then((m) => m.TagPage) }, false ? { \u0275entryName: "src/app/features/blog/pages/tag.component.ts" } : {}),
  __spreadValues({ path: "authors/:authorEmployeeId", loadComponent: () => import("./author.component-QZYLS6DA.js").then((m) => m.AuthorPage) }, false ? { \u0275entryName: "src/app/features/blog/pages/author.component.ts" } : {}),
  __spreadValues({ path: ":slug", loadComponent: () => import("./post.component-U5PEJR6K.js").then((m) => m.PostPage) }, false ? { \u0275entryName: "src/app/features/blog/pages/post.component.ts" } : {})
];
var langGuard = (route) => __async(null, null, function* () {
  const settings = yield inject(BlogSettingsService).load();
  const lang = route.paramMap.get("lang");
  const supported = settings.languages.supported;
  if (!lang || !supported.includes(lang)) {
    inject(Router).navigateByUrl(`/${settings.languages.default}/blog`);
    return false;
  }
  return true;
});
var BLOG_ROUTES = [
  {
    path: ":lang/blog",
    canActivate: [langGuard],
    children: BLOG_CHILDREN
  }
];

// src/app/app.routes.ts
function browserPreferredLang(supported) {
  if (typeof navigator === "undefined")
    return null;
  const prefs = (navigator.languages?.length ? navigator.languages : [navigator.language]).filter(Boolean);
  const set = new Set(supported);
  for (const p of prefs) {
    const code = String(p).toLowerCase().split("-")[0];
    if (set.has(code))
      return code;
  }
  return null;
}
function defaultLang() {
  return __async(this, null, function* () {
    const svc = inject(BlogSettingsService);
    const onServer = isPlatformServer(inject(PLATFORM_ID));
    if (!svc.loaded() && onServer)
      return "en";
    let langs;
    try {
      langs = (svc.loaded() ? svc.settings() : yield svc.load()).languages;
    } catch (e) {
      return "en";
    }
    if (langs.autoSwitch && !onServer) {
      const pref = browserPreferredLang(langs.supported);
      if (pref)
        return pref;
    }
    return langs.default;
  });
}
var isParamMode = () => __async(null, null, function* () {
  const svc = inject(BlogSettingsService);
  if (!svc.loaded() && isPlatformServer(inject(PLATFORM_ID)))
    return false;
  try {
    const s = svc.loaded() ? svc.settings() : yield svc.load();
    return s.languages.urlStructure === "parameter";
  } catch (e) {
    return false;
  }
});
function currentQueryParams(router) {
  return router.currentNavigation()?.initialUrl.queryParams ?? {};
}
var rootRedirect = () => __async(null, null, function* () {
  const router = inject(Router);
  const queryParams = currentQueryParams(router);
  return router.createUrlTree([yield defaultLang()], { queryParams });
});
var langGuard2 = (route, state) => __async(null, null, function* () {
  const router = inject(Router);
  const svc = inject(BlogSettingsService);
  if (!svc.loaded() && isPlatformServer(inject(PLATFORM_ID)))
    return true;
  const settings = yield svc.load();
  const lang = route.paramMap.get("lang");
  if (lang && settings.languages.supported.includes(lang))
    return true;
  return router.parseUrl(`/${settings.languages.default}${state.url}`);
});
var langlessRedirect = (_route, segments) => __async(null, null, function* () {
  if (!segments.length)
    return false;
  const router = inject(Router);
  const svc = inject(BlogSettingsService);
  if (!svc.loaded() && isPlatformServer(inject(PLATFORM_ID)))
    return false;
  const settings = svc.loaded() ? svc.settings() : yield svc.load();
  if (settings.languages.urlStructure === "parameter")
    return false;
  if (settings.languages.supported.includes(segments[0].path))
    return false;
  return router.createUrlTree([settings.languages.default, ...segments.map((s) => s.path)], { queryParams: currentQueryParams(router) });
});
var APP_ROUTES = [
  // ── Parameter mode (lang in ?lang=, default is clean) ─────────────────
  // Declared first + gated on isParamMode so they win only in parameter mode.
  __spreadValues({
    path: "",
    pathMatch: "full",
    canMatch: [isParamMode],
    loadComponent: () => import("./customizer-root.component-HNQ3B4BX.js").then((m) => m.CustomizerRoot)
  }, false ? { \u0275entryName: "src/app/customizer-root.component.ts" } : {}),
  {
    path: "blog",
    canMatch: [isParamMode],
    children: BLOG_CHILDREN
  },
  __spreadValues({
    path: ":page",
    canMatch: [isParamMode],
    loadComponent: () => import("./customizer-root.component-HNQ3B4BX.js").then((m) => m.CustomizerRoot)
  }, false ? { \u0275entryName: "src/app/customizer-root.component.ts" } : {}),
  // ── Subdirectory mode + lang-less entry points ────────────────────────
  { path: "", pathMatch: "full", canMatch: [rootRedirect], children: [] },
  // Lang-less blog entry — render the DEFAULT language's blog directly at
  // `/blog` (no redirect to `/:lang/blog`). The blog pages resolve the active
  // language from the `:lang` segment / `?lang=` query, falling back to the
  // default when neither is present, so `/blog` serves the default language.
  { path: "blog", children: BLOG_CHILDREN },
  // Blog at /:lang/blog/* — before ":lang/:page" so "blog" is never a page slug.
  ...BLOG_ROUTES,
  // Storefront home + arbitrary page (customizer canvas, CSR).
  __spreadValues({
    path: ":lang",
    canActivate: [langGuard2],
    loadComponent: () => import("./customizer-root.component-HNQ3B4BX.js").then((m) => m.CustomizerRoot)
  }, false ? { \u0275entryName: "src/app/customizer-root.component.ts" } : {}),
  __spreadValues({
    path: ":lang/:page",
    canActivate: [langGuard2],
    loadComponent: () => import("./customizer-root.component-HNQ3B4BX.js").then((m) => m.CustomizerRoot)
  }, false ? { \u0275entryName: "src/app/customizer-root.component.ts" } : {}),
  // Legacy lang-less deep links → prepend default language (subdirectory only).
  { path: "**", canMatch: [langlessRedirect], children: [] },
  __spreadValues({ path: "**", loadComponent: () => import("./not-found.component-VUNVASDH.js").then((m) => m.NotFoundPage) }, false ? { \u0275entryName: "src/app/features/blog/pages/not-found.component.ts" } : {})
];

// src/app/app.config.ts
function getAppConfig(http) {
  return __async(this, null, function* () {
    const fallback = { subdomain: "" };
    try {
      const result = yield firstValueFrom(http.get("./assets/config.json").pipe(catchError(() => of(fallback))));
      return result ?? fallback;
    } catch (e) {
      return fallback;
    }
  });
}
var appConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Single HttpClient instance with fetch — required for SSR's
    // request-context forwarding. Declared BEFORE APP_CONFIG so the
    // factory below sees it.
    provideHttpClient(withFetch()),
    {
      provide: APP_CONFIG,
      useFactory: (http) => getAppConfig(http),
      deps: [HttpClient]
    },
    // Resolve the tenant slug once, before routing fires any blog request.
    // Mirrors oldEco's initializeApp (subdomain / localhost / custom domain).
    provideAppInitializer(() => inject(TenantService).resolve()),
    // Warm blog settings on every route (browser only) so site-wide
    // analytics (GA4 / Search Console) initialise even on non-blog
    // pages like the storefront root. MUST await tenant resolution first
    // — otherwise this races resolve() and fires getSettings with an
    // empty slug (→ /v1/ecommerce//…), 404ing and poisoning the one-shot
    // settings cache. resolve() is idempotent (shared promise), so this
    // doesn't duplicate the work. Fire-and-forget after that.
    provideAppInitializer(() => {
      if (!isPlatformBrowser(inject(PLATFORM_ID)))
        return;
      const tenant = inject(TenantService);
      const settings = inject(BlogSettingsService);
      void tenant.resolve().then(() => settings.load());
    }),
    // Warm the storefront navigation (browser only) after the tenant
    // slug resolves, so the header paints the published menu without a
    // per-route fetch. In customize mode load() no-ops (menus stream in
    // over postMessage instead). Fire-and-forget — nav is non-critical.
    provideAppInitializer(() => {
      if (!isPlatformBrowser(inject(PLATFORM_ID)))
        return;
      const tenant = inject(TenantService);
      const navigation = inject(NavigationService);
      void tenant.resolve().then(() => navigation.load());
    }),
    provideRouter(APP_ROUTES, withInMemoryScrolling({
      scrollPositionRestoration: "top",
      anchorScrolling: "enabled"
    })),
    provideClientHydration(withEventReplay(), withHttpTransferCacheOptions({ includePostRequests: true }))
  ]
};

// src/main.ts
bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
//# sourceMappingURL=main.js.map
