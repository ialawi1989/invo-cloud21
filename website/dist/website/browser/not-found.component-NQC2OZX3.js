import {
  t
} from "./chunk-TUMDR5WP.js";
import {
  ActivatedRoute,
  ChangeDetectionStrategy,
  CommonModule,
  Component,
  RouterLink,
  inject,
  setClassMetadata,
  signal,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵdefineComponent,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵproperty,
  ɵɵpureFunction1,
  ɵɵtext,
  ɵɵtextInterpolate
} from "./chunk-VBJDAOBI.js";

// src/app/features/blog/pages/not-found.component.ts
var _c0 = (a0) => ["/", a0, "blog"];
var NotFoundPage = class _NotFoundPage {
  constructor() {
    this.route = inject(ActivatedRoute);
    this.lang = signal("en", ...ngDevMode ? [{ debugName: "lang" }] : (
      /* istanbul ignore next */
      []
    ));
    this.t = t;
  }
  ngOnInit() {
    const s = this.route.snapshot;
    this.lang.set(s.paramMap.get("lang") || s.queryParamMap.get("lang") || "en");
  }
  static {
    this.\u0275fac = function NotFoundPage_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _NotFoundPage)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _NotFoundPage, selectors: [["ng-component"]], decls: 7, vars: 6, consts: [[1, "wrap"], [1, "btn", 3, "routerLink"]], template: function NotFoundPage_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275elementStart(0, "div", 0)(1, "h1");
        \u0275\u0275text(2);
        \u0275\u0275elementEnd();
        \u0275\u0275elementStart(3, "p");
        \u0275\u0275text(4);
        \u0275\u0275elementEnd();
        \u0275\u0275elementStart(5, "a", 1);
        \u0275\u0275text(6);
        \u0275\u0275elementEnd()();
      }
      if (rf & 2) {
        \u0275\u0275advance(2);
        \u0275\u0275textInterpolate(ctx.t(ctx.lang(), "404_title"));
        \u0275\u0275advance(2);
        \u0275\u0275textInterpolate(ctx.t(ctx.lang(), "404_body"));
        \u0275\u0275advance();
        \u0275\u0275property("routerLink", \u0275\u0275pureFunction1(4, _c0, ctx.lang()));
        \u0275\u0275advance();
        \u0275\u0275textInterpolate(ctx.t(ctx.lang(), "back_to_blog"));
      }
    }, dependencies: [CommonModule, RouterLink], styles: ["\n.wrap[_ngcontent-%COMP%] {\n  text-align: center;\n  padding: 120px 24px;\n}\nh1[_ngcontent-%COMP%] {\n  margin: 0 0 8px;\n  font-size: 32px;\n}\np[_ngcontent-%COMP%] {\n  margin: 0 0 24px;\n  opacity: .7;\n}\n.btn[_ngcontent-%COMP%] {\n  display: inline-block;\n  padding: 10px 20px;\n  background: var(--primary, #6366f1);\n  color: #fff;\n  text-decoration: none;\n  border-radius: 8px;\n}\n/*# sourceMappingURL=not-found.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NotFoundPage, [{
    type: Component,
    args: [{ standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule, RouterLink], template: `
    <div class="wrap">
      <h1>{{ t(lang(), '404_title') }}</h1>
      <p>{{ t(lang(), '404_body') }}</p>
      <a class="btn" [routerLink]="['/', lang(), 'blog']">{{ t(lang(), 'back_to_blog') }}</a>
    </div>
  `, styles: ["/* angular:styles/component:css;d3687ec71ae245453c96e020bd4bb32331186201a568db5e96d7f6660fff1a50;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/pages/not-found.component.ts */\n.wrap {\n  text-align: center;\n  padding: 120px 24px;\n}\nh1 {\n  margin: 0 0 8px;\n  font-size: 32px;\n}\np {\n  margin: 0 0 24px;\n  opacity: .7;\n}\n.btn {\n  display: inline-block;\n  padding: 10px 20px;\n  background: var(--primary, #6366f1);\n  color: #fff;\n  text-decoration: none;\n  border-radius: 8px;\n}\n/*# sourceMappingURL=not-found.component.css.map */\n"] }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(NotFoundPage, { className: "NotFoundPage", filePath: "src/app/features/blog/pages/not-found.component.ts", lineNumber: 24 });
})();
export {
  NotFoundPage
};
//# sourceMappingURL=not-found.component-NQC2OZX3.js.map
