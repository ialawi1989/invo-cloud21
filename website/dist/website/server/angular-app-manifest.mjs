
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: false,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-M5O7QHAN.js"
    ],
    "route": "/"
  },
  {
    "renderMode": 0,
    "preload": [
      "blog-index.component-BKZ3CIMX.js",
      "chunk-D534PZDC.js",
      "chunk-USY5WZNI.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "search.component-SGI2IPMX.js",
      "chunk-D534PZDC.js",
      "chunk-USY5WZNI.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/search"
  },
  {
    "renderMode": 0,
    "preload": [
      "category.component-QJFAFSDM.js",
      "chunk-D534PZDC.js",
      "chunk-USY5WZNI.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/category/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "tag.component-PWSK3LLE.js",
      "chunk-D534PZDC.js",
      "chunk-USY5WZNI.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/tag/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "author.component-S4Z6SHLH.js",
      "chunk-D534PZDC.js",
      "chunk-USY5WZNI.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/authors/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "post.component-EXI4QOCZ.js",
      "chunk-USY5WZNI.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-M5O7QHAN.js"
    ],
    "route": "/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "blog-index.component-BKZ3CIMX.js",
      "chunk-D534PZDC.js",
      "chunk-USY5WZNI.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "search.component-SGI2IPMX.js",
      "chunk-D534PZDC.js",
      "chunk-USY5WZNI.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/search"
  },
  {
    "renderMode": 0,
    "preload": [
      "category.component-QJFAFSDM.js",
      "chunk-D534PZDC.js",
      "chunk-USY5WZNI.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/category/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "tag.component-PWSK3LLE.js",
      "chunk-D534PZDC.js",
      "chunk-USY5WZNI.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/tag/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "author.component-S4Z6SHLH.js",
      "chunk-D534PZDC.js",
      "chunk-USY5WZNI.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/authors/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "post.component-EXI4QOCZ.js",
      "chunk-USY5WZNI.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-M5O7QHAN.js"
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
    'index.csr.html': {size: 1999, hash: 'bcb9fbb3023935b364425a9a6645bedb7eac5ae705613a87bc01b71a3f731724', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2539, hash: '0f6d3c17067805905f9d29fa78259170ef9985b9e65bc7400d45799be29c2751', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)}
  },
};
