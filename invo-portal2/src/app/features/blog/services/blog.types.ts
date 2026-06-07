/**
 * Wire types for the blog feature. Mirror the migration shapes
 * (BlogPosts, BlogTaxonomies, BlogComments) plus the lightweight DTOs
 * exposed by the documented `/api/blog/*` endpoints.
 */

export type PostStatus    = 'draft' | 'published' | 'scheduled' | 'pending' | 'trash';
export type TaxonomyType  = 'category' | 'tag' | 'hashtag';
export type CommentStatus = 'visible' | 'pending' | 'flagged' | 'deleted';

/** One language's worth of post content. Keys match what the rich-text
 *  editor and SEO panel write. Empty strings allowed; nullables are
 *  serialised as `''` to keep the JSONB shape stable. */
export interface PostLocale {
  title:           string;
  slug:            string;
  excerpt:         string;
  content:         string;
  seoTitle?:       string;
  seoDescription?: string;
}

export interface BlogPost {
  id:                string;
  defaultLanguage:   string;
  status:            PostStatus;
  authorEmployeeId:  string;
  authorName?:       string;
  authorAvatar?:     string | null;
  coverImage:        string | null;
  ogImage:           string | null;
  mainTaxonomyId:    string | null;
  isFeatured:        boolean;
  publishDate:       string | null;
  scheduledDate:     string | null;
  readingTime:       number;
  views:             number;
  commentsCount:     number;
  /** Reader likes/reactions. Backend field pending — defaults to 0. */
  likesCount?:       number;
  translations:      Record<string, PostLocale>;
  taxonomyIds:       string[];
  /** Ids of up to 3 related/featured posts shown in a Post List widget. */
  relatedPostIds?:   string[];
  /** Whether readers can comment on this post. Defaults to true. */
  allowComments?:    boolean;
  /** Pinned posts sort first in the list. */
  isPinned?:         boolean;
  pinnedOrder?:      number | null;
  /** Languages the blog supports (for the list "done/total" badge). */
  supportedLanguages?: string[];
  createdAt:         string;
  updatedAt:         string;
}

export interface PostListParams {
  status?:           PostStatus | '';
  language?:         string;
  taxonomyId?:       string;
  authorEmployeeId?: string;
  search?:           string;
  page?:             number;
  limit?:            number;
  sortBy?:           'publishDate' | 'views' | 'title';
  sortDir?:          'asc' | 'desc';
}

export interface PostListResult {
  list:      BlogPost[];
  count:     number;
  pageCount: number;
  /** Per-status counts for the tab badges (all/published/draft/pending/scheduled/trash). */
  statusCounts?: Record<string, number>;
}

/** Blog analytics summary (views only — per backend). */
export interface BlogReport {
  /** Echoed query window (ISO). */
  range?: { from: string; to: string };
  totals: {
    totalPosts:      number;
    totalViews:      number;
    totalComments:   number;
    /** Total likes over the period. */
    totalLikes?:     number;
    publishedCount:  number;
    draftCount:      number;
    pendingCount:    number;
    scheduledCount:  number;
    trashCount:      number;
    /** Unique visitors over the period (GA4). null when GA4 not configured. */
    uniqueVisitors?: number | null;
  };
  topPosts: BlogReportPost[];
  /** Daily time-series for the trend chart (GA4). */
  series?:  BlogReportPoint[];
  /** Views bucketed by weekday × hour for the time-of-day heatmap. */
  hourly?:  BlogReportHourly[];
  /** Per-source traffic breakdown (GA4). [] when not configured. */
  traffic?: { source: string; sessions: number }[];
  /** Google Search Console performance. null when GSC not configured. */
  search?:  BlogReportSearch | null;
  /** Which Google integrations are connected + enabled. */
  integrations?: { ga4Enabled: boolean; gscEnabled: boolean };
}

/** Google Search Console performance summary + top queries. */
export interface BlogReportSearch {
  impressions: number;
  clicks:      number;
  ctr:         number;
  avgPosition: number;
  topQueries:  { query: string; impressions: number; clicks: number; ctr: number; position: number }[];
}

/** One day on the analytics trend line. */
export interface BlogReportPoint {
  /** ISO date (YYYY-MM-DD). */
  date:      string;
  views:     number;
  visitors?: number;
}

/** One cell of the time-of-day heatmap. */
export interface BlogReportHourly {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** 0–23. */
  hour:    number;
  views:   number;
}

/** Query window for the analytics report. */
export interface BlogReportParams {
  /** ISO date (YYYY-MM-DD), inclusive. */
  from?: string;
  /** ISO date (YYYY-MM-DD), inclusive. */
  to?:   string;
}

/** A row in the analytics "Posts by …" panel. Only `views` is currently
 *  populated by the backend; the rest are optional and rendered when present
 *  (otherwise the panel shows the appropriate empty / "coming soon" state). */
export interface BlogReportPost {
  id:           string;
  slug:         string;
  title:        string;
  views:        number;
  /** Cover image URL, if any. */
  cover?:       string;
  /** ISO publish date. */
  publishDate?: string;
  /** Average read time in seconds. */
  avgReadTime?: number;
  /** Total link/button clicks (requires click tracking). */
  clicks?:      number;
  /** Comments left on the post. */
  comments?:    number;
  /** Likes / reactions on the post. */
  likes?:       number;
}

/** Result of a posts import. */
export interface ImportPostsResult {
  imported: number;
  failed:   number;
  created:  string[];
  errors:   { index: number; title?: string; error: string }[];
}

/** Result of a bulk status-update / delete (per-id processing). */
export interface BulkResult {
  updated?: number;
  deleted?: number;
  failed:   number;
  ids:      string[];
  errors:   { id: string; error: string }[];
}

/** Payload sent to POST/PUT /posts. */
export type PostSavePayload = Omit<BlogPost,
  'id' | 'createdAt' | 'updatedAt' | 'views' | 'commentsCount' | 'authorName' | 'authorAvatar' | 'readingTime'
> & {
  id?:          string;
  readingTime?: number;
};

// ── Taxonomies ────────────────────────────────────────────────────────

export interface TaxonomyLocale {
  name:            string;
  slug:            string;
  description?:    string;
  seoTitle?:       string;
  seoDescription?: string;
}

export interface BlogTaxonomy {
  id:              string;
  taxonomyType:    TaxonomyType;
  defaultLanguage: string;
  slug:            string;
  order:           number;
  image:           string | null;
  postsCount:      number;
  usageCount:      number;
  translations:    Record<string, TaxonomyLocale>;
  /** The locked "All Posts" system category — can be renamed but not
   *  deleted, reordered, or have its slug/type changed. */
  isDefault?:      boolean;
  /** Per-active-language SEO, surfaced top-level by the backend. */
  seoTitle?:       string;
  seoDescription?: string;
  /** Languages this taxonomy has translations in / blog supports. */
  availableLanguages?: string[];
  supportedLanguages?: string[];
  createdAt:       string;
  updatedAt:       string;
  /** Hashtag-only — last time a post containing this hashtag was saved. */
  lastUsedAt?:     string;
}

export interface TaxonomyListParams {
  taxonomyType: TaxonomyType;
  language?:    string;
  search?:      string;
}

export type TaxonomySavePayload = Omit<BlogTaxonomy,
  'id' | 'postsCount' | 'usageCount' | 'createdAt' | 'updatedAt' | 'lastUsedAt'
> & { id?: string };

// ── Moderation rules ──────────────────────────────────────────────────

export type ModerationGroup   = 'everyone' | 'members' | 'visitors';
export type ModerationTrigger = 'spam' | 'links' | 'media' | 'all';
export type ModerationAction  = 'pending' | 'trash' | 'block';

export interface BlogModerationRule {
  id:                string;
  name:              string;
  /** Whose comments this rule moderates. */
  group:             ModerationGroup;
  /** What kind of comments trigger it. Free-form (backend not enum-locked);
   *  see {@link ModerationTrigger} for the reference set the UI exposes. */
  trigger:           string;
  /** What happens to matching comments. */
  action:            ModerationAction;
  /** Member ids excluded from the rule. */
  excludedMemberIds: string[];
  active:            boolean;
  createdAt?:        string;
  updatedAt?:        string;
}

export type ModerationRuleSavePayload =
  Omit<BlogModerationRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

/** A site member (shopper) the admin can exclude from a moderation rule.
 *  Returned by `blog/getShopperList` — scoped to shoppers who have interacted
 *  with this company (a customer record or a blog comment). */
export interface BlogShopper {
  id:          string;
  name:        string;
  email?:      string;
  phone?:      string;
  customerId?: string | null;
}

export interface ShopperListParams {
  page?:       number;
  limit?:      number;
  searchTerm?: string;
}

export interface ShopperListResult {
  list:      BlogShopper[];
  count:     number;
  pageCount: number;
}

// ── Comments ──────────────────────────────────────────────────────────

export interface BlogComment {
  id:               string;
  postId:           string;
  postTitle:        string;
  shopperId:        string | null;
  authorEmployeeId: string | null;
  authorName:       string;
  authorAvatar:     string | null;
  authorKind:       'shopper' | 'employee';
  content:          string;
  parentCommentId:  string | null;
  parentExcerpt?:   string;
  parentAuthor?:    string;
  status:           CommentStatus;
  language:         string | null;
  createdAt:        string;
  updatedAt:        string;
}

export interface CommentListParams {
  postId?:   string;
  status?:   CommentStatus | 'all';
  language?: string;
  search?:   string;
  dateFrom?: string;
  dateTo?:   string;
  page?:     number;
  limit?:    number;
}

export interface CommentListResult {
  list:       BlogComment[];
  count:      number;
  pageCount:  number;
  /** Per-tab counters shown in the status-tab strip. */
  statusCounts: Record<CommentStatus | 'all', number>;
}

// ── Writers (employees with blog.manage_posts) ────────────────────────

export interface BlogWriter {
  id:          string;
  name:        string;
  avatar:      string | null;
  publicTitle?: string;
}

// ── Misc ──────────────────────────────────────────────────────────────

export interface UploadResult { url: string; }
