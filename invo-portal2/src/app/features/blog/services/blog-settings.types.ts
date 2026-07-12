/**
 * BlogSettings — shape of the `template` payload on the `WebSiteBuilder`
 * row where `type === 'BlogSettings'`. Mirrors the JSONB default seeded
 * in migration 006 so the form can patch directly into it.
 */

export type FeedLayout =
  | 'grid'
  | 'list'
  | 'masonry'
  | 'magazine'
  | 'sideBySide'
  | 'editorial';

export const FEED_LAYOUTS: readonly FeedLayout[] = [
  'grid', 'list', 'masonry', 'magazine', 'sideBySide', 'editorial',
] as const;

export interface BlogLanguagesSettings {
  default:      string;
  supported:    string[];
  rtlLanguages: string[];
  /** Site-wide multilingual behavior — edited in the Multilingual manager but
   *  stored in this same `languages` object (single source of truth). Optional
   *  so the Blog Settings page can carry them through untouched. */
  autoSwitch?:   boolean;
  urlStructure?: 'subdirectory' | 'subdomain' | 'parameter';
}

export interface BlogLayoutsSettings {
  feed:             FeedLayout;
  categoryFeed:     FeedLayout;
  availableLayouts: FeedLayout[];
}

export interface BlogDisplaySettings {
  postsPerPage:       number;
  showAuthor:         boolean;
  showDate:           boolean;
  showReadingTime:    boolean;
  showCategoryLabel:  boolean;
  showTags:           boolean;
  showHashtags:       boolean;
  showSocialShare:    boolean;
  showRelatedPosts:   boolean;
  showCommentCount:   boolean;
}

export interface BlogCommentsSettings {
  enabled:              boolean;
  requireApproval:      boolean;
  allowReplies:         boolean;
  maxDepth:             number;
  allowEmployeeReplies: boolean;
  requireShopperLogin:  boolean;
}

export interface BlogRssSettings {
  enabled:    boolean;
  itemsCount: number;
}

export interface BlogSeoSettings {
  titleTemplate:   string;
  defaultOgImage:  string;
}

export interface BlogMobileSettings {
  overrideDesktop:  boolean;
  feedLayout:       FeedLayout;
  showCategoryMenu: boolean;
}

export interface BlogSettingsTemplate {
  languages: BlogLanguagesSettings;
  layouts:   BlogLayoutsSettings;
  display:   BlogDisplaySettings;
  comments:  BlogCommentsSettings;
  rss:       BlogRssSettings;
  seo:       BlogSeoSettings;
  mobile:    BlogMobileSettings;
}

/** Full row as returned by `company/getThemeByType`. */
export interface BlogSettingsRow {
  id:        string | null;
  companyId: string;
  type:      'BlogSettings';
  template:  BlogSettingsTemplate;
}

/** Canonical defaults — match migration 006's seeded JSONB so a freshly
 *  inserted row and a never-saved local copy look identical to the form. */
export function defaultBlogSettings(): BlogSettingsTemplate {
  return {
    languages: {
      default:      'en',
      supported:    ['en'],
      rtlLanguages: [],
    },
    layouts: {
      feed:             'grid',
      categoryFeed:     'list',
      availableLayouts: ['grid', 'list', 'masonry', 'magazine', 'sideBySide', 'editorial'],
    },
    display: {
      postsPerPage:      12,
      showAuthor:        true,
      showDate:          true,
      showReadingTime:   true,
      showCategoryLabel: true,
      showTags:          true,
      showHashtags:      true,
      showSocialShare:   true,
      showRelatedPosts:  true,
      showCommentCount:  true,
    },
    comments: {
      enabled:              true,
      requireApproval:      false,
      allowReplies:         true,
      maxDepth:             3,
      allowEmployeeReplies: true,
      requireShopperLogin:  true,
    },
    rss: {
      enabled:    true,
      itemsCount: 20,
    },
    seo: {
      titleTemplate:  '{postTitle} | {siteName}',
      defaultOgImage: '',
    },
    mobile: {
      overrideDesktop:  false,
      feedLayout:       'list',
      showCategoryMenu: true,
    },
  };
}

/** Coerce a server payload back into the canonical shape, filling in any
 *  fields a stale row might be missing. Defensive against the JSONB
 *  drifting between deploys. */
export function normalizeBlogSettings(raw: any): BlogSettingsTemplate {
  const d = defaultBlogSettings();
  if (!raw || typeof raw !== 'object') return d;
  return {
    languages: {
      default:      String(raw.languages?.default ?? d.languages.default),
      supported:    Array.isArray(raw.languages?.supported) && raw.languages.supported.length
        ? raw.languages.supported.map(String)
        : d.languages.supported,
      rtlLanguages: Array.isArray(raw.languages?.rtlLanguages)
        ? raw.languages.rtlLanguages.map(String)
        : d.languages.rtlLanguages,
    },
    layouts: {
      feed:             coerceLayout(raw.layouts?.feed, d.layouts.feed),
      categoryFeed:     coerceLayout(raw.layouts?.categoryFeed, d.layouts.categoryFeed),
      availableLayouts: Array.isArray(raw.layouts?.availableLayouts) && raw.layouts.availableLayouts.length
        ? raw.layouts.availableLayouts.filter((l: any) => FEED_LAYOUTS.includes(l)) as FeedLayout[]
        : d.layouts.availableLayouts,
    },
    display: {
      postsPerPage:      Math.max(1, Number(raw.display?.postsPerPage ?? d.display.postsPerPage)) || d.display.postsPerPage,
      showAuthor:        raw.display?.showAuthor        !== false,
      showDate:          raw.display?.showDate          !== false,
      showReadingTime:   raw.display?.showReadingTime   !== false,
      showCategoryLabel: raw.display?.showCategoryLabel !== false,
      showTags:          raw.display?.showTags          !== false,
      showHashtags:      raw.display?.showHashtags      !== false,
      showSocialShare:   raw.display?.showSocialShare   !== false,
      showRelatedPosts:  raw.display?.showRelatedPosts  !== false,
      showCommentCount:  raw.display?.showCommentCount  !== false,
    },
    comments: {
      enabled:              raw.comments?.enabled              !== false,
      requireApproval:      !!raw.comments?.requireApproval,
      allowReplies:         raw.comments?.allowReplies         !== false,
      maxDepth:             clampDepth(raw.comments?.maxDepth ?? d.comments.maxDepth),
      allowEmployeeReplies: raw.comments?.allowEmployeeReplies !== false,
      requireShopperLogin:  raw.comments?.requireShopperLogin  !== false,
    },
    rss: {
      enabled:    raw.rss?.enabled !== false,
      itemsCount: Number(raw.rss?.itemsCount ?? d.rss.itemsCount) || d.rss.itemsCount,
    },
    seo: {
      titleTemplate:  String(raw.seo?.titleTemplate  ?? d.seo.titleTemplate),
      defaultOgImage: String(raw.seo?.defaultOgImage ?? ''),
    },
    mobile: {
      overrideDesktop:  !!raw.mobile?.overrideDesktop,
      feedLayout:       coerceLayout(raw.mobile?.feedLayout, d.mobile.feedLayout),
      showCategoryMenu: raw.mobile?.showCategoryMenu !== false,
    },
  };
}

function coerceLayout(v: any, fallback: FeedLayout): FeedLayout {
  return FEED_LAYOUTS.includes(v) ? v : fallback;
}

function clampDepth(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}
