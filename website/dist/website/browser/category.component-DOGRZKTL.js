import {
  LayoutRendererComponent,
  PaginationComponent
} from "./chunk-KS3HTVUL.js";
import {
  BlogHeaderComponent,
  BlogSeoService,
  ErrorBannerComponent,
  LoadingSkeletonComponent
} from "./chunk-GZS2IXPU.js";
import {
  t
} from "./chunk-TUMDR5WP.js";
import {
  ActivatedRoute,
  BlogSettingsService,
  ChangeDetectionStrategy,
  CommonModule,
  Component,
  PublicBlogApiService,
  Router,
  RouterLink,
  __async,
  combineLatest,
  computed,
  distinctUntilChanged,
  environment,
  inject,
  map,
  setClassMetadata,
  signal,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵconditional,
  ɵɵconditionalCreate,
  ɵɵdefineComponent,
  ɵɵelement,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵgetCurrentView,
  ɵɵlistener,
  ɵɵnextContext,
  ɵɵproperty,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵstyleProp,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1
} from "./chunk-FZE75RKO.js";

// src/app/features/blog/pages/category.component.ts
function CategoryPage_Conditional_0_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-loading-skeleton", 3);
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275property("count", ctx_r0.display().postsPerPage);
  }
}
function CategoryPage_Conditional_0_Conditional_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "h1");
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang(), "404_title"));
  }
}
function CategoryPage_Conditional_0_Conditional_6_Template(rf, ctx) {
  if (rf & 1) {
    const _r2 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "app-error-banner", 5);
    \u0275\u0275listener("retry", function CategoryPage_Conditional_0_Conditional_6_Template_app_error_banner_retry_0_listener() {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.load());
    });
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275property("lang", ctx_r0.lang())("showRetry", true);
  }
}
function CategoryPage_Conditional_0_Conditional_7_Conditional_0_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p");
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const r_r4 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(r_r4.category.description);
  }
}
function CategoryPage_Conditional_0_Conditional_7_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "header", 6)(1, "div", 7)(2, "h1");
    \u0275\u0275text(3);
    \u0275\u0275elementEnd();
    \u0275\u0275conditionalCreate(4, CategoryPage_Conditional_0_Conditional_7_Conditional_0_Conditional_4_Template, 2, 1, "p");
    \u0275\u0275elementEnd()();
    \u0275\u0275element(5, "app-layout-renderer", 8);
    \u0275\u0275elementStart(6, "app-pagination", 9);
    \u0275\u0275listener("pageChange", function CategoryPage_Conditional_0_Conditional_7_Conditional_0_Template_app_pagination_pageChange_6_listener($event) {
      \u0275\u0275restoreView(_r3);
      const ctx_r0 = \u0275\u0275nextContext(3);
      return \u0275\u0275resetView(ctx_r0.goToPage($event));
    });
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const r_r4 = ctx;
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275styleProp("background-image", r_r4.category.image ? "url(" + r_r4.category.image + ")" : null);
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(r_r4.category.name);
    \u0275\u0275advance();
    \u0275\u0275conditional(r_r4.category.description ? 4 : -1);
    \u0275\u0275advance();
    \u0275\u0275property("posts", r_r4.data)("layout", ctx_r0.categoryLayout())("lang", ctx_r0.lang())("display", ctx_r0.display())("mobile", ctx_r0.mobile());
    \u0275\u0275advance();
    \u0275\u0275property("page", ctx_r0.page())("pageCount", r_r4.pagination.totalPages)("lang", ctx_r0.lang());
  }
}
function CategoryPage_Conditional_0_Conditional_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275conditionalCreate(0, CategoryPage_Conditional_0_Conditional_7_Conditional_0_Template, 7, 12);
  }
  if (rf & 2) {
    let tmp_2_0;
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275conditional((tmp_2_0 = ctx_r0.result()) ? 0 : -1, tmp_2_0);
  }
}
function CategoryPage_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-blog-header", 0);
    \u0275\u0275elementStart(1, "div", 1)(2, "a", 2);
    \u0275\u0275text(3);
    \u0275\u0275elementEnd();
    \u0275\u0275conditionalCreate(4, CategoryPage_Conditional_0_Conditional_4_Template, 1, 1, "app-loading-skeleton", 3)(5, CategoryPage_Conditional_0_Conditional_5_Template, 2, 1, "h1")(6, CategoryPage_Conditional_0_Conditional_6_Template, 1, 2, "app-error-banner", 4)(7, CategoryPage_Conditional_0_Conditional_7_Template, 1, 1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275property("lang", ctx_r0.lang())("siteName", ctx_r0.siteName())("languages", ctx_r0.supportedLangs());
    \u0275\u0275advance(2);
    \u0275\u0275property("routerLink", ctx_r0.blogLink());
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1("\u2190 ", ctx_r0.t(ctx_r0.lang(), "back_to_blog"));
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.loading() && !ctx_r0.result() ? 4 : ctx_r0.notFound() ? 5 : ctx_r0.error() ? 6 : 7);
  }
}
var CategoryPage = class _CategoryPage {
  constructor() {
    this.api = inject(PublicBlogApiService);
    this.settingsSvc = inject(BlogSettingsService);
    this.seo = inject(BlogSeoService);
    this.route = inject(ActivatedRoute);
    this.router = inject(Router);
    this.lang = signal("en", ...ngDevMode ? [{ debugName: "lang" }] : (
      /* istanbul ignore next */
      []
    ));
    this.slug = signal("", ...ngDevMode ? [{ debugName: "slug" }] : (
      /* istanbul ignore next */
      []
    ));
    this.page = signal(1, ...ngDevMode ? [{ debugName: "page" }] : (
      /* istanbul ignore next */
      []
    ));
    this.result = signal(null, ...ngDevMode ? [{ debugName: "result" }] : (
      /* istanbul ignore next */
      []
    ));
    this.loading = signal(true, ...ngDevMode ? [{ debugName: "loading" }] : (
      /* istanbul ignore next */
      []
    ));
    this.error = signal(null, ...ngDevMode ? [{ debugName: "error" }] : (
      /* istanbul ignore next */
      []
    ));
    this.notFound = signal(false, ...ngDevMode ? [{ debugName: "notFound" }] : (
      /* istanbul ignore next */
      []
    ));
    this.settingsLoaded = signal(false, ...ngDevMode ? [{ debugName: "settingsLoaded" }] : (
      /* istanbul ignore next */
      []
    ));
    this.display = computed(() => this.settingsSvc.settings().display, ...ngDevMode ? [{ debugName: "display" }] : (
      /* istanbul ignore next */
      []
    ));
    this.mobile = computed(() => this.settingsSvc.settings().mobile, ...ngDevMode ? [{ debugName: "mobile" }] : (
      /* istanbul ignore next */
      []
    ));
    this.categoryLayout = computed(() => this.settingsSvc.settings().layouts.categoryFeed, ...ngDevMode ? [{ debugName: "categoryLayout" }] : (
      /* istanbul ignore next */
      []
    ));
    this.supportedLangs = computed(() => this.settingsSvc.settings().languages.supported, ...ngDevMode ? [{ debugName: "supportedLangs" }] : (
      /* istanbul ignore next */
      []
    ));
    this.siteName = computed(() => this.settingsSvc.settings().siteName ?? environment.siteName, ...ngDevMode ? [{ debugName: "siteName" }] : (
      /* istanbul ignore next */
      []
    ));
    this.t = t;
    this.blogLink = (...segments) => this.settingsSvc.blogLink(this.lang(), ...segments);
  }
  ngOnInit() {
    return __async(this, null, function* () {
      combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(map(([p, q]) => ({ lang: p.get("lang") || q.get("lang") || "en", slug: p.get("categorySlug") ?? "" })), distinctUntilChanged((a, b) => a.lang === b.lang && a.slug === b.slug)).subscribe(({ lang, slug }) => {
        this.lang.set(lang);
        this.slug.set(slug);
        this.bootstrap();
      });
      this.route.queryParamMap.subscribe((q) => {
        const p = Number(q.get("page") ?? "1") || 1;
        if (p !== this.page()) {
          this.page.set(p);
          this.load();
        }
      });
    });
  }
  bootstrap() {
    return __async(this, null, function* () {
      try {
        const s = yield this.settingsSvc.load();
        this.settingsLoaded.set(true);
        this.seo.setLangAndDir(this.lang(), s.languages.rtlLanguages.includes(this.lang()));
        yield this.load();
      } catch (e) {
        this.error.set(e?.message ?? "Failed to load settings");
        this.settingsLoaded.set(true);
        this.loading.set(false);
      }
    });
  }
  load() {
    return __async(this, null, function* () {
      this.loading.set(true);
      this.error.set(null);
      this.notFound.set(false);
      try {
        const r = yield this.api.getCategoryPosts(this.slug(), this.lang(), {
          page: this.page(),
          limit: this.display().postsPerPage
        });
        this.result.set(r);
        this.applySeo(r);
      } catch (e) {
        if (e?.status === 404)
          this.notFound.set(true);
        else
          this.error.set(e?.message ?? "Failed to load category");
      } finally {
        this.loading.set(false);
      }
    });
  }
  goToPage(p) {
    this.router.navigate([], { queryParams: { page: p > 1 ? p : null }, queryParamsHandling: "merge" });
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }
  applySeo(r) {
    const lang = this.lang();
    const alts = this.supportedLangs().map((l) => ({
      lang: l,
      url: this.settingsSvc.blogUrl(l, "category", this.slug())
    }));
    this.seo.apply({
      title: `${r.category.seoTitle || r.category.name} | ${this.t(lang, "blog")} | ${this.siteName()}`,
      description: r.category.seoDescription || r.category.description || `Posts in ${r.category.name}`,
      url: this.settingsSvc.blogUrl(lang, "category", this.slug()),
      type: "website",
      locale: lang,
      hreflang: alts,
      rss: this.api.rssUrl(lang),
      siteName: this.siteName()
    });
  }
  static {
    this.\u0275fac = function CategoryPage_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _CategoryPage)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _CategoryPage, selectors: [["ng-component"]], decls: 1, vars: 1, consts: [[3, "lang", "siteName", "languages"], [1, "container"], [1, "back", 3, "routerLink"], [3, "count"], [3, "lang", "showRetry"], [3, "retry", "lang", "showRetry"], [1, "banner"], [1, "banner-inner"], [3, "posts", "layout", "lang", "display", "mobile"], [3, "pageChange", "page", "pageCount", "lang"]], template: function CategoryPage_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275conditionalCreate(0, CategoryPage_Conditional_0_Template, 8, 6);
      }
      if (rf & 2) {
        \u0275\u0275conditional(ctx.settingsLoaded() ? 0 : -1);
      }
    }, dependencies: [
      CommonModule,
      RouterLink,
      BlogHeaderComponent,
      LayoutRendererComponent,
      PaginationComponent,
      LoadingSkeletonComponent,
      ErrorBannerComponent
    ], styles: ['\n[_nghost-%COMP%] {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #111);\n}\n.container[_ngcontent-%COMP%] {\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.back[_ngcontent-%COMP%] {\n  display: inline-block;\n  padding: 12px 0;\n  color: inherit;\n  text-decoration: none;\n  opacity: .7;\n  font-size: 14px;\n}\n.back[_ngcontent-%COMP%]:hover {\n  opacity: 1;\n}\n.banner[_ngcontent-%COMP%] {\n  position: relative;\n  border-radius: 16px;\n  background-size: cover;\n  background-position: center;\n  background-color: rgba(99, 102, 241, .1);\n  padding: 48px 32px;\n  margin-bottom: 32px;\n  color: #fff;\n}\n.banner-inner[_ngcontent-%COMP%] {\n  position: relative;\n  z-index: 1;\n}\n.banner[_ngcontent-%COMP%]::before {\n  content: "";\n  position: absolute;\n  inset: 0;\n  border-radius: 16px;\n  background:\n    linear-gradient(\n      to top,\n      rgba(0, 0, 0, .55),\n      rgba(0, 0, 0, .2));\n}\n.banner[_ngcontent-%COMP%]:not([style*=background-image]) {\n  color: inherit;\n}\n.banner[_ngcontent-%COMP%]:not([style*=background-image])::before {\n  display: none;\n}\nh1[_ngcontent-%COMP%] {\n  margin: 0;\n  font-size: 36px;\n}\np[_ngcontent-%COMP%] {\n  margin: 8px 0 0;\n  opacity: .9;\n  max-width: 700px;\n}\n/*# sourceMappingURL=category.component.css.map */'], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(CategoryPage, [{
    type: Component,
    args: [{ standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [
      CommonModule,
      RouterLink,
      BlogHeaderComponent,
      LayoutRendererComponent,
      PaginationComponent,
      LoadingSkeletonComponent,
      ErrorBannerComponent
    ], template: `
    @if (settingsLoaded()) {
      <app-blog-header [lang]="lang()" [siteName]="siteName()" [languages]="supportedLangs()"></app-blog-header>

      <div class="container">
        <a class="back" [routerLink]="blogLink()">\u2190 {{ t(lang(), 'back_to_blog') }}</a>

        @if (loading() && !result()) {
          <app-loading-skeleton [count]="display().postsPerPage"></app-loading-skeleton>
        } @else if (notFound()) {
          <h1>{{ t(lang(), '404_title') }}</h1>
        } @else if (error()) {
          <app-error-banner [lang]="lang()" [showRetry]="true" (retry)="load()"></app-error-banner>
        } @else {
          @if (result(); as r) {
          <header class="banner"
                  [style.background-image]="r.category.image ? 'url(' + r.category.image + ')' : null">
            <div class="banner-inner">
              <h1>{{ r.category.name }}</h1>
              @if (r.category.description) { <p>{{ r.category.description }}</p> }
            </div>
          </header>

          <app-layout-renderer
            [posts]="r.data"
            [layout]="categoryLayout()"
            [lang]="lang()"
            [display]="display()"
            [mobile]="mobile()">
          </app-layout-renderer>

          <app-pagination
            [page]="page()"
            [pageCount]="r.pagination.totalPages"
            [lang]="lang()"
            (pageChange)="goToPage($event)">
          </app-pagination>
          }
        }
      </div>
    }
  `, styles: ['/* angular:styles/component:css;374a71495720ce474bd017ea390d3ee0ee6b71982f360f7e210cf5cbeb642975;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/pages/category.component.ts */\n:host {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #111);\n}\n.container {\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.back {\n  display: inline-block;\n  padding: 12px 0;\n  color: inherit;\n  text-decoration: none;\n  opacity: .7;\n  font-size: 14px;\n}\n.back:hover {\n  opacity: 1;\n}\n.banner {\n  position: relative;\n  border-radius: 16px;\n  background-size: cover;\n  background-position: center;\n  background-color: rgba(99, 102, 241, .1);\n  padding: 48px 32px;\n  margin-bottom: 32px;\n  color: #fff;\n}\n.banner-inner {\n  position: relative;\n  z-index: 1;\n}\n.banner::before {\n  content: "";\n  position: absolute;\n  inset: 0;\n  border-radius: 16px;\n  background:\n    linear-gradient(\n      to top,\n      rgba(0, 0, 0, .55),\n      rgba(0, 0, 0, .2));\n}\n.banner:not([style*=background-image]) {\n  color: inherit;\n}\n.banner:not([style*=background-image])::before {\n  display: none;\n}\nh1 {\n  margin: 0;\n  font-size: 36px;\n}\np {\n  margin: 8px 0 0;\n  opacity: .9;\n  max-width: 700px;\n}\n/*# sourceMappingURL=category.component.css.map */\n'] }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(CategoryPage, { className: "CategoryPage", filePath: "src/app/features/blog/pages/category.component.ts", lineNumber: 94 });
})();
export {
  CategoryPage
};
//# sourceMappingURL=category.component-DOGRZKTL.js.map
