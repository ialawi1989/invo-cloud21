import './polyfills.server.mjs';
import {
  PostCardComponent
} from "./chunk-3OZZLYME.mjs";
import {
  t
} from "./chunk-ZMGIQB7V.mjs";
import {
  ChangeDetectionStrategy,
  CommonModule,
  Component,
  EventEmitter,
  Input,
  NgTemplateOutlet,
  Output,
  PLATFORM_ID,
  computed,
  inject,
  isPlatformBrowser,
  setClassMetadata,
  signal,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵattribute,
  ɵɵclassProp,
  ɵɵconditional,
  ɵɵconditionalCreate,
  ɵɵdefineComponent,
  ɵɵdomElementEnd,
  ɵɵdomElementStart,
  ɵɵdomListener,
  ɵɵdomProperty,
  ɵɵelement,
  ɵɵelementContainer,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵgetCurrentView,
  ɵɵnextContext,
  ɵɵproperty,
  ɵɵreference,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵrepeaterTrackByIndex,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtemplate,
  ɵɵtemplateRefExtractor,
  ɵɵtext,
  ɵɵtextInterpolate
} from "./chunk-7RMZTTLI.mjs";

// src/app/features/blog/components/layouts/layout-renderer.component.ts
var _forTrack0 = ($index, $item) => $item.id;
function LayoutRendererComponent_Case_0_ng_container_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementContainer(0);
  }
}
function LayoutRendererComponent_Case_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275template(0, LayoutRendererComponent_Case_0_ng_container_0_Template, 1, 0, "ng-container", 6);
  }
  if (rf & 2) {
    \u0275\u0275nextContext();
    const grid_r1 = \u0275\u0275reference(7);
    \u0275\u0275property("ngTemplateOutlet", grid_r1);
  }
}
function LayoutRendererComponent_Case_1_ng_container_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementContainer(0);
  }
}
function LayoutRendererComponent_Case_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275template(0, LayoutRendererComponent_Case_1_ng_container_0_Template, 1, 0, "ng-container", 6);
  }
  if (rf & 2) {
    \u0275\u0275nextContext();
    const list_r2 = \u0275\u0275reference(9);
    \u0275\u0275property("ngTemplateOutlet", list_r2);
  }
}
function LayoutRendererComponent_Case_2_ng_container_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementContainer(0);
  }
}
function LayoutRendererComponent_Case_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275template(0, LayoutRendererComponent_Case_2_ng_container_0_Template, 1, 0, "ng-container", 6);
  }
  if (rf & 2) {
    \u0275\u0275nextContext();
    const masonry_r3 = \u0275\u0275reference(11);
    \u0275\u0275property("ngTemplateOutlet", masonry_r3);
  }
}
function LayoutRendererComponent_Case_3_ng_container_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementContainer(0);
  }
}
function LayoutRendererComponent_Case_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275template(0, LayoutRendererComponent_Case_3_ng_container_0_Template, 1, 0, "ng-container", 6);
  }
  if (rf & 2) {
    \u0275\u0275nextContext();
    const magazine_r4 = \u0275\u0275reference(13);
    \u0275\u0275property("ngTemplateOutlet", magazine_r4);
  }
}
function LayoutRendererComponent_Case_4_ng_container_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementContainer(0);
  }
}
function LayoutRendererComponent_Case_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275template(0, LayoutRendererComponent_Case_4_ng_container_0_Template, 1, 0, "ng-container", 6);
  }
  if (rf & 2) {
    \u0275\u0275nextContext();
    const sideBySide_r5 = \u0275\u0275reference(15);
    \u0275\u0275property("ngTemplateOutlet", sideBySide_r5);
  }
}
function LayoutRendererComponent_Case_5_ng_container_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementContainer(0);
  }
}
function LayoutRendererComponent_Case_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275template(0, LayoutRendererComponent_Case_5_ng_container_0_Template, 1, 0, "ng-container", 6);
  }
  if (rf & 2) {
    \u0275\u0275nextContext();
    const editorial_r6 = \u0275\u0275reference(17);
    \u0275\u0275property("ngTemplateOutlet", editorial_r6);
  }
}
function LayoutRendererComponent_ng_template_6_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-post-card", 8);
  }
  if (rf & 2) {
    const p_r7 = ctx.$implicit;
    const \u0275$index_35_r8 = ctx.$index;
    const ctx_r8 = \u0275\u0275nextContext(2);
    \u0275\u0275property("post", p_r7)("lang", ctx_r8.lang)("display", ctx_r8.display)("eagerLoadCover", \u0275$index_35_r8 < 3);
  }
}
function LayoutRendererComponent_ng_template_6_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 7);
    \u0275\u0275repeaterCreate(1, LayoutRendererComponent_ng_template_6_For_2_Template, 1, 4, "app-post-card", 8, _forTrack0);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r8 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r8.posts);
  }
}
function LayoutRendererComponent_ng_template_8_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-post-card", 10);
  }
  if (rf & 2) {
    const p_r10 = ctx.$implicit;
    const \u0275$index_42_r11 = ctx.$index;
    const ctx_r8 = \u0275\u0275nextContext(2);
    \u0275\u0275property("post", p_r10)("lang", ctx_r8.lang)("display", ctx_r8.display)("eagerLoadCover", \u0275$index_42_r11 < 2);
  }
}
function LayoutRendererComponent_ng_template_8_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 9);
    \u0275\u0275repeaterCreate(1, LayoutRendererComponent_ng_template_8_For_2_Template, 1, 4, "app-post-card", 10, _forTrack0);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r8 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r8.posts);
  }
}
function LayoutRendererComponent_ng_template_10_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 12);
    \u0275\u0275element(1, "app-post-card", 13);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const p_r12 = ctx.$implicit;
    const \u0275$index_49_r13 = ctx.$index;
    const ctx_r8 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275property("post", p_r12)("lang", ctx_r8.lang)("display", ctx_r8.display)("eagerLoadCover", \u0275$index_49_r13 < 3);
  }
}
function LayoutRendererComponent_ng_template_10_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 11);
    \u0275\u0275repeaterCreate(1, LayoutRendererComponent_ng_template_10_For_2_Template, 2, 4, "div", 12, _forTrack0);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r8 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r8.posts);
  }
}
function LayoutRendererComponent_ng_template_12_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-post-card", 14);
  }
  if (rf & 2) {
    const ctx_r8 = \u0275\u0275nextContext(2);
    \u0275\u0275property("post", ctx)("lang", ctx_r8.lang)("display", ctx_r8.display)("eagerLoadCover", true);
  }
}
function LayoutRendererComponent_ng_template_12_Conditional_1_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-post-card", 16);
  }
  if (rf & 2) {
    const p_r14 = ctx.$implicit;
    const ctx_r8 = \u0275\u0275nextContext(3);
    \u0275\u0275property("post", p_r14)("lang", ctx_r8.lang)("display", ctx_r8.display);
  }
}
function LayoutRendererComponent_ng_template_12_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 15);
    \u0275\u0275repeaterCreate(1, LayoutRendererComponent_ng_template_12_Conditional_1_For_2_Template, 1, 3, "app-post-card", 16, _forTrack0);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r8 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r8.posts.slice(1, 3));
  }
}
function LayoutRendererComponent_ng_template_12_Conditional_2_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-post-card", 17);
  }
  if (rf & 2) {
    const p_r15 = ctx.$implicit;
    const ctx_r8 = \u0275\u0275nextContext(3);
    \u0275\u0275property("post", p_r15)("lang", ctx_r8.lang)("display", ctx_r8.display);
  }
}
function LayoutRendererComponent_ng_template_12_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 7);
    \u0275\u0275repeaterCreate(1, LayoutRendererComponent_ng_template_12_Conditional_2_For_2_Template, 1, 3, "app-post-card", 17, _forTrack0);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r8 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r8.posts.slice(3));
  }
}
function LayoutRendererComponent_ng_template_12_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275conditionalCreate(0, LayoutRendererComponent_ng_template_12_Conditional_0_Template, 1, 4, "app-post-card", 14);
    \u0275\u0275conditionalCreate(1, LayoutRendererComponent_ng_template_12_Conditional_1_Template, 3, 0, "div", 15);
    \u0275\u0275conditionalCreate(2, LayoutRendererComponent_ng_template_12_Conditional_2_Template, 3, 0, "div", 7);
  }
  if (rf & 2) {
    let tmp_7_0;
    const ctx_r8 = \u0275\u0275nextContext();
    \u0275\u0275conditional((tmp_7_0 = ctx_r8.posts[0]) ? 0 : -1, tmp_7_0);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r8.posts.length > 1 ? 1 : -1);
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r8.posts.length > 3 ? 2 : -1);
  }
}
function LayoutRendererComponent_ng_template_14_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-post-card", 19);
  }
  if (rf & 2) {
    const p_r16 = ctx.$implicit;
    const \u0275$index_75_r17 = ctx.$index;
    const ctx_r8 = \u0275\u0275nextContext(2);
    \u0275\u0275property("post", p_r16)("lang", ctx_r8.lang)("display", ctx_r8.display)("reverseSide", \u0275$index_75_r17 % 2 === 1)("eagerLoadCover", \u0275$index_75_r17 < 2);
  }
}
function LayoutRendererComponent_ng_template_14_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 18);
    \u0275\u0275repeaterCreate(1, LayoutRendererComponent_ng_template_14_For_2_Template, 1, 5, "app-post-card", 19, _forTrack0);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r8 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r8.posts);
  }
}
function LayoutRendererComponent_ng_template_16_For_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-post-card", 21);
  }
  if (rf & 2) {
    const p_r18 = ctx.$implicit;
    const \u0275$index_82_r19 = ctx.$index;
    const ctx_r8 = \u0275\u0275nextContext(2);
    \u0275\u0275property("variant", \u0275$index_82_r19 % 4 === 0 ? "editorial" : "editorial-mini")("post", p_r18)("lang", ctx_r8.lang)("display", ctx_r8.display);
  }
}
function LayoutRendererComponent_ng_template_16_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 20);
    \u0275\u0275repeaterCreate(1, LayoutRendererComponent_ng_template_16_For_2_Template, 1, 4, "app-post-card", 21, _forTrack0);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r8 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r8.posts);
  }
}
var LayoutRendererComponent = class _LayoutRendererComponent {
  constructor() {
    this.posts = [];
    this.platformId = inject(PLATFORM_ID);
    this.isMobile = signal(false, ...ngDevMode ? [{ debugName: "isMobile" }] : (
      /* istanbul ignore next */
      []
    ));
    this.resolvedLayout = () => {
      if (this.mobile?.overrideDesktop && this.isMobile()) {
        return this.mobile.feedLayout;
      }
      return this.layout;
    };
  }
  ngOnInit() {
    if (!isPlatformBrowser(this.platformId))
      return;
    const mq = window.matchMedia("(max-width: 768px)");
    this.isMobile.set(mq.matches);
    const onChange = (e) => this.isMobile.set(e.matches);
    mq.addEventListener?.("change", onChange);
  }
  static {
    this.\u0275fac = function LayoutRendererComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _LayoutRendererComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _LayoutRendererComponent, selectors: [["app-layout-renderer"]], inputs: { posts: "posts", layout: "layout", lang: "lang", display: "display", mobile: "mobile" }, decls: 18, vars: 1, consts: [["grid", ""], ["list", ""], ["masonry", ""], ["magazine", ""], ["sideBySide", ""], ["editorial", ""], [4, "ngTemplateOutlet"], [1, "grid"], [3, "post", "lang", "display", "eagerLoadCover"], [1, "list"], ["variant", "list", 3, "post", "lang", "display", "eagerLoadCover"], [1, "masonry"], [1, "masonry-item"], ["variant", "masonry", 3, "post", "lang", "display", "eagerLoadCover"], ["variant", "hero", 1, "mag-hero", 3, "post", "lang", "display", "eagerLoadCover"], [1, "mag-medium"], ["variant", "magazine-medium", 3, "post", "lang", "display"], [3, "post", "lang", "display"], [1, "side-stack"], ["variant", "side", 3, "post", "lang", "display", "reverseSide", "eagerLoadCover"], [1, "editorial"], [3, "variant", "post", "lang", "display"]], template: function LayoutRendererComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275conditionalCreate(0, LayoutRendererComponent_Case_0_Template, 1, 1, "ng-container")(1, LayoutRendererComponent_Case_1_Template, 1, 1, "ng-container")(2, LayoutRendererComponent_Case_2_Template, 1, 1, "ng-container")(3, LayoutRendererComponent_Case_3_Template, 1, 1, "ng-container")(4, LayoutRendererComponent_Case_4_Template, 1, 1, "ng-container")(5, LayoutRendererComponent_Case_5_Template, 1, 1, "ng-container");
        \u0275\u0275template(6, LayoutRendererComponent_ng_template_6_Template, 3, 0, "ng-template", null, 0, \u0275\u0275templateRefExtractor)(8, LayoutRendererComponent_ng_template_8_Template, 3, 0, "ng-template", null, 1, \u0275\u0275templateRefExtractor)(10, LayoutRendererComponent_ng_template_10_Template, 3, 0, "ng-template", null, 2, \u0275\u0275templateRefExtractor)(12, LayoutRendererComponent_ng_template_12_Template, 3, 3, "ng-template", null, 3, \u0275\u0275templateRefExtractor)(14, LayoutRendererComponent_ng_template_14_Template, 3, 0, "ng-template", null, 4, \u0275\u0275templateRefExtractor)(16, LayoutRendererComponent_ng_template_16_Template, 3, 0, "ng-template", null, 5, \u0275\u0275templateRefExtractor);
      }
      if (rf & 2) {
        let tmp_6_0;
        \u0275\u0275conditional((tmp_6_0 = ctx.resolvedLayout()) === "grid" ? 0 : tmp_6_0 === "list" ? 1 : tmp_6_0 === "masonry" ? 2 : tmp_6_0 === "magazine" ? 3 : tmp_6_0 === "sideBySide" ? 4 : tmp_6_0 === "editorial" ? 5 : -1);
      }
    }, dependencies: [CommonModule, NgTemplateOutlet, PostCardComponent], styles: ['\n[_nghost-%COMP%] {\n  display: block;\n}\n.grid[_ngcontent-%COMP%] {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 24px;\n}\n.list[_ngcontent-%COMP%] {\n  display: flex;\n  flex-direction: column;\n  gap: 20px;\n}\n.masonry[_ngcontent-%COMP%] {\n  column-count: 3;\n  column-gap: 24px;\n}\n.masonry-item[_ngcontent-%COMP%] {\n  break-inside: avoid;\n  margin-bottom: 24px;\n}\n.mag-hero[_ngcontent-%COMP%] {\n  display: block;\n  margin-bottom: 32px;\n}\n.mag-medium[_ngcontent-%COMP%] {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 24px;\n  margin-bottom: 32px;\n}\n.side-stack[_ngcontent-%COMP%] {\n  display: flex;\n  flex-direction: column;\n  gap: 24px;\n}\n.editorial[_ngcontent-%COMP%] {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 40px;\n  font-family:\n    Georgia,\n    "Playfair Display",\n    serif;\n}\n@media (max-width: 1024px) {\n  .grid[_ngcontent-%COMP%] {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n  .masonry[_ngcontent-%COMP%] {\n    column-count: 2;\n  }\n}\n@media (max-width: 640px) {\n  .grid[_ngcontent-%COMP%] {\n    grid-template-columns: 1fr;\n  }\n  .masonry[_ngcontent-%COMP%] {\n    column-count: 1;\n  }\n  .mag-medium[_ngcontent-%COMP%], \n   .editorial[_ngcontent-%COMP%] {\n    grid-template-columns: 1fr;\n  }\n}\n/*# sourceMappingURL=layout-renderer.component.css.map */'], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(LayoutRendererComponent, [{
    type: Component,
    args: [{ selector: "app-layout-renderer", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule, PostCardComponent], template: `
    @switch (resolvedLayout()) {
      @case ('grid')      { <ng-container *ngTemplateOutlet="grid"></ng-container> }
      @case ('list')      { <ng-container *ngTemplateOutlet="list"></ng-container> }
      @case ('masonry')   { <ng-container *ngTemplateOutlet="masonry"></ng-container> }
      @case ('magazine')  { <ng-container *ngTemplateOutlet="magazine"></ng-container> }
      @case ('sideBySide'){ <ng-container *ngTemplateOutlet="sideBySide"></ng-container> }
      @case ('editorial') { <ng-container *ngTemplateOutlet="editorial"></ng-container> }
    }

    <!-- 1. GRID -->
    <ng-template #grid>
      <div class="grid">
        @for (p of posts; track p.id; let i = $index) {
          <app-post-card [post]="p" [lang]="lang" [display]="display"
                         [eagerLoadCover]="i < 3"></app-post-card>
        }
      </div>
    </ng-template>

    <!-- 2. LIST -->
    <ng-template #list>
      <div class="list">
        @for (p of posts; track p.id; let i = $index) {
          <app-post-card variant="list" [post]="p" [lang]="lang" [display]="display"
                         [eagerLoadCover]="i < 2"></app-post-card>
        }
      </div>
    </ng-template>

    <!-- 3. MASONRY -->
    <ng-template #masonry>
      <div class="masonry">
        @for (p of posts; track p.id; let i = $index) {
          <div class="masonry-item">
            <app-post-card variant="masonry" [post]="p" [lang]="lang" [display]="display"
                           [eagerLoadCover]="i < 3"></app-post-card>
          </div>
        }
      </div>
    </ng-template>

    <!-- 4. MAGAZINE: 1 hero, 2 medium, rest 3-col -->
    <ng-template #magazine>
      @if (posts[0]; as hero) {
        <app-post-card class="mag-hero" variant="hero"
                       [post]="hero" [lang]="lang" [display]="display"
                       [eagerLoadCover]="true"></app-post-card>
      }
      @if (posts.length > 1) {
        <div class="mag-medium">
          @for (p of posts.slice(1, 3); track p.id) {
            <app-post-card variant="magazine-medium" [post]="p" [lang]="lang" [display]="display"></app-post-card>
          }
        </div>
      }
      @if (posts.length > 3) {
        <div class="grid">
          @for (p of posts.slice(3); track p.id) {
            <app-post-card [post]="p" [lang]="lang" [display]="display"></app-post-card>
          }
        </div>
      }
    </ng-template>

    <!-- 5. SIDE BY SIDE -->
    <ng-template #sideBySide>
      <div class="side-stack">
        @for (p of posts; track p.id; let i = $index) {
          <app-post-card variant="side" [post]="p" [lang]="lang" [display]="display"
                         [reverseSide]="i % 2 === 1"
                         [eagerLoadCover]="i < 2"></app-post-card>
        }
      </div>
    </ng-template>

    <!-- 6. EDITORIAL -->
    <ng-template #editorial>
      <div class="editorial">
        @for (p of posts; track p.id; let i = $index) {
          <app-post-card [variant]="i % 4 === 0 ? 'editorial' : 'editorial-mini'"
                         [post]="p" [lang]="lang" [display]="display"></app-post-card>
        }
      </div>
    </ng-template>
  `, styles: ['/* angular:styles/component:css;25cdb192d6d517fe3740b659052462a8e80eae94d3a183071e20cc29adfeef4d;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/components/layouts/layout-renderer.component.ts */\n:host {\n  display: block;\n}\n.grid {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 24px;\n}\n.list {\n  display: flex;\n  flex-direction: column;\n  gap: 20px;\n}\n.masonry {\n  column-count: 3;\n  column-gap: 24px;\n}\n.masonry-item {\n  break-inside: avoid;\n  margin-bottom: 24px;\n}\n.mag-hero {\n  display: block;\n  margin-bottom: 32px;\n}\n.mag-medium {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 24px;\n  margin-bottom: 32px;\n}\n.side-stack {\n  display: flex;\n  flex-direction: column;\n  gap: 24px;\n}\n.editorial {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 40px;\n  font-family:\n    Georgia,\n    "Playfair Display",\n    serif;\n}\n@media (max-width: 1024px) {\n  .grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n  .masonry {\n    column-count: 2;\n  }\n}\n@media (max-width: 640px) {\n  .grid {\n    grid-template-columns: 1fr;\n  }\n  .masonry {\n    column-count: 1;\n  }\n  .mag-medium,\n  .editorial {\n    grid-template-columns: 1fr;\n  }\n}\n/*# sourceMappingURL=layout-renderer.component.css.map */\n'] }]
  }], null, { posts: [{
    type: Input,
    args: [{ required: true }]
  }], layout: [{
    type: Input,
    args: [{ required: true }]
  }], lang: [{
    type: Input,
    args: [{ required: true }]
  }], display: [{
    type: Input,
    args: [{ required: true }]
  }], mobile: [{
    type: Input
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(LayoutRendererComponent, { className: "LayoutRendererComponent", filePath: "src/app/features/blog/components/layouts/layout-renderer.component.ts", lineNumber: 152 });
})();

// src/app/features/blog/components/pagination.component.ts
function PaginationComponent_Conditional_0_For_4_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "span", 2);
    \u0275\u0275text(1, "\u2026");
    \u0275\u0275domElementEnd();
  }
}
function PaginationComponent_Conditional_0_For_4_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275domElementStart(0, "button", 4);
    \u0275\u0275domListener("click", function PaginationComponent_Conditional_0_For_4_Conditional_1_Template_button_click_0_listener() {
      \u0275\u0275restoreView(_r3);
      const item_r4 = \u0275\u0275nextContext().$implicit;
      const ctx_r1 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r1.go(item_r4));
    });
    \u0275\u0275text(1);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const item_r4 = \u0275\u0275nextContext().$implicit;
    const ctx_r1 = \u0275\u0275nextContext(2);
    \u0275\u0275classProp("active", item_r4 === ctx_r1.page);
    \u0275\u0275attribute("aria-current", item_r4 === ctx_r1.page ? "page" : null);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(item_r4);
  }
}
function PaginationComponent_Conditional_0_For_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275conditionalCreate(0, PaginationComponent_Conditional_0_For_4_Conditional_0_Template, 2, 0, "span", 2)(1, PaginationComponent_Conditional_0_For_4_Conditional_1_Template, 2, 4, "button", 3);
  }
  if (rf & 2) {
    const item_r4 = ctx.$implicit;
    \u0275\u0275conditional(item_r4 === "\u2026" ? 0 : 1);
  }
}
function PaginationComponent_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275domElementStart(0, "nav", 0)(1, "button", 1);
    \u0275\u0275domListener("click", function PaginationComponent_Conditional_0_Template_button_click_1_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.go(ctx_r1.page - 1));
    });
    \u0275\u0275text(2);
    \u0275\u0275domElementEnd();
    \u0275\u0275repeaterCreate(3, PaginationComponent_Conditional_0_For_4_Template, 2, 1, null, null, \u0275\u0275repeaterTrackByIndex);
    \u0275\u0275domElementStart(5, "button", 1);
    \u0275\u0275domListener("click", function PaginationComponent_Conditional_0_Template_button_click_5_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.go(ctx_r1.page + 1));
    });
    \u0275\u0275text(6);
    \u0275\u0275domElementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275attribute("aria-label", ctx_r1.t("page"));
    \u0275\u0275advance();
    \u0275\u0275domProperty("disabled", ctx_r1.page <= 1);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r1.t("previous"));
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r1.items());
    \u0275\u0275advance(2);
    \u0275\u0275domProperty("disabled", ctx_r1.page >= ctx_r1.pageCount);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r1.t("next"));
  }
}
var PaginationComponent = class _PaginationComponent {
  constructor() {
    this.page = 1;
    this.pageCount = 1;
    this.lang = "en";
    this.pageChange = new EventEmitter();
    this.t = (k) => t(this.lang, k);
    this.items = computed(() => {
      const p = this.page, total = this.pageCount;
      if (total <= 7)
        return Array.from({ length: total }, (_, i) => i + 1);
      const set = /* @__PURE__ */ new Set([1, total, p - 1, p, p + 1]);
      const sorted = Array.from(set).filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
      const out = [];
      let prev = 0;
      for (const n of sorted) {
        if (n - prev > 1)
          out.push("\u2026");
        out.push(n);
        prev = n;
      }
      return out;
    }, ...ngDevMode ? [{ debugName: "items" }] : (
      /* istanbul ignore next */
      []
    ));
  }
  go(n) {
    if (n < 1 || n > this.pageCount || n === this.page)
      return;
    this.pageChange.emit(n);
  }
  static {
    this.\u0275fac = function PaginationComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _PaginationComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _PaginationComponent, selectors: [["app-pagination"]], inputs: { page: "page", pageCount: "pageCount", lang: "lang" }, outputs: { pageChange: "pageChange" }, decls: 1, vars: 1, consts: [[1, "pager"], [1, "btn", 3, "click", "disabled"], [1, "ellipsis"], [1, "btn", "num", 3, "active"], [1, "btn", "num", 3, "click"]], template: function PaginationComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275conditionalCreate(0, PaginationComponent_Conditional_0_Template, 7, 5, "nav", 0);
      }
      if (rf & 2) {
        \u0275\u0275conditional(ctx.pageCount > 1 ? 0 : -1);
      }
    }, dependencies: [CommonModule], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n}\n.pager[_ngcontent-%COMP%] {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: center;\n  gap: 6px;\n  padding: 32px 0;\n}\n.btn[_ngcontent-%COMP%] {\n  min-width: 36px;\n  height: 36px;\n  padding: 0 12px;\n  background: transparent;\n  border: 1px solid rgba(0, 0, 0, .12);\n  border-radius: 6px;\n  cursor: pointer;\n  font: inherit;\n  color: inherit;\n}\n.btn[_ngcontent-%COMP%]:not(:disabled):hover {\n  background: rgba(0, 0, 0, .04);\n}\n.btn[_ngcontent-%COMP%]:disabled {\n  opacity: .4;\n  cursor: not-allowed;\n}\n.btn.active[_ngcontent-%COMP%] {\n  background: var(--primary, #6366f1);\n  color: #fff;\n  border-color: transparent;\n}\n.ellipsis[_ngcontent-%COMP%] {\n  padding: 0 6px;\n  align-self: center;\n  opacity: .6;\n}\n/*# sourceMappingURL=pagination.component.css.map */"], changeDetection: 0 });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PaginationComponent, [{
    type: Component,
    args: [{ selector: "app-pagination", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule], template: `
    @if (pageCount > 1) {
      <nav class="pager" [attr.aria-label]="t('page')">
        <button class="btn"
                [disabled]="page <= 1"
                (click)="go(page - 1)">{{ t('previous') }}</button>

        @for (item of items(); track $index) {
          @if (item === '\u2026') {
            <span class="ellipsis">\u2026</span>
          } @else {
            <button class="btn num"
                    [class.active]="item === page"
                    [attr.aria-current]="item === page ? 'page' : null"
                    (click)="go(item)">{{ item }}</button>
          }
        }

        <button class="btn"
                [disabled]="page >= pageCount"
                (click)="go(page + 1)">{{ t('next') }}</button>
      </nav>
    }
  `, styles: ["/* angular:styles/component:css;49385703b51962ac104e06e99ead5d1b2d8c0832ae924b023f20957cbde99ade;D:/Users/Invo/Downloads/angular-customizer/website/src/app/features/blog/components/pagination.component.ts */\n:host {\n  display: block;\n}\n.pager {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: center;\n  gap: 6px;\n  padding: 32px 0;\n}\n.btn {\n  min-width: 36px;\n  height: 36px;\n  padding: 0 12px;\n  background: transparent;\n  border: 1px solid rgba(0, 0, 0, .12);\n  border-radius: 6px;\n  cursor: pointer;\n  font: inherit;\n  color: inherit;\n}\n.btn:not(:disabled):hover {\n  background: rgba(0, 0, 0, .04);\n}\n.btn:disabled {\n  opacity: .4;\n  cursor: not-allowed;\n}\n.btn.active {\n  background: var(--primary, #6366f1);\n  color: #fff;\n  border-color: transparent;\n}\n.ellipsis {\n  padding: 0 6px;\n  align-self: center;\n  opacity: .6;\n}\n/*# sourceMappingURL=pagination.component.css.map */\n"] }]
  }], null, { page: [{
    type: Input,
    args: [{ required: true }]
  }], pageCount: [{
    type: Input,
    args: [{ required: true }]
  }], lang: [{
    type: Input
  }], pageChange: [{
    type: Output
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(PaginationComponent, { className: "PaginationComponent", filePath: "src/app/features/blog/components/pagination.component.ts", lineNumber: 64 });
})();

export {
  LayoutRendererComponent,
  PaginationComponent
};
//# sourceMappingURL=chunk-DRS7EHAE.mjs.map
