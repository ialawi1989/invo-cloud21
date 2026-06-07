import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { BlogApi } from './blog-api';
import {
  BlogComment,
  BlogModerationRule,
  ModerationRuleSavePayload,
  ShopperListParams,
  ShopperListResult,
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
  TaxonomyListParams,
  TaxonomySavePayload,
  UploadResult,
} from './blog.types';
import {
  BlogSettingsRow,
  BlogSettingsTemplate,
  normalizeBlogSettings,
} from './blog-settings.types';

/**
 * HTTP implementation of `BlogApi`.
 *
 * Wire format mirrors the rest of the codebase (see `PaymentMethodService`,
 * `ContentLibraryService`, `EmployeeOptionsService`):
 *
 *   - One RPC-style endpoint per action, namespaced under `blog/*`.
 *   - List queries are POST with the filter/pagination body, not GET with
 *     query params — matches `accounts/getPaymentMethodList` and friends.
 *   - Responses are wrapped in `{ success, data }`; we unwrap `data` here
 *     so the rest of the front-end works with plain types.
 *
 * If the backend isn't live yet, calls throw and the pages already render
 * their error states (toast + retry). Nothing on the consumer side needs to
 * change when the endpoints come online.
 *
 * Endpoint contract:
 *
 *   POST   blog/getPostList              { status?, language?, taxonomyId?, authorEmployeeId?, search?, page, limit, sortBy?, sortDir? }
 *                                          → { list, count, pageCount }
 *   GET    blog/getPost/:id              → post
 *   POST   blog/savePost                 (upsert; id field switches to update)
 *   DELETE blog/deletePost/:id
 *   POST   blog/publishPost              { id }
 *   POST   blog/unpublishPost            { id }
 *   POST   blog/schedulePost             { id, scheduledDate }
 *   POST   blog/duplicatePost            { id }
 *
 *   POST   blog/getTaxonomyList          { taxonomyType, language?, search? } → BlogTaxonomy[]
 *   GET    blog/getTaxonomy/:id          → taxonomy
 *   POST   blog/saveTaxonomy             (upsert)
 *   POST   blog/deleteTaxonomy           { id, reassignToId? }
 *   POST   blog/reorderTaxonomies        [{ id, order }]
 *   POST   blog/mergeTags                { sourceId, targetId }
 *   POST   blog/getPostsUsingHashtag     { id } → BlogPost[]
 *
 *   POST   blog/getCommentList           { postId?, status?, language?, search?, dateFrom?, dateTo?, page, limit }
 *                                          → { list, count, pageCount, statusCounts }
 *   POST   blog/approveComment           { id }
 *   POST   blog/flagComment              { id }
 *   POST   blog/deleteComment            { id }
 *   POST   blog/replyComment             { id, content }
 *
 *   GET    blog/getWriters               → BlogWriter[]
 *
 *   GET    blog/getSettings              → BlogSettingsRow
 *   POST   blog/saveSettings             { id?, companyId?, template }
 *
 *   POST   blog/uploadImage              multipart/form-data field=file → { url }
 */
@Injectable({ providedIn: 'root' })
export class BlogHttpApi extends BlogApi {
  private http = inject(HttpClient);
  private base = environment.backendUrl; // already ends with `/v1/app/`

  // ─── Posts ────────────────────────────────────────────────────────────

  async listPosts(params: PostListParams): Promise<PostListResult> {
    const body = {
      page:    params.page  ?? 1,
      limit:   params.limit ?? 15,
      sortBy:  params.sortBy  ?? 'publishDate',
      sortDir: params.sortDir ?? 'desc',
      ...stripEmpty({
        status:           params.status,
        language:         params.language,
        taxonomyId:       params.taxonomyId,
        authorEmployeeId: params.authorEmployeeId,
        search:           params.search,
      }),
    };
    const data = await this.post<any>('blog/getPostList', body);
    return {
      list:         Array.isArray(data?.list) ? data.list : [],
      count:        Number(data?.count ?? 0),
      pageCount:    Number(data?.pageCount ?? 1),
      statusCounts: data?.statusCounts ?? undefined,
    };
  }

  async getPost(id: string): Promise<BlogPost | null> {
    const data = await this.get<BlogPost>(`blog/getPost/${encodeURIComponent(id)}`);
    return data ?? null;
  }

  async savePost(payload: PostSavePayload): Promise<BlogPost> {
    return this.post<BlogPost>('blog/savePost', payload);
  }

  async deletePost(id: string): Promise<boolean> {
    await this.delete(`blog/deletePost/${encodeURIComponent(id)}`);
    return true;
  }

  // Soft delete (status='trash', reversible). The DELETE path-param variant
  // above is the permanent delete (only allowed when already in Trash).
  async trashPost(id: string):   Promise<BlogPost> { return this.post('blog/trashPost',   { id }); }
  async restorePost(id: string): Promise<BlogPost> { return this.post('blog/restorePost', { id }); }
  async pinPost(id: string, pinned: boolean, order?: number): Promise<BlogPost> {
    return this.post('blog/pinPost', order != null ? { id, pinned, order } : { id, pinned });
  }
  async bulkUpdateStatus(ids: string[], status: any): Promise<BulkResult> {
    return this.post('blog/bulkUpdateStatus', { ids, status });
  }
  async bulkDelete(ids: string[], force?: boolean): Promise<BulkResult> {
    return this.post('blog/bulkDelete', force ? { ids, force } : { ids });
  }

  async publishPost(id: string):   Promise<BlogPost> { return this.post('blog/publishPost',   { id }); }
  async unpublishPost(id: string): Promise<BlogPost> { return this.post('blog/unpublishPost', { id }); }
  async schedulePost(id: string, scheduledDate: string): Promise<BlogPost> {
    return this.post('blog/schedulePost', { id, scheduledDate });
  }
  async duplicatePost(id: string): Promise<BlogPost> { return this.post('blog/duplicatePost', { id }); }
  async importPosts(body: any): Promise<ImportPostsResult> {
    // Multipart FormData (file) goes through postRaw; JSON {source,posts} via post.
    return body instanceof FormData
      ? this.postRaw('blog/importPosts', body)
      : this.post('blog/importPosts', body);
  }

  // ─── Taxonomies ──────────────────────────────────────────────────────

  async listTaxonomies(params: TaxonomyListParams): Promise<BlogTaxonomy[]> {
    const body = stripEmpty({
      taxonomyType: params.taxonomyType,
      language:     params.language,
      search:       params.search,
    });
    const data = await this.post<any>('blog/getTaxonomyList', body);
    return Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
  }

  async getTaxonomy(id: string): Promise<BlogTaxonomy | null> {
    return (await this.get<BlogTaxonomy>(`blog/getTaxonomy/${encodeURIComponent(id)}`)) ?? null;
  }

  async saveTaxonomy(payload: TaxonomySavePayload): Promise<BlogTaxonomy> {
    return this.post<BlogTaxonomy>('blog/saveTaxonomy', payload);
  }

  async deleteTaxonomy(id: string, reassignToId?: string | null): Promise<boolean> {
    await this.post('blog/deleteTaxonomy', reassignToId ? { id, reassignToId } : { id });
    return true;
  }

  async reorderTaxonomies(order: { id: string; order: number }[]): Promise<boolean> {
    await this.post('blog/reorderTaxonomies', order);
    return true;
  }

  async mergeTags(sourceId: string, targetId: string): Promise<boolean> {
    await this.post('blog/mergeTags', { sourceId, targetId });
    return true;
  }

  async postsUsingHashtag(hashtagId: string): Promise<BlogPost[]> {
    const data = await this.post<any>('blog/getPostsUsingHashtag', { id: hashtagId });
    return Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
  }

  // ─── Comments ────────────────────────────────────────────────────────

  async listComments(params: CommentListParams): Promise<CommentListResult> {
    const body = {
      page:  params.page  ?? 1,
      limit: params.limit ?? 25,
      ...stripEmpty({
        postId:   params.postId,
        status:   params.status,
        language: params.language,
        search:   params.search,
        dateFrom: params.dateFrom,
        dateTo:   params.dateTo,
      }),
    };
    const data = await this.post<any>('blog/getCommentList', body);
    return {
      list:         (Array.isArray(data?.list) ? data.list : []).map((c: any) => normalizeComment(c)),
      count:        Number(data?.count ?? 0),
      pageCount:    Number(data?.pageCount ?? 1),
      statusCounts: data?.statusCounts ?? data?.counts ?? {
        all: 0, visible: 0, pending: 0, flagged: 0, deleted: 0,
      },
    };
  }

  async approveComment(id: string): Promise<BlogComment> { return normalizeComment(await this.post('blog/approveComment', { id })); }
  async flagComment(id: string):    Promise<BlogComment> { return normalizeComment(await this.post('blog/flagComment',    { id })); }
  async deleteComment(id: string):  Promise<boolean> {
    await this.post('blog/deleteComment', { id });
    return true;
  }
  async replyToComment(id: string, content: string): Promise<BlogComment> {
    return normalizeComment(await this.post('blog/replyComment', { id, content }));
  }
  async restoreComment(id: string): Promise<BlogComment> { return normalizeComment(await this.post('blog/restoreComment', { id })); }
  async hardDeleteComment(id: string, force?: boolean): Promise<boolean> {
    await this.post('blog/hardDeleteComment', force ? { id, force } : { id });
    return true;
  }
  async bulkUpdateCommentStatus(ids: string[], status: any): Promise<BulkResult> {
    return this.post('blog/bulkUpdateCommentStatus', { ids, status });
  }
  async bulkDeleteComments(ids: string[], force?: boolean): Promise<BulkResult> {
    return this.post('blog/bulkDeleteComments', force ? { ids, force } : { ids });
  }

  // ─── Moderation rules ────────────────────────────────────────────────
  async listModerationRules(): Promise<BlogModerationRule[]> {
    const data = await this.post<any>('blog/getModerationRules', {});
    return Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
  }
  async getModerationRule(id: string): Promise<BlogModerationRule | null> {
    return (await this.get<BlogModerationRule>(`blog/getModerationRule/${encodeURIComponent(id)}`)) ?? null;
  }
  async saveModerationRule(payload: ModerationRuleSavePayload): Promise<BlogModerationRule> {
    return this.post('blog/saveModerationRule', payload);
  }
  async deleteModerationRule(id: string): Promise<boolean> {
    await this.post('blog/deleteModerationRule', { id });
    return true;
  }
  async toggleModerationRule(id: string, active: boolean): Promise<BlogModerationRule> {
    return this.post('blog/toggleModerationRule', { id, active });
  }

  async getShopperList(params: ShopperListParams = {}): Promise<ShopperListResult> {
    const data = await this.post<any>('blog/getShopperList', {
      page:       params.page  ?? 1,
      limit:      params.limit ?? 20,
      searchTerm: params.searchTerm ?? '',
    });
    return {
      list:      Array.isArray(data?.list) ? data.list : [],
      count:     Number(data?.count ?? 0),
      pageCount: Number(data?.pageCount ?? 1),
    };
  }

  // ─── Writers / Settings / Uploads ────────────────────────────────────

  async getReport(params?: BlogReportParams): Promise<BlogReport> {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to)   qs.set('to', params.to);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const data = await this.get<any>(`blog/getReport${suffix}`);
    return {
      totals: data?.totals ?? {
        totalPosts: 0, totalViews: 0, totalComments: 0,
        publishedCount: 0, draftCount: 0, pendingCount: 0, scheduledCount: 0, trashCount: 0,
      },
      topPosts: Array.isArray(data?.topPosts) ? data.topPosts : [],
      series:   Array.isArray(data?.series)  ? data.series  : undefined,
      hourly:   Array.isArray(data?.hourly)  ? data.hourly  : undefined,
      traffic:  Array.isArray(data?.traffic) ? data.traffic : undefined,
      search:   data?.search ?? null,
      integrations: data?.integrations ?? undefined,
      range:    data?.range ?? undefined,
    };
  }

  async listWriters(): Promise<BlogWriter[]> {
    const data = await this.get<any>('blog/getWriters');
    return Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
  }

  async getSettings(): Promise<BlogSettingsRow> {
    const data = await this.get<any>('blog/getSettings');
    return {
      id:        data?.id ? String(data.id) : null,
      companyId: String(data?.companyId ?? ''),
      type:      'BlogSettings',
      template:  normalizeBlogSettings(data?.template ?? data),
    };
  }

  async saveSettings(template: BlogSettingsTemplate, row: BlogSettingsRow): Promise<BlogSettingsRow> {
    const payload: Record<string, unknown> = { template };
    if (row.id)        payload['id']        = row.id;
    if (row.companyId) payload['companyId'] = row.companyId;
    const data = await this.post<any>('blog/saveSettings', payload);
    return {
      id:        data?.id ? String(data.id) : row.id,
      companyId: String(data?.companyId ?? row.companyId),
      type:      'BlogSettings',
      template:  normalizeBlogSettings(data?.template ?? template),
    };
  }

  async upload(file: File): Promise<UploadResult> {
    const fd = new FormData();
    fd.append('file', file);
    const data = await this.postRaw<any>('blog/uploadImage', fd);
    return { url: String(data?.url ?? '') };
  }

  // ─── HTTP helpers ────────────────────────────────────────────────────
  //
  // Every backend response is wrapped in `{ success, data }` (or a bare
  // payload in legacy endpoints). These helpers unwrap to `data` so the
  // typed methods above don't repeat the same defensive pattern.
  //
  // Errors propagate raw — Angular's HttpClient throws a `HttpErrorResponse`
  // which the pages catch and toast. The auth + feature interceptors run
  // ahead of these calls (401 → login, 403 → forbidden) so we don't need
  // status-specific handling here.

  private async get<T>(path: string): Promise<T> {
    const res = await firstValueFrom(this.http.get<any>(`${this.base}${path}`));
    return (res?.data ?? res) as T;
  }

  private async post<T>(path: string, body: any): Promise<T> {
    const res = await firstValueFrom(this.http.post<any>(`${this.base}${path}`, body));
    return (res?.data ?? res) as T;
  }

  /** Like `post` but doesn't try to JSON-stringify — used for multipart. */
  private async postRaw<T>(path: string, body: FormData): Promise<T> {
    const res = await firstValueFrom(this.http.post<any>(`${this.base}${path}`, body));
    return (res?.data ?? res) as T;
  }

  private async delete(path: string): Promise<void> {
    await firstValueFrom(this.http.delete<any>(`${this.base}${path}`));
  }
}

function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}

/**
 * Map a `getCommentList` row to the flat `BlogComment` the UI binds to. The
 * backend returns a nested shape — `author.{type,id,name,image}`,
 * `post.{id,slug,title}`, `parent.{content,author.name}` — so flatten it.
 */
function normalizeComment(c: any): BlogComment {
  const a = c?.author ?? {};
  return {
    id:               String(c?.id ?? ''),
    postId:           String(c?.postId ?? c?.post?.id ?? ''),
    postTitle:        c?.post?.title ?? c?.postTitle ?? '',
    shopperId:        a.type === 'shopper'  ? (a.id ?? null) : (c?.shopperId ?? null),
    authorEmployeeId: a.type === 'employee' ? (a.id ?? null) : (c?.authorEmployeeId ?? null),
    authorName:       a.name ?? c?.authorName ?? '',
    authorAvatar:     a.image ?? c?.authorAvatar ?? null,
    authorKind:       (a.type ?? c?.authorKind ?? 'shopper') as 'shopper' | 'employee',
    content:          c?.content ?? '',
    parentCommentId:  c?.parentCommentId ?? null,
    parentExcerpt:    c?.parent?.content ?? c?.parentExcerpt,
    parentAuthor:     c?.parent?.author?.name ?? c?.parentAuthor,
    status:           c?.status,
    language:         c?.language ?? null,
    createdAt:        c?.createdAt ?? '',
    updatedAt:        c?.updatedAt ?? '',
  };
}
