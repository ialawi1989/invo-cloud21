import './polyfills.server.mjs';
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
} from "./chunk-QJ35PM2B.mjs";
import {
  formatDate,
  formatNumber,
  nativeLanguageName,
  t
} from "./chunk-ZMGIQB7V.mjs";
import {
  ActivatedRoute,
  BlogSettingsService,
  ChangeDetectionStrategy,
  CommonModule,
  Component,
  DOCUMENT,
  DomSanitizer,
  ElementRef,
  EventEmitter,
  HostListener,
  Injectable,
  Input,
  Output,
  PLATFORM_ID,
  PublicBlogApiService,
  Router,
  RouterLink,
  combineLatest,
  computed,
  distinctUntilChanged,
  environment,
  inject,
  isPlatformBrowser,
  map,
  setClassMetadata,
  signal,
  ɵsetClassDebugInfo,
  ɵɵNgOnChangesFeature,
  ɵɵadvance,
  ɵɵattribute,
  ɵɵclassProp,
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
  ɵɵnamespaceHTML,
  ɵɵnamespaceSVG,
  ɵɵnextContext,
  ɵɵproperty,
  ɵɵpureFunction1,
  ɵɵreference,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵrepeaterTrackByIndex,
  ɵɵresetView,
  ɵɵresolveDocument,
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
} from "./chunk-OMUS4H4A.mjs";
import {
  __async,
  __spreadProps,
  __spreadValues
} from "./chunk-TXMZZVXC.mjs";

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
function linkifyHashtags(html, hrefFor) {
  if (!html)
    return html;
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(`<root>${html}</root>`, "text/html");
    const root = doc.body.firstElementChild;
    walk(root, hrefFor);
    return root.innerHTML;
  }
  let out = "";
  let inTag = false;
  let buf = "";
  const flush = () => {
    if (!inTag && buf) {
      out += buf.replace(HASHTAG_RE, (_m, tag) => anchorFor(hrefFor, tag));
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
function walk(node, hrefFor) {
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
        a.setAttribute("href", hrefFor(m[1]));
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
      walk(child, hrefFor);
    }
  }
}
function anchorFor(hrefFor, tag) {
  const safe = tag.replace(/"/g, "&quot;");
  return `<a class="blog-hashtag" href="${hrefFor(tag)}">#${safe}</a>`;
}

// src/app/features/blog/utils/neutralize-editable.ts
function neutralizeEditable(html) {
  if (!html)
    return html;
  return html.replace(/\scontenteditable(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gi, ' contenteditable="false"').replace(/<(input|textarea)\b/gi, "<$1 readonly disabled").replace(/<select\b/gi, "<select disabled").replace(/\sdraggable\s*=\s*("true"|'true'|true)/gi, "");
}

// src/app/features/blog/utils/normalize-gallery.ts
function normalizeGalleryHtml(html) {
  if (!html || html.indexOf("re-gallery-item") < 0)
    return html;
  return html.replace(/(<div\b[^>]*\bclass="[^"]*\bre-gallery-item\b[^"]*"[^>]*?)\s+style="[^"]*"/gi, "$1");
}

// src/app/features/blog/utils/normalize-links.ts
function normalizeLinkHrefs(html) {
  if (!html || html.indexOf("href") < 0)
    return html;
  return html.replace(/(<a\b[^>]*\bhref=")([^"]*)(")/gi, (_m, pre, url, post) => pre + fixUrl(url) + post);
}
function fixUrl(url) {
  const u = (url || "").trim();
  if (!u)
    return url;
  if (/^(https?:\/\/|\/\/|mailto:|tel:|\/|#|\?)/i.test(u))
    return url;
  return "https://" + u;
}

// src/app/features/blog/components/post-content.component.ts
var _c0 = (a0) => [a0];
var _forTrack0 = ($index, $item) => $item.src;
function PostContentComponent_Conditional_1_Conditional_12_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275domElementStart(0, "button", 16);
    \u0275\u0275domListener("click", function PostContentComponent_Conditional_1_Conditional_12_Template_button_click_0_listener($event) {
      \u0275\u0275restoreView(_r3);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.step($event, -1));
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275domElementStart(1, "svg", 17);
    \u0275\u0275domElement(2, "path", 18);
    \u0275\u0275domElementEnd()();
    \u0275\u0275namespaceHTML();
    \u0275\u0275domElementStart(3, "button", 19);
    \u0275\u0275domListener("click", function PostContentComponent_Conditional_1_Conditional_12_Template_button_click_3_listener($event) {
      \u0275\u0275restoreView(_r3);
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.step($event, 1));
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275domElementStart(4, "svg", 20);
    \u0275\u0275domElement(5, "path", 18);
    \u0275\u0275domElementEnd()();
  }
}
function PostContentComponent_Conditional_1_For_15_Template(rf, ctx) {
  if (rf & 1) {
    const _r4 = \u0275\u0275getCurrentView();
    \u0275\u0275domElementStart(0, "img", 21);
    \u0275\u0275domListener("contextmenu", function PostContentComponent_Conditional_1_For_15_Template_img_contextmenu_0_listener($event) {
      const it_r5 = \u0275\u0275restoreView(_r4).$implicit;
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.onImgMenu($event, it_r5.download));
    });
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const it_r5 = ctx.$implicit;
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275classProp("lb__img--next", ctx_r1.slideDir() >= 0)("lb__img--prev", ctx_r1.slideDir() < 0);
    \u0275\u0275domProperty("src", it_r5.src, \u0275\u0275sanitizeUrl)("alt", it_r5.alt);
  }
}
function PostContentComponent_Conditional_1_Conditional_16_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "span", 22);
    \u0275\u0275text(1);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const box_r6 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate2("", box_r6.index + 1, " / ", box_r6.items.length);
  }
}
function PostContentComponent_Conditional_1_Conditional_16_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "a", 24);
    \u0275\u0275domListener("click", function PostContentComponent_Conditional_1_Conditional_16_Conditional_2_Template_a_click_0_listener($event) {
      return $event.stopPropagation();
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275domElementStart(1, "svg", 25);
    \u0275\u0275domElement(2, "path", 26);
    \u0275\u0275domElementEnd();
    \u0275\u0275text(3, " Download ");
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const box_r6 = \u0275\u0275nextContext(2);
    \u0275\u0275domProperty("href", box_r6.items[box_r6.index].src, \u0275\u0275sanitizeUrl);
  }
}
function PostContentComponent_Conditional_1_Conditional_16_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "div", 15);
    \u0275\u0275conditionalCreate(1, PostContentComponent_Conditional_1_Conditional_16_Conditional_1_Template, 2, 2, "span", 22);
    \u0275\u0275conditionalCreate(2, PostContentComponent_Conditional_1_Conditional_16_Conditional_2_Template, 4, 1, "a", 23);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const box_r6 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275conditional(box_r6.items.length > 1 ? 1 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(box_r6.items[box_r6.index].download ? 2 : -1);
  }
}
function PostContentComponent_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275domElementStart(0, "div", 2);
    \u0275\u0275domListener("click", function PostContentComponent_Conditional_1_Template_div_click_0_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.closeLb());
    });
    \u0275\u0275domElementStart(1, "button", 3);
    \u0275\u0275domListener("click", function PostContentComponent_Conditional_1_Template_button_click_1_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.toggleFs($event));
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275domElementStart(2, "svg", 4)(3, "g", 5)(4, "g", 6);
    \u0275\u0275domElement(5, "path", 7)(6, "path", 8)(7, "path", 9)(8, "path", 10);
    \u0275\u0275domElementEnd()()()();
    \u0275\u0275namespaceHTML();
    \u0275\u0275domElementStart(9, "button", 11);
    \u0275\u0275domListener("click", function PostContentComponent_Conditional_1_Template_button_click_9_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.closeLb());
    });
    \u0275\u0275namespaceSVG();
    \u0275\u0275domElementStart(10, "svg", 4);
    \u0275\u0275domElement(11, "path", 12);
    \u0275\u0275domElementEnd()();
    \u0275\u0275conditionalCreate(12, PostContentComponent_Conditional_1_Conditional_12_Template, 6, 0);
    \u0275\u0275namespaceHTML();
    \u0275\u0275domElementStart(13, "figure", 13);
    \u0275\u0275domListener("click", function PostContentComponent_Conditional_1_Template_figure_click_13_listener($event) {
      return $event.stopPropagation();
    });
    \u0275\u0275repeaterCreate(14, PostContentComponent_Conditional_1_For_15_Template, 1, 6, "img", 14, _forTrack0);
    \u0275\u0275domElementEnd();
    \u0275\u0275conditionalCreate(16, PostContentComponent_Conditional_1_Conditional_16_Template, 3, 2, "div", 15);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const box_r6 = ctx;
    \u0275\u0275advance(12);
    \u0275\u0275conditional(box_r6.items.length > 1 ? 12 : -1);
    \u0275\u0275advance(2);
    \u0275\u0275repeater(\u0275\u0275pureFunction1(2, _c0, box_r6.items[box_r6.index]));
    \u0275\u0275advance(2);
    \u0275\u0275conditional(box_r6.items.length > 1 || box_r6.items[box_r6.index].download ? 16 : -1);
  }
}
var PostContentComponent = class _PostContentComponent {
  constructor() {
    this.html = "";
    this.lang = "en";
    this.sanitizer = inject(DomSanitizer);
    this.platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.doc = inject(DOCUMENT);
    this.settings = inject(BlogSettingsService);
    this.host = inject(ElementRef);
    this.enhancedFor = null;
    this.observers = [];
    this.timers = [];
    this.safe = "";
    this.lb = signal(null, ...ngDevMode ? [{ debugName: "lb" }] : (
      /* istanbul ignore next */
      []
    ));
    this.slideDir = signal(1, ...ngDevMode ? [{ debugName: "slideDir" }] : (
      /* istanbul ignore next */
      []
    ));
  }
  ngOnChanges(_) {
    const linked = linkifyHashtags(this.html, (tag) => this.settings.blogLink(this.lang, "tag", encodeURIComponent(tag)).join("/").replace("//", "/"));
    this.safe = this.sanitizer.bypassSecurityTrustHtml(normalizeLinkHrefs(normalizeGalleryHtml(neutralizeEditable(linked))));
  }
  ngAfterViewChecked() {
    if (!this.isBrowser || this.enhancedFor === this.html)
      return;
    this.enhancedFor = this.html;
    this.enhanceGalleries();
  }
  /** Enhance the rendered galleries: JS justified-rows layout for masonry
   *  (Wix-style) and prev/next arrows on scroll-based layouts. Operates on
   *  the innerHTML DOM directly. */
  enhanceGalleries() {
    this.observers.forEach((o) => o.disconnect());
    this.observers = [];
    this.timers.forEach((t2) => clearInterval(t2));
    this.timers = [];
    const root = this.host.nativeElement;
    const justifiedSel = '.re-gallery--masonry:not([data-orientation="vertical"]), .re-gallery--collage[data-orientation="horizontal"]:not([data-scroll-dir="horizontal"])';
    root.querySelectorAll(justifiedSel).forEach((g) => {
      this.layoutMasonry(g);
      let lastW = g.clientWidth;
      const ro = new ResizeObserver(() => {
        const w = g.clientWidth;
        if (w === lastW)
          return;
        lastW = w;
        this.layoutMasonry(g);
      });
      ro.observe(g);
      this.observers.push(ro);
    });
    const scrollSel = '.re-gallery--carousel, .re-gallery--slider, .re-gallery--columns, .re-gallery--collage[data-scroll-dir="horizontal"]';
    root.querySelectorAll(scrollSel).forEach((g) => {
      if (g.dataset["swiper"] === "1")
        return;
      const tryBuild = () => this.buildSwiper(g);
      tryBuild();
      if (g.dataset["swiper"] !== "1") {
        g.querySelectorAll("img").forEach((im) => {
          if (!im.complete)
            im.addEventListener("load", tryBuild, { once: true });
        });
        requestAnimationFrame(tryBuild);
        setTimeout(tryBuild, 250);
      }
    });
    root.querySelectorAll(".re-gallery--thumbnails, .re-gallery--slideshow").forEach((g) => this.buildThumbnails(g));
  }
  /** Wix-style justified masonry: pack images into rows at the target row
   *  height, then scale each row to fill the container width exactly.
   *  Heights vary by the images' aspect ratios. Re-runs on resize/load. */
  /**
   * Swiper-style transform slider for a horizontal gallery.
   *
   * Measures the tile sizes the per-layout CSS already produced, freezes
   * them as explicit px, then drives a translated `.re-gal-track`. Because
   * the tiles carry hard pixel sizes (not the `height:100%`/`width:auto`
   * chain that collapses once wrapped), the layout can't break. Bail-safe:
   * if the tiles aren't laid out yet (0 size / images loading) it makes NO
   * DOM change and returns — the caller retries on image load + rAF, so a
   * not-ready gallery just stays in its native CSS layout meanwhile.
   */
  buildSwiper(g) {
    if (g.dataset["swiper"] === "1" || !g.parentElement)
      return;
    const items = Array.from(g.children).filter((c) => c.classList?.contains("re-gallery-item"));
    if (!items.length)
      return;
    const imgEls = items.map((it) => it.querySelector("img"));
    const isColumns = g.classList.contains("re-gallery--columns");
    if (!isColumns && imgEls.some((im) => !im || !im.complete || !im.naturalWidth))
      return;
    const tileH = Math.round(g.getBoundingClientRect().height);
    if (tileH < 8)
      return;
    const colW = Math.round(parseFloat(getComputedStyle(g).getPropertyValue("--re-gal-col-w")) || 200);
    const widths = imgEls.map((im) => isColumns ? colW : Math.round((im?.naturalWidth || 1) / (im?.naturalHeight || 1) * tileH));
    if (widths.some((w) => w < 4))
      return;
    g.dataset["swiper"] = "1";
    const wrap = this.doc.createElement("div");
    wrap.className = "re-gal-wrap";
    g.parentElement.insertBefore(wrap, g);
    wrap.appendChild(g);
    const track = this.doc.createElement("div");
    track.className = "re-gal-track";
    items.forEach((it, i) => {
      it.style.setProperty("flex", "0 0 auto", "important");
      it.style.setProperty("width", `${widths[i]}px`, "important");
      it.style.setProperty("height", `${tileH}px`, "important");
      track.appendChild(it);
    });
    g.appendChild(track);
    g.classList.add("re-gal-swiper");
    g.style.height = `${tileH}px`;
    g.querySelectorAll("img").forEach((im) => im.setAttribute("draggable", "false"));
    const trackLeft = track.getBoundingClientRect().left;
    const starts = items.map((it) => Math.round(it.getBoundingClientRect().left - trackLeft));
    const trackW = Math.round(track.scrollWidth);
    let offset = 0;
    let maxOffset = Math.min(0, g.clientWidth - trackW);
    const clamp = (x) => Math.max(maxOffset, Math.min(0, x));
    const draw = (animate) => {
      track.style.transition = animate ? "transform .42s cubic-bezier(.22, .61, .36, 1)" : "none";
      track.style.transform = `translate3d(${Math.round(offset)}px, 0, 0)`;
    };
    const targets = () => starts.map((s) => clamp(-s));
    const arrow = (flip) => `<svg width="22" height="36" viewBox="0 0 23 39"${flip ? ' style="transform:scaleX(-1)"' : ""}><path fill="#2F2E2E" d="M857.005,231.479L858.5,230l18.124,18-18.127,18-1.49-1.48L873.638,248Z" transform="translate(-855 -230)"/></svg>`;
    const prev = this.doc.createElement("button");
    const next = this.doc.createElement("button");
    const syncArrows = () => {
      const noScroll = maxOffset >= -1;
      prev.classList.toggle("re-gal-arrow--off", noScroll || offset >= -1);
      next.classList.toggle("re-gal-arrow--off", noScroll || offset <= maxOffset + 1);
    };
    const step = (dir) => {
      const t2 = targets();
      let target;
      if (dir > 0) {
        const c = t2.filter((o) => o < offset - 1);
        target = c.length ? Math.max(...c) : maxOffset;
      } else {
        const c = t2.filter((o) => o > offset + 1);
        target = c.length ? Math.min(...c) : 0;
      }
      offset = clamp(target);
      draw(true);
      syncArrows();
    };
    const snap = () => {
      const t2 = targets();
      let best = t2.length ? t2[0] : 0;
      for (const o of t2)
        if (Math.abs(o - offset) < Math.abs(best - offset))
          best = o;
      offset = clamp(best);
      draw(true);
      syncArrows();
    };
    [[prev, -1], [next, 1]].forEach(([btn, d]) => {
      btn.type = "button";
      btn.className = `re-gal-arrow re-gal-arrow--${d < 0 ? "prev" : "next"}`;
      btn.style.top = `${Math.round(tileH / 2)}px`;
      btn.setAttribute("aria-label", d < 0 ? "Previous" : "Next");
      btn.innerHTML = arrow(d < 0);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        step(d);
      });
      wrap.appendChild(btn);
    });
    let down = false, moved = false, startX = 0, startOff = 0, lastX = 0, vel = 0;
    g.addEventListener("pointerdown", (e) => {
      if (e.button !== 0)
        return;
      down = true;
      moved = false;
      startX = lastX = e.clientX;
      startOff = offset;
      vel = 0;
      track.style.transition = "none";
    });
    g.addEventListener("pointermove", (e) => {
      if (!down)
        return;
      const dx = e.clientX - startX;
      if (!moved) {
        if (Math.abs(dx) <= 4)
          return;
        moved = true;
        g.classList.add("re-gal-dragging");
        try {
          g.setPointerCapture(e.pointerId);
        } catch (e2) {
        }
      }
      vel = e.clientX - lastX;
      lastX = e.clientX;
      let x = startOff + dx;
      if (x > 0)
        x *= 0.35;
      else if (x < maxOffset)
        x = maxOffset + (x - maxOffset) * 0.35;
      offset = x;
      draw(false);
    });
    const end = (e) => {
      if (!down)
        return;
      down = false;
      if (e) {
        try {
          g.releasePointerCapture(e.pointerId);
        } catch (e2) {
        }
      }
      g.classList.remove("re-gal-dragging");
      offset = clamp(offset + vel * 6);
      snap();
    };
    g.addEventListener("pointerup", end);
    g.addEventListener("pointercancel", end);
    g.addEventListener("click", (e) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    }, true);
    const ro = new ResizeObserver(() => {
      maxOffset = Math.min(0, g.clientWidth - trackW);
      offset = clamp(offset);
      draw(false);
      syncArrows();
    });
    ro.observe(g);
    this.observers.push(ro);
    draw(false);
    syncArrows();
  }
  /**
   * Interactive Thumbnails layout: promote the active image to a large
   * stage and show the rest as a clickable thumbnail strip — click a thumb
   * (or the arrows) to swap the stage. Placement (bottom/top/left/right) is
   * CSS-driven via data-thumb-placement; this owns the active state + arrow
   * positioning. Only the stage image opens the lightbox; thumb clicks just
   * switch the active image.
   */
  buildThumbnails(g) {
    if (g.dataset["thumbs"] === "1")
      return;
    const items = Array.from(g.querySelectorAll(":scope > .re-gallery-item"));
    if (!items.length)
      return;
    g.dataset["thumbs"] = "1";
    const thumbImgs = items.map((it) => it.querySelector("img"));
    const srcOf = (im) => im?.getAttribute("src") || im?.currentSrc || "";
    const N = items.length;
    let active = parseInt(g.dataset["active"] || "0", 10);
    if (isNaN(active) || active < 0 || active >= N)
      active = 0;
    const figure = g.closest("figure.re-embed-figure");
    const allowDownload = figure?.getAttribute("data-allow-download") === "true";
    const stage = this.doc.createElement("div");
    stage.className = "re-thumb-stage";
    const stageTrack = this.doc.createElement("div");
    stageTrack.className = "re-thumb-stage-track";
    thumbImgs.forEach((im) => {
      const slide = this.doc.createElement("div");
      slide.className = "re-thumb-slide";
      const img = this.doc.createElement("img");
      img.src = srcOf(im);
      img.alt = im?.alt || "";
      img.draggable = false;
      slide.appendChild(img);
      stageTrack.appendChild(slide);
    });
    stage.appendChild(stageTrack);
    g.insertBefore(stage, items[0]);
    const isSlideshow = g.classList.contains("re-gallery--slideshow");
    let scroller = null;
    const stripWrap = this.doc.createElement("div");
    if (!isSlideshow) {
      const vertical = g.dataset["thumbPlacement"] === "left" || g.dataset["thumbPlacement"] === "right";
      stripWrap.className = "re-thumb-strip-wrap" + (vertical ? " re-thumb-strip-wrap--v" : "");
      const strip = this.doc.createElement("div");
      strip.className = "re-thumb-strip" + (vertical ? " re-thumb-strip--v" : "");
      const track = this.doc.createElement("div");
      track.className = "re-thumb-track";
      items.forEach((it) => {
        it.querySelectorAll("img").forEach((im) => im.setAttribute("draggable", "false"));
        track.appendChild(it);
      });
      strip.appendChild(track);
      stripWrap.appendChild(strip);
      g.appendChild(stripWrap);
      scroller = this.attachThumbStripScroller(strip, track, stripWrap, vertical);
    } else {
      items.forEach((it) => it.remove());
    }
    const W = () => stage.clientWidth || 1;
    const drawStage = (anim, px) => {
      stageTrack.style.transition = anim ? "transform .38s cubic-bezier(.22, .61, .36, 1)" : "none";
      stageTrack.style.transform = `translate3d(${Math.round(px)}px, 0, 0)`;
    };
    const revealThumb = () => scroller?.reveal(items[active]);
    const goTo = (i, anim = true) => {
      active = Math.max(0, Math.min(N - 1, i));
      drawStage(anim, -active * W());
      items.forEach((it, idx) => it.classList.toggle("is-active", idx === active));
      g.dataset["active"] = String(active);
      revealThumb();
    };
    items.forEach((it, i) => it.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      goTo(i);
    }));
    let down = false, moved = false, startX = 0, lastX = 0, vel = 0;
    stage.addEventListener("pointerdown", (e) => {
      if (e.button !== 0)
        return;
      if (e.target.closest(".re-thumb-nav, .re-thumb-expand"))
        return;
      down = true;
      moved = false;
      startX = lastX = e.clientX;
      vel = 0;
      drawStage(false, -active * W());
      stage.classList.add("re-thumb-dragging");
      try {
        stage.setPointerCapture(e.pointerId);
      } catch (e2) {
      }
    });
    stage.addEventListener("pointermove", (e) => {
      if (!down)
        return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4)
        moved = true;
      vel = e.clientX - lastX;
      lastX = e.clientX;
      const min = -(N - 1) * W();
      let px = -active * W() + dx;
      if (px > 0)
        px *= 0.35;
      else if (px < min)
        px = min + (px - min) * 0.35;
      drawStage(false, px);
    });
    const endStage = (e) => {
      if (!down)
        return;
      down = false;
      if (e) {
        try {
          stage.releasePointerCapture(e.pointerId);
        } catch (e2) {
        }
      }
      stage.classList.remove("re-thumb-dragging");
      const dx = lastX - startX, thr = W() * 0.18;
      if (dx <= -thr || vel < -6)
        goTo(active + 1);
      else if (dx >= thr || vel > 6)
        goTo(active - 1);
      else
        goTo(active);
    };
    stage.addEventListener("pointerup", endStage);
    stage.addEventListener("pointercancel", endStage);
    const openLightbox = () => {
      const lbItems = thumbImgs.map((im) => ({ src: srcOf(im), alt: im?.alt || "", download: allowDownload }));
      this.lb.set({ items: lbItems, index: active });
      this.lockScroll(true);
    };
    stage.addEventListener("click", (e) => {
      e.stopPropagation();
      if (moved) {
        e.preventDefault();
        moved = false;
      }
    });
    const expandBtn = this.doc.createElement("button");
    expandBtn.type = "button";
    expandBtn.className = "re-thumb-expand";
    expandBtn.setAttribute("aria-label", "Expand image");
    expandBtn.innerHTML = `<svg width="17" height="17" viewBox="0 0 19 19" xmlns="http://www.w3.org/2000/svg"><path fill="#2F2E2E" fill-rule="nonzero" d="M15.071 8.371V4.585l-4.355 4.356a.2.2 0 0 1-.283 0l-.374-.374a.2.2 0 0 1 0-.283l4.356-4.355h-3.786a.2.2 0 0 1-.2-.2V3.2c0-.11.09-.2.2-.2H16v5.371a.2.2 0 0 1-.2.2h-.529a.2.2 0 0 1-.2-.2zm-6.5 6.9v.529a.2.2 0 0 1-.2.2H3v-5.371c0-.11.09-.2.2-.2h.529c.11 0 .2.09.2.2v3.786l4.355-4.356a.2.2 0 0 1 .283 0l.374.374a.2.2 0 0 1 0 .283L4.585 15.07h3.786c.11 0 .2.09.2.2z"/></svg>`;
    expandBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openLightbox();
    });
    stage.appendChild(expandBtn);
    if (N > 1) {
      const chevron = (flip) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"${flip ? ' style="transform:scaleX(-1)"' : ""}><polyline points="9 18 15 12 9 6"/></svg>`;
      [-1, 1].forEach((dir) => {
        const b = this.doc.createElement("button");
        b.type = "button";
        b.className = `re-thumb-nav re-thumb-nav--${dir < 0 ? "prev" : "next"}`;
        b.setAttribute("aria-label", dir < 0 ? "Previous" : "Next");
        b.innerHTML = chevron(dir < 0);
        b.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          goTo(active + dir);
        });
        stage.appendChild(b);
      });
    }
    goTo(active, false);
    const ro = new ResizeObserver(() => drawStage(false, -active * W()));
    ro.observe(stage);
    this.observers.push(ro);
    const flag = (key, attr, def) => {
      const v = g.dataset[key] ?? figure?.getAttribute(attr) ?? void 0;
      return v === void 0 ? def : v === "true" || v === "on";
    };
    if (N > 1 && flag("autoplay", "data-autoplay", false)) {
      const dur = Math.max(1e3, parseInt(g.dataset["slideDuration"] || figure?.getAttribute("data-slide-duration") || "5000", 10) || 5e3);
      const stopMouse = flag("stopOnMouse", "data-stop-on-mouse", true);
      const resumeMouse = flag("resumeOnMouse", "data-resume-on-mouse", true);
      const stopClick = flag("stopOnClick", "data-stop-on-click", true);
      const resumeClick = flag("resumeOnClick", "data-resume-on-click", false);
      let timer = 0, halted = false;
      const start = () => {
        if (timer || halted)
          return;
        timer = window.setInterval(() => goTo((active + 1) % N), dur);
        this.timers.push(timer);
      };
      const stop = () => {
        if (timer) {
          clearInterval(timer);
          this.timers = this.timers.filter((t2) => t2 !== timer);
          timer = 0;
        }
      };
      if (stopMouse) {
        stage.addEventListener("pointerenter", stop);
        stage.addEventListener("pointerleave", () => {
          if (resumeMouse && !halted)
            start();
        });
      }
      if (stopClick) {
        const onInteract = () => {
          stop();
          if (!resumeClick)
            halted = true;
        };
        stage.addEventListener("pointerdown", onInteract);
        stripWrap.addEventListener("pointerdown", onInteract);
      }
      start();
    }
  }
  /** Slide a thumbnail strip with prev/next arrows (no scrollbar, no drag).
   *  Works horizontally (bottom/top) or vertically (left/right). Arrows hide
   *  at the ends; `reveal` scrolls the active thumb into view. */
  attachThumbStripScroller(strip, track, wrap, vertical) {
    let offset = 0;
    const vpSize = () => vertical ? strip.clientHeight : strip.clientWidth;
    const trSize = () => vertical ? track.scrollHeight : track.scrollWidth;
    const maxOff = () => Math.min(0, vpSize() - trSize());
    const clamp = (x) => Math.max(maxOff(), Math.min(0, x));
    const draw = (anim) => {
      track.style.transition = anim ? "transform .32s cubic-bezier(.22, .61, .36, 1)" : "none";
      track.style.transform = vertical ? `translate3d(0, ${Math.round(offset)}px, 0)` : `translate3d(${Math.round(offset)}px, 0, 0)`;
    };
    const pts = (flip) => vertical ? flip ? "6 15 12 9 18 15" : "6 9 12 15 18 9" : flip ? "15 18 9 12 15 6" : "9 18 15 12 9 6";
    const mk = (dir) => {
      const b = this.doc.createElement("button");
      b.type = "button";
      b.className = `re-thumb-strip-nav re-thumb-strip-nav--${dir < 0 ? "prev" : "next"}`;
      b.setAttribute("aria-label", dir < 0 ? "Previous" : "Next");
      b.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${pts(dir < 0)}"/></svg>`;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        offset = clamp(offset - dir * vpSize() * 0.8);
        draw(true);
        sync();
      });
      return b;
    };
    const prev = mk(-1), next = mk(1);
    wrap.appendChild(prev);
    wrap.appendChild(next);
    const sync = () => {
      const none = maxOff() >= -1;
      prev.classList.toggle("re-thumb-strip-nav--off", none || offset >= -1);
      next.classList.toggle("re-thumb-strip-nav--off", none || offset <= maxOff() + 1);
    };
    const ro = new ResizeObserver(() => {
      offset = clamp(offset);
      draw(false);
      sync();
    });
    ro.observe(strip);
    this.observers.push(ro);
    strip.querySelectorAll("img").forEach((im) => {
      if (!im.complete)
        im.addEventListener("load", sync, { once: true });
    });
    sync();
    const axis = (e) => vertical ? e.clientY : e.clientX;
    let down = false, moved = false, start = 0, startOff = 0, last = 0, vel = 0, raf = 0;
    const stopM = () => {
      if (raf)
        cancelAnimationFrame(raf);
      raf = 0;
    };
    strip.addEventListener("pointerdown", (e) => {
      if (e.button !== 0)
        return;
      stopM();
      down = true;
      moved = false;
      start = last = axis(e);
      startOff = offset;
      vel = 0;
    });
    strip.addEventListener("pointermove", (e) => {
      if (!down)
        return;
      const d = axis(e) - start;
      if (!moved) {
        if (Math.abs(d) <= 4)
          return;
        moved = true;
        strip.classList.add("re-thumb-strip--drag");
        try {
          strip.setPointerCapture(e.pointerId);
        } catch (e2) {
        }
      }
      vel = axis(e) - last;
      last = axis(e);
      const mx = maxOff();
      let x = startOff + d;
      if (x > 0)
        x *= 0.35;
      else if (x < mx)
        x = mx + (x - mx) * 0.35;
      offset = x;
      draw(false);
    });
    const endDrag = (e) => {
      if (!down)
        return;
      down = false;
      if (e) {
        try {
          strip.releasePointerCapture(e.pointerId);
        } catch (e2) {
        }
      }
      strip.classList.remove("re-thumb-strip--drag");
      if (Math.abs(vel) > 1) {
        let v = vel;
        const tick = () => {
          offset += v;
          v *= 0.92;
          const mx = maxOff();
          if (offset > 0) {
            offset = 0;
            v = 0;
          } else if (offset < mx) {
            offset = mx;
            v = 0;
          }
          draw(false);
          sync();
          raf = Math.abs(v) > 0.4 ? requestAnimationFrame(tick) : 0;
        };
        raf = requestAnimationFrame(tick);
      } else {
        offset = clamp(offset);
        draw(true);
        sync();
      }
    };
    strip.addEventListener("pointerup", endDrag);
    strip.addEventListener("pointercancel", endDrag);
    strip.addEventListener("click", (e) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    }, true);
    const reveal = (el) => {
      const sr = strip.getBoundingClientRect(), er = el.getBoundingClientRect();
      let d = 0;
      if (vertical) {
        if (er.top < sr.top + 4)
          d = sr.top - er.top + 8;
        else if (er.bottom > sr.bottom - 4)
          d = sr.bottom - er.bottom - 8;
      } else {
        if (er.left < sr.left + 4)
          d = sr.left - er.left + 8;
        else if (er.right > sr.right - 4)
          d = sr.right - er.right - 8;
      }
      if (d) {
        offset = clamp(offset + d);
        draw(true);
        sync();
      }
    };
    return { reveal };
  }
  layoutMasonry(g) {
    const items = Array.from(g.querySelectorAll(".re-gallery-item"));
    if (!items.length)
      return;
    const W = g.clientWidth;
    if (!W)
      return;
    const cs = getComputedStyle(g);
    const gap = parseFloat(cs.getPropertyValue("--re-gal-gap")) || 8;
    const fig = g.closest("figure");
    const targetH = parseFloat(cs.getPropertyValue("--re-gal-row-h")) || parseFloat(fig?.getAttribute("data-row-height") || g.getAttribute("data-row-height") || "") || 300;
    let pending = false;
    const aspectOf = (it) => {
      const im = it.querySelector("img");
      if (im && !im.naturalWidth) {
        pending = true;
        im.addEventListener("load", () => this.layoutMasonry(g), { once: true });
      }
      return im?.naturalWidth && im?.naturalHeight ? im.naturalWidth / im.naturalHeight : 1.5;
    };
    g.style.display = "flex";
    g.style.flexWrap = "wrap";
    g.style.alignContent = "flex-start";
    g.style.columnCount = "";
    g.style.gap = `${gap}px`;
    const rows = [];
    let cur = { items: [], aspects: [], sum: 0 };
    for (const it of items) {
      const a = aspectOf(it);
      const w = a * targetH;
      if (cur.items.length && cur.sum + w + gap * cur.items.length > W) {
        rows.push(cur);
        cur = { items: [], aspects: [], sum: 0 };
      }
      cur.items.push(it);
      cur.aspects.push(a);
      cur.sum += w;
    }
    if (cur.items.length)
      rows.push(cur);
    for (const row of rows) {
      const n = row.items.length;
      const avail = W - gap * (n - 1);
      const rowH = Math.max(40, targetH * (avail / row.sum));
      let used = 0;
      row.items.forEach((it, j) => {
        let w = Math.floor(row.aspects[j] * rowH);
        if (j === n - 1)
          w = Math.max(1, Math.round(avail - used));
        used += w;
        it.style.flex = "0 0 auto";
        it.style.margin = "0";
        it.style.width = `${w}px`;
        it.style.height = `${Math.round(rowH)}px`;
        it.style.overflow = "hidden";
        it.style.borderRadius = "10px";
        const im = it.querySelector("img");
        if (im) {
          im.style.width = "100%";
          im.style.height = "100%";
          im.style.objectFit = "cover";
          im.style.display = "block";
        }
      });
    }
    void pending;
  }
  /** Delegated click handler for the rendered (innerHTML) content:
   *  toggles accordions and opens the image/gallery lightbox. Links and
   *  other clicks fall through untouched. Browser-only. */
  onClick(ev) {
    if (!this.isBrowser)
      return;
    const el = ev.target;
    if (!el)
      return;
    const head = el.closest(".re-expand__head");
    if (head) {
      const item = head.closest(".re-expand");
      if (item) {
        const group = item.closest(".re-expand-group");
        const willOpen = item.getAttribute("data-open") !== "true";
        if (willOpen && group?.getAttribute("data-single") === "true") {
          group.querySelectorAll('.re-expand[data-open="true"]').forEach((o) => o.setAttribute("data-open", "false"));
        }
        item.setAttribute("data-open", willOpen ? "true" : "false");
        ev.preventDefault();
      }
      return;
    }
    const img = el.closest("img");
    if (!img)
      return;
    if (img.closest('a, .re-product, [data-click-expand="false"]'))
      return;
    const gallery = img.closest(".re-gallery, figure.re-embed-figure--gallery");
    const figure = img.closest("figure.re-embed-figure");
    const scope = gallery ?? figure;
    const imgs = scope ? Array.from(scope.querySelectorAll("img")) : [img];
    if (!imgs.length)
      return;
    ev.preventDefault();
    const allowDownload = figure?.getAttribute("data-allow-download") === "true" || !!img.closest('[data-allow-download="true"]');
    const items = imgs.map((i) => ({
      src: i.getAttribute("src") || i.currentSrc || "",
      alt: i.alt || "",
      download: allowDownload
    }));
    this.lb.set({ items, index: Math.max(0, imgs.indexOf(img)) });
    this.lockScroll(true);
  }
  step(ev, delta) {
    ev.stopPropagation();
    const box = this.lb();
    if (!box)
      return;
    const n = box.items.length;
    this.slideDir.set(delta >= 0 ? 1 : -1);
    this.lb.set(__spreadProps(__spreadValues({}, box), { index: (box.index + delta + n) % n }));
  }
  closeLb() {
    this.lb.set(null);
    this.lockScroll(false);
  }
  /** Toggle browser fullscreen on the lightbox surface. */
  toggleFs(ev) {
    ev.stopPropagation();
    if (!this.isBrowser)
      return;
    const d = this.doc;
    if (d.fullscreenElement) {
      d.exitFullscreen?.();
      return;
    }
    const el = this.doc.querySelector(".lb");
    el?.requestFullscreen?.();
  }
  /** Right-click on the open lightbox image: block "save image" unless
   *  the author allowed downloads for it. */
  onImgMenu(ev, allowed) {
    if (!allowed)
      ev.preventDefault();
  }
  /** Right-click on a content image: block saving unless its figure is
   *  flagged data-allow-download="true". */
  onContentMenu(ev) {
    const img = ev.target?.closest("img");
    if (!img)
      return;
    const figure = img.closest("figure.re-embed-figure");
    if (figure && figure.getAttribute("data-allow-download") !== "true")
      ev.preventDefault();
  }
  onKey(ev) {
    if (!this.lb())
      return;
    if (ev.key === "Escape")
      this.closeLb();
    else if (ev.key === "ArrowRight")
      this.step(ev, 1);
    else if (ev.key === "ArrowLeft")
      this.step(ev, -1);
  }
  lockScroll(on) {
    if (!this.isBrowser || !this.doc?.body)
      return;
    this.doc.body.style.overflow = on ? "hidden" : "";
  }
  ngOnDestroy() {
    this.observers.forEach((o) => o.disconnect());
    this.observers = [];
    this.timers.forEach((t2) => clearInterval(t2));
    this.timers = [];
  }
  static {
    this.\u0275fac = function PostContentComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _PostContentComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _PostContentComponent, selectors: [["app-post-content"]], hostBindings: function PostContentComponent_HostBindings(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275listener("keydown", function PostContentComponent_keydown_HostBindingHandler($event) {
          return ctx.onKey($event);
        }, \u0275\u0275resolveDocument);
      }
    }, inputs: { html: "html", lang: "lang" }, features: [\u0275\u0275NgOnChangesFeature], decls: 2, vars: 2, consts: [[1, "prose", 3, "click", "contextmenu", "innerHTML"], ["role", "dialog", "aria-modal", "true", 1, "lb"], ["role", "dialog", "aria-modal", "true", 1, "lb", 3, "click"], ["type", "button", "aria-label", "Full screen", 1, "lb__btn", "lb__expand", 3, "click"], ["width", "60", "height", "60", "viewBox", "0 0 60 60"], ["fill", "none", "fill-rule", "evenodd"], ["fill", "#2F2E2E"], ["d", "M4.333 15.167H5.413V27.084H4.333z", "transform", "translate(17 17) rotate(45 4.873 21.125)"], ["d", "M26 8h-1V1h-7V0h8v8z", "transform", "translate(17 17)"], ["d", "M20.583 -1.083H21.666V10.834H20.583z", "transform", "translate(17 17) rotate(45 21.125 4.875)"], ["d", "M0 26v-8h1v7h7v1H0z", "transform", "translate(17 17)"], ["type", "button", "aria-label", "Close", 1, "lb__btn", "lb__close", 3, "click"], ["fill", "#2F2E2E", "d", "M42.188 17l.812.813L30.812 30 43 42.188l-.813.812L30 30.812 17.812 43 17 42.187 29.187 30 17 17.812l.813-.812L30 29.187 42.188 17z"], [1, "lb__stage", 3, "click"], [1, "lb__img", 3, "lb__img--next", "lb__img--prev", "src", "alt"], [1, "lb__bar"], ["type", "button", "aria-label", "Previous", 1, "lb__btn", "lb__prev", 3, "click"], ["width", "23", "height", "39", "viewBox", "0 0 23 39", 2, "transform", "scaleX(-1)"], ["fill", "#2F2E2E", "d", "M857.005,231.479L858.5,230l18.124,18-18.127,18-1.49-1.48L873.638,248Z", "transform", "translate(-855 -230)"], ["type", "button", "aria-label", "Next", 1, "lb__btn", "lb__next", 3, "click"], ["width", "23", "height", "39", "viewBox", "0 0 23 39"], [1, "lb__img", 3, "contextmenu", "src", "alt"], [1, "lb__count"], ["download", "", "target", "_blank", "rel", "noopener", 1, "lb__dl", 3, "href"], ["download", "", "target", "_blank", "rel", "noopener", 1, "lb__dl", 3, "click", "href"], ["width", "16", "height", "16", "viewBox", "0 0 24 24", "fill", "none", "stroke", "#2F2E2E", "stroke-width", "2", "stroke-linecap", "round", "stroke-linejoin", "round"], ["d", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"]], template: function PostContentComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275domElementStart(0, "div", 0);
        \u0275\u0275domListener("click", function PostContentComponent_Template_div_click_0_listener($event) {
          return ctx.onClick($event);
        })("contextmenu", function PostContentComponent_Template_div_contextmenu_0_listener($event) {
          return ctx.onContentMenu($event);
        });
        \u0275\u0275domElementEnd();
        \u0275\u0275conditionalCreate(1, PostContentComponent_Conditional_1_Template, 17, 4, "div", 1);
      }
      if (rf & 2) {
        let tmp_1_0;
        \u0275\u0275domProperty("innerHTML", ctx.safe, \u0275\u0275sanitizeHtml);
        \u0275\u0275advance();
        \u0275\u0275conditional((tmp_1_0 = ctx.lb()) ? 1 : -1, tmp_1_0);
      }
    }, dependencies: [CommonModule], styles: [`
[_nghost-%COMP%] {
  display: block;
}
.prose[_ngcontent-%COMP%] {
  --ink: var(--body-text, #1a1a1a);
  --muted: color-mix(in srgb, var(--ink) 60%, transparent);
  --hair: color-mix(in srgb, var(--ink) 12%, transparent);
  --surface: color-mix(in srgb, var(--ink) 4%, transparent);
  max-width: 720px;
  margin: 0 auto;
  font-family:
    "Inter",
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    sans-serif;
  font-size: 19px;
  line-height: 1.8;
  color: var(--ink);
  letter-spacing: .003em;
}
@media (max-width: 768px) {
  .prose[_ngcontent-%COMP%] {
    font-size: 17px;
    line-height: 1.72;
  }
}
.prose[_ngcontent-%COMP%]     h2 {
  font-family:
    "Playfair Display",
    Georgia,
    serif;
  font-size: 32px;
  line-height: 1.22;
  margin: 56px 0 18px;
  font-weight: 700;
  letter-spacing: -.01em;
}
.prose[_ngcontent-%COMP%]     h3 {
  font-size: 23px;
  line-height: 1.3;
  margin: 40px 0 12px;
  font-weight: 700;
}
.prose[_ngcontent-%COMP%]     h4 {
  font-size: 19px;
  line-height: 1.35;
  margin: 30px 0 10px;
  font-weight: 700;
}
.prose[_ngcontent-%COMP%]     p {
  margin: 20px 0;
}
.prose[_ngcontent-%COMP%]     a {
  color: var(--primary, #6366f1);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.prose[_ngcontent-%COMP%]     a:hover {
  text-decoration: underline;
}
.prose[_ngcontent-%COMP%]     strong {
  font-weight: 700;
}
.prose[_ngcontent-%COMP%]     hr {
  border: 0;
  height: 1px;
  background: var(--hair);
  margin: 48px auto;
  width: 60%;
}
.prose[_ngcontent-%COMP%]     > p:first-of-type::first-letter {
  float: inline-start;
  font-family:
    "Playfair Display",
    Georgia,
    serif;
  font-size: 4.2em;
  line-height: .82;
  font-weight: 700;
  margin-inline-end: .08em;
  margin-block-start: .05em;
  color: var(--primary, #6366f1);
}
.prose[_ngcontent-%COMP%]     ul, 
.prose[_ngcontent-%COMP%]     ol {
  padding-inline-start: 26px;
  margin: 20px 0;
}
.prose[_ngcontent-%COMP%]     li {
  margin: 8px 0;
  padding-inline-start: 4px;
}
.prose[_ngcontent-%COMP%]     li::marker {
  color: var(--primary, #6366f1);
}
.prose[_ngcontent-%COMP%]     blockquote {
  border-inline-start: 3px solid var(--primary, #6366f1);
  padding: 2px 22px;
  margin: 32px 0;
  font-family:
    "Playfair Display",
    Georgia,
    serif;
  font-size: 24px;
  line-height: 1.45;
  font-style: italic;
  color: var(--ink);
}
.prose[_ngcontent-%COMP%]     blockquote p {
  margin: 8px 0;
}
.prose[_ngcontent-%COMP%]     figure.re-quote, 
.prose[_ngcontent-%COMP%]     .re-pullquote {
  background: var(--ink);
  color: var(--body-bg, #fff);
  border-radius: 14px;
  padding: 28px 30px;
  margin: 36px 0;
  border: 0;
}
.prose[_ngcontent-%COMP%]     figure.re-quote blockquote, 
.prose[_ngcontent-%COMP%]     .re-pullquote blockquote {
  border: 0;
  padding: 0;
  margin: 0;
  color: inherit;
  font-size: 26px;
  font-weight: 600;
  font-style: normal;
}
.prose[_ngcontent-%COMP%]     figure.re-quote figcaption, 
.prose[_ngcontent-%COMP%]     .re-pullquote figcaption {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: "Inter", sans-serif;
  font-size: 14px;
  font-style: normal;
  opacity: .85;
  text-align: start;
}
.prose[_ngcontent-%COMP%]     img {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  display: block;
}
.prose[_ngcontent-%COMP%]     figure {
  margin: 36px 0;
}
.prose[_ngcontent-%COMP%]     figure img {
  margin: 0 auto;
}
.prose[_ngcontent-%COMP%]     figcaption {
  font-size: 13.5px;
  color: var(--muted);
  text-align: center;
  margin-top: 10px;
  font-style: italic;
}
.prose[_ngcontent-%COMP%]     div:has(> .re-gallery-item):not(.re-gal-track):not(.re-thumb-track):not(.re-gallery--thumbnails):not(.re-gallery--columns):not(.re-gallery--panorama) {
  display: grid;
  grid-template-columns: repeat(var(--re-gal-cols, 3), minmax(0, 1fr));
  gap: var(--re-gal-gap, 8px);
  margin: 32px 0;
}
.prose[_ngcontent-%COMP%]     div:has(> .re-gallery-item):not([style*=--re-gal-cols]):not(.re-gal-track):not(.re-thumb-track):not(.re-gallery--thumbnails):not(.re-gallery--columns):not(.re-gallery--panorama) {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}
.prose[_ngcontent-%COMP%]     .re-gallery-item {
  margin: 0;
  overflow: hidden;
  border-radius: 10px;
}
.prose[_ngcontent-%COMP%]     .re-gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
  margin: 0;
  aspect-ratio: var(--re-gal-ratio, auto);
}
.prose[_ngcontent-%COMP%]     .re-embed-figure, 
.prose[_ngcontent-%COMP%]     .re-embed-card {
  margin: 36px 0;
}
.prose[_ngcontent-%COMP%]     .re-embed-video {
  position: relative;
  aspect-ratio: 16/9;
  border-radius: 12px;
  overflow: hidden;
  background: #000;
}
.prose[_ngcontent-%COMP%]     .re-embed-video iframe, 
.prose[_ngcontent-%COMP%]     .re-embed-video video, 
.prose[_ngcontent-%COMP%]     iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 12px;
}
.prose[_ngcontent-%COMP%]     .re-embed-card {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 16px;
  border: 1px solid var(--hair);
  border-radius: 14px;
  text-decoration: none;
  color: inherit;
}
.prose[_ngcontent-%COMP%]     .re-embed-caption {
  font-size: 13.5px;
  color: var(--muted);
  margin-top: 10px;
  text-align: center;
}
.prose[_ngcontent-%COMP%]     .re-banner {
  display: grid;
  grid-template-columns: repeat(var(--re-banner-cols, 1), minmax(0, 1fr));
  gap: 0;
  margin: 40px 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--hair);
  background: var(--surface);
}
.prose[_ngcontent-%COMP%]     .re-banner-col, 
.prose[_ngcontent-%COMP%]     .re-banner-cell {
  padding: 28px 30px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  background-size: cover;
  background-position: center;
  min-height: 120px;
}
.prose[_ngcontent-%COMP%]     .re-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 0;
}
@media (max-width: 640px) {
  .prose[_ngcontent-%COMP%]     .re-banner {
    grid-template-columns: 1fr;
  }
}
.prose[_ngcontent-%COMP%]     .re-btn-block {
  margin: 28px 0;
  text-align: center;
}
.prose[_ngcontent-%COMP%]     .re-btn-block a, 
.prose[_ngcontent-%COMP%]     a.re-btn {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 999px;
  background: var(--primary, #6366f1);
  color: #fff !important;
  font-weight: 600;
  text-decoration: none;
  transition: filter .15s ease;
}
.prose[_ngcontent-%COMP%]     .re-btn-block a:hover {
  filter: brightness(1.08);
  text-decoration: none;
}
.prose[_ngcontent-%COMP%]     .re-expand {
  border: 0;
  background: transparent;
  border-radius: 0;
  margin: 4px 0;
  overflow: visible;
}
.prose[_ngcontent-%COMP%]     .re-expand-group {
  margin: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.prose[_ngcontent-%COMP%]     .re-expand__head {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-start;
  padding: 8px 0;
  font-weight: 600;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
}
.prose[_ngcontent-%COMP%]     .re-expand__drag, 
.prose[_ngcontent-%COMP%]     .re-expand__chev, 
.prose[_ngcontent-%COMP%]     .re-expand__add {
  display: none !important;
}
.prose[_ngcontent-%COMP%]     .re-expand__head::before {
  content: "\\203a";
  order: -1;
  flex: none;
  display: inline-block;
  width: 14px;
  text-align: center;
  font-size: 20px;
  line-height: 1;
  color: var(--muted);
  transition: transform .2s ease;
}
.prose[_ngcontent-%COMP%]     .re-expand[data-open=true] .re-expand__head::before {
  transform: rotate(90deg);
}
.prose[_ngcontent-%COMP%]     .re-expand__title {
  flex: 0 1 auto;
  text-align: start;
  min-width: 0;
  font-weight: 600;
}
.prose[_ngcontent-%COMP%]     .re-expand:not([data-open=true]) .re-expand__body {
  display: none;
}
.prose[_ngcontent-%COMP%]     .re-expand__body {
  padding: 2px 0 8px 24px;
  color: var(--ink);
}
.prose[_ngcontent-%COMP%]     .re-poll {
  border: 1px solid var(--hair);
  border-radius: 16px;
  padding: 22px;
  margin: 32px 0;
  background: var(--surface);
}
.prose[_ngcontent-%COMP%]     .re-poll__q {
  font-weight: 700;
  font-size: 18px;
  margin-bottom: 14px;
}
.prose[_ngcontent-%COMP%]     .re-poll__ans {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin: 8px 0;
  border: 1px solid var(--hair);
  border-radius: 10px;
  background: var(--body-bg, #fff);
  cursor: pointer;
  transition: border-color .15s ease;
}
.prose[_ngcontent-%COMP%]     .re-poll__ans:hover {
  border-color: var(--primary, #6366f1);
}
.prose[_ngcontent-%COMP%]     .re-poll__ans-remove, 
.prose[_ngcontent-%COMP%]     .re-poll__add {
  display: none;
}
.prose[_ngcontent-%COMP%]     table {
  width: 100%;
  border-collapse: collapse;
  margin: 32px 0;
  font-size: 16px;
  border: 1px solid var(--hair);
  border-radius: 12px;
  overflow: hidden;
}
.prose[_ngcontent-%COMP%]     th, 
.prose[_ngcontent-%COMP%]     td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--hair);
  text-align: start;
}
.prose[_ngcontent-%COMP%]     th {
  background: var(--surface);
  font-weight: 700;
}
.prose[_ngcontent-%COMP%]     tr:last-child td {
  border-bottom: 0;
}
.prose[_ngcontent-%COMP%]     pre {
  background: #0f172a;
  color: #e2e8f0;
  padding: 18px 20px;
  border-radius: 12px;
  overflow-x: auto;
  font-size: 14px;
  margin: 28px 0;
  line-height: 1.6;
}
.prose[_ngcontent-%COMP%]     code {
  font-family:
    "SF Mono",
    Menlo,
    Consolas,
    monospace;
  background: var(--surface);
  padding: 2px 6px;
  border-radius: 5px;
  font-size: .88em;
}
.prose[_ngcontent-%COMP%]     pre code {
  background: transparent;
  padding: 0;
  color: inherit;
}
.prose[_ngcontent-%COMP%]     .blog-hashtag {
  color: var(--primary, #6366f1);
  font-weight: 500;
  text-decoration: none;
}
.prose[_ngcontent-%COMP%]     .blog-hashtag:hover {
  text-decoration: underline;
}
.prose[_ngcontent-%COMP%]     figure.re-embed-figure {
  margin: 36px auto;
}
.prose[_ngcontent-%COMP%]     .re-size-compact {
  width: 55%;
}
.prose[_ngcontent-%COMP%]     .re-size-standard {
  width: 100%;
}
.prose[_ngcontent-%COMP%]     .re-size-original {
  width: -moz-fit-content;
  width: fit-content;
}
.prose[_ngcontent-%COMP%]     .re-size-extended {
  width: calc(100% + 140px);
  max-width: calc(100% + 140px);
  margin-inline: -70px;
}
.prose[_ngcontent-%COMP%]     .re-align-left {
  margin-inline: 0 auto;
}
.prose[_ngcontent-%COMP%]     .re-align-center {
  margin-inline: auto;
}
.prose[_ngcontent-%COMP%]     .re-align-right {
  margin-inline: auto 0;
}
.prose[_ngcontent-%COMP%]     figure.re-embed-figure img, 
.prose[_ngcontent-%COMP%]     .re-gallery img {
  cursor: zoom-in;
}
.prose[_ngcontent-%COMP%]     [data-click-expand=false] img {
  cursor: default;
}
.prose[_ngcontent-%COMP%]     figure.re-embed-figure:not([data-click-expand=false]) {
  position: relative;
}
.prose[_ngcontent-%COMP%]     figure.re-embed-figure:not([data-click-expand=false])::after {
  content: "";
  position: absolute;
  top: 12px;
  inset-inline-end: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, .92);
  background-repeat: no-repeat;
  background-position: center;
  background-size: 17px;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 19 19' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='%232F2E2E' fill-rule='nonzero' d='M15.071 8.371V4.585l-4.355 4.356a.2.2 0 0 1-.283 0l-.374-.374a.2.2 0 0 1 0-.283l4.356-4.355h-3.786a.2.2 0 0 1-.2-.2V3.2c0-.11.09-.2.2-.2H16v5.371a.2.2 0 0 1-.2.2h-.529a.2.2 0 0 1-.2-.2zm-6.5 6.9v.529a.2.2 0 0 1-.2.2H3v-5.371c0-.11.09-.2.2-.2h.529c.11 0 .2.09.2.2v3.786l4.355-4.356a.2.2 0 0 1 .283 0l.374.374a.2.2 0 0 1 0 .283L4.585 15.07h3.786c.11 0 .2.09.2.2z'/%3E%3C/svg%3E");
  box-shadow: 0 2px 8px rgba(0, 0, 0, .15);
  opacity: 0;
  transition: opacity .15s ease;
  pointer-events: none;
}
.prose[_ngcontent-%COMP%]     figure.re-embed-figure:not([data-click-expand=false]):hover::after {
  opacity: 1;
}
.prose[_ngcontent-%COMP%]     figure.re-embed-figure:has(.re-gallery--thumbnails)::after, 
.prose[_ngcontent-%COMP%]     figure.re-embed-figure:has(.re-gallery--slideshow)::after {
  content: none !important;
}
.prose[_ngcontent-%COMP%]     .re-thumb-expand {
  position: absolute;
  top: 12px;
  inset-inline-end: 12px;
  z-index: 4;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 0;
  padding: 0;
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 2px 8px rgba(0, 0, 0, .15);
  cursor: pointer;
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity .15s ease;
}
.prose[_ngcontent-%COMP%]     .re-thumb-stage:hover .re-thumb-expand {
  opacity: 1;
}
@media (max-width: 768px) {
  .prose[_ngcontent-%COMP%]     .re-size-compact, 
   .prose[_ngcontent-%COMP%]     .re-size-extended {
    width: 100%;
    max-width: 100%;
    margin-inline: 0;
  }
}
.prose[_ngcontent-%COMP%]     .re-gallery {
  display: grid;
  grid-template-columns: repeat(var(--re-gal-cols, 3), minmax(0, 1fr));
  gap: var(--re-gal-gap, 8px);
}
.prose[_ngcontent-%COMP%]     .re-gallery .re-gallery-item {
  margin: 0;
  border-radius: 10px;
  overflow: hidden;
}
.prose[_ngcontent-%COMP%]     .re-gallery .re-gallery-item img {
  width: 100%;
  height: 100%;
  display: block;
  margin: 0;
  border-radius: 10px;
  object-fit: cover;
  aspect-ratio: var(--re-gal-ratio, 1 / 1);
}
.prose[_ngcontent-%COMP%]     .re-gallery[data-crop=fit] .re-gallery-item img {
  object-fit: contain;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--masonry {
  display: block;
  column-count: var(--re-gal-cols, 3);
  column-gap: var(--re-gal-gap, 8px);
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--masonry .re-gallery-item {
  break-inside: avoid;
  margin: 0 0 var(--re-gal-gap, 8px);
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--masonry .re-gallery-item img {
  height: auto;
  aspect-ratio: auto;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--columns {
  display: flex;
  gap: var(--re-gal-gap, 8px);
  height: var(--re-gal-row-h, 420px);
  overflow-x: auto;
  column-count: initial;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--columns::-webkit-scrollbar {
  display: none;
}
.prose[_ngcontent-%COMP%]     .re-gallery--columns .re-gallery-item {
  flex: 0 0 var(--re-gal-col-w, 200px);
  height: 100%;
  margin: 0;
  border-radius: 10px;
  overflow: hidden;
}
.prose[_ngcontent-%COMP%]     .re-gallery--columns .re-gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  aspect-ratio: auto;
  border-radius: 10px;
}
.prose[_ngcontent-%COMP%]     .re-gal-swiper.re-gallery--columns .re-gallery-item img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--collage {
  display: block;
  column-count: initial;
  grid-template-columns: none;
  columns: var(--re-gal-col-w, 240px) auto;
  column-gap: var(--re-gal-gap, 6px);
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--collage .re-gallery-item {
  break-inside: avoid;
  margin: 0 0 var(--re-gal-gap, 6px);
  width: 100%;
  grid-column: auto;
  grid-row: auto;
  border-radius: 10px;
  overflow: hidden;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--collage .re-gallery-item img {
  width: 100%;
  height: auto;
  object-fit: cover;
  aspect-ratio: auto;
  border-radius: 10px;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--collage[data-scroll-dir=horizontal] {
  display: flex;
  flex-wrap: nowrap;
  columns: auto;
  gap: var(--re-gal-gap, 6px);
  overflow-x: auto;
  height: var(--re-gal-row-h, 420px);
  -webkit-overflow-scrolling: touch;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--collage[data-scroll-dir=horizontal] .re-gallery-item {
  flex: 0 0 auto;
  height: 100%;
  width: auto;
  margin: 0;
  break-inside: auto;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--collage[data-scroll-dir=horizontal] .re-gallery-item img {
  height: 100%;
  width: auto;
  object-fit: cover;
  aspect-ratio: auto;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--collage[data-orientation=horizontal]:not([data-scroll-dir=horizontal]) {
  display: flex;
  flex-wrap: wrap;
  columns: auto;
  gap: var(--re-gal-gap, 6px);
  align-content: flex-start;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--collage[data-orientation=horizontal]:not([data-scroll-dir=horizontal]) .re-gallery-item {
  flex: 0 0 auto;
  width: auto;
  height: auto;
  margin: 0;
  break-inside: auto;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--collage[data-orientation=horizontal]:not([data-scroll-dir=horizontal]) .re-gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  aspect-ratio: auto;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--slider, 
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--carousel {
  display: flex;
  gap: var(--re-gal-gap, 8px);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 6px;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--slider .re-gallery-item, 
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--carousel .re-gallery-item {
  flex: 0 0 auto;
  width: clamp(220px, 46%, 460px);
  scroll-snap-align: start;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--slider .re-gallery-item img, 
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--carousel .re-gallery-item img {
  aspect-ratio: var(--re-gal-ratio, 4 / 3);
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--panorama {
  display: flex !important;
  flex-direction: column;
  gap: var(--re-gal-gap, 8px);
  grid-template-columns: none !important;
  overflow: visible;
}
.prose[_ngcontent-%COMP%]     .re-gallery--panorama .re-gallery-item {
  flex: 0 0 auto;
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
}
.prose[_ngcontent-%COMP%]     .re-gallery--panorama .re-gallery-item img {
  width: 100%;
  height: auto;
  object-fit: cover;
  aspect-ratio: auto;
  border-radius: 10px;
  display: block;
}
.prose[_ngcontent-%COMP%]     .re-gal-wrap {
  position: relative;
}
.prose[_ngcontent-%COMP%]     .re-gal-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  padding: 8px;
  display: grid;
  place-items: center;
  cursor: pointer;
  border: 0;
  background: none;
  opacity: .85;
  transition: opacity .15s ease;
}
.prose[_ngcontent-%COMP%]     .re-gal-arrow:hover {
  opacity: 1;
}
.prose[_ngcontent-%COMP%]     .re-gal-arrow svg {
  display: block;
  filter: drop-shadow(0 1px 0px rgba(255, 255, 255, .8));
}
.prose[_ngcontent-%COMP%]     .re-gal-arrow--prev {
  inset-inline-start: 12px;
}
.prose[_ngcontent-%COMP%]     .re-gal-arrow--next {
  inset-inline-end: 12px;
}
.prose[_ngcontent-%COMP%]     .re-gal-arrow--off {
  display: none;
}
.prose[_ngcontent-%COMP%]     .re-gal-swiper {
  display: block !important;
  overflow: hidden !important;
  position: relative;
  columns: auto !important;
  column-count: auto !important;
  column-width: auto !important;
  grid-template-columns: none !important;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
}
.prose[_ngcontent-%COMP%]     .re-gal-swiper.re-gal-dragging {
  cursor: grabbing;
}
.prose[_ngcontent-%COMP%]     .re-gal-track {
  display: flex !important;
  flex-wrap: nowrap !important;
  align-items: stretch;
  gap: var(--re-gal-gap, 6px);
  width: -moz-max-content;
  width: max-content;
  will-change: transform;
}
.prose[_ngcontent-%COMP%]     .re-gal-swiper.re-gallery--collage .re-gallery-item img {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
}
.prose[_ngcontent-%COMP%]     .re-gallery--slideshow, 
.prose[_ngcontent-%COMP%]     .re-gallery--carousel, 
.prose[_ngcontent-%COMP%]     .re-gallery--slider, 
.prose[_ngcontent-%COMP%]     .re-gallery--collage[data-scroll-dir=horizontal] {
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.prose[_ngcontent-%COMP%]     .re-gallery--slideshow::-webkit-scrollbar, 
.prose[_ngcontent-%COMP%]     .re-gallery--carousel::-webkit-scrollbar, 
.prose[_ngcontent-%COMP%]     .re-gallery--slider::-webkit-scrollbar, 
.prose[_ngcontent-%COMP%]     .re-gallery--collage[data-scroll-dir=horizontal]::-webkit-scrollbar {
  display: none;
}
.prose[_ngcontent-%COMP%]     .re-gallery--slideshow .re-gallery-item, 
.prose[_ngcontent-%COMP%]     .re-gallery--carousel .re-gallery-item, 
.prose[_ngcontent-%COMP%]     .re-gallery--slider .re-gallery-item, 
.prose[_ngcontent-%COMP%]     .re-gallery--collage[data-scroll-dir=horizontal] .re-gallery-item {
  scroll-snap-align: start;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--slideshow {
  display: flex;
  gap: 0;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  border-radius: 12px;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--slideshow .re-gallery-item {
  flex: 0 0 100%;
  scroll-snap-align: center;
  border-radius: 0;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--slideshow .re-gallery-item img {
  aspect-ratio: var(--re-gal-ratio, 16 / 9);
  object-fit: cover;
  border-radius: 0;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--thumbnails {
  --re-gal-thumb: 110px;
  display: flex !important;
  flex-wrap: wrap !important;
  grid-template-columns: none !important;
  gap: var(--re-gal-gap, 8px);
  position: relative;
}
.prose[_ngcontent-%COMP%]     .re-gallery.re-gallery--slideshow {
  display: block !important;
  position: relative;
}
.prose[_ngcontent-%COMP%]     .re-thumb-stage {
  flex: 0 0 100%;
  order: 1;
  position: relative;
  aspect-ratio: 16 / 9;
  min-width: 0;
  border-radius: 12px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
}
.prose[_ngcontent-%COMP%]     .re-thumb-stage.re-thumb-dragging {
  cursor: grabbing;
}
.prose[_ngcontent-%COMP%]     .re-thumb-stage-track {
  display: flex;
  flex-wrap: nowrap;
  width: 100%;
  height: 100%;
  will-change: transform;
}
.prose[_ngcontent-%COMP%]     .re-thumb-slide {
  flex: 0 0 100%;
  height: 100%;
}
.prose[_ngcontent-%COMP%]     .re-thumb-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip-wrap {
  flex: 0 0 100%;
  order: 2;
  position: relative;
  min-width: 0;
  max-width: 100%;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip {
  overflow: hidden;
  width: 100%;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip.re-thumb-strip--drag {
  cursor: grabbing;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-track {
  display: flex;
  gap: var(--re-gal-gap, 8px);
  width: -moz-max-content;
  width: max-content;
  will-change: transform;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip-nav {
  position: absolute;
  z-index: 3;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, .94);
  box-shadow: 0 1px 5px rgba(0, 0, 0, .25);
  cursor: pointer;
  display: grid;
  place-items: center;
  opacity: .92;
  transition: opacity .15s ease;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip-nav:hover {
  opacity: 1;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip-nav--off {
  display: none;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip-wrap:not(.re-thumb-strip-wrap--v) .re-thumb-strip-nav {
  top: 50%;
  transform: translateY(-50%);
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip-wrap:not(.re-thumb-strip-wrap--v) .re-thumb-strip-nav--prev {
  inset-inline-start: 4px;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip-wrap:not(.re-thumb-strip-wrap--v) .re-thumb-strip-nav--next {
  inset-inline-end: 4px;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-strip-nav {
  left: 50%;
  transform: translateX(-50%);
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-strip-nav--prev {
  top: 4px;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-strip-nav--next {
  bottom: 4px;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-gallery-item {
  flex: 0 0 var(--re-gal-thumb, 110px) !important;
  width: var(--re-gal-thumb, 110px) !important;
  height: var(--re-gal-thumb, 110px) !important;
  aspect-ratio: auto !important;
  cursor: pointer;
  opacity: .55;
  transition: opacity .15s ease;
  border-radius: 8px;
  overflow: hidden;
  margin: 0;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-gallery-item:hover {
  opacity: .85;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-gallery-item.is-active {
  opacity: 1;
  box-shadow: inset 0 0 0 3px var(--primary, #6366f1);
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-gallery-item img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  cursor: pointer;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails[data-thumb-placement=top] .re-thumb-stage {
  order: 2;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails[data-thumb-placement=top] .re-thumb-strip-wrap {
  order: 1;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails[data-thumb-placement=left], 
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails[data-thumb-placement=right] {
  display: grid !important;
  align-items: start;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails[data-thumb-placement=left] {
  grid-template-columns: var(--re-gal-thumb, 110px) 1fr !important;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails[data-thumb-placement=right] {
  grid-template-columns: 1fr var(--re-gal-thumb, 110px) !important;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails[data-thumb-placement=left] .re-thumb-stage {
  grid-column: 2;
  grid-row: 1;
  aspect-ratio: 1 / 1;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails[data-thumb-placement=right] .re-thumb-stage {
  grid-column: 1;
  grid-row: 1;
  aspect-ratio: 1 / 1;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails[data-thumb-placement=left] .re-thumb-strip-wrap {
  grid-column: 1;
  grid-row: 1;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails[data-thumb-placement=right] .re-thumb-strip-wrap {
  grid-column: 2;
  grid-row: 1;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip-wrap--v {
  align-self: stretch;
  position: relative;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-strip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: pan-x;
}
.prose[_ngcontent-%COMP%]     .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-track {
  flex-direction: column;
  width: auto;
}
.prose[_ngcontent-%COMP%]     .re-thumb-nav {
  position: absolute;
  top: 50%;
  z-index: 3;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 1px 6px rgba(0, 0, 0, .22);
  cursor: pointer;
  display: grid;
  place-items: center;
  transform: translateY(-50%);
  opacity: .9;
  transition: opacity .15s ease;
}
.prose[_ngcontent-%COMP%]     .re-thumb-nav:hover {
  opacity: 1;
}
.prose[_ngcontent-%COMP%]     .re-thumb-nav--prev {
  left: 12px;
}
.prose[_ngcontent-%COMP%]     .re-thumb-nav--next {
  right: 12px;
}
.prose[_ngcontent-%COMP%]     hr[data-divider-size=compact] {
  width: 30%;
}
.prose[_ngcontent-%COMP%]     hr[data-divider-size=standard] {
  width: 60%;
}
.prose[_ngcontent-%COMP%]     hr[data-divider-size=extended] {
  width: 90%;
}
.prose[_ngcontent-%COMP%]     hr[data-divider-align=left] {
  margin-inline: 0 auto;
}
.prose[_ngcontent-%COMP%]     hr[data-divider-align=right] {
  margin-inline: auto 0;
}
.prose[_ngcontent-%COMP%]     .re-banner[data-cols="2"] {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.prose[_ngcontent-%COMP%]     .re-banner[data-cols="3"] {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.prose[_ngcontent-%COMP%]     .re-banner[data-cols="4"] {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.prose[_ngcontent-%COMP%]     .re-product {
  margin: 32px auto;
}
.prose[_ngcontent-%COMP%]     .re-product__card {
  display: flex;
  gap: 18px;
  align-items: center;
  border: var(--rp-bw, 1px) solid var(--rp-border, var(--hair));
  border-radius: var(--rp-radius, 14px);
  padding: 16px;
  background: var(--body-bg, #fff);
}
.prose[_ngcontent-%COMP%]     .re-product[data-img-pos=top] .re-product__card {
  flex-direction: column;
  align-items: stretch;
}
.prose[_ngcontent-%COMP%]     .re-product[data-img-pos=right] .re-product__card {
  flex-direction: row-reverse;
}
.prose[_ngcontent-%COMP%]     .re-product__media {
  position: relative;
  flex: 0 0 40%;
  border-radius: 10px;
  overflow: hidden;
}
.prose[_ngcontent-%COMP%]     .re-product__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  margin: 0;
  border-radius: 10px;
}
.prose[_ngcontent-%COMP%]     .re-product__noimg {
  aspect-ratio: 1;
  background: var(--surface);
  border-radius: 10px;
}
.prose[_ngcontent-%COMP%]     .re-product__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.prose[_ngcontent-%COMP%]     .re-product__title {
  font-weight: 700;
  font-size: 18px;
}
.prose[_ngcontent-%COMP%]     .re-product__price {
  color: var(--rp-primary, var(--primary, #6366f1));
  font-weight: 700;
}
.prose[_ngcontent-%COMP%]     .re-product__btn {
  align-self: flex-start;
  display: inline-block;
  padding: 10px 22px;
  border-radius: 999px;
  background: var(--rp-primary, var(--primary, #6366f1));
  color: #fff !important;
  font-weight: 600;
  text-decoration: none;
}
.prose[_ngcontent-%COMP%]     .re-product__ribbon {
  position: absolute;
  inset-inline-start: 10px;
  inset-block-start: 10px;
  z-index: 2;
  background: var(--rp-secondary, #ef4444);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 6px;
}
.prose[_ngcontent-%COMP%]     .re-product__ribbon--info {
  position: static;
  align-self: flex-start;
}
.lb[_ngcontent-%COMP%] {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px;
  animation: _ngcontent-%COMP%_lb-in .15s ease;
}
@keyframes _ngcontent-%COMP%_lb-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.lb__stage[_ngcontent-%COMP%] {
  margin: 0;
  max-width: 90vw;
  max-height: 88vh;
  display: flex;
  overflow: hidden;
}
.lb__img[_ngcontent-%COMP%] {
  max-width: 90vw;
  max-height: 86vh;
  object-fit: contain;
  display: block;
}
.lb__img--next[_ngcontent-%COMP%] {
  animation: _ngcontent-%COMP%_lb-slide-next .28s cubic-bezier(.22, .61, .36, 1);
}
.lb__img--prev[_ngcontent-%COMP%] {
  animation: _ngcontent-%COMP%_lb-slide-prev .28s cubic-bezier(.22, .61, .36, 1);
}
@keyframes _ngcontent-%COMP%_lb-slide-next {
  from {
    opacity: 0;
    transform: translateX(48px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes _ngcontent-%COMP%_lb-slide-prev {
  from {
    opacity: 0;
    transform: translateX(-48px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.lb__bar[_ngcontent-%COMP%] {
  position: fixed;
  inset-inline: 0;
  bottom: 20px;
  display: flex;
  gap: 18px;
  align-items: center;
  justify-content: center;
  color: #2F2E2E;
  font-size: 14px;
}
.lb__count[_ngcontent-%COMP%] {
  opacity: .75;
}
.lb__dl[_ngcontent-%COMP%] {
  color: #2F2E2E;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  opacity: .85;
}
.lb__dl[_ngcontent-%COMP%]:hover {
  opacity: 1;
  text-decoration: underline;
}
.lb__btn[_ngcontent-%COMP%] {
  position: fixed;
  background: none;
  border: 0;
  cursor: pointer;
  padding: 6px;
  display: grid;
  place-items: center;
  opacity: .8;
  transition: opacity .15s ease;
}
.lb__btn[_ngcontent-%COMP%]:hover {
  opacity: 1;
}
.lb__btn[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {
  display: block;
}
.lb__expand[_ngcontent-%COMP%] {
  top: 16px;
  inset-inline-start: 20px;
}
.lb__close[_ngcontent-%COMP%] {
  top: 16px;
  inset-inline-end: 20px;
}
.lb__prev[_ngcontent-%COMP%] {
  inset-inline-start: 24px;
  top: 50%;
  transform: translateY(-50%);
}
.lb__next[_ngcontent-%COMP%] {
  inset-inline-end: 24px;
  top: 50%;
  transform: translateY(-50%);
}
.lb__prev[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%], 
.lb__next[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {
  width: 23px;
  height: 39px;
}
[dir=rtl][_ngcontent-%COMP%]   .prose[_ngcontent-%COMP%] {
  text-align: right;
}
[dir=rtl][_ngcontent-%COMP%]   .prose[_ngcontent-%COMP%]     > p:first-of-type::first-letter {
  float: right;
}
/*# sourceMappingURL=post-content.component.css.map */`], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PostContentComponent, [{
    type: Component,
    args: [{ selector: "app-post-content", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule], template: `
    <div class="prose" [innerHTML]="safe" (click)="onClick($event)" (contextmenu)="onContentMenu($event)"></div>

    @if (lb(); as box) {
      <div class="lb" role="dialog" aria-modal="true" (click)="closeLb()">
        <button type="button" class="lb__btn lb__expand" (click)="toggleFs($event)" aria-label="Full screen">
          <svg width="60" height="60" viewBox="0 0 60 60"><g fill="none" fill-rule="evenodd"><g fill="#2F2E2E"><path d="M4.333 15.167H5.413V27.084H4.333z" transform="translate(17 17) rotate(45 4.873 21.125)"/><path d="M26 8h-1V1h-7V0h8v8z" transform="translate(17 17)"/><path d="M20.583 -1.083H21.666V10.834H20.583z" transform="translate(17 17) rotate(45 21.125 4.875)"/><path d="M0 26v-8h1v7h7v1H0z" transform="translate(17 17)"/></g></g></svg>
        </button>
        <button type="button" class="lb__btn lb__close" (click)="closeLb()" aria-label="Close">
          <svg width="60" height="60" viewBox="0 0 60 60"><path fill="#2F2E2E" d="M42.188 17l.812.813L30.812 30 43 42.188l-.813.812L30 30.812 17.812 43 17 42.187 29.187 30 17 17.812l.813-.812L30 29.187 42.188 17z"/></svg>
        </button>
        @if (box.items.length > 1) {
          <button type="button" class="lb__btn lb__prev" (click)="step($event, -1)" aria-label="Previous">
            <svg width="23" height="39" viewBox="0 0 23 39" style="transform: scaleX(-1)"><path fill="#2F2E2E" d="M857.005,231.479L858.5,230l18.124,18-18.127,18-1.49-1.48L873.638,248Z" transform="translate(-855 -230)"/></svg>
          </button>
          <button type="button" class="lb__btn lb__next" (click)="step($event, 1)" aria-label="Next">
            <svg width="23" height="39" viewBox="0 0 23 39"><path fill="#2F2E2E" d="M857.005,231.479L858.5,230l18.124,18-18.127,18-1.49-1.48L873.638,248Z" transform="translate(-855 -230)"/></svg>
          </button>
        }
        <figure class="lb__stage" (click)="$event.stopPropagation()">
          @for (it of [box.items[box.index]]; track it.src) {
            <img class="lb__img"
                 [class.lb__img--next]="slideDir() >= 0"
                 [class.lb__img--prev]="slideDir() < 0"
                 [src]="it.src" [alt]="it.alt"
                 (contextmenu)="onImgMenu($event, it.download)">
          }
        </figure>
        @if (box.items.length > 1 || box.items[box.index].download) {
          <div class="lb__bar">
            @if (box.items.length > 1) { <span class="lb__count">{{ box.index + 1 }} / {{ box.items.length }}</span> }
            @if (box.items[box.index].download) {
              <a class="lb__dl" [href]="box.items[box.index].src" download target="_blank" rel="noopener" (click)="$event.stopPropagation()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2F2E2E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"/></svg>
                Download
              </a>
            }
          </div>
        }
      </div>
    }
  `, styles: [`/* angular:styles/component:css;ef6cab8bc20bbcca73046f770c7adc9470cad71b88e2bd1783bdcb790c320f7a;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/components/post-content.component.ts */
:host {
  display: block;
}
.prose {
  --ink: var(--body-text, #1a1a1a);
  --muted: color-mix(in srgb, var(--ink) 60%, transparent);
  --hair: color-mix(in srgb, var(--ink) 12%, transparent);
  --surface: color-mix(in srgb, var(--ink) 4%, transparent);
  max-width: 720px;
  margin: 0 auto;
  font-family:
    "Inter",
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    sans-serif;
  font-size: 19px;
  line-height: 1.8;
  color: var(--ink);
  letter-spacing: .003em;
}
@media (max-width: 768px) {
  .prose {
    font-size: 17px;
    line-height: 1.72;
  }
}
.prose ::ng-deep h2 {
  font-family:
    "Playfair Display",
    Georgia,
    serif;
  font-size: 32px;
  line-height: 1.22;
  margin: 56px 0 18px;
  font-weight: 700;
  letter-spacing: -.01em;
}
.prose ::ng-deep h3 {
  font-size: 23px;
  line-height: 1.3;
  margin: 40px 0 12px;
  font-weight: 700;
}
.prose ::ng-deep h4 {
  font-size: 19px;
  line-height: 1.35;
  margin: 30px 0 10px;
  font-weight: 700;
}
.prose ::ng-deep p {
  margin: 20px 0;
}
.prose ::ng-deep a {
  color: var(--primary, #6366f1);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.prose ::ng-deep a:hover {
  text-decoration: underline;
}
.prose ::ng-deep strong {
  font-weight: 700;
}
.prose ::ng-deep hr {
  border: 0;
  height: 1px;
  background: var(--hair);
  margin: 48px auto;
  width: 60%;
}
.prose ::ng-deep > p:first-of-type::first-letter {
  float: inline-start;
  font-family:
    "Playfair Display",
    Georgia,
    serif;
  font-size: 4.2em;
  line-height: .82;
  font-weight: 700;
  margin-inline-end: .08em;
  margin-block-start: .05em;
  color: var(--primary, #6366f1);
}
.prose ::ng-deep ul,
.prose ::ng-deep ol {
  padding-inline-start: 26px;
  margin: 20px 0;
}
.prose ::ng-deep li {
  margin: 8px 0;
  padding-inline-start: 4px;
}
.prose ::ng-deep li::marker {
  color: var(--primary, #6366f1);
}
.prose ::ng-deep blockquote {
  border-inline-start: 3px solid var(--primary, #6366f1);
  padding: 2px 22px;
  margin: 32px 0;
  font-family:
    "Playfair Display",
    Georgia,
    serif;
  font-size: 24px;
  line-height: 1.45;
  font-style: italic;
  color: var(--ink);
}
.prose ::ng-deep blockquote p {
  margin: 8px 0;
}
.prose ::ng-deep figure.re-quote,
.prose ::ng-deep .re-pullquote {
  background: var(--ink);
  color: var(--body-bg, #fff);
  border-radius: 14px;
  padding: 28px 30px;
  margin: 36px 0;
  border: 0;
}
.prose ::ng-deep figure.re-quote blockquote,
.prose ::ng-deep .re-pullquote blockquote {
  border: 0;
  padding: 0;
  margin: 0;
  color: inherit;
  font-size: 26px;
  font-weight: 600;
  font-style: normal;
}
.prose ::ng-deep figure.re-quote figcaption,
.prose ::ng-deep .re-pullquote figcaption {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: "Inter", sans-serif;
  font-size: 14px;
  font-style: normal;
  opacity: .85;
  text-align: start;
}
.prose ::ng-deep img {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  display: block;
}
.prose ::ng-deep figure {
  margin: 36px 0;
}
.prose ::ng-deep figure img {
  margin: 0 auto;
}
.prose ::ng-deep figcaption {
  font-size: 13.5px;
  color: var(--muted);
  text-align: center;
  margin-top: 10px;
  font-style: italic;
}
.prose ::ng-deep div:has(> .re-gallery-item):not(.re-gal-track):not(.re-thumb-track):not(.re-gallery--thumbnails):not(.re-gallery--columns):not(.re-gallery--panorama) {
  display: grid;
  grid-template-columns: repeat(var(--re-gal-cols, 3), minmax(0, 1fr));
  gap: var(--re-gal-gap, 8px);
  margin: 32px 0;
}
.prose ::ng-deep div:has(> .re-gallery-item):not([style*=--re-gal-cols]):not(.re-gal-track):not(.re-thumb-track):not(.re-gallery--thumbnails):not(.re-gallery--columns):not(.re-gallery--panorama) {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}
.prose ::ng-deep .re-gallery-item {
  margin: 0;
  overflow: hidden;
  border-radius: 10px;
}
.prose ::ng-deep .re-gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
  margin: 0;
  aspect-ratio: var(--re-gal-ratio, auto);
}
.prose ::ng-deep .re-embed-figure,
.prose ::ng-deep .re-embed-card {
  margin: 36px 0;
}
.prose ::ng-deep .re-embed-video {
  position: relative;
  aspect-ratio: 16/9;
  border-radius: 12px;
  overflow: hidden;
  background: #000;
}
.prose ::ng-deep .re-embed-video iframe,
.prose ::ng-deep .re-embed-video video,
.prose ::ng-deep iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 12px;
}
.prose ::ng-deep .re-embed-card {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 16px;
  border: 1px solid var(--hair);
  border-radius: 14px;
  text-decoration: none;
  color: inherit;
}
.prose ::ng-deep .re-embed-caption {
  font-size: 13.5px;
  color: var(--muted);
  margin-top: 10px;
  text-align: center;
}
.prose ::ng-deep .re-banner {
  display: grid;
  grid-template-columns: repeat(var(--re-banner-cols, 1), minmax(0, 1fr));
  gap: 0;
  margin: 40px 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--hair);
  background: var(--surface);
}
.prose ::ng-deep .re-banner-col,
.prose ::ng-deep .re-banner-cell {
  padding: 28px 30px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  background-size: cover;
  background-position: center;
  min-height: 120px;
}
.prose ::ng-deep .re-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 0;
}
@media (max-width: 640px) {
  .prose ::ng-deep .re-banner {
    grid-template-columns: 1fr;
  }
}
.prose ::ng-deep .re-btn-block {
  margin: 28px 0;
  text-align: center;
}
.prose ::ng-deep .re-btn-block a,
.prose ::ng-deep a.re-btn {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 999px;
  background: var(--primary, #6366f1);
  color: #fff !important;
  font-weight: 600;
  text-decoration: none;
  transition: filter .15s ease;
}
.prose ::ng-deep .re-btn-block a:hover {
  filter: brightness(1.08);
  text-decoration: none;
}
.prose ::ng-deep .re-expand {
  border: 0;
  background: transparent;
  border-radius: 0;
  margin: 4px 0;
  overflow: visible;
}
.prose ::ng-deep .re-expand-group {
  margin: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.prose ::ng-deep .re-expand__head {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-start;
  padding: 8px 0;
  font-weight: 600;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
}
.prose ::ng-deep .re-expand__drag,
.prose ::ng-deep .re-expand__chev,
.prose ::ng-deep .re-expand__add {
  display: none !important;
}
.prose ::ng-deep .re-expand__head::before {
  content: "\\203a";
  order: -1;
  flex: none;
  display: inline-block;
  width: 14px;
  text-align: center;
  font-size: 20px;
  line-height: 1;
  color: var(--muted);
  transition: transform .2s ease;
}
.prose ::ng-deep .re-expand[data-open=true] .re-expand__head::before {
  transform: rotate(90deg);
}
.prose ::ng-deep .re-expand__title {
  flex: 0 1 auto;
  text-align: start;
  min-width: 0;
  font-weight: 600;
}
.prose ::ng-deep .re-expand:not([data-open=true]) .re-expand__body {
  display: none;
}
.prose ::ng-deep .re-expand__body {
  padding: 2px 0 8px 24px;
  color: var(--ink);
}
.prose ::ng-deep .re-poll {
  border: 1px solid var(--hair);
  border-radius: 16px;
  padding: 22px;
  margin: 32px 0;
  background: var(--surface);
}
.prose ::ng-deep .re-poll__q {
  font-weight: 700;
  font-size: 18px;
  margin-bottom: 14px;
}
.prose ::ng-deep .re-poll__ans {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin: 8px 0;
  border: 1px solid var(--hair);
  border-radius: 10px;
  background: var(--body-bg, #fff);
  cursor: pointer;
  transition: border-color .15s ease;
}
.prose ::ng-deep .re-poll__ans:hover {
  border-color: var(--primary, #6366f1);
}
.prose ::ng-deep .re-poll__ans-remove,
.prose ::ng-deep .re-poll__add {
  display: none;
}
.prose ::ng-deep table {
  width: 100%;
  border-collapse: collapse;
  margin: 32px 0;
  font-size: 16px;
  border: 1px solid var(--hair);
  border-radius: 12px;
  overflow: hidden;
}
.prose ::ng-deep th,
.prose ::ng-deep td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--hair);
  text-align: start;
}
.prose ::ng-deep th {
  background: var(--surface);
  font-weight: 700;
}
.prose ::ng-deep tr:last-child td {
  border-bottom: 0;
}
.prose ::ng-deep pre {
  background: #0f172a;
  color: #e2e8f0;
  padding: 18px 20px;
  border-radius: 12px;
  overflow-x: auto;
  font-size: 14px;
  margin: 28px 0;
  line-height: 1.6;
}
.prose ::ng-deep code {
  font-family:
    "SF Mono",
    Menlo,
    Consolas,
    monospace;
  background: var(--surface);
  padding: 2px 6px;
  border-radius: 5px;
  font-size: .88em;
}
.prose ::ng-deep pre code {
  background: transparent;
  padding: 0;
  color: inherit;
}
.prose ::ng-deep .blog-hashtag {
  color: var(--primary, #6366f1);
  font-weight: 500;
  text-decoration: none;
}
.prose ::ng-deep .blog-hashtag:hover {
  text-decoration: underline;
}
.prose ::ng-deep figure.re-embed-figure {
  margin: 36px auto;
}
.prose ::ng-deep .re-size-compact {
  width: 55%;
}
.prose ::ng-deep .re-size-standard {
  width: 100%;
}
.prose ::ng-deep .re-size-original {
  width: -moz-fit-content;
  width: fit-content;
}
.prose ::ng-deep .re-size-extended {
  width: calc(100% + 140px);
  max-width: calc(100% + 140px);
  margin-inline: -70px;
}
.prose ::ng-deep .re-align-left {
  margin-inline: 0 auto;
}
.prose ::ng-deep .re-align-center {
  margin-inline: auto;
}
.prose ::ng-deep .re-align-right {
  margin-inline: auto 0;
}
.prose ::ng-deep figure.re-embed-figure img,
.prose ::ng-deep .re-gallery img {
  cursor: zoom-in;
}
.prose ::ng-deep [data-click-expand=false] img {
  cursor: default;
}
.prose ::ng-deep figure.re-embed-figure:not([data-click-expand=false]) {
  position: relative;
}
.prose ::ng-deep figure.re-embed-figure:not([data-click-expand=false])::after {
  content: "";
  position: absolute;
  top: 12px;
  inset-inline-end: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, .92);
  background-repeat: no-repeat;
  background-position: center;
  background-size: 17px;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 19 19' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='%232F2E2E' fill-rule='nonzero' d='M15.071 8.371V4.585l-4.355 4.356a.2.2 0 0 1-.283 0l-.374-.374a.2.2 0 0 1 0-.283l4.356-4.355h-3.786a.2.2 0 0 1-.2-.2V3.2c0-.11.09-.2.2-.2H16v5.371a.2.2 0 0 1-.2.2h-.529a.2.2 0 0 1-.2-.2zm-6.5 6.9v.529a.2.2 0 0 1-.2.2H3v-5.371c0-.11.09-.2.2-.2h.529c.11 0 .2.09.2.2v3.786l4.355-4.356a.2.2 0 0 1 .283 0l.374.374a.2.2 0 0 1 0 .283L4.585 15.07h3.786c.11 0 .2.09.2.2z'/%3E%3C/svg%3E");
  box-shadow: 0 2px 8px rgba(0, 0, 0, .15);
  opacity: 0;
  transition: opacity .15s ease;
  pointer-events: none;
}
.prose ::ng-deep figure.re-embed-figure:not([data-click-expand=false]):hover::after {
  opacity: 1;
}
.prose ::ng-deep figure.re-embed-figure:has(.re-gallery--thumbnails)::after,
.prose ::ng-deep figure.re-embed-figure:has(.re-gallery--slideshow)::after {
  content: none !important;
}
.prose ::ng-deep .re-thumb-expand {
  position: absolute;
  top: 12px;
  inset-inline-end: 12px;
  z-index: 4;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 0;
  padding: 0;
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 2px 8px rgba(0, 0, 0, .15);
  cursor: pointer;
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity .15s ease;
}
.prose ::ng-deep .re-thumb-stage:hover .re-thumb-expand {
  opacity: 1;
}
@media (max-width: 768px) {
  .prose ::ng-deep .re-size-compact,
  .prose ::ng-deep .re-size-extended {
    width: 100%;
    max-width: 100%;
    margin-inline: 0;
  }
}
.prose ::ng-deep .re-gallery {
  display: grid;
  grid-template-columns: repeat(var(--re-gal-cols, 3), minmax(0, 1fr));
  gap: var(--re-gal-gap, 8px);
}
.prose ::ng-deep .re-gallery .re-gallery-item {
  margin: 0;
  border-radius: 10px;
  overflow: hidden;
}
.prose ::ng-deep .re-gallery .re-gallery-item img {
  width: 100%;
  height: 100%;
  display: block;
  margin: 0;
  border-radius: 10px;
  object-fit: cover;
  aspect-ratio: var(--re-gal-ratio, 1 / 1);
}
.prose ::ng-deep .re-gallery[data-crop=fit] .re-gallery-item img {
  object-fit: contain;
}
.prose ::ng-deep .re-gallery.re-gallery--masonry {
  display: block;
  column-count: var(--re-gal-cols, 3);
  column-gap: var(--re-gal-gap, 8px);
}
.prose ::ng-deep .re-gallery.re-gallery--masonry .re-gallery-item {
  break-inside: avoid;
  margin: 0 0 var(--re-gal-gap, 8px);
}
.prose ::ng-deep .re-gallery.re-gallery--masonry .re-gallery-item img {
  height: auto;
  aspect-ratio: auto;
}
.prose ::ng-deep .re-gallery.re-gallery--columns {
  display: flex;
  gap: var(--re-gal-gap, 8px);
  height: var(--re-gal-row-h, 420px);
  overflow-x: auto;
  column-count: initial;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.prose ::ng-deep .re-gallery.re-gallery--columns::-webkit-scrollbar {
  display: none;
}
.prose ::ng-deep .re-gallery--columns .re-gallery-item {
  flex: 0 0 var(--re-gal-col-w, 200px);
  height: 100%;
  margin: 0;
  border-radius: 10px;
  overflow: hidden;
}
.prose ::ng-deep .re-gallery--columns .re-gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  aspect-ratio: auto;
  border-radius: 10px;
}
.prose ::ng-deep .re-gal-swiper.re-gallery--columns .re-gallery-item img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
.prose ::ng-deep .re-gallery.re-gallery--collage {
  display: block;
  column-count: initial;
  grid-template-columns: none;
  columns: var(--re-gal-col-w, 240px) auto;
  column-gap: var(--re-gal-gap, 6px);
}
.prose ::ng-deep .re-gallery.re-gallery--collage .re-gallery-item {
  break-inside: avoid;
  margin: 0 0 var(--re-gal-gap, 6px);
  width: 100%;
  grid-column: auto;
  grid-row: auto;
  border-radius: 10px;
  overflow: hidden;
}
.prose ::ng-deep .re-gallery.re-gallery--collage .re-gallery-item img {
  width: 100%;
  height: auto;
  object-fit: cover;
  aspect-ratio: auto;
  border-radius: 10px;
}
.prose ::ng-deep .re-gallery.re-gallery--collage[data-scroll-dir=horizontal] {
  display: flex;
  flex-wrap: nowrap;
  columns: auto;
  gap: var(--re-gal-gap, 6px);
  overflow-x: auto;
  height: var(--re-gal-row-h, 420px);
  -webkit-overflow-scrolling: touch;
}
.prose ::ng-deep .re-gallery.re-gallery--collage[data-scroll-dir=horizontal] .re-gallery-item {
  flex: 0 0 auto;
  height: 100%;
  width: auto;
  margin: 0;
  break-inside: auto;
}
.prose ::ng-deep .re-gallery.re-gallery--collage[data-scroll-dir=horizontal] .re-gallery-item img {
  height: 100%;
  width: auto;
  object-fit: cover;
  aspect-ratio: auto;
}
.prose ::ng-deep .re-gallery.re-gallery--collage[data-orientation=horizontal]:not([data-scroll-dir=horizontal]) {
  display: flex;
  flex-wrap: wrap;
  columns: auto;
  gap: var(--re-gal-gap, 6px);
  align-content: flex-start;
}
.prose ::ng-deep .re-gallery.re-gallery--collage[data-orientation=horizontal]:not([data-scroll-dir=horizontal]) .re-gallery-item {
  flex: 0 0 auto;
  width: auto;
  height: auto;
  margin: 0;
  break-inside: auto;
}
.prose ::ng-deep .re-gallery.re-gallery--collage[data-orientation=horizontal]:not([data-scroll-dir=horizontal]) .re-gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  aspect-ratio: auto;
}
.prose ::ng-deep .re-gallery.re-gallery--slider,
.prose ::ng-deep .re-gallery.re-gallery--carousel {
  display: flex;
  gap: var(--re-gal-gap, 8px);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 6px;
}
.prose ::ng-deep .re-gallery.re-gallery--slider .re-gallery-item,
.prose ::ng-deep .re-gallery.re-gallery--carousel .re-gallery-item {
  flex: 0 0 auto;
  width: clamp(220px, 46%, 460px);
  scroll-snap-align: start;
}
.prose ::ng-deep .re-gallery.re-gallery--slider .re-gallery-item img,
.prose ::ng-deep .re-gallery.re-gallery--carousel .re-gallery-item img {
  aspect-ratio: var(--re-gal-ratio, 4 / 3);
}
.prose ::ng-deep .re-gallery.re-gallery--panorama {
  display: flex !important;
  flex-direction: column;
  gap: var(--re-gal-gap, 8px);
  grid-template-columns: none !important;
  overflow: visible;
}
.prose ::ng-deep .re-gallery--panorama .re-gallery-item {
  flex: 0 0 auto;
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
}
.prose ::ng-deep .re-gallery--panorama .re-gallery-item img {
  width: 100%;
  height: auto;
  object-fit: cover;
  aspect-ratio: auto;
  border-radius: 10px;
  display: block;
}
.prose ::ng-deep .re-gal-wrap {
  position: relative;
}
.prose ::ng-deep .re-gal-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  padding: 8px;
  display: grid;
  place-items: center;
  cursor: pointer;
  border: 0;
  background: none;
  opacity: .85;
  transition: opacity .15s ease;
}
.prose ::ng-deep .re-gal-arrow:hover {
  opacity: 1;
}
.prose ::ng-deep .re-gal-arrow svg {
  display: block;
  filter: drop-shadow(0 1px 0px rgba(255, 255, 255, .8));
}
.prose ::ng-deep .re-gal-arrow--prev {
  inset-inline-start: 12px;
}
.prose ::ng-deep .re-gal-arrow--next {
  inset-inline-end: 12px;
}
.prose ::ng-deep .re-gal-arrow--off {
  display: none;
}
.prose ::ng-deep .re-gal-swiper {
  display: block !important;
  overflow: hidden !important;
  position: relative;
  columns: auto !important;
  column-count: auto !important;
  column-width: auto !important;
  grid-template-columns: none !important;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
}
.prose ::ng-deep .re-gal-swiper.re-gal-dragging {
  cursor: grabbing;
}
.prose ::ng-deep .re-gal-track {
  display: flex !important;
  flex-wrap: nowrap !important;
  align-items: stretch;
  gap: var(--re-gal-gap, 6px);
  width: -moz-max-content;
  width: max-content;
  will-change: transform;
}
.prose ::ng-deep .re-gal-swiper.re-gallery--collage .re-gallery-item img {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
}
.prose ::ng-deep .re-gallery--slideshow,
.prose ::ng-deep .re-gallery--carousel,
.prose ::ng-deep .re-gallery--slider,
.prose ::ng-deep .re-gallery--collage[data-scroll-dir=horizontal] {
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.prose ::ng-deep .re-gallery--slideshow::-webkit-scrollbar,
.prose ::ng-deep .re-gallery--carousel::-webkit-scrollbar,
.prose ::ng-deep .re-gallery--slider::-webkit-scrollbar,
.prose ::ng-deep .re-gallery--collage[data-scroll-dir=horizontal]::-webkit-scrollbar {
  display: none;
}
.prose ::ng-deep .re-gallery--slideshow .re-gallery-item,
.prose ::ng-deep .re-gallery--carousel .re-gallery-item,
.prose ::ng-deep .re-gallery--slider .re-gallery-item,
.prose ::ng-deep .re-gallery--collage[data-scroll-dir=horizontal] .re-gallery-item {
  scroll-snap-align: start;
}
.prose ::ng-deep .re-gallery.re-gallery--slideshow {
  display: flex;
  gap: 0;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  border-radius: 12px;
}
.prose ::ng-deep .re-gallery.re-gallery--slideshow .re-gallery-item {
  flex: 0 0 100%;
  scroll-snap-align: center;
  border-radius: 0;
}
.prose ::ng-deep .re-gallery.re-gallery--slideshow .re-gallery-item img {
  aspect-ratio: var(--re-gal-ratio, 16 / 9);
  object-fit: cover;
  border-radius: 0;
}
.prose ::ng-deep .re-gallery.re-gallery--thumbnails {
  --re-gal-thumb: 110px;
  display: flex !important;
  flex-wrap: wrap !important;
  grid-template-columns: none !important;
  gap: var(--re-gal-gap, 8px);
  position: relative;
}
.prose ::ng-deep .re-gallery.re-gallery--slideshow {
  display: block !important;
  position: relative;
}
.prose ::ng-deep .re-thumb-stage {
  flex: 0 0 100%;
  order: 1;
  position: relative;
  aspect-ratio: 16 / 9;
  min-width: 0;
  border-radius: 12px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
}
.prose ::ng-deep .re-thumb-stage.re-thumb-dragging {
  cursor: grabbing;
}
.prose ::ng-deep .re-thumb-stage-track {
  display: flex;
  flex-wrap: nowrap;
  width: 100%;
  height: 100%;
  will-change: transform;
}
.prose ::ng-deep .re-thumb-slide {
  flex: 0 0 100%;
  height: 100%;
}
.prose ::ng-deep .re-thumb-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap {
  flex: 0 0 100%;
  order: 2;
  position: relative;
  min-width: 0;
  max-width: 100%;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip {
  overflow: hidden;
  width: 100%;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip.re-thumb-strip--drag {
  cursor: grabbing;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-track {
  display: flex;
  gap: var(--re-gal-gap, 8px);
  width: -moz-max-content;
  width: max-content;
  will-change: transform;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-nav {
  position: absolute;
  z-index: 3;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, .94);
  box-shadow: 0 1px 5px rgba(0, 0, 0, .25);
  cursor: pointer;
  display: grid;
  place-items: center;
  opacity: .92;
  transition: opacity .15s ease;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-nav:hover {
  opacity: 1;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-nav--off {
  display: none;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap:not(.re-thumb-strip-wrap--v) .re-thumb-strip-nav {
  top: 50%;
  transform: translateY(-50%);
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap:not(.re-thumb-strip-wrap--v) .re-thumb-strip-nav--prev {
  inset-inline-start: 4px;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap:not(.re-thumb-strip-wrap--v) .re-thumb-strip-nav--next {
  inset-inline-end: 4px;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-strip-nav {
  left: 50%;
  transform: translateX(-50%);
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-strip-nav--prev {
  top: 4px;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-strip-nav--next {
  bottom: 4px;
}
.prose ::ng-deep .re-gallery--thumbnails .re-gallery-item {
  flex: 0 0 var(--re-gal-thumb, 110px) !important;
  width: var(--re-gal-thumb, 110px) !important;
  height: var(--re-gal-thumb, 110px) !important;
  aspect-ratio: auto !important;
  cursor: pointer;
  opacity: .55;
  transition: opacity .15s ease;
  border-radius: 8px;
  overflow: hidden;
  margin: 0;
}
.prose ::ng-deep .re-gallery--thumbnails .re-gallery-item:hover {
  opacity: .85;
}
.prose ::ng-deep .re-gallery--thumbnails .re-gallery-item.is-active {
  opacity: 1;
  box-shadow: inset 0 0 0 3px var(--primary, #6366f1);
}
.prose ::ng-deep .re-gallery--thumbnails .re-gallery-item img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  cursor: pointer;
}
.prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement=top] .re-thumb-stage {
  order: 2;
}
.prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement=top] .re-thumb-strip-wrap {
  order: 1;
}
.prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement=left],
.prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement=right] {
  display: grid !important;
  align-items: start;
}
.prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement=left] {
  grid-template-columns: var(--re-gal-thumb, 110px) 1fr !important;
}
.prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement=right] {
  grid-template-columns: 1fr var(--re-gal-thumb, 110px) !important;
}
.prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement=left] .re-thumb-stage {
  grid-column: 2;
  grid-row: 1;
  aspect-ratio: 1 / 1;
}
.prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement=right] .re-thumb-stage {
  grid-column: 1;
  grid-row: 1;
  aspect-ratio: 1 / 1;
}
.prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement=left] .re-thumb-strip-wrap {
  grid-column: 1;
  grid-row: 1;
}
.prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement=right] .re-thumb-strip-wrap {
  grid-column: 2;
  grid-row: 1;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap--v {
  align-self: stretch;
  position: relative;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-strip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: pan-x;
}
.prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-track {
  flex-direction: column;
  width: auto;
}
.prose ::ng-deep .re-thumb-nav {
  position: absolute;
  top: 50%;
  z-index: 3;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 1px 6px rgba(0, 0, 0, .22);
  cursor: pointer;
  display: grid;
  place-items: center;
  transform: translateY(-50%);
  opacity: .9;
  transition: opacity .15s ease;
}
.prose ::ng-deep .re-thumb-nav:hover {
  opacity: 1;
}
.prose ::ng-deep .re-thumb-nav--prev {
  left: 12px;
}
.prose ::ng-deep .re-thumb-nav--next {
  right: 12px;
}
.prose ::ng-deep hr[data-divider-size=compact] {
  width: 30%;
}
.prose ::ng-deep hr[data-divider-size=standard] {
  width: 60%;
}
.prose ::ng-deep hr[data-divider-size=extended] {
  width: 90%;
}
.prose ::ng-deep hr[data-divider-align=left] {
  margin-inline: 0 auto;
}
.prose ::ng-deep hr[data-divider-align=right] {
  margin-inline: auto 0;
}
.prose ::ng-deep .re-banner[data-cols="2"] {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.prose ::ng-deep .re-banner[data-cols="3"] {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.prose ::ng-deep .re-banner[data-cols="4"] {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.prose ::ng-deep .re-product {
  margin: 32px auto;
}
.prose ::ng-deep .re-product__card {
  display: flex;
  gap: 18px;
  align-items: center;
  border: var(--rp-bw, 1px) solid var(--rp-border, var(--hair));
  border-radius: var(--rp-radius, 14px);
  padding: 16px;
  background: var(--body-bg, #fff);
}
.prose ::ng-deep .re-product[data-img-pos=top] .re-product__card {
  flex-direction: column;
  align-items: stretch;
}
.prose ::ng-deep .re-product[data-img-pos=right] .re-product__card {
  flex-direction: row-reverse;
}
.prose ::ng-deep .re-product__media {
  position: relative;
  flex: 0 0 40%;
  border-radius: 10px;
  overflow: hidden;
}
.prose ::ng-deep .re-product__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  margin: 0;
  border-radius: 10px;
}
.prose ::ng-deep .re-product__noimg {
  aspect-ratio: 1;
  background: var(--surface);
  border-radius: 10px;
}
.prose ::ng-deep .re-product__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.prose ::ng-deep .re-product__title {
  font-weight: 700;
  font-size: 18px;
}
.prose ::ng-deep .re-product__price {
  color: var(--rp-primary, var(--primary, #6366f1));
  font-weight: 700;
}
.prose ::ng-deep .re-product__btn {
  align-self: flex-start;
  display: inline-block;
  padding: 10px 22px;
  border-radius: 999px;
  background: var(--rp-primary, var(--primary, #6366f1));
  color: #fff !important;
  font-weight: 600;
  text-decoration: none;
}
.prose ::ng-deep .re-product__ribbon {
  position: absolute;
  inset-inline-start: 10px;
  inset-block-start: 10px;
  z-index: 2;
  background: var(--rp-secondary, #ef4444);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 6px;
}
.prose ::ng-deep .re-product__ribbon--info {
  position: static;
  align-self: flex-start;
}
.lb {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px;
  animation: lb-in .15s ease;
}
@keyframes lb-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.lb__stage {
  margin: 0;
  max-width: 90vw;
  max-height: 88vh;
  display: flex;
  overflow: hidden;
}
.lb__img {
  max-width: 90vw;
  max-height: 86vh;
  object-fit: contain;
  display: block;
}
.lb__img--next {
  animation: lb-slide-next .28s cubic-bezier(.22, .61, .36, 1);
}
.lb__img--prev {
  animation: lb-slide-prev .28s cubic-bezier(.22, .61, .36, 1);
}
@keyframes lb-slide-next {
  from {
    opacity: 0;
    transform: translateX(48px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes lb-slide-prev {
  from {
    opacity: 0;
    transform: translateX(-48px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.lb__bar {
  position: fixed;
  inset-inline: 0;
  bottom: 20px;
  display: flex;
  gap: 18px;
  align-items: center;
  justify-content: center;
  color: #2F2E2E;
  font-size: 14px;
}
.lb__count {
  opacity: .75;
}
.lb__dl {
  color: #2F2E2E;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  opacity: .85;
}
.lb__dl:hover {
  opacity: 1;
  text-decoration: underline;
}
.lb__btn {
  position: fixed;
  background: none;
  border: 0;
  cursor: pointer;
  padding: 6px;
  display: grid;
  place-items: center;
  opacity: .8;
  transition: opacity .15s ease;
}
.lb__btn:hover {
  opacity: 1;
}
.lb__btn svg {
  display: block;
}
.lb__expand {
  top: 16px;
  inset-inline-start: 20px;
}
.lb__close {
  top: 16px;
  inset-inline-end: 20px;
}
.lb__prev {
  inset-inline-start: 24px;
  top: 50%;
  transform: translateY(-50%);
}
.lb__next {
  inset-inline-end: 24px;
  top: 50%;
  transform: translateY(-50%);
}
.lb__prev svg,
.lb__next svg {
  width: 23px;
  height: 39px;
}
[dir=rtl] .prose {
  text-align: right;
}
[dir=rtl] .prose ::ng-deep > p:first-of-type::first-letter {
  float: right;
}
/*# sourceMappingURL=post-content.component.css.map */
`] }]
  }], null, { html: [{
    type: Input,
    args: [{ required: true }]
  }], lang: [{
    type: Input,
    args: [{ required: true }]
  }], onKey: [{
    type: HostListener,
    args: ["document:keydown", ["$event"]]
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(PostContentComponent, { className: "PostContentComponent", filePath: "src/app/features/blog/components/post-content.component.ts", lineNumber: 650 });
})();

// src/app/features/blog/components/related-posts.component.ts
var _forTrack02 = ($index, $item) => $item.id;
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
    \u0275\u0275repeaterCreate(4, RelatedPostsComponent_Conditional_0_For_5_Template, 1, 3, "app-post-card", 2, _forTrack02);
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
var _c02 = (a0) => ({ name: a0 });
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
    \u0275\u0275property("routerLink", ctx_r0.blogLink("authors", ctx_r0.author.id));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r0.t(ctx_r0.lang, "read_more_by", \u0275\u0275pureFunction1(2, _c02, ctx_r0.author.name)), " ");
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
    \u0275\u0275conditionalCreate(7, AuthorCardComponent_Conditional_0_Conditional_7_Template, 2, 4, "a", 5);
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
    this.settings = inject(BlogSettingsService);
    this.author = null;
    this.lang = "en";
    this.t = t;
    this.blogLink = (...segments) => this.settings.blogLink(this.lang, ...segments);
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
            <a [routerLink]="blogLink('authors', author.id)" class="btn">
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
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(AuthorCardComponent, { className: "AuthorCardComponent", filePath: "src/app/features/blog/components/author-card.component.ts", lineNumber: 57 });
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
var _forTrack03 = ($index, $item) => $item.id;
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
    \u0275\u0275repeaterCreate(1, CommentItemComponent_Conditional_15_For_2_Template, 1, 5, "app-comment-item", 18, _forTrack03);
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
var _c03 = (a0) => ({ n: a0 });
var _c1 = (a0) => ({ name: a0 });
var _forTrack04 = ($index, $item) => $item.id;
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
    \u0275\u0275textInterpolate1(" ", ctx_r1.t(ctx_r1.lang, "reply_to", \u0275\u0275pureFunction1(2, _c1, ctx_r1.replyTo().author.name)), " ");
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
    \u0275\u0275repeaterCreate(1, CommentSectionComponent_Conditional_0_Conditional_16_For_2_Template, 1, 4, "app-comment-item", 20, _forTrack04);
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
    \u0275\u0275textInterpolate(ctx_r1.t(ctx_r1.lang, "comments_count", \u0275\u0275pureFunction1(7, _c03, ctx_r1.formatNumber(ctx_r1.lang, ctx_r1.totalCount()))));
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
    const walk2 = (n) => (Array.isArray(n) ? n : []).reduce((sum, x) => sum + (x.isDeleted ? 0 : 1) + walk2(x.replies), 0);
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
        const res = yield this.api.listPostComments(this.postId, this.lang);
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        this.comments.set(list);
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
var _forTrack05 = ($index, $item) => $item.id;
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
    \u0275\u0275property("routerLink", ctx_r0.blogLink());
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
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "a", 12);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const cat_r4 = ctx;
    const ctx_r0 = \u0275\u0275nextContext(4);
    \u0275\u0275property("routerLink", ctx_r0.blogLink("category", cat_r4.slug));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(cat_r4.name);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_9_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "img", 27);
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext(2);
    \u0275\u0275property("src", p_r3.author.image, \u0275\u0275sanitizeUrl);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_9_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "a", 28);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext(2);
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275property("routerLink", ctx_r0.blogLink("authors", p_r3.author.id));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(p_r3.author.name);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_9_Conditional_3_Template(rf, ctx) {
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
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_9_Conditional_4_Template(rf, ctx) {
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
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 14);
    \u0275\u0275conditionalCreate(1, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_9_Conditional_1_Template, 1, 1, "img", 27);
    \u0275\u0275conditionalCreate(2, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_9_Conditional_2_Template, 2, 2, "a", 28)(3, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_9_Conditional_3_Template, 2, 1, "span");
    \u0275\u0275conditionalCreate(4, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_9_Conditional_4_Template, 2, 1, "span", 29);
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
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_10_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "time", 15);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext();
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275attribute("datetime", p_r3.publishDate);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r0.formatDate(ctx_r0.lang(), p_r3.publishDate));
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_11_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 16);
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
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_12_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "span", 17);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext();
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1("\u{1F4AC} ", ctx_r0.formatNumber(ctx_r0.lang(), p_r3.commentsCount));
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_15_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "a", 30);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const tagRef_r5 = ctx.$implicit;
    const ctx_r0 = \u0275\u0275nextContext(5);
    \u0275\u0275property("routerLink", ctx_r0.blogLink("tag", tagRef_r5.slug));
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(tagRef_r5.name);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_15_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 19);
    \u0275\u0275repeaterCreate(1, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_15_For_2_Template, 2, 2, "a", 30, _forTrack05);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275repeater(p_r3.tags);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_16_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "figure", 20);
    \u0275\u0275element(1, "img", 31);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r3 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275property("src", p_r3.coverImage, \u0275\u0275sanitizeUrl)("alt", "Cover image for " + p_r3.title);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_17_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "div", 21);
  }
}
function PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_19_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 23);
    \u0275\u0275element(1, "app-share-buttons", 32);
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
    \u0275\u0275element(0, "app-related-posts", 25);
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
    \u0275\u0275elementStart(4, "header", 11);
    \u0275\u0275conditionalCreate(5, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_5_Template, 2, 2, "a", 12);
    \u0275\u0275elementStart(6, "h1");
    \u0275\u0275text(7);
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(8, "div", 13);
    \u0275\u0275conditionalCreate(9, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_9_Template, 5, 3, "span", 14);
    \u0275\u0275conditionalCreate(10, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_10_Template, 2, 2, "time", 15);
    \u0275\u0275conditionalCreate(11, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_11_Template, 2, 2, "span", 16);
    \u0275\u0275conditionalCreate(12, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_12_Template, 2, 1, "span", 17);
    \u0275\u0275elementStart(13, "span", 18);
    \u0275\u0275text(14);
    \u0275\u0275elementEnd()();
    \u0275\u0275conditionalCreate(15, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_15_Template, 3, 0, "div", 19);
    \u0275\u0275elementEnd();
    \u0275\u0275conditionalCreate(16, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_16_Template, 2, 2, "figure", 20)(17, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_17_Template, 1, 0, "div", 21);
    \u0275\u0275element(18, "app-post-content", 22);
    \u0275\u0275conditionalCreate(19, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_19_Template, 2, 3, "div", 23);
    \u0275\u0275element(20, "app-author-card", 24);
    \u0275\u0275conditionalCreate(21, PostPage_Conditional_0_Conditional_5_Conditional_0_Conditional_21_Template, 1, 3, "app-related-posts", 25);
    \u0275\u0275element(22, "app-comment-section", 26);
  }
  if (rf & 2) {
    let tmp_7_0;
    const p_r3 = ctx;
    const ctx_r0 = \u0275\u0275nextContext(3);
    \u0275\u0275advance();
    \u0275\u0275property("crumbs", ctx_r0.crumbs());
    \u0275\u0275advance();
    \u0275\u0275conditional(p_r3.availableLanguages.length > 1 ? 2 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(p_r3.wasFallback ? 3 : -1);
    \u0275\u0275advance(2);
    \u0275\u0275conditional((tmp_7_0 = ctx_r0.display().showCategoryLabel && p_r3.mainCategory) ? 5 : -1, tmp_7_0);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(p_r3.title);
    \u0275\u0275advance(2);
    \u0275\u0275conditional(ctx_r0.display().showAuthor && p_r3.author ? 9 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.display().showDate ? 10 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.display().showReadingTime && p_r3.readingTime > 0 ? 11 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.display().showCommentCount && p_r3.commentsCount > 0 ? 12 : -1);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate1("\u{1F441} ", ctx_r0.formatNumber(ctx_r0.lang(), p_r3.views));
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.display().showTags && p_r3.tags.length ? 15 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(p_r3.coverImage ? 16 : 17);
    \u0275\u0275advance(2);
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
    \u0275\u0275conditionalCreate(2, PostPage_Conditional_0_Conditional_2_Template, 2, 0, "p", 2)(3, PostPage_Conditional_0_Conditional_3_Template, 7, 4, "div", 3)(4, PostPage_Conditional_0_Conditional_4_Template, 1, 2, "app-error-banner", 4)(5, PostPage_Conditional_0_Conditional_5_Template, 1, 1);
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
    this.blogLink = (...segments) => this.settingsSvc.blogLink(this.lang(), ...segments);
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
      return this.settingsSvc.blogLink(lang).join("/").replace("//", "/");
    };
    this.crumbs = computed(() => {
      const p = this.post();
      const lang = this.lang();
      const main = p?.mainCategory;
      const list = [
        { label: this.t(lang, "home"), link: ["/", lang] },
        { label: this.t(lang, "blog"), link: this.blogLink() }
      ];
      if (main)
        list.push({ label: main.name, link: this.blogLink("category", main.slug) });
      if (p)
        list.push({ label: p.title, link: null });
      return list;
    }, ...ngDevMode ? [{ debugName: "crumbs" }] : (
      /* istanbul ignore next */
      []
    ));
  }
  canonicalUrl() {
    const p = this.post();
    return p?.seo?.canonical || this.settingsSvc.blogUrl(this.lang(), this.slug());
  }
  fallbackNotice(p) {
    const shown = nativeLanguageName(p.contentLanguage);
    return t(this.lang(), "fallback_notice", { lang: shown });
  }
  ngOnInit() {
    return __async(this, null, function* () {
      combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(map(([p, q]) => ({ lang: p.get("lang") || q.get("lang") || "en", slug: p.get("slug") ?? "" })), distinctUntilChanged((a, b) => a.lang === b.lang && a.slug === b.slug)).subscribe(({ lang, slug }) => {
        this.lang.set(lang);
        this.slug.set(slug);
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
        const preview = this.route.snapshot.queryParamMap.get("preview") === "1";
        const p = yield this.api.getPublicPost(this.slug(), this.lang(), preview);
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
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _PostPage, selectors: [["ng-component"]], decls: 1, vars: 1, consts: [[3, "lang", "siteName", "languages"], [1, "container"], [1, "loading"], [1, "not-found"], [3, "lang", "showRetry"], [1, "btn", 3, "routerLink"], [3, "retry", "lang", "showRetry"], [1, "post-top"], [3, "crumbs"], [3, "languages", "current", "urlFor"], ["role", "status", 1, "fallback-notice"], [1, "head"], [1, "cat", 3, "routerLink"], [1, "meta"], [1, "author"], [1, "date"], [1, "reading"], [1, "comments-count"], [1, "views"], [1, "tags"], [1, "cover"], [1, "cover-fallback"], [3, "html", "lang"], [1, "share-row"], [3, "author", "lang"], [3, "posts", "lang", "display"], [3, "postId", "lang", "settings"], ["alt", "", 1, "avatar", 3, "src"], [3, "routerLink"], [1, "title"], [1, "chip", 3, "routerLink"], ["fetchpriority", "high", "loading", "eager", 3, "src", "alt"], [3, "url", "title", "lang"]], template: function PostPage_Template(rf, ctx) {
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
    ], styles: ['\n[_nghost-%COMP%] {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #1a1a1a);\n  --read: 760px;\n  --hair: color-mix(in srgb, var(--body-text, #1a1a1a) 12%, transparent);\n  --muted: color-mix(in srgb, var(--body-text, #1a1a1a) 60%, transparent);\n}\n.container[_ngcontent-%COMP%] {\n  max-width: 1100px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.loading[_ngcontent-%COMP%] {\n  text-align: center;\n  padding: 80px 0;\n  opacity: .6;\n}\n.not-found[_ngcontent-%COMP%] {\n  text-align: center;\n  padding: 80px 24px;\n}\n.not-found[_ngcontent-%COMP%]   h1[_ngcontent-%COMP%] {\n  margin: 0 0 8px;\n  font-size: 28px;\n}\n.not-found[_ngcontent-%COMP%]   .btn[_ngcontent-%COMP%] {\n  display: inline-block;\n  margin-top: 16px;\n  padding: 10px 20px;\n  border-radius: 8px;\n  background: var(--primary, #6366f1);\n  color: #fff;\n  text-decoration: none;\n}\n.post-top[_ngcontent-%COMP%] {\n  max-width: var(--read);\n  margin: 0 auto;\n  display: flex;\n  gap: 16px;\n  align-items: center;\n  flex-wrap: wrap;\n  justify-content: space-between;\n  padding: 8px 0 4px;\n}\n.head[_ngcontent-%COMP%] {\n  max-width: var(--read);\n  margin: 8px auto 28px;\n}\n.cat[_ngcontent-%COMP%] {\n  display: inline-block;\n  font-size: 12.5px;\n  font-weight: 700;\n  text-transform: uppercase;\n  letter-spacing: .08em;\n  color: var(--primary, #6366f1);\n  text-decoration: none;\n  margin-bottom: 16px;\n}\nh1[_ngcontent-%COMP%] {\n  margin: 0 0 20px;\n  font-family:\n    "Playfair Display",\n    Georgia,\n    serif;\n  font-size: 46px;\n  line-height: 1.12;\n  font-weight: 800;\n  letter-spacing: -.015em;\n}\n.meta[_ngcontent-%COMP%] {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px 14px;\n  font-size: 14px;\n  color: var(--muted);\n  align-items: center;\n}\n.meta[_ngcontent-%COMP%]    > *[_ngcontent-%COMP%]    + *[_ngcontent-%COMP%]::before {\n  content: "\\b7";\n  margin-inline-end: 14px;\n  color: var(--hair);\n}\n.author[_ngcontent-%COMP%] {\n  display: inline-flex;\n  align-items: center;\n  gap: 9px;\n}\n.author[_ngcontent-%COMP%]   a[_ngcontent-%COMP%] {\n  color: var(--body-text, #1a1a1a);\n  font-weight: 600;\n  text-decoration: none;\n}\n.author[_ngcontent-%COMP%]   a[_ngcontent-%COMP%]:hover {\n  text-decoration: underline;\n}\n.author[_ngcontent-%COMP%]   .title[_ngcontent-%COMP%] {\n  opacity: .7;\n  font-weight: 400;\n}\n.avatar[_ngcontent-%COMP%] {\n  width: 34px;\n  height: 34px;\n  border-radius: 50%;\n  object-fit: cover;\n}\n.tags[_ngcontent-%COMP%] {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 7px;\n  margin-top: 18px;\n}\n.chip[_ngcontent-%COMP%] {\n  font-size: 12px;\n  padding: 5px 12px;\n  border-radius: 100px;\n  border: 1px solid var(--hair);\n  color: var(--muted);\n  text-decoration: none;\n  transition: border-color .15s ease, color .15s ease;\n}\n.chip[_ngcontent-%COMP%]:hover {\n  border-color: var(--primary, #6366f1);\n  color: var(--primary, #6366f1);\n}\n.cover[_ngcontent-%COMP%] {\n  margin: 0 auto 44px;\n  max-width: 960px;\n}\n.cover[_ngcontent-%COMP%]   img[_ngcontent-%COMP%] {\n  width: 100%;\n  max-height: 64vh;\n  object-fit: cover;\n  border-radius: 16px;\n  display: block;\n}\n.cover-fallback[_ngcontent-%COMP%] {\n  height: 200px;\n  border-radius: 16px;\n  max-width: 960px;\n  margin: 0 auto 44px;\n  background:\n    linear-gradient(\n      135deg,\n      var(--primary, #6366f1),\n      #8b5cf6);\n}\n.share-row[_ngcontent-%COMP%] {\n  max-width: var(--read);\n  margin: 44px auto;\n  padding: 20px 0;\n  border-block: 1px solid var(--hair);\n}\n.fallback-notice[_ngcontent-%COMP%] {\n  max-width: var(--read);\n  margin: 0 auto 24px;\n  padding: 10px 16px;\n  background: rgba(255, 200, 0, .12);\n  border-inline-start: 4px solid #f5a623;\n  border-radius: 6px;\n  font-size: 14px;\n  color: #6b4f00;\n}\n@media (max-width: 768px) {\n  h1[_ngcontent-%COMP%] {\n    font-size: 32px;\n  }\n  .cover[_ngcontent-%COMP%]   img[_ngcontent-%COMP%] {\n    border-radius: 12px;\n  }\n}\n/*# sourceMappingURL=post.component.css.map */'], changeDetection: 0 });
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
            <a class="btn" [routerLink]="blogLink()">{{ t(lang(), 'back_to_blog') }}</a>
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

          <header class="head">
            @if (display().showCategoryLabel && p.mainCategory; as cat) {
              <a class="cat" [routerLink]="blogLink('category', cat.slug)">{{ cat.name }}</a>
            }
            <h1>{{ p.title }}</h1>
            <div class="meta">
              @if (display().showAuthor && p.author) {
                <span class="author">
                  @if (p.author.image) { <img [src]="p.author.image" alt="" class="avatar"> }
                  @if (p.author.id) {
                    <a [routerLink]="blogLink('authors', p.author.id)">{{ p.author.name }}</a>
                  } @else { <span>{{ p.author.name }}</span> }
                  @if (p.author.publicTitle) { <span class="title">\xB7 {{ p.author.publicTitle }}</span> }
                </span>
              }
              @if (display().showDate) {
                <time class="date" [attr.datetime]="p.publishDate">{{ formatDate(lang(), p.publishDate) }}</time>
              }
              @if (display().showReadingTime && p.readingTime > 0) {
                <span class="reading">{{ p.readingTime }} {{ t(lang(), 'min_read') }}</span>
              }
              @if (display().showCommentCount && p.commentsCount > 0) {
                <span class="comments-count">\u{1F4AC} {{ formatNumber(lang(), p.commentsCount) }}</span>
              }
              <span class="views">\u{1F441} {{ formatNumber(lang(), p.views) }}</span>
            </div>
            @if (display().showTags && p.tags.length) {
              <div class="tags">
                @for (tagRef of p.tags; track tagRef.id) {
                  <a class="chip" [routerLink]="blogLink('tag', tagRef.slug)">{{ tagRef.name }}</a>
                }
              </div>
            }
          </header>

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
  `, styles: ['/* angular:styles/component:css;845e2ab445d066a4a0ef327514d44b10bd34af0ffa9ec61f6b86d4d3be02e59e;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/pages/post.component.ts */\n:host {\n  display: block;\n  min-height: 100vh;\n  background: var(--body-bg, #fff);\n  color: var(--body-text, #1a1a1a);\n  --read: 760px;\n  --hair: color-mix(in srgb, var(--body-text, #1a1a1a) 12%, transparent);\n  --muted: color-mix(in srgb, var(--body-text, #1a1a1a) 60%, transparent);\n}\n.container {\n  max-width: 1100px;\n  margin: 0 auto;\n  padding: 24px;\n}\n.loading {\n  text-align: center;\n  padding: 80px 0;\n  opacity: .6;\n}\n.not-found {\n  text-align: center;\n  padding: 80px 24px;\n}\n.not-found h1 {\n  margin: 0 0 8px;\n  font-size: 28px;\n}\n.not-found .btn {\n  display: inline-block;\n  margin-top: 16px;\n  padding: 10px 20px;\n  border-radius: 8px;\n  background: var(--primary, #6366f1);\n  color: #fff;\n  text-decoration: none;\n}\n.post-top {\n  max-width: var(--read);\n  margin: 0 auto;\n  display: flex;\n  gap: 16px;\n  align-items: center;\n  flex-wrap: wrap;\n  justify-content: space-between;\n  padding: 8px 0 4px;\n}\n.head {\n  max-width: var(--read);\n  margin: 8px auto 28px;\n}\n.cat {\n  display: inline-block;\n  font-size: 12.5px;\n  font-weight: 700;\n  text-transform: uppercase;\n  letter-spacing: .08em;\n  color: var(--primary, #6366f1);\n  text-decoration: none;\n  margin-bottom: 16px;\n}\nh1 {\n  margin: 0 0 20px;\n  font-family:\n    "Playfair Display",\n    Georgia,\n    serif;\n  font-size: 46px;\n  line-height: 1.12;\n  font-weight: 800;\n  letter-spacing: -.015em;\n}\n.meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px 14px;\n  font-size: 14px;\n  color: var(--muted);\n  align-items: center;\n}\n.meta > * + *::before {\n  content: "\\b7";\n  margin-inline-end: 14px;\n  color: var(--hair);\n}\n.author {\n  display: inline-flex;\n  align-items: center;\n  gap: 9px;\n}\n.author a {\n  color: var(--body-text, #1a1a1a);\n  font-weight: 600;\n  text-decoration: none;\n}\n.author a:hover {\n  text-decoration: underline;\n}\n.author .title {\n  opacity: .7;\n  font-weight: 400;\n}\n.avatar {\n  width: 34px;\n  height: 34px;\n  border-radius: 50%;\n  object-fit: cover;\n}\n.tags {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 7px;\n  margin-top: 18px;\n}\n.chip {\n  font-size: 12px;\n  padding: 5px 12px;\n  border-radius: 100px;\n  border: 1px solid var(--hair);\n  color: var(--muted);\n  text-decoration: none;\n  transition: border-color .15s ease, color .15s ease;\n}\n.chip:hover {\n  border-color: var(--primary, #6366f1);\n  color: var(--primary, #6366f1);\n}\n.cover {\n  margin: 0 auto 44px;\n  max-width: 960px;\n}\n.cover img {\n  width: 100%;\n  max-height: 64vh;\n  object-fit: cover;\n  border-radius: 16px;\n  display: block;\n}\n.cover-fallback {\n  height: 200px;\n  border-radius: 16px;\n  max-width: 960px;\n  margin: 0 auto 44px;\n  background:\n    linear-gradient(\n      135deg,\n      var(--primary, #6366f1),\n      #8b5cf6);\n}\n.share-row {\n  max-width: var(--read);\n  margin: 44px auto;\n  padding: 20px 0;\n  border-block: 1px solid var(--hair);\n}\n.fallback-notice {\n  max-width: var(--read);\n  margin: 0 auto 24px;\n  padding: 10px 16px;\n  background: rgba(255, 200, 0, .12);\n  border-inline-start: 4px solid #f5a623;\n  border-radius: 6px;\n  font-size: 14px;\n  color: #6b4f00;\n}\n@media (max-width: 768px) {\n  h1 {\n    font-size: 32px;\n  }\n  .cover img {\n    border-radius: 12px;\n  }\n}\n/*# sourceMappingURL=post.component.css.map */\n'] }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(PostPage, { className: "PostPage", filePath: "src/app/features/blog/pages/post.component.ts", lineNumber: 248 });
})();
export {
  PostPage
};
//# sourceMappingURL=post.component-VICI3NVZ.mjs.map
