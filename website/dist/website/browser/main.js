import {
  Router,
  RouterOutlet,
  bootstrapApplication,
  provideClientHydration,
  provideRouter,
  withEventReplay,
  withHttpTransferCacheOptions,
  withInMemoryScrolling
} from "./chunk-J6HYFAOQ.js";
import {
  PreviewService
} from "./chunk-YYKBQZDZ.js";
import {
  BlogSettingsService
} from "./chunk-3I43LW5T.js";
import {
  CommonModule,
  Component,
  HttpClient,
  InjectionToken,
  __async,
  __spreadValues,
  catchError,
  firstValueFrom,
  inject,
  of,
  provideHttpClient,
  provideZoneChangeDetection,
  setClassMetadata,
  withFetch,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵattribute,
  ɵɵclassProp,
  ɵɵconditional,
  ɵɵconditionalCreate,
  ɵɵdefineComponent,
  ɵɵdirectiveInject,
  ɵɵelement,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵnamespaceHTML,
  ɵɵnamespaceSVG,
  ɵɵnextContext,
  ɵɵtext,
  ɵɵtextInterpolate
} from "./chunk-K3KK4KPM.js";

// src/app/app.component.ts
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
    \u0275\u0275elementStart(8, "nav", 11)(9, "a", 12);
    \u0275\u0275text(10, "Home");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(11, "a", 13);
    \u0275\u0275text(12, "Features");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(13, "a", 13);
    \u0275\u0275text(14, "Pricing");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(15, "a", 13);
    \u0275\u0275text(16, "About");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(17, "a", 14);
    \u0275\u0275text(18, "Blog");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(19, "a", 13);
    \u0275\u0275text(20, "Contact");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(21, "div", 15)(22, "a", 16);
    \u0275\u0275text(23, "Sign In");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(24, "a", 17);
    \u0275\u0275text(25, "Get Started");
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275classProp("sticky", ctx_r0.settings().stickyHeader);
    \u0275\u0275advance(4);
    \u0275\u0275attribute("fill", ctx_r0.settings().primaryColor);
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r0.settings().siteTitle);
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
function AppComponent_Conditional_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 4);
    \u0275\u0275text(1, "Preview Mode");
    \u0275\u0275elementEnd();
  }
}
var AppComponent = class _AppComponent {
  constructor(previewService) {
    this.previewService = previewService;
    this.isCustomizeMode = false;
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
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _AppComponent, selectors: [["app-root"]], decls: 6, vars: 3, consts: [[1, "site-wrapper"], [1, "site-header", 3, "sticky"], [1, "site-main"], [1, "site-footer"], [1, "customize-badge"], [1, "site-header"], [1, "container", "header-content"], [1, "logo"], ["width", "32", "height", "32", "viewBox", "0 0 32 32", "fill", "none"], ["width", "32", "height", "32", "rx", "8"], ["d", "M10 16L14 20L22 12", "stroke", "white", "stroke-width", "2.5", "stroke-linecap", "round", "stroke-linejoin", "round"], [1, "main-nav"], ["href", "/"], ["href", "#"], ["href", "/blog"], [1, "header-actions"], ["href", "#", 1, "btn", "btn-secondary"], ["href", "#", 1, "btn", "btn-primary"], [1, "container"], [1, "footer-bottom"]], template: function AppComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275elementStart(0, "div", 0);
        \u0275\u0275conditionalCreate(1, AppComponent_Conditional_1_Template, 26, 4, "header", 1);
        \u0275\u0275elementStart(2, "main", 2);
        \u0275\u0275element(3, "router-outlet");
        \u0275\u0275elementEnd();
        \u0275\u0275conditionalCreate(4, AppComponent_Conditional_4_Template, 5, 1, "footer", 3);
        \u0275\u0275conditionalCreate(5, AppComponent_Conditional_5_Template, 2, 0, "div", 4);
        \u0275\u0275elementEnd();
      }
      if (rf & 2) {
        \u0275\u0275advance();
        \u0275\u0275conditional(ctx.settings().showHeader ? 1 : -1);
        \u0275\u0275advance(3);
        \u0275\u0275conditional(ctx.settings().showFooter ? 4 : -1);
        \u0275\u0275advance();
        \u0275\u0275conditional(ctx.isCustomizeMode ? 5 : -1);
      }
    }, dependencies: [CommonModule, RouterOutlet], styles: ["\n.site-wrapper[_ngcontent-%COMP%] {\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n  background: var(--body-bg);\n  color: var(--body-text);\n}\n.container[_ngcontent-%COMP%] {\n  max-width: var(--container-width, 1200px);\n  margin: 0 auto;\n  padding: 0 24px;\n}\n.site-main[_ngcontent-%COMP%] {\n  flex: 1;\n}\n.site-header[_ngcontent-%COMP%] {\n  background: var(--header-bg);\n  height: var(--header-height, 64px);\n  display: flex;\n  align-items: center;\n  border-bottom: 1px solid rgba(0, 0, 0, .1);\n}\n.site-header.sticky[_ngcontent-%COMP%] {\n  position: sticky;\n  top: 0;\n  z-index: 100;\n}\n.header-content[_ngcontent-%COMP%] {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  width: 100%;\n}\n.logo[_ngcontent-%COMP%] {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  font-weight: 700;\n  color: var(--header-text);\n}\n.main-nav[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 32px;\n}\n.main-nav[_ngcontent-%COMP%]   a[_ngcontent-%COMP%] {\n  color: var(--header-text);\n  text-decoration: none;\n  font-size: 14px;\n  opacity: .8;\n}\n.main-nav[_ngcontent-%COMP%]   a[_ngcontent-%COMP%]:hover {\n  opacity: 1;\n}\n.header-actions[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 12px;\n}\n.btn[_ngcontent-%COMP%] {\n  padding: 10px 20px;\n  border-radius: var(--border-radius, 8px);\n  font-size: 14px;\n  text-decoration: none;\n  cursor: pointer;\n}\n.btn-primary[_ngcontent-%COMP%] {\n  background: var(--primary);\n  color: #fff;\n}\n.btn-secondary[_ngcontent-%COMP%] {\n  background: transparent;\n  color: var(--header-text);\n  border: 1px solid rgba(0, 0, 0, .1);\n}\n.site-footer[_ngcontent-%COMP%] {\n  background: var(--header-bg);\n  color: var(--header-text);\n  padding: 60px 0 24px;\n  margin-top: auto;\n}\n.footer-bottom[_ngcontent-%COMP%] {\n  padding-top: 24px;\n  text-align: center;\n}\n.customize-badge[_ngcontent-%COMP%] {\n  position: fixed;\n  bottom: 16px;\n  right: 16px;\n  padding: 8px 14px;\n  background: var(--primary);\n  color: #fff;\n  border-radius: 100px;\n  font-size: 12px;\n  box-shadow: 0 4px 12px rgba(99, 102, 241, .4);\n  z-index: 9999;\n}\n/*# sourceMappingURL=app.component.css.map */"] });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(AppComponent, [{
    type: Component,
    args: [{ selector: "app-root", standalone: true, imports: [CommonModule, RouterOutlet], template: `
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
            <nav class="main-nav">
              <a href="/">Home</a>
              <a href="#">Features</a>
              <a href="#">Pricing</a>
              <a href="#">About</a>
              <a href="/blog">Blog</a>
              <a href="#">Contact</a>
            </nav>
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

      @if (isCustomizeMode) {
        <div class="customize-badge">Preview Mode</div>
      }
    </div>
  `, styles: ["/* angular:styles/component:css;16e720e50cd915d018c727aa57a78ed91d9a9beeadb9932f38d6fbe22a9be565;D:/Users/Invo/Downloads/angular-customizer/website/src/app/app.component.ts */\n.site-wrapper {\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n  background: var(--body-bg);\n  color: var(--body-text);\n}\n.container {\n  max-width: var(--container-width, 1200px);\n  margin: 0 auto;\n  padding: 0 24px;\n}\n.site-main {\n  flex: 1;\n}\n.site-header {\n  background: var(--header-bg);\n  height: var(--header-height, 64px);\n  display: flex;\n  align-items: center;\n  border-bottom: 1px solid rgba(0, 0, 0, .1);\n}\n.site-header.sticky {\n  position: sticky;\n  top: 0;\n  z-index: 100;\n}\n.header-content {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  width: 100%;\n}\n.logo {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  font-weight: 700;\n  color: var(--header-text);\n}\n.main-nav {\n  display: flex;\n  gap: 32px;\n}\n.main-nav a {\n  color: var(--header-text);\n  text-decoration: none;\n  font-size: 14px;\n  opacity: .8;\n}\n.main-nav a:hover {\n  opacity: 1;\n}\n.header-actions {\n  display: flex;\n  gap: 12px;\n}\n.btn {\n  padding: 10px 20px;\n  border-radius: var(--border-radius, 8px);\n  font-size: 14px;\n  text-decoration: none;\n  cursor: pointer;\n}\n.btn-primary {\n  background: var(--primary);\n  color: #fff;\n}\n.btn-secondary {\n  background: transparent;\n  color: var(--header-text);\n  border: 1px solid rgba(0, 0, 0, .1);\n}\n.site-footer {\n  background: var(--header-bg);\n  color: var(--header-text);\n  padding: 60px 0 24px;\n  margin-top: auto;\n}\n.footer-bottom {\n  padding-top: 24px;\n  text-align: center;\n}\n.customize-badge {\n  position: fixed;\n  bottom: 16px;\n  right: 16px;\n  padding: 8px 14px;\n  background: var(--primary);\n  color: #fff;\n  border-radius: 100px;\n  font-size: 12px;\n  box-shadow: 0 4px 12px rgba(99, 102, 241, .4);\n  z-index: 9999;\n}\n/*# sourceMappingURL=app.component.css.map */\n"] }]
  }], () => [{ type: PreviewService }], null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(AppComponent, { className: "AppComponent", filePath: "src/app/app.component.ts", lineNumber: 86 });
})();

// src/app/features/blog/blog.routes.ts
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
    children: [
      __spreadValues({
        path: "",
        loadComponent: () => import("./blog-index.component-LQBNZXQ6.js").then((m) => m.BlogIndexPage)
      }, false ? { \u0275entryName: "src/app/features/blog/pages/blog-index.component.ts" } : {}),
      __spreadValues({
        path: "search",
        loadComponent: () => import("./search.component-ITBADC33.js").then((m) => m.SearchPage)
      }, false ? { \u0275entryName: "src/app/features/blog/pages/search.component.ts" } : {}),
      __spreadValues({
        path: "category/:categorySlug",
        loadComponent: () => import("./category.component-46GU5ZG5.js").then((m) => m.CategoryPage)
      }, false ? { \u0275entryName: "src/app/features/blog/pages/category.component.ts" } : {}),
      __spreadValues({
        path: "tag/:tagSlug",
        loadComponent: () => import("./tag.component-B32T5SET.js").then((m) => m.TagPage)
      }, false ? { \u0275entryName: "src/app/features/blog/pages/tag.component.ts" } : {}),
      __spreadValues({
        path: "authors/:authorEmployeeId",
        loadComponent: () => import("./author.component-MS356A7O.js").then((m) => m.AuthorPage)
      }, false ? { \u0275entryName: "src/app/features/blog/pages/author.component.ts" } : {}),
      __spreadValues({
        path: ":slug",
        loadComponent: () => import("./post.component-VYDWZZVQ.js").then((m) => m.PostPage)
      }, false ? { \u0275entryName: "src/app/features/blog/pages/post.component.ts" } : {})
    ]
  }
];

// src/app/app.routes.ts
var blogRedirectMatcher = () => __async(null, null, function* () {
  const router = inject(Router);
  try {
    const s = yield inject(BlogSettingsService).load();
    return router.parseUrl(`/${s.languages.default}/blog`);
  } catch (e) {
    return router.parseUrl("/en/blog");
  }
});
var APP_ROUTES = [
  ...BLOG_ROUTES,
  {
    path: "blog",
    canMatch: [blogRedirectMatcher],
    children: []
  },
  __spreadValues({ path: "", loadComponent: () => import("./customizer-root.component-FDN3SXJF.js").then((m) => m.CustomizerRoot) }, false ? { \u0275entryName: "src/app/customizer-root.component.ts" } : {}),
  __spreadValues({ path: "**", loadComponent: () => import("./not-found.component-KPB7FMAD.js").then((m) => m.NotFoundPage) }, false ? { \u0275entryName: "src/app/features/blog/pages/not-found.component.ts" } : {})
];

// src/app/app-config.token.ts
var APP_CONFIG = new InjectionToken("APP_CONFIG");

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
