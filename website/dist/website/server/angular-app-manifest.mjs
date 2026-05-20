
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: false,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-FDN3SXJF.js"
    ],
    "route": "/"
  },
  {
    "renderMode": 0,
    "preload": [
      "blog-index.component-LQBNZXQ6.js",
      "chunk-FW6LLFDY.js",
      "chunk-BZK2EVHK.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "search.component-ITBADC33.js",
      "chunk-FW6LLFDY.js",
      "chunk-BZK2EVHK.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/search"
  },
  {
    "renderMode": 0,
    "preload": [
      "category.component-46GU5ZG5.js",
      "chunk-FW6LLFDY.js",
      "chunk-BZK2EVHK.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/category/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "tag.component-B32T5SET.js",
      "chunk-FW6LLFDY.js",
      "chunk-BZK2EVHK.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/tag/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "author.component-MS356A7O.js",
      "chunk-FW6LLFDY.js",
      "chunk-BZK2EVHK.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/authors/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "post.component-VYDWZZVQ.js",
      "chunk-BZK2EVHK.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/*"
  },
  {
    "renderMode": 0,
    "route": "/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "not-found.component-KPB7FMAD.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 2101, hash: '1c9fb0b944008e8a8680c26b5a9fde47a371061f8507862d5484226cb364e29e', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2641, hash: '68b52fa8f175ee1aa2b0f72b883ffc29b9b37a9dbe4917e04f1520f2e1b121d9', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)}
  },
};
