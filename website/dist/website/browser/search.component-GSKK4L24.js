import {
  LayoutRendererComponent,
  PaginationComponent
} from "./chunk-XAGC5U2M.js";
import {
  BlogHeaderComponent,
  BlogSeoService,
  DefaultValueAccessor,
  EmptyStateComponent,
  ErrorBannerComponent,
  FormsModule,
  LoadingSkeletonComponent,
  NgControlStatus,
  NgControlStatusGroup,
  NgForm,
  NgModel,
  ɵNgNoValidate
} from "./chunk-UJHLK57O.js";
import {
  t
} from "./chunk-TUMDR5WP.js";
import {
  BlogSettingsService,
  PublicBlogApiService,
  environment
} from "./chunk-HBP5F5OV.js";
import {
  ActivatedRoute,
  ChangeDetectionStrategy,
  CommonModule,
  Component,
  Router,
  __async,
  computed,
  inject,
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
  ɵɵpureFunction2,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtwoWayBindingSet,
  ɵɵtwoWayListener,
  ɵɵtwoWayProperty
} from "./chunk-APJBGD42.js";

// src/app/features/blog/pages/search.component.ts
var _c0 = (a0, a1) => ({ n: a0, q: a1 });
function SearchPage_Conditional_0_Conditional_6_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "h1", 5);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r1.t(ctx_r1.lang(), "showing_results", \u0275\u0275pureFunction2(1, _c0, ctx_r1.total(), ctx_r1.query())));
  }
}
function SearchPage_Conditional_0_Conditional_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-loading-skeleton", 6);
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275property("count", ctx_r1.display().postsPerPage);
  }
}
function SearchPage_Conditional_0_Conditional_8_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "app-error-banner", 8);
    \u0275\u0275listener("retry", function SearchPage_Conditional_0_Conditional_8_Template_app_error_banner_retry_0_listener() {
      \u0275\u0275restoreView(_r3);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.load());
    });
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275property("lang", ctx_r1.lang())("showRetry", true);
  }
}
function SearchPage_Conditional_0_Conditional_9_Conditional_0_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-empty-state", 9);
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(4);
    \u0275\u0275property("title", ctx_r1.t(ctx_r1.lang(), "no_results"))("body", ctx_r1.t(ctx_r1.lang(), "no_results_hint"));
  }
}
function SearchPage_Conditional_0_Conditional_9_Conditional_0_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    const _r4 = \u0275\u0275getCurrentView();
    \u0275\u0275element(0, "app-layout-renderer", 10);
    \u0275\u0275elementStart(1, "app-pagination", 11);
    \u0275\u0275listener("pageChange", function SearchPage_Conditional_0_Conditional_9_Conditional_0_Conditional_1_Template_app_pagination_pageChange_1_listener($event) {
      \u0275\u0275restoreView(_r4);
      const ctx_r1 = \u0275\u0275nextContext(4);
      return \u0275\u0275resetView(ctx_r1.goToPage($event));
    });
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const r_r5 = \u0275\u0275nextContext();
    const ctx_r1 = \u0275\u0275nextContext(3);
    \u0275\u0275property("posts", r_r5.data)("layout", ctx_r1.feedLayout())("lang", ctx_r1.lang())("display", ctx_r1.display())("mobile", ctx_r1.mobile());
    \u0275\u0275advance();
    \u0275\u0275property("page", ctx_r1.page())("pageCount", r_r5.pagination.totalPages)("lang", ctx_r1.lang());
  }
}
function SearchPage_Conditional_0_Conditional_9_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275conditionalCreate(0, SearchPage_Conditional_0_Conditional_9_Conditional_0_Conditional_0_Template, 1, 2, "app-empty-state", 9)(1, SearchPage_Conditional_0_Conditional_9_Conditional_0_Conditional_1_Template, 2, 8);
  }
  if (rf & 2) {
    \u0275\u0275conditional(ctx.data.length === 0 ? 0 : 1);
  }
}
function SearchPage_Conditional_0_Conditional_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275conditionalCreate(0, SearchPage_Conditional_0_Conditional_9_Conditional_0_Template, 2, 1);
  }
  if (rf & 2) {
    let tmp_2_0;
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275conditional((tmp_2_0 = ctx_r1.result()) ? 0 : -1, tmp_2_0);
  }
}
function SearchPage_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275element(0, "app-blog-header", 0);
    \u0275\u0275elementStart(1, "div", 1)(2, "form", 2);
    \u0275\u0275listener("ngSubmit", function SearchPage_Conditional_0_Template_form_ngSubmit_2_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.submit());
    });
    \u0275\u0275elementStart(3, "input", 3);
    \u0275\u0275twoWayListener("ngModelChange", function SearchPage_Conditional_0_Template_input_ngModelChange_3_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r1.draft, $event) || (ctx_r1.draft = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(4, "button", 4);
    \u0275\u0275text(5);
    \u0275\u0275elementEnd()();
    \u0275\u0275conditionalCreate(6, SearchPage_Conditional_0_Conditional_6_Template, 2, 4, "h1", 5);
    \u0275\u0275conditionalCreate(7, SearchPage_Conditional_0_Conditional_7_Template, 1, 1, "app-loading-skeleton", 6)(8, SearchPage_Conditional_0_Conditional_8_Template, 1, 2, "app-error-banner", 7)(9, SearchPage_Conditional_0_Conditional_9_Template, 1, 1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275property("lang", ctx_r1.lang())("siteName", ctx_r1.siteName())("languages", ctx_r1.supportedLangs());
    \u0275\u0275advance(3);
    \u0275\u0275twoWayProperty("ngModel", ctx_r1.draft);
    \u0275\u0275property("placeholder", ctx_r1.t(ctx_r1.lang(), "search_placeholder"));
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r1.t(ctx_r1.lang(), "search"));
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r1.query() ? 6 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r1.loading() && !ctx_r1.result() ? 7 : ctx_r1.error() ? 8 : 9);
  }
}
var SearchPage = class _SearchPage {
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
    this.query = signal("", ...ngDevMode ? [{ debugName: "query" }] : (
      /* istanbul ignore next */
      []
    ));
    this.page = signal(1, ...ngDevMode ? [{ debugName: "page" }] : (
      /* istanbul ignore next */
      []
    ));
    this.draft = "";
    this.result = signal(null, ...ngDevMode ? [{ debugName: "result" }] : (
      /* istanbul ignore next */
      []
    ));
    this.loading = signal(false, ...ngDevMode ? [{ debugName: "loading" }] : (
      /* istanbul ignore next */
      []
    ));
    this.error = signal(null, ...ngDevMode ? [{ debugName: "error" }] : (
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
    this.feedLayout = computed(() => this.settingsSvc.settings().layouts.feed, ...ngDevMode ? [{ debugName: "feedLayout" }] : (
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
    this.total = computed(() => this.result()?.pagination.total ?? 0, ...ngDevMode ? [{ debugName: "total" }] : (
      /* istanbul ignore next */
      []
    ));
    this.t = t;
  }
  ngOnInit() {
    return __async(this, null, function* () {
      this.route.paramMap.subscribe((p) => {
        this.lang.set(p.get("lang") ?? "en");
        this.bootstrap();
      });
      this.route.queryParamMap.subscribe((q) => {
        const qStr = q.get("q") ?? "";
        const pn = Number(q.get("page") ?? "1") || 1;
        const changed = qStr !== this.query() || pn !== this.page();
        this.query.set(qStr);
        this.draft = qStr;
        this.page.set(pn);
        if (this.settingsLoaded() && changed)
          this.load();
      });
    });
  }
  bootstrap() {
    return __async(this, null, function* () {
      try {
        const s = yield this.settingsSvc.load();
        this.settingsLoaded.set(true);
        this.seo.setLangAndDir(this.lang(), s.languages.rtlLanguages.includes(this.lang()));
        this.applySeo();
        if (this.query())
          yield this.load();
      } catch (e) {
        this.error.set(e?.message ?? "Failed to load settings");
        this.settingsLoaded.set(true);
      }
    });
  }
  load() {
    return __async(this, null, function* () {
      if (!this.query()) {
        this.result.set(null);
        return;
      }
      this.loading.set(true);
      this.error.set(null);
      try {
        const r = yield this.api.listPublicPosts({
          language: this.lang(),
          search: this.query(),
          page: this.page(),
          limit: this.display().postsPerPage
        });
        this.result.set(r);
      } catch (e) {
        this.error.set(e?.message ?? "Search failed");
      } finally {
        this.loading.set(false);
        this.applySeo();
      }
    });
  }
  submit() {
    const q = this.draft.trim();
    this.router.navigate(["/", this.lang(), "blog", "search"], { queryParams: q ? { q } : {} });
  }
  goToPage(p) {
    this.router.navigate([], { queryParams: { page: p > 1 ? p : null, q: this.query() || null }, queryParamsHandling: "merge" });
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }
  applySeo() {
    const origin = this.settingsSvc.originUrl();
    const q = this.query();
    this.seo.apply({
      title: q ? `Search: ${q} | ${this.t(this.lang(), "blog")}` : `Search | ${this.t(this.lang(), "blog")}`,
      description: q ? `Search results for "${q}"` : "Search the blog",
      url: `${origin}/${this.lang()}/blog/search${q ? "?q=" + encodeURIComponent(q) : ""}`,
      noindex: true,
      locale: this.lang(),
      siteName: this.siteName()
    });
  }
  static {
    this.\u0275fac = function SearchPage_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _SearchPage)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _SearchPage, selectors: [["ng-component"]], decls: 1, vars: 1, consts: [[3, "lang", "siteName", "languages"], [1, "container"], [1, "searchbar", 3, "ngSubmit"], ["type", "search", "name", "q", 3, "ngModelChange", "ngModel", "placeholder"], ["type", "submit", 1, "btn", "primary"], [1, "results-h"], [3, "count"], [3, "lang", "showRetry"], [3, "retry", "lang", "showRetry"], [3, "title", "body"], [3, "posts", "layout", "lang", "display", "mobile"], [3, "pageChange", "page", "pageCount", "lang"]], template: function SearchPage_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275conditionalCreate(0, SearchPage_Conditional_0_Template, 10, 8);
      }
      if (rf & 2) {
        \u0275\u0275conditional(ctx.settingsLoaded() ? 0 : -1);
      }
    }, dependencies: [
      CommonModule,
      FormsModule,
      \u0275NgNoValidate,
      DefaultValueAccessor,
      NgControlStatus,
      NgControlStatusGroup,
      NgModel,
      NgForm,
      BlogHeaderComponent,
      LayoutRendererComponent,
      PaginationComponent,
      LoadingSkeletonComponent,
      ErrorBannerComponent,
      EmptyStateComponent
    ], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #111);\n}\n.container[_ngcontent-%COMP%] {\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.searchbar[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 8px;\n  margin: 24px 0;\n}\n.searchbar[_ngcontent-%COMP%]   input[_ngcontent-%COMP%] {\n  flex: 1;\n  padding: 14px 18px;\n  font-size: 16px;\n  font: inherit;\n  color: inherit;\n  border: 1px solid rgba(0, 0, 0, .12);\n  border-radius: 100px;\n  background: rgba(0, 0, 0, .03);\n}\n.searchbar[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]:focus {\n  outline: 2px solid var(--primary, #6366f1);\n  outline-offset: 1px;\n}\n.btn.primary[_ngcontent-%COMP%] {\n  padding: 0 20px;\n  background: var(--primary, #6366f1);\n  color: #fff;\n  border: 0;\n  border-radius: 100px;\n  cursor: pointer;\n  font: inherit;\n}\n.results-h[_ngcontent-%COMP%] {\n  margin: 16px 0 24px;\n  font-size: 22px;\n}\n/*# sourceMappingURL=search.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(SearchPage, [{
    type: Component,
    args: [{ standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [
      CommonModule,
      FormsModule,
      BlogHeaderComponent,
      LayoutRendererComponent,
      PaginationComponent,
      LoadingSkeletonComponent,
      ErrorBannerComponent,
      EmptyStateComponent
    ], template: `
    @if (settingsLoaded()) {
      <app-blog-header [lang]="lang()" [siteName]="siteName()" [languages]="supportedLangs()"></app-blog-header>

      <div class="container">
        <form class="searchbar" (ngSubmit)="submit()">
          <input type="search" [(ngModel)]="draft" name="q" [placeholder]="t(lang(), 'search_placeholder')">
          <button type="submit" class="btn primary">{{ t(lang(), 'search') }}</button>
        </form>

        @if (query()) {
          <h1 class="results-h">{{ t(lang(), 'showing_results', { n: total(), q: query() }) }}</h1>
        }

        @if (loading() && !result()) {
          <app-loading-skeleton [count]="display().postsPerPage"></app-loading-skeleton>
        } @else if (error()) {
          <app-error-banner [lang]="lang()" [showRetry]="true" (retry)="load()"></app-error-banner>
        } @else {
          @if (result(); as r) {
          @if (r.data.length === 0) {
            <app-empty-state [title]="t(lang(), 'no_results')" [body]="t(lang(), 'no_results_hint')"></app-empty-state>
          } @else {
            <app-layout-renderer
              [posts]="r.data"
              [layout]="feedLayout()"
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
        }
      </div>
    }
  `, styles: ["/* angular:styles/component:css;15d2eac8d6deaf1dfb8c7d6a3276398896daab21b29a27290878575826dbec8d;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/pages/search.component.ts */\n:host {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #111);\n}\n.container {\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.searchbar {\n  display: flex;\n  gap: 8px;\n  margin: 24px 0;\n}\n.searchbar input {\n  flex: 1;\n  padding: 14px 18px;\n  font-size: 16px;\n  font: inherit;\n  color: inherit;\n  border: 1px solid rgba(0, 0, 0, .12);\n  border-radius: 100px;\n  background: rgba(0, 0, 0, .03);\n}\n.searchbar input:focus {\n  outline: 2px solid var(--primary, #6366f1);\n  outline-offset: 1px;\n}\n.btn.primary {\n  padding: 0 20px;\n  background: var(--primary, #6366f1);\n  color: #fff;\n  border: 0;\n  border-radius: 100px;\n  cursor: pointer;\n  font: inherit;\n}\n.results-h {\n  margin: 16px 0 24px;\n  font-size: 22px;\n}\n/*# sourceMappingURL=search.component.css.map */\n"] }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(SearchPage, { className: "SearchPage", filePath: "src/app/features/blog/pages/search.component.ts", lineNumber: 90 });
})();
export {
  SearchPage
};
//# sourceMappingURL=search.component-GSKK4L24.js.map
