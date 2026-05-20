import {
  BlogHeaderComponent,
  BlogSeoService,
  DefaultValueAccessor,
  ErrorBannerComponent,
  FormsModule,
  LanguageSwitcherComponent,
  MaxLengthValidator,
  MinLengthValidator,
  NgControlStatus,
  NgControlStatusGroup,
  NgForm,
  NgModel,
  NgSelectOption,
  PostCardComponent,
  RequiredValidator,
  SelectControlValueAccessor,
  ɵNgNoValidate,
  ɵNgSelectMultipleOption
} from "./chunk-BZK2EVHK.js";
import {
  formatDate,
  formatNumber,
  nativeLanguageName,
  t
} from "./chunk-TUMDR5WP.js";
import {
  ActivatedRoute,
  DomSanitizer,
  Router,
  RouterLink
} from "./chunk-J6HYFAOQ.js";
import {
  BlogSettingsService,
  PublicBlogApiService,
  environment
} from "./chunk-3I43LW5T.js";
import {
  ChangeDetectionStrategy,
  CommonModule,
  Component,
  EventEmitter,
  Injectable,
  Input,
  Output,
  PLATFORM_ID,
  __async,
  computed,
  inject,
  isPlatformBrowser,
  setClassMetadata,
  signal,
  ɵsetClassDebugInfo,
  ɵɵNgOnChangesFeature,
  ɵɵadvance,
  ɵɵattribute,
  ɵɵconditional,
  ɵɵconditionalCreate,
  ɵɵdefineComponent,
  ɵɵdefineInjectable,
  ɵɵdomElement,
  ɵɵdomElementEnd,
  ɵɵdomElementStart,
  ɵɵdomListener,
  ɵɵdomProperty,
  ɵɵelement,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵgetCurrentView,
  ɵɵlistener,
  ɵɵnextContext,
  ɵɵproperty,
  ɵɵpureFunction1,
  ɵɵpureFunction2,
  ɵɵreference,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵrepeaterTrackByIndex,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵsanitizeHtml,
  ɵɵsanitizeUrl,
  ɵɵstyleProp,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1,
  ɵɵtextInterpolate2,
  ɵɵtwoWayBindingSet,
  ɵɵtwoWayListener,
  ɵɵtwoWayProperty
} from "./chunk-K3KK4KPM.js";

// src/app/features/blog/components/breadcrumbs.component.ts
function BreadcrumbsComponent_For_3_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "a", 1);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const c_r1 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275property("routerLink", c_r1.link);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(c_r1.label);
  }
}
function BreadcrumbsComponent_For_3_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 2);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const c_r1 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(c_r1.label);
  }
}
function BreadcrumbsComponent_For_3_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 3);
    \u0275\u0275text(1, "\u203A");
    \u0275\u0275elementEnd();
  }
}
function BreadcrumbsComponent_For_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "li");
    \u0275\u0275conditionalCreate(1, BreadcrumbsComponent_For_3_Conditional_1_Template, 2, 2, "a", 1)(2, BreadcrumbsComponent_For_3_Conditional_2_Template, 2, 1, "span", 2);
    \u0275\u0275conditionalCreate(3, BreadcrumbsComponent_For_3_Conditional_3_Template, 2, 0, "span", 3);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const c_r1 = ctx.$implicit;
    const \u0275$index_5_r2 = ctx.$index;
    const \u0275$count_5_r3 = ctx.$count;
    \u0275\u0275advance();
    \u0275\u0275conditional(c_r1.link && !(\u0275$index_5_r2 === \u0275$count_5_r3 - 1) ? 1 : 2);
    \u0275\u0275advance(2);
    \u0275\u0275conditional(!(\u0275$index_5_r2 === \u0275$count_5_r3 - 1) ? 3 : -1);
  }
}
var BreadcrumbsComponent = class _BreadcrumbsComponent {
  constructor() {
    this.crumbs = [];
  }
  static {
    this.\u0275fac = function BreadcrumbsComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _BreadcrumbsComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _BreadcrumbsComponent, selectors: [["app-breadcrumbs"]], inputs: { crumbs: "crumbs" }, decls: 4, vars: 0, consts: [["aria-label", "Breadcrumb", 1, "crumbs"], [3, "routerLink"], ["aria-current", "page"], ["aria-hidden", "true", 1, "sep"]], template: function BreadcrumbsComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275elementStart(0, "nav", 0)(1, "ol");
        \u0275\u0275repeaterCreate(2, BreadcrumbsComponent_For_3_Template, 4, 2, "li", null, \u0275\u0275repeaterTrackByIndex);
        \u0275\u0275elementEnd()();
      }
      if (rf & 2) {
        \u0275\u0275advance(2);
        \u0275\u0275repeater(ctx.crumbs);
      }
    }, dependencies: [CommonModule, RouterLink], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n}\nol[_ngcontent-%COMP%] {\n  list-style: none;\n  padding: 0;\n  margin: 0;\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  font-size: 13px;\n  color: rgba(0, 0, 0, .6);\n}\nli[_ngcontent-%COMP%] {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\na[_ngcontent-%COMP%] {\n  color: inherit;\n  text-decoration: none;\n}\na[_ngcontent-%COMP%]:hover {\n  text-decoration: underline;\n}\n.sep[_ngcontent-%COMP%] {\n  opacity: .6;\n}\n[dir=rtl][_ngcontent-%COMP%]   .sep[_ngcontent-%COMP%] {\n  transform: scaleX(-1);\n}\n/*# sourceMappingURL=breadcrumbs.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(BreadcrumbsComponent, [{
    type: Component,
    args: [{ selector: "app-breadcrumbs", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule, RouterLink], template: `
    <nav class="crumbs" aria-label="Breadcrumb">
      <ol>
        @for (c of crumbs; track $index; let last = $last) {
          <li>
            @if (c.link && !last) {
              <a [routerLink]="c.link">{{ c.label }}</a>
            } @else {
              <span aria-current="page">{{ c.label }}</span>
            }
            @if (!last) { <span class="sep" aria-hidden="true">\u203A</span> }
          </li>
        }
      </ol>
    </nav>
  `, styles: ["/* angular:styles/component:css;23d75c151b545b997d34dc4397c5495c37d3a5dfa2cb6d20be7c66e2d78f8615;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/components/breadcrumbs.component.ts */\n:host {\n  display: block;\n}\nol {\n  list-style: none;\n  padding: 0;\n  margin: 0;\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  font-size: 13px;\n  color: rgba(0, 0, 0, .6);\n}\nli {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\na {\n  color: inherit;\n  text-decoration: none;\n}\na:hover {\n  text-decoration: underline;\n}\n.sep {\n  opacity: .6;\n}\n[dir=rtl] .sep {\n  transform: scaleX(-1);\n}\n/*# sourceMappingURL=breadcrumbs.component.css.map */\n"] }]
  }], null, { crumbs: [{
    type: Input,
    args: [{ required: true }]
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(BreadcrumbsComponent, { className: "BreadcrumbsComponent", filePath: "src/app/features/blog/components/breadcrumbs.component.ts", lineNumber: 41 });
})();

// src/app/features/blog/utils/hashtag-linker.ts
var HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;
function linkifyHashtags(html, lang) {
  if (!html)
    return html;
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(`<root>${html}</root>`, "text/html");
    const root = doc.body.firstElementChild;
    walk(root, lang);
    return root.innerHTML;
  }
  let out = "";
  let inTag = false;
  let buf = "";
  const flush = () => {
    if (!inTag && buf) {
      out += buf.replace(HASHTAG_RE, (_m, tag) => anchorFor(lang, tag));
      buf = "";
    } else if (inTag) {
      out += buf;
      buf = "";
    }
  };
  for (const ch of html) {
    if (ch === "<") {
      flush();
      inTag = true;
      buf = ch;
    } else if (ch === ">") {
      buf += ch;
      flush();
      inTag = false;
    } else
      buf += ch;
  }
  flush();
  return out;
}
function walk(node, lang) {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === 3) {
      const text = child.textContent ?? "";
      if (!HASHTAG_RE.test(text)) {
        HASHTAG_RE.lastIndex = 0;
        continue;
      }
      HASHTAG_RE.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      let m;
      while ((m = HASHTAG_RE.exec(text)) !== null) {
        if (m.index > last)
          frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const a = document.createElement("a");
        a.setAttribute("href", `/${lang}/blog/tag/${encodeURIComponent(m[1])}`);
        a.className = "blog-hashtag";
        a.textContent = `#${m[1]}`;
        frag.appendChild(a);
        last = m.index + m[0].length;
      }
      if (last < text.length)
        frag.appendChild(document.createTextNode(text.slice(last)));
      child.parentNode.replaceChild(frag, child);
    } else if (child.nodeType === 1) {
      const tag = child.tagName.toLowerCase();
      if (tag === "a" || tag === "code" || tag === "pre" || tag === "script" || tag === "style")
        continue;
      walk(child, lang);
    }
  }
}
function anchorFor(lang, tag) {
  const safe = tag.replace(/"/g, "&quot;");
  return `<a class="blog-hashtag" href="/${lang}/blog/tag/${encodeURIComponent(tag)}">#${safe}</a>`;
}

// src/app/features/blog/components/post-content.component.ts
var PostContentComponent = class _PostContentComponent {
  constructor() {
    this.html = "";
    this.lang = "en";
    this.sanitizer = inject(DomSanitizer);
    this.safe = "";
  }
  ngOnChanges(_) {
    const linked = linkifyHashtags(this.html, this.lang);
    this.safe = this.sanitizer.bypassSecurityTrustHtml(linked);
  }
  static {
    this.\u0275fac = function PostContentComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _PostContentComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _PostContentComponent, selectors: [["app-post-content"]], inputs: { html: "html", lang: "lang" }, features: [\u0275\u0275NgOnChangesFeature], decls: 1, vars: 1, consts: [[1, "prose", 3, "innerHTML"]], template: function PostContentComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275domElement(0, "div", 0);
      }
      if (rf & 2) {
        \u0275\u0275domProperty("innerHTML", ctx.safe, \u0275\u0275sanitizeHtml);
      }
    }, dependencies: [CommonModule], styles: ['\n[_nghost-%COMP%] {\n  display: block;\n}\n.prose[_ngcontent-%COMP%] {\n  max-width: 720px;\n  margin: 0 auto;\n  font-size: 18px;\n  line-height: 1.75;\n  color: inherit;\n}\n@media (max-width: 768px) {\n  .prose[_ngcontent-%COMP%] {\n    font-size: 16px;\n    line-height: 1.7;\n  }\n}\n.prose[_ngcontent-%COMP%]     h2 {\n  font-size: 30px;\n  line-height: 1.25;\n  margin: 48px 0 16px;\n  font-weight: 700;\n}\n.prose[_ngcontent-%COMP%]     h3 {\n  font-size: 22px;\n  line-height: 1.3;\n  margin: 36px 0 12px;\n  font-weight: 600;\n}\n.prose[_ngcontent-%COMP%]     p {\n  margin: 18px 0;\n}\n.prose[_ngcontent-%COMP%]     a {\n  color: var(--primary, #6366f1);\n  text-decoration-thickness: 1px;\n  text-underline-offset: 3px;\n}\n.prose[_ngcontent-%COMP%]     a:hover {\n  text-decoration: underline;\n}\n.prose[_ngcontent-%COMP%]     blockquote {\n  border-inline-start: 4px solid var(--primary, #6366f1);\n  padding: 4px 20px;\n  margin: 24px 0;\n  font-style: italic;\n  color: rgba(0, 0, 0, .7);\n}\n.prose[_ngcontent-%COMP%]     ul, \n.prose[_ngcontent-%COMP%]     ol {\n  padding-inline-start: 28px;\n  margin: 18px 0;\n}\n.prose[_ngcontent-%COMP%]     li {\n  margin: 6px 0;\n}\n.prose[_ngcontent-%COMP%]     img {\n  max-width: 100%;\n  height: auto;\n  border-radius: 8px;\n  margin: 24px 0;\n}\n.prose[_ngcontent-%COMP%]     figure {\n  margin: 24px 0;\n}\n.prose[_ngcontent-%COMP%]     figcaption {\n  font-size: 13px;\n  color: rgba(0, 0, 0, .55);\n  text-align: center;\n  margin-top: 6px;\n}\n.prose[_ngcontent-%COMP%]     pre {\n  background: rgba(0, 0, 0, .05);\n  padding: 16px;\n  border-radius: 8px;\n  overflow-x: auto;\n  font-size: 14px;\n}\n.prose[_ngcontent-%COMP%]     code {\n  font-family:\n    "SF Mono",\n    Menlo,\n    monospace;\n  background: rgba(0, 0, 0, .06);\n  padding: 2px 6px;\n  border-radius: 4px;\n  font-size: .9em;\n}\n.prose[_ngcontent-%COMP%]     pre code {\n  background: transparent;\n  padding: 0;\n}\n.prose[_ngcontent-%COMP%]     .blog-hashtag {\n  color: var(--primary, #6366f1);\n  font-weight: 500;\n  text-decoration: none;\n}\n.prose[_ngcontent-%COMP%]     .blog-hashtag:hover {\n  text-decoration: underline;\n}\n[dir=rtl][_ngcontent-%COMP%]   .prose[_ngcontent-%COMP%] {\n  text-align: right;\n}\n/*# sourceMappingURL=post-content.component.css.map */'], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PostContentComponent, [{
    type: Component,
    args: [{ selector: "app-post-content", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule], template: `<div class="prose" [innerHTML]="safe"></div>`, styles: ['/* angular:styles/component:css;08accb3bac9fbf84428728cd0146ac2901ebcc817d464f3e6f6beccc51746fbd;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/components/post-content.component.ts */\n:host {\n  display: block;\n}\n.prose {\n  max-width: 720px;\n  margin: 0 auto;\n  font-size: 18px;\n  line-height: 1.75;\n  color: inherit;\n}\n@media (max-width: 768px) {\n  .prose {\n    font-size: 16px;\n    line-height: 1.7;\n  }\n}\n.prose ::ng-deep h2 {\n  font-size: 30px;\n  line-height: 1.25;\n  margin: 48px 0 16px;\n  font-weight: 700;\n}\n.prose ::ng-deep h3 {\n  font-size: 22px;\n  line-height: 1.3;\n  margin: 36px 0 12px;\n  font-weight: 600;\n}\n.prose ::ng-deep p {\n  margin: 18px 0;\n}\n.prose ::ng-deep a {\n  color: var(--primary, #6366f1);\n  text-decoration-thickness: 1px;\n  text-underline-offset: 3px;\n}\n.prose ::ng-deep a:hover {\n  text-decoration: underline;\n}\n.prose ::ng-deep blockquote {\n  border-inline-start: 4px solid var(--primary, #6366f1);\n  padding: 4px 20px;\n  margin: 24px 0;\n  font-style: italic;\n  color: rgba(0, 0, 0, .7);\n}\n.prose ::ng-deep ul,\n.prose ::ng-deep ol {\n  padding-inline-start: 28px;\n  margin: 18px 0;\n}\n.prose ::ng-deep li {\n  margin: 6px 0;\n}\n.prose ::ng-deep img {\n  max-width: 100%;\n  height: auto;\n  border-radius: 8px;\n  margin: 24px 0;\n}\n.prose ::ng-deep figure {\n  margin: 24px 0;\n}\n.prose ::ng-deep figcaption {\n  font-size: 13px;\n  color: rgba(0, 0, 0, .55);\n  text-align: center;\n  margin-top: 6px;\n}\n.prose ::ng-deep pre {\n  background: rgba(0, 0, 0, .05);\n  padding: 16px;\n  border-radius: 8px;\n  overflow-x: auto;\n  font-size: 14px;\n}\n.prose ::ng-deep code {\n  font-family:\n    "SF Mono",\n    Menlo,\n    monospace;\n  background: rgba(0, 0, 0, .06);\n  padding: 2px 6px;\n  border-radius: 4px;\n  font-size: .9em;\n}\n.prose ::ng-deep pre code {\n  background: transparent;\n  padding: 0;\n}\n.prose ::ng-deep .blog-hashtag {\n  color: var(--primary, #6366f1);\n  font-weight: 500;\n  text-decoration: none;\n}\n.prose ::ng-deep .blog-hashtag:hover {\n  text-decoration: underline;\n}\n[dir=rtl] .prose {\n  text-align: right;\n}\n/*# sourceMappingURL=post-content.component.css.map */\n'] }]
  }], null, { html: [{
    type: Input,
    args: [{ required: true }]
  }], lang: [{
    type: Input,
    args: [{ required: true }]
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(PostContentComponent, { className: "PostContentComponent", filePath: "src/app/features/blog/components/post-content.component.ts", lineNumber: 65 });
})();

// src/app/features/blog/components/related-posts.component.ts
var _forTrack0 = ($index, $item) => $item.id;
function RelatedPostsComponent_Conditional_0_For_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-post-card", 2);
  }
  if (rf & 2) {
    const p_r1 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275property("post", p_r1)("lang", ctx_r1.lang)("display", ctx_r1.display);
  }
}
function RelatedPostsComponent_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "section", 0)(1, "h2");
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "div", 1);
    \u0275\u0275repeaterCreate(4, RelatedPostsComponent_Conditional_0_For_5_Template, 1, 3, "app-post-card", 2, _forTrack0);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r1.t(ctx_r1.lang, "related_posts"));
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r1.posts);
  }
}
var RelatedPostsComponent = class _RelatedPostsComponent {
  constructor() {
    this.posts = null;
    this.lang = "en";
    this.t = t;
  }
  static {
    this.\u0275fac = function RelatedPostsComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _RelatedPostsComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _RelatedPostsComponent, selectors: [["app-related-posts"]], inputs: { posts: "posts", lang: "lang", display: "display" }, decls: 1, vars: 1, consts: [[1, "related"], [1, "row"], ["variant", "compact", 3, "post", "lang", "display"]], template: function RelatedPostsComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275conditionalCreate(0, RelatedPostsComponent_Conditional_0_Template, 6, 1, "section", 0);
      }
      if (rf & 2) {
        \u0275\u0275conditional((ctx.posts == null ? null : ctx.posts.length) ? 0 : -1);
      }
    }, dependencies: [CommonModule, PostCardComponent], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n}\n.related[_ngcontent-%COMP%] {\n  margin: 48px 0;\n}\nh2[_ngcontent-%COMP%] {\n  font-size: 22px;\n  margin: 0 0 16px;\n}\n.row[_ngcontent-%COMP%] {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 20px;\n}\n@media (max-width: 768px) {\n  .row[_ngcontent-%COMP%] {\n    grid-auto-flow: column;\n    grid-auto-columns: 75vw;\n    grid-template-columns: none;\n    overflow-x: auto;\n    padding-bottom: 8px;\n  }\n}\n/*# sourceMappingURL=related-posts.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(RelatedPostsComponent, [{
    type: Component,
    args: [{ selector: "app-related-posts", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule, PostCardComponent], template: `
    @if (posts?.length) {
      <section class="related">
        <h2>{{ t(lang, 'related_posts') }}</h2>
        <div class="row">
          @for (p of posts; track p.id) {
            <app-post-card variant="compact"
                           [post]="p" [lang]="lang" [display]="display"></app-post-card>
          }
        </div>
      </section>
    }
  `, styles: ["/* angular:styles/component:css;9dc3825d8f44cb1009c3b20532f7e31630261ce53a7b27d0c22f1ffda3a22b55;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/components/related-posts.component.ts */\n:host {\n  display: block;\n}\n.related {\n  margin: 48px 0;\n}\nh2 {\n  font-size: 22px;\n  margin: 0 0 16px;\n}\n.row {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 20px;\n}\n@media (max-width: 768px) {\n  .row {\n    grid-auto-flow: column;\n    grid-auto-columns: 75vw;\n    grid-template-columns: none;\n    overflow-x: auto;\n    padding-bottom: 8px;\n  }\n}\n/*# sourceMappingURL=related-posts.component.css.map */\n"] }]
  }], null, { posts: [{
    type: Input
  }], lang: [{
    type: Input,
    args: [{ required: true }]
  }], display: [{
    type: Input,
    args: [{ required: true }]
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(RelatedPostsComponent, { className: "RelatedPostsComponent", filePath: "src/app/features/blog/components/related-posts.component.ts", lineNumber: 41 });
})();

// src/app/features/blog/components/author-card.component.ts
var _c0 = (a0, a1) => ["/", a0, "blog", "authors", a1];
var _c1 = (a0) => ({ name: a0 });
function AuthorCardComponent_Conditional_0_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "img", 1);
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275property("src", ctx_r0.author.image, \u0275\u0275sanitizeUrl)("alt", ctx_r0.author.name);
  }
}
function AuthorCardComponent_Conditional_0_Conditional_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 3);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.author.publicTitle);
  }
}
function AuthorCardComponent_Conditional_0_Conditional_6_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 4);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.author.publicBio);
  }
}
function AuthorCardComponent_Conditional_0_Conditional_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "a", 5);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275property("routerLink", \u0275\u0275pureFunction2(2, _c0, ctx_r0.lang, ctx_r0.author.id));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r0.t(ctx_r0.lang, "read_more_by", \u0275\u0275pureFunction1(5, _c1, ctx_r0.author.name)), " ");
  }
}
function AuthorCardComponent_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "aside", 0);
    \u0275\u0275conditionalCreate(1, AuthorCardComponent_Conditional_0_Conditional_1_Template, 1, 2, "img", 1);
    \u0275\u0275elementStart(2, "div", 2)(3, "strong");
    \u0275\u0275text(4);
    \u0275\u0275elementEnd();
    \u0275\u0275conditionalCreate(5, AuthorCardComponent_Conditional_0_Conditional_5_Template, 2, 1, "div", 3);
    \u0275\u0275conditionalCreate(6, AuthorCardComponent_Conditional_0_Conditional_6_Template, 2, 1, "p", 4);
    \u0275\u0275conditionalCreate(7, AuthorCardComponent_Conditional_0_Conditional_7_Template, 2, 7, "a", 5);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.author.image ? 1 : -1);
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r0.author.name);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.author.publicTitle ? 5 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.author.publicBio ? 6 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.author.id ? 7 : -1);
  }
}
var AuthorCardComponent = class _AuthorCardComponent {
  constructor() {
    this.author = null;
    this.lang = "en";
    this.t = t;
  }
  static {
    this.\u0275fac = function AuthorCardComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _AuthorCardComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _AuthorCardComponent, selectors: [["app-author-card"]], inputs: { author: "author", lang: "lang" }, decls: 1, vars: 1, consts: [[1, "author-card"], [1, "avatar", 3, "src", "alt"], [1, "who"], [1, "title"], [1, "bio"], [1, "btn", 3, "routerLink"]], template: function AuthorCardComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275conditionalCreate(0, AuthorCardComponent_Conditional_0_Template, 8, 5, "aside", 0);
      }
      if (rf & 2) {
        \u0275\u0275conditional(ctx.author ? 0 : -1);
      }
    }, dependencies: [CommonModule, RouterLink], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n}\n.author-card[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 20px;\n  align-items: flex-start;\n  padding: 24px;\n  background: rgba(0, 0, 0, .03);\n  border-radius: 12px;\n  margin: 48px 0;\n}\n.avatar[_ngcontent-%COMP%] {\n  width: 72px;\n  height: 72px;\n  border-radius: 50%;\n  object-fit: cover;\n  flex-shrink: 0;\n}\n.who[_ngcontent-%COMP%] {\n  flex: 1;\n}\n.title[_ngcontent-%COMP%] {\n  font-size: 13px;\n  opacity: .7;\n  margin-top: 2px;\n}\n.bio[_ngcontent-%COMP%] {\n  margin: 12px 0;\n  font-size: 15px;\n  line-height: 1.6;\n}\n.btn[_ngcontent-%COMP%] {\n  display: inline-block;\n  padding: 8px 14px;\n  border: 1px solid currentColor;\n  border-radius: 6px;\n  text-decoration: none;\n  color: inherit;\n  font-size: 14px;\n}\n.btn[_ngcontent-%COMP%]:hover {\n  background: rgba(0, 0, 0, .04);\n}\n@media (max-width: 600px) {\n  .author-card[_ngcontent-%COMP%] {\n    flex-direction: column;\n  }\n}\n/*# sourceMappingURL=author-card.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(AuthorCardComponent, [{
    type: Component,
    args: [{ selector: "app-author-card", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule, RouterLink], template: `
    @if (author) {
      <aside class="author-card">
        @if (author.image) {
          <img [src]="author.image" [alt]="author.name" class="avatar">
        }
        <div class="who">
          <strong>{{ author.name }}</strong>
          @if (author.publicTitle) { <div class="title">{{ author.publicTitle }}</div> }
          @if (author.publicBio) { <p class="bio">{{ author.publicBio }}</p> }
          @if (author.id) {
            <a [routerLink]="['/', lang, 'blog', 'authors', author.id]" class="btn">
              {{ t(lang, 'read_more_by', { name: author.name }) }}
            </a>
          }
        </div>
      </aside>
    }
  `, styles: ["/* angular:styles/component:css;b31daa0877014fbdfb943597114b4d9a2b0bf8e583b5a21a35df9d63c64f834f;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/components/author-card.component.ts */\n:host {\n  display: block;\n}\n.author-card {\n  display: flex;\n  gap: 20px;\n  align-items: flex-start;\n  padding: 24px;\n  background: rgba(0, 0, 0, .03);\n  border-radius: 12px;\n  margin: 48px 0;\n}\n.avatar {\n  width: 72px;\n  height: 72px;\n  border-radius: 50%;\n  object-fit: cover;\n  flex-shrink: 0;\n}\n.who {\n  flex: 1;\n}\n.title {\n  font-size: 13px;\n  opacity: .7;\n  margin-top: 2px;\n}\n.bio {\n  margin: 12px 0;\n  font-size: 15px;\n  line-height: 1.6;\n}\n.btn {\n  display: inline-block;\n  padding: 8px 14px;\n  border: 1px solid currentColor;\n  border-radius: 6px;\n  text-decoration: none;\n  color: inherit;\n  font-size: 14px;\n}\n.btn:hover {\n  background: rgba(0, 0, 0, .04);\n}\n@media (max-width: 600px) {\n  .author-card {\n    flex-direction: column;\n  }\n}\n/*# sourceMappingURL=author-card.component.css.map */\n"] }]
  }], null, { author: [{
    type: Input
  }], lang: [{
    type: Input,
    args: [{ required: true }]
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(AuthorCardComponent, { className: "AuthorCardComponent", filePath: "src/app/features/blog/components/author-card.component.ts", lineNumber: 56 });
})();

// src/app/features/blog/components/share-buttons.component.ts
var ShareButtonsComponent = class _ShareButtonsComponent {
  constructor() {
    this.url = "";
    this.title = "";
    this.lang = "en";
    this.platformId = inject(PLATFORM_ID);
    this.copied = signal(false, ...ngDevMode ? [{ debugName: "copied" }] : (
      /* istanbul ignore next */
      []
    ));
    this.t = (k) => t(this.lang, k);
  }
  fbUrl() {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.url)}`;
  }
  twUrl() {
    return `https://twitter.com/intent/tweet?url=${encodeURIComponent(this.url)}&text=${encodeURIComponent(this.title)}`;
  }
  liUrl() {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(this.url)}`;
  }
  waUrl() {
    return `https://wa.me/?text=${encodeURIComponent(this.title + " " + this.url)}`;
  }
  copy() {
    return __async(this, null, function* () {
      if (!isPlatformBrowser(this.platformId))
        return;
      try {
        yield navigator.clipboard.writeText(this.url);
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = this.url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    });
  }
  static {
    this.\u0275fac = function ShareButtonsComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _ShareButtonsComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _ShareButtonsComponent, selectors: [["app-share-buttons"]], inputs: { url: "url", title: "title", lang: "lang" }, decls: 11, vars: 6, consts: [["role", "group", 1, "share"], ["target", "_blank", "rel", "noopener", 1, "btn", 3, "href"], ["target", "_blank", "rel", "noopener", 1, "btn", "mobile-only", 3, "href"], ["type", "button", 1, "btn", 3, "click"]], template: function ShareButtonsComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275domElementStart(0, "div", 0)(1, "a", 1);
        \u0275\u0275text(2, "Facebook");
        \u0275\u0275domElementEnd();
        \u0275\u0275domElementStart(3, "a", 1);
        \u0275\u0275text(4, "X");
        \u0275\u0275domElementEnd();
        \u0275\u0275domElementStart(5, "a", 1);
        \u0275\u0275text(6, "LinkedIn");
        \u0275\u0275domElementEnd();
        \u0275\u0275domElementStart(7, "a", 2);
        \u0275\u0275text(8, "WhatsApp");
        \u0275\u0275domElementEnd();
        \u0275\u0275domElementStart(9, "button", 3);
        \u0275\u0275domListener("click", function ShareButtonsComponent_Template_button_click_9_listener() {
          return ctx.copy();
        });
        \u0275\u0275text(10);
        \u0275\u0275domElementEnd()();
      }
      if (rf & 2) {
        \u0275\u0275attribute("aria-label", ctx.t("share"));
        \u0275\u0275advance();
        \u0275\u0275domProperty("href", ctx.fbUrl(), \u0275\u0275sanitizeUrl);
        \u0275\u0275advance(2);
        \u0275\u0275domProperty("href", ctx.twUrl(), \u0275\u0275sanitizeUrl);
        \u0275\u0275advance(2);
        \u0275\u0275domProperty("href", ctx.liUrl(), \u0275\u0275sanitizeUrl);
        \u0275\u0275advance(2);
        \u0275\u0275domProperty("href", ctx.waUrl(), \u0275\u0275sanitizeUrl);
        \u0275\u0275advance(3);
        \u0275\u0275textInterpolate1(" ", ctx.copied() ? ctx.t("link_copied") : ctx.t("copy_link"), " ");
      }
    }, dependencies: [CommonModule], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n}\n.share[_ngcontent-%COMP%] {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n.btn[_ngcontent-%COMP%] {\n  padding: 8px 14px;\n  border-radius: 6px;\n  border: 1px solid rgba(0, 0, 0, .12);\n  background: transparent;\n  color: inherit;\n  text-decoration: none;\n  font: inherit;\n  font-size: 13px;\n  cursor: pointer;\n}\n.btn[_ngcontent-%COMP%]:hover {\n  background: rgba(0, 0, 0, .04);\n}\n@media (min-width: 769px) {\n  .mobile-only[_ngcontent-%COMP%] {\n    display: none;\n  }\n}\n/*# sourceMappingURL=share-buttons.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ShareButtonsComponent, [{
    type: Component,
    args: [{ selector: "app-share-buttons", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule], template: `
    <div class="share" role="group" [attr.aria-label]="t('share')">
      <a class="btn" target="_blank" rel="noopener" [href]="fbUrl()">Facebook</a>
      <a class="btn" target="_blank" rel="noopener" [href]="twUrl()">X</a>
      <a class="btn" target="_blank" rel="noopener" [href]="liUrl()">LinkedIn</a>
      <a class="btn mobile-only" target="_blank" rel="noopener" [href]="waUrl()">WhatsApp</a>
      <button class="btn" type="button" (click)="copy()">
        {{ copied() ? t('link_copied') : t('copy_link') }}
      </button>
    </div>
  `, styles: ["/* angular:styles/component:css;fb4769adb30910619a68ff4f2c5abf1845c0a34faa5671681c8b21e72870da49;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/components/share-buttons.component.ts */\n:host {\n  display: block;\n}\n.share {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n.btn {\n  padding: 8px 14px;\n  border-radius: 6px;\n  border: 1px solid rgba(0, 0, 0, .12);\n  background: transparent;\n  color: inherit;\n  text-decoration: none;\n  font: inherit;\n  font-size: 13px;\n  cursor: pointer;\n}\n.btn:hover {\n  background: rgba(0, 0, 0, .04);\n}\n@media (min-width: 769px) {\n  .mobile-only {\n    display: none;\n  }\n}\n/*# sourceMappingURL=share-buttons.component.css.map */\n"] }]
  }], null, { url: [{
    type: Input,
    args: [{ required: true }]
  }], title: [{
    type: Input,
    args: [{ required: true }]
  }], lang: [{
    type: Input
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(ShareButtonsComponent, { className: "ShareButtonsComponent", filePath: "src/app/features/blog/components/share-buttons.component.ts", lineNumber: 44 });
})();

// src/app/features/blog/services/shopper-auth.service.ts
var ShopperAuthService = class _ShopperAuthService {
  constructor() {
    this.platformId = inject(PLATFORM_ID);
    this._current = signal(null, ...ngDevMode ? [{ debugName: "_current" }] : (
      /* istanbul ignore next */
      []
    ));
    this._sessionId = signal(null, ...ngDevMode ? [{ debugName: "_sessionId" }] : (
      /* istanbul ignore next */
      []
    ));
    this._loaded = signal(false, ...ngDevMode ? [{ debugName: "_loaded" }] : (
      /* istanbul ignore next */
      []
    ));
    this.current = this._current.asReadonly();
    this.sessionId = this._sessionId.asReadonly();
    this.loaded = this._loaded.asReadonly();
    this.SESSION_KEY = "shopperSession";
    this.PROFILE_KEY = "shopperProfile";
    if (isPlatformBrowser(this.platformId)) {
      try {
        const sid = window.localStorage.getItem(this.SESSION_KEY);
        const raw = window.localStorage.getItem(this.PROFILE_KEY);
        if (sid)
          this._sessionId.set(sid);
        if (raw)
          this._current.set(JSON.parse(raw));
      } catch (e) {
      }
      this._loaded.set(true);
    }
  }
  /** Push a fresh session in from the shopper login flow.
   *  Pass null to clear (sign-out). */
  setSession(shopper, sessionId) {
    this._current.set(shopper);
    this._sessionId.set(sessionId);
    this._loaded.set(true);
    if (!isPlatformBrowser(this.platformId))
      return;
    try {
      if (shopper && sessionId) {
        window.localStorage.setItem(this.SESSION_KEY, sessionId);
        window.localStorage.setItem(this.PROFILE_KEY, JSON.stringify(shopper));
      } else {
        window.localStorage.removeItem(this.SESSION_KEY);
        window.localStorage.removeItem(this.PROFILE_KEY);
      }
    } catch (e) {
    }
  }
  /** Convenience for the UI when the user clicks "sign out" inside
   *  the blog. The actual logout HTTP call (if any) is the shell's
   *  responsibility — see the README for why this module no longer
   *  owns shopper-auth endpoints. */
  clear() {
    this.setSession(null, null);
  }
  static {
    this.\u0275fac = function ShopperAuthService_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _ShopperAuthService)();
    };
  }
  static {
    this.\u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _ShopperAuthService, factory: _ShopperAuthService.\u0275fac, providedIn: "root" });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ShopperAuthService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], () => [], null);
})();

// src/app/features/blog/components/comments/comment-item.component.ts
var _forTrack02 = ($index, $item) => $item.id;
function CommentItemComponent_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "img", 2);
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275property("src", ctx_r0.comment.author.image, \u0275\u0275sanitizeUrl)("alt", ctx_r0.comment.author.name);
  }
}
function CommentItemComponent_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 3);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.initials());
  }
}
function CommentItemComponent_Conditional_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 6);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang, "pending_approval"));
  }
}
function CommentItemComponent_Conditional_12_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 8);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang, "comment_deleted"));
  }
}
function CommentItemComponent_Conditional_13_Template(rf, ctx) {
  if (rf & 1) {
    const _r2 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "textarea", 10);
    \u0275\u0275twoWayListener("ngModelChange", function CommentItemComponent_Conditional_13_Template_textarea_ngModelChange_0_listener($event) {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r0.draft, $event) || (ctx_r0.draft = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(1, "div", 11)(2, "button", 12);
    \u0275\u0275listener("click", function CommentItemComponent_Conditional_13_Template_button_click_2_listener() {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.saveEdit());
    });
    \u0275\u0275text(3);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(4, "button", 13);
    \u0275\u0275listener("click", function CommentItemComponent_Conditional_13_Template_button_click_4_listener() {
      \u0275\u0275restoreView(_r2);
      const ctx_r0 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r0.cancelEdit());
    });
    \u0275\u0275text(5);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275twoWayProperty("ngModel", ctx_r0.draft);
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang, "save"));
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang, "cancel"));
  }
}
function CommentItemComponent_Conditional_14_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 16);
    \u0275\u0275listener("click", function CommentItemComponent_Conditional_14_Conditional_3_Template_button_click_0_listener() {
      \u0275\u0275restoreView(_r3);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.reply.emit({ parentId: ctx_r0.comment.id }));
    });
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang, "reply"));
  }
}
function CommentItemComponent_Conditional_14_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    const _r4 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "button", 16);
    \u0275\u0275listener("click", function CommentItemComponent_Conditional_14_Conditional_4_Template_button_click_0_listener() {
      \u0275\u0275restoreView(_r4);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.startEdit());
    });
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(2, "button", 17);
    \u0275\u0275listener("click", function CommentItemComponent_Conditional_14_Conditional_4_Template_button_click_2_listener() {
      \u0275\u0275restoreView(_r4);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.del.emit({ id: ctx_r0.comment.id }));
    });
    \u0275\u0275text(3);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang, "edit"));
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang, "delete"));
  }
}
function CommentItemComponent_Conditional_14_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 14);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(2, "div", 11);
    \u0275\u0275conditionalCreate(3, CommentItemComponent_Conditional_14_Conditional_3_Template, 2, 1, "button", 15);
    \u0275\u0275conditionalCreate(4, CommentItemComponent_Conditional_14_Conditional_4_Template, 4, 2);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.comment.content);
    \u0275\u0275advance(2);
    \u0275\u0275conditional(ctx_r0.canReply && !ctx_r0.comment.isPending ? 3 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.comment.canEdit ? 4 : -1);
  }
}
function CommentItemComponent_Conditional_15_For_2_Template(rf, ctx) {
  if (rf & 1) {
    const _r5 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "app-comment-item", 19);
    \u0275\u0275listener("reply", function CommentItemComponent_Conditional_15_For_2_Template_app_comment_item_reply_0_listener($event) {
      \u0275\u0275restoreView(_r5);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.reply.emit($event));
    })("edit", function CommentItemComponent_Conditional_15_For_2_Template_app_comment_item_edit_0_listener($event) {
      \u0275\u0275restoreView(_r5);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.edit.emit($event));
    })("del", function CommentItemComponent_Conditional_15_For_2_Template_app_comment_item_del_0_listener($event) {
      \u0275\u0275restoreView(_r5);
      const ctx_r0 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r0.del.emit($event));
    });
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const child_r6 = ctx.$implicit;
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275property("comment", child_r6)("lang", ctx_r0.lang)("depth", ctx_r0.depth + 1)("canReply", ctx_r0.depth + 1 < ctx_r0.maxDepth)("maxDepth", ctx_r0.maxDepth);
  }
}
function CommentItemComponent_Conditional_15_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 9);
    \u0275\u0275repeaterCreate(1, CommentItemComponent_Conditional_15_For_2_Template, 1, 5, "app-comment-item", 18, _forTrack02);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r0.comment.replies);
  }
}
var CommentItemComponent = class _CommentItemComponent {
  constructor() {
    this.lang = "en";
    this.depth = 0;
    this.maxDepth = 3;
    this.canReply = true;
    this.reply = new EventEmitter();
    this.edit = new EventEmitter();
    this.del = new EventEmitter();
    this.editing = signal(false, ...ngDevMode ? [{ debugName: "editing" }] : (
      /* istanbul ignore next */
      []
    ));
    this.draft = "";
    this.t = t;
    this.formatDate = formatDate;
  }
  initials() {
    return (this.comment.author.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  }
  startEdit() {
    this.draft = this.comment.content ?? "";
    this.editing.set(true);
  }
  cancelEdit() {
    this.editing.set(false);
    this.draft = "";
  }
  saveEdit() {
    const text = this.draft.trim();
    if (!text)
      return;
    this.edit.emit({ id: this.comment.id, content: text });
    this.editing.set(false);
  }
  static {
    this.\u0275fac = function CommentItemComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _CommentItemComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _CommentItemComponent, selectors: [["app-comment-item"]], inputs: { comment: "comment", lang: "lang", depth: "depth", maxDepth: "maxDepth", canReply: "canReply" }, outputs: { reply: "reply", edit: "edit", del: "del" }, decls: 16, vars: 10, consts: [[1, "cmt"], [1, "head"], [1, "avatar", 3, "src", "alt"], ["aria-hidden", "true", 1, "avatar", "placeholder"], [1, "who"], [1, "kind"], [1, "pending"], [1, "when"], [1, "deleted"], [1, "children"], ["rows", "3", 1, "ta", 3, "ngModelChange", "ngModel"], [1, "actions"], ["type", "button", 1, "btn", "primary", 3, "click"], ["type", "button", 1, "btn", 3, "click"], [1, "body"], ["type", "button", 1, "link"], ["type", "button", 1, "link", 3, "click"], ["type", "button", 1, "link", "danger", 3, "click"], [3, "comment", "lang", "depth", "canReply", "maxDepth"], [3, "reply", "edit", "del", "comment", "lang", "depth", "canReply", "maxDepth"]], template: function CommentItemComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275elementStart(0, "div", 0)(1, "header", 1);
        \u0275\u0275conditionalCreate(2, CommentItemComponent_Conditional_2_Template, 1, 2, "img", 2)(3, CommentItemComponent_Conditional_3_Template, 2, 1, "div", 3);
        \u0275\u0275elementStart(4, "div", 4)(5, "strong");
        \u0275\u0275text(6);
        \u0275\u0275elementEnd();
        \u0275\u0275elementStart(7, "span", 5);
        \u0275\u0275text(8);
        \u0275\u0275elementEnd();
        \u0275\u0275conditionalCreate(9, CommentItemComponent_Conditional_9_Template, 2, 1, "span", 6);
        \u0275\u0275elementEnd();
        \u0275\u0275elementStart(10, "time", 7);
        \u0275\u0275text(11);
        \u0275\u0275elementEnd()();
        \u0275\u0275conditionalCreate(12, CommentItemComponent_Conditional_12_Template, 2, 1, "p", 8)(13, CommentItemComponent_Conditional_13_Template, 6, 3)(14, CommentItemComponent_Conditional_14_Template, 5, 3);
        \u0275\u0275conditionalCreate(15, CommentItemComponent_Conditional_15_Template, 3, 0, "div", 9);
        \u0275\u0275elementEnd();
      }
      if (rf & 2) {
        \u0275\u0275styleProp("padding-inline-start", ctx.depth * 24, "px");
        \u0275\u0275advance(2);
        \u0275\u0275conditional(ctx.comment.author.image ? 2 : 3);
        \u0275\u0275advance(4);
        \u0275\u0275textInterpolate(ctx.comment.author.name);
        \u0275\u0275advance(2);
        \u0275\u0275textInterpolate(ctx.comment.author.type === "employee" ? ctx.t(ctx.lang, "staff") : ctx.t(ctx.lang, "customer"));
        \u0275\u0275advance();
        \u0275\u0275conditional(ctx.comment.isPending ? 9 : -1);
        \u0275\u0275advance();
        \u0275\u0275attribute("datetime", ctx.comment.createdAt);
        \u0275\u0275advance();
        \u0275\u0275textInterpolate(ctx.formatDate(ctx.lang, ctx.comment.createdAt));
        \u0275\u0275advance();
        \u0275\u0275conditional(ctx.comment.isDeleted ? 12 : ctx.editing() ? 13 : 14);
        \u0275\u0275advance(3);
        \u0275\u0275conditional(ctx.comment.replies.length ? 15 : -1);
      }
    }, dependencies: [_CommentItemComponent, CommonModule, FormsModule, DefaultValueAccessor, NgControlStatus, NgModel], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n}\n.cmt[_ngcontent-%COMP%] {\n  padding: 16px 0;\n  border-block-start: 1px solid rgba(0, 0, 0, .06);\n}\n.cmt[_ngcontent-%COMP%]:first-child {\n  border-block-start: 0;\n}\n.head[_ngcontent-%COMP%] {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n.avatar[_ngcontent-%COMP%] {\n  width: 36px;\n  height: 36px;\n  border-radius: 50%;\n  object-fit: cover;\n}\n.avatar.placeholder[_ngcontent-%COMP%] {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  background: var(--primary, #6366f1);\n  color: #fff;\n  font-size: 14px;\n}\n.who[_ngcontent-%COMP%] {\n  flex: 1;\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  font-size: 14px;\n}\n.kind[_ngcontent-%COMP%] {\n  font-size: 11px;\n  padding: 2px 6px;\n  border-radius: 100px;\n  background: rgba(0, 0, 0, .06);\n}\n.pending[_ngcontent-%COMP%] {\n  font-size: 11px;\n  padding: 2px 8px;\n  border-radius: 100px;\n  background: rgba(255, 180, 0, .15);\n  color: #a47000;\n}\n.when[_ngcontent-%COMP%] {\n  font-size: 12px;\n  opacity: .6;\n}\n.body[_ngcontent-%COMP%] {\n  margin: 10px 0 8px;\n  line-height: 1.55;\n  white-space: pre-wrap;\n}\n.deleted[_ngcontent-%COMP%] {\n  color: rgba(0, 0, 0, .45);\n  font-style: italic;\n  margin: 10px 0;\n}\n.actions[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 14px;\n}\n.link[_ngcontent-%COMP%] {\n  background: none;\n  border: 0;\n  padding: 0;\n  cursor: pointer;\n  color: var(--primary, #6366f1);\n  font: inherit;\n  font-size: 13px;\n}\n.link.danger[_ngcontent-%COMP%] {\n  color: #c33;\n}\n.ta[_ngcontent-%COMP%] {\n  width: 100%;\n  padding: 10px;\n  border: 1px solid rgba(0, 0, 0, .15);\n  border-radius: 6px;\n  font: inherit;\n  resize: vertical;\n}\n.btn[_ngcontent-%COMP%] {\n  padding: 6px 12px;\n  border: 1px solid rgba(0, 0, 0, .15);\n  border-radius: 6px;\n  background: transparent;\n  cursor: pointer;\n  font: inherit;\n}\n.btn.primary[_ngcontent-%COMP%] {\n  background: var(--primary, #6366f1);\n  color: #fff;\n  border-color: transparent;\n}\n.children[_ngcontent-%COMP%] {\n  margin-top: 12px;\n}\n/*# sourceMappingURL=comment-item.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(CommentItemComponent, [{
    type: Component,
    args: [{ selector: "app-comment-item", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule, FormsModule], template: `
    <div class="cmt" [style.padding-inline-start.px]="depth * 24">
      <header class="head">
        @if (comment.author.image) {
          <img class="avatar" [src]="comment.author.image" [alt]="comment.author.name">
        } @else {
          <div class="avatar placeholder" aria-hidden="true">{{ initials() }}</div>
        }
        <div class="who">
          <strong>{{ comment.author.name }}</strong>
          <span class="kind">{{ comment.author.type === 'employee' ? t(lang, 'staff') : t(lang, 'customer') }}</span>
          @if (comment.isPending) {
            <span class="pending">{{ t(lang, 'pending_approval') }}</span>
          }
        </div>
        <time class="when" [attr.datetime]="comment.createdAt">{{ formatDate(lang, comment.createdAt) }}</time>
      </header>

      @if (comment.isDeleted) {
        <p class="deleted">{{ t(lang, 'comment_deleted') }}</p>
      } @else if (editing()) {
        <textarea class="ta" rows="3" [(ngModel)]="draft"></textarea>
        <div class="actions">
          <button type="button" class="btn primary" (click)="saveEdit()">{{ t(lang, 'save') }}</button>
          <button type="button" class="btn" (click)="cancelEdit()">{{ t(lang, 'cancel') }}</button>
        </div>
      } @else {
        <p class="body">{{ comment.content }}</p>
        <div class="actions">
          @if (canReply && !comment.isPending) {
            <button type="button" class="link" (click)="reply.emit({ parentId: comment.id })">{{ t(lang, 'reply') }}</button>
          }
          @if (comment.canEdit) {
            <button type="button" class="link" (click)="startEdit()">{{ t(lang, 'edit') }}</button>
            <button type="button" class="link danger" (click)="del.emit({ id: comment.id })">{{ t(lang, 'delete') }}</button>
          }
        </div>
      }

      @if (comment.replies.length) {
        <div class="children">
          @for (child of comment.replies; track child.id) {
            <app-comment-item
              [comment]="child"
              [lang]="lang"
              [depth]="depth + 1"
              [canReply]="depth + 1 < maxDepth"
              [maxDepth]="maxDepth"
              (reply)="reply.emit($event)"
              (edit)="edit.emit($event)"
              (del)="del.emit($event)">
            </app-comment-item>
          }
        </div>
      }
    </div>
  `, styles: ["/* angular:styles/component:css;e1ed2763d926cef7988906a03b66c235c34644aa6e45b31ea4961e2c6331af5e;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/components/comments/comment-item.component.ts */\n:host {\n  display: block;\n}\n.cmt {\n  padding: 16px 0;\n  border-block-start: 1px solid rgba(0, 0, 0, .06);\n}\n.cmt:first-child {\n  border-block-start: 0;\n}\n.head {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n.avatar {\n  width: 36px;\n  height: 36px;\n  border-radius: 50%;\n  object-fit: cover;\n}\n.avatar.placeholder {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  background: var(--primary, #6366f1);\n  color: #fff;\n  font-size: 14px;\n}\n.who {\n  flex: 1;\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  font-size: 14px;\n}\n.kind {\n  font-size: 11px;\n  padding: 2px 6px;\n  border-radius: 100px;\n  background: rgba(0, 0, 0, .06);\n}\n.pending {\n  font-size: 11px;\n  padding: 2px 8px;\n  border-radius: 100px;\n  background: rgba(255, 180, 0, .15);\n  color: #a47000;\n}\n.when {\n  font-size: 12px;\n  opacity: .6;\n}\n.body {\n  margin: 10px 0 8px;\n  line-height: 1.55;\n  white-space: pre-wrap;\n}\n.deleted {\n  color: rgba(0, 0, 0, .45);\n  font-style: italic;\n  margin: 10px 0;\n}\n.actions {\n  display: flex;\n  gap: 14px;\n}\n.link {\n  background: none;\n  border: 0;\n  padding: 0;\n  cursor: pointer;\n  color: var(--primary, #6366f1);\n  font: inherit;\n  font-size: 13px;\n}\n.link.danger {\n  color: #c33;\n}\n.ta {\n  width: 100%;\n  padding: 10px;\n  border: 1px solid rgba(0, 0, 0, .15);\n  border-radius: 6px;\n  font: inherit;\n  resize: vertical;\n}\n.btn {\n  padding: 6px 12px;\n  border: 1px solid rgba(0, 0, 0, .15);\n  border-radius: 6px;\n  background: transparent;\n  cursor: pointer;\n  font: inherit;\n}\n.btn.primary {\n  background: var(--primary, #6366f1);\n  color: #fff;\n  border-color: transparent;\n}\n.children {\n  margin-top: 12px;\n}\n/*# sourceMappingURL=comment-item.component.css.map */\n"] }]
  }], null, { comment: [{
    type: Input,
    args: [{ required: true }]
  }], lang: [{
    type: Input,
    args: [{ required: true }]
  }], depth: [{
    type: Input
  }], maxDepth: [{
    type: Input
  }], canReply: [{
    type: Input
  }], reply: [{
    type: Output
  }], edit: [{
    type: Output
  }], del: [{
    type: Output
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(CommentItemComponent, { className: "CommentItemComponent", filePath: "src/app/features/blog/components/comments/comment-item.component.ts", lineNumber: 110 });
})();

// src/app/features/blog/components/comments/comment-section.component.ts
var _c02 = (a0) => ({ n: a0 });
var _c12 = (a0) => ({ name: a0 });
var _forTrack03 = ($index, $item) => $item.id;
function CommentSectionComponent_Conditional_0_Conditional_12_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 7)(1, "p");
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "button", 12);
    \u0275\u0275listener("click", function CommentSectionComponent_Conditional_0_Conditional_12_Template_button_click_3_listener() {
      \u0275\u0275restoreView(_r3);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.loginRequest.set(true));
    });
    \u0275\u0275text(4);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r1.t(ctx_r1.lang, "sign_in_to_comment"));
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate1(" ", ctx_r1.t(ctx_r1.lang, "sign_in"), " ");
  }
}
function CommentSectionComponent_Conditional_0_Conditional_13_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    const _r5 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 14);
    \u0275\u0275text(1);
    \u0275\u0275elementStart(2, "button", 19);
    \u0275\u0275listener("click", function CommentSectionComponent_Conditional_0_Conditional_13_Conditional_2_Template_button_click_2_listener() {
      \u0275\u0275restoreView(_r5);
      const ctx_r1 = \u0275\u0275nextContext(3);
      return \u0275\u0275resetView(ctx_r1.cancelReply());
    });
    \u0275\u0275text(3);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(3);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r1.t(ctx_r1.lang, "reply_to", \u0275\u0275pureFunction1(2, _c12, ctx_r1.replyTo().author.name)), " ");
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r1.t(ctx_r1.lang, "cancel"));
  }
}
function CommentSectionComponent_Conditional_0_Conditional_13_Conditional_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 18);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(3);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r1.submitError());
  }
}
function CommentSectionComponent_Conditional_0_Conditional_13_Template(rf, ctx) {
  if (rf & 1) {
    const _r4 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "form", 13, 0);
    \u0275\u0275listener("ngSubmit", function CommentSectionComponent_Conditional_0_Conditional_13_Template_form_ngSubmit_0_listener() {
      \u0275\u0275restoreView(_r4);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.submit());
    });
    \u0275\u0275conditionalCreate(2, CommentSectionComponent_Conditional_0_Conditional_13_Conditional_2_Template, 4, 4, "div", 14);
    \u0275\u0275elementStart(3, "textarea", 15);
    \u0275\u0275twoWayListener("ngModelChange", function CommentSectionComponent_Conditional_0_Conditional_13_Template_textarea_ngModelChange_3_listener($event) {
      \u0275\u0275restoreView(_r4);
      const ctx_r1 = \u0275\u0275nextContext(2);
      \u0275\u0275twoWayBindingSet(ctx_r1.draft, $event) || (ctx_r1.draft = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(4, "div", 16)(5, "button", 17);
    \u0275\u0275text(6);
    \u0275\u0275elementEnd()();
    \u0275\u0275conditionalCreate(7, CommentSectionComponent_Conditional_0_Conditional_13_Conditional_7_Template, 2, 1, "p", 18);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const f_r6 = \u0275\u0275reference(1);
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275conditional(ctx_r1.replyTo() ? 2 : -1);
    \u0275\u0275advance();
    \u0275\u0275twoWayProperty("ngModel", ctx_r1.draft);
    \u0275\u0275property("placeholder", ctx_r1.t(ctx_r1.lang, "write_a_comment"));
    \u0275\u0275attribute("aria-label", ctx_r1.t(ctx_r1.lang, "write_a_comment"));
    \u0275\u0275advance(2);
    \u0275\u0275property("disabled", ctx_r1.submitting() || !ctx_r1.draft.trim() || f_r6.invalid);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r1.t(ctx_r1.lang, "post_comment"), " ");
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r1.submitError() ? 7 : -1);
  }
}
function CommentSectionComponent_Conditional_0_Conditional_14_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 9);
    \u0275\u0275text(1, "\u2026");
    \u0275\u0275elementEnd();
  }
}
function CommentSectionComponent_Conditional_0_Conditional_15_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 10);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r1.t(ctx_r1.lang, "no_comments"));
  }
}
function CommentSectionComponent_Conditional_0_Conditional_16_For_2_Template(rf, ctx) {
  if (rf & 1) {
    const _r7 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "app-comment-item", 21);
    \u0275\u0275listener("reply", function CommentSectionComponent_Conditional_0_Conditional_16_For_2_Template_app_comment_item_reply_0_listener($event) {
      \u0275\u0275restoreView(_r7);
      const ctx_r1 = \u0275\u0275nextContext(3);
      return \u0275\u0275resetView(ctx_r1.onReply($event));
    })("edit", function CommentSectionComponent_Conditional_0_Conditional_16_For_2_Template_app_comment_item_edit_0_listener($event) {
      \u0275\u0275restoreView(_r7);
      const ctx_r1 = \u0275\u0275nextContext(3);
      return \u0275\u0275resetView(ctx_r1.onEdit($event));
    })("del", function CommentSectionComponent_Conditional_0_Conditional_16_For_2_Template_app_comment_item_del_0_listener($event) {
      \u0275\u0275restoreView(_r7);
      const ctx_r1 = \u0275\u0275nextContext(3);
      return \u0275\u0275resetView(ctx_r1.onDelete($event));
    });
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const c_r8 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext(3);
    \u0275\u0275property("comment", c_r8)("lang", ctx_r1.lang)("maxDepth", ctx_r1.settings.maxDepth)("canReply", ctx_r1.settings.allowReplies && 0 < ctx_r1.settings.maxDepth);
  }
}
function CommentSectionComponent_Conditional_0_Conditional_16_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 11);
    \u0275\u0275repeaterCreate(1, CommentSectionComponent_Conditional_0_Conditional_16_For_2_Template, 1, 4, "app-comment-item", 20, _forTrack03);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r1.sorted());
  }
}
function CommentSectionComponent_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "section", 1)(1, "header", 2)(2, "h2");
    \u0275\u0275text(3);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(4, "label", 3)(5, "span");
    \u0275\u0275text(6);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(7, "select", 4);
    \u0275\u0275listener("ngModelChange", function CommentSectionComponent_Conditional_0_Template_select_ngModelChange_7_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.sort.set($event));
    });
    \u0275\u0275elementStart(8, "option", 5);
    \u0275\u0275text(9);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(10, "option", 6);
    \u0275\u0275text(11);
    \u0275\u0275elementEnd()()()();
    \u0275\u0275conditionalCreate(12, CommentSectionComponent_Conditional_0_Conditional_12_Template, 5, 2, "div", 7)(13, CommentSectionComponent_Conditional_0_Conditional_13_Template, 8, 7, "form", 8);
    \u0275\u0275conditionalCreate(14, CommentSectionComponent_Conditional_0_Conditional_14_Template, 2, 0, "p", 9)(15, CommentSectionComponent_Conditional_0_Conditional_15_Template, 2, 1, "p", 10)(16, CommentSectionComponent_Conditional_0_Conditional_16_Template, 3, 0, "div", 11);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r1.t(ctx_r1.lang, "comments_count", \u0275\u0275pureFunction1(7, _c02, ctx_r1.formatNumber(ctx_r1.lang, ctx_r1.totalCount()))));
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate1("", ctx_r1.t(ctx_r1.lang, "sort_by"), ":");
    \u0275\u0275advance();
    \u0275\u0275property("ngModel", ctx_r1.sort());
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r1.t(ctx_r1.lang, "newest"));
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r1.t(ctx_r1.lang, "oldest"));
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r1.settings.requireShopperLogin && !ctx_r1.shopperAuth.current() && ctx_r1.shopperAuth.loaded() ? 12 : 13);
    \u0275\u0275advance(2);
    \u0275\u0275conditional(ctx_r1.loading() ? 14 : ctx_r1.comments().length === 0 ? 15 : 16);
  }
}
var CommentSectionComponent = class _CommentSectionComponent {
  constructor() {
    this.api = inject(PublicBlogApiService);
    this.shopperAuth = inject(ShopperAuthService);
    this.comments = signal([], ...ngDevMode ? [{ debugName: "comments" }] : (
      /* istanbul ignore next */
      []
    ));
    this.loading = signal(false, ...ngDevMode ? [{ debugName: "loading" }] : (
      /* istanbul ignore next */
      []
    ));
    this.sort = signal("newest", ...ngDevMode ? [{ debugName: "sort" }] : (
      /* istanbul ignore next */
      []
    ));
    this.draft = "";
    this.replyTo = signal(null, ...ngDevMode ? [{ debugName: "replyTo" }] : (
      /* istanbul ignore next */
      []
    ));
    this.submitting = signal(false, ...ngDevMode ? [{ debugName: "submitting" }] : (
      /* istanbul ignore next */
      []
    ));
    this.submitError = signal(null, ...ngDevMode ? [{ debugName: "submitError" }] : (
      /* istanbul ignore next */
      []
    ));
    this.loginRequest = signal(false, ...ngDevMode ? [{ debugName: "loginRequest" }] : (
      /* istanbul ignore next */
      []
    ));
    this.t = t;
    this.formatNumber = formatNumber;
  }
  ngOnChanges(c) {
    if (c["postId"] && this.postId)
      this.load();
  }
  totalCount() {
    const walk2 = (n) => n.reduce((sum, x) => sum + (x.isDeleted ? 0 : 1) + walk2(x.replies ?? []), 0);
    return walk2(this.comments());
  }
  sorted() {
    const dir = this.sort() === "newest" ? -1 : 1;
    const copy = [...this.comments()];
    copy.sort((a, b) => dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    return copy;
  }
  load() {
    return __async(this, null, function* () {
      if (!this.settings.enabled)
        return;
      this.loading.set(true);
      try {
        const list = yield this.api.listPostComments(this.postId, this.lang);
        this.comments.set(list ?? []);
      } catch (e) {
        this.comments.set([]);
      } finally {
        this.loading.set(false);
      }
    });
  }
  submit() {
    return __async(this, null, function* () {
      const text = this.draft.trim();
      if (!text)
        return;
      this.submitting.set(true);
      this.submitError.set(null);
      try {
        yield this.api.createComment(this.postId, {
          content: text,
          parentCommentId: this.replyTo()?.id ?? null,
          language: this.lang
        });
        this.draft = "";
        this.replyTo.set(null);
        yield this.load();
      } catch (e) {
        this.submitError.set(this.errorMessage(e));
      } finally {
        this.submitting.set(false);
      }
    });
  }
  /** Map the backend `{ error: { code, message } }` envelope (and
   *  HTTP status) onto a user-facing string. Rate limiting gets a
   *  bespoke message; everything else falls back to the server
   *  message or a generic line. */
  errorMessage(e) {
    const code = e?.error?.error?.code ?? e?.error?.code;
    const status = e?.status;
    if (code === "RATE_LIMITED" || status === 429) {
      return "You\u2019re posting too quickly \u2014 please try again in a moment.";
    }
    if (code === "UNAUTHORIZED" || status === 401) {
      return t(this.lang, "sign_in_to_comment");
    }
    if (code === "COMMENTS_DISABLED")
      return "Comments are disabled for this post.";
    if (code === "DEPTH_EXCEEDED")
      return "Reply depth limit reached.";
    if (code === "FORBIDDEN" || status === 403)
      return "You don\u2019t have permission to do that.";
    return e?.error?.error?.message ?? e?.error?.message ?? e?.message ?? "Failed to post comment.";
  }
  cancelReply() {
    this.replyTo.set(null);
  }
  onReply(r) {
    const found = this.findById(this.comments(), r.parentId);
    if (found)
      this.replyTo.set(found);
  }
  onEdit(e) {
    return __async(this, null, function* () {
      try {
        yield this.api.updateOwnComment(e.id, e.content);
        yield this.load();
      } catch (e2) {
      }
    });
  }
  onDelete(d) {
    return __async(this, null, function* () {
      try {
        yield this.api.deleteOwnComment(d.id);
        yield this.load();
      } catch (e) {
      }
    });
  }
  findById(list, id) {
    for (const c of list) {
      if (c.id === id)
        return c;
      const sub = this.findById(c.replies ?? [], id);
      if (sub)
        return sub;
    }
    return null;
  }
  static {
    this.\u0275fac = function CommentSectionComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _CommentSectionComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _CommentSectionComponent, selectors: [["app-comment-section"]], inputs: { postId: "postId", lang: "lang", settings: "settings" }, features: [\u0275\u0275NgOnChangesFeature], decls: 1, vars: 1, consts: [["f", "ngForm"], ["id", "comments", 1, "comments"], [1, "head"], [1, "sort"], [3, "ngModelChange", "ngModel"], ["value", "newest"], ["value", "oldest"], [1, "login-prompt"], [1, "compose"], [1, "loading"], [1, "empty"], [1, "thread"], ["type", "button", 1, "btn", "primary", 3, "click"], [1, "compose", 3, "ngSubmit"], [1, "reply-banner"], ["required", "", "minlength", "1", "maxlength", "4000", "name", "content", "rows", "3", 3, "ngModelChange", "ngModel", "placeholder"], [1, "actions"], ["type", "submit", 1, "btn", "primary", 3, "disabled"], [1, "error"], ["type", "button", 1, "link", 3, "click"], [3, "comment", "lang", "maxDepth", "canReply"], [3, "reply", "edit", "del", "comment", "lang", "maxDepth", "canReply"]], template: function CommentSectionComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275conditionalCreate(0, CommentSectionComponent_Conditional_0_Template, 17, 9, "section", 1);
      }
      if (rf & 2) {
        \u0275\u0275conditional(ctx.settings.enabled ? 0 : -1);
      }
    }, dependencies: [CommonModule, FormsModule, \u0275NgNoValidate, NgSelectOption, \u0275NgSelectMultipleOption, DefaultValueAccessor, SelectControlValueAccessor, NgControlStatus, NgControlStatusGroup, RequiredValidator, MinLengthValidator, MaxLengthValidator, NgModel, NgForm, CommentItemComponent], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n}\n.comments[_ngcontent-%COMP%] {\n  max-width: 720px;\n  margin: 64px auto;\n}\n.head[_ngcontent-%COMP%] {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 16px;\n}\nh2[_ngcontent-%COMP%] {\n  margin: 0;\n  font-size: 22px;\n}\n.sort[_ngcontent-%COMP%] {\n  display: inline-flex;\n  gap: 8px;\n  align-items: center;\n  font-size: 13px;\n  opacity: .8;\n}\n.sort[_ngcontent-%COMP%]   select[_ngcontent-%COMP%] {\n  padding: 4px 8px;\n  border-radius: 6px;\n  border: 1px solid rgba(0, 0, 0, .12);\n  font: inherit;\n  color: inherit;\n  background: transparent;\n}\n.login-prompt[_ngcontent-%COMP%] {\n  padding: 20px;\n  border-radius: 10px;\n  background: rgba(99, 102, 241, .06);\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  margin-bottom: 24px;\n}\n.compose[_ngcontent-%COMP%] {\n  margin-bottom: 24px;\n}\n.compose[_ngcontent-%COMP%]   textarea[_ngcontent-%COMP%] {\n  width: 100%;\n  padding: 12px;\n  border-radius: 8px;\n  border: 1px solid rgba(0, 0, 0, .15);\n  font: inherit;\n  resize: vertical;\n}\n.actions[_ngcontent-%COMP%] {\n  margin-top: 10px;\n  display: flex;\n  justify-content: flex-end;\n}\n.btn[_ngcontent-%COMP%] {\n  padding: 8px 16px;\n  border: 1px solid rgba(0, 0, 0, .15);\n  border-radius: 6px;\n  background: transparent;\n  cursor: pointer;\n  font: inherit;\n}\n.btn.primary[_ngcontent-%COMP%] {\n  background: var(--primary, #6366f1);\n  color: #fff;\n  border-color: transparent;\n}\n.btn[_ngcontent-%COMP%]:disabled {\n  opacity: .5;\n  cursor: not-allowed;\n}\n.link[_ngcontent-%COMP%] {\n  background: none;\n  border: 0;\n  padding: 0;\n  cursor: pointer;\n  color: var(--primary, #6366f1);\n  font: inherit;\n}\n.reply-banner[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 10px;\n  align-items: center;\n  margin-bottom: 8px;\n  padding: 8px 12px;\n  background: rgba(0, 0, 0, .04);\n  border-radius: 6px;\n  font-size: 13px;\n}\n.empty[_ngcontent-%COMP%], \n.loading[_ngcontent-%COMP%] {\n  text-align: center;\n  color: rgba(0, 0, 0, .5);\n  padding: 24px 0;\n}\n.error[_ngcontent-%COMP%] {\n  color: #c33;\n  font-size: 13px;\n  margin-top: 8px;\n}\n/*# sourceMappingURL=comment-section.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(CommentSectionComponent, [{
    type: Component,
    args: [{ selector: "app-comment-section", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule, FormsModule, CommentItemComponent], template: `
    @if (settings.enabled) {
      <section class="comments" id="comments">
        <header class="head">
          <h2>{{ t(lang, 'comments_count', { n: formatNumber(lang, totalCount()) }) }}</h2>
          <label class="sort">
            <span>{{ t(lang, 'sort_by') }}:</span>
            <select [ngModel]="sort()" (ngModelChange)="sort.set($event)">
              <option value="newest">{{ t(lang, 'newest') }}</option>
              <option value="oldest">{{ t(lang, 'oldest') }}</option>
            </select>
          </label>
        </header>

        @if (settings.requireShopperLogin && !shopperAuth.current() && shopperAuth.loaded()) {
          <div class="login-prompt">
            <p>{{ t(lang, 'sign_in_to_comment') }}</p>
            <button type="button" class="btn primary" (click)="loginRequest.set(true)">
              {{ t(lang, 'sign_in') }}
            </button>
          </div>
        } @else {
          <form class="compose" (ngSubmit)="submit()" #f="ngForm">
            @if (replyTo()) {
              <div class="reply-banner">
                {{ t(lang, 'reply_to', { name: replyTo()!.author.name }) }}
                <button type="button" class="link" (click)="cancelReply()">{{ t(lang, 'cancel') }}</button>
              </div>
            }
            <textarea
              required
              minlength="1"
              maxlength="4000"
              [(ngModel)]="draft"
              name="content"
              rows="3"
              [placeholder]="t(lang, 'write_a_comment')"
              [attr.aria-label]="t(lang, 'write_a_comment')"></textarea>
            <div class="actions">
              <button type="submit" class="btn primary"
                      [disabled]="submitting() || !draft.trim() || f.invalid">
                {{ t(lang, 'post_comment') }}
              </button>
            </div>
            @if (submitError()) {
              <p class="error">{{ submitError() }}</p>
            }
          </form>
        }

        @if (loading()) {
          <p class="loading">\u2026</p>
        } @else if (comments().length === 0) {
          <p class="empty">{{ t(lang, 'no_comments') }}</p>
        } @else {
          <div class="thread">
            @for (c of sorted(); track c.id) {
              <app-comment-item
                [comment]="c"
                [lang]="lang"
                [maxDepth]="settings.maxDepth"
                [canReply]="settings.allowReplies && 0 < settings.maxDepth"
                (reply)="onReply($event)"
                (edit)="onEdit($event)"
                (del)="onDelete($event)">
              </app-comment-item>
            }
          </div>
        }
      </section>
    }
  `, styles: ["/* angular:styles/component:css;3f13ded1204a7a4237e0c13bcd86271180de1cea942ac736844d513a5e906c1a;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/components/comments/comment-section.component.ts */\n:host {\n  display: block;\n}\n.comments {\n  max-width: 720px;\n  margin: 64px auto;\n}\n.head {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 16px;\n}\nh2 {\n  margin: 0;\n  font-size: 22px;\n}\n.sort {\n  display: inline-flex;\n  gap: 8px;\n  align-items: center;\n  font-size: 13px;\n  opacity: .8;\n}\n.sort select {\n  padding: 4px 8px;\n  border-radius: 6px;\n  border: 1px solid rgba(0, 0, 0, .12);\n  font: inherit;\n  color: inherit;\n  background: transparent;\n}\n.login-prompt {\n  padding: 20px;\n  border-radius: 10px;\n  background: rgba(99, 102, 241, .06);\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  margin-bottom: 24px;\n}\n.compose {\n  margin-bottom: 24px;\n}\n.compose textarea {\n  width: 100%;\n  padding: 12px;\n  border-radius: 8px;\n  border: 1px solid rgba(0, 0, 0, .15);\n  font: inherit;\n  resize: vertical;\n}\n.actions {\n  margin-top: 10px;\n  display: flex;\n  justify-content: flex-end;\n}\n.btn {\n  padding: 8px 16px;\n  border: 1px solid rgba(0, 0, 0, .15);\n  border-radius: 6px;\n  background: transparent;\n  cursor: pointer;\n  font: inherit;\n}\n.btn.primary {\n  background: var(--primary, #6366f1);\n  color: #fff;\n  border-color: transparent;\n}\n.btn:disabled {\n  opacity: .5;\n  cursor: not-allowed;\n}\n.link {\n  background: none;\n  border: 0;\n  padding: 0;\n  cursor: pointer;\n  color: var(--primary, #6366f1);\n  font: inherit;\n}\n.reply-banner {\n  display: flex;\n  gap: 10px;\n  align-items: center;\n  margin-bottom: 8px;\n  padding: 8px 12px;\n  background: rgba(0, 0, 0, .04);\n  border-radius: 6px;\n  font-size: 13px;\n}\n.empty,\n.loading {\n  text-align: center;\n  color: rgba(0, 0, 0, .5);\n  padding: 24px 0;\n}\n.error {\n  color: #c33;\n  font-size: 13px;\n  margin-top: 8px;\n}\n/*# sourceMappingURL=comment-section.component.css.map */\n"] }]
  }], null, { postId: [{
    type: Input,
    args: [{ required: true }]
  }], lang: [{
    type: Input,
    args: [{ required: true }]
  }], settings: [{
    type: Input,
    args: [{ required: true }]
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(CommentSectionComponent, { className: "CommentSectionComponent", filePath: "src/app/features/blog/components/comments/comment-section.component.ts", lineNumber: 129 });
})();

// src/app/features/blog/pages/post.component.ts
var _c03 = (a0) => ["/", a0, "blog"];
var _c13 = (a0, a1) => ["/", a0, "blog", "category", a1];
var _c2 = (a0, a1) => ["/", a0, "blog", "authors", a1];
var _c3 = (a0, a1) => ["/", a0, "blog", "tag", a1];
var _forTrack04 = ($index, $item) => $item.id;
function PostPage_Conditional_0_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 2);
    \u0275\u0275text(1, "\u2026");
    \u0275\u0275elementEnd();
  }
}
function PostPage_Conditional_0_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 3)(1, "h1");
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "p");
    \u0275\u0275text(4);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(5, "a", 5);
    \u0275\u0275text(6);
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang(), "404_title"));
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang(), "404_body"));
    \u0275\u0275advance();
    \u0275\u0275property("routerLink", \u0275\u0275pureFunction1(4, _c03, ctx_r0.lang()));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.t(ctx_r0.lang(), "back_to_blog"));
  }
}
function PostPage_Conditional_0_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    const _r2 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "app-error-banner", 6);
    \u0275\u0275listener("retry", function PostPage_Conditional_0_Conditional_4_Template_app_error_banner_retry_0_listener() {
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
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-language-switcher", 9);
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext();
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275property("languages", p_r3.availableLanguages)("current", ctx_r0.lang())("urlFor", ctx_r0.urlForLang);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 10);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext();
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r0.fallbackNotice(p_r3), " ");
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "figure", 11);
    \u0275\u0275element(1, "img", 26);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275property("src", p_r3.coverImage, \u0275\u0275sanitizeUrl)("alt", "Cover image for " + p_r3.title);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "div", 12);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "a", 14);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const cat_r4 = ctx;
    const ctx_r0 = \u0275\u0275nextContext(4);
    \u0275\u0275property("routerLink", \u0275\u0275pureFunction2(2, _c13, ctx_r0.lang(), cat_r4.slug));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(cat_r4.name);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_11_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "img", 27);
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext(2);
    \u0275\u0275property("src", p_r3.author.image, \u0275\u0275sanitizeUrl);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_11_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "a", 28);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext(2);
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275property("routerLink", \u0275\u0275pureFunction2(2, _c2, ctx_r0.lang(), p_r3.author.id));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(p_r3.author.name);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_11_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span");
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(p_r3.author.name);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_11_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 29);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1("\xB7 ", p_r3.author.publicTitle);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_11_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 16);
    \u0275\u0275conditionalCreate(1, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_11_Conditional_1_Template, 1, 1, "img", 27);
    \u0275\u0275conditionalCreate(2, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_11_Conditional_2_Template, 2, 5, "a", 28)(3, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_11_Conditional_3_Template, 2, 1, "span");
    \u0275\u0275conditionalCreate(4, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_11_Conditional_4_Template, 2, 1, "span", 29);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275conditional(p_r3.author.image ? 1 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(p_r3.author.id ? 2 : 3);
    \u0275\u0275advance(2);
    \u0275\u0275conditional(p_r3.author.publicTitle ? 4 : -1);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_14_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 18);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext();
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate2("", p_r3.readingTime, " ", ctx_r0.t(ctx_r0.lang(), "min_read"));
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_17_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "a", 30);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const tagRef_r5 = ctx.$implicit;
    const ctx_r0 = \u0275\u0275nextContext(5);
    \u0275\u0275property("routerLink", \u0275\u0275pureFunction2(2, _c3, ctx_r0.lang(), tagRef_r5.slug));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(tagRef_r5.name);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_17_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 20);
    \u0275\u0275repeaterCreate(1, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_17_For_2_Template, 2, 5, "a", 30, _forTrack04);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275repeater(p_r3.tags);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_19_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 22);
    \u0275\u0275element(1, "app-share-buttons", 31);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext();
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275advance();
    \u0275\u0275property("url", ctx_r0.canonicalUrl())("title", p_r3.title)("lang", ctx_r0.lang());
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_21_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-related-posts", 24);
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext();
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275property("posts", p_r3.relatedPosts)("lang", ctx_r0.lang())("display", ctx_r0.display());
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 7);
    \u0275\u0275element(1, "app-breadcrumbs", 8);
    \u0275\u0275conditionalCreate(2, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_2_Template, 1, 3, "app-language-switcher", 9);
    \u0275\u0275elementEnd();
    \u0275\u0275conditionalCreate(3, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_3_Template, 2, 1, "div", 10);
    \u0275\u0275conditionalCreate(4, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_4_Template, 2, 2, "figure", 11)(5, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_5_Template, 1, 0, "div", 12);
    \u0275\u0275elementStart(6, "header", 13);
    \u0275\u0275conditionalCreate(7, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_7_Template, 2, 5, "a", 14);
    \u0275\u0275elementStart(8, "h1");
    \u0275\u0275text(9);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(10, "div", 15);
    \u0275\u0275conditionalCreate(11, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_11_Template, 5, 3, "span", 16);
    \u0275\u0275elementStart(12, "time", 17);
    \u0275\u0275text(13);
    \u0275\u0275elementEnd();
    \u0275\u0275conditionalCreate(14, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_14_Template, 2, 2, "span", 18);
    \u0275\u0275elementStart(15, "span", 19);
    \u0275\u0275text(16);
    \u0275\u0275elementEnd()();
    \u0275\u0275conditionalCreate(17, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_17_Template, 3, 0, "div", 20);
    \u0275\u0275elementEnd();
    \u0275\u0275element(18, "app-post-content", 21);
    \u0275\u0275conditionalCreate(19, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_19_Template, 2, 3, "div", 22);
    \u0275\u0275element(20, "app-author-card", 23);
    \u0275\u0275conditionalCreate(21, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_21_Template, 1, 3, "app-related-posts", 24);
    \u0275\u0275element(22, "app-comment-section", 25);
  }
  if (rf & 2) {
    let tmp_8_0;
    const p_r3 = ctx;
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275advance();
    \u0275\u0275property("crumbs", ctx_r0.crumbs());
    \u0275\u0275advance();
    \u0275\u0275conditional(p_r3.availableLanguages.length > 1 ? 2 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(p_r3.wasFallback ? 3 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(p_r3.coverImage ? 4 : 5);
    \u0275\u0275advance(3);
    \u0275\u0275conditional((tmp_8_0 = p_r3.mainCategory) ? 7 : -1, tmp_8_0);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(p_r3.title);
    \u0275\u0275advance(2);
    \u0275\u0275conditional(p_r3.author ? 11 : -1);
    \u0275\u0275advance();
    \u0275\u0275attribute("datetime", p_r3.publishDate);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.formatDate(ctx_r0.lang(), p_r3.publishDate));
    \u0275\u0275advance();
    \u0275\u0275conditional(p_r3.readingTime > 0 ? 14 : -1);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate1("\u{1F441} ", ctx_r0.formatNumber(ctx_r0.lang(), p_r3.views));
    \u0275\u0275advance();
    \u0275\u0275conditional(p_r3.tags.length ? 17 : -1);
    \u0275\u0275advance();
    \u0275\u0275property("html", p_r3.content)("lang", ctx_r0.lang());
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.display().showSocialShare ? 19 : -1);
    \u0275\u0275advance();
    \u0275\u0275property("author", p_r3.author)("lang", ctx_r0.lang());
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.display().showRelatedPosts ? 21 : -1);
    \u0275\u0275advance();
    \u0275\u0275property("postId", p_r3.id)("lang", ctx_r0.lang())("settings", ctx_r0.commentsSettings());
  }
}
function PostPage_Conditional_0_Conditional_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275conditionalCreate(0, PostPage_Conditional_0_Conditional_5_Conditional_0_Template, 23, 21);
  }
  if (rf & 2) {
    let tmp_2_0;
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275conditional((tmp_2_0 = ctx_r0.post()) ? 0 : -1, tmp_2_0);
  }
}
function PostPage_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-blog-header", 0);
    \u0275\u0275elementStart(1, "div", 1);
    \u0275\u0275conditionalCreate(2, PostPage_Conditional_0_Conditional_2_Template, 2, 0, "p", 2)(3, PostPage_Conditional_0_Conditional_3_Template, 7, 6, "div", 3)(4, PostPage_Conditional_0_Conditional_4_Template, 1, 2, "app-error-banner", 4)(5, PostPage_Conditional_0_Conditional_5_Template, 1, 1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275property("lang", ctx_r0.lang())("siteName", ctx_r0.siteName())("languages", ctx_r0.supportedLangs());
    \u0275\u0275advance(2);
    \u0275\u0275conditional(ctx_r0.loading() ? 2 : ctx_r0.notFound() ? 3 : ctx_r0.error() ? 4 : 5);
  }
}
var PostPage = class _PostPage {
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
    this.post = signal(null, ...ngDevMode ? [{ debugName: "post" }] : (
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
    this.commentsSettings = computed(() => this.settingsSvc.settings().comments, ...ngDevMode ? [{ debugName: "commentsSettings" }] : (
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
    this.formatDate = formatDate;
    this.formatNumber = formatNumber;
    this.urlForLang = (lang) => {
      const alts = this.post()?.seo?.hreflangAlternates;
      const found = alts?.find((a) => a.lang === lang);
      if (found) {
        try {
          return new URL(found.url).pathname;
        } catch (e) {
          return found.url;
        }
      }
      return `/${lang}/blog`;
    };
    this.crumbs = computed(() => {
      const p = this.post();
      const lang = this.lang();
      const main = p?.mainCategory;
      const list = [
        { label: this.t(lang, "home"), link: ["/", lang] },
        { label: this.t(lang, "blog"), link: ["/", lang, "blog"] }
      ];
      if (main)
        list.push({ label: main.name, link: ["/", lang, "blog", "category", main.slug] });
      if (p)
        list.push({ label: p.title, link: null });
      return list;
    }, ...ngDevMode ? [{ debugName: "crumbs" }] : (
      /* istanbul ignore next */
      []
    ));
  }
  canonicalUrl() {
    const origin = environment.siteOrigin || "";
    const p = this.post();
    return p?.seo?.canonical || `${origin}/${this.lang()}/blog/${this.slug()}`;
  }
  fallbackNotice(p) {
    const shown = nativeLanguageName(p.contentLanguage);
    return t(this.lang(), "fallback_notice", { lang: shown });
  }
  ngOnInit() {
    return __async(this, null, function* () {
      this.route.paramMap.subscribe((p) => {
        this.lang.set(p.get("lang") ?? "en");
        this.slug.set(p.get("slug") ?? "");
        this.bootstrap();
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
        const p = yield this.api.getPublicPost(this.slug(), this.lang());
        if (!p) {
          this.notFound.set(true);
          return;
        }
        this.post.set(p);
        const fullUrl = this.canonicalUrl();
        const rss = this.api.rssUrl(this.lang());
        this.seo.applyForPost(p, this.lang(), fullUrl, rss);
      } catch (e) {
        if (e?.status === 404)
          this.notFound.set(true);
        else
          this.error.set(e?.message ?? "Failed to load post");
      } finally {
        this.loading.set(false);
      }
    });
  }
  static {
    this.\u0275fac = function PostPage_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _PostPage)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _PostPage, selectors: [["ng-component"]], decls: 1, vars: 1, consts: [[3, "lang", "siteName", "languages"], [1, "container"], [1, "loading"], [1, "not-found"], [3, "lang", "showRetry"], [1, "btn", 3, "routerLink"], [3, "retry", "lang", "showRetry"], [1, "post-top"], [3, "crumbs"], [3, "languages", "current", "urlFor"], ["role", "status", 1, "fallback-notice"], [1, "cover"], [1, "cover-fallback"], [1, "head"], [1, "cat", 3, "routerLink"], [1, "meta"], [1, "author"], [1, "date"], [1, "reading"], ["aria-hidden", "true", 1, "views"], [1, "tags"], [3, "html", "lang"], [1, "share-row"], [3, "author", "lang"], [3, "posts", "lang", "display"], [3, "postId", "lang", "settings"], ["fetchpriority", "high", "loading", "eager", 3, "src", "alt"], ["alt", "", 1, "avatar", 3, "src"], [3, "routerLink"], [1, "title"], [1, "chip", 3, "routerLink"], [3, "url", "title", "lang"]], template: function PostPage_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275conditionalCreate(0, PostPage_Conditional_0_Template, 6, 4);
      }
      if (rf & 2) {
        \u0275\u0275conditional(ctx.settingsLoaded() ? 0 : -1);
      }
    }, dependencies: [
      CommonModule,
      RouterLink,
      BlogHeaderComponent,
      BreadcrumbsComponent,
      LanguageSwitcherComponent,
      PostContentComponent,
      RelatedPostsComponent,
      AuthorCardComponent,
      ShareButtonsComponent,
      CommentSectionComponent,
      ErrorBannerComponent
    ], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #111);\n}\n.container[_ngcontent-%COMP%] {\n  max-width: 1100px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.loading[_ngcontent-%COMP%] {\n  text-align: center;\n  padding: 80px 0;\n  opacity: .6;\n}\n.not-found[_ngcontent-%COMP%] {\n  text-align: center;\n  padding: 80px 24px;\n}\n.not-found[_ngcontent-%COMP%]   h1[_ngcontent-%COMP%] {\n  margin: 0 0 8px;\n  font-size: 28px;\n}\n.not-found[_ngcontent-%COMP%]   .btn[_ngcontent-%COMP%] {\n  display: inline-block;\n  margin-top: 16px;\n  padding: 10px 20px;\n  border-radius: 8px;\n  background: var(--primary, #6366f1);\n  color: #fff;\n  text-decoration: none;\n}\n.post-top[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 16px;\n  align-items: center;\n  flex-wrap: wrap;\n  justify-content: space-between;\n  padding: 16px 0;\n}\n.cover[_ngcontent-%COMP%] {\n  margin: 0 0 32px;\n}\n.cover[_ngcontent-%COMP%]   img[_ngcontent-%COMP%] {\n  width: 100%;\n  max-height: 60vh;\n  object-fit: cover;\n  border-radius: 12px;\n  display: block;\n}\n.cover-fallback[_ngcontent-%COMP%] {\n  height: 220px;\n  border-radius: 12px;\n  background:\n    linear-gradient(\n      135deg,\n      var(--primary, #6366f1),\n      #8b5cf6);\n  margin-bottom: 32px;\n}\n.head[_ngcontent-%COMP%] {\n  max-width: 820px;\n  margin: 0 auto 32px;\n}\n.cat[_ngcontent-%COMP%] {\n  display: inline-block;\n  font-size: 13px;\n  font-weight: 600;\n  text-transform: uppercase;\n  letter-spacing: .04em;\n  color: var(--primary, #6366f1);\n  text-decoration: none;\n  margin-bottom: 12px;\n}\nh1[_ngcontent-%COMP%] {\n  margin: 0 0 16px;\n  font-size: 40px;\n  line-height: 1.2;\n}\n.meta[_ngcontent-%COMP%] {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 16px;\n  font-size: 14px;\n  color: rgba(0, 0, 0, .65);\n  align-items: center;\n}\n.author[_ngcontent-%COMP%] {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n}\n.author[_ngcontent-%COMP%]   a[_ngcontent-%COMP%] {\n  color: inherit;\n  text-decoration: none;\n}\n.author[_ngcontent-%COMP%]   a[_ngcontent-%COMP%]:hover {\n  text-decoration: underline;\n}\n.author[_ngcontent-%COMP%]   .title[_ngcontent-%COMP%] {\n  opacity: .7;\n}\n.avatar[_ngcontent-%COMP%] {\n  width: 28px;\n  height: 28px;\n  border-radius: 50%;\n  object-fit: cover;\n}\n.tags[_ngcontent-%COMP%] {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  margin-top: 12px;\n}\n.chip[_ngcontent-%COMP%] {\n  font-size: 12px;\n  padding: 4px 10px;\n  border-radius: 100px;\n  background: rgba(0, 0, 0, .05);\n  color: inherit;\n  text-decoration: none;\n}\n.share-row[_ngcontent-%COMP%] {\n  max-width: 720px;\n  margin: 32px auto;\n  padding: 20px 0;\n  border-block: 1px solid rgba(0, 0, 0, .08);\n}\n.fallback-notice[_ngcontent-%COMP%] {\n  max-width: 820px;\n  margin: 0 auto 24px;\n  padding: 10px 16px;\n  background: rgba(255, 200, 0, .12);\n  border-inline-start: 4px solid #f5a623;\n  border-radius: 6px;\n  font-size: 14px;\n  color: #6b4f00;\n}\n@media (max-width: 768px) {\n  h1[_ngcontent-%COMP%] {\n    font-size: 28px;\n  }\n}\n/*# sourceMappingURL=post.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PostPage, [{
    type: Component,
    args: [{ standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [
      CommonModule,
      RouterLink,
      BlogHeaderComponent,
      BreadcrumbsComponent,
      LanguageSwitcherComponent,
      PostContentComponent,
      RelatedPostsComponent,
      AuthorCardComponent,
      ShareButtonsComponent,
      CommentSectionComponent,
      ErrorBannerComponent
    ], template: `
    @if (settingsLoaded()) {
      <app-blog-header
        [lang]="lang()"
        [siteName]="siteName()"
        [languages]="supportedLangs()">
      </app-blog-header>

      <div class="container">
        @if (loading()) {
          <p class="loading">\u2026</p>
        } @else if (notFound()) {
          <div class="not-found">
            <h1>{{ t(lang(), '404_title') }}</h1>
            <p>{{ t(lang(), '404_body') }}</p>
            <a class="btn" [routerLink]="['/', lang(), 'blog']">{{ t(lang(), 'back_to_blog') }}</a>
          </div>
        } @else if (error()) {
          <app-error-banner [lang]="lang()" [showRetry]="true" (retry)="load()"></app-error-banner>
        } @else {
          @if (post(); as p) {
          <div class="post-top">
            <app-breadcrumbs [crumbs]="crumbs()"></app-breadcrumbs>
            @if (p.availableLanguages.length > 1) {
              <app-language-switcher
                [languages]="p.availableLanguages"
                [current]="lang()"
                [urlFor]="urlForLang">
              </app-language-switcher>
            }
          </div>

          @if (p.wasFallback) {
            <div class="fallback-notice" role="status">
              {{ fallbackNotice(p) }}
            </div>
          }

          @if (p.coverImage) {
            <figure class="cover">
              <img [src]="p.coverImage"
                   [alt]="'Cover image for ' + p.title"
                   fetchpriority="high"
                   loading="eager">
            </figure>
          } @else {
            <div class="cover-fallback"></div>
          }

          <header class="head">
            @if (p.mainCategory; as cat) {
              <a class="cat" [routerLink]="['/', lang(), 'blog', 'category', cat.slug]">{{ cat.name }}</a>
            }
            <h1>{{ p.title }}</h1>
            <div class="meta">
              @if (p.author) {
                <span class="author">
                  @if (p.author.image) { <img [src]="p.author.image" alt="" class="avatar"> }
                  @if (p.author.id) {
                    <a [routerLink]="['/', lang(), 'blog', 'authors', p.author.id]">{{ p.author.name }}</a>
                  } @else { <span>{{ p.author.name }}</span> }
                  @if (p.author.publicTitle) { <span class="title">\xB7 {{ p.author.publicTitle }}</span> }
                </span>
              }
              <time class="date" [attr.datetime]="p.publishDate">{{ formatDate(lang(), p.publishDate) }}</time>
              @if (p.readingTime > 0) {
                <span class="reading">{{ p.readingTime }} {{ t(lang(), 'min_read') }}</span>
              }
              <span class="views" aria-hidden="true">\u{1F441} {{ formatNumber(lang(), p.views) }}</span>
            </div>
            @if (p.tags.length) {
              <div class="tags">
                @for (tagRef of p.tags; track tagRef.id) {
                  <a class="chip" [routerLink]="['/', lang(), 'blog', 'tag', tagRef.slug]">{{ tagRef.name }}</a>
                }
              </div>
            }
          </header>

          <app-post-content [html]="p.content" [lang]="lang()"></app-post-content>

          @if (display().showSocialShare) {
            <div class="share-row">
              <app-share-buttons
                [url]="canonicalUrl()"
                [title]="p.title"
                [lang]="lang()">
              </app-share-buttons>
            </div>
          }

          <app-author-card [author]="p.author" [lang]="lang()"></app-author-card>

          @if (display().showRelatedPosts) {
            <app-related-posts
              [posts]="p.relatedPosts"
              [lang]="lang()"
              [display]="display()">
            </app-related-posts>
          }

          <app-comment-section
            [postId]="p.id"
            [lang]="lang()"
            [settings]="commentsSettings()">
          </app-comment-section>
          }
        }
      </div>
    }
  `, styles: ["/* angular:styles/component:css;019b06f56e7664a1ad7c3d96a6f6e28f68e1b92f8b33b243a31d92a3294725e1;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/pages/post.component.ts */\n:host {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #111);\n}\n.container {\n  max-width: 1100px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.loading {\n  text-align: center;\n  padding: 80px 0;\n  opacity: .6;\n}\n.not-found {\n  text-align: center;\n  padding: 80px 24px;\n}\n.not-found h1 {\n  margin: 0 0 8px;\n  font-size: 28px;\n}\n.not-found .btn {\n  display: inline-block;\n  margin-top: 16px;\n  padding: 10px 20px;\n  border-radius: 8px;\n  background: var(--primary, #6366f1);\n  color: #fff;\n  text-decoration: none;\n}\n.post-top {\n  display: flex;\n  gap: 16px;\n  align-items: center;\n  flex-wrap: wrap;\n  justify-content: space-between;\n  padding: 16px 0;\n}\n.cover {\n  margin: 0 0 32px;\n}\n.cover img {\n  width: 100%;\n  max-height: 60vh;\n  object-fit: cover;\n  border-radius: 12px;\n  display: block;\n}\n.cover-fallback {\n  height: 220px;\n  border-radius: 12px;\n  background:\n    linear-gradient(\n      135deg,\n      var(--primary, #6366f1),\n      #8b5cf6);\n  margin-bottom: 32px;\n}\n.head {\n  max-width: 820px;\n  margin: 0 auto 32px;\n}\n.cat {\n  display: inline-block;\n  font-size: 13px;\n  font-weight: 600;\n  text-transform: uppercase;\n  letter-spacing: .04em;\n  color: var(--primary, #6366f1);\n  text-decoration: none;\n  margin-bottom: 12px;\n}\nh1 {\n  margin: 0 0 16px;\n  font-size: 40px;\n  line-height: 1.2;\n}\n.meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 16px;\n  font-size: 14px;\n  color: rgba(0, 0, 0, .65);\n  align-items: center;\n}\n.author {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n}\n.author a {\n  color: inherit;\n  text-decoration: none;\n}\n.author a:hover {\n  text-decoration: underline;\n}\n.author .title {\n  opacity: .7;\n}\n.avatar {\n  width: 28px;\n  height: 28px;\n  border-radius: 50%;\n  object-fit: cover;\n}\n.tags {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  margin-top: 12px;\n}\n.chip {\n  font-size: 12px;\n  padding: 4px 10px;\n  border-radius: 100px;\n  background: rgba(0, 0, 0, .05);\n  color: inherit;\n  text-decoration: none;\n}\n.share-row {\n  max-width: 720px;\n  margin: 32px auto;\n  padding: 20px 0;\n  border-block: 1px solid rgba(0, 0, 0, .08);\n}\n.fallback-notice {\n  max-width: 820px;\n  margin: 0 auto 24px;\n  padding: 10px 16px;\n  background: rgba(255, 200, 0, .12);\n  border-inline-start: 4px solid #f5a623;\n  border-radius: 6px;\n  font-size: 14px;\n  color: #6b4f00;\n}\n@media (max-width: 768px) {\n  h1 {\n    font-size: 28px;\n  }\n}\n/*# sourceMappingURL=post.component.css.map */\n"] }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(PostPage, { className: "PostPage", filePath: "src/app/features/blog/pages/post.component.ts", lineNumber: 222 });
})();
export {
  PostPage
};
//# sourceMappingURL=post.component-VYDWZZVQ.js.map
