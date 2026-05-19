
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: false,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-Q27TFCZJ.js"
    ],
    "route": "/"
  },
  {
    "renderMode": 0,
    "preload": [
      "blog-index.component-U3HZNUD6.js",
      "chunk-WAS64RJY.js",
      "chunk-C4JIQNDE.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "search.component-2RXIADJZ.js",
      "chunk-WAS64RJY.js",
      "chunk-C4JIQNDE.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/search"
  },
  {
    "renderMode": 0,
    "preload": [
      "category.component-TIJ5BWAU.js",
      "chunk-WAS64RJY.js",
      "chunk-C4JIQNDE.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/category/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "tag.component-BDF7SLOR.js",
      "chunk-WAS64RJY.js",
      "chunk-C4JIQNDE.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/tag/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "author.component-XF6UT2DV.js",
      "chunk-WAS64RJY.js",
      "chunk-C4JIQNDE.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/authors/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "post.component-TYOCKVUO.js",
      "chunk-C4JIQNDE.js",
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
      "not-found.component-QBGL7RU3.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 2101, hash: '732927663ed1db6c6ad0d5dcedb0f3ae8865087222a3e1f79cba2f48526e0ecc', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2641, hash: '8e08027f824d3f84e96495c0ff354d94e740ac418a10d63ba6fd402df18d638f', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)}
  },
};
