/**
 * Wire types for the public blog API. Shapes match the RPC contract
 * served at `/v1/ecommerce/blog/*` — every read returns `{ data }`
 * (the api service unwraps before handing off to pages, so types
 * here are already the inner payload).
 */

export interface Pagination {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
}

export interface PostAuthorRef {
  id:          string;
  name:        string;
  image:       string | null;
  profileSlug: string | null;
  /** Optional display fields only present on full post / author profile. */
  publicTitle?: string;
  publicBio?:   string;
}

export interface MainCategoryRef {
  id:   string;
  slug: string;
  name: string;
}

export interface PostCategoryRef {
  id:     string;
  slug:   string;
  name:   string;
  isMain: boolean;
}

export interface PostTagRef {
  id:   string;
  slug: string;
  name: string;
}

export interface HashtagRef {
  name: string;
  slug: string;
}

/** Lightweight shape used in lists, grids, and related-posts. */
export interface PostSummary {
  id:                 string;
  slug:               string;
  title:              string;
  excerpt:            string;
  coverImage:         string | null;
  publishDate:        string;
  readingTime:        number;
  views:              number;
  isFeatured:         boolean;
  hashtags:           HashtagRef[];
  author:             PostAuthorRef;
  mainCategory:       MainCategoryRef | null;
  commentsCount:      number;
  contentLanguage:    string;
  wasFallback:        boolean;
  availableLanguages: string[];
}

export interface SeoBlock {
  title:         string;
  description:   string;
  ogTitle:       string;
  ogDescription: string;
  ogImage:       string | null;
  canonical:     string;
  hreflangAlternates: { lang: string; url: string }[];
}

export interface BlogPost extends PostSummary {
  content:           string;
  ogImage:           string | null;
  categories:        PostCategoryRef[];
  tags:              PostTagRef[];
  seo:               SeoBlock;
  relatedPosts:      PostSummary[];
  requestedLanguage: string;
  modifiedAt?:       string;
}

export interface PostListResult {
  data:       PostSummary[];
  pagination: Pagination;
}

export interface BlogTaxonomy {
  id:           string;
  slug:         string;
  name:         string;
  description?: string;
  image?:       string | null;
  taxonomyType: 'category' | 'tag' | 'hashtag';
  postsCount?:  number;
  seoTitle?:    string;
  seoDescription?: string;
}

export interface CategoryPostsResult {
  category:   BlogTaxonomy;
  data:       PostSummary[];
  pagination: Pagination;
}

export interface TagPostsResult {
  tag:        BlogTaxonomy;
  data:       PostSummary[];
  pagination: Pagination;
}

export interface AuthorProfile {
  id:               string;
  name:             string;
  image:            string | null;
  profileSlug:      string;
  title:            string;
  bio:              string;
  coverImage:       string | null;
  socialLinks:      { kind: string; url: string }[];
  isProfilePublic:  boolean;
  postsCount?:      number;
  totalViews?:      number;
}

export interface AuthorProfileResult {
  profile: AuthorProfile;
  posts:   { data: PostSummary[]; pagination: Pagination };
}

/** New comment node shape. Old `status/authorKind/isOwn` fields are
 *  gone — use `isDeleted` / `isPending` / `canEdit` / `author.type`. */
export interface BlogCommentNode {
  id:               string;
  /** null when isDeleted=true */
  content:          string | null;
  language:         string;
  createdAt:        string;
  updatedAt:        string;
  parentCommentId:  string | null;
  author: {
    type:  'shopper' | 'employee';
    id:    string;
    name:  string;
    image: string | null;
  };
  isDeleted:  boolean;
  isPending:  boolean;
  canEdit:    boolean;
  deletedAt:  string | null;
  replies:    BlogCommentNode[];
}

export interface CurrentShopper {
  id:    string;
  email: string;
  name:  string;
  image: string | null;
  /** Session token returned by the auth endpoint — passed back on
   *  comment writes as `X-Shopper-Session`. May be null if the
   *  backend manages the session via cookies only. */
  sessionId?: string | null;
}

/** Flat, page-friendly query the api service maps onto the nested
 *  `{ filter, sortBy, page, limit, searchTerm }` body that the
 *  backend expects. */
export interface PostListQuery {
  language:         string;
  taxonomyId?:      string;
  authorEmployeeId?: string;
  search?:          string;
  page?:            number;
  limit?:           number;
  sort?:            'date' | 'views' | 'title';
  order?:           'asc' | 'desc';
}
