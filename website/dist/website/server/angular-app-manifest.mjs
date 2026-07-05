
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: false,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 1,
    "route": "/"
  },
  {
    "renderMode": 1,
    "route": "/blog"
  },
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-PBTNYRUK.js"
    ],
    "route": "/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "blog-index.component-U62YYWE4.js",
      "chunk-XAGC5U2M.js",
      "chunk-UJHLK57O.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "search.component-GSKK4L24.js",
      "chunk-XAGC5U2M.js",
      "chunk-UJHLK57O.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/search"
  },
  {
    "renderMode": 0,
    "preload": [
      "category.component-GVYLUWRY.js",
      "chunk-XAGC5U2M.js",
      "chunk-UJHLK57O.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/category/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "tag.component-BHKCG7ZS.js",
      "chunk-XAGC5U2M.js",
      "chunk-UJHLK57O.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/tag/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "author.component-V7M3PPNZ.js",
      "chunk-XAGC5U2M.js",
      "chunk-UJHLK57O.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/authors/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "post.component-GONVF2AB.js",
      "chunk-UJHLK57O.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-PBTNYRUK.js"
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
    'index.csr.html': {size: 1999, hash: '23bcb7b4a8a337c77776e635f24a1255bafabe487017e51bf6eda6c357d65604', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2539, hash: '8788d1571b77c10e56cba45ea8ca1a78fd61f190de1d0986add1a70c4842fd90', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)}
  },
};
