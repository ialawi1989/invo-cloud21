/**
 * Public-safe subset of BlogSettings — only the keys the public site
 * needs to render. Matches the dashboard's BlogSettingsTemplate but
 * trimmed: no employee-only flags, no comment moderation toggles
 * (those affect the dashboard, not the storefront).
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

export interface PublicBlogLanguagesSettings {
  default:      string;
  supported:    string[];
  rtlLanguages: string[];
}

export interface PublicBlogLayoutsSettings {
  feed:         FeedLayout;
  categoryFeed: FeedLayout;
}

export interface PublicBlogDisplaySettings {
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

export interface PublicBlogCommentsSettings {
  enabled:             boolean;
  allowReplies:        boolean;
  maxDepth:            number;
  requireShopperLogin: boolean;
}

export interface PublicBlogRssSettings {
  enabled:      boolean;
  itemsCount?:  number;
  title?:       string;
  description?: string;
}

export interface PublicBlogMobileSettings {
  overrideDesktop:  boolean;
  feedLayout:       FeedLayout;
  showCategoryMenu: boolean;
}

export interface PublicBlogSettings {
  languages: PublicBlogLanguagesSettings;
  layouts:   PublicBlogLayoutsSettings;
  display:   PublicBlogDisplaySettings;
  comments:  PublicBlogCommentsSettings;
  rss:       PublicBlogRssSettings;
  mobile:    PublicBlogMobileSettings;
  /** Optional storefront-level fields the backend may inject. */
  siteName?: string;
  heroImage?: string;
  defaultOgImage?: string;
  tagline?: string;
}

export function defaultPublicBlogSettings(): PublicBlogSettings {
  return {
    languages: { default: 'en', supported: ['en'], rtlLanguages: ['ar', 'he', 'fa', 'ur'] },
    layouts:   { feed: 'grid', categoryFeed: 'list' },
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
    comments: { enabled: true, allowReplies: true, maxDepth: 3, requireShopperLogin: true },
    rss:      { enabled: true, itemsCount: 20 },
    mobile:   { overrideDesktop: false, feedLayout: 'list', showCategoryMenu: true },
  };
}

function coerceLayout(v: any, fallback: FeedLayout): FeedLayout {
  return FEED_LAYOUTS.includes(v) ? v : fallback;
}

export function normalizePublicBlogSettings(raw: any): PublicBlogSettings {
  const d = defaultPublicBlogSettings();
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
      feed:         coerceLayout(raw.layouts?.feed,         d.layouts.feed),
      categoryFeed: coerceLayout(raw.layouts?.categoryFeed, d.layouts.categoryFeed),
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
      enabled:             raw.comments?.enabled             !== false,
      allowReplies:        raw.comments?.allowReplies        !== false,
      maxDepth:            Math.min(5, Math.max(1, Number(raw.comments?.maxDepth ?? d.comments.maxDepth) || d.comments.maxDepth)),
      requireShopperLogin: raw.comments?.requireShopperLogin !== false,
    },
    rss: {
      enabled:     raw.rss?.enabled !== false,
      itemsCount:  raw.rss?.itemsCount  != null ? Number(raw.rss.itemsCount) || undefined : undefined,
      title:       raw.rss?.title       != null ? String(raw.rss.title)       : undefined,
      description: raw.rss?.description != null ? String(raw.rss.description) : undefined,
    },
    mobile: {
      overrideDesktop:  !!raw.mobile?.overrideDesktop,
      feedLayout:       coerceLayout(raw.mobile?.feedLayout, d.mobile.feedLayout),
      showCategoryMenu: raw.mobile?.showCategoryMenu !== false,
    },
    siteName:       raw.siteName       != null ? String(raw.siteName)       : undefined,
    heroImage:      raw.heroImage      != null ? String(raw.heroImage)      : undefined,
    defaultOgImage: raw.defaultOgImage != null ? String(raw.defaultOgImage) : undefined,
    tagline:        raw.tagline        != null ? String(raw.tagline)        : undefined,
  };
}
