import './polyfills.server.mjs';
import {
  LayoutRendererComponent,
  PaginationComponent
} from "./chunk-AE3RLWPD.mjs";
import {
  BlogHeaderComponent,
  BlogSeoService,
  ErrorBannerComponent,
  LoadingSkeletonComponent
} from "./chunk-IS4GPMA3.mjs";
import {
  t
} from "./chunk-ZMGIQB7V.mjs";
import {
  BlogSettingsService,
  PublicBlogApiService,
  environment
} from "./chunk-75MV57TF.mjs";
import {
  ActivatedRoute,
  ChangeDetectionStrategy,
  CommonModule,
  Component,
  Router,
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
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵsanitizeUrl,
  ɵɵstyleProp,
  ɵɵtext,
  ɵɵtextInterpolate
} from "./chunk-6U7XE7QE.mjs";
import {
  __async
} from "./chunk-TXMZZVXC.mjs";

// src/app/features/blog/pages/author.component.ts
var _forTrack0 = ($index, $item) => $item.url;
function AuthorPage_Conditional_0_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 1);
    \u0275\u0275element(1, "app-loading-skeleton", 2);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    \u0275\u0275advance();
    \u0275\u0275property("count", 6);
  }
}
function AuthorPage_Conditional_0_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 1)(1, "h1");
    \u0275\u0275text(2);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang(), "404_title"));
  }
}
function AuthorPage_Conditional_0_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    const _r2 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 1)(1, "app-error-banner", 3);
    \u0275\u0275listener("retry", function AuthorPage_Conditional_0_Conditional_3_Template_app_error_banner_retry_1_listener() {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.load());
    });
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275property("lang", ctx_r0.lang())("showRetry", true);
  }
}
function AuthorPage_Conditional_0_Conditional_4_Conditional_0_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "div", 12);
  }
  if (rf & 2) {
    const r_r4 = \u0275\u0275nextContext();
    \u0275\u0275styleProp("background-image", "url(" + r_r4.profile.coverImage + ")");
  }
}
function AuthorPage_Conditional_0_Conditional_4_Conditional_0_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "img", 6);
  }
  if (rf & 2) {
    const r_r4 = \u0275\u0275nextContext();
    \u0275\u0275property("src", r_r4.profile.image, \u0275\u0275sanitizeUrl)("alt", r_r4.profile.name);
  }
}
function AuthorPage_Conditional_0_Conditional_4_Conditional_0_Conditional_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 7);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const r_r4 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(r_r4.profile.title);
  }
}
function AuthorPage_Conditional_0_Conditional_4_Conditional_0_Conditional_6_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 8);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const r_r4 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(r_r4.profile.bio);
  }
}
function AuthorPage_Conditional_0_Conditional_4_Conditional_0_Conditional_7_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "li")(1, "a", 13);
    \u0275\u0275text(2);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const l_r5 = ctx.$implicit;
    \u0275\u0275advance();
    \u0275\u0275property("href", l_r5.url, \u0275\u0275sanitizeUrl);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(l_r5.kind);
  }
}
function AuthorPage_Conditional_0_Conditional_4_Conditional_0_Conditional_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "ul", 9);
    \u0275\u0275repeaterCreate(1, AuthorPage_Conditional_0_Conditional_4_Conditional_0_Conditional_7_For_2_Template, 3, 2, "li", null, _forTrack0);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const r_r4 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275repeater(r_r4.profile.socialLinks);
  }
}
function AuthorPage_Conditional_0_Conditional_4_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275conditionalCreate(0, AuthorPage_Conditional_0_Conditional_4_Conditional_0_Conditional_0_Template, 1, 2, "div", 4);
    \u0275\u0275elementStart(1, "header", 5);
    \u0275\u0275conditionalCreate(2, AuthorPage_Conditional_0_Conditional_4_Conditional_0_Conditional_2_Template, 1, 2, "img", 6);
    \u0275\u0275elementStart(3, "h1");
    \u0275\u0275text(4);
    \u0275\u0275elementEnd();
    \u0275\u0275conditionalCreate(5, AuthorPage_Conditional_0_Conditional_4_Conditional_0_Conditional_5_Template, 2, 1, "div", 7);
    \u0275\u0275conditionalCreate(6, AuthorPage_Conditional_0_Conditional_4_Conditional_0_Conditional_6_Template, 2, 1, "p", 8);
    \u0275\u0275conditionalCreate(7, AuthorPage_Conditional_0_Conditional_4_Conditional_0_Conditional_7_Template, 3, 0, "ul", 9);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(8, "div", 1);
    \u0275\u0275element(9, "app-layout-renderer", 10);
    \u0275\u0275elementStart(10, "app-pagination", 11);
    \u0275\u0275listener("pageChange", function AuthorPage_Conditional_0_Conditional_4_Conditional_0_Template_app_pagination_pageChange_10_listener($event) {
      \u0275\u0275restoreView(_r3);
      const ctx_r0 = \u0275\u0275nextContext(3);
      return \u0275\u0275resetView(ctx_r0.goToPage($event));
    });
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const r_r4 = ctx;
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275conditional(r_r4.profile.coverImage ? 0 : -1);
    \u0275\u0275advance(2);
    \u0275\u0275conditional(r_r4.profile.image ? 2 : -1);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(r_r4.profile.name);
    \u0275\u0275advance();
    \u0275\u0275conditional(r_r4.profile.title ? 5 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(r_r4.profile.bio ? 6 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(r_r4.profile.socialLinks.length ? 7 : -1);
    \u0275\u0275advance(2);
    \u0275\u0275property("posts", r_r4.posts.data)("layout", ctx_r0.categoryLayout())("lang", ctx_r0.lang())("display", ctx_r0.display())("mobile", ctx_r0.mobile());
    \u0275\u0275advance();
    \u0275\u0275property("page", ctx_r0.page())("pageCount", r_r4.posts.pagination.totalPages)("lang", ctx_r0.lang());
  }
}
function AuthorPage_Conditional_0_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275conditionalCreate(0, AuthorPage_Conditional_0_Conditional_4_Conditional_0_Template, 11, 14);
  }
  if (rf & 2) {
    let tmp_2_0;
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275conditional((tmp_2_0 = ctx_r0.result()) ? 0 : -1, tmp_2_0);
  }
}
function AuthorPage_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-blog-header", 0);
    \u0275\u0275conditionalCreate(1, AuthorPage_Conditional_0_Conditional_1_Template, 2, 1, "div", 1)(2, AuthorPage_Conditional_0_Conditional_2_Template, 3, 1, "div", 1)(3, AuthorPage_Conditional_0_Conditional_3_Template, 2, 2, "div", 1)(4, AuthorPage_Conditional_0_Conditional_4_Template, 1, 1);
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275property("lang", ctx_r0.lang())("siteName", ctx_r0.siteName())("languages", ctx_r0.supportedLangs());
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.loading() && !ctx_r0.result() ? 1 : ctx_r0.notFound() ? 2 : ctx_r0.error() ? 3 : 4);
  }
}
var AuthorPage = class _AuthorPage {
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
    this.authorEmployeeId = signal("", ...ngDevMode ? [{ debugName: "authorEmployeeId" }] : (
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
  }
  ngOnInit() {
    return __async(this, null, function* () {
      this.route.paramMap.subscribe((p) => {
        this.lang.set(p.get("lang") ?? "en");
        this.authorEmployeeId.set(p.get("authorEmployeeId") ?? "");
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
        const r = yield this.api.getAuthorProfile(this.authorEmployeeId(), this.lang());
        this.result.set(r);
        this.applySeo(r);
      } catch (e) {
        if (e?.status === 404)
          this.notFound.set(true);
        else
          this.error.set(e?.message ?? "Failed to load author");
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
    const origin = this.settingsSvc.originUrl();
    const lang = this.lang();
    const url = `${origin}/${lang}/blog/authors/${this.authorEmployeeId()}`;
    this.seo.apply({
      title: `${r.profile.name} | ${this.siteName()}`,
      description: (r.profile.bio || "").slice(0, 160) || r.profile.title || r.profile.name,
      url,
      image: r.profile.image,
      type: "profile",
      locale: lang,
      hreflang: this.supportedLangs().map((l) => ({ lang: l, url: `${origin}/${l}/blog/authors/${this.authorEmployeeId()}` })),
      siteName: this.siteName()
    });
    this.seo.setJsonLd([{
      "@context": "https://schema.org",
      "@type": "Person",
      "name": r.profile.name,
      "jobTitle": r.profile.title || void 0,
      "image": r.profile.image || void 0,
      "description": r.profile.bio || void 0,
      "url": url,
      "sameAs": r.profile.socialLinks?.map((l) => l.url)
    }]);
  }
  static {
    this.\u0275fac = function AuthorPage_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _AuthorPage)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _AuthorPage, selectors: [["ng-component"]], decls: 1, vars: 1, consts: [[3, "lang", "siteName", "languages"], [1, "container"], [3, "count"], [3, "retry", "lang", "showRetry"], [1, "cover", 3, "background-image"], [1, "profile"], [1, "avatar", 3, "src", "alt"], [1, "title"], [1, "bio"], [1, "socials"], [3, "posts", "layout", "lang", "display", "mobile"], [3, "pageChange", "page", "pageCount", "lang"], [1, "cover"], ["target", "_blank", "rel", "noopener", 3, "href"]], template: function AuthorPage_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275conditionalCreate(0, AuthorPage_Conditional_0_Template, 5, 4);
      }
      if (rf & 2) {
        \u0275\u0275conditional(ctx.settingsLoaded() ? 0 : -1);
      }
    }, dependencies: [
      CommonModule,
      BlogHeaderComponent,
      LayoutRendererComponent,
      PaginationComponent,
      LoadingSkeletonComponent,
      ErrorBannerComponent
    ], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #111);\n}\n.container[_ngcontent-%COMP%] {\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.cover[_ngcontent-%COMP%] {\n  height: 240px;\n  background-size: cover;\n  background-position: center;\n}\n.profile[_ngcontent-%COMP%] {\n  text-align: center;\n  padding: 0 24px 24px;\n  max-width: 720px;\n  margin: 0 auto;\n}\n.avatar[_ngcontent-%COMP%] {\n  width: 128px;\n  height: 128px;\n  border-radius: 50%;\n  object-fit: cover;\n  margin-top: -64px;\n  border: 6px solid var(--body-bg, #fff);\n  box-shadow: 0 4px 12px rgba(0, 0, 0, .1);\n}\n.profile[_ngcontent-%COMP%]   h1[_ngcontent-%COMP%] {\n  margin: 16px 0 4px;\n  font-size: 28px;\n}\n.title[_ngcontent-%COMP%] {\n  opacity: .7;\n  font-size: 14px;\n}\n.bio[_ngcontent-%COMP%] {\n  margin: 16px 0;\n  line-height: 1.6;\n}\n.socials[_ngcontent-%COMP%] {\n  list-style: none;\n  padding: 0;\n  display: flex;\n  justify-content: center;\n  gap: 14px;\n}\n.socials[_ngcontent-%COMP%]   a[_ngcontent-%COMP%] {\n  color: var(--primary, #6366f1);\n  text-decoration: none;\n  text-transform: capitalize;\n}\n.socials[_ngcontent-%COMP%]   a[_ngcontent-%COMP%]:hover {\n  text-decoration: underline;\n}\n/*# sourceMappingURL=author.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(AuthorPage, [{
    type: Component,
    args: [{ standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [
      CommonModule,
      BlogHeaderComponent,
      LayoutRendererComponent,
      PaginationComponent,
      LoadingSkeletonComponent,
      ErrorBannerComponent
    ], template: `
    @if (settingsLoaded()) {
      <app-blog-header [lang]="lang()" [siteName]="siteName()" [languages]="supportedLangs()"></app-blog-header>

      @if (loading() && !result()) {
        <div class="container"><app-loading-skeleton [count]="6"></app-loading-skeleton></div>
      } @else if (notFound()) {
        <div class="container"><h1>{{ t(lang(), '404_title') }}</h1></div>
      } @else if (error()) {
        <div class="container"><app-error-banner [lang]="lang()" [showRetry]="true" (retry)="load()"></app-error-banner></div>
      } @else {
        @if (result(); as r) {
          @if (r.profile.coverImage) {
          <div class="cover" [style.background-image]="'url(' + r.profile.coverImage + ')'"></div>
        }
        <header class="profile">
          @if (r.profile.image) {
            <img [src]="r.profile.image" [alt]="r.profile.name" class="avatar">
          }
          <h1>{{ r.profile.name }}</h1>
          @if (r.profile.title) { <div class="title">{{ r.profile.title }}</div> }
          @if (r.profile.bio) { <p class="bio">{{ r.profile.bio }}</p> }
          @if (r.profile.socialLinks.length) {
            <ul class="socials">
              @for (l of r.profile.socialLinks; track l.url) {
                <li><a [href]="l.url" target="_blank" rel="noopener">{{ l.kind }}</a></li>
              }
            </ul>
          }
        </header>

        <div class="container">
          <app-layout-renderer
            [posts]="r.posts.data"
            [layout]="categoryLayout()"
            [lang]="lang()"
            [display]="display()"
            [mobile]="mobile()">
          </app-layout-renderer>

          <app-pagination
            [page]="page()"
            [pageCount]="r.posts.pagination.totalPages"
            [lang]="lang()"
            (pageChange)="goToPage($event)">
          </app-pagination>
        </div>
        }
      }
    }
  `, styles: ["/* angular:styles/component:css;ee9e5b7716097a5698591be7803e7028adb8e3e2350bcba959277697e9bd2456;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/pages/author.component.ts */\n:host {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #111);\n}\n.container {\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.cover {\n  height: 240px;\n  background-size: cover;\n  background-position: center;\n}\n.profile {\n  text-align: center;\n  padding: 0 24px 24px;\n  max-width: 720px;\n  margin: 0 auto;\n}\n.avatar {\n  width: 128px;\n  height: 128px;\n  border-radius: 50%;\n  object-fit: cover;\n  margin-top: -64px;\n  border: 6px solid var(--body-bg, #fff);\n  box-shadow: 0 4px 12px rgba(0, 0, 0, .1);\n}\n.profile h1 {\n  margin: 16px 0 4px;\n  font-size: 28px;\n}\n.title {\n  opacity: .7;\n  font-size: 14px;\n}\n.bio {\n  margin: 16px 0;\n  line-height: 1.6;\n}\n.socials {\n  list-style: none;\n  padding: 0;\n  display: flex;\n  justify-content: center;\n  gap: 14px;\n}\n.socials a {\n  color: var(--primary, #6366f1);\n  text-decoration: none;\n  text-transform: capitalize;\n}\n.socials a:hover {\n  text-decoration: underline;\n}\n/*# sourceMappingURL=author.component.css.map */\n"] }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(AuthorPage, { className: "AuthorPage", filePath: "src/app/features/blog/pages/author.component.ts", lineNumber: 99 });
})();
export {
  AuthorPage
};
//# sourceMappingURL=author.component-AI2ZSUJS.mjs.map
