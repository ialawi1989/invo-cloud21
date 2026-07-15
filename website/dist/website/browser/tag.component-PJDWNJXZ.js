import {
  LayoutRendererComponent,
  PaginationComponent
} from "./chunk-BAOCPRA6.js";
import {
  BlogHeaderComponent,
  BlogSeoService,
  ErrorBannerComponent,
  LoadingSkeletonComponent
} from "./chunk-OTCRCMVA.js";
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
  ɵɵpureFunction1,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1
} from "./chunk-WIK4ERCU.js";

// src/app/features/blog/pages/tag.component.ts
var _c0 = (a0) => ({ tag: a0 });
function TagPage_Conditional_0_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-loading-skeleton", 3);
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275property("count", ctx_r0.display().postsPerPage);
  }
}
function TagPage_Conditional_0_Conditional_5_Template(rf, ctx) {
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
function TagPage_Conditional_0_Conditional_6_Template(rf, ctx) {
  if (rf & 1) {
    const _r2 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "app-error-banner", 5);
    \u0275\u0275listener("retry", function TagPage_Conditional_0_Conditional_6_Template_app_error_banner_retry_0_listener() {
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
function TagPage_Conditional_0_Conditional_7_Conditional_0_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p");
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const r_r4 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(r_r4.tag.description);
  }
}
function TagPage_Conditional_0_Conditional_7_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "header", 6)(1, "h1");
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275conditionalCreate(3, TagPage_Conditional_0_Conditional_7_Conditional_0_Conditional_3_Template, 2, 1, "p");
    \u0275\u0275elementEnd();
    \u0275\u0275element(4, "app-layout-renderer", 7);
    \u0275\u0275elementStart(5, "app-pagination", 8);
    \u0275\u0275listener("pageChange", function TagPage_Conditional_0_Conditional_7_Conditional_0_Template_app_pagination_pageChange_5_listener($event) {
      \u0275\u0275restoreView(_r3);
      const ctx_r0 = \u0275\u0275nextContext(3);
      return \u0275\u0275resetView(ctx_r0.goToPage($event));
    });
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const r_r4 = ctx;
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang(), "posts_tagged", \u0275\u0275pureFunction1(10, _c0, r_r4.tag.name)));
    \u0275\u0275advance();
    \u0275\u0275conditional(r_r4.tag.description ? 3 : -1);
    \u0275\u0275advance();
    \u0275\u0275property("posts", r_r4.data)("layout", ctx_r0.categoryLayout())("lang", ctx_r0.lang())("display", ctx_r0.display())("mobile", ctx_r0.mobile());
    \u0275\u0275advance();
    \u0275\u0275property("page", ctx_r0.page())("pageCount", r_r4.pagination.totalPages)("lang", ctx_r0.lang());
  }
}
function TagPage_Conditional_0_Conditional_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275conditionalCreate(0, TagPage_Conditional_0_Conditional_7_Conditional_0_Template, 6, 12);
  }
  if (rf & 2) {
    let tmp_2_0;
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275conditional((tmp_2_0 = ctx_r0.result()) ? 0 : -1, tmp_2_0);
  }
}
function TagPage_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-blog-header", 0);
    \u0275\u0275elementStart(1, "div", 1)(2, "a", 2);
    \u0275\u0275text(3);
    \u0275\u0275elementEnd();
    \u0275\u0275conditionalCreate(4, TagPage_Conditional_0_Conditional_4_Template, 1, 1, "app-loading-skeleton", 3)(5, TagPage_Conditional_0_Conditional_5_Template, 2, 1, "h1")(6, TagPage_Conditional_0_Conditional_6_Template, 1, 2, "app-error-banner", 4)(7, TagPage_Conditional_0_Conditional_7_Template, 1, 1);
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
var TagPage = class _TagPage {
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
      combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(map(([p, q]) => ({ lang: p.get("lang") || q.get("lang") || "en", slug: p.get("tagSlug") ?? "" })), distinctUntilChanged((a, b) => a.lang === b.lang && a.slug === b.slug)).subscribe(({ lang, slug }) => {
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
        const r = yield this.api.getTagPosts(this.slug(), this.lang(), {
          page: this.page(),
          limit: this.display().postsPerPage
        });
        this.result.set(r);
        this.applySeo(r);
      } catch (e) {
        if (e?.status === 404)
          this.notFound.set(true);
        else
          this.error.set(e?.message ?? "Failed to load tag");
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
    const thin = (r.pagination.total ?? r.data.length) < 3;
    this.seo.apply({
      title: `Posts tagged #${r.tag.name} | ${this.t(lang, "blog")}`,
      description: r.tag.description || `Posts tagged with ${r.tag.name}`,
      url: this.settingsSvc.blogUrl(lang, "tag", this.slug()),
      noindex: thin,
      locale: lang,
      hreflang: this.supportedLangs().map((l) => ({ lang: l, url: this.settingsSvc.blogUrl(l, "tag", this.slug()) })),
      siteName: this.siteName()
    });
  }
  static {
    this.\u0275fac = function TagPage_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _TagPage)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _TagPage, selectors: [["ng-component"]], decls: 1, vars: 1, consts: [[3, "lang", "siteName", "languages"], [1, "container"], [1, "back", 3, "routerLink"], [3, "count"], [3, "lang", "showRetry"], [3, "retry", "lang", "showRetry"], [1, "head"], [3, "posts", "layout", "lang", "display", "mobile"], [3, "pageChange", "page", "pageCount", "lang"]], template: function TagPage_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275conditionalCreate(0, TagPage_Conditional_0_Template, 8, 6);
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
    ], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #111);\n}\n.container[_ngcontent-%COMP%] {\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.back[_ngcontent-%COMP%] {\n  display: inline-block;\n  padding: 12px 0;\n  color: inherit;\n  text-decoration: none;\n  opacity: .7;\n  font-size: 14px;\n}\n.back[_ngcontent-%COMP%]:hover {\n  opacity: 1;\n}\n.head[_ngcontent-%COMP%] {\n  padding: 24px 0 32px;\n}\nh1[_ngcontent-%COMP%] {\n  margin: 0;\n  font-size: 32px;\n}\np[_ngcontent-%COMP%] {\n  margin: 6px 0 0;\n  opacity: .7;\n  max-width: 700px;\n}\n/*# sourceMappingURL=tag.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(TagPage, [{
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
          <header class="head">
            <h1>{{ t(lang(), 'posts_tagged', { tag: r.tag.name }) }}</h1>
            @if (r.tag.description) { <p>{{ r.tag.description }}</p> }
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
  `, styles: ["/* angular:styles/component:css;aae8a4ed195d4e658fe15b7c9553a203fdeb31dd36e83d5f657943503a17f3b2;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/pages/tag.component.ts */\n:host {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #111);\n}\n.container {\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.back {\n  display: inline-block;\n  padding: 12px 0;\n  color: inherit;\n  text-decoration: none;\n  opacity: .7;\n  font-size: 14px;\n}\n.back:hover {\n  opacity: 1;\n}\n.head {\n  padding: 24px 0 32px;\n}\nh1 {\n  margin: 0;\n  font-size: 32px;\n}\np {\n  margin: 6px 0 0;\n  opacity: .7;\n  max-width: 700px;\n}\n/*# sourceMappingURL=tag.component.css.map */\n"] }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(TagPage, { className: "TagPage", filePath: "src/app/features/blog/pages/tag.component.ts", lineNumber: 82 });
})();
export {
  TagPage
};
//# sourceMappingURL=tag.component-PJDWNJXZ.js.map
