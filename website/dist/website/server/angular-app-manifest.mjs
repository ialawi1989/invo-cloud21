
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: false,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-HNQ3B4BX.js"
    ],
    "route": "/"
  },
  {
    "renderMode": 0,
    "preload": [
      "blog-index.component-XNOL6JPB.js",
      "chunk-BAOCPRA6.js",
      "chunk-OTCRCMVA.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "search.component-ZXBPTCGI.js",
      "chunk-BAOCPRA6.js",
      "chunk-OTCRCMVA.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/search"
  },
  {
    "renderMode": 0,
    "preload": [
      "category.component-OTDN5OGI.js",
      "chunk-BAOCPRA6.js",
      "chunk-OTCRCMVA.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/category/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "tag.component-PJDWNJXZ.js",
      "chunk-BAOCPRA6.js",
      "chunk-OTCRCMVA.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/tag/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "author.component-QZYLS6DA.js",
      "chunk-BAOCPRA6.js",
      "chunk-OTCRCMVA.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/authors/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "post.component-U5PEJR6K.js",
      "chunk-OTCRCMVA.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-HNQ3B4BX.js"
    ],
    "route": "/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "blog-index.component-XNOL6JPB.js",
      "chunk-BAOCPRA6.js",
      "chunk-OTCRCMVA.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "search.component-ZXBPTCGI.js",
      "chunk-BAOCPRA6.js",
      "chunk-OTCRCMVA.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/search"
  },
  {
    "renderMode": 0,
    "preload": [
      "category.component-OTDN5OGI.js",
      "chunk-BAOCPRA6.js",
      "chunk-OTCRCMVA.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/category/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "tag.component-PJDWNJXZ.js",
      "chunk-BAOCPRA6.js",
      "chunk-OTCRCMVA.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/tag/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "author.component-QZYLS6DA.js",
      "chunk-BAOCPRA6.js",
      "chunk-OTCRCMVA.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/authors/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "post.component-U5PEJR6K.js",
      "chunk-OTCRCMVA.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-HNQ3B4BX.js"
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
    'index.csr.html': {size: 1948, hash: 'c0d2f303e3f6941346937465bb1618224c78d13d59711366f5d984c217d4bd90', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2488, hash: '2945b0ffcc13c52c21d6cb010a7368010d3d5189d8516f225ce2bc66938786d8', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)}
  },
};
