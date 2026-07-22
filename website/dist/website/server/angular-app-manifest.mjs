
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: false,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-UV4AT6JD.js"
    ],
    "route": "/"
  },
  {
    "renderMode": 0,
    "preload": [
      "blog-index.component-RTXSDSE4.js",
      "chunk-AADDHIIO.js",
      "chunk-GIVY7Q32.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "search.component-BRRJ2ZGH.js",
      "chunk-AADDHIIO.js",
      "chunk-GIVY7Q32.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/search"
  },
  {
    "renderMode": 0,
    "preload": [
      "category.component-FQAL4UFO.js",
      "chunk-AADDHIIO.js",
      "chunk-GIVY7Q32.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/category/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "tag.component-55R34KD7.js",
      "chunk-AADDHIIO.js",
      "chunk-GIVY7Q32.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/tag/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "author.component-ZHJTXYB5.js",
      "chunk-AADDHIIO.js",
      "chunk-GIVY7Q32.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/authors/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "post.component-NTEA7SHN.js",
      "chunk-GIVY7Q32.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-UV4AT6JD.js"
    ],
    "route": "/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "blog-index.component-RTXSDSE4.js",
      "chunk-AADDHIIO.js",
      "chunk-GIVY7Q32.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "search.component-BRRJ2ZGH.js",
      "chunk-AADDHIIO.js",
      "chunk-GIVY7Q32.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/search"
  },
  {
    "renderMode": 0,
    "preload": [
      "category.component-FQAL4UFO.js",
      "chunk-AADDHIIO.js",
      "chunk-GIVY7Q32.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/category/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "tag.component-55R34KD7.js",
      "chunk-AADDHIIO.js",
      "chunk-GIVY7Q32.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/tag/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "author.component-ZHJTXYB5.js",
      "chunk-AADDHIIO.js",
      "chunk-GIVY7Q32.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/authors/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "post.component-NTEA7SHN.js",
      "chunk-GIVY7Q32.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-UV4AT6JD.js"
    ],
    "route": "/*/*"
  },
  {
    "renderMode": 0,
    "route": "/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 1948, hash: 'c8cb0e2c04a9e6358f42cad768b12843596908f4db16d079870fb2e35f2038f0', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2488, hash: 'a45e28c8e643bcd8ba7df4759603e3b57214f0eb9e8287f18e5791dd6b9d3b18', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)}
  },
};
