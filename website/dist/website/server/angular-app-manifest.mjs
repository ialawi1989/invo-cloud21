
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
      "chunk-JLIORTDV.js"
    ],
    "route": "/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-TM4E6LRV.js",
      "chunk-RNDGB22G.js",
      "chunk-W3YONQCP.js",
      "chunk-SBN6QM55.js"
    ],
    "route": "/*/blog"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-IGNG4HXZ.js",
      "chunk-RNDGB22G.js",
      "chunk-W3YONQCP.js",
      "chunk-SBN6QM55.js"
    ],
    "route": "/*/blog/search"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-OTT7YAPR.js",
      "chunk-RNDGB22G.js",
      "chunk-W3YONQCP.js",
      "chunk-SBN6QM55.js"
    ],
    "route": "/*/blog/category/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-JBSO3SPG.js",
      "chunk-RNDGB22G.js",
      "chunk-W3YONQCP.js",
      "chunk-SBN6QM55.js"
    ],
    "route": "/*/blog/tag/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-WDGZPTFC.js",
      "chunk-RNDGB22G.js",
      "chunk-W3YONQCP.js",
      "chunk-SBN6QM55.js"
    ],
    "route": "/*/blog/authors/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-KLTHUJS6.js",
      "chunk-W3YONQCP.js",
      "chunk-SBN6QM55.js"
    ],
    "route": "/*/blog/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-JLIORTDV.js"
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
    'index.csr.html': {size: 41328, hash: 'efab4bb835166b813dd44c85718bf1dae661f1090359c1755cdac4fdbfd3e21e', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 32668, hash: '14d110fada6c19f2eeb930b03b1313a5aebfc66e2e222a7633a4e13a279fc0f6', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-2QMDNU5V.css': {size: 19812, hash: 'kwoDjbR2gbI', text: () => import('./assets-chunks/styles-2QMDNU5V_css.mjs').then(m => m.default)}
  },
};
