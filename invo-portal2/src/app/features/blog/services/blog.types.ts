/**
 * Wire types for the blog feature. Mirror the migration shapes
 * (BlogPosts, BlogTaxonomies, BlogComments) plus the lightweight DTOs
 * exposed by the documented `/api/blog/*` endpoints.
 */

export type PostStatus    = 'draft' | 'published' | 'scheduled';
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
  translations:      Record<string, PostLocale>;
  taxonomyIds:       string[];
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
