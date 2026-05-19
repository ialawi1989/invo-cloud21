import {
  BlogSettingsService
} from "./chunk-UE6T3AV7.js";
import {
  HttpClient,
  Router,
  RouterOutlet,
  bootstrapApplication,
  provideClientHydration,
  provideHttpClient,
  provideRouter,
  withEventReplay,
  withFetch,
  withHttpTransferCacheOptions,
  withInMemoryScrolling
} from "./chunk-7WQMHQA2.js";
import "./chunk-I6ZQWZOV.js";
import {
  Component,
  InjectionToken,
  __async,
  __spreadValues,
  catchError,
  firstValueFrom,
  inject,
  of,
  provideZoneChangeDetection,
  setClassMetadata,
  ɵsetClassDebugInfo,
  ɵɵdefineComponent,
  ɵɵelement
} from "./chunk-KXHDM2EU.js";

// src/app/app.component.ts
var AppComponent = class _AppComponent {
  static {
    this.\u0275fac = function AppComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _AppComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _AppComponent, selectors: [["app-root"]], decls: 1, vars: 0, template: function AppComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275element(0, "router-outlet");
      }
    }, dependencies: [RouterOutlet], encapsulation: 2 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(AppComponent, [{
    type: Component,
    args: [{
      selector: "app-root",
      standalone: true,
      imports: [RouterOutlet],
      template: `<router-outlet></router-outlet>`
    }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(AppComponent, { className: "AppComponent", filePath: "src/app/app.component.ts", lineNumber: 10 });
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
        loadComponent: () => import("./blog-index.component-U3HZNUD6.js").then((m) => m.BlogIndexPage)
      }, false ? { \u0275entryName: "src/app/features/blog/pages/blog-index.component.ts" } : {}),
      __spreadValues({
        path: "search",
        loadComponent: () => import("./search.component-2RXIADJZ.js").then((m) => m.SearchPage)
      }, false ? { \u0275entryName: "src/app/features/blog/pages/search.component.ts" } : {}),
      __spreadValues({
        path: "category/:categorySlug",
        loadComponent: () => import("./category.component-TIJ5BWAU.js").then((m) => m.CategoryPage)
      }, false ? { \u0275entryName: "src/app/features/blog/pages/category.component.ts" } : {}),
      __spreadValues({
        path: "tag/:tagSlug",
        loadComponent: () => import("./tag.component-BDF7SLOR.js").then((m) => m.TagPage)
      }, false ? { \u0275entryName: "src/app/features/blog/pages/tag.component.ts" } : {}),
      __spreadValues({
        path: "authors/:authorEmployeeId",
        loadComponent: () => import("./author.component-XF6UT2DV.js").then((m) => m.AuthorPage)
      }, false ? { \u0275entryName: "src/app/features/blog/pages/author.component.ts" } : {}),
      __spreadValues({
        path: ":slug",
        loadComponent: () => import("./post.component-TYOCKVUO.js").then((m) => m.PostPage)
      }, false ? { \u0275entryName: "src/app/features/blog/pages/post.component.ts" } : {})
    ]
  }
];

// src/app/app.routes.ts
var blogRedirectMatcher = () => __async(null, null, function* () {
  const s = yield inject(BlogSettingsService).load();
  return inject(Router).parseUrl(`/${s.languages.default}/blog`);
});
var APP_ROUTES = [
  ...BLOG_ROUTES,
  {
    path: "blog",
    canMatch: [blogRedirectMatcher],
    children: []
  },
  __spreadValues({ path: "", loadComponent: () => import("./customizer-root.component-Q27TFCZJ.js").then((m) => m.CustomizerRoot) }, false ? { \u0275entryName: "src/app/customizer-root.component.ts" } : {}),
  __spreadValues({ path: "**", loadComponent: () => import("./not-found.component-QBGL7RU3.js").then((m) => m.NotFoundPage) }, false ? { \u0275entryName: "src/app/features/blog/pages/not-found.component.ts" } : {})
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
