import {
  environment
} from "./chunk-3I43LW5T.js";
import {
  Injectable,
  PLATFORM_ID,
  __spreadValues,
  computed,
  inject,
  isPlatformBrowser,
  setClassMetadata,
  signal,
  ɵɵdefineInjectable
} from "./chunk-K3KK4KPM.js";

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
      case "reset":
        this.applyPageData({
          globalSettings: DEFAULT_GLOBAL_SETTINGS,
          components: []
        });
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

export {
  COMPONENT_NAMES,
  PreviewService
};
//# sourceMappingURL=chunk-YYKBQZDZ.js.map
