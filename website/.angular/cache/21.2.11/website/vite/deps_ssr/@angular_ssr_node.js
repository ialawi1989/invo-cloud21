import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  AngularAppEngine,
  InlineCriticalCssProcessor,
  SERVER_CONTEXT,
  getFirstHeaderValue,
  isProxyHeaderAllowed,
  normalizeTrustProxyHeaders,
  renderApplication,
  renderModule,
  validateUrl
} from "./chunk-HBLONBMV.js";
import "./chunk-WC4PITUE.js";
import "./chunk-CMDLGXHL.js";
import "./chunk-FACM2CK2.js";
import "./chunk-2WMXBCV4.js";
import "./chunk-5XVK64LY.js";
import "./chunk-F6M77V7U.js";
import "./chunk-KNX6RTYS.js";
import "./chunk-DYILQ42H.js";
import "./chunk-7RP5W65N.js";
import "./chunk-MXTZR767.js";
import "./chunk-G26LVALZ.js";
import {
  __async,
  __spreadProps,
  __spreadValues
} from "./chunk-JLB47SLY.js";

// node_modules/@angular/ssr/fesm2022/node.mjs
import * as fs from "fs";
import { dirname, join, normalize, resolve } from "path";
import { URL as URL$1, fileURLToPath } from "url";
import { readFile } from "fs/promises";
import { argv } from "process";
function getAllowedHostsFromEnv() {
  return getArrayFromEnv("NG_ALLOWED_HOSTS");
}
function getTrustProxyHeadersFromEnv() {
  return getArrayFromEnv("NG_TRUST_PROXY_HEADERS");
}
function getArrayFromEnv(envName) {
  const envValue = process.env[envName];
  if (!envValue) {
    return void 0;
  }
  const values = [];
  for (const value of envValue.split(",")) {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      values.push(trimmed);
    }
  }
  return values;
}
function attachNodeGlobalErrorHandlers() {
  if (typeof Zone !== "undefined") {
    return;
  }
  const gThis = globalThis;
  if (gThis.ngAttachNodeGlobalErrorHandlersCalled) {
    return;
  }
  gThis.ngAttachNodeGlobalErrorHandlersCalled = true;
  process.on("unhandledRejection", (error) => console.error("unhandledRejection", error)).on("uncaughtException", (error) => console.error("uncaughtException", error));
}
var CommonEngineInlineCriticalCssProcessor = class {
  resourceCache = /* @__PURE__ */ new Map();
  process(html, outputPath) {
    return __async(this, null, function* () {
      const beasties = new InlineCriticalCssProcessor((path) => __async(this, null, function* () {
        let resourceContent = this.resourceCache.get(path);
        if (resourceContent === void 0) {
          resourceContent = yield readFile(path, "utf-8");
          this.resourceCache.set(path, resourceContent);
        }
        return resourceContent;
      }), outputPath);
      return beasties.process(html);
    });
  }
};
var PERFORMANCE_MARK_PREFIX = "🅰️";
function printPerformanceLogs() {
  let maxWordLength = 0;
  const benchmarks = [];
  for (const {
    name,
    duration
  } of performance.getEntriesByType("measure")) {
    if (!name.startsWith(PERFORMANCE_MARK_PREFIX)) {
      continue;
    }
    const step = name.slice(PERFORMANCE_MARK_PREFIX.length + 1) + ":";
    if (step.length > maxWordLength) {
      maxWordLength = step.length;
    }
    benchmarks.push([step, `${duration.toFixed(1)}ms`]);
    performance.clearMeasures(name);
  }
  console.log("********** Performance results **********");
  for (const [step, value] of benchmarks) {
    const spaces = maxWordLength - step.length + 5;
    console.log(step + " ".repeat(spaces) + value);
  }
  console.log("*****************************************");
}
function runMethodAndMeasurePerf(label, asyncMethod) {
  return __async(this, null, function* () {
    const labelName = `${PERFORMANCE_MARK_PREFIX}:${label}`;
    const startLabel = `start:${labelName}`;
    const endLabel = `end:${labelName}`;
    try {
      performance.mark(startLabel);
      return yield asyncMethod();
    } finally {
      performance.mark(endLabel);
      performance.measure(labelName, startLabel, endLabel);
      performance.clearMarks(startLabel);
      performance.clearMarks(endLabel);
    }
  });
}
function noopRunMethodAndMeasurePerf(label, asyncMethod) {
  return asyncMethod();
}
var SSG_MARKER_REGEXP = /ng-server-context=["']\w*\|?ssg\|?\w*["']/;
var CommonEngine = class {
  options;
  templateCache = /* @__PURE__ */ new Map();
  inlineCriticalCssProcessor = new CommonEngineInlineCriticalCssProcessor();
  pageIsSSG = /* @__PURE__ */ new Map();
  allowedHosts;
  constructor(options) {
    this.options = options;
    this.allowedHosts = new Set(getAllowedHostsFromEnv() ?? this.options?.allowedHosts ?? []);
    attachNodeGlobalErrorHandlers();
  }
  render(opts) {
    return __async(this, null, function* () {
      const {
        url
      } = opts;
      if (url && URL$1.canParse(url)) {
        const urlObj = new URL$1(url);
        try {
          validateUrl(urlObj, this.allowedHosts);
        } catch (error) {
          const isAllowedHostConfigured = this.allowedHosts.size > 0;
          console.error(`ERROR: ${error.message}Please provide a list of allowed hosts in the "allowedHosts" option in the "CommonEngine" constructor.`, isAllowedHostConfigured ? "" : "\nFalling back to client side rendering. This will become a 400 Bad Request in a future major version.");
          if (!isAllowedHostConfigured) {
            let document = opts.document;
            if (!document && opts.documentFilePath) {
              document = opts.document ?? (yield this.getDocument(opts.documentFilePath));
            }
            if (document) {
              return document;
            }
          }
          throw error;
        }
      }
      const enablePerformanceProfiler = this.options?.enablePerformanceProfiler;
      const runMethod = enablePerformanceProfiler ? runMethodAndMeasurePerf : noopRunMethodAndMeasurePerf;
      let html = yield runMethod("Retrieve SSG Page", () => this.retrieveSSGPage(opts));
      if (html === void 0) {
        html = yield runMethod("Render Page", () => this.renderApplication(opts));
        if (opts.inlineCriticalCss !== false) {
          const content = yield runMethod("Inline Critical CSS", () => this.inlineCriticalCss(html, opts));
          html = content;
        }
      }
      if (enablePerformanceProfiler) {
        printPerformanceLogs();
      }
      return html;
    });
  }
  inlineCriticalCss(html, opts) {
    const outputPath = opts.publicPath ?? (opts.documentFilePath ? dirname(opts.documentFilePath) : "");
    return this.inlineCriticalCssProcessor.process(html, outputPath);
  }
  retrieveSSGPage(opts) {
    return __async(this, null, function* () {
      const {
        publicPath,
        documentFilePath,
        url
      } = opts;
      if (!publicPath || !documentFilePath || url === void 0) {
        return void 0;
      }
      const {
        pathname
      } = new URL$1(url, "resolve://");
      const pagePath = join(publicPath, pathname, "index.html");
      if (this.pageIsSSG.get(pagePath)) {
        return fs.promises.readFile(pagePath, "utf-8");
      }
      if (!pagePath.startsWith(normalize(publicPath))) {
        return void 0;
      }
      if (pagePath === resolve(documentFilePath) || !(yield exists(pagePath))) {
        this.pageIsSSG.set(pagePath, false);
        return void 0;
      }
      const content = yield fs.promises.readFile(pagePath, "utf-8");
      const isSSG = SSG_MARKER_REGEXP.test(content);
      this.pageIsSSG.set(pagePath, isSSG);
      return isSSG ? content : void 0;
    });
  }
  renderApplication(opts) {
    return __async(this, null, function* () {
      const moduleOrFactory = this.options?.bootstrap ?? opts.bootstrap;
      if (!moduleOrFactory) {
        throw new Error("A module or bootstrap option must be provided.");
      }
      const extraProviders = [{
        provide: SERVER_CONTEXT,
        useValue: "ssr"
      }, ...opts.providers ?? [], ...this.options?.providers ?? []];
      let document = opts.document;
      if (!document && opts.documentFilePath) {
        document = yield this.getDocument(opts.documentFilePath);
      }
      const commonRenderingOptions = {
        url: opts.url,
        document,
        allowedHosts: ["*"]
      };
      return isBootstrapFn(moduleOrFactory) ? renderApplication(moduleOrFactory, __spreadValues({
        platformProviders: extraProviders
      }, commonRenderingOptions)) : renderModule(moduleOrFactory, __spreadValues({
        extraProviders
      }, commonRenderingOptions));
    });
  }
  getDocument(filePath) {
    return __async(this, null, function* () {
      let doc = this.templateCache.get(filePath);
      if (!doc) {
        doc = yield fs.promises.readFile(filePath, "utf-8");
        this.templateCache.set(filePath, doc);
      }
      return doc;
    });
  }
};
function exists(path) {
  return __async(this, null, function* () {
    try {
      yield fs.promises.access(path, fs.constants.F_OK);
      return true;
    } catch (e) {
      return false;
    }
  });
}
function isBootstrapFn(value) {
  return typeof value === "function" && !("ɵmod" in value);
}
var HTTP2_PSEUDO_HEADERS = /* @__PURE__ */ new Set([":method", ":scheme", ":authority", ":path", ":status"]);
function createWebRequestFromNodeRequest(nodeRequest, trustProxyHeaders) {
  const trustProxyHeadersNormalized = normalizeTrustProxyHeaders(trustProxyHeaders);
  const {
    headers,
    method = "GET"
  } = nodeRequest;
  const withBody = method !== "GET" && method !== "HEAD";
  const referrer = headers.referer && URL.canParse(headers.referer) ? headers.referer : void 0;
  return new Request(createRequestUrl(nodeRequest, trustProxyHeadersNormalized), {
    method,
    headers: createRequestHeaders(headers),
    body: withBody ? nodeRequest : void 0,
    duplex: withBody ? "half" : void 0,
    referrer
  });
}
function createRequestHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeHeaders)) {
    if (HTTP2_PSEUDO_HEADERS.has(name)) {
      continue;
    }
    if (typeof value === "string") {
      headers.append(name, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    }
  }
  return headers;
}
function createRequestUrl(nodeRequest, trustProxyHeaders) {
  const {
    headers,
    socket,
    url = "",
    originalUrl
  } = nodeRequest;
  const protocol = getAllowedProxyHeaderValue(headers, "x-forwarded-proto", trustProxyHeaders) ?? ("encrypted" in socket && socket.encrypted ? "https" : "http");
  const hostname = getAllowedProxyHeaderValue(headers, "x-forwarded-host", trustProxyHeaders) ?? headers.host ?? headers[":authority"];
  if (Array.isArray(hostname)) {
    throw new Error("host value cannot be an array.");
  }
  let hostnameWithPort = hostname;
  if (!hostname?.includes(":")) {
    const port = getAllowedProxyHeaderValue(headers, "x-forwarded-port", trustProxyHeaders);
    if (port) {
      hostnameWithPort += `:${port}`;
    }
  }
  return new URL(`${protocol}://${hostnameWithPort}${originalUrl ?? url}`);
}
function getAllowedProxyHeaderValue(headers, headerName, trustProxyHeaders) {
  return isProxyHeaderAllowed(headerName, trustProxyHeaders) ? getFirstHeaderValue(headers[headerName]) : void 0;
}
var AngularNodeAppEngine = class {
  angularAppEngine;
  trustProxyHeaders;
  constructor(options) {
    const appEngineOptions = __spreadProps(__spreadValues({}, options), {
      allowedHosts: getAllowedHostsFromEnv() ?? options?.allowedHosts,
      trustProxyHeaders: getTrustProxyHeadersFromEnv() ?? options?.trustProxyHeaders
    });
    this.angularAppEngine = new AngularAppEngine(appEngineOptions);
    this.trustProxyHeaders = appEngineOptions.trustProxyHeaders;
    attachNodeGlobalErrorHandlers();
  }
  handle(request, requestContext) {
    return __async(this, null, function* () {
      const webRequest = request instanceof Request ? request : createWebRequestFromNodeRequest(request, this.trustProxyHeaders);
      return this.angularAppEngine.handle(webRequest, requestContext);
    });
  }
};
function createNodeRequestHandler(handler) {
  handler["__ng_node_request_handler__"] = true;
  return handler;
}
function writeResponseToNodeResponse(source, destination) {
  return __async(this, null, function* () {
    const {
      status,
      headers,
      body
    } = source;
    destination.statusCode = status;
    let cookieHeaderSet = false;
    for (const [name, value] of headers.entries()) {
      if (name === "set-cookie") {
        if (cookieHeaderSet) {
          continue;
        }
        destination.setHeader(name, headers.getSetCookie());
        cookieHeaderSet = true;
      } else {
        destination.setHeader(name, value);
      }
    }
    if ("flushHeaders" in destination) {
      destination.flushHeaders();
    }
    if (!body) {
      destination.end();
      return;
    }
    try {
      const reader = body.getReader();
      destination.on("close", () => {
        reader.cancel().catch((error) => {
          console.error(`An error occurred while writing the response body for: ${destination.req.url}.`, error);
        });
      });
      while (true) {
        const {
          done,
          value
        } = yield reader.read();
        if (done) {
          destination.end();
          break;
        }
        const canContinue = destination.write(value);
        if (canContinue === false) {
          yield new Promise((resolve2) => destination.once("drain", resolve2));
        }
      }
    } catch (e) {
      destination.end("Internal server error.");
    }
  });
}
function isMainModule(url) {
  return url.startsWith("file:") && argv[1] === fileURLToPath(url);
}
export {
  AngularNodeAppEngine,
  CommonEngine,
  createNodeRequestHandler,
  createWebRequestFromNodeRequest,
  isMainModule,
  writeResponseToNodeResponse
};
//# sourceMappingURL=@angular_ssr_node.js.map
