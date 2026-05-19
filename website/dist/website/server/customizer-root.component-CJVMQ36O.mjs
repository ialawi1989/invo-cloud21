import './polyfills.server.mjs';
import {
  environment
} from "./chunk-7T3LTQNF.mjs";
import {
  CommonModule,
  Component,
  Injectable,
  Input,
  PLATFORM_ID,
  computed,
  inject,
  isPlatformBrowser,
  setClassMetadata,
  signal,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵattribute,
  ɵɵclassMap,
  ɵɵclassProp,
  ɵɵconditional,
  ɵɵconditionalCreate,
  ɵɵdefineComponent,
  ɵɵdefineInjectable,
  ɵɵdirectiveInject,
  ɵɵdomElement,
  ɵɵdomElementEnd,
  ɵɵdomElementStart,
  ɵɵdomProperty,
  ɵɵelement,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵinterpolate,
  ɵɵnamespaceHTML,
  ɵɵnamespaceSVG,
  ɵɵnextContext,
  ɵɵproperty,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵrepeaterTrackByIdentity,
  ɵɵsanitizeUrl,
  ɵɵstyleProp,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1
} from "./chunk-7RMZTTLI.mjs";
import {
  __spreadValues
} from "./chunk-TXMZZVXC.mjs";

// src/app/models/settings.model.ts
var DEFAULT_GLOBAL_SETTINGS = {
  headerBgColor: "#ffffff",
  headerTextColor: "#1f2937",
  bodyBgColor: "#ffffff",
  bodyTextColor: "#374151",
  primaryColor: "#6366f1",
  secondaryColor: "#8b5cf6",
  accentColor: "#06b6d4",
  fontFamily: "Inter",
  headingFontFamily: "Inter",
  baseFontSize: 16,
  headingFontSize: 48,
  lineHeight: 1.6,
  fontWeight: 400,
  containerWidth: 1200,
  headerHeight: 70,
  sectionPadding: 80,
  borderRadius: 12,
  siteTitle: "My Website",
  siteTagline: "Building amazing experiences",
  footerText: "\xA9 2024 My Website. All rights reserved.",
  showHeader: true,
  showFooter: true,
  stickyHeader: true
};
var COMPONENT_NAMES = {
  "hero": "Hero Section",
  "features": "Features Grid",
  "testimonials": "Testimonials",
  "cta": "Call to Action",
  "pricing": "Pricing",
  "gallery": "Image Gallery",
  "faq": "FAQ",
  "contact": "Contact",
  "stats": "Stats",
  "team": "Team",
  "newsletter": "Newsletter"
};

// src/app/components/dynamic/dynamic-component.component.ts
var _forTrack0 = ($index, $item) => $item.title;
var _forTrack1 = ($index, $item) => $item.name;
var _forTrack2 = ($index, $item) => $item.label;
var _forTrack3 = ($index, $item) => $item.question;
var _forTrack4 = ($index, $item) => $item.src;
function DynamicComponentComponent_Case_1_Conditional_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "a", 18);
    \u0275\u0275text(1);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext(2);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r0.component.settings["secondaryButtonText"], " ");
  }
}
function DynamicComponentComponent_Case_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "section", 12)(1, "div", 13)(2, "h1", 14);
    \u0275\u0275text(3);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(4, "p", 15);
    \u0275\u0275text(5);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(6, "div", 16)(7, "a", 17);
    \u0275\u0275text(8);
    \u0275\u0275domElementEnd();
    \u0275\u0275conditionalCreate(9, DynamicComponentComponent_Case_1_Conditional_9_Template, 2, 1, "a", 18);
    \u0275\u0275domElementEnd()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275styleProp("text-align", ctx_r0.component.settings["alignment"]);
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["title"]);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["subtitle"]);
    \u0275\u0275advance(2);
    \u0275\u0275domProperty("href", \u0275\u0275interpolate(ctx_r0.component.settings["buttonLink"]), \u0275\u0275sanitizeUrl);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r0.component.settings["buttonText"], " ");
    \u0275\u0275advance();
    \u0275\u0275conditional(ctx_r0.component.settings["showSecondaryButton"] ? 9 : -1);
  }
}
function DynamicComponentComponent_Case_2_For_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "div", 21)(1, "div", 22);
    \u0275\u0275namespaceSVG();
    \u0275\u0275domElementStart(2, "svg", 23);
    \u0275\u0275domElement(3, "polygon", 24);
    \u0275\u0275domElementEnd()();
    \u0275\u0275namespaceHTML();
    \u0275\u0275domElementStart(4, "h3");
    \u0275\u0275text(5);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(6, "p");
    \u0275\u0275text(7);
    \u0275\u0275domElementEnd()();
  }
  if (rf & 2) {
    const feature_r2 = ctx.$implicit;
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(feature_r2.title);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(feature_r2.description);
  }
}
function DynamicComponentComponent_Case_2_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "section", 2)(1, "div", 13)(2, "div", 19)(3, "h2");
    \u0275\u0275text(4);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(5, "p");
    \u0275\u0275text(6);
    \u0275\u0275domElementEnd()();
    \u0275\u0275domElementStart(7, "div", 20);
    \u0275\u0275repeaterCreate(8, DynamicComponentComponent_Case_2_For_9_Template, 8, 2, "div", 21, _forTrack0);
    \u0275\u0275domElementEnd()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["title"]);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["subtitle"]);
    \u0275\u0275advance();
    \u0275\u0275styleProp("grid-template-columns", "repeat(" + ctx_r0.component.settings["columns"] + ", 1fr)");
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r0.component.settings["features"]);
  }
}
function DynamicComponentComponent_Case_3_For_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "div", 26)(1, "p", 27);
    \u0275\u0275text(2);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(3, "div", 28)(4, "div", 29);
    \u0275\u0275text(5);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(6, "div")(7, "div", 30);
    \u0275\u0275text(8);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(9, "div", 31);
    \u0275\u0275text(10);
    \u0275\u0275domElementEnd()()()();
  }
  if (rf & 2) {
    const testimonial_r3 = ctx.$implicit;
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate1('"', testimonial_r3.content, '"');
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(testimonial_r3.name.charAt(0));
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(testimonial_r3.name);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(testimonial_r3.role);
  }
}
function DynamicComponentComponent_Case_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "section", 3)(1, "div", 13)(2, "div", 19)(3, "h2");
    \u0275\u0275text(4);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(5, "p");
    \u0275\u0275text(6);
    \u0275\u0275domElementEnd()();
    \u0275\u0275domElementStart(7, "div", 25);
    \u0275\u0275repeaterCreate(8, DynamicComponentComponent_Case_3_For_9_Template, 11, 4, "div", 26, _forTrack1);
    \u0275\u0275domElementEnd()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["title"]);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["subtitle"]);
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r0.component.settings["testimonials"]);
  }
}
function DynamicComponentComponent_Case_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "section", 32)(1, "div", 13)(2, "h2");
    \u0275\u0275text(3);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(4, "p");
    \u0275\u0275text(5);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(6, "a", 33);
    \u0275\u0275text(7);
    \u0275\u0275domElementEnd()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275classMap(ctx_r0.component.settings["style"]);
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["title"]);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["subtitle"]);
    \u0275\u0275advance();
    \u0275\u0275domProperty("href", \u0275\u0275interpolate(ctx_r0.component.settings["buttonLink"]), \u0275\u0275sanitizeUrl);
    \u0275\u0275advance();
    \u0275\u0275textInterpolate1(" ", ctx_r0.component.settings["buttonText"], " ");
  }
}
function DynamicComponentComponent_Case_5_For_9_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "div", 37);
    \u0275\u0275text(1, "Most Popular");
    \u0275\u0275domElementEnd();
  }
}
function DynamicComponentComponent_Case_5_For_9_For_13_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "li");
    \u0275\u0275namespaceSVG();
    \u0275\u0275domElementStart(1, "svg", 44);
    \u0275\u0275domElement(2, "polyline", 45);
    \u0275\u0275domElementEnd();
    \u0275\u0275text(3);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const feature_r4 = ctx.$implicit;
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate1(" ", feature_r4, " ");
  }
}
function DynamicComponentComponent_Case_5_For_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "div", 36);
    \u0275\u0275conditionalCreate(1, DynamicComponentComponent_Case_5_For_9_Conditional_1_Template, 2, 0, "div", 37);
    \u0275\u0275domElementStart(2, "h3");
    \u0275\u0275text(3);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(4, "div", 38)(5, "span", 39);
    \u0275\u0275text(6, "$");
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(7, "span", 40);
    \u0275\u0275text(8);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(9, "span", 41);
    \u0275\u0275text(10);
    \u0275\u0275domElementEnd()();
    \u0275\u0275domElementStart(11, "ul", 42);
    \u0275\u0275repeaterCreate(12, DynamicComponentComponent_Case_5_For_9_For_13_Template, 4, 1, "li", null, \u0275\u0275repeaterTrackByIdentity);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(14, "a", 43);
    \u0275\u0275text(15, " Get Started ");
    \u0275\u0275domElementEnd()();
  }
  if (rf & 2) {
    const plan_r5 = ctx.$implicit;
    \u0275\u0275classProp("highlighted", plan_r5.highlighted);
    \u0275\u0275advance();
    \u0275\u0275conditional(plan_r5.highlighted ? 1 : -1);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(plan_r5.name);
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(plan_r5.price);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate1("/", plan_r5.period);
    \u0275\u0275advance(2);
    \u0275\u0275repeater(plan_r5.features);
    \u0275\u0275advance(2);
    \u0275\u0275classProp("btn-primary", plan_r5.highlighted)("btn-secondary", !plan_r5.highlighted);
  }
}
function DynamicComponentComponent_Case_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "section", 5)(1, "div", 13)(2, "div", 19)(3, "h2");
    \u0275\u0275text(4);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(5, "p");
    \u0275\u0275text(6);
    \u0275\u0275domElementEnd()();
    \u0275\u0275domElementStart(7, "div", 34);
    \u0275\u0275repeaterCreate(8, DynamicComponentComponent_Case_5_For_9_Template, 16, 10, "div", 35, _forTrack1);
    \u0275\u0275domElementEnd()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["title"]);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["subtitle"]);
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r0.component.settings["plans"]);
  }
}
function DynamicComponentComponent_Case_6_For_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "div", 47)(1, "div", 48);
    \u0275\u0275text(2);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(3, "div", 49);
    \u0275\u0275text(4);
    \u0275\u0275domElementEnd()();
  }
  if (rf & 2) {
    const stat_r6 = ctx.$implicit;
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(stat_r6.value);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(stat_r6.label);
  }
}
function DynamicComponentComponent_Case_6_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "section", 6)(1, "div", 13)(2, "div", 19)(3, "h2");
    \u0275\u0275text(4);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(5, "p");
    \u0275\u0275text(6);
    \u0275\u0275domElementEnd()();
    \u0275\u0275domElementStart(7, "div", 46);
    \u0275\u0275repeaterCreate(8, DynamicComponentComponent_Case_6_For_9_Template, 5, 2, "div", 47, _forTrack2);
    \u0275\u0275domElementEnd()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["title"]);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["subtitle"]);
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r0.component.settings["stats"]);
  }
}
function DynamicComponentComponent_Case_7_For_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "div", 51)(1, "h4", 52);
    \u0275\u0275text(2);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(3, "p", 53);
    \u0275\u0275text(4);
    \u0275\u0275domElementEnd()();
  }
  if (rf & 2) {
    const faq_r7 = ctx.$implicit;
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(faq_r7.question);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(faq_r7.answer);
  }
}
function DynamicComponentComponent_Case_7_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "section", 7)(1, "div", 13)(2, "div", 19)(3, "h2");
    \u0275\u0275text(4);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(5, "p");
    \u0275\u0275text(6);
    \u0275\u0275domElementEnd()();
    \u0275\u0275domElementStart(7, "div", 50);
    \u0275\u0275repeaterCreate(8, DynamicComponentComponent_Case_7_For_9_Template, 5, 2, "div", 51, _forTrack3);
    \u0275\u0275domElementEnd()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["title"]);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["subtitle"]);
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r0.component.settings["faqs"]);
  }
}
function DynamicComponentComponent_Case_8_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "section", 8)(1, "div", 13)(2, "div", 54)(3, "div", 55)(4, "h2");
    \u0275\u0275text(5);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(6, "p");
    \u0275\u0275text(7);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(8, "div", 56)(9, "div", 57);
    \u0275\u0275namespaceSVG();
    \u0275\u0275domElementStart(10, "svg", 58);
    \u0275\u0275domElement(11, "path", 59)(12, "polyline", 60);
    \u0275\u0275domElementEnd();
    \u0275\u0275text(13);
    \u0275\u0275domElementEnd();
    \u0275\u0275namespaceHTML();
    \u0275\u0275domElementStart(14, "div", 57);
    \u0275\u0275namespaceSVG();
    \u0275\u0275domElementStart(15, "svg", 58);
    \u0275\u0275domElement(16, "path", 61);
    \u0275\u0275domElementEnd();
    \u0275\u0275text(17);
    \u0275\u0275domElementEnd();
    \u0275\u0275namespaceHTML();
    \u0275\u0275domElementStart(18, "div", 57);
    \u0275\u0275namespaceSVG();
    \u0275\u0275domElementStart(19, "svg", 58);
    \u0275\u0275domElement(20, "path", 62)(21, "circle", 63);
    \u0275\u0275domElementEnd();
    \u0275\u0275text(22);
    \u0275\u0275domElementEnd()()();
    \u0275\u0275namespaceHTML();
    \u0275\u0275domElementStart(23, "div", 64)(24, "div", 65);
    \u0275\u0275domElement(25, "input", 66);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(26, "div", 65);
    \u0275\u0275domElement(27, "input", 67);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(28, "div", 65);
    \u0275\u0275domElement(29, "textarea", 68);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(30, "button", 69);
    \u0275\u0275text(31, "Send Message");
    \u0275\u0275domElementEnd()()()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["title"]);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["subtitle"]);
    \u0275\u0275advance(6);
    \u0275\u0275textInterpolate1(" ", ctx_r0.component.settings["email"], " ");
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate1(" ", ctx_r0.component.settings["phone"], " ");
    \u0275\u0275advance(5);
    \u0275\u0275textInterpolate1(" ", ctx_r0.component.settings["address"], " ");
  }
}
function DynamicComponentComponent_Case_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "section", 9)(1, "div", 13)(2, "h2");
    \u0275\u0275text(3);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(4, "p");
    \u0275\u0275text(5);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(6, "div", 70);
    \u0275\u0275domElement(7, "input", 71);
    \u0275\u0275domElementStart(8, "button", 69);
    \u0275\u0275text(9);
    \u0275\u0275domElementEnd()()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["title"]);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["subtitle"]);
    \u0275\u0275advance(2);
    \u0275\u0275domProperty("placeholder", \u0275\u0275interpolate(ctx_r0.component.settings["placeholder"]));
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["buttonText"]);
  }
}
function DynamicComponentComponent_Case_10_For_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "div", 73);
    \u0275\u0275domElement(1, "img", 74);
    \u0275\u0275domElementEnd();
  }
  if (rf & 2) {
    const image_r8 = ctx.$implicit;
    \u0275\u0275advance();
    \u0275\u0275domProperty("src", image_r8.src, \u0275\u0275sanitizeUrl)("alt", image_r8.alt);
  }
}
function DynamicComponentComponent_Case_10_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "section", 10)(1, "div", 13)(2, "div", 19)(3, "h2");
    \u0275\u0275text(4);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(5, "p");
    \u0275\u0275text(6);
    \u0275\u0275domElementEnd()();
    \u0275\u0275domElementStart(7, "div", 72);
    \u0275\u0275repeaterCreate(8, DynamicComponentComponent_Case_10_For_9_Template, 2, 2, "div", 73, _forTrack4);
    \u0275\u0275domElementEnd()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["title"]);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["subtitle"]);
    \u0275\u0275advance();
    \u0275\u0275styleProp("grid-template-columns", "repeat(" + ctx_r0.component.settings["columns"] + ", 1fr)");
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r0.component.settings["images"]);
  }
}
function DynamicComponentComponent_Case_11_For_9_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "div", 76)(1, "div", 77);
    \u0275\u0275text(2);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(3, "h4");
    \u0275\u0275text(4);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(5, "p");
    \u0275\u0275text(6);
    \u0275\u0275domElementEnd()();
  }
  if (rf & 2) {
    const member_r9 = ctx.$implicit;
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(member_r9.name.charAt(0));
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(member_r9.name);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(member_r9.role);
  }
}
function DynamicComponentComponent_Case_11_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275domElementStart(0, "section", 11)(1, "div", 13)(2, "div", 19)(3, "h2");
    \u0275\u0275text(4);
    \u0275\u0275domElementEnd();
    \u0275\u0275domElementStart(5, "p");
    \u0275\u0275text(6);
    \u0275\u0275domElementEnd()();
    \u0275\u0275domElementStart(7, "div", 75);
    \u0275\u0275repeaterCreate(8, DynamicComponentComponent_Case_11_For_9_Template, 7, 3, "div", 76, _forTrack1);
    \u0275\u0275domElementEnd()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["title"]);
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate(ctx_r0.component.settings["subtitle"]);
    \u0275\u0275advance(2);
    \u0275\u0275repeater(ctx_r0.component.settings["members"]);
  }
}
var DynamicComponentComponent = class _DynamicComponentComponent {
  getComponentName(type) {
    return COMPONENT_NAMES[type] || type;
  }
  static {
    this.\u0275fac = function DynamicComponentComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _DynamicComponentComponent)();
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _DynamicComponentComponent, selectors: [["app-dynamic-component"]], inputs: { component: "component" }, decls: 12, vars: 3, consts: [[1, "component-wrapper"], [1, "section", "hero-section", 3, "text-align"], [1, "section", "features-section"], [1, "section", "testimonials-section"], [1, "section", "cta-section", 3, "class"], [1, "section", "pricing-section"], [1, "section", "stats-section"], [1, "section", "faq-section"], [1, "section", "contact-section"], [1, "section", "newsletter-section"], [1, "section", "gallery-section"], [1, "section", "team-section"], [1, "section", "hero-section"], [1, "container"], [1, "hero-title"], [1, "hero-subtitle"], [1, "hero-buttons"], [1, "btn", "btn-primary", 3, "href"], ["href", "#", 1, "btn", "btn-secondary"], [1, "section-header"], [1, "features-grid"], [1, "feature-card"], [1, "feature-icon"], ["width", "24", "height", "24", "viewBox", "0 0 24 24", "fill", "none", "stroke", "currentColor", "stroke-width", "2"], ["points", "13 2 3 14 12 14 11 22 21 10 12 10 13 2"], [1, "testimonials-grid"], [1, "testimonial-card"], [1, "testimonial-content"], [1, "testimonial-author"], [1, "author-avatar"], [1, "author-name"], [1, "author-role"], [1, "section", "cta-section"], [1, "btn", "btn-primary", "btn-lg", 3, "href"], [1, "pricing-grid"], [1, "pricing-card", 3, "highlighted"], [1, "pricing-card"], [1, "popular-badge"], [1, "price"], [1, "currency"], [1, "amount"], [1, "period"], [1, "features-list"], ["href", "#", 1, "btn"], ["width", "16", "height", "16", "viewBox", "0 0 24 24", "fill", "none", "stroke", "currentColor", "stroke-width", "2"], ["points", "20 6 9 17 4 12"], [1, "stats-grid"], [1, "stat-card"], [1, "stat-value"], [1, "stat-label"], [1, "faq-list"], [1, "faq-item"], [1, "faq-question"], [1, "faq-answer"], [1, "contact-grid"], [1, "contact-info"], [1, "contact-details"], [1, "contact-item"], ["width", "20", "height", "20", "viewBox", "0 0 24 24", "fill", "none", "stroke", "currentColor", "stroke-width", "2"], ["d", "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"], ["points", "22,6 12,13 2,6"], ["d", "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"], ["d", "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"], ["cx", "12", "cy", "10", "r", "3"], [1, "contact-form"], [1, "form-group"], ["type", "text", "placeholder", "Your Name"], ["type", "email", "placeholder", "Your Email"], ["rows", "4", "placeholder", "Your Message"], [1, "btn", "btn-primary"], [1, "newsletter-form"], ["type", "email", 3, "placeholder"], [1, "gallery-grid"], [1, "gallery-item"], [3, "src", "alt"], [1, "team-grid"], [1, "team-card"], [1, "team-avatar"]], template: function DynamicComponentComponent_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275domElementStart(0, "div", 0);
        \u0275\u0275conditionalCreate(1, DynamicComponentComponent_Case_1_Template, 10, 8, "section", 1)(2, DynamicComponentComponent_Case_2_Template, 10, 4, "section", 2)(3, DynamicComponentComponent_Case_3_Template, 10, 2, "section", 3)(4, DynamicComponentComponent_Case_4_Template, 8, 7, "section", 4)(5, DynamicComponentComponent_Case_5_Template, 10, 2, "section", 5)(6, DynamicComponentComponent_Case_6_Template, 10, 2, "section", 6)(7, DynamicComponentComponent_Case_7_Template, 10, 2, "section", 7)(8, DynamicComponentComponent_Case_8_Template, 32, 5, "section", 8)(9, DynamicComponentComponent_Case_9_Template, 10, 5, "section", 9)(10, DynamicComponentComponent_Case_10_Template, 10, 4, "section", 10)(11, DynamicComponentComponent_Case_11_Template, 10, 2, "section", 11);
        \u0275\u0275domElementEnd();
      }
      if (rf & 2) {
        let tmp_2_0;
        \u0275\u0275attribute("data-component-id", ctx.component.id)("data-component-name", ctx.getComponentName(ctx.component.type));
        \u0275\u0275advance();
        \u0275\u0275conditional((tmp_2_0 = ctx.component.type) === "hero" ? 1 : tmp_2_0 === "features" ? 2 : tmp_2_0 === "testimonials" ? 3 : tmp_2_0 === "cta" ? 4 : tmp_2_0 === "pricing" ? 5 : tmp_2_0 === "stats" ? 6 : tmp_2_0 === "faq" ? 7 : tmp_2_0 === "contact" ? 8 : tmp_2_0 === "newsletter" ? 9 : tmp_2_0 === "gallery" ? 10 : tmp_2_0 === "team" ? 11 : -1);
      }
    }, dependencies: [CommonModule], styles: ["\n.component-wrapper[_ngcontent-%COMP%] {\n  position: relative;\n}\n.section[_ngcontent-%COMP%] {\n  padding: var(--section-padding) 0;\n}\n.container[_ngcontent-%COMP%] {\n  max-width: var(--container-width);\n  margin: 0 auto;\n  padding: 0 24px;\n}\n.section-header[_ngcontent-%COMP%] {\n  text-align: center;\n  margin-bottom: 48px;\n}\n.section-header[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {\n  font-size: 36px;\n  font-family: var(--heading-font);\n  margin-bottom: 12px;\n  color: var(--body-text);\n}\n.section-header[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {\n  font-size: 18px;\n  color: var(--body-text);\n  opacity: 0.7;\n}\n.hero-section[_ngcontent-%COMP%] {\n  min-height: 70vh;\n  display: flex;\n  align-items: center;\n  background:\n    linear-gradient(\n      135deg,\n      var(--primary) 0%,\n      var(--secondary) 100%);\n  color: white;\n}\n.hero-title[_ngcontent-%COMP%] {\n  font-size: var(--heading-font-size);\n  font-family: var(--heading-font);\n  margin-bottom: 20px;\n  line-height: 1.1;\n}\n.hero-subtitle[_ngcontent-%COMP%] {\n  font-size: 20px;\n  opacity: 0.9;\n  margin-bottom: 32px;\n  max-width: 600px;\n}\n.hero-section[style*=center][_ngcontent-%COMP%]   .hero-subtitle[_ngcontent-%COMP%] {\n  margin-left: auto;\n  margin-right: auto;\n}\n.hero-buttons[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 16px;\n  flex-wrap: wrap;\n}\n.hero-section[style*=center][_ngcontent-%COMP%]   .hero-buttons[_ngcontent-%COMP%] {\n  justify-content: center;\n}\n.btn[_ngcontent-%COMP%] {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  padding: 14px 28px;\n  border-radius: var(--border-radius);\n  font-size: 16px;\n  font-weight: 600;\n  text-decoration: none;\n  transition: all 0.3s;\n  border: none;\n  cursor: pointer;\n}\n.btn-primary[_ngcontent-%COMP%] {\n  background: var(--primary);\n  color: white;\n}\n.btn-primary[_ngcontent-%COMP%]:hover {\n  opacity: 0.9;\n  transform: translateY(-2px);\n}\n.btn-secondary[_ngcontent-%COMP%] {\n  background: transparent;\n  color: inherit;\n  border: 2px solid currentColor;\n}\n.btn-lg[_ngcontent-%COMP%] {\n  padding: 16px 36px;\n  font-size: 18px;\n}\n.hero-section[_ngcontent-%COMP%]   .btn-primary[_ngcontent-%COMP%] {\n  background: white;\n  color: var(--primary);\n}\n.hero-section[_ngcontent-%COMP%]   .btn-secondary[_ngcontent-%COMP%] {\n  border-color: white;\n  color: white;\n}\n.features-grid[_ngcontent-%COMP%] {\n  display: grid;\n  gap: 24px;\n}\n.feature-card[_ngcontent-%COMP%] {\n  padding: 32px;\n  background: var(--body-bg);\n  border: 1px solid rgba(0, 0, 0, 0.1);\n  border-radius: var(--border-radius);\n  transition: all 0.3s;\n}\n.feature-card[_ngcontent-%COMP%]:hover {\n  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);\n  transform: translateY(-4px);\n}\n.feature-icon[_ngcontent-%COMP%] {\n  width: 48px;\n  height: 48px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background:\n    linear-gradient(\n      135deg,\n      var(--primary),\n      var(--secondary));\n  border-radius: 12px;\n  color: white;\n  margin-bottom: 16px;\n}\n.feature-card[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%] {\n  font-size: 18px;\n  margin-bottom: 8px;\n  color: var(--body-text);\n}\n.feature-card[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {\n  font-size: 14px;\n  color: var(--body-text);\n  opacity: 0.7;\n}\n.testimonials-grid[_ngcontent-%COMP%] {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 24px;\n}\n.testimonial-card[_ngcontent-%COMP%] {\n  padding: 32px;\n  background: var(--body-bg);\n  border: 1px solid rgba(0, 0, 0, 0.1);\n  border-radius: var(--border-radius);\n}\n.testimonial-content[_ngcontent-%COMP%] {\n  font-size: 16px;\n  line-height: 1.7;\n  color: var(--body-text);\n  margin-bottom: 24px;\n}\n.testimonial-author[_ngcontent-%COMP%] {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n}\n.author-avatar[_ngcontent-%COMP%] {\n  width: 48px;\n  height: 48px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: var(--primary);\n  color: white;\n  border-radius: 50%;\n  font-weight: 600;\n}\n.author-name[_ngcontent-%COMP%] {\n  font-weight: 600;\n  color: var(--body-text);\n}\n.author-role[_ngcontent-%COMP%] {\n  font-size: 14px;\n  color: var(--body-text);\n  opacity: 0.6;\n}\n.cta-section[_ngcontent-%COMP%] {\n  text-align: center;\n}\n.cta-section.gradient[_ngcontent-%COMP%] {\n  background:\n    linear-gradient(\n      135deg,\n      var(--primary),\n      var(--secondary));\n  color: white;\n}\n.cta-section[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {\n  font-size: 36px;\n  margin-bottom: 12px;\n}\n.cta-section[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {\n  font-size: 18px;\n  opacity: 0.9;\n  margin-bottom: 32px;\n}\n.cta-section.gradient[_ngcontent-%COMP%]   .btn-primary[_ngcontent-%COMP%] {\n  background: white;\n  color: var(--primary);\n}\n.pricing-grid[_ngcontent-%COMP%] {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 24px;\n}\n.pricing-card[_ngcontent-%COMP%] {\n  padding: 32px;\n  background: var(--body-bg);\n  border: 1px solid rgba(0, 0, 0, 0.1);\n  border-radius: var(--border-radius);\n  text-align: center;\n  position: relative;\n}\n.pricing-card.highlighted[_ngcontent-%COMP%] {\n  border-color: var(--primary);\n  box-shadow: 0 10px 40px rgba(99, 102, 241, 0.2);\n}\n.popular-badge[_ngcontent-%COMP%] {\n  position: absolute;\n  top: -12px;\n  left: 50%;\n  transform: translateX(-50%);\n  padding: 4px 16px;\n  background: var(--primary);\n  color: white;\n  font-size: 12px;\n  font-weight: 600;\n  border-radius: 100px;\n}\n.pricing-card[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%] {\n  font-size: 20px;\n  margin-bottom: 16px;\n}\n.price[_ngcontent-%COMP%] {\n  margin-bottom: 24px;\n}\n.price[_ngcontent-%COMP%]   .amount[_ngcontent-%COMP%] {\n  font-size: 48px;\n  font-weight: 700;\n  color: var(--body-text);\n}\n.price[_ngcontent-%COMP%]   .currency[_ngcontent-%COMP%], \n.price[_ngcontent-%COMP%]   .period[_ngcontent-%COMP%] {\n  color: var(--body-text);\n  opacity: 0.6;\n}\n.features-list[_ngcontent-%COMP%] {\n  list-style: none;\n  margin-bottom: 24px;\n}\n.features-list[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 8px 0;\n  font-size: 14px;\n  color: var(--body-text);\n}\n.features-list[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {\n  color: var(--primary);\n}\n.stats-grid[_ngcontent-%COMP%] {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  gap: 24px;\n}\n.stat-card[_ngcontent-%COMP%] {\n  text-align: center;\n  padding: 32px;\n}\n.stat-value[_ngcontent-%COMP%] {\n  font-size: 48px;\n  font-weight: 700;\n  color: var(--primary);\n  margin-bottom: 8px;\n}\n.stat-label[_ngcontent-%COMP%] {\n  font-size: 14px;\n  color: var(--body-text);\n  opacity: 0.7;\n}\n.faq-list[_ngcontent-%COMP%] {\n  max-width: 800px;\n  margin: 0 auto;\n}\n.faq-item[_ngcontent-%COMP%] {\n  padding: 24px;\n  border-bottom: 1px solid rgba(0, 0, 0, 0.1);\n}\n.faq-question[_ngcontent-%COMP%] {\n  font-size: 18px;\n  margin-bottom: 8px;\n  color: var(--body-text);\n}\n.faq-answer[_ngcontent-%COMP%] {\n  color: var(--body-text);\n  opacity: 0.7;\n}\n.contact-grid[_ngcontent-%COMP%] {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 48px;\n}\n.contact-info[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {\n  font-size: 36px;\n  margin-bottom: 12px;\n}\n.contact-info[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {\n  color: var(--body-text);\n  opacity: 0.7;\n  margin-bottom: 32px;\n}\n.contact-item[_ngcontent-%COMP%] {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  margin-bottom: 16px;\n  color: var(--body-text);\n}\n.contact-item[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {\n  color: var(--primary);\n}\n.contact-form[_ngcontent-%COMP%]   .form-group[_ngcontent-%COMP%] {\n  margin-bottom: 16px;\n}\n.contact-form[_ngcontent-%COMP%]   input[_ngcontent-%COMP%], \n.contact-form[_ngcontent-%COMP%]   textarea[_ngcontent-%COMP%] {\n  width: 100%;\n  padding: 14px 16px;\n  border: 1px solid rgba(0, 0, 0, 0.1);\n  border-radius: var(--border-radius);\n  font-size: 16px;\n  font-family: inherit;\n}\n.contact-form[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]:focus, \n.contact-form[_ngcontent-%COMP%]   textarea[_ngcontent-%COMP%]:focus {\n  outline: none;\n  border-color: var(--primary);\n}\n.newsletter-section[_ngcontent-%COMP%] {\n  text-align: center;\n  background: var(--primary);\n  color: white;\n}\n.newsletter-section[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {\n  font-size: 36px;\n  margin-bottom: 12px;\n}\n.newsletter-section[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {\n  opacity: 0.9;\n  margin-bottom: 32px;\n}\n.newsletter-form[_ngcontent-%COMP%] {\n  display: flex;\n  max-width: 500px;\n  margin: 0 auto;\n  gap: 12px;\n}\n.newsletter-form[_ngcontent-%COMP%]   input[_ngcontent-%COMP%] {\n  flex: 1;\n  padding: 14px 16px;\n  border: none;\n  border-radius: var(--border-radius);\n  font-size: 16px;\n}\n.newsletter-form[_ngcontent-%COMP%]   .btn[_ngcontent-%COMP%] {\n  background: white;\n  color: var(--primary);\n}\n.gallery-grid[_ngcontent-%COMP%] {\n  display: grid;\n  gap: 16px;\n}\n.gallery-item[_ngcontent-%COMP%] {\n  border-radius: var(--border-radius);\n  overflow: hidden;\n}\n.gallery-item[_ngcontent-%COMP%]   img[_ngcontent-%COMP%] {\n  width: 100%;\n  height: 200px;\n  object-fit: cover;\n  transition: transform 0.3s;\n}\n.gallery-item[_ngcontent-%COMP%]:hover   img[_ngcontent-%COMP%] {\n  transform: scale(1.05);\n}\n.team-grid[_ngcontent-%COMP%] {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  gap: 24px;\n}\n.team-card[_ngcontent-%COMP%] {\n  text-align: center;\n  padding: 32px;\n}\n.team-avatar[_ngcontent-%COMP%] {\n  width: 80px;\n  height: 80px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: var(--primary);\n  color: white;\n  border-radius: 50%;\n  font-size: 32px;\n  font-weight: 600;\n  margin: 0 auto 16px;\n}\n.team-card[_ngcontent-%COMP%]   h4[_ngcontent-%COMP%] {\n  font-size: 18px;\n  margin-bottom: 4px;\n  color: var(--body-text);\n}\n.team-card[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {\n  font-size: 14px;\n  color: var(--body-text);\n  opacity: 0.6;\n}\n@media (max-width: 1024px) {\n  .testimonials-grid[_ngcontent-%COMP%], \n   .pricing-grid[_ngcontent-%COMP%] {\n    grid-template-columns: 1fr;\n  }\n  .stats-grid[_ngcontent-%COMP%], \n   .team-grid[_ngcontent-%COMP%] {\n    grid-template-columns: repeat(2, 1fr);\n  }\n  .contact-grid[_ngcontent-%COMP%] {\n    grid-template-columns: 1fr;\n  }\n}\n@media (max-width: 640px) {\n  .stats-grid[_ngcontent-%COMP%], \n   .team-grid[_ngcontent-%COMP%] {\n    grid-template-columns: 1fr;\n  }\n  .newsletter-form[_ngcontent-%COMP%] {\n    flex-direction: column;\n  }\n}\n/*# sourceMappingURL=dynamic-component.component.css.map */"] });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(DynamicComponentComponent, [{
    type: Component,
    args: [{ selector: "app-dynamic-component", standalone: true, imports: [CommonModule], template: `
    <div 
      class="component-wrapper"
      [attr.data-component-id]="component.id"
      [attr.data-component-name]="getComponentName(component.type)">
      @switch (component.type) {
        @case ('hero') {
          <section class="section hero-section" [style.text-align]="component.settings['alignment']">
            <div class="container">
              <h1 class="hero-title">{{ component.settings['title'] }}</h1>
              <p class="hero-subtitle">{{ component.settings['subtitle'] }}</p>
              <div class="hero-buttons">
                <a href="{{ component.settings['buttonLink'] }}" class="btn btn-primary">
                  {{ component.settings['buttonText'] }}
                </a>
                @if (component.settings['showSecondaryButton']) {
                  <a href="#" class="btn btn-secondary">
                    {{ component.settings['secondaryButtonText'] }}
                  </a>
                }
              </div>
            </div>
          </section>
        }
      
      @case ('features') {
        <section class="section features-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="features-grid" [style.grid-template-columns]="'repeat(' + component.settings['columns'] + ', 1fr)'">
              @for (feature of component.settings['features']; track feature.title) {
                <div class="feature-card">
                  <div class="feature-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  </div>
                  <h3>{{ feature.title }}</h3>
                  <p>{{ feature.description }}</p>
                </div>
              }
            </div>
          </div>
        </section>
      }
      
      @case ('testimonials') {
        <section class="section testimonials-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="testimonials-grid">
              @for (testimonial of component.settings['testimonials']; track testimonial.name) {
                <div class="testimonial-card">
                  <p class="testimonial-content">"{{ testimonial.content }}"</p>
                  <div class="testimonial-author">
                    <div class="author-avatar">{{ testimonial.name.charAt(0) }}</div>
                    <div>
                      <div class="author-name">{{ testimonial.name }}</div>
                      <div class="author-role">{{ testimonial.role }}</div>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </section>
      }
      
      @case ('cta') {
        <section class="section cta-section" [class]="component.settings['style']">
          <div class="container">
            <h2>{{ component.settings['title'] }}</h2>
            <p>{{ component.settings['subtitle'] }}</p>
            <a href="{{ component.settings['buttonLink'] }}" class="btn btn-primary btn-lg">
              {{ component.settings['buttonText'] }}
            </a>
          </div>
        </section>
      }
      
      @case ('pricing') {
        <section class="section pricing-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="pricing-grid">
              @for (plan of component.settings['plans']; track plan.name) {
                <div class="pricing-card" [class.highlighted]="plan.highlighted">
                  @if (plan.highlighted) {
                    <div class="popular-badge">Most Popular</div>
                  }
                  <h3>{{ plan.name }}</h3>
                  <div class="price">
                    <span class="currency">$</span>
                    <span class="amount">{{ plan.price }}</span>
                    <span class="period">/{{ plan.period }}</span>
                  </div>
                  <ul class="features-list">
                    @for (feature of plan.features; track feature) {
                      <li>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        {{ feature }}
                      </li>
                    }
                  </ul>
                  <a href="#" class="btn" [class.btn-primary]="plan.highlighted" [class.btn-secondary]="!plan.highlighted">
                    Get Started
                  </a>
                </div>
              }
            </div>
          </div>
        </section>
      }
      
      @case ('stats') {
        <section class="section stats-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="stats-grid">
              @for (stat of component.settings['stats']; track stat.label) {
                <div class="stat-card">
                  <div class="stat-value">{{ stat.value }}</div>
                  <div class="stat-label">{{ stat.label }}</div>
                </div>
              }
            </div>
          </div>
        </section>
      }
      
      @case ('faq') {
        <section class="section faq-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="faq-list">
              @for (faq of component.settings['faqs']; track faq.question) {
                <div class="faq-item">
                  <h4 class="faq-question">{{ faq.question }}</h4>
                  <p class="faq-answer">{{ faq.answer }}</p>
                </div>
              }
            </div>
          </div>
        </section>
      }
      
      @case ('contact') {
        <section class="section contact-section">
          <div class="container">
            <div class="contact-grid">
              <div class="contact-info">
                <h2>{{ component.settings['title'] }}</h2>
                <p>{{ component.settings['subtitle'] }}</p>
                <div class="contact-details">
                  <div class="contact-item">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    {{ component.settings['email'] }}
                  </div>
                  <div class="contact-item">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                    </svg>
                    {{ component.settings['phone'] }}
                  </div>
                  <div class="contact-item">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    {{ component.settings['address'] }}
                  </div>
                </div>
              </div>
              <div class="contact-form">
                <div class="form-group">
                  <input type="text" placeholder="Your Name">
                </div>
                <div class="form-group">
                  <input type="email" placeholder="Your Email">
                </div>
                <div class="form-group">
                  <textarea rows="4" placeholder="Your Message"></textarea>
                </div>
                <button class="btn btn-primary">Send Message</button>
              </div>
            </div>
          </div>
        </section>
      }
      
      @case ('newsletter') {
        <section class="section newsletter-section">
          <div class="container">
            <h2>{{ component.settings['title'] }}</h2>
            <p>{{ component.settings['subtitle'] }}</p>
            <div class="newsletter-form">
              <input type="email" placeholder="{{ component.settings['placeholder'] }}">
              <button class="btn btn-primary">{{ component.settings['buttonText'] }}</button>
            </div>
          </div>
        </section>
      }
      
      @case ('gallery') {
        <section class="section gallery-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="gallery-grid" [style.grid-template-columns]="'repeat(' + component.settings['columns'] + ', 1fr)'">
              @for (image of component.settings['images']; track image.src) {
                <div class="gallery-item">
                  <img [src]="image.src" [alt]="image.alt">
                </div>
              }
            </div>
          </div>
        </section>
      }
      
      @case ('team') {
        <section class="section team-section">
          <div class="container">
            <div class="section-header">
              <h2>{{ component.settings['title'] }}</h2>
              <p>{{ component.settings['subtitle'] }}</p>
            </div>
            <div class="team-grid">
              @for (member of component.settings['members']; track member.name) {
                <div class="team-card">
                  <div class="team-avatar">{{ member.name.charAt(0) }}</div>
                  <h4>{{ member.name }}</h4>
                  <p>{{ member.role }}</p>
                </div>
              }
            </div>
          </div>
        </section>
      }
    }
    </div>
  `, styles: ["/* angular:styles/component:css;a7a8d4ac93b6b08cbee8d7c6040ee9c39711d63278940eda722c3a84507896d5;D:/Users/Invo/Downloads/angular-customizer/website/src/app/components/dynamic/dynamic-component.component.ts */\n.component-wrapper {\n  position: relative;\n}\n.section {\n  padding: var(--section-padding) 0;\n}\n.container {\n  max-width: var(--container-width);\n  margin: 0 auto;\n  padding: 0 24px;\n}\n.section-header {\n  text-align: center;\n  margin-bottom: 48px;\n}\n.section-header h2 {\n  font-size: 36px;\n  font-family: var(--heading-font);\n  margin-bottom: 12px;\n  color: var(--body-text);\n}\n.section-header p {\n  font-size: 18px;\n  color: var(--body-text);\n  opacity: 0.7;\n}\n.hero-section {\n  min-height: 70vh;\n  display: flex;\n  align-items: center;\n  background:\n    linear-gradient(\n      135deg,\n      var(--primary) 0%,\n      var(--secondary) 100%);\n  color: white;\n}\n.hero-title {\n  font-size: var(--heading-font-size);\n  font-family: var(--heading-font);\n  margin-bottom: 20px;\n  line-height: 1.1;\n}\n.hero-subtitle {\n  font-size: 20px;\n  opacity: 0.9;\n  margin-bottom: 32px;\n  max-width: 600px;\n}\n.hero-section[style*=center] .hero-subtitle {\n  margin-left: auto;\n  margin-right: auto;\n}\n.hero-buttons {\n  display: flex;\n  gap: 16px;\n  flex-wrap: wrap;\n}\n.hero-section[style*=center] .hero-buttons {\n  justify-content: center;\n}\n.btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  padding: 14px 28px;\n  border-radius: var(--border-radius);\n  font-size: 16px;\n  font-weight: 600;\n  text-decoration: none;\n  transition: all 0.3s;\n  border: none;\n  cursor: pointer;\n}\n.btn-primary {\n  background: var(--primary);\n  color: white;\n}\n.btn-primary:hover {\n  opacity: 0.9;\n  transform: translateY(-2px);\n}\n.btn-secondary {\n  background: transparent;\n  color: inherit;\n  border: 2px solid currentColor;\n}\n.btn-lg {\n  padding: 16px 36px;\n  font-size: 18px;\n}\n.hero-section .btn-primary {\n  background: white;\n  color: var(--primary);\n}\n.hero-section .btn-secondary {\n  border-color: white;\n  color: white;\n}\n.features-grid {\n  display: grid;\n  gap: 24px;\n}\n.feature-card {\n  padding: 32px;\n  background: var(--body-bg);\n  border: 1px solid rgba(0, 0, 0, 0.1);\n  border-radius: var(--border-radius);\n  transition: all 0.3s;\n}\n.feature-card:hover {\n  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);\n  transform: translateY(-4px);\n}\n.feature-icon {\n  width: 48px;\n  height: 48px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background:\n    linear-gradient(\n      135deg,\n      var(--primary),\n      var(--secondary));\n  border-radius: 12px;\n  color: white;\n  margin-bottom: 16px;\n}\n.feature-card h3 {\n  font-size: 18px;\n  margin-bottom: 8px;\n  color: var(--body-text);\n}\n.feature-card p {\n  font-size: 14px;\n  color: var(--body-text);\n  opacity: 0.7;\n}\n.testimonials-grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 24px;\n}\n.testimonial-card {\n  padding: 32px;\n  background: var(--body-bg);\n  border: 1px solid rgba(0, 0, 0, 0.1);\n  border-radius: var(--border-radius);\n}\n.testimonial-content {\n  font-size: 16px;\n  line-height: 1.7;\n  color: var(--body-text);\n  margin-bottom: 24px;\n}\n.testimonial-author {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n}\n.author-avatar {\n  width: 48px;\n  height: 48px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: var(--primary);\n  color: white;\n  border-radius: 50%;\n  font-weight: 600;\n}\n.author-name {\n  font-weight: 600;\n  color: var(--body-text);\n}\n.author-role {\n  font-size: 14px;\n  color: var(--body-text);\n  opacity: 0.6;\n}\n.cta-section {\n  text-align: center;\n}\n.cta-section.gradient {\n  background:\n    linear-gradient(\n      135deg,\n      var(--primary),\n      var(--secondary));\n  color: white;\n}\n.cta-section h2 {\n  font-size: 36px;\n  margin-bottom: 12px;\n}\n.cta-section p {\n  font-size: 18px;\n  opacity: 0.9;\n  margin-bottom: 32px;\n}\n.cta-section.gradient .btn-primary {\n  background: white;\n  color: var(--primary);\n}\n.pricing-grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 24px;\n}\n.pricing-card {\n  padding: 32px;\n  background: var(--body-bg);\n  border: 1px solid rgba(0, 0, 0, 0.1);\n  border-radius: var(--border-radius);\n  text-align: center;\n  position: relative;\n}\n.pricing-card.highlighted {\n  border-color: var(--primary);\n  box-shadow: 0 10px 40px rgba(99, 102, 241, 0.2);\n}\n.popular-badge {\n  position: absolute;\n  top: -12px;\n  left: 50%;\n  transform: translateX(-50%);\n  padding: 4px 16px;\n  background: var(--primary);\n  color: white;\n  font-size: 12px;\n  font-weight: 600;\n  border-radius: 100px;\n}\n.pricing-card h3 {\n  font-size: 20px;\n  margin-bottom: 16px;\n}\n.price {\n  margin-bottom: 24px;\n}\n.price .amount {\n  font-size: 48px;\n  font-weight: 700;\n  color: var(--body-text);\n}\n.price .currency,\n.price .period {\n  color: var(--body-text);\n  opacity: 0.6;\n}\n.features-list {\n  list-style: none;\n  margin-bottom: 24px;\n}\n.features-list li {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 8px 0;\n  font-size: 14px;\n  color: var(--body-text);\n}\n.features-list svg {\n  color: var(--primary);\n}\n.stats-grid {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  gap: 24px;\n}\n.stat-card {\n  text-align: center;\n  padding: 32px;\n}\n.stat-value {\n  font-size: 48px;\n  font-weight: 700;\n  color: var(--primary);\n  margin-bottom: 8px;\n}\n.stat-label {\n  font-size: 14px;\n  color: var(--body-text);\n  opacity: 0.7;\n}\n.faq-list {\n  max-width: 800px;\n  margin: 0 auto;\n}\n.faq-item {\n  padding: 24px;\n  border-bottom: 1px solid rgba(0, 0, 0, 0.1);\n}\n.faq-question {\n  font-size: 18px;\n  margin-bottom: 8px;\n  color: var(--body-text);\n}\n.faq-answer {\n  color: var(--body-text);\n  opacity: 0.7;\n}\n.contact-grid {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 48px;\n}\n.contact-info h2 {\n  font-size: 36px;\n  margin-bottom: 12px;\n}\n.contact-info p {\n  color: var(--body-text);\n  opacity: 0.7;\n  margin-bottom: 32px;\n}\n.contact-item {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  margin-bottom: 16px;\n  color: var(--body-text);\n}\n.contact-item svg {\n  color: var(--primary);\n}\n.contact-form .form-group {\n  margin-bottom: 16px;\n}\n.contact-form input,\n.contact-form textarea {\n  width: 100%;\n  padding: 14px 16px;\n  border: 1px solid rgba(0, 0, 0, 0.1);\n  border-radius: var(--border-radius);\n  font-size: 16px;\n  font-family: inherit;\n}\n.contact-form input:focus,\n.contact-form textarea:focus {\n  outline: none;\n  border-color: var(--primary);\n}\n.newsletter-section {\n  text-align: center;\n  background: var(--primary);\n  color: white;\n}\n.newsletter-section h2 {\n  font-size: 36px;\n  margin-bottom: 12px;\n}\n.newsletter-section p {\n  opacity: 0.9;\n  margin-bottom: 32px;\n}\n.newsletter-form {\n  display: flex;\n  max-width: 500px;\n  margin: 0 auto;\n  gap: 12px;\n}\n.newsletter-form input {\n  flex: 1;\n  padding: 14px 16px;\n  border: none;\n  border-radius: var(--border-radius);\n  font-size: 16px;\n}\n.newsletter-form .btn {\n  background: white;\n  color: var(--primary);\n}\n.gallery-grid {\n  display: grid;\n  gap: 16px;\n}\n.gallery-item {\n  border-radius: var(--border-radius);\n  overflow: hidden;\n}\n.gallery-item img {\n  width: 100%;\n  height: 200px;\n  object-fit: cover;\n  transition: transform 0.3s;\n}\n.gallery-item:hover img {\n  transform: scale(1.05);\n}\n.team-grid {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  gap: 24px;\n}\n.team-card {\n  text-align: center;\n  padding: 32px;\n}\n.team-avatar {\n  width: 80px;\n  height: 80px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: var(--primary);\n  color: white;\n  border-radius: 50%;\n  font-size: 32px;\n  font-weight: 600;\n  margin: 0 auto 16px;\n}\n.team-card h4 {\n  font-size: 18px;\n  margin-bottom: 4px;\n  color: var(--body-text);\n}\n.team-card p {\n  font-size: 14px;\n  color: var(--body-text);\n  opacity: 0.6;\n}\n@media (max-width: 1024px) {\n  .testimonials-grid,\n  .pricing-grid {\n    grid-template-columns: 1fr;\n  }\n  .stats-grid,\n  .team-grid {\n    grid-template-columns: repeat(2, 1fr);\n  }\n  .contact-grid {\n    grid-template-columns: 1fr;\n  }\n}\n@media (max-width: 640px) {\n  .stats-grid,\n  .team-grid {\n    grid-template-columns: 1fr;\n  }\n  .newsletter-form {\n    flex-direction: column;\n  }\n}\n/*# sourceMappingURL=dynamic-component.component.css.map */\n"] }]
  }], null, { component: [{
    type: Input
  }] });
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(DynamicComponentComponent, { className: "DynamicComponentComponent", filePath: "src/app/components/dynamic/dynamic-component.component.ts", lineNumber: 804 });
})();

// src/app/services/preview.service.ts
var PreviewService = class _PreviewService {
  constructor() {
    this.isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    this.allowedOrigins = /* @__PURE__ */ new Set();
    this.allowAnyOrigin = false;
    this._isCustomizeMode = signal(false, ...ngDevMode ? [{ debugName: "_isCustomizeMode" }] : (
      /* istanbul ignore next */
      []
    ));
    this._globalSettings = signal(__spreadValues({}, DEFAULT_GLOBAL_SETTINGS), ...ngDevMode ? [{ debugName: "_globalSettings" }] : (
      /* istanbul ignore next */
      []
    ));
    this._components = signal([], ...ngDevMode ? [{ debugName: "_components" }] : (
      /* istanbul ignore next */
      []
    ));
    this.isCustomizeMode = computed(() => this._isCustomizeMode(), ...ngDevMode ? [{ debugName: "isCustomizeMode" }] : (
      /* istanbul ignore next */
      []
    ));
    this.globalSettings = computed(() => this._globalSettings(), ...ngDevMode ? [{ debugName: "globalSettings" }] : (
      /* istanbul ignore next */
      []
    ));
    this.components = computed(() => this._components(), ...ngDevMode ? [{ debugName: "components" }] : (
      /* istanbul ignore next */
      []
    ));
    this.init();
  }
  init() {
    if (!this.isBrowser)
      return;
    const urlParams = new URLSearchParams(window.location.search);
    const customizeMode = urlParams.get("customize") === "true";
    if (!customizeMode)
      return;
    this.resolveAllowedOrigins();
    this._isCustomizeMode.set(true);
    document.body.classList.add("customize-mode");
    this.setupMessageListener();
    setTimeout(() => this.notifyReady(), 100);
  }
  resolveAllowedOrigins() {
    const origins = /* @__PURE__ */ new Set();
    const add = (o) => {
      if (typeof o !== "string")
        return;
      const trimmed = o.trim();
      if (!trimmed)
        return;
      origins.add(trimmed);
    };
    add(environment.dashboardUrl);
    (environment.customizerOriginsAllowed || []).forEach(add);
    const w = window;
    add(w.__DASHBOARD_ORIGIN__);
    if (Array.isArray(w.__CUSTOMIZER_ORIGINS__)) {
      w.__CUSTOMIZER_ORIGINS__.forEach(add);
    }
    add(w.__APP_CONFIG__?.dashboardOrigin);
    if (window.location?.origin)
      origins.add(window.location.origin);
    this.allowedOrigins = origins;
    const meaningful = [...origins].filter((o) => o !== window.location?.origin);
    if (meaningful.length === 0) {
      this.allowAnyOrigin = true;
      console.warn("[PreviewService] No dashboard origin configured \u2014 accepting postMessage from any origin. Set DASHBOARD_ORIGIN in the SSR env or window.__DASHBOARD_ORIGIN__ to lock this down.");
    } else {
      console.info("[PreviewService] Allowed customizer origins:", [...origins]);
    }
  }
  isOriginAllowed(origin) {
    if (this.allowAnyOrigin)
      return true;
    return this.allowedOrigins.has(origin);
  }
  /** Pick a concrete origin to use as postMessage's targetOrigin.
   *  Prefers anything other than the page's own origin (because the
   *  iframe needs to message its PARENT, which is the dashboard).
   *  Returns '*' as a last resort. */
  targetOriginForParent() {
    if (this.allowAnyOrigin)
      return "*";
    const myOrigin = window.location?.origin;
    for (const o of this.allowedOrigins) {
      if (o !== myOrigin)
        return o;
    }
    return "*";
  }
  setupMessageListener() {
    window.addEventListener("message", (event) => {
      if (!this.isOriginAllowed(event.origin))
        return;
      this.handleMessage(event.data);
    });
  }
  handleMessage(data) {
    switch (data.type) {
      case "page-data":
        if (data.pageData) {
          this.applyPageData(data.pageData);
        }
        break;
      case "sync-all":
        if (data.settings) {
          this.applyGlobalSettings(data.settings);
        }
        break;
      case "scroll-to-component":
        if (data.componentId) {
          this.scrollToComponent(data.componentId);
        }
        break;
      case "reset":
        this.applyPageData({
          globalSettings: DEFAULT_GLOBAL_SETTINGS,
          components: []
        });
        break;
    }
  }
  scrollToComponent(componentId) {
    const element = document.querySelector(`[data-component-id="${componentId}"]`);
    if (element) {
      document.querySelectorAll(".component-highlight").forEach((el) => {
        el.classList.remove("component-highlight");
      });
      element.classList.add("component-highlight");
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        element.classList.remove("component-highlight");
      }, 2e3);
    }
  }
  applyPageData(pageData) {
    this._globalSettings.set(__spreadValues({}, pageData.globalSettings));
    this._components.set([...pageData.components]);
    this.applyGlobalSettings(pageData.globalSettings);
  }
  applyGlobalSettings(settings) {
    const root = document.documentElement;
    root.style.setProperty("--header-bg", settings.headerBgColor);
    root.style.setProperty("--header-text", settings.headerTextColor);
    root.style.setProperty("--body-bg", settings.bodyBgColor);
    root.style.setProperty("--body-text", settings.bodyTextColor);
    root.style.setProperty("--primary", settings.primaryColor);
    root.style.setProperty("--secondary", settings.secondaryColor);
    root.style.setProperty("--accent", settings.accentColor);
    root.style.setProperty("--font-family", `'${settings.fontFamily}', sans-serif`);
    root.style.setProperty("--heading-font", `'${settings.headingFontFamily}', sans-serif`);
    root.style.setProperty("--base-font-size", `${settings.baseFontSize}px`);
    root.style.setProperty("--heading-font-size", `${settings.headingFontSize}px`);
    root.style.setProperty("--line-height", settings.lineHeight.toString());
    root.style.setProperty("--font-weight", settings.fontWeight.toString());
    root.style.setProperty("--container-width", `${settings.containerWidth}px`);
    root.style.setProperty("--header-height", `${settings.headerHeight}px`);
    root.style.setProperty("--section-padding", `${settings.sectionPadding}px`);
    root.style.setProperty("--border-radius", `${settings.borderRadius}px`);
  }
  notifyReady() {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "preview-ready" }, this.targetOriginForParent());
    }
  }
  static {
    this.\u0275fac = function PreviewService_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _PreviewService)();
    };
  }
  static {
    this.\u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _PreviewService, factory: _PreviewService.\u0275fac, providedIn: "root" });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PreviewService, [{
    type: Injectable,
    args: [{
      providedIn: "root"
    }]
  }], () => [], null);
})();

// src/app/customizer-root.component.ts
var _forTrack02 = ($index, $item) => $item.id;
function CustomizerRoot_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "header", 5)(1, "div", 6)(2, "div", 7);
    \u0275\u0275namespaceSVG();
    \u0275\u0275elementStart(3, "svg", 8);
    \u0275\u0275element(4, "rect", 9)(5, "path", 10);
    \u0275\u0275elementEnd();
    \u0275\u0275namespaceHTML();
    \u0275\u0275elementStart(6, "span");
    \u0275\u0275text(7);
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(8, "nav", 11)(9, "a", 12);
    \u0275\u0275text(10, "Home");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(11, "a", 12);
    \u0275\u0275text(12, "Features");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(13, "a", 12);
    \u0275\u0275text(14, "Pricing");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(15, "a", 12);
    \u0275\u0275text(16, "About");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(17, "a", 12);
    \u0275\u0275text(18, "Contact");
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(19, "div", 13)(20, "a", 14);
    \u0275\u0275text(21, "Sign In");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(22, "a", 15);
    \u0275\u0275text(23, "Get Started");
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275classProp("sticky", ctx_r0.settings().stickyHeader);
    \u0275\u0275advance(4);
    \u0275\u0275attribute("fill", ctx_r0.settings().primaryColor);
    \u0275\u0275advance(3);
    \u0275\u0275textInterpolate(ctx_r0.settings().siteTitle);
  }
}
function CustomizerRoot_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 2)(1, "h2");
    \u0275\u0275text(2, "Start Building Your Page");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(3, "p");
    \u0275\u0275text(4, "Add components from the library to get started");
    \u0275\u0275elementEnd()();
  }
}
function CustomizerRoot_Conditional_4_For_1_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275element(0, "app-dynamic-component", 16);
  }
  if (rf & 2) {
    const component_r2 = ctx.$implicit;
    \u0275\u0275property("component", component_r2);
  }
}
function CustomizerRoot_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275repeaterCreate(0, CustomizerRoot_Conditional_4_For_1_Template, 1, 1, "app-dynamic-component", 16, _forTrack02);
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275repeater(ctx_r0.sortedComponents());
  }
}
function CustomizerRoot_Conditional_5_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "footer", 3)(1, "div", 17)(2, "div", 18)(3, "p");
    \u0275\u0275text(4);
    \u0275\u0275elementEnd()()()();
  }
  if (rf & 2) {
    const ctx_r0 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r0.settings().footerText);
  }
}
function CustomizerRoot_Conditional_6_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "div", 4);
    \u0275\u0275text(1, "Preview Mode");
    \u0275\u0275elementEnd();
  }
}
var CustomizerRoot = class _CustomizerRoot {
  constructor(previewService) {
    this.previewService = previewService;
    this.isCustomizeMode = false;
    this.sortedComponents = computed(() => [...this.previewService.components()].sort((a, b) => a.order - b.order), ...ngDevMode ? [{ debugName: "sortedComponents" }] : (
      /* istanbul ignore next */
      []
    ));
    this.isCustomizeMode = this.previewService.isCustomizeMode();
  }
  get settings() {
    return this.previewService.globalSettings;
  }
  get components() {
    return this.previewService.components;
  }
  static {
    this.\u0275fac = function CustomizerRoot_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _CustomizerRoot)(\u0275\u0275directiveInject(PreviewService));
    };
  }
  static {
    this.\u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _CustomizerRoot, selectors: [["app-customizer-root"]], decls: 7, vars: 4, consts: [[1, "site-wrapper"], [1, "site-header", 3, "sticky"], [1, "empty-page"], [1, "site-footer"], [1, "customize-badge"], [1, "site-header"], [1, "container", "header-content"], [1, "logo"], ["width", "32", "height", "32", "viewBox", "0 0 32 32", "fill", "none"], ["width", "32", "height", "32", "rx", "8"], ["d", "M10 16L14 20L22 12", "stroke", "white", "stroke-width", "2.5", "stroke-linecap", "round", "stroke-linejoin", "round"], [1, "main-nav"], ["href", "#"], [1, "header-actions"], ["href", "#", 1, "btn", "btn-secondary"], ["href", "#", 1, "btn", "btn-primary"], [3, "component"], [1, "container"], [1, "footer-bottom"]], template: function CustomizerRoot_Template(rf, ctx) {
      if (rf & 1) {
        \u0275\u0275elementStart(0, "div", 0);
        \u0275\u0275conditionalCreate(1, CustomizerRoot_Conditional_1_Template, 24, 4, "header", 1);
        \u0275\u0275elementStart(2, "main");
        \u0275\u0275conditionalCreate(3, CustomizerRoot_Conditional_3_Template, 5, 0, "div", 2)(4, CustomizerRoot_Conditional_4_Template, 2, 0);
        \u0275\u0275elementEnd();
        \u0275\u0275conditionalCreate(5, CustomizerRoot_Conditional_5_Template, 5, 1, "footer", 3);
        \u0275\u0275conditionalCreate(6, CustomizerRoot_Conditional_6_Template, 2, 0, "div", 4);
        \u0275\u0275elementEnd();
      }
      if (rf & 2) {
        \u0275\u0275advance();
        \u0275\u0275conditional(ctx.settings().showHeader ? 1 : -1);
        \u0275\u0275advance(2);
        \u0275\u0275conditional(ctx.components().length === 0 ? 3 : 4);
        \u0275\u0275advance(2);
        \u0275\u0275conditional(ctx.settings().showFooter ? 5 : -1);
        \u0275\u0275advance();
        \u0275\u0275conditional(ctx.isCustomizeMode ? 6 : -1);
      }
    }, dependencies: [CommonModule, DynamicComponentComponent], styles: ["\n.site-wrapper[_ngcontent-%COMP%] {\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n  background: var(--body-bg);\n  color: var(--body-text);\n}\n.container[_ngcontent-%COMP%] {\n  max-width: var(--container-width, 1200px);\n  margin: 0 auto;\n  padding: 0 24px;\n}\nmain[_ngcontent-%COMP%] {\n  flex: 1;\n}\n.site-header[_ngcontent-%COMP%] {\n  background: var(--header-bg);\n  height: var(--header-height, 64px);\n  display: flex;\n  align-items: center;\n  border-bottom: 1px solid rgba(0, 0, 0, .1);\n}\n.site-header.sticky[_ngcontent-%COMP%] {\n  position: sticky;\n  top: 0;\n  z-index: 100;\n}\n.header-content[_ngcontent-%COMP%] {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  width: 100%;\n}\n.logo[_ngcontent-%COMP%] {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  font-weight: 700;\n  color: var(--header-text);\n}\n.main-nav[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 32px;\n}\n.main-nav[_ngcontent-%COMP%]   a[_ngcontent-%COMP%] {\n  color: var(--header-text);\n  text-decoration: none;\n  font-size: 14px;\n  opacity: .8;\n}\n.header-actions[_ngcontent-%COMP%] {\n  display: flex;\n  gap: 12px;\n}\n.btn[_ngcontent-%COMP%] {\n  padding: 10px 20px;\n  border-radius: var(--border-radius, 8px);\n  font-size: 14px;\n  text-decoration: none;\n  cursor: pointer;\n}\n.btn-primary[_ngcontent-%COMP%] {\n  background: var(--primary);\n  color: #fff;\n}\n.btn-secondary[_ngcontent-%COMP%] {\n  background: transparent;\n  color: var(--header-text);\n  border: 1px solid rgba(0, 0, 0, .1);\n}\n.empty-page[_ngcontent-%COMP%] {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  min-height: 60vh;\n  text-align: center;\n  opacity: .5;\n}\n.site-footer[_ngcontent-%COMP%] {\n  background: var(--header-bg);\n  color: var(--header-text);\n  padding: 60px 0 24px;\n  margin-top: auto;\n}\n.footer-bottom[_ngcontent-%COMP%] {\n  padding-top: 24px;\n  text-align: center;\n}\n.customize-badge[_ngcontent-%COMP%] {\n  position: fixed;\n  bottom: 16px;\n  right: 16px;\n  padding: 8px 14px;\n  background: var(--primary);\n  color: #fff;\n  border-radius: 100px;\n  font-size: 12px;\n  box-shadow: 0 4px 12px rgba(99, 102, 241, .4);\n  z-index: 9999;\n}\n/*# sourceMappingURL=customizer-root.component.css.map */"] });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(CustomizerRoot, [{
    type: Component,
    args: [{ selector: "app-customizer-root", standalone: true, imports: [CommonModule, DynamicComponentComponent], template: `
    <div class="site-wrapper">
      @if (settings().showHeader) {
        <header class="site-header" [class.sticky]="settings().stickyHeader">
          <div class="container header-content">
            <div class="logo">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" [attr.fill]="settings().primaryColor"/>
                <path d="M10 16L14 20L22 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>{{ settings().siteTitle }}</span>
            </div>
            <nav class="main-nav">
              <a href="#">Home</a>
              <a href="#">Features</a>
              <a href="#">Pricing</a>
              <a href="#">About</a>
              <a href="#">Contact</a>
            </nav>
            <div class="header-actions">
              <a href="#" class="btn btn-secondary">Sign In</a>
              <a href="#" class="btn btn-primary">Get Started</a>
            </div>
          </div>
        </header>
      }

      <main>
        @if (components().length === 0) {
          <div class="empty-page">
            <h2>Start Building Your Page</h2>
            <p>Add components from the library to get started</p>
          </div>
        } @else {
          @for (component of sortedComponents(); track component.id) {
            <app-dynamic-component [component]="component"></app-dynamic-component>
          }
        }
      </main>

      @if (settings().showFooter) {
        <footer class="site-footer">
          <div class="container">
            <div class="footer-bottom">
              <p>{{ settings().footerText }}</p>
            </div>
          </div>
        </footer>
      }

      @if (isCustomizeMode) {
        <div class="customize-badge">Preview Mode</div>
      }
    </div>
  `, styles: ["/* angular:styles/component:css;f09fcd2c27413c67fc956b92c21cf5a907e9da528c384de09fb0fa929dd54100;D:/Users/Invo/Downloads/angular-customizer/website/src/app/customizer-root.component.ts */\n.site-wrapper {\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n  background: var(--body-bg);\n  color: var(--body-text);\n}\n.container {\n  max-width: var(--container-width, 1200px);\n  margin: 0 auto;\n  padding: 0 24px;\n}\nmain {\n  flex: 1;\n}\n.site-header {\n  background: var(--header-bg);\n  height: var(--header-height, 64px);\n  display: flex;\n  align-items: center;\n  border-bottom: 1px solid rgba(0, 0, 0, .1);\n}\n.site-header.sticky {\n  position: sticky;\n  top: 0;\n  z-index: 100;\n}\n.header-content {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  width: 100%;\n}\n.logo {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  font-weight: 700;\n  color: var(--header-text);\n}\n.main-nav {\n  display: flex;\n  gap: 32px;\n}\n.main-nav a {\n  color: var(--header-text);\n  text-decoration: none;\n  font-size: 14px;\n  opacity: .8;\n}\n.header-actions {\n  display: flex;\n  gap: 12px;\n}\n.btn {\n  padding: 10px 20px;\n  border-radius: var(--border-radius, 8px);\n  font-size: 14px;\n  text-decoration: none;\n  cursor: pointer;\n}\n.btn-primary {\n  background: var(--primary);\n  color: #fff;\n}\n.btn-secondary {\n  background: transparent;\n  color: var(--header-text);\n  border: 1px solid rgba(0, 0, 0, .1);\n}\n.empty-page {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  min-height: 60vh;\n  text-align: center;\n  opacity: .5;\n}\n.site-footer {\n  background: var(--header-bg);\n  color: var(--header-text);\n  padding: 60px 0 24px;\n  margin-top: auto;\n}\n.footer-bottom {\n  padding-top: 24px;\n  text-align: center;\n}\n.customize-badge {\n  position: fixed;\n  bottom: 16px;\n  right: 16px;\n  padding: 8px 14px;\n  background: var(--primary);\n  color: #fff;\n  border-radius: 100px;\n  font-size: 12px;\n  box-shadow: 0 4px 12px rgba(99, 102, 241, .4);\n  z-index: 9999;\n}\n/*# sourceMappingURL=customizer-root.component.css.map */\n"] }]
  }], () => [{ type: PreviewService }], null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(CustomizerRoot, { className: "CustomizerRoot", filePath: "src/app/customizer-root.component.ts", lineNumber: 91 });
})();
export {
  CustomizerRoot
};
//# sourceMappingURL=customizer-root.component-CJVMQ36O.mjs.map
