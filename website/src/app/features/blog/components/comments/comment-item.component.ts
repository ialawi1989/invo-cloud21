import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { BlogCommentNode } from '../../models/blog.types';
import { t, formatDate } from '../../i18n/i18n';

export interface ReplyRequest  { parentId: string; }
export interface EditRequest   { id: string; content: string; }
export interface DeleteRequest { id: string; }

/**
 * One comment in the thread. Recurses through `replies` until depth
 * matches the configured `maxDepth` from settings — beyond that we
 * still render the comment but stop offering the Reply button.
 *
 * Status comes from explicit booleans now: `isDeleted` (placeholder
 * body, no actions), `isPending` (badge, body still visible —
 * pending comments are only returned to the author), `canEdit`
 * (gates the Edit/Delete actions, set server-side based on the
 * X-Shopper-Session resolution).
 */
@Component({
  selector: 'app-comment-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cmt" [style.padding-inline-start.px]="depth * 24">
      <header class="head">
        @if (comment.author.image) {
          <img class="avatar" [src]="comment.author.image" [alt]="comment.author.name">
        } @else {
          <div class="avatar placeholder" aria-hidden="true">{{ initials() }}</div>
        }
        <div class="who">
          <strong>{{ comment.author.name }}</strong>
          <span class="kind">{{ comment.author.type === 'employee' ? t(lang, 'staff') : t(lang, 'customer') }}</span>
          @if (comment.isPending) {
            <span class="pending">{{ t(lang, 'pending_approval') }}</span>
          }
        </div>
        <time class="when" [attr.datetime]="comment.createdAt">{{ formatDate(lang, comment.createdAt) }}</time>
      </header>

      @if (comment.isDeleted) {
        <p class="deleted">{{ t(lang, 'comment_deleted') }}</p>
      } @else if (editing()) {
        <textarea class="ta" rows="3" [(ngModel)]="draft"></textarea>
        <div class="actions">
          <button type="button" class="btn primary" (click)="saveEdit()">{{ t(lang, 'save') }}</button>
          <button type="button" class="btn" (click)="cancelEdit()">{{ t(lang, 'cancel') }}</button>
        </div>
      } @else {
        <p class="body">{{ comment.content }}</p>
        <div class="actions">
          @if (canReply && !comment.isPending) {
            <button type="button" class="link" (click)="reply.emit({ parentId: comment.id })">{{ t(lang, 'reply') }}</button>
          }
          @if (comment.canEdit) {
            <button type="button" class="link" (click)="startEdit()">{{ t(lang, 'edit') }}</button>
            <button type="button" class="link danger" (click)="del.emit({ id: comment.id })">{{ t(lang, 'delete') }}</button>
          }
        </div>
      }

      @if (comment.replies.length) {
        <div class="children">
          @for (child of comment.replies; track child.id) {
            <app-comment-item
              [comment]="child"
              [lang]="lang"
              [depth]="depth + 1"
              [canReply]="depth + 1 < maxDepth"
              [maxDepth]="maxDepth"
              (reply)="reply.emit($event)"
              (edit)="edit.emit($event)"
              (del)="del.emit($event)">
            </app-comment-item>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .cmt { padding: 16px 0; border-block-start: 1px solid rgba(0,0,0,.06); }
    .cmt:first-child { border-block-start: 0; }
    .head { display: flex; align-items: center; gap: 10px; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
    .avatar.placeholder {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--primary, #6366f1); color: #fff; font-size: 14px;
    }
    .who { flex: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14px; }
    .kind { font-size: 11px; padding: 2px 6px; border-radius: 100px; background: rgba(0,0,0,.06); }
    .pending { font-size: 11px; padding: 2px 8px; border-radius: 100px; background: rgba(255, 180, 0, .15); color: #a47000; }
    .when { font-size: 12px; opacity: .6; }
    .body { margin: 10px 0 8px; line-height: 1.55; white-space: pre-wrap; }
    .deleted { color: rgba(0,0,0,.45); font-style: italic; margin: 10px 0; }
    .actions { display: flex; gap: 14px; }
    .link { background: none; border: 0; padding: 0; cursor: pointer; color: var(--primary, #6366f1); font: inherit; font-size: 13px; }
    .link.danger { color: #c33; }
    .ta { width: 100%; padding: 10px; border: 1px solid rgba(0,0,0,.15); border-radius: 6px; font: inherit; resize: vertical; }
    .btn { padding: 6px 12px; border: 1px solid rgba(0,0,0,.15); border-radius: 6px; background: transparent; cursor: pointer; font: inherit; }
    .btn.primary { background: var(--primary, #6366f1); color: #fff; border-color: transparent; }
    .children { margin-top: 12px; }
  `],
})
export class CommentItemComponent {
  @Input({ required: true }) comment!: BlogCommentNode;
  @Input({ required: true }) lang = 'en';
  @Input() depth = 0;
  @Input() maxDepth = 3;
  @Input() canReply = true;

  @Output() reply = new EventEmitter<ReplyRequest>();
  @Output() edit  = new EventEmitter<EditRequest>();
  @Output() del   = new EventEmitter<DeleteRequest>();

  editing = signal(false);
  draft = '';

  t = t;
  formatDate = formatDate;

  initials(): string {
    return (this.comment.author.name || '?')
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map(w => w[0]!.toUpperCase()).join('') || '?';
  }

  startEdit(): void { this.draft = this.comment.content ?? ''; this.editing.set(true); }
  cancelEdit(): void { this.editing.set(false); this.draft = ''; }
  saveEdit(): void {
    const text = this.draft.trim();
    if (!text) return;
    this.edit.emit({ id: this.comment.id, content: text });
    this.editing.set(false);
  }
}
