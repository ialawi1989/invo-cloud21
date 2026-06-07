import { InjectionToken } from '@angular/core';

import {
  BlogComment,
  CommentStatus,
  BlogModerationRule,
  ModerationRuleSavePayload,
  BlogPost,
  BlogTaxonomy,
  BlogWriter,
  BlogReport,
  BlogReportParams,
  BulkResult,
  ImportPostsResult,
  CommentListParams,
  CommentListResult,
  PostListParams,
  PostListResult,
  PostSavePayload,
  PostStatus,
  TaxonomyListParams,
  TaxonomySavePayload,
  UploadResult,
} from './blog.types';
import { BlogSettingsRow, BlogSettingsTemplate } from './blog-settings.types';

/**
 * Abstract contract for the blog API. The concrete implementation
 * `BlogHttpApi` (real HTTP calls against `/v1/app/blog/*`) is bound to
 * the `BLOG_API` token in `blog-api.providers.ts`; pages inject
 * `BLOG_API` and never reference the implementation directly.
 */
export abstract class BlogApi {
  // ── Posts ───────────────────────────────────────────────────────────
  abstract listPosts(params: PostListParams): Promise<PostListResult>;
  abstract getPost(id: string): Promise<BlogPost | null>;
  abstract savePost(payload: PostSavePayload): Promise<BlogPost>;
  /** Permanent delete (only allowed when the post is in Trash). */
  abstract deletePost(id: string): Promise<boolean>;
  /** Soft delete — moves the post to Trash (status='trash'); reversible. */
  abstract trashPost(id: string): Promise<BlogPost>;
  /** Restore a trashed post back to draft. */
  abstract restorePost(id: string): Promise<BlogPost>;
  /** Pin / unpin — pinned posts sort first. */
  abstract pinPost(id: string, pinned: boolean, order?: number): Promise<BlogPost>;
  /** Bulk operations (single request, per-id processing). */
  abstract bulkUpdateStatus(ids: string[], status: PostStatus): Promise<BulkResult>;
  abstract bulkDelete(ids: string[], force?: boolean): Promise<BulkResult>;
  abstract publishPost(id: string): Promise<BlogPost>;
  abstract unpublishPost(id: string): Promise<BlogPost>;
  abstract schedulePost(id: string, scheduledDate: string): Promise<BlogPost>;
  abstract duplicatePost(id: string): Promise<BlogPost>;
  /** Bulk import — JSON `{ source:'json', posts:[…] }` or a file payload. */
  abstract importPosts(body: any): Promise<ImportPostsResult>;

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
  /** Restore a trashed (deleted) comment → visible. */
  abstract restoreComment(id: string): Promise<BlogComment>;
  /** Permanently delete a comment (must be in Trash unless `force`). */
  abstract hardDeleteComment(id: string, force?: boolean): Promise<boolean>;
  abstract bulkUpdateCommentStatus(ids: string[], status: CommentStatus): Promise<BulkResult>;
  abstract bulkDeleteComments(ids: string[], force?: boolean): Promise<BulkResult>;

  // ── Moderation rules ────────────────────────────────────────────────
  abstract listModerationRules(): Promise<BlogModerationRule[]>;
  abstract getModerationRule(id: string): Promise<BlogModerationRule | null>;
  abstract saveModerationRule(payload: ModerationRuleSavePayload): Promise<BlogModerationRule>;
  abstract deleteModerationRule(id: string): Promise<boolean>;
  abstract toggleModerationRule(id: string, active: boolean): Promise<BlogModerationRule>;

  // ── Analytics ───────────────────────────────────────────────────────
  abstract getReport(params?: BlogReportParams): Promise<BlogReport>;

  // ── Writers ─────────────────────────────────────────────────────────
  abstract listWriters(): Promise<BlogWriter[]>;

  // ── Settings ────────────────────────────────────────────────────────
  abstract getSettings(): Promise<BlogSettingsRow>;
  abstract saveSettings(template: BlogSettingsTemplate, row: BlogSettingsRow): Promise<BlogSettingsRow>;

  // ── Uploads ─────────────────────────────────────────────────────────
  abstract upload(file: File): Promise<UploadResult>;
}

/** Injection token, bound to `BlogHttpApi` in `blog-api.providers.ts`. */
export const BLOG_API = new InjectionToken<BlogApi>('BLOG_API');
