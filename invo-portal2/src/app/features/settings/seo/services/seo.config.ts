import type {
  SeoCustomizeDefaults,
  SeoPageType,
  SeoSettingsDocument,
} from './seo.types';

/**
 * Page-type catalog — the tiles surfaced on the SEO landing under
 * "Edit by page type". Each entry maps to a route `/settings/seo/:slug`
 * that opens the Edit-by-page / Customize defaults editor.
 *
 * Order matches the screenshot reference: a "primary" group (Main
 * pages, Items / Services list pages, Restaurant menus) followed by
 * blog-related types and finally any per-product / per-record page
 * types.
 */
export const SEO_PAGE_TYPES: readonly SeoPageType[] = [
  {
    slug: 'main',
    labelKey: 'SEO.PAGE_TYPES.MAIN_PAGES',
    descKey:  'SEO.PAGE_TYPES.MAIN_PAGES_DESC',
    icon:     '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>',
    builtIn:  true,
  },
  {
    slug: 'items-list',
    labelKey: 'SEO.PAGE_TYPES.ITEMS_LIST',
    descKey:  'SEO.PAGE_TYPES.ITEMS_LIST_DESC',
    icon:     '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    builtIn:  true,
  },
  {
    slug: 'items-detail',
    labelKey: 'SEO.PAGE_TYPES.ITEMS_DETAIL',
    descKey:  'SEO.PAGE_TYPES.ITEMS_DETAIL_DESC',
    icon:     '<path d="M2 9V5a2 2 0 0 1 2-2h4M22 9V5a2 2 0 0 0-2-2h-4M2 15v4a2 2 0 0 0 2 2h4M22 15v4a2 2 0 0 1-2 2h-4"/><path d="M8 12h8"/>',
    builtIn:  true,
  },
  {
    slug: 'services-list',
    labelKey: 'SEO.PAGE_TYPES.SERVICES_LIST',
    descKey:  'SEO.PAGE_TYPES.SERVICES_LIST_DESC',
    icon:     '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    builtIn:  true,
  },
  {
    slug: 'services-detail',
    labelKey: 'SEO.PAGE_TYPES.SERVICES_DETAIL',
    descKey:  'SEO.PAGE_TYPES.SERVICES_DETAIL_DESC',
    icon:     '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  },
  {
    slug: 'restaurant-menus',
    labelKey: 'SEO.PAGE_TYPES.RESTAURANT_MENUS',
    descKey:  'SEO.PAGE_TYPES.RESTAURANT_MENUS_DESC',
    icon:     '<path d="M3 11h18M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/>',
  },
  {
    slug: 'blog-posts',
    labelKey: 'SEO.PAGE_TYPES.BLOG_POSTS',
    descKey:  'SEO.PAGE_TYPES.BLOG_POSTS_DESC',
    icon:     '<path d="M14 3v5h5"/><path d="M19 12V7l-5-5H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M11 14h6M11 18h4"/>',
  },
  {
    slug: 'blog-categories',
    labelKey: 'SEO.PAGE_TYPES.BLOG_CATEGORIES',
    descKey:  'SEO.PAGE_TYPES.BLOG_CATEGORIES_DESC',
    icon:     '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  },
  {
    slug: 'blog-tags',
    labelKey: 'SEO.PAGE_TYPES.BLOG_TAGS',
    descKey:  'SEO.PAGE_TYPES.BLOG_TAGS_DESC',
    icon:     '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  },
  {
    slug: 'blog-archive',
    labelKey: 'SEO.PAGE_TYPES.BLOG_ARCHIVE',
    descKey:  'SEO.PAGE_TYPES.BLOG_ARCHIVE_DESC',
    icon:     '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><line x1="10" y1="12" x2="14" y2="12"/>',
  },
];

/** Default Customize-Defaults bundle. Cloned per page type when the
 *  user opens that type for the first time. Variables follow Invo's
 *  `{{ pageName }}` / `{{ siteName }}` convention so the storefront
 *  renderer can resolve them at request time. */
export const DEFAULT_SEO_CUSTOMIZE_DEFAULTS = (): SeoCustomizeDefaults => ({
  basics: {
    titleTagTemplate: '{{ pageName }} | {{ siteName }}',
    metaDescTemplate: '',
    indexable:        true,
    ogTitleTemplate:  '{{ titleTag }}',
    ogDescTemplate:   '{{ metaDescription }}',
    ogImage:          '',
    xCardSize:        'large',
    xTitleTemplate:   '{{ ogTitle }}',
    xDescTemplate:    '{{ ogDescription }}',
    xImage:           '{{ ogImage }}',
  },
  pageUrl: {
    showHierarchy:  true,
    seoFriendly404: true,
    slugPattern:    '/{{ slug }}',
  },
  structuredData: '',
  robots: {
    noindex:         false,
    nofollow:        false,
    nosnippet:       false,
    noimageindex:    false,
    noarchive:       false,
    maxImagePreview: 'standard',
    maxSnippet:      -1,
    maxVideoPreview: -1,
  },
  additionalTags: [
    { name: 'og:site_name', value: '{{ siteName }}' },
    { name: 'og:type',      value: 'website' },
    { name: 'og:url',       value: '{{ pageUrl }}' },
  ],
});

/** Empty root document — what the service hands back when the
 *  company hasn't saved any SEO settings yet. */
export const EMPTY_SEO_DOCUMENT = (): SeoSettingsDocument => ({
  sitePreferences: {
    allowIndexing:  true,
    generalOgImage: '',
  },
  pageTypes: {},
});

