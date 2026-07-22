import {
  LayoutRendererComponent,
  PaginationComponent
} from "./chunk-AADDHIIO.js";
import {
  BlogHeaderComponent,
  BlogSeoService,
  EmptyStateComponent,
  ErrorBannerComponent,
  LoadingSkeletonComponent
} from "./chunk-GIVY7Q32.js";
import {
  t
} from "./chunk-TUMDR5WP.js";
import {
  ActivatedRoute,
  BlogSettingsService,
  ChangeDetectionStrategy,
  CommonModule,
  Component,
  Input,
  PublicBlogApiService,
  Router,
  RouterLink,
  RouterLinkActive,
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
  ɵɵattribute,
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
  ɵɵpureFunction0,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵstyleProp,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1
} from "./chunk-Y4IP4WHH.js";

// src/app/features/blog/components/category-menu-strip.component.ts
var _c0 = () => ({ exact: true });
var _forTrack0 = ($index, $item) => $item.id;
function CategoryMenuStripComponent_For_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "a", 2);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const c_r1 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275property("routerLink", ctx_r1.blogLink("category", c_r1.slug));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", c_r1.name, " ");
  }
}
var CategoryMenuStripComponent = class _CategoryMenuStripComponent {
  constructor() {
    this.settings = inject(BlogSettingsService);
    this.lang = "en";
    this.categories = [];
    this.blogLink = (...segments) => this.settings.blogLink(this.lang, ...segments);
    this.t = (k) => t(this.lang, k);
  }
  static {
    this.\u0275fac = function CategoryMenuStripComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _CategoryMenuStripComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _CategoryMenuStripComponent, selectors: [["app-category-menu-strip"]], inputs: { lang: "lang", categories: "categories" }, decls: 5, vars: 5, consts: [[1, "strip"], ["routerLinkActive", "active", 1, "pill", 3, "routerLink", "routerLinkActiveOptions"], ["routerLinkActive", "active", 1, "pill", 3, "routerLink"]], template: function CategoryMenuStripComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275elementStart(0, "nav", 0)(1, "a", 1);
        \u0275\u0275text(2);
        \u0275\u0275elementEnd();
        \u0275\u0275repeaterCreate(3, CategoryMenuStripComponent_For_4_Template, 2, 2, "a", 2, _forTrack0);
        \u0275\u0275elementEnd();
      }
      if (rf & 2) {
        \u0275\u0275attribute("aria-label", ctx.t("category"));
        \u0275\u0275advance();
        \u0275\u0275property("routerLink", ctx.blogLink())("routerLinkActiveOptions", \u0275\u0275pureFunction0(4, _c0));
        \u0275\u0275advance();
        \u0275\u0275textInterpolate1(" ", ctx.t("all_posts"), " ");
        \u0275\u0275advance();
        \u0275\u0275repeater(ctx.categories);
      }
    }, dependencies: [CommonModule, RouterLink, RouterLinkActive], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n}\n.strip[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 8px;\n  overflow-x: auto;\n  padding: 4px 0 12px;\n  scrollbar-width: thin;\n}\n.pill[_ngcontent-%COMP%] {\n  padding: 8px 16px;\n  border-radius: 999px;\n  border: 1px solid rgba(0, 0, 0, .08);\n  background: transparent;\n  color: inherit;\n  font-size: 14px;\n  text-decoration: none;\n  white-space: nowrap;\n  transition: background .15s, color .15s;\n}\n.pill[_ngcontent-%COMP%]:hover {\n  background: rgba(0, 0, 0, .04);\n}\n.pill.active[_ngcontent-%COMP%] {\n  background: var(--primary, #6366f1);\n  color: #fff;\n  border-color: transparent;\n}\n/*# sourceMappingURL=category-menu-strip.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(CategoryMenuStripComponent, [{
    type: Component,
    args: [{ selector: "app-category-menu-strip", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule, RouterLink, RouterLinkActive], template: `
    <nav class="strip" [attr.aria-label]="t('category')">
      <a class="pill"
         [routerLink]="blogLink()"
         routerLinkActive="active"
         [routerLinkActiveOptions]="{ exact: true }">
        {{ t('all_posts') }}
      </a>
      @for (c of categories; track c.id) {
        <a class="pill"
           [routerLink]="blogLink('category', c.slug)"
           routerLinkActive="active">
          {{ c.name }}
        </a>
      }
    </nav>
  `, styles: ["/* angular:styles/component:css;22484479f7b4376e646c80607addc5328f9e749d58193112f3440288425229c9;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/components/category-menu-strip.component.ts */\n:host {\n  display: block;\n}\n.strip {\n  display: flex;\n  gap: 8px;\n  overflow-x: auto;\n  padding: 4px 0 12px;\n  scrollbar-width: thin;\n}\n.pill {\n  padding: 8px 16px;\n  border-radius: 999px;\n  border: 1px solid rgba(0, 0, 0, .08);\n  background: transparent;\n  color: inherit;\n  font-size: 14px;\n  text-decoration: none;\n  white-space: nowrap;\n  transition: background .15s, color .15s;\n}\n.pill:hover {\n  background: rgba(0, 0, 0, .04);\n}\n.pill.active {\n  background: var(--primary, #6366f1);\n  color: #fff;\n  border-color: transparent;\n}\n/*# sourceMappingURL=category-menu-strip.component.css.map */\n"] }]
  }], null, { lang: [{
    type: Input,
    args: [{ required: true }]
  }], categories: [{
    type: Input,
    args: [{ required: true }]
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(CategoryMenuStripComponent, { className: "CategoryMenuStripComponent", filePath: "src/app/features/blog/components/category-menu-strip.component.ts", lineNumber: 54 });
})();

// src/app/features/blog/pages/blog-index.component.ts
function BlogIndexPage_Conditional_0_Conditional_2_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p");
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.tagline());
  }
}
function BlogIndexPage_Conditional_0_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 8)(1, "div", 9)(2, "h1");
    \u0275\u0275text(3);
    \u0275\u0275elementEnd();
    \u0275\u0275conditionalCreate(4, BlogIndexPage_Conditional_0_Conditional_2_Conditional_4_Template, 2, 1, "p");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275styleProp("background-image", "url(" + ctx_r0.heroImage() + ")");
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang(), "blog"));
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.tagline() ? 4 : -1);
  }
}
function BlogIndexPage_Conditional_0_Conditional_3_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p");
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.tagline());
  }
}
function BlogIndexPage_Conditional_0_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "header", 3)(1, "h1");
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275conditionalCreate(3, BlogIndexPage_Conditional_0_Conditional_3_Conditional_3_Template, 2, 1, "p");
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang(), "blog"));
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.tagline() ? 3 : -1);
  }
}
function BlogIndexPage_Conditional_0_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-category-menu-strip", 4);
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275property("lang", ctx_r0.lang())("categories", ctx_r0.categories());
  }
}
function BlogIndexPage_Conditional_0_Conditional_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-loading-skeleton", 5);
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275property("count", ctx_r0.display().postsPerPage);
  }
}
function BlogIndexPage_Conditional_0_Conditional_6_Template(rf, ctx) {
  if (rf & 1) {
    const _r2 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "app-error-banner", 10);
    \u0275\u0275listener("retry", function BlogIndexPage_Conditional_0_Conditional_6_Template_app_error_banner_retry_0_listener() {
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
function BlogIndexPage_Conditional_0_Conditional_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-empty-state", 7);
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275property("title", ctx_r0.t(ctx_r0.lang(), "no_posts"));
  }
}
function BlogIndexPage_Conditional_0_Conditional_8_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275element(0, "app-layout-renderer", 11);
    \u0275\u0275elementStart(1, "app-pagination", 12);
    \u0275\u0275listener("pageChange", function BlogIndexPage_Conditional_0_Conditional_8_Template_app_pagination_pageChange_1_listener($event) {
      \u0275\u0275restoreView(_r3);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.goToPage($event));
    });
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275property("posts", ctx_r0.posts())("layout", ctx_r0.display().postsPerPage > 0 ? ctx_r0.layouts.feed : "grid")("lang", ctx_r0.lang())("display", ctx_r0.display())("mobile", ctx_r0.mobile());
    \u0275\u0275advance();
    \u0275\u0275property("page", ctx_r0.page())("pageCount", ctx_r0.pageCount())("lang", ctx_r0.lang());
  }
}
function BlogIndexPage_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-blog-header", 0);
    \u0275\u0275elementStart(1, "div", 1);
    \u0275\u0275conditionalCreate(2, BlogIndexPage_Conditional_0_Conditional_2_Template, 5, 4, "div", 2)(3, BlogIndexPage_Conditional_0_Conditional_3_Template, 4, 2, "header", 3);
    \u0275\u0275conditionalCreate(4, BlogIndexPage_Conditional_0_Conditional_4_Template, 1, 2, "app-category-menu-strip", 4);
    \u0275\u0275conditionalCreate(5, BlogIndexPage_Conditional_0_Conditional_5_Template, 1, 1, "app-loading-skeleton", 5)(6, BlogIndexPage_Conditional_0_Conditional_6_Template, 1, 2, "app-error-banner", 6)(7, BlogIndexPage_Conditional_0_Conditional_7_Template, 1, 1, "app-empty-state", 7)(8, BlogIndexPage_Conditional_0_Conditional_8_Template, 2, 8);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275property("lang", ctx_r0.lang())("siteName", ctx_r0.siteName())("languages", ctx_r0.supportedLangs());
    \u0275\u0275advance(2);
    \u0275\u0275conditional(ctx_r0.heroImage() ? 2 : 3);
    \u0275\u0275advance(2);
    \u0275\u0275conditional(ctx_r0.mobile().showCategoryMenu || !ctx_r0.isMobile ? 4 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.loading() && !ctx_r0.posts().length ? 5 : ctx_r0.error() ? 6 : ctx_r0.posts().length === 0 ? 7 : 8);
  }
}
var BlogIndexPage = class _BlogIndexPage {
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
    this.page = signal(1, ...ngDevMode ? [{ debugName: "page" }] : (
      /* istanbul ignore next */
      []
    ));
    this.settingsLoaded = signal(false, ...ngDevMode ? [{ debugName: "settingsLoaded" }] : (
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
    this.posts = signal([], ...ngDevMode ? [{ debugName: "posts" }] : (
      /* istanbul ignore next */
      []
    ));
    this.pageCount = signal(1, ...ngDevMode ? [{ debugName: "pageCount" }] : (
      /* istanbul ignore next */
      []
    ));
    this.categories = signal([], ...ngDevMode ? [{ debugName: "categories" }] : (
      /* istanbul ignore next */
      []
    ));
    this.layouts = { feed: "grid" };
    this.isMobile = false;
    this.display = computed(() => this.settingsSvc.settings().display, ...ngDevMode ? [{ debugName: "display" }] : (
      /* istanbul ignore next */
      []
    ));
    this.mobile = computed(() => this.settingsSvc.settings().mobile, ...ngDevMode ? [{ debugName: "mobile" }] : (
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
    this.tagline = computed(() => this.settingsSvc.settings().tagline, ...ngDevMode ? [{ debugName: "tagline" }] : (
      /* istanbul ignore next */
      []
    ));
    this.heroImage = computed(() => this.settingsSvc.settings().heroImage, ...ngDevMode ? [{ debugName: "heroImage" }] : (
      /* istanbul ignore next */
      []
    ));
    this.t = t;
  }
  ngOnInit() {
    return __async(this, null, function* () {
      combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(map(([p, q]) => p.get("lang") || q.get("lang") || "en"), distinctUntilChanged()).subscribe((lang) => {
        this.lang.set(lang);
        this.bootstrap();
      });
      this.route.queryParamMap.subscribe((q) => {
        const newPage = Number(q.get("page") ?? "1") || 1;
        if (newPage !== this.page()) {
          this.page.set(newPage);
          this.load();
        }
      });
    });
  }
  bootstrap() {
    return __async(this, null, function* () {
      try {
        const s = yield this.settingsSvc.load();
        this.layouts.feed = s.layouts.feed;
        this.settingsLoaded.set(true);
        this.seo.setLangAndDir(this.lang(), s.languages.rtlLanguages.includes(this.lang()));
        this.applySeo();
        yield Promise.all([this.load(), this.loadCategories()]);
      } catch (e) {
        this.error.set(e?.message ?? "Failed to load blog settings");
        this.settingsLoaded.set(true);
        this.loading.set(false);
      }
    });
  }
  load() {
    return __async(this, null, function* () {
      this.loading.set(true);
      this.error.set(null);
      try {
        const res = yield this.api.listPublicPosts({
          language: this.lang(),
          page: this.page(),
          limit: this.display().postsPerPage,
          sort: "date",
          order: "desc"
        });
        this.posts.set(res.data);
        this.pageCount.set(res.pagination?.totalPages ?? 1);
      } catch (e) {
        this.error.set(e?.message ?? "Failed to load posts");
        this.posts.set([]);
      } finally {
        this.loading.set(false);
      }
    });
  }
  loadCategories() {
    return __async(this, null, function* () {
      try {
        this.categories.set(yield this.api.listPublicTaxonomies({
          language: this.lang(),
          taxonomyType: "category"
        }));
      } catch (e) {
        this.categories.set([]);
      }
    });
  }
  goToPage(p) {
    this.router.navigate([], {
      queryParams: { page: p > 1 ? p : null },
      queryParamsHandling: "merge"
    });
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }
  applySeo() {
    const lang = this.lang();
    const alts = this.supportedLangs().map((l) => ({ lang: l, url: this.settingsSvc.blogUrl(l) }));
    this.seo.apply({
      title: `${this.t(lang, "blog")} | ${this.siteName()}`,
      description: this.tagline() || `${this.siteName()} \u2014 ${this.t(lang, "blog")}`,
      url: this.settingsSvc.blogUrl(lang),
      type: "website",
      locale: lang,
      hreflang: alts,
      rss: this.api.rssUrl(lang),
      siteName: this.siteName()
    });
  }
  static {
    this.\u0275fac = function BlogIndexPage_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _BlogIndexPage)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _BlogIndexPage, selectors: [["ng-component"]], decls: 1, vars: 1, consts: [[3, "lang", "siteName", "languages"], [1, "container"], [1, "hero", 3, "background-image"], [1, "page-head"], [3, "lang", "categories"], [3, "count"], [3, "lang", "showRetry"], [3, "title"], [1, "hero"], [1, "hero-overlay"], [3, "retry", "lang", "showRetry"], [3, "posts", "layout", "lang", "display", "mobile"], [3, "pageChange", "page", "pageCount", "lang"]], template: function BlogIndexPage_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275conditionalCreate(0, BlogIndexPage_Conditional_0_Template, 9, 6);
      }
      if (rf & 2) {
        \u0275\u0275conditional(ctx.settingsLoaded() ? 0 : -1);
      }
    }, dependencies: [
      CommonModule,
      BlogHeaderComponent,
      CategoryMenuStripComponent,
      LayoutRendererComponent,
      PaginationComponent,
      LoadingSkeletonComponent,
      EmptyStateComponent,
      ErrorBannerComponent
    ], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #111);\n}\n.container[_ngcontent-%COMP%] {\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.page-head[_ngcontent-%COMP%] {\n  padding: 40px 0 16px;\n}\n.page-head[_ngcontent-%COMP%]   h1[_ngcontent-%COMP%] {\n  margin: 0 0 8px;\n  font-size: 36px;\n}\n.page-head[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {\n  margin: 0;\n  opacity: .7;\n}\n.hero[_ngcontent-%COMP%] {\n  aspect-ratio: 21 / 7;\n  border-radius: 16px;\n  background-size: cover;\n  background-position: center;\n  position: relative;\n  margin-bottom: 24px;\n}\n.hero-overlay[_ngcontent-%COMP%] {\n  position: absolute;\n  inset: 0;\n  background:\n    linear-gradient(\n      to top,\n      rgba(0, 0, 0, .6),\n      rgba(0, 0, 0, .1));\n  color: #fff;\n  display: flex;\n  flex-direction: column;\n  justify-content: flex-end;\n  padding: 32px;\n  border-radius: 16px;\n}\n.hero-overlay[_ngcontent-%COMP%]   h1[_ngcontent-%COMP%] {\n  margin: 0;\n  font-size: 40px;\n}\n.hero-overlay[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {\n  margin: 6px 0 0;\n  opacity: .9;\n}\n/*# sourceMappingURL=blog-index.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(BlogIndexPage, [{
    type: Component,
    args: [{ standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [
      CommonModule,
      BlogHeaderComponent,
      CategoryMenuStripComponent,
      LayoutRendererComponent,
      PaginationComponent,
      LoadingSkeletonComponent,
      EmptyStateComponent,
      ErrorBannerComponent
    ], template: `
    @if (settingsLoaded()) {
      <app-blog-header
        [lang]="lang()"
        [siteName]="siteName()"
        [languages]="supportedLangs()">
      </app-blog-header>

      <div class="container">
        @if (heroImage()) {
          <div class="hero" [style.background-image]="'url(' + heroImage() + ')'">
            <div class="hero-overlay">
              <h1>{{ t(lang(), 'blog') }}</h1>
              @if (tagline()) { <p>{{ tagline() }}</p> }
            </div>
          </div>
        } @else {
          <header class="page-head">
            <h1>{{ t(lang(), 'blog') }}</h1>
            @if (tagline()) { <p>{{ tagline() }}</p> }
          </header>
        }

        @if (mobile().showCategoryMenu || !isMobile) {
          <app-category-menu-strip
            [lang]="lang()"
            [categories]="categories()">
          </app-category-menu-strip>
        }

        @if (loading() && !posts().length) {
          <app-loading-skeleton [count]="display().postsPerPage"></app-loading-skeleton>
        } @else if (error()) {
          <app-error-banner [lang]="lang()" [showRetry]="true" (retry)="load()"></app-error-banner>
        } @else if (posts().length === 0) {
          <app-empty-state [title]="t(lang(), 'no_posts')"></app-empty-state>
        } @else {
          <app-layout-renderer
            [posts]="posts()"
            [layout]="display().postsPerPage > 0 ? layouts.feed : 'grid'"
            [lang]="lang()"
            [display]="display()"
            [mobile]="mobile()">
          </app-layout-renderer>

          <app-pagination
            [page]="page()"
            [pageCount]="pageCount()"
            [lang]="lang()"
            (pageChange)="goToPage($event)">
          </app-pagination>
        }
      </div>
    }
  `, styles: ["/* angular:styles/component:css;230b3e2ad97bdfb67747a00a40b2c98fb7b1c98ee340a5b1679d9b053ebd121b;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/pages/blog-index.component.ts */\n:host {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #111);\n}\n.container {\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.page-head {\n  padding: 40px 0 16px;\n}\n.page-head h1 {\n  margin: 0 0 8px;\n  font-size: 36px;\n}\n.page-head p {\n  margin: 0;\n  opacity: .7;\n}\n.hero {\n  aspect-ratio: 21 / 7;\n  border-radius: 16px;\n  background-size: cover;\n  background-position: center;\n  position: relative;\n  margin-bottom: 24px;\n}\n.hero-overlay {\n  position: absolute;\n  inset: 0;\n  background:\n    linear-gradient(\n      to top,\n      rgba(0, 0, 0, .6),\n      rgba(0, 0, 0, .1));\n  color: #fff;\n  display: flex;\n  flex-direction: column;\n  justify-content: flex-end;\n  padding: 32px;\n  border-radius: 16px;\n}\n.hero-overlay h1 {\n  margin: 0;\n  font-size: 40px;\n}\n.hero-overlay p {\n  margin: 6px 0 0;\n  opacity: .9;\n}\n/*# sourceMappingURL=blog-index.component.css.map */\n"] }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(BlogIndexPage, { className: "BlogIndexPage", filePath: "src/app/features/blog/pages/blog-index.component.ts", lineNumber: 124 });
})();
export {
  BlogIndexPage
};
//# sourceMappingURL=blog-index.component-RTXSDSE4.js.map
