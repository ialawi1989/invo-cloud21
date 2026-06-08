
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
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
      "chunk-SEQGI6HM.js"
    ],
    "route": "/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-NLB6LMHK.js",
      "chunk-UU3VCNWK.js",
      "chunk-S7I52GGG.js",
      "chunk-SBN6QM55.js"
    ],
    "route": "/*/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-OHR6FH34.js",
      "chunk-UU3VCNWK.js",
      "chunk-S7I52GGG.js",
      "chunk-SBN6QM55.js"
    ],
    "route": "/*/blog/search"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-MCSCGPG4.js",
      "chunk-UU3VCNWK.js",
      "chunk-S7I52GGG.js",
      "chunk-SBN6QM55.js"
    ],
    "route": "/*/blog/category/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-SKLTMNIQ.js",
      "chunk-UU3VCNWK.js",
      "chunk-S7I52GGG.js",
      "chunk-SBN6QM55.js"
    ],
    "route": "/*/blog/tag/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-4J63OMCR.js",
      "chunk-UU3VCNWK.js",
      "chunk-S7I52GGG.js",
      "chunk-SBN6QM55.js"
    ],
    "route": "/*/blog/authors/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-J4NWOCRO.js",
      "chunk-S7I52GGG.js",
      "chunk-SBN6QM55.js"
    ],
    "route": "/*/blog/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-SEQGI6HM.js"
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
    'index.csr.html': {size: 41328, hash: '5dbd09b62e7772c1bb2edd2890749a26a81e92f57a9d08cb2ab062186574b2bb', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 32668, hash: 'dc48c73accebb93524205c9625ac96670c574c30c72a7d7a02af11ebb2a97aff', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-2QMDNU5V.css': {size: 19812, hash: 'kwoDjbR2gbI', text: () => import('./assets-chunks/styles-2QMDNU5V_css.mjs').then(m => m.default)}
  },
};
