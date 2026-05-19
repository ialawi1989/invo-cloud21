import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { BlogApi } from './blog-api';
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
      list:      Array.isArray(data?.list) ? data.list : [],
      count:     Number(data?.count ?? 0),
      pageCount: Number(data?.pageCount ?? 1),
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

  async publishPost(id: string):   Promise<BlogPost> { return this.post('blog/publishPost',   { id }); }
  async unpublishPost(id: string): Promise<BlogPost> { return this.post('blog/unpublishPost', { id }); }
  async schedulePost(id: string, scheduledDate: string): Promise<BlogPost> {
    return this.post('blog/schedulePost', { id, scheduledDate });
  }
  async duplicatePost(id: string): Promise<BlogPost> { return this.post('blog/duplicatePost', { id }); }

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
      list:         Array.isArray(data?.list) ? data.list : [],
      count:        Number(data?.count ?? 0),
      pageCount:    Number(data?.pageCount ?? 1),
      statusCounts: data?.statusCounts ?? data?.counts ?? {
        all: 0, visible: 0, pending: 0, flagged: 0, deleted: 0,
      },
    };
  }

  async approveComment(id: string): Promise<BlogComment> { return this.post('blog/approveComment', { id }); }
  async flagComment(id: string):    Promise<BlogComment> { return this.post('blog/flagComment',    { id }); }
  async deleteComment(id: string):  Promise<boolean> {
    await this.post('blog/deleteComment', { id });
    return true;
  }
  async replyToComment(id: string, content: string): Promise<BlogComment> {
    return this.post('blog/replyComment', { id, content });
  }

  // ─── Writers / Settings / Uploads ────────────────────────────────────

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
