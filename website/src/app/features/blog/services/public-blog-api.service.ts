import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  AuthorProfileResult,
  BlogCommentNode,
  BlogPost,
  BlogTaxonomy,
  CategoryPostsResult,
  PostListQuery,
  PostListResult,
  TagPostsResult,
} from '../models/blog.types';
import { PublicBlogSettings, normalizePublicBlogSettings } from '../models/blog-settings.types';

interface ApiEnvelope<T> {
  success: boolean;
  msg:     string;
  data:    T;
}

/**
 * RPC-style client for the public blog. Matches the rest of the
 * ecommerce client family — every action POSTs JSON to
 * `/v1/ecommerce/<subDomain>/blog/<action>`, except RSS / sitemap
 * which are GETs.
 *
 * Cross-cutting concerns:
 *   • `<subDomain>` is the company slug, taken from the same source
 *     the rest of the ecommerce client uses (override hook
 *     `window.__BLOG_SUBDOMAIN__`, else first label of the page
 *     hostname). Never passed as `companyId` in the body — the
 *     backend resolves the tenant off the path segment.
 *   • `X-Sub-Domain` header is sent in lockstep with the path slug
 *     so the service layer can cross-check.
 *   • `withCredentials: true` carries the shopper auth that the
 *     ecommerce client family establishes elsewhere — no bespoke
 *     auth wiring here.
 *   • Every response unwraps `{ success, msg, data }`. A non-true
 *     `success` is escalated as a thrown `Error(msg)` so pages'
 *     try/catch paths surface the backend message.
 */
@Injectable({ providedIn: 'root' })
export class PublicBlogApiService {
  private http = inject(HttpClient);
  private base = environment.apiBase;

  private url(action: string): string {
    const company = encodeURIComponent(this.resolveCompany());
    return `${this.base}/v1/ecommerce/${company}/blog/${action}`;
  }

  /** Resolve the tenant company slug used in both the URL path and
   *  the `X-Sub-Domain` header. Order:
   *   1. `window.__BLOG_SUBDOMAIN__` override (set by the server-
   *      rendered shell — useful when several tenants share a
   *      domain or for local dev against a remote tenant).
   *   2. First label of `window.location.hostname` —
   *      `shussain.dev.invopos.shop` → `shussain`.
   *      Bare IPs / localhost give a literal value the backend
   *      probably can't resolve; set the override in dev. */
  private resolveCompany(): string {
    if (typeof window !== 'undefined') {
      const override = (window as any).__BLOG_SUBDOMAIN__;
      if (typeof override === 'string' && override.length) return override;
      const host = window.location?.hostname ?? '';
      return host.split('.')[0] ?? '';
    }
    return '';
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ 'X-Sub-Domain': this.resolveCompany() });
  }

  private async call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
    let env: ApiEnvelope<T>;
    try {
      env = await firstValueFrom(this.http.post<ApiEnvelope<T>>(this.url(action), body, {
        headers: this.headers(),
        withCredentials: true,
      }));
    } catch (e) {
      // Surface the backend `msg` if it came back under a non-2xx —
      // pages map error codes off `error.error.msg` / status.
      if (e instanceof HttpErrorResponse && e.error?.msg) {
        const wrapped = new Error(e.error.msg) as any;
        wrapped.status = e.status;
        wrapped.code   = e.error?.code;
        wrapped.cause  = e;
        throw wrapped;
      }
      throw e;
    }
    if (!env || env.success === false) {
      const err = new Error(env?.msg || 'Request failed') as any;
      err.status = 0;
      throw err;
    }
    return env.data;
  }

  // ── Settings ───────────────────────────────────────────────────────
  async getPublicSettings(): Promise<PublicBlogSettings> {
    const raw = await this.call<any>('getSettings', {});
    return normalizePublicBlogSettings(raw);
  }

  // ── Posts ──────────────────────────────────────────────────────────
  /** New list contract — paginated, sorted, and filtered. The page
   *  callers pass a flat `PostListQuery` (legacy shape kept for
   *  ergonomics); we restructure into the nested filter / sortBy
   *  shape the backend expects. */
  listPublicPosts(query: PostListQuery): Promise<PostListResult> {
    return this.call<PostListResult>('getPostList', {
      page:        query.page  ?? 1,
      limit:       query.limit ?? 12,
      searchTerm:  query.search ?? '',
      sortBy: {
        sortValue:     query.sort  ?? 'date',
        sortDirection: query.order ?? 'desc',
      },
      filter: {
        language:         query.language,
        taxonomyId:       query.taxonomyId,
        authorEmployeeId: query.authorEmployeeId,
        // Public site only sees published posts; backend enforces
        // this regardless, but pass the value for clarity.
        status:           'published',
      },
    });
  }

  getPublicPost(slug: string, language: string): Promise<BlogPost> {
    return this.call<BlogPost>('getPost', { slug, language });
  }

  // ── Taxonomies ─────────────────────────────────────────────────────
  listPublicTaxonomies(opts: {
    language?: string;
    taxonomyType: 'category' | 'tag' | 'hashtag';
    search?: string;
  }): Promise<BlogTaxonomy[]> {
    // We don't paginate the category strip — request a generous page
    // so the strip stays single-fetch.
    return this.call<BlogTaxonomy[]>('getTaxonomyList', {
      page:       1,
      limit:      200,
      searchTerm: opts.search ?? '',
      sortBy:     { sortValue: 'name', sortDirection: 'asc' },
      filter:     { taxonomyType: opts.taxonomyType, language: opts.language },
    });
  }

  getCategoryPosts(
    slug: string,
    language: string,
    paging: { page?: number; limit?: number; sort?: string } = {},
  ): Promise<CategoryPostsResult> {
    return this.call<CategoryPostsResult>('getCategoryPosts', {
      slug,
      page:  paging.page  ?? 1,
      limit: paging.limit ?? 12,
      language,
    });
  }

  getTagPosts(
    slug: string,
    language: string,
    paging: { page?: number; limit?: number } = {},
  ): Promise<TagPostsResult> {
    return this.call<TagPostsResult>('getTagPosts', {
      slug,
      page:  paging.page  ?? 1,
      limit: paging.limit ?? 12,
      language,
    });
  }

  // ── Authors ────────────────────────────────────────────────────────
  /** Author profile is keyed by employeeId on the new contract, not
   *  by slug. Pages route on `:authorEmployeeId`; if the value in
   *  the URL is actually a slug, the backend will 404 and the page
   *  surfaces the not-found view. */
  getAuthorProfile(
    authorEmployeeId: string,
    _language: string,
    _paging: { page?: number; limit?: number } = {},
  ): Promise<AuthorProfileResult> {
    return this.call<AuthorProfileResult>('getAuthorProfile', { authorEmployeeId });
  }

  // ── Comments ───────────────────────────────────────────────────────
  /** Comments are keyed by postId on the new contract. Page passes
   *  `post.id` (loaded from `getPost` on the post page) — the slug
   *  is no longer enough. */
  listPostComments(
    postId: string,
    _language: string,
    paging: { page?: number; limit?: number } = {},
  ): Promise<BlogCommentNode[]> {
    return this.call<BlogCommentNode[]>('getPostComments', {
      postId,
      page:  paging.page  ?? 1,
      limit: paging.limit ?? 200,
    });
  }

  createComment(
    postId: string,
    payload: { content: string; parentCommentId?: string | null; language?: string },
  ): Promise<BlogCommentNode> {
    return this.call<BlogCommentNode>('createComment', {
      postId,
      content:         payload.content,
      parentCommentId: payload.parentCommentId ?? null,
      language:        payload.language,
    });
  }

  updateOwnComment(commentId: string, content: string): Promise<BlogCommentNode> {
    return this.call<BlogCommentNode>('updateOwnComment', { id: commentId, content });
  }

  deleteOwnComment(commentId: string): Promise<void> {
    return this.call<void>('deleteOwnComment', { id: commentId });
  }

  // ── Crawler endpoints (GET, language as query) ─────────────────────
  rssUrl(lang: string): string {
    const q = new HttpParams().set('lang', lang).toString();
    const company = encodeURIComponent(this.resolveCompany());
    return `${this.base}/v1/ecommerce/${company}/blog/rss?${q}`;
  }

  sitemapUrl(): string {
    const company = encodeURIComponent(this.resolveCompany());
    return `${this.base}/v1/ecommerce/${company}/blog/sitemap.xml`;
  }
}
