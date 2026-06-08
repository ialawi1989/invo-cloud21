import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { SegmentedToggleComponent } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { ToastService } from '@shared/components/toast/toast.service';

import { BLOG_API } from '../services/blog-api';
import { BlogPostNote, NoteStatus } from '../services/blog.types';
import { timeAgo } from '../utils/blog-utils';

/**
 * Wix-style editor notes for a post: a list of notes (author + time +
 * content) filtered by Open / Resolved, with resolve/re-open, edit, delete,
 * threaded replies, and an "add note" composer. Lives in the composer's
 * Notes rail; persists via the `blog/*PostNote*` endpoints.
 */
@Component({
  selector: 'app-blog-notes-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, SegmentedToggleComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notes-panel.component.html',
  styleUrl: './notes-panel.component.scss',
})
export class NotesPanelComponent {
  private api   = inject(BLOG_API);
  private toast = inject(ToastService);

  /** Post the notes belong to (empty until the post is saved). */
  postId = input<string | null>(null);

  loading = signal(false);
  notes   = signal<BlogPostNote[]>([]);
  filter  = signal<NoteStatus>('open');

  draft       = signal('');        // new top-level note
  replyingId  = signal<string | null>(null);
  replyDraft  = signal('');
  editingId   = signal<string | null>(null);
  editDraft   = signal('');
  menuId      = signal<string | null>(null);

  readonly filterOptions = [
    { value: 'open',     label: 'BLOG.NOTES.OPEN' },
    { value: 'resolved', label: 'BLOG.NOTES.RESOLVED' },
  ];

  /** Top-level notes matching the active filter, each with its replies. */
  threaded = computed(() => {
    const all = this.notes();
    const status = this.filter();
    return all
      .filter(n => !n.parentNoteId && n.status === status)
      .map(n => ({ ...n, replies: n.replies ?? all.filter(r => r.parentNoteId === n.id) }));
  });

  constructor() {
    // (Re)load whenever the post id becomes available / changes.
    effect(() => {
      const id = this.postId();
      if (id) void this.load(id);
      else this.notes.set([]);
    });
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      this.notes.set(await this.api.listPostNotes(id));
    } catch {
      this.notes.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private async reload(): Promise<void> {
    const id = this.postId();
    if (id) await this.load(id);
  }

  // ── Compose ─────────────────────────────────────────────────────────
  async addNote(): Promise<void> {
    const id = this.postId();
    const content = this.draft().trim();
    if (!id || !content) return;
    try {
      await this.api.addPostNote(id, content);
      this.draft.set('');
      await this.reload();
    } catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }

  startReply(noteId: string): void { this.replyingId.set(noteId); this.replyDraft.set(''); this.menuId.set(null); }
  cancelReply(): void { this.replyingId.set(null); this.replyDraft.set(''); }
  async sendReply(parentId: string): Promise<void> {
    const id = this.postId();
    const content = this.replyDraft().trim();
    if (!id || !content) return;
    try {
      await this.api.addPostNote(id, content, parentId);
      this.cancelReply();
      await this.reload();
    } catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }

  // ── Per-note actions ────────────────────────────────────────────────
  toggleMenu(id: string): void { this.menuId.set(this.menuId() === id ? null : id); }

  async setStatus(n: BlogPostNote, status: NoteStatus): Promise<void> {
    this.menuId.set(null);
    try {
      await this.api.setPostNoteStatus(n.id, status);
      await this.reload();
    } catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }

  startEdit(n: BlogPostNote): void { this.editingId.set(n.id); this.editDraft.set(n.content); this.menuId.set(null); }
  cancelEdit(): void { this.editingId.set(null); this.editDraft.set(''); }
  async saveEdit(n: BlogPostNote): Promise<void> {
    const content = this.editDraft().trim();
    if (!content) return;
    try {
      await this.api.updatePostNote(n.id, content);
      this.cancelEdit();
      await this.reload();
    } catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }

  async remove(n: BlogPostNote): Promise<void> {
    this.menuId.set(null);
    try {
      await this.api.deletePostNote(n.id);
      await this.reload();
    } catch (e: any) { this.toast.error('COMMON.DELETE_FAILED', e?.message); }
  }

  // ── Display helpers ─────────────────────────────────────────────────
  ago(n: BlogPostNote): string { return timeAgo(n.createdAt); }
  initial(name: string): string { return (name ?? '').trim().charAt(0).toUpperCase() || '?'; }
}
