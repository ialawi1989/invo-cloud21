import { InjectionToken } from '@angular/core';

import {
  BlogComment,
  BlogPost,
  BlogTaxonomy,
  BlogWriter,
  CommentListParams,
  CommentListResult,
  PostListParams,
  PostListResult,
  PostSavePayload,
  TaxonomyListParams,
  TaxonomySavePayload,
  UploadResult,
} from './blog.types';
import { BlogSettingsRow, BlogSettingsTemplate } from './blog-settings.types';

/**
 * Abstract contract every blog API implementation must satisfy.
 *
 * Two concrete impls live alongside this file:
 *
 *   - `BlogMockApi`  → in-memory data, used while the backend is
 *                       still under construction. Lives across the
 *                       session (lost on refresh).
 *   - `BlogHttpApi`  → real HTTP calls against `/api/blog/*`.
 *
 * Swap them by editing one line in `blog-api.providers.ts` — pages
 * and components inject `BLOG_API` and never know which one is wired.
 */
export abstract class BlogApi {
  // ── Posts ───────────────────────────────────────────────────────────
  abstract listPosts(params: PostListParams): Promise<PostListResult>;
  abstract getPost(id: string): Promise<BlogPost | null>;
  abstract savePost(payload: PostSavePayload): Promise<BlogPost>;
  abstract deletePost(id: string): Promise<boolean>;
  abstract publishPost(id: string): Promise<BlogPost>;
  abstract unpublishPost(id: string): Promise<BlogPost>;
  abstract schedulePost(id: string, scheduledDate: string): Promise<BlogPost>;
  abstract duplicatePost(id: string): Promise<BlogPost>;

  // ── Taxonomies ──────────────────────────────────────────────────────
  abstract listTaxonomies(params: TaxonomyListParams): Promise<BlogTaxonomy[]>;
  abstract getTaxonomy(id: string): Promise<BlogTaxonomy | null>;
  abstract saveTaxonomy(payload: TaxonomySavePayload): Promise<BlogTaxonomy>;
  abstract deleteTaxonomy(id: string, reassignToId?: string | null): Promise<boolean>;
  abstract reorderTaxonomies(order: { id: string; order: number }[]): Promise<boolean>;
  abstract mergeTags(sourceId: string, targetId: string): Promise<boolean>;
  abstract postsUsingHashtag(hashtagId: string): Promise<BlogPost[]>;

  // ── Comments ────────────────────────────────────────────────────────
  abstract listComments(params: CommentListParams): Promise<CommentListResult>;
  abstract approveComment(id: string): Promise<BlogComment>;
  abstract flagComment(id: string): Promise<BlogComment>;
  abstract deleteComment(id: string): Promise<boolean>;
  abstract replyToComment(id: string, content: string): Promise<BlogComment>;

  // ── Writers ─────────────────────────────────────────────────────────
  abstract listWriters(): Promise<BlogWriter[]>;

  // ── Settings ────────────────────────────────────────────────────────
  abstract getSettings(): Promise<BlogSettingsRow>;
  abstract saveSettings(template: BlogSettingsTemplate, row: BlogSettingsRow): Promise<BlogSettingsRow>;

  // ── Uploads ─────────────────────────────────────────────────────────
  abstract upload(file: File): Promise<UploadResult>;
}

/** Injection token. Provide either `BlogMockApi` or `BlogHttpApi` for
 *  this token in `blog-api.providers.ts`. */
export const BLOG_API = new InjectionToken<BlogApi>('BLOG_API');
