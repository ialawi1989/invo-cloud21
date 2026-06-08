import { Component, Input, ChangeDetectionStrategy, inject, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PublicBlogApiService } from '../../services/public-blog-api.service';
import { ShopperAuthService } from '../../services/shopper-auth.service';
import { BlogCommentNode } from '../../models/blog.types';
import { PublicBlogCommentsSettings } from '../../models/blog-settings.types';
import { CommentItemComponent, EditRequest, DeleteRequest, ReplyRequest } from './comment-item.component';
import { t, formatNumber } from '../../i18n/i18n';

/**
 * Comments wrapper: header count, sort dropdown, top-level compose
 * form, recursive thread, login prompt. Login state comes from
 * `ShopperAuthService` as a signal so the prompt updates in place
 * after a sign-in modal closes.
 *
 * On first mount we fetch the thread; mutations (post/edit/delete)
 * optimistically re-fetch instead of patching the tree — comment
 * volume on a single post is small and re-fetch keeps thread state
 * authoritative (server may inject 'pending' status, etc).
 */
@Component({
  selector: 'app-comment-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CommentItemComponent],
  template: `
    @if (settings.enabled) {
      <section class="comments" id="comments">
        <header class="head">
          <h2>{{ t(lang, 'comments_count', { n: formatNumber(lang, totalCount()) }) }}</h2>
          <label class="sort">
            <span>{{ t(lang, 'sort_by') }}:</span>
            <select [ngModel]="sort()" (ngModelChange)="sort.set($event)">
              <option value="newest">{{ t(lang, 'newest') }}</option>
              <option value="oldest">{{ t(lang, 'oldest') }}</option>
            </select>
          </label>
        </header>

        @if (settings.requireShopperLogin && !shopperAuth.current() && shopperAuth.loaded()) {
          <div class="login-prompt">
            <p>{{ t(lang, 'sign_in_to_comment') }}</p>
            <button type="button" class="btn primary" (click)="loginRequest.set(true)">
              {{ t(lang, 'sign_in') }}
            </button>
          </div>
        } @else {
          <form class="compose" (ngSubmit)="submit()" #f="ngForm">
            @if (replyTo()) {
              <div class="reply-banner">
                {{ t(lang, 'reply_to', { name: replyTo()!.author.name }) }}
                <button type="button" class="link" (click)="cancelReply()">{{ t(lang, 'cancel') }}</button>
              </div>
            }
            <textarea
              required
              minlength="1"
              maxlength="4000"
              [(ngModel)]="draft"
              name="content"
              rows="3"
              [placeholder]="t(lang, 'write_a_comment')"
              [attr.aria-label]="t(lang, 'write_a_comment')"></textarea>
            <div class="actions">
              <button type="submit" class="btn primary"
                      [disabled]="submitting() || !draft.trim() || f.invalid">
                {{ t(lang, 'post_comment') }}
              </button>
            </div>
            @if (submitError()) {
              <p class="error">{{ submitError() }}</p>
            }
          </form>
        }

        @if (loading()) {
          <p class="loading">…</p>
        } @else if (comments().length === 0) {
          <p class="empty">{{ t(lang, 'no_comments') }}</p>
        } @else {
          <div class="thread">
            @for (c of sorted(); track c.id) {
              <app-comment-item
                [comment]="c"
                [lang]="lang"
                [maxDepth]="settings.maxDepth"
                [canReply]="settings.allowReplies && 0 < settings.maxDepth"
                (reply)="onReply($event)"
                (edit)="onEdit($event)"
                (del)="onDelete($event)">
              </app-comment-item>
            }
          </div>
        }
      </section>
    }
  `,
  styles: [`
    :host { display: block; }
    .comments { max-width: 720px; margin: 64px auto; }
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    h2 { margin: 0; font-size: 22px; }
    .sort { display: inline-flex; gap: 8px; align-items: center; font-size: 13px; opacity: .8; }
    .sort select { padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(0,0,0,.12); font: inherit; color: inherit; background: transparent; }
    .login-prompt {
      padding: 20px; border-radius: 10px;
      background: rgba(99,102,241,.06);
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      margin-bottom: 24px;
    }
    .compose { margin-bottom: 24px; }
    .compose textarea {
      width: 100%; padding: 12px; border-radius: 8px;
      border: 1px solid rgba(0,0,0,.15);
      font: inherit; resize: vertical;
    }
    .actions { margin-top: 10px; display: flex; justify-content: flex-end; }
    .btn { padding: 8px 16px; border: 1px solid rgba(0,0,0,.15); border-radius: 6px; background: transparent; cursor: pointer; font: inherit; }
    .btn.primary { background: var(--primary, #6366f1); color: #fff; border-color: transparent; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .link { background: none; border: 0; padding: 0; cursor: pointer; color: var(--primary, #6366f1); font: inherit; }
    .reply-banner { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; padding: 8px 12px; background: rgba(0,0,0,.04); border-radius: 6px; font-size: 13px; }
    .empty, .loading { text-align: center; color: rgba(0,0,0,.5); padding: 24px 0; }
    .error { color: #c33; font-size: 13px; margin-top: 8px; }
  `],
})
export class CommentSectionComponent implements OnChanges {
  @Input({ required: true }) postId!: string;
  @Input({ required: true }) lang!: string;
  @Input({ required: true }) settings!: PublicBlogCommentsSettings;

  private api = inject(PublicBlogApiService);
  shopperAuth = inject(ShopperAuthService);

  comments = signal<BlogCommentNode[]>([]);
  loading  = signal(false);
  sort     = signal<'newest' | 'oldest'>('newest');
  draft    = '';
  replyTo  = signal<BlogCommentNode | null>(null);
  submitting   = signal(false);
  submitError  = signal<string | null>(null);
  /** Emits true when the user clicks the inline Sign In CTA. The post
   *  page can listen to this and open its auth modal. */
  loginRequest = signal(false);

  t = t;
  formatNumber = formatNumber;

  ngOnChanges(c: SimpleChanges): void {
    if (c['postId'] && this.postId) this.load();
  }

  totalCount(): number {
    const walk = (n: BlogCommentNode[] | null | undefined): number =>
      (Array.isArray(n) ? n : []).reduce(
        (sum, x) => sum + (x.isDeleted ? 0 : 1) + walk(x.replies), 0,
      );
    return walk(this.comments());
  }

  sorted(): BlogCommentNode[] {
    const dir = this.sort() === 'newest' ? -1 : 1;
    const copy = [...this.comments()];
    copy.sort((a, b) => dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    return copy;
  }

  async load(): Promise<void> {
    if (!this.settings.enabled) return;
    this.loading.set(true);
    try {
      // Tolerate either a bare array or a paginated `{ data, pagination }`
      // envelope from the backend so a shape change can't crash the tree.
      const res = await this.api.listPostComments(this.postId, this.lang) as
        BlogCommentNode[] | { data?: BlogCommentNode[] } | null;
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      this.comments.set(list);
    } catch {
      this.comments.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    const text = this.draft.trim();
    if (!text) return;
    this.submitting.set(true);
    this.submitError.set(null);
    try {
      await this.api.createComment(this.postId, {
        content: text,
        parentCommentId: this.replyTo()?.id ?? null,
        language: this.lang,
      });
      this.draft = '';
      this.replyTo.set(null);
      await this.load();
    } catch (e: any) {
      this.submitError.set(this.errorMessage(e));
    } finally {
      this.submitting.set(false);
    }
  }

  /** Map the backend `{ error: { code, message } }` envelope (and
   *  HTTP status) onto a user-facing string. Rate limiting gets a
   *  bespoke message; everything else falls back to the server
   *  message or a generic line. */
  private errorMessage(e: any): string {
    const code = e?.error?.error?.code ?? e?.error?.code;
    const status = e?.status;
    if (code === 'RATE_LIMITED' || status === 429) {
      return 'You’re posting too quickly — please try again in a moment.';
    }
    if (code === 'UNAUTHORIZED' || status === 401) {
      return t(this.lang, 'sign_in_to_comment');
    }
    if (code === 'COMMENTS_DISABLED') return 'Comments are disabled for this post.';
    if (code === 'DEPTH_EXCEEDED')    return 'Reply depth limit reached.';
    if (code === 'FORBIDDEN' || status === 403) return 'You don’t have permission to do that.';
    return e?.error?.error?.message ?? e?.error?.message ?? e?.message ?? 'Failed to post comment.';
  }

  cancelReply(): void { this.replyTo.set(null); }

  onReply(r: ReplyRequest): void {
    const found = this.findById(this.comments(), r.parentId);
    if (found) this.replyTo.set(found);
  }

  async onEdit(e: EditRequest): Promise<void> {
    try { await this.api.updateOwnComment(e.id, e.content); await this.load(); }
    catch { /* swallow — UI keeps the form open with stale content */ }
  }

  async onDelete(d: DeleteRequest): Promise<void> {
    try { await this.api.deleteOwnComment(d.id); await this.load(); }
    catch { /* same — silent fail keeps the comment visible */ }
  }

  private findById(list: BlogCommentNode[], id: string): BlogCommentNode | null {
    for (const c of list) {
      if (c.id === id) return c;
      const sub = this.findById(c.replies ?? [], id);
      if (sub) return sub;
    }
    return null;
  }
}
