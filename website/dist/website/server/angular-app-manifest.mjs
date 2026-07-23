
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: false,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-T5IFM7VK.js"
    ],
    "route": "/"
  },
  {
    "renderMode": 0,
    "preload": [
      "blog-index.component-NGCQQRP7.js",
      "chunk-KS3HTVUL.js",
      "chunk-GZS2IXPU.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "search.component-ORJ55UDG.js",
      "chunk-KS3HTVUL.js",
      "chunk-GZS2IXPU.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/search"
  },
  {
    "renderMode": 0,
    "preload": [
      "category.component-DOGRZKTL.js",
      "chunk-KS3HTVUL.js",
      "chunk-GZS2IXPU.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/category/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "tag.component-6CFPQKNC.js",
      "chunk-KS3HTVUL.js",
      "chunk-GZS2IXPU.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/tag/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "author.component-3KOBFLYL.js",
      "chunk-KS3HTVUL.js",
      "chunk-GZS2IXPU.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/authors/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "post.component-EFKWKFND.js",
      "chunk-GZS2IXPU.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/blog/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-T5IFM7VK.js"
    ],
    "route": "/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "blog-index.component-NGCQQRP7.js",
      "chunk-KS3HTVUL.js",
      "chunk-GZS2IXPU.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "search.component-ORJ55UDG.js",
      "chunk-KS3HTVUL.js",
      "chunk-GZS2IXPU.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/search"
  },
  {
    "renderMode": 0,
    "preload": [
      "category.component-DOGRZKTL.js",
      "chunk-KS3HTVUL.js",
      "chunk-GZS2IXPU.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/category/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "tag.component-6CFPQKNC.js",
      "chunk-KS3HTVUL.js",
      "chunk-GZS2IXPU.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/tag/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "author.component-3KOBFLYL.js",
      "chunk-KS3HTVUL.js",
      "chunk-GZS2IXPU.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/authors/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "post.component-EFKWKFND.js",
      "chunk-GZS2IXPU.js",
      "chunk-TUMDR5WP.js"
    ],
    "route": "/*/blog/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "customizer-root.component-T5IFM7VK.js"
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
    'index.csr.html': {size: 1948, hash: 'a62ee31fbf125da6c7269be51964ebc0d4e5f3e286b075a3bb4fcfbca345ad51', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2488, hash: '2f4e7affa394dc4abcf567a9a842741b1833e0bab949ea3d6f04dca3a8eba2a2', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)}
  },
};
